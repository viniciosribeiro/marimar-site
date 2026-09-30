import { categoriaValida } from "@/lib/marina-base";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { comSql } from "@/lib/db-conexao";
import {
  lerConfig, lerTreinamento, lerLeituras, situacaoItem, CONFIG_PADRAO, CATEGORIAS,
  type ItemTreino, type Leitura,
} from "@/lib/marina";
import { medirCobertura, type Cobertura } from "@/lib/agent-mapa";
import { gatewayConfigurado } from "@/lib/chat";
import { lerRegras, lerAdicionais } from "@/lib/regras-hospedagem";
import { Pagina, Cabecalho, Aviso } from "@/components/admin/ui";
import { lerRoteiros } from "@/lib/roteiros";
import { lerAprendizado } from "@/lib/aprendizado";
import { lerConfigEscalonamento } from "@/lib/escalonamento";
import { blobConfigurado } from "@/lib/blob";
import { nomeSecao } from "@/lib/fotos";
import { PainelMarina } from "./PainelMarina";
import type { DadosMarina, DocumentoPainel, Conversa, Lacuna, EntradaHistorico, Saude, MidiaEscolha } from "./tipos";

export const dynamic = "force-dynamic";

const diasDesde = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

/**
 * Marina — o módulo de treinamento.
 *
 * Tudo é lido aqui, no servidor, numa conexão só; a tela (PainelMarina) só
 * desenha e chama ações. Cada consulta tem o seu `try`: antes da migration
 * 0016 as tabelas novas não existem, e a tela precisa abrir dizendo "rode a
 * migration" em vez de cair.
 */
