import Link from "next/link";
import type { Metadata } from "next";
import {
  ATRACOES, AVISO_DISTANCIAS, CUIDADOS_AMBIENTAIS, SOBRE_A_ILHA,
  TRAVESSIA, ATUALIZADO_EM,
} from "@/lib/conteudo-pousada";
import { brl } from "@/lib/format";

export const metadata: Metadata = {
  title: "Ilha do Mel e Encantadas — guia da Pousada Marimar",
  description: "Gruta das Encantadas, praias, trilhas, Farol das Conchas e Fortaleza. Como circular na ilha e o que respeitar.",
};

export default function IlhaDoMelPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
      <span className="text-marca font-medium text-sm">Guia</span>
      <h1 className="font-titulo text-3xl lg:text-4xl font-bold text-gray-900 mt-2 mb-4">Ilha do Mel e Encantadas</h1>
      <p className="text-lg text-gray-600 leading-relaxed mb-10 max-w-2xl">{SOBRE_A_ILHA.acesso}</p>

      {/* ─── ATRAÇÕES ─── */}
      <h2 id="atracoes" className="font-titulo text-2xl font-bold text-gray-900 mb-2">O que ver</h2>
      <p className="text-xs text-gray-400 mb-6">{AVISO_DISTANCIAS}</p>

      <div className="space-y-5 mb-12">
        {ATRACOES.map((a) => (
          <article key={a.slug} id={a.slug} className="bg-white rounded-marca p-6 border border-gray-100 shadow-marca scroll-mt-24">
            <div className="flex items-start justify-between gap-4 mb-2 flex-wrap">
              <h3 className="font-titulo text-lg font-bold text-gray-900">{a.nome}</h3>
              {a.distanciaTexto && (
                <span className="text-xs bg-marca-sutil text-marca-ativa px-3 py-1 rounded-full whitespace-nowrap">
                  {a.distanciaTexto}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">{a.texto}</p>
          </article>
        ))}
      </div>

      {/* ─── TRAVESSIA ─── */}
      <h2 id="travessia" className="font-titulo text-2xl font-bold text-gray-900 mb-2">Travessia e transporte</h2>
      <p className="text-sm text-gray-500 mb-5">
        Operada pela {TRAVESSIA.operadora}. O trecho Pontal do Sul–Encantadas leva {TRAVESSIA.duracao}.
      </p>

      <div className="bg-fundo-suave rounded-marca p-6 mb-4">
        <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
          <h3 className="font-semibold text-gray-900 text-sm">Valores</h3>
          <span className="text-xs text-gray-400">consultado em {ATUALIZADO_EM}</span>
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-gray-700 mb-3">
          <span>Ida <strong>{brl(TRAVESSIA.precos.ida)}</strong></span>
          <span>Volta <strong>{brl(TRAVESSIA.precos.volta)}</strong></span>
          <span>Ida e volta <strong>{brl(TRAVESSIA.precos.idaEVolta)}</strong></span>
        </div>
        <p className="text-sm text-gray-600 mb-3">🧒 {TRAVESSIA.precos.gratuidade} não pagam.</p>
        <p className="text-xs text-gray-500">Valores e horários mudam sem aviso — confirme antes de viajar.</p>
        <a href={TRAVESSIA.site} target="_blank" rel="noopener noreferrer"
          className="inline-block mt-3 text-sm text-marca font-medium hover:text-marca-hover transition-marca">
          Site oficial da {TRAVESSIA.operadora} →
        </a>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-marca p-5 mb-12">
        <p className="text-sm text-amber-900 leading-relaxed">
          <strong>⚠️ Destino certo.</strong> {TRAVESSIA.avisoDestino}
        </p>
      </div>

      {/* ─── CUIDADOS ─── */}
      <h2 className="font-titulo text-2xl font-bold text-gray-900 mb-5">Cuidados na ilha</h2>
      <div className="bg-white rounded-marca p-6 border border-gray-100 shadow-marca mb-10">
        <ul className="space-y-3">
          {CUIDADOS_AMBIENTAIS.map((c) => (
            <li key={c} className="text-sm text-gray-600 flex gap-2.5 leading-relaxed">
              <span className="text-marca shrink-0">🌿</span> {c}
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-marca-sutil border border-marca-borda rounded-marca p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <p className="text-sm text-gray-700">Planejando a viagem? Veja o passo a passo completo de chegada.</p>
        <Link href="/como-chegar" className="bg-marca hover:bg-marca-hover text-white px-5 py-2.5 rounded-marca text-sm font-semibold transition-marca whitespace-nowrap shrink-0">
          Como chegar
        </Link>
      </div>
    </div>
  );
}
