import Link from "next/link";
import type { Metadata } from "next";
import { RESTAURANTE, CAFE_DA_MANHA, COMPLEXO, ENDERECO, CONTATO } from "@/lib/conteudo-pousada";

export const metadata: Metadata = {
  title: "Marimar Café Bistrô Bar — Restaurante pé na areia em Encantadas",
  description: "O restaurante da Pousada Marimar fica pé na areia, de frente para a Praia de Encantadas. Peixes, camarões, saladas, drinks e bebidas.",
};

export default function RestaurantePage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
      <span className="text-marca font-medium text-sm">Gastronomia</span>
      <h1 className="font-titulo text-3xl lg:text-4xl font-bold text-gray-900 mt-2 mb-4">{RESTAURANTE.nome}</h1>
      <p className="text-lg text-gray-600 leading-relaxed mb-10 max-w-2xl">{RESTAURANTE.posicao}</p>

      <div className="bg-marca-sutil border border-marca-borda rounded-marca p-6 mb-10">
        <p className="text-sm text-gray-700 leading-relaxed">{COMPLEXO.fraseLonga}</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-10">
        <div className="bg-white rounded-marca p-6 border border-gray-100 shadow-marca">
          <h2 className="font-titulo text-xl font-bold text-gray-900 mb-3">O que servimos</h2>
          <p className="text-sm text-gray-600 leading-relaxed mb-4">{RESTAURANTE.cardapioResumo}</p>
          <p className="text-xs text-gray-400 leading-relaxed">{RESTAURANTE.avisoPendente}</p>
        </div>

        <div className="bg-white rounded-marca p-6 border border-gray-100 shadow-marca">
          <h2 className="font-titulo text-xl font-bold text-gray-900 mb-3">Café da manhã</h2>
          <p className="text-sm text-gray-600 leading-relaxed mb-4">
            Incluso na diária. {CAFE_DA_MANHA.estilo}, servido das <strong>{CAFE_DA_MANHA.horario}</strong>.
          </p>
          <div className="flex flex-wrap gap-2">
            {CAFE_DA_MANHA.itens.map((i) => (
              <span key={i} className="text-xs bg-marca-sutil text-marca-ativa px-3 py-1 rounded-full">{i}</span>
            ))}
          </div>
          <Link href="/cafe-da-manha" className="inline-block mt-4 text-sm text-marca font-medium hover:text-marca-hover transition-marca">
            Mais sobre o café da manhã →
          </Link>
        </div>
      </div>

      <div className="bg-fundo-suave rounded-marca p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="font-medium text-gray-900 text-sm mb-1">Onde fica</p>
          <p className="text-sm text-gray-600">{ENDERECO.completo}</p>
          <p className="text-xs text-gray-400 mt-1">Plus Code {ENDERECO.plusCode}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link href="/como-chegar" className="bg-marca hover:bg-marca-hover text-white px-4 py-2.5 rounded-marca text-sm font-semibold transition-marca">Como chegar</Link>
          <a href={`https://wa.me/${CONTATO.whatsappDigitos}`} target="_blank" rel="noopener noreferrer"
            className="border border-gray-300 text-gray-700 px-4 py-2.5 rounded-marca text-sm font-medium hover:bg-white transition-marca">
            Falar no WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
