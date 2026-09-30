import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { CrudForm } from "@/components/admin/CrudForm";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { comSql } from "@/lib/db-conexao";
import { lerConteudo, type Atracao } from "@/lib/conteudo-editavel";
import { salvarAtracao, excluirAtracao, moverAtracao } from "./actions";

export const dynamic = "force-dynamic";

/**
 * Atrações da ilha (Gruta, Farol, Fortaleza…).
 *
 * Viviam só em `conteudo-pousada.ts`. O que é salvo aqui aparece na página
 * Ilha do Mel, no bloco de localização da home e nas respostas da Marina
 * sobre "o que tem para ver". A ordem da lista é a ordem nos três lugares.
 */
export default async function AtracoesPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string; editar?: string; novo?: string }>;
}) {
  const s = await auth();
  if (!s?.user) redirect("/admin/login");
  const sp = await searchParams;
  const lista = (await comSql(lerConteudo)).ATRACOES;
  const editando = sp.editar ? lista.find((a) => a.slug === sp.editar) : undefined;
  const abrirForm = !!editando || !!sp.novo;

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8 mx-auto w-full max-w-5xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-titulo text-2xl sm:text-[1.75rem] font-bold tracking-tight text-tinta">Atrações da ilha</h1>
          <p className="text-sm text-tinta-suave mt-1 max-w-2xl">
            O que aparece em Ilha do Mel, no bloco de localização da home e o que a Marina responde
            quando perguntam o que tem para ver. As marcadas como destaque vão para a home.
          </p>
        </div>
        {!abrirForm && (
          <Link href="/admin/atracoes?novo=1"
            className="inline-flex items-center gap-2 text-white px-4 min-h-10 rounded-xl text-sm font-medium"
            style={{ backgroundColor: "var(--color-primary, #0D9488)" }}>
            + Nova atração
          </Link>
        )}
      </header>

      {abrirForm && (
        <section>
          <h2 className="text-lg font-semibold text-tinta mb-3">{editando ? `Editar: ${editando.nome}` : "Nova atração"}</h2>
          <CrudForm
            action={salvarAtracao}
            submitLabel={editando ? "Salvar atração" : "Criar atração"}
            fields={formulario(editando)}
          />
          <Link href="/admin/atracoes" className="inline-flex items-center mt-2 px-3 min-h-10 text-sm text-tinta-suave hover:underline">
            Cancelar e voltar
          </Link>
        </section>
      )}

      <ul className="space-y-3">
        {lista.length === 0 && (
          <li className="text-center text-tinta-suave/80 py-12 bg-white rounded-xl border border-linha/60">
            Nenhuma atração cadastrada. A página Ilha do Mel fica sem a seção &quot;O que ver&quot;.
          </li>
        )}
        {lista.map((a, i) => (
          <li key={a.slug} className="bg-white rounded-2xl border border-linha/80 shadow-sm p-4 flex flex-col sm:flex-row sm:items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-tinta">
                {a.nome}
                {a.destaque && <span className="ml-2 text-[11px] font-medium bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">destaque na home</span>}
              </p>
              <p className="text-sm text-tinta-suave mt-1">{a.resumo}</p>
              <p className="text-xs text-tinta-suave/80 mt-1">{a.distanciaTexto || "Sem distância informada"}</p>
            </div>
            <div className="flex flex-wrap items-center gap-1 shrink-0">
              <Mover slug={a.slug} direcao="subir" desativado={i === 0} />
              <Mover slug={a.slug} direcao="descer" desativado={i === lista.length - 1} />
              <Link href={`/admin/atracoes?editar=${encodeURIComponent(a.slug)}`}
                className="inline-flex items-center text-xs font-medium px-3.5 min-h-10 rounded-lg bg-areia/70 text-tinta hover:bg-areia">
                Editar
              </Link>
              <DeleteButton action={excluirAtracao} id={a.slug} />
            </div>
          </li>
        ))}
      </ul>
      <p className="text-xs text-tinta-suave/80">{lista.length} atrações</p>
    </div>
  );
}

function formulario(a?: Atracao) {
  return [
    ...(a ? [{ name: "slug", type: "hidden", defaultValue: a.slug }] : []),
    { name: "nome", label: "Nome", required: true, defaultValue: a?.nome ?? "" },
    { name: "distanciaTexto", label: "Distância", defaultValue: a?.distanciaTexto ?? "", ajuda: "Ex.: cerca de 600 m da pousada. Em branco, não mostra distância." },
    { name: "resumo", label: "Resumo", type: "textarea", rows: 2, required: true, defaultValue: a?.resumo ?? "", ajuda: "Uma frase. Aparece no cartão da home." },
    { name: "texto", label: "Texto completo", type: "textarea", rows: 4, required: true, defaultValue: a?.texto ?? "", ajuda: "Aparece na página Ilha do Mel e é o que a Marina conta ao hóspede." },
    { name: "destaque", label: "Destaque na home", type: "checkbox", defaultValue: a ? (a.destaque ? 1 : 0) : 1 },
  ];
}

function Mover({ slug, direcao, desativado }: { slug: string; direcao: "subir" | "descer"; desativado: boolean }) {
  if (desativado) return <span className="inline-flex items-center justify-center w-10 min-h-10 text-gray-200" aria-hidden>{direcao === "subir" ? "↑" : "↓"}</span>;
  return (
    <form action={moverAtracao}>
      <input type="hidden" name="id" value={slug} />
      <input type="hidden" name="direcao" value={direcao} />
      <SubmitButton className="inline-flex items-center justify-center min-w-10 px-2 min-h-10 rounded-lg text-tinta-suave hover:bg-areia/70">
        <span aria-label={direcao === "subir" ? "Subir" : "Descer"}>{direcao === "subir" ? "↑" : "↓"}</span>
      </SubmitButton>
    </form>
  );
}