export default async function MarinaPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string; categoria?: string; novo?: string }>;
}) {
  const s = await auth();
  if (!s?.user) redirect("/admin/login");
  const sp = await searchParams;

  const faltaMigration: string[] = [];

  const dados = await comSql(async (sql) => {
    let config = { ...CONFIG_PADRAO, voz_id: process.env.ELEVENLABS_VOICE_ID ?? null };
    try { config = await lerConfig(sql); } catch { /* padrão */ }

    const itens: ItemTreino[] = await lerTreinamento(sql);
    try { await sql`SELECT variacoes FROM marina_conhecimento LIMIT 1`; }
    catch { faltaMigration.push("0016"); }

    const leituras: Record<string, Leitura> = await lerLeituras(sql);

    let documentos: DocumentoPainel[] = [];
    try {
      documentos = (await sql<DocumentoPainel[]>`
        SELECT id, nome, assunto, tipo, url, bytes, trecho, caracteres, status, erro, ativo,
               categoria, criado_em, processado_em, tentativas
        FROM marina_documentos ORDER BY criado_em DESC`).map((d) => ({
        ...d,
        criado_em: new Date(d.criado_em).toISOString(),
        processado_em: d.processado_em ? new Date(d.processado_em).toISOString() : null,
      }));
    } catch {
      try {
        documentos = (await sql<DocumentoPainel[]>`
          SELECT id, nome, assunto, tipo, url, bytes, trecho, caracteres, status, erro, ativo, criado_em
          FROM marina_documentos ORDER BY criado_em DESC`).map((d) => ({
          ...d, categoria: "geral", processado_em: null, tentativas: 1,
          criado_em: new Date(d.criado_em).toISOString(),
        }));
      } catch { /* antes da 0012 */ }
    }

    /* As últimas 30 conversas do site, numa consulta só (uma por sessão
       seria a lentidão que aparece quando o chat ganhar movimento). */
    let conversas: Conversa[] = [];
    try {
      const linhas = await sql<{
        id: string; sessao: string; papel: string; conteudo: string; marcada: boolean;
        correcao: string | null; sem_resposta: boolean | null; criado_em: Date;
      }[]>`
        SELECT id, sessao, papel, conteudo, marcada, correcao,
               COALESCE(sem_resposta, false) AS sem_resposta, criado_em
        FROM chat_mensagens
        WHERE sessao IN (
          SELECT sessao FROM chat_mensagens GROUP BY sessao ORDER BY MAX(criado_em) DESC LIMIT 30
        )
        ORDER BY criado_em ASC`.catch(() => sql<{
          id: string; sessao: string; papel: string; conteudo: string; marcada: boolean;
          correcao: string | null; sem_resposta: boolean | null; criado_em: Date;
        }[]>`
        SELECT id, sessao, papel, conteudo, marcada, correcao, false AS sem_resposta, criado_em
        FROM chat_mensagens
        WHERE sessao IN (
          SELECT sessao FROM chat_mensagens GROUP BY sessao ORDER BY MAX(criado_em) DESC LIMIT 30
        )
        ORDER BY criado_em ASC`);
      const mapa = new Map<string, Conversa>();
      for (const l of linhas) {
        const c = mapa.get(l.sessao) ?? { sessao: l.sessao, inicio: l.criado_em.toISOString(), fim: "", trocas: [] };
        c.fim = l.criado_em.toISOString();
        c.trocas.push({
          id: l.id, papel: l.papel, conteudo: l.conteudo, marcada: l.marcada,
          correcao: l.correcao, sem_resposta: !!l.sem_resposta, quando: l.criado_em.toISOString(),
        });
        mapa.set(l.sessao, c);
      }
      conversas = [...mapa.values()].sort((a, b) => b.fim.localeCompare(a.fim));
    } catch { /* antes da 0008 */ }

    let lacunas: Lacuna[] = [];
    try {
      lacunas = (await sql<Lacuna[]>`
        SELECT id, pergunta, resposta, canal, status, criado_em FROM marina_lacunas
        WHERE status = 'aberta' ORDER BY criado_em DESC LIMIT 100`).map((l) => ({
        ...l, criado_em: new Date(l.criado_em).toISOString(),
      }));
    } catch { /* antes da 0016 */ }

    let historico: EntradaHistorico[] = [];
    try {
      historico = (await sql<EntradaHistorico[]>`
        SELECT id, conhecimento_id, acao, antes, depois, autor, criado_em
        FROM marina_historico ORDER BY criado_em DESC LIMIT 300`).map((h) => ({
        ...h, criado_em: new Date(h.criado_em).toISOString(),
      }));
    } catch { /* antes da 0016 */ }

    let cobertura: Cobertura[] = [];
    try { cobertura = await medirCobertura(sql); } catch { /* banco fora do ar */ }

    const regras = await lerRegras(sql);
    const adicionais = await lerAdicionais(sql, false);

    /* Roteiros de orientação e as mídias que podem entrar numa etapa. */
    const roteiros = await lerRoteiros(sql);
    let midiasEscolha: MidiaEscolha[] = [];
    try {
      midiasEscolha = (await sql<{ id: string; tipo: string; titulo: string | null; alt: string; url: string; thumb_url: string | null;
        duracao_seg: number | null; secao: string; quarto: string | null }[]>`
        SELECT m.id, m.tipo, m.titulo, m.alt, m.url, m.thumb_url, m.duracao_seg, m.secao, q.nome AS quarto
        FROM midias m LEFT JOIN quartos q ON q.id = m.quarto_id
        ORDER BY m.criado_em DESC LIMIT 400`).map((m) => ({
        id: m.id, tipo: m.tipo === "video" ? "video" : "foto", titulo: m.titulo, alt: m.alt,
        capa: m.tipo === "video" ? m.thumb_url : m.url,
        duracao_seg: m.duracao_seg === null ? null : Number(m.duracao_seg), secao: m.secao,
        album: m.quarto ? `Suíte ${m.quarto}` : m.secao === "orientacao" ? "Orientação" : nomeSecao(m.secao),
      }));
    } catch { /* antes da 0018 */ }

    const aprendizado = await lerAprendizado(sql);
    const aprendizadoModo = (await lerConfigEscalonamento(sql)).aprendizado_modo;
    const idsConflito = [...new Set(aprendizado.map((a) => a.conflito_id).filter((x): x is string => !!x))];
    const conflitos: Record<string, string> = {};
    if (idsConflito.length) {
      for (const c of await sql<{ id: string; titulo: string }[]>`SELECT id, titulo FROM marina_conhecimento WHERE id IN ${sql(idsConflito)}`) conflitos[c.id] = c.titulo;
    }

    return { config, itens, leituras, documentos, conversas, lacunas, historico, cobertura, regras, adicionais, roteiros, midiasEscolha, aprendizado, aprendizadoModo, conflitos };
  }).catch(() => null);

  if (!dados) {
    return (
      <Pagina>
        <Cabecalho sobre="Atendimento" titulo="Marina" />
        <Aviso tom="erro" titulo="Não consegui abrir o banco de dados agora.">
          Recarregue a página em alguns segundos. Se continuar, veja Sistema → Diagnóstico.
        </Aviso>
      </Pagina>
    );
  }

  const vivos = dados.itens.filter((i) => !i.excluido_em);
  const ativos = vivos.filter((i) => i.ativo);
  const situacoes = vivos.map((i) => situacaoItem(i, dados.leituras).id);
  const zap = dados.leituras.whatsapp?.lido_em ?? null;
  const diasSemZap = zap ? diasDesde(zap) : null;

  const saude: Saude = {
    ativos: ativos.length,
    desligados: vivos.length - ativos.length,
    lixeira: dados.itens.length - vivos.length,
    aguardando: situacoes.filter((x) => x === "aguardando").length,
    revisar: situacoes.filter((x) => x === "falhou").length,
    verificados: ativos.filter((i) => i.verificacao === "ok").length,
    nuncaTestados: ativos.filter((i) => !i.verificacao && (i.tipo === "fato" || i.tipo === "pergunta")).length,
    lacunas: dados.lacunas.length,
    docsFalhos: dados.documentos.filter((d) => d.status === "falhou").length,
    categoriasVazias: CATEGORIAS.filter((c) => c.id !== "geral" && !ativos.some((i) => i.categoria === c.id)).map((c) => c.rotulo),
    diasSemWhatsapp: diasSemZap,
    tamanhoTreino: dados.leituras.site?.caracteres ?? dados.leituras.teste?.caracteres ?? 0,
    semTom: !dados.config.tom?.trim(),
    semEscalonamento: !dados.config.escalonamento?.trim() && !ativos.some((i) => i.tipo === "escalar"),
    gateway: gatewayConfigurado(),
    vozApi: Boolean(process.env.ELEVENLABS_API_KEY),
  };

  const props: DadosMarina = { ...dados, saude, blobOk: blobConfigurado() };

  return (
    <Pagina larga>
      <Cabecalho
        sobre="Atendimento"
        titulo="Marina"
        descricao="Tudo o que você ensina aqui vale nos dois canais: no chat do site na hora, e no WhatsApp a partir da próxima conversa."
      />
      {faltaMigration.length > 0 && (
        <Aviso tom="aviso" className="mb-6" titulo="O banco ainda não tem as tabelas novas do treinamento.">
          Rode <code className="font-mono">npm run db:migrate</code> e recarregue. Até lá, o que já foi ensinado
          continua valendo, mas categorias, histórico e testes não são guardados.
        </Aviso>
      )}
      <PainelMarina dados={props} abaInicial={sp.aba ?? "visao"}
        categoriaInicial={sp.categoria ? categoriaValida(sp.categoria) : undefined} novoInicial={sp.novo === "1"} />
    </Pagina>
  );
}
