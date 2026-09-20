import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import postgres from "postgres";
import { lerConfig, lerEnsinamentos, CONFIG_PADRAO } from "@/lib/marina";
import { medirCobertura, type Cobertura } from "@/lib/agent-mapa";
import { PainelMarina } from "./PainelMarina";

export const dynamic = "force-dynamic";

type Conversa = {
  sessao: string;
  quando: string;
  trocas: { id: string; papel: string; conteudo: string; marcada: boolean; correcao: string | null }[];
};

export default async function MarinaPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string; ok?: string; erro?: string }>;
}) {
  const s = await auth();
  if (!s?.user) redirect("/admin/login");
  const sp = await searchParams;

  const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });

  /* Cada consulta no seu próprio `try`: antes da migration 0011 as tabelas
     não existem, e uma tela de treinamento que cai em vez de dizer "rode a
     migration" é a pior hora possível para um erro de banco aparecer. */
  let pendente = false;

  let config = { ...CONFIG_PADRAO, voz_id: process.env.ELEVENLABS_VOICE_ID ?? null };
  let ensinamentos: Awaited<ReturnType<typeof lerEnsinamentos>> = { fatos: [], limites: [], documentos: [] };
  try {
    config = await lerConfig(sql);
    ensinamentos = await lerEnsinamentos(sql);
    await sql`SELECT 1 FROM marina_config LIMIT 1`;
  } catch {
    pendente = true;
  }

  /* As últimas conversas, agrupadas. Vem tudo numa consulta só e o
     agrupamento acontece aqui: uma consulta por sessão seria a coisa que
     volta como lentidão quando o chat começar a ter movimento. */
  let conversas: Conversa[] = [];
  try {
    const linhas = await sql<
      { id: string; sessao: string; papel: string; conteudo: string; marcada: boolean; correcao: string | null; criado_em: Date }[]
    >`
      SELECT id, sessao, papel, conteudo, marcada, correcao, criado_em
      FROM chat_mensagens
      WHERE sessao IN (
        SELECT sessao FROM chat_mensagens
        GROUP BY sessao ORDER BY MAX(criado_em) DESC LIMIT 20
      )
      ORDER BY criado_em ASC`;

    const mapa = new Map<string, Conversa>();
    for (const l of linhas) {
      const atual = mapa.get(l.sessao) ?? {
        sessao: l.sessao,
        quando: l.criado_em.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }),
        trocas: [],
      };
      atual.quando = l.criado_em.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
      atual.trocas.push({
        id: l.id, papel: l.papel, conteudo: l.conteudo,
        marcada: l.marcada, correcao: l.correcao,
      });
      mapa.set(l.sessao, atual);
    }
    conversas = [...mapa.values()].reverse();
  } catch {
    pendente = true;
  }

  /* A cobertura é medida ao vivo, não escrita à mão: uma lista estática de
     "o que ela sabe" mente no dia seguinte à primeira mudança. */
  let cobertura: Cobertura[] = [];
  try {
    cobertura = await medirCobertura(sql);
  } catch { /* banco fora do ar: a tela abre sem o diagnóstico */ }

  await sql.end();

  return (
    <div className="p-5 sm:p-8 max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-900">Treinar a Marina</h1>
      <p className="text-sm text-gray-500 mt-1 mb-6">
        Tudo que você ensinar aqui vale nos dois lugares: no chat do site e no WhatsApp.
      </p>

      {pendente && (
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          As tabelas de treinamento ainda não foram criadas no banco. Rode{" "}
          <code className="font-mono">npm run db:migrate</code> e recarregue esta página.
        </div>
      )}

      <PainelMarina
        aba={sp.aba ?? "cobertura"}
        cobertura={cobertura}
        ok={sp.ok}
        erro={sp.erro}
        config={config}
        fatos={ensinamentos.fatos}
        documentos={ensinamentos.documentos}
        limites={ensinamentos.limites}
        conversas={conversas}
      />
    </div>
  );
}
