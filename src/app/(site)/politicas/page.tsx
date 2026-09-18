import Link from "next/link";
import type { Metadata } from "next";
import { POLITICAS, TRAVESSIA, NAO_DISPONIVEL } from "@/lib/conteudo-pousada";

export const metadata: Metadata = {
  title: "Políticas — Pousada Marimar, Ilha do Mel",
  description: "Check-in, check-out, café da manhã, cancelamento, pets, silêncio e demais regras da Pousada Marimar.",
};

export default function PoliticasPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
      <h1 className="font-titulo text-3xl lg:text-4xl font-bold text-gray-900 mb-3">Políticas</h1>
      <p className="text-gray-600 leading-relaxed mb-10">
        As regras abaixo são as oficiais da pousada. Quando houver divergência com o que aparece em
        sites de reserva de terceiros, vale o que está aqui e o que consta na sua tarifa.
      </p>

      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <Destaque titulo="Check-in" valor={`a partir das ${POLITICAS.checkIn}`} />
        <Destaque titulo="Check-out" valor={`até as ${POLITICAS.checkOut}`} />
        <Destaque titulo="Café da manhã" valor={POLITICAS.cafeDaManha} />
      </div>

      <div className="space-y-4">
        <Bloco titulo="Horário de chegada">
          <p>Check-in a partir das <strong>{POLITICAS.checkIn}</strong>.</p>
          <p>
            Normalmente aceitamos check-in até as <strong>{POLITICAS.checkInLimite}</strong>, porque a chegada
            depende da travessia da {TRAVESSIA.operadora}. {POLITICAS.chegadaTardia}
          </p>
        </Bloco>

        <Bloco titulo="Cancelamento">
          {POLITICAS.cancelamento.map((c, i) => <p key={i}>{c}</p>)}
        </Bloco>

        <Bloco titulo="Crianças e camas extras">
          <p>{POLITICAS.criancas}</p>
          <p className="text-gray-500">{POLITICAS.observacao}</p>
        </Bloco>

        <Bloco titulo="Regras da casa">
          <p>🐾 {POLITICAS.petsTexto}</p>
          <p>🚭 {POLITICAS.fumar}</p>
          <p>🔇 {POLITICAS.silencio}</p>
          <p>🍽 {POLITICAS.pacotes}</p>
        </Bloco>

        <Bloco titulo="O que não temos">
          {NAO_DISPONIVEL.map((n) => (
            <p key={n.item}><strong>{n.item}:</strong> {n.motivo}</p>
          ))}
        </Bloco>
      </div>

      <div className="mt-10 bg-fundo-suave rounded-marca p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <p className="text-sm text-gray-600">Dúvida sobre alguma regra antes de reservar?</p>
        <Link href="/contato" className="bg-marca hover:bg-marca-hover text-marca-texto px-5 py-2.5 rounded-marca text-sm font-semibold transition-marca whitespace-nowrap shrink-0">
          Falar com a pousada
        </Link>
      </div>
    </div>
  );
}

function Destaque({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="bg-marca-sutil border border-marca-borda rounded-marca p-4 text-center">
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{titulo}</p>
      <p className="font-semibold text-marca-ativa text-sm">{valor}</p>
    </div>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-marca p-6 border border-gray-100 shadow-marca">
      <h2 className="font-titulo font-bold text-gray-900 mb-3">{titulo}</h2>
      <div className="space-y-2 text-sm text-gray-600 leading-relaxed">{children}</div>
    </section>
  );
}
