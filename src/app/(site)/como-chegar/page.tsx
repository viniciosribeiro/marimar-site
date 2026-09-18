import Link from "next/link";
import type { Metadata } from "next";
import {
  CHEGADA_ETAPAS, TRAVESSIA, ENDERECO, SOBRE_A_ILHA, COMPLEXO, ATUALIZADO_EM,
} from "@/lib/conteudo-pousada";
import { brl } from "@/lib/format";

export const metadata: Metadata = {
  title: "Como chegar na Pousada Marimar — Encantadas, Ilha do Mel",
  description: "Passo a passo: chegue a Pontal do Sul, embarque para Encantadas e caminhe até o Marimar Café Bistrô Bar. A pousada fica anexada aos fundos.",
};

export default function ComoChegarPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
      <span className="text-marca font-medium text-sm">Localização</span>
      <h1 className="font-titulo text-3xl lg:text-4xl font-bold text-gray-900 mt-2 mb-4">Como chegar</h1>
      <p className="text-lg text-gray-600 leading-relaxed mb-10 max-w-2xl">{SOBRE_A_ILHA.acesso}</p>

      {/* ─── 3 ETAPAS ─── */}
      <div className="space-y-4 mb-12">
        {CHEGADA_ETAPAS.map((e) => (
          <div key={e.n} className="flex gap-5 bg-white rounded-marca p-6 border border-gray-100 shadow-marca">
            <div className="shrink-0 w-10 h-10 rounded-full bg-marca text-marca-texto flex items-center justify-center font-bold">
              {e.n}
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 mb-1.5">{e.titulo}</h2>
              <p className="text-sm text-gray-600 leading-relaxed">{e.texto}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ─── AVISO DO DESTINO ─── */}
      <div className="bg-amber-50 border border-amber-200 rounded-marca p-5 mb-12">
        <p className="text-sm text-amber-900 leading-relaxed">
          <strong>⚠️ Atenção ao destino.</strong> {TRAVESSIA.avisoDestino}
        </p>
      </div>

      {/* ─── TRAVESSIA ─── */}
      <h2 id="travessia" className="font-titulo text-2xl font-bold text-gray-900 mb-2">A travessia</h2>
      <p className="text-sm text-gray-500 mb-6">
        Operada pela {TRAVESSIA.operadora}. Duração de {TRAVESSIA.duracao} no trecho Pontal do Sul–Encantadas.
      </p>

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        {TRAVESSIA.terminais.map((t) => (
          <div key={t.nome} className="bg-white rounded-marca p-5 border border-gray-100 shadow-marca">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold text-gray-900">{t.nome}</h3>
              {t.principal && <span className="text-[10px] bg-marca-sutil text-marca-ativa px-2 py-0.5 rounded-full font-medium">mais usado</span>}
            </div>
            <p className="text-sm text-gray-600">{t.endereco}</p>
          </div>
        ))}
      </div>

      <div className="bg-fundo-suave rounded-marca p-6 mb-6">
        <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
          <h3 className="font-semibold text-gray-900">Valores da travessia</h3>
          <span className="text-xs text-gray-400">consultado em {ATUALIZADO_EM}</span>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <Valor rotulo="Ida" valor={brl(TRAVESSIA.precos.ida)} />
          <Valor rotulo="Volta" valor={brl(TRAVESSIA.precos.volta)} />
          <Valor rotulo="Ida e volta" valor={brl(TRAVESSIA.precos.idaEVolta)} destaque />
        </div>
        <p className="text-sm text-gray-600 mb-3">🧒 {TRAVESSIA.precos.gratuidade} não pagam.</p>
        <p className="text-xs text-gray-500 leading-relaxed">
          Horários e preços são definidos pela operadora e mudam sem aviso. Confirme sempre no site oficial antes de viajar.
        </p>
        <a href={TRAVESSIA.site} target="_blank" rel="noopener noreferrer"
          className="inline-block mt-3 text-sm text-marca font-medium hover:text-marca-hover transition-marca">
          Consultar horários na {TRAVESSIA.operadora} →
        </a>
      </div>

      <div className="bg-white rounded-marca p-5 border border-gray-100 shadow-marca mb-12">
        <h3 className="font-semibold text-gray-900 mb-2 text-sm">🚗 E o carro?</h3>
        <p className="text-sm text-gray-600 leading-relaxed">{TRAVESSIA.estacionamento}</p>
      </div>

      {/* ─── CHEGANDO NA POUSADA ─── */}
      <h2 className="font-titulo text-2xl font-bold text-gray-900 mb-4">Chegando na pousada</h2>
      <div className="bg-marca-sutil border border-marca-borda rounded-marca p-6 mb-6">
        <p className="text-gray-700 leading-relaxed mb-4">{COMPLEXO.fraseLonga}</p>
        <p className="text-sm text-gray-600 leading-relaxed">{SOBRE_A_ILHA.bagagem}</p>
      </div>

      <div className="bg-white rounded-marca p-6 border border-gray-100 shadow-marca">
        <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Ponto de referência no mapa</p>
        <p className="font-medium text-gray-900 mb-1">{ENDERECO.rotuloMapa}</p>
        <p className="text-sm text-gray-600 mb-1">{ENDERECO.completo}</p>
        <p className="text-xs text-gray-400 mb-5">
          Plus Code {ENDERECO.plusCode} · {ENDERECO.lat}, {ENDERECO.lng}
        </p>
        <div className="flex flex-wrap gap-2">
          <a href={`https://www.google.com/maps/search/?api=1&query=${ENDERECO.lat},${ENDERECO.lng}`} target="_blank" rel="noopener noreferrer"
            className="bg-marca hover:bg-marca-hover text-marca-texto px-4 py-2.5 rounded-marca text-sm font-semibold transition-marca">
            Abrir no Google Maps
          </a>
          <a href={`https://www.openstreetmap.org/?mlat=${ENDERECO.lat}&mlon=${ENDERECO.lng}#map=17/${ENDERECO.lat}/${ENDERECO.lng}`} target="_blank" rel="noopener noreferrer"
            className="border border-gray-300 text-gray-700 px-4 py-2.5 rounded-marca text-sm font-medium hover:bg-fundo-suave transition-marca">
            Ver no OpenStreetMap
          </a>
          <Link href="/contato" className="border border-gray-300 text-gray-700 px-4 py-2.5 rounded-marca text-sm font-medium hover:bg-fundo-suave transition-marca">
            Falar com a pousada
          </Link>
        </div>
      </div>
    </div>
  );
}

function Valor({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className={`rounded-marca p-4 text-center ${destaque ? "bg-marca text-marca-texto" : "bg-white border border-gray-100"}`}>
      <p className={`text-xs mb-1 ${destaque ? "text-white/75" : "text-gray-400"}`}>{rotulo}</p>
      <p className={`font-bold ${destaque ? "text-white" : "text-gray-900"}`}>{valor}</p>
    </div>
  );
}
