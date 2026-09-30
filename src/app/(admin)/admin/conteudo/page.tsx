import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { CrudForm } from "@/components/admin/CrudForm";
import { comSql } from "@/lib/db-conexao";
import { lerConteudo } from "@/lib/conteudo-editavel";
import { salvarChegar, salvarIlha, salvarEventos } from "./actions";

export const dynamic = "force-dynamic";

const reais = (n: number) => n.toFixed(2).replace(".", ",");

/**
 * Textos da ilha e da chegada.
 *
 * Viviam dentro do código: para corrigir o preço do barco era preciso um
 * programador. São também as respostas da Marina para "como chego?", "o que
 * tem na ilha?" e "fazem casamento?" — o que é salvo aqui vale nos dois.
 */
export default async function ConteudoPage() {
  const s = await auth();
  if (!s?.user) redirect("/admin/login");
  const c = await comSql(lerConteudo);
  const t = c.TRAVESSIA;

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8 mx-auto w-full max-w-5xl space-y-10">
      <header>
        <h1 className="font-titulo text-2xl sm:text-[1.75rem] font-bold tracking-tight text-tinta">Textos da ilha e chegada</h1>
        <p className="text-sm text-tinta-suave mt-1 max-w-2xl">
          O que aparece em Como chegar, Ilha do Mel e Eventos — e o que a Marina responde sobre
          esses assuntos. Campo em branco mantém o texto atual.
        </p>
      </header>

      <section>
        <h2 className="text-lg font-semibold text-tinta">Travessia e chegada</h2>
        <p className="text-xs text-tinta-suave mt-1 mb-3">
          Preços consultados em <strong>{t.precos.consultadoEm}</strong>. Ao mudar um preço, a data
          é atualizada sozinha — a Marina sempre diz ao hóspede de quando é o valor.
        </p>
        <CrudForm
          action={salvarChegar}
          submitLabel="Salvar chegada"
          fields={[
            { name: "operadora", label: "Operadora do barco", defaultValue: t.operadora },
            { name: "site", label: "Site oficial da operadora", defaultValue: t.site },
            { name: "duracao", label: "Duração da travessia", defaultValue: t.duracao },
            { name: "ida", label: "Ida (R$)", defaultValue: reais(t.precos.ida) },
            { name: "volta", label: "Volta (R$)", defaultValue: reais(t.precos.volta) },
            { name: "idaEVolta", label: "Ida e volta (R$)", defaultValue: reais(t.precos.idaEVolta) },
            { name: "gratuidade", label: "Gratuidade", defaultValue: t.precos.gratuidade },
            { name: "avisoDestino", label: "Aviso sobre o destino", type: "textarea", rows: 2, defaultValue: t.avisoDestino },
            { name: "estacionamento", label: "Estacionamento", type: "textarea", rows: 2, defaultValue: t.estacionamento },
            ...c.CHEGADA_ETAPAS.slice(0, 3).flatMap((e, i) => [
              { name: `etapa${i + 1}_titulo`, label: `Etapa ${i + 1} — título`, defaultValue: e.titulo, className: "sm:col-span-2 lg:basis-full" },
              { name: `etapa${i + 1}_texto`, label: `Etapa ${i + 1} — texto`, type: "textarea", rows: 3, defaultValue: e.texto },
            ]),
          ]}
        />
      </section>

      <section>
        <h2 className="text-lg font-semibold text-tinta mb-3">A ilha</h2>
        <CrudForm
          action={salvarIlha}
          submitLabel="Salvar ilha"
          fields={[
            { name: "acesso", label: "Como funciona o acesso", type: "textarea", rows: 3, defaultValue: c.SOBRE_A_ILHA.acesso },
            { name: "bagagem", label: "Bagagem", type: "textarea", rows: 2, defaultValue: c.SOBRE_A_ILHA.bagagem },
            { name: "cuidados", label: "Cuidados ambientais", type: "textarea", rows: 5, ajuda: "Um cuidado por linha.", defaultValue: c.CUIDADOS_AMBIENTAIS.join("\n") },
            { name: "avisoDistancias", label: "Aviso sobre distâncias", type: "textarea", rows: 2, defaultValue: c.AVISO_DISTANCIAS },
          ]}
        />
        <p className="text-xs text-tinta-suave/80 mt-2">
          As atrações (Gruta, Farol, Fortaleza…) ficam em{" "}
          <Link href="/admin/atracoes" className="underline">Atrações da ilha</Link>.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-tinta mb-3">Eventos</h2>
        <CrudForm
          action={salvarEventos}
          submitLabel="Salvar eventos"
          fields={[
            { name: "tipos", label: "Tipos de evento", type: "textarea", rows: 4, ajuda: "Um por linha.", defaultValue: c.EVENTOS.tipos.join("\n") },
            { name: "espacos", label: "Espaços", type: "textarea", rows: 3, ajuda: "Um por linha.", defaultValue: c.EVENTOS.espacos.join("\n") },
            { name: "capacidade", label: "Capacidade", defaultValue: c.EVENTOS.capacidade ?? "", ajuda: "Em branco, a Marina diz que é sob consulta e não informa número." },
            { name: "avisoPendente", label: "Aviso", type: "textarea", rows: 2, defaultValue: c.EVENTOS.avisoPendente },
          ]}
        />
      </section>
    </div>
  );
}
