/**
 * Migra fotos e textos do WordPress antigo para o Neon.
 *
 * O site legado (pousadamarimarilhadomel.com.br) tem a API REST aberta e
 * guarda 68 imagens e 8 paginas de conteudo que o site novo nao tinha.
 *
 * Rode na sua maquina (precisa de rede ate o WordPress E ate o Neon):
 *   npm run db:migrar-wp
 *
 * Idempotente: pula qualquer URL que ja exista na tabela `midias`.
 * Nao apaga nada. Roda quantas vezes quiser.
 *
 * Opcoes:
 *   --dry     mostra o que faria, sem gravar
 *   --textos  migra tambem o texto das paginas (padrao: so fotos)
 */
import { urlDoBanco, sair, explicarErro } from "./env";
import postgres from "postgres";

const WP = "https://pousadamarimarilhadomel.com.br/wp-json/wp/v2";
const DRY = process.argv.includes("--dry");
const COM_TEXTOS = process.argv.includes("--textos");

/** Imagens do tema/demo do WordPress — nao sao da pousada. */
const LIXO_DO_TEMA = [
  "placeholder", "placeholder-gif", "woocommerce-placeholder",
  "service-jpg", "services-slider-png", "about-jpg", "macbook-png",
];

/** Logos e icones: nao entram na galeria de fotos. */
const LOGOS = ["logo", "logotipo", "logo-footer", "favicon", "cropped-favicon-png"];

type Classificacao = { categoria: string; alt: string; hero?: boolean; pular?: boolean };

/**
 * Classifica pelo slug. Nenhuma imagem do WP tem alt_text preenchido,
 * entao o alt precisa ser derivado — e alt vazio e barreira de
 * acessibilidade, alem de ser NOT NULL no schema.
 */
function classificar(slug: string, largura: number, altura: number): Classificacao {
  const s = slug.toLowerCase();

  if (LIXO_DO_TEMA.includes(s)) return { categoria: "lixo", alt: "", pular: true };
  if (LOGOS.includes(s)) return { categoria: "logo", alt: "", pular: true };

  // Fotos aereas de drone: melhor material possivel para o hero
  if (s.startsWith("created-by-dji-camera")) {
    return { categoria: "aerea", alt: "Vista aérea da Praia de Encantadas e da Pousada Marimar", hero: true };
  }
  if (s.startsWith("slide") || /^foto\d/.test(s)) {
    return { categoria: "fachada", alt: "Pousada Marimar em Encantadas, Ilha do Mel", hero: largura >= 1600 };
  }
  if (s.includes("cafe-da-manha") || s.includes("cafedamanha")) {
    return { categoria: "cafe", alt: "Café da manhã servido no Marimar Café Bistrô Bar" };
  }
  if (s.includes("evento") || s.includes("buffet")) {
    return { categoria: "eventos", alt: "Espaço para eventos da Pousada Marimar" };
  }
  if (s.includes("localizacao")) {
    return { categoria: "localizacao", alt: "Localização da Pousada Marimar em Encantadas" };
  }
  if (s.includes("familia")) return { categoria: "quarto", alt: "Suíte Família da Pousada Marimar" };
  if (s.includes("triplo")) return { categoria: "quarto", alt: "Suíte Tripla da Pousada Marimar" };
  if (s.includes("duplo")) return { categoria: "quarto", alt: "Suíte Duplo da Pousada Marimar" };
  if (s.startsWith("marimar")) return { categoria: "fachada", alt: "Pousada Marimar, Ilha do Mel" };

  // Numeradas sem nome descritivo (001..007, 01..06, 1..9)
  if (/^\d{1,3}(-\d)?$/.test(s)) {
    const retrato = altura > largura;
    return {
      categoria: retrato ? "ambiente" : "pousada",
      alt: retrato
        ? "Ambiente da Pousada Marimar, Ilha do Mel"
        : "Pousada Marimar em Encantadas, Ilha do Mel",
    };
  }

  return { categoria: "pousada", alt: "Pousada Marimar, Ilha do Mel" };
}

function limparHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/\[[^\]]+\]/g, "")          // shortcodes do Visual Composer
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"').replace(/&#8217;/g, "'")
    .replace(/&#\d+;/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Guardado fora de main() para o catch conseguir fechar a conexao antes de
// sair. Encerrar o processo com a conexao aberta derruba o Node no Windows
// com: Assertion failed: !(handle->flags & UV_HANDLE_CLOSING) em async.c
let clienteAberto: { end: () => Promise<void> } | null = null;

async function main() {
  console.log(DRY ? "🔍 MODO DRY-RUN — nada será gravado\n" : "🚚 Migrando do WordPress para o Neon\n");

  console.log("→ Buscando mídias no WordPress...");
  const res = await fetch(`${WP}/media?per_page=100&_fields=id,slug,source_url,mime_type,media_details`);
  if (!res.ok) throw new Error(`WordPress respondeu HTTP ${res.status}`);
  const midiasWp: any[] = await res.json();
  const imagens = midiasWp.filter((m) => m.mime_type?.startsWith("image/"));
  console.log(`  ${imagens.length} imagens encontradas\n`);

  const sql = postgres(urlDoBanco(), { max: 1 });
  clienteAberto = sql;

  const existentes = new Set(
    (await sql`SELECT url FROM midias`).map((r: any) => r.url as string)
  );
  console.log(`→ ${existentes.size} mídias já no banco (serão puladas se repetidas)\n`);

  let inseridas = 0, puladas = 0, jaExistiam = 0;
  const porCategoria: Record<string, number> = {};
  let heroEscolhido = false;

  // Aereas primeiro, para que a foto de hero seja uma delas
  const ordenadas = [...imagens].sort((a, b) => {
    const pa = a.slug.startsWith("created-by-dji-camera") ? 0 : 1;
    const pb = b.slug.startsWith("created-by-dji-camera") ? 0 : 1;
    return pa - pb;
  });

  for (const m of ordenadas) {
    const largura = m.media_details?.width ?? 0;
    const altura = m.media_details?.height ?? 0;
    const c = classificar(m.slug, largura, altura);

    if (c.pular) { puladas++; continue; }
    if (existentes.has(m.source_url)) { jaExistiam++; continue; }

    porCategoria[c.categoria] = (porCategoria[c.categoria] ?? 0) + 1;

    // A PRIMEIRA aerea vira o hero: destaque = true e SEM quarto_id, que e
    // exatamente o que a home procura. Resolve a foto de beliche no hero.
    const viraHero = !heroEscolhido && c.hero === true && c.categoria === "aerea";
    if (viraHero) heroEscolhido = true;

    if (DRY) {
      console.log(`  + [${c.categoria}]${viraHero ? " ★HERO" : ""} ${m.slug} — "${c.alt}"`);
    } else {
      await sql`
        INSERT INTO midias (url, alt, tipo, largura, altura, ordem, destaque, quarto_id)
        VALUES (${m.source_url}, ${c.alt}, 'foto', ${largura}, ${altura},
                ${porCategoria[c.categoria]}, ${viraHero}, ${null})
      `;
    }
    inseridas++;
  }

  console.log(`\n${DRY ? "Seriam inseridas" : "✅ Inseridas"}: ${inseridas}`);
  console.log(`   Já existiam: ${jaExistiam}`);
  console.log(`   Puladas (tema/logos): ${puladas}`);
  console.log(`   Por categoria: ${JSON.stringify(porCategoria)}`);
  console.log(heroEscolhido
    ? "\n★ Uma foto aérea de drone foi marcada como HERO (destaque, sem quarto)."
    : "\n⚠️  Nenhuma aérea nova — o hero pode já estar definido ou não haver aéreas.");

  // ─── TEXTOS ───
  if (COM_TEXTOS) {
    console.log("\n→ Buscando páginas de conteúdo...");
    const pRes = await fetch(`${WP}/pages?per_page=50&_fields=slug,title,content`);
    const paginas: any[] = await pRes.json();
    const interessa = ["sobre-nos", "instalacoes", "restaurante", "localizacao", "eventos"];

    for (const pg of paginas) {
      if (!interessa.includes(pg.slug)) continue;
      const texto = limparHtml(pg.content?.rendered || "");
      if (texto.length < 80) { console.log(`  • ${pg.slug}: sem texto aproveitável`); continue; }
      console.log(`\n  📄 ${pg.slug} (${texto.length} caracteres)`);
      console.log(`     "${texto.slice(0, 160)}..."`);

      if (!DRY && pg.slug === "sobre-nos") {
        await sql`UPDATE pousada SET descricao_longa = ${texto}, atualizado_em = now()
                  WHERE id = (SELECT id FROM pousada LIMIT 1)`;
        console.log("     ✅ Gravado em pousada.descricao_longa");
      }
    }
    if (!DRY) {
      console.log("\n   Os demais textos NÃO foram gravados automaticamente:");
      console.log("   eles descrevem o complexo e precisam da sua revisão antes de ir ao ar.");
      console.log("   Copie o que interessar para o admin.");
    }
  } else {
    console.log("\n(Para migrar também os textos das páginas, rode com --textos)");
  }

  console.log("\nPronto.");
  await sair(sql, 0);
}

main().catch(async (e) => {
  console.error("\n❌ Falhou:", explicarErro(e));
  if (clienteAberto) { try { await clienteAberto.end(); } catch { /* ignora */ } }
  process.exit(1);
});
