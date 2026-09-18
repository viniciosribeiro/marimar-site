import postgres from "postgres";
import Link from "next/link";
import type { Metadata } from "next";
import { FAQ_CANONICO, COMPLEXO, CONTATO } from "@/lib/conteudo-pousada";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Perguntas Frequentes — Pousada Marimar, Ilha do Mel",
  description: "Travessia, chegada, check-in, café da manhã, pets, cancelamento e tudo que costumam perguntar antes de reservar.",
};

export default async function FaqPage() {
  let extras: any[] = [];
  try {
    const sql = postgres(process.env.DATABASE_URL!, { max: 1, connect_timeout: 5 });
    extras = await sql`SELECT * FROM faq WHERE ativo = true ORDER BY ordem`;
    await sql.end();
  } catch (e) {
    console.error("[FAQ] banco indisponivel:", (e as Error).message);
  }

  // Normaliza para nao repetir uma pergunta que ja existe no conjunto canonico
  const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
  const canonicas = new Set(FAQ_CANONICO.flatMap((g) => g.itens.map((i) => norm(i.p))));
  const extrasUnicas = extras.filter((f: any) => !canonicas.has(norm(f.pergunta)));

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
      <h1 className="font-titulo text-3xl lg:text-4xl font-bold text-gray-900 mb-3">Perguntas frequentes</h1>
      <p className="text-gray-600 leading-relaxed mb-8">
        A dúvida mais comum primeiro: <strong>{COMPLEXO.respostaFaq}</strong>
      </p>

      <div className="space-y-10">
        {FAQ_CANONICO.map((grupo) => (
          <section key={grupo.grupo}>
            <h2 className="font-titulo text-lg font-bold text-gray-900 mb-4">{grupo.grupo}</h2>
            <div className="space-y-2.5">
              {grupo.itens.map((i) => <Item key={i.p} pergunta={i.p} resposta={i.r} />)}
            </div>
          </section>
        ))}

        {extrasUnicas.length > 0 && (
          <section>
            <h2 className="font-titulo text-lg font-bold text-gray-900 mb-4">Outras dúvidas</h2>
            <div className="space-y-2.5">
              {extrasUnicas.map((f: any) => <Item key={f.id} pergunta={f.pergunta} resposta={f.resposta} />)}
            </div>
          </section>
        )}
      </div>

      <div className="mt-12 bg-fundo-suave rounded-marca p-6 text-center">
        <p className="text-sm text-gray-600 mb-4">Não achou o que precisava?</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a href={`https://wa.me/${CONTATO.whatsappDigitos}`} target="_blank" rel="noopener noreferrer"
            className="bg-marca hover:bg-marca-hover text-white px-5 py-2.5 rounded-marca text-sm font-semibold transition-marca">
            💬 Perguntar no WhatsApp
          </a>
          <Link href="/politicas" className="border border-gray-300 text-gray-700 px-5 py-2.5 rounded-marca text-sm font-medium hover:bg-white transition-marca">
            Ver as políticas
          </Link>
        </div>
      </div>
    </div>
  );
}

function Item({ pergunta, resposta }: { pergunta: string; resposta: string }) {
  return (
    <details className="group bg-white rounded-marca border border-gray-100 shadow-marca">
      <summary className="px-5 py-4 font-medium text-gray-800 cursor-pointer hover:text-marca transition-marca list-none flex items-center justify-between gap-4 text-sm">
        {pergunta}
        <span className="text-gray-300 group-open:rotate-180 transition-transform shrink-0">▾</span>
      </summary>
      <p className="px-5 pb-4 text-sm text-gray-600 leading-relaxed">{resposta}</p>
    </details>
  );
}
