/**
 * Traz para casa as imagens que ainda moram no WordPress antigo.
 *
 * O script de importacao original gravou as URLs de origem
 * (`pousadamarimarilhadomel.com.br/wp-content/...`) em vez de copiar os
 * arquivos. Funciona hoje por um motivo frágil: o servidor antigo ainda
 * está de pé. No dia em que o DNS apontar para a Vercel, ele sai do ar e
 * TODAS essas imagens somem de uma vez — topo da home, galeria, fotos de
 * quarto, e agora também as fotos que a Marina manda no chat.
 *
 * O que ele faz: para cada coluna de URL do banco que ainda aponta para o
 * domínio antigo, baixa o arquivo, sobe para o Vercel Blob e reescreve a
 * URL. Uma imagem usada em vários lugares é baixada e enviada uma vez só.
 *
 *   npm run db:migrar-fotos -- --dry     # mostra o que faria, sem tocar em nada
 *   npm run db:migrar-fotos              # faz
 *   npm run db:migrar-fotos -- --reverter backups/fotos-<data>.json
 *
 * Toda troca e anotada num arquivo de volta ANTES de acontecer. Sem ele, o
 * script sobrescreveria a URL antiga e nao haveria como desfazer — e este
 * script escreve no banco de producao.
 *
 * É seguro rodar de novo: o que já foi migrado não casa mais com o filtro.
 * Se parar no meio, cada linha já gravada continua gravada — não há
 * transação única que desfaça tudo.
 */
import { urlDoBanco } from "./env";
import postgres from "postgres";
import { put } from "@vercel/blob";
import { mkdirSync, writeFileSync, readFileSync, appendFileSync } from "node:fs";

/** Os dois domínios do site anterior, com ou sem www. */
const ANTIGOS = ["pousadamarimarilhadomel.com.br", "pousadamarimar.com.br"];

/** Onde procurar. Tabela, coluna da URL e, quando existe, a do pathname. */
const ALVOS: { tabela: string; coluna: string; pathname?: string }[] = [
  { tabela: "midias", coluna: "url" },
  { tabela: "pousada", coluna: "logo_url" },
  { tabela: "pousada", coluna: "favicon_url" },
  { tabela: "pousada", coluna: "og_image_url" },
  { tabela: "pacotes", coluna: "imagem_url" },
  { tabela: "blocos_home", coluna: "imagem_url" },
  { tabela: "passeios", coluna: "imagem_url" },
  { tabela: "cardapio_itens", coluna: "foto_url" },
  { tabela: "cardapio_fotos", coluna: "url", pathname: "pathname" },
  { tabela: "banners", coluna: "imagem_url", pathname: "imagem_pathname" },
  { tabela: "banners", coluna: "video_url", pathname: "video_pathname" },
  { tabela: "blocos_itens", coluna: "imagem_url", pathname: "imagem_pathname" },
];

const seco = process.argv.includes("--dry");
const reverterDe = (() => {
  const i = process.argv.indexOf("--reverter");
  return i >= 0 ? process.argv[i + 1] : null;
})();

type Troca = { tabela: string; coluna: string; id: string; antiga: string; nova: string };

/** Desfaz uma migracao, linha por linha, a partir do arquivo de volta. */
async function reverter(arquivo: string) {
  const linhas = readFileSync(arquivo, "utf8")
    .split("\n").filter(Boolean).map((l) => JSON.parse(l) as Troca);

  if (!linhas.length) {
    console.log("\nArquivo de volta vazio — nada a desfazer.\n");
    return;
  }

  const sql = postgres(urlDoBanco(), { max: 1, prepare: false });
  console.log(`\n↩  Desfazendo ${linhas.length} trocas de ${arquivo}\n`);

  let feitas = 0;
  for (const t of linhas) {
    try {
      /* So volta atras se o valor atual ainda for o que ESTE script gravou.
         Se alguem trocou a imagem pelo admin depois, a escolha dela vale
         mais que a nossa — desfazer por cima seria apagar trabalho. */
      const r = await sql`
        UPDATE ${sql(t.tabela)} SET ${sql(t.coluna)} = ${t.antiga}
        WHERE id = ${t.id} AND ${sql(t.coluna)} = ${t.nova}`;
      if (r.count) { feitas++; console.log(`   ↩ ${t.tabela}.${t.coluna}`); }
      else console.log(`   ⏭ ${t.tabela}.${t.coluna} — mudou depois, deixei como esta`);
    } catch (e) {
      console.log(`   ✗ ${t.tabela}.${t.coluna} — ${(e as Error).message}`);
    }
  }
  await sql.end();
  console.log(`\nDesfeitas: ${feitas} de ${linhas.length}\n`);
}

/** Nome do arquivo no Blob, a partir da URL antiga. */
function destino(url: string): string {
  const caminho = decodeURIComponent(new URL(url).pathname);
  const nome = caminho.split("/").pop() || "arquivo";
  // Mantem o nome legivel (o admin lista isso) e tira o que atrapalha.
  const limpo = nome.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120);
  return `wordpress/${limpo}`;
}

