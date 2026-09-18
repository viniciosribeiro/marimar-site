import type { Metadata } from "next";
import { EVENTOS, CONTATO, COMPLEXO } from "@/lib/conteudo-pousada";

export const metadata: Metadata = {
  title: "Eventos e Casamentos — Pousada Marimar, Ilha do Mel",
  description: "Casamentos, festas e confraternizações em Encantadas, usando o jardim, o restaurante pé na areia e a proximidade do mar.",
};

export default function EventosPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
      <span className="text-marca font-medium text-sm">Celebrações</span>
      <h1 className="font-titulo text-3xl lg:text-4xl font-bold text-gray-900 mt-2 mb-4">Eventos e casamentos</h1>
      <p className="text-lg text-gray-600 leading-relaxed mb-10 max-w-2xl">
        Celebrar em Encantadas é reunir as pessoas em um lugar onde não passa carro, o mar está na porta
        e ninguém tem pressa de ir embora.
      </p>

      <div className="grid sm:grid-cols-2 gap-6 mb-10">
        <div className="bg-white rounded-marca p-6 border border-gray-100 shadow-marca">
          <h2 className="font-titulo text-lg font-bold text-gray-900 mb-3">O que realizamos</h2>
          <ul className="space-y-2">
            {EVENTOS.tipos.map((t) => (
              <li key={t} className="text-sm text-gray-600 flex items-center gap-2">
                <span className="text-marca">•</span> {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-white rounded-marca p-6 border border-gray-100 shadow-marca">
          <h2 className="font-titulo text-lg font-bold text-gray-900 mb-3">Espaços</h2>
          <ul className="space-y-2">
            {EVENTOS.espacos.map((e) => (
              <li key={e} className="text-sm text-gray-600 flex items-center gap-2">
                <span className="text-marca">•</span> {e}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="bg-marca-sutil border border-marca-borda rounded-marca p-6 mb-8">
        <p className="text-sm text-gray-700 leading-relaxed">{COMPLEXO.fraseLonga}</p>
      </div>

      <div className="bg-fundo-suave rounded-marca p-7 text-center">
        <h2 className="font-titulo text-xl font-bold text-gray-900 mb-2">Vamos montar o seu</h2>
        <p className="text-sm text-gray-600 leading-relaxed mb-5 max-w-lg mx-auto">{EVENTOS.avisoPendente}</p>
        <a href={`https://wa.me/${CONTATO.whatsappDigitos}?text=${encodeURIComponent("Olá! Gostaria de informações sobre eventos na Pousada Marimar.")}`}
          target="_blank" rel="noopener noreferrer"
          className="inline-block bg-marca hover:bg-marca-hover text-marca-texto px-6 py-3 rounded-marca font-semibold transition-marca">
          💬 Falar sobre meu evento
        </a>
      </div>
    </div>
  );
}
