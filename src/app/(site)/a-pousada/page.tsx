import postgres from "postgres";
import Link from "next/link";
import type { Metadata } from "next";
import {
  COMPLEXO, DIFERENCIAIS, COMODIDADES_CONFIRMADAS, NAO_DISPONIVEL,
  RESTAURANTE, ENDERECO, AVALIACOES,
} from "@/lib/conteudo-pousada";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "A Pousada — Pousada Marimar, Encantadas, Ilha do Mel",
  description: "Administração familiar em Encantadas, com restaurante pé na areia na frente e as acomodações anexadas aos fundos, a poucos passos do trapiche.",
};

export default async function APousadaPage() {
  let p: any = null;
  try {
    const sql = postgres(process.env.DATABASE_URL!, { max: 1, connect_timeout: 5, prepare: false });
    [p] = await sql`SELECT * FROM pousada LIMIT 1`;
    await sql.end();
  } catch (e) {
    console.error("[APousada] banco indisponivel:", (e as Error).message);
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
      <span className="text-marca font-medium text-sm">Quem somos</span>
      <h1 className="font-titulo text-3xl lg:text-4xl font-bold text-gray-900 mt-2 mb-4">A Pousada Marimar</h1>
      <p className="text-lg text-gray-600 leading-relaxed mb-10 max-w-2xl">{COMPLEXO.fraseLonga}</p>

      {/* ─── O COMPLEXO ─── */}
      <section className="mb-12">
        <h2 className="font-titulo text-2xl font-bold text-gray-900 mb-5">Como o complexo é organizado</h2>
        <div className="grid sm:grid-cols-[1fr_auto_1fr] gap-4 sm:gap-2 items-stretch">
          <div className="bg-marca-sutil border border-marca-borda rounded-marca p-6">
            <div className="text-3xl mb-3">🏖️</div>
            <h3 className="font-semibold text-gray-900 mb-1.5">{RESTAURANTE.nome}</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{RESTAURANTE.posicao}</p>
          </div>
          <div className="flex sm:flex-col items-center justify-center gap-2 py-2">
            <div className="h-px sm:h-full sm:w-px flex-1 bg-gray-200" />
            <span className="text-xs text-tinta-suave whitespace-nowrap px-2 shrink-0">anexada aos fundos</span>
            <div className="h-px sm:h-full sm:w-px flex-1 bg-gray-200" />
          </div>
          <div className="bg-white border border-gray-200 rounded-marca p-6 shadow-marca">
            <div className="text-3xl mb-3">🛏️</div>
            <h3 className="font-semibold text-gray-900 mb-1.5">Pousada Marimar</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              As acomodações ficam logo atrás do restaurante, a poucos passos do trapiche de Encantadas.
            </p>
          </div>
        </div>
      </section>

      {/* ─── HISTÓRIA ─── */}
      <section className="mb-12">
        <h2 className="font-titulo text-2xl font-bold text-gray-900 mb-4">Nossa história</h2>
        <div className="bg-white rounded-marca p-7 border border-gray-100 shadow-marca text-gray-600 leading-relaxed space-y-4 text-sm">
          {p?.descricao_longa ? (
            <p>{p.descricao_longa}</p>
          ) : (
            <>
              <p>
                A Marimar é um empreendimento de <strong>administração familiar</strong> em Encantadas, na Ilha do Mel.
                Ao longo dos anos o negócio apareceu sob nomes diferentes — Marimar Hostel, Marimar Hostel Internacional,
                Marimar Pousada, Marimar Bistrô — e hoje opera como <strong>Pousada Marimar</strong> e{" "}
                <strong>{RESTAURANTE.nome}</strong>.
              </p>
              <p>
                O que não mudou foi a posição: de frente para o mar, a poucos passos do trapiche por onde chega
                quem visita Encantadas, com o restaurante na frente e as acomodações logo atrás.
              </p>
              <p className="text-gray-400 text-xs">
                Este texto pode ser editado no painel administrativo, em Identidade Visual e dados da pousada.
              </p>
            </>
          )}
        </div>
      </section>

      {/* ─── DIFERENCIAIS ─── */}
      <section className="mb-12">
        <h2 className="font-titulo text-2xl font-bold text-gray-900 mb-5">O que oferecemos</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {DIFERENCIAIS.map((d) => (
            <div key={d.titulo} className="bg-white rounded-marca p-5 border border-gray-100 shadow-marca flex gap-4">
              <span className="text-2xl shrink-0">{d.icone}</span>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm mb-1">{d.titulo}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{d.texto}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── COMODIDADES ─── */}
      <section className="mb-12">
        <h2 className="font-titulo text-2xl font-bold text-gray-900 mb-5">Comodidades</h2>
        <div className="flex flex-wrap gap-2.5 mb-6">
          {COMODIDADES_CONFIRMADAS.map((c) => (
            <span key={c} className="text-sm bg-marca-sutil text-marca-ativa px-4 py-2 rounded-full">{c}</span>
          ))}
        </div>
        <div className="bg-fundo-suave rounded-marca p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Para você não se surpreender</p>
          <ul className="space-y-1.5">
            {NAO_DISPONIVEL.map((n) => (
              <li key={n.item} className="text-sm text-gray-600">
                <strong>{n.item}:</strong> {n.motivo}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ─── REPUTAÇÃO + LOCAL ─── */}
      <section className="grid sm:grid-cols-2 gap-5">
        <Link href="/avaliacoes" className="bg-white rounded-marca p-6 border border-gray-100 shadow-marca hover:shadow-marca-forte transition-marca">
          <h3 className="font-titulo font-bold text-gray-900 mb-2">Avaliações</h3>
          <p className="text-sm text-gray-600 leading-relaxed mb-3">
            {AVALIACOES.plataformas[0].nota.toString().replace(".", ",")}/5 no Google com{" "}
            {AVALIACOES.plataformas[0].total} avaliações, entre outras plataformas.
          </p>
          <span className="text-sm text-marca font-medium">Ver todas as notas →</span>
        </Link>
        <Link href="/como-chegar" className="bg-white rounded-marca p-6 border border-gray-100 shadow-marca hover:shadow-marca-forte transition-marca">
          <h3 className="font-titulo font-bold text-gray-900 mb-2">Onde estamos</h3>
          <p className="text-sm text-gray-600 leading-relaxed mb-3">{ENDERECO.completo}</p>
          <span className="text-sm text-marca font-medium">Como chegar →</span>
        </Link>
      </section>
    </div>
  );
}