async function baixar(url: string): Promise<Buffer> {
  const r = await fetch(url, {
    redirect: "follow",
    headers: { "user-agent": "Mozilla/5.0 (compatible; MarimarMigracao/1.0)" },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const bytes = Buffer.from(await r.arrayBuffer());
  if (bytes.length < 100) throw new Error("arquivo vazio ou pagina de erro");
  return bytes;
}

async function principal() {
  if (reverterDe) return reverter(reverterDe);

  if (!seco && !process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("\n❌ BLOB_READ_WRITE_TOKEN não encontrada em .env.local.");
    console.error("   Traga com: npx vercel env pull .env.local\n");
    process.exit(1);
  }

  const sql = postgres(urlDoBanco(), { max: 1, prepare: false });
  const filtro = ANTIGOS.map((d) => `%${d}%`);

  /* O arquivo de volta e escrito uma linha por vez, a cada troca, e nao no
     fim: se o processo morrer no meio, o que ja foi trocado continua
     registrado. Um arquivo escrito so no fim seria inutil exatamente na
     hora em que ele mais importa. */
  let arquivoVolta = "";
  if (!seco) {
    mkdirSync("backups", { recursive: true });
    arquivoVolta = `backups/fotos-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
    writeFileSync(arquivoVolta, "");
    console.log(`Registro de volta: ${arquivoVolta}\n`);
  }

  console.log(seco ? "\n🔍 SIMULAÇÃO — nada será alterado\n" : "\n🚚 Migrando imagens do WordPress\n");

  /* Uma URL pode aparecer em várias linhas e várias tabelas. Este mapa
     garante um download e um envio por arquivo — sem ele, uma foto usada
     em três lugares viraria três cópias no Blob, cobradas e divergentes. */
  const jaEnviado = new Map<string, string>();

  let achadas = 0, migradas = 0, falhas = 0;
  const problemas: { url: string; erro: string }[] = [];

  for (const alvo of ALVOS) {
    let linhas: { id: string; valor: string }[];
    try {
      linhas = await sql<{ id: string; valor: string }[]>`
        SELECT id, ${sql(alvo.coluna)} AS valor
        FROM ${sql(alvo.tabela)}
        WHERE ${sql(alvo.coluna)} LIKE ANY(${filtro})`;
    } catch (e) {
      // Tabela ou coluna que ainda nao existe neste banco: seguir em frente
      // e melhor do que parar a migracao inteira por causa de uma.
      console.log(`   ⏭  ${alvo.tabela}.${alvo.coluna} — ${(e as Error).message.split("\n")[0]}`);
      continue;
    }

    if (!linhas.length) continue;
    achadas += linhas.length;
    console.log(`\n📁 ${alvo.tabela}.${alvo.coluna} — ${linhas.length} para migrar`);

    for (const linha of linhas) {
      const antiga = linha.valor;
      try {
        let nova = jaEnviado.get(antiga);

        if (!nova) {
          if (seco) {
            nova = `(iria para blob: ${destino(antiga)})`;
          } else {
            const bytes = await baixar(antiga);
            const enviado = await put(destino(antiga), bytes, {
              access: "public",
              addRandomSuffix: true,
            });
            nova = enviado.url;
            // Só entra no mapa depois de enviado: guardar antes faria uma
            // falha de rede contaminar todas as linhas seguintes.
            jaEnviado.set(antiga, nova);
          }
        }

        if (!seco) {
          appendFileSync(arquivoVolta, JSON.stringify({
            tabela: alvo.tabela, coluna: alvo.coluna, id: linha.id, antiga, nova,
          }) + "\n");

          if (alvo.pathname) {
            const caminho = new URL(nova).pathname.replace(/^\//, "");
            await sql`
              UPDATE ${sql(alvo.tabela)}
              SET ${sql(alvo.coluna)} = ${nova}, ${sql(alvo.pathname)} = ${caminho}
              WHERE id = ${linha.id}`;
          } else {
            await sql`
              UPDATE ${sql(alvo.tabela)}
              SET ${sql(alvo.coluna)} = ${nova}
              WHERE id = ${linha.id}`;
          }
        }

        migradas++;
        console.log(`   ✓ ${antiga.split("/").pop()}`);
      } catch (e) {
        falhas++;
        const erro = (e as Error).message;
        problemas.push({ url: antiga, erro });
        console.log(`   ✗ ${antiga.split("/").pop()} — ${erro}`);
      }
    }
  }

  await sql.end();

  console.log("\n" + "─".repeat(60));
  console.log(`Encontradas: ${achadas}   Migradas: ${migradas}   Falhas: ${falhas}`);
  console.log(`Arquivos enviados: ${jaEnviado.size}${achadas > jaEnviado.size && !seco ? "  (o resto eram repetições)" : ""}`);

  if (problemas.length) {
    console.log("\n⚠️  As que falharam continuam apontando para o servidor antigo");
    console.log("   e vão sumir na virada de DNS. Vale substituir à mão pelo admin:\n");
    for (const p of problemas) console.log(`   ${p.url}\n     → ${p.erro}`);
  }

  if (seco) {
    console.log("\nFoi só simulação. Para fazer de verdade:  npm run db:migrar-fotos");
  } else if (arquivoVolta) {
    console.log(`\nPara desfazer:  npm run db:migrar-fotos -- --reverter ${arquivoVolta}`);
  } else if (!falhas && achadas) {
    console.log("\n✅ Nenhuma imagem depende mais do servidor antigo.");
  } else if (!achadas) {
    console.log("\n✅ Nada para migrar — nenhuma URL aponta para o domínio antigo.");
  }
  console.log();
}

principal().catch((e) => {
  console.error("\n❌ Falha geral:", e);
  process.exit(1);
});
