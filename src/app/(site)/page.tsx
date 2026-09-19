import postgres from "postgres";
import { lerBanner } from "@/lib/banners";
import { agruparItens } from "@/lib/blocos";
import { RenderBloco, type Bloco, type DadosHome } from "@/components/site/BlocosHome";

export const dynamic = "force-dynamic";

/**
 * A home e montada a partir da tabela `blocos_home`: quais secoes aparecem,
 * em que ordem e com que titulo sao decisao da administracao, no admin.
 *
 * MESCLA, nao substitui. A tabela foi semeada antes do redesign e nao tem as
 * secoes novas. Se a home usasse so o banco, perderia justamente o que foi
 * criado agora — e foi o que aconteceu no primeiro teste.
 *
 * A regra distingue dois estados diferentes:
 *  - tipo SEM linha no banco  = ainda nao configurado -> entra no padrao
 *  - tipo COM linha inativa   = escondido de proposito -> respeita e nao mostra
 *
 * Assim o site nunca degrada sozinho, e a administracao continua no controle.
 */
const PADRAO = [
  "hero", "complexo", "diferenciais", "quartos",
  "restaurante", "avaliacoes", "mapa", "cta", "faq",
] as const;

export default async function HomePage() {
  let pousada: any = null;
  let quartos: any[] = [];
  let faqs: any[] = [];
  let heroMidia: any = null;
  let blocos: Bloco[] = [];
  let banners: any[] = [];
  let itensBlocos: any[] = [];
  let pacotesTopo: any[] = [];

  try {
    const sql = postgres(process.env.DATABASE_URL!, { max: 1, connect_timeout: 5, prepare: false });
    [pousada] = await sql`SELECT * FROM pousada LIMIT 1`;

    quartos = await sql`
      SELECT q.*, c.nome AS cat_nome,
        COALESCE(
          (SELECT m.url FROM midias m WHERE m.quarto_id = q.id AND m.destaque = true ORDER BY m.ordem LIMIT 1),
          (SELECT m.url FROM midias m WHERE m.quarto_id = q.id ORDER BY m.ordem LIMIT 1)
        ) AS foto,
        COALESCE(
          (SELECT m.alt FROM midias m WHERE m.quarto_id = q.id AND m.destaque = true ORDER BY m.ordem LIMIT 1),
          (SELECT m.alt FROM midias m WHERE m.quarto_id = q.id ORDER BY m.ordem LIMIT 1)
        ) AS foto_alt
      FROM quartos q LEFT JOIN categorias c ON q.categoria_id = c.id
      WHERE q.ativo = true ORDER BY q.ordem LIMIT 6
    `;

    faqs = await sql`SELECT * FROM faq WHERE ativo = true ORDER BY ordem LIMIT 6`;

    /* Para a aba "Pacotes e ofertas" da busca. Tres: a caixa e pequena, e
       uma lista longa ali em cima competiria com a busca por datas, que e
       o que a maioria veio fazer. */
    pacotesTopo = await sql`
      SELECT slug, nome, descricao AS resumo FROM pacotes
      WHERE ativo = true ORDER BY ordem, criado_em LIMIT 3
    `;

    [heroMidia] = await sql`
      SELECT url, alt FROM midias WHERE destaque = true
      ORDER BY (quarto_id IS NULL) DESC, ordem LIMIT 1
    `;

    /* Banners do topo. A janela de exibicao e resolvida NO BANCO, com
       `now()`: fazer essa conta no servidor Node daria a hora do data
       center, nao a que a pousada cadastrou, e um banner de feriado
       entraria ou sairia na hora errada. */
    try {
      banners = await sql`
        SELECT * FROM banners
        WHERE ativo = true
          AND (inicia_em  IS NULL OR inicia_em  <= now())
          AND (termina_em IS NULL OR termina_em >= now())
        ORDER BY ordem, criado_em
      `;
    } catch (e) {
      /* Isolado de proposito. Ate a migration 0005 rodar, a tabela nao
         existe — e uma falha aqui derrubaria o `try` inteiro, levando junto
         os blocos da home, que sao consultados logo abaixo. O topo volta ao
         comportamento antigo e o resto da pagina nem percebe. */
      console.warn("[HomePage] banners indisponiveis (rodou a migration 0005?):", (e as Error).message);
    }

    try {
      /* Os cartoes de cada bloco. Isolado pelo mesmo motivo dos banners:
         entre o deploy e a migration 0007 a tabela nao existe, e a falha
         derrubaria os blocos da home logo abaixo. */
      itensBlocos = await sql`
        SELECT i.*, b.tipo
        FROM blocos_itens i
        JOIN blocos_home b ON b.id = i.bloco_id
        WHERE i.ativo = true
        ORDER BY i.ordem, i.criado_em
      `;
    } catch (e) {
      console.warn("[HomePage] itens dos blocos indisponiveis (migration 0007?):", (e as Error).message);
    }

    // Traz ativos e inativos: precisamos saber quais tipos JA existem,
    // para nao reinserir um que foi escondido de proposito.
    const linhas = await sql`
      SELECT id, tipo, titulo, subtitulo, imagem_url, ativo
      FROM blocos_home ORDER BY ordem, criado_em
    `;
    blocos = linhas as unknown as (Bloco & { ativo: boolean })[];

    await sql.end();
  } catch (e) {
    console.error("[HomePage] banco indisponivel:", (e as Error).message);
  }

  const dados: DadosHome = {
    pousada,
    quartos,
    faqs,
    heroUrl: heroMidia?.url || pousada?.og_image_url || null,
    heroAlt: heroMidia?.alt || null,
    wa: pousada?.whatsapp?.replace(/\D/g, "") || "",
    banners: banners.map(lerBanner),
    itens: agruparItens(itensBlocos),
    pacotes: pacotesTopo as any,
  };

  const todos = blocos as (Bloco & { ativo?: boolean })[];
  const comLinha = new Set(todos.map((b) => b.tipo));
  const ativos = todos.filter((b) => b.ativo !== false);

  // O banco ja foi sincronizado (tem linha para toda secao do padrao)?
  //  - SIM: a ordem do admin manda, inclusive para secoes extras.
  //  - NAO: usa a ordem do padrao e encaixa o que o banco tem, senao os
  //    blocos antigos ("sobre", "galeria"...) apareceriam antes do topo.
  const sincronizado = PADRAO.every((t) => comLinha.has(t));

  let usar: Bloco[];
  if (sincronizado) {
    usar = ativos;
  } else {
    const porTipo = new Map(ativos.map((b) => [b.tipo, b as Bloco]));
    const doPadrao: Bloco[] = PADRAO.map(
      (tipo) => porTipo.get(tipo) ?? { id: `padrao-${tipo}`, tipo, titulo: null, subtitulo: null, imagem_url: null }
    ).filter((b) => b.id.startsWith("padrao-") || porTipo.has(b.tipo));
    const extras = ativos.filter((b) => !PADRAO.includes(b.tipo as any));
    usar = [...doPadrao, ...extras];
  }

  return (
    <div>
      {usar.map((b) => <RenderBloco key={b.id} bloco={b} dados={dados} />)}
    </div>
  );
}
