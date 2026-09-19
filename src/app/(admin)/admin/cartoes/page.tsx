import postgres from "postgres";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { blobConfigurado } from "@/lib/blob";
import { PainelCartoes, type Cartao, type Secao } from "./PainelCartoes";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cartões das seções — Marimar Admin" };

/**
 * Só os blocos que DESENHAM cartões aparecem aqui.
 *
 * Oferecer "Avaliações" ou "Mapa" nesta tela seria prometer uma edição que
 * o site ignora — pior do que não oferecer.
 */
const BLOCOS_COM_CARTOES: Record<string, { nome: string; formato: string }> = {
  complexo: {
    nome: "Um complexo, duas partes",
    formato: "Cartões grandes com foto, ícone e link. Dois é o esperado; o terceiro em diante entra numa grade abaixo.",
  },
  diferenciais: {
    nome: "O que está incluso na estadia",
    formato: "Cartões pequenos com ícone, título e texto. A grade é de quatro colunas.",
  },
};

export default async function CartoesPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  const sessao = await auth();
  if (!sessao?.user) redirect("/admin/login");

  const { ok, erro } = await searchParams;

  let secoes: Secao[] = [];
  let cartoes: Cartao[] = [];
  let falha: string | null = null;

  try {
    const sql = postgres(process.env.DATABASE_URL!, { max: 1, connect_timeout: 5, prepare: false });
    const blocos = await sql<{ id: string; tipo: string }[]>`
      SELECT id, tipo FROM blocos_home ORDER BY ordem, criado_em`;
    secoes = blocos
      .filter((b) => BLOCOS_COM_CARTOES[b.tipo])
      .map((b) => ({ id: b.id, tipo: b.tipo, ...BLOCOS_COM_CARTOES[b.tipo] }));

    cartoes = (await sql`
      SELECT * FROM blocos_itens ORDER BY ordem, criado_em
    `) as unknown as Cartao[];
    await sql.end();
  } catch (e) {
    falha = (e as Error).message;
    console.error("[admin/cartoes] indisponivel:", falha);
  }

  return (
    <div className="p-5 sm:p-8 max-w-5xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Cartões das seções</h1>
        <p className="text-sm text-gray-500 mt-1 leading-relaxed">
          Os blocos de cartões da página inicial. Sem nenhum cartão cadastrado,
          a seção continua mostrando o conteúdo padrão do site.
        </p>
      </header>

      {ok && <Aviso tom="ok">{ok}</Aviso>}
      {erro && <Aviso tom="erro">{erro}</Aviso>}
      {falha && (
        <Aviso tom="erro">
          Banco indisponível: {falha}
          {falha.includes("blocos_itens") && " — falta rodar a migration 0007."}
        </Aviso>
      )}

      {secoes.length === 0 && !falha ? (
        <p className="text-sm text-gray-500 border border-dashed border-gray-300 rounded-xl p-6">
          Nenhuma seção de cartões existe em <strong>Blocos da Home</strong>. Crie
          os blocos &quot;complexo&quot; ou &quot;diferenciais&quot; lá primeiro.
        </p>
      ) : (
        <PainelCartoes secoes={secoes} cartoes={cartoes} blobOk={blobConfigurado()} />
      )}
    </div>
  );
}

function Aviso({ tom, children }: { tom: "ok" | "erro"; children: React.ReactNode }) {
  return (
    <div className={`mb-5 px-4 py-3 rounded-lg text-sm border ${
      tom === "ok"
        ? "bg-emerald-50 border-emerald-200 text-emerald-800"
        : "bg-red-50 border-red-200 text-red-800"
    }`}>
      {children}
    </div>
  );
}
