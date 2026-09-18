import Link from "next/link";
import type { Metadata } from "next";
import { AVALIACOES } from "@/lib/conteudo-pousada";

export const metadata: Metadata = {
  title: "Avaliações — Pousada Marimar, Ilha do Mel",
  description: "Notas reais da Pousada Marimar no Google, Booking, Expedia, KAYAK e TripAdvisor, com data de consulta.",
};

export default function AvaliacoesPage() {
  const totalAvaliacoes = AVALIACOES.plataformas.reduce((s, p) => s + p.total, 0);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
      <span className="text-marca font-medium text-sm">Reputação</span>
      <h1 className="font-titulo text-3xl lg:text-4xl font-bold text-gray-900 mt-2 mb-3">Avaliações</h1>
      <p className="text-lg text-gray-600 leading-relaxed mb-2 max-w-2xl">
        Mais de {totalAvaliacoes.toLocaleString("pt-BR")} avaliações em cinco plataformas.
      </p>
      <p className="text-xs text-gray-400 mb-10">
        Números consultados em {AVALIACOES.consultadoEm} e sujeitos a alteração. Cada nota pertence à plataforma indicada.
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-12">
        {AVALIACOES.plataformas.map((a) => {
          const conteudo = (
            <>
              <p className="text-3xl font-bold text-marca">{a.nota.toString().replace(".", ",")}</p>
              <p className="text-xs text-gray-400 mb-2">de {a.escala}</p>
              <p className="text-sm font-medium text-gray-800">{a.nome}</p>
              <p className="text-xs text-gray-400">{a.total} avaliações</p>
            </>
          );
          return a.url ? (
            <a key={a.nome} href={a.url} target="_blank" rel="noopener noreferrer"
              className="bg-white rounded-marca p-5 border border-gray-100 shadow-marca text-center hover:shadow-marca-forte transition-marca">
              {conteudo}
            </a>
          ) : (
            <div key={a.nome} className="bg-white rounded-marca p-5 border border-gray-100 shadow-marca text-center">{conteudo}</div>
          );
        })}
      </div>

      <h2 className="font-titulo text-2xl font-bold text-gray-900 mb-2">Nota por critério</h2>
      <p className="text-sm text-gray-500 mb-6">Detalhamento do Booking, incluindo os pontos em que temos o que melhorar.</p>
      <div className="bg-white rounded-marca p-6 border border-gray-100 shadow-marca mb-12 space-y-3">
        {AVALIACOES.detalheBooking.map((d) => (
          <div key={d.criterio} className="flex items-center gap-3">
            <span className="text-sm text-gray-600 w-32 shrink-0">{d.criterio}</span>
            <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${d.nota >= 8 ? "bg-marca" : d.nota >= 7 ? "bg-acento" : "bg-gray-400"}`} style={{ width: `${d.nota * 10}%` }} />
            </div>
            <span className="text-sm font-semibold text-gray-700 w-9 text-right">{d.nota.toString().replace(".", ",")}</span>
          </div>
        ))}
      </div>

      <h2 className="font-titulo text-2xl font-bold text-gray-900 mb-4">O que mais elogiam</h2>
      <div className="flex flex-wrap gap-2.5 mb-12">
        {AVALIACOES.pontosFortes.map((p) => (
          <span key={p} className="text-sm bg-marca-sutil text-marca-ativa px-4 py-2 rounded-full">{p}</span>
        ))}
      </div>

      {AVALIACOES.depoimentos.length === 0 ? (
        <div className="bg-fundo-suave rounded-marca p-6">
          <p className="text-sm text-gray-600 leading-relaxed">
            Preferimos mostrar as notas agregadas das plataformas a publicar depoimentos sem identificar a origem.
            Para ler comentários de hóspedes, abra qualquer uma das plataformas acima.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-5">
          {AVALIACOES.depoimentos.map((d, i) => (
            <blockquote key={i} className="bg-white rounded-marca p-6 border border-gray-100 shadow-marca">
              <p className="text-sm text-gray-600 leading-relaxed italic">"{d.texto}"</p>
              <footer className="mt-4 pt-3 border-t border-gray-100 text-xs">
                <span className="font-semibold text-gray-800">{d.autor}</span>
                <span className="text-gray-400"> · via {d.plataforma}</span>
              </footer>
            </blockquote>
          ))}
        </div>
      )}

      <div className="text-center mt-12">
        <Link href="/reservar" className="inline-block bg-marca hover:bg-marca-hover text-marca-texto px-6 py-3 rounded-marca font-semibold transition-marca">
          Consultar disponibilidade
        </Link>
      </div>
    </div>
  );
}
