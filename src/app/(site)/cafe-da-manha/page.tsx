import Link from "next/link";
import type { Metadata } from "next";
import { CAFE_DA_MANHA, RESTAURANTE, POLITICAS } from "@/lib/conteudo-pousada";

export const metadata: Metadata = {
  title: "Café da manhã — Pousada Marimar, Ilha do Mel",
  description: "Café da manhã incluso na diária, self-service, servido das 08h às 10h no Marimar Café Bistrô Bar.",
};

export default function CafeDaManhaPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
      <span className="text-marca font-medium text-sm">Incluso na diária</span>
      <h1 className="font-titulo text-3xl lg:text-4xl font-bold text-gray-900 mt-2 mb-4">Café da manhã</h1>
      <p className="text-lg text-gray-600 leading-relaxed mb-10 max-w-2xl">
        {CAFE_DA_MANHA.estilo}, servido todos os dias das <strong>{CAFE_DA_MANHA.horario}</strong> no {RESTAURANTE.nome},
        de frente para a Praia de Encantadas.
      </p>

      <div className="grid sm:grid-cols-3 gap-4 mb-10">
        <Info titulo="Horário" valor={CAFE_DA_MANHA.horario} />
        <Info titulo="Formato" valor={CAFE_DA_MANHA.estilo} />
        <Info titulo="Custo" valor="Incluso na diária" />
      </div>

      <h2 className="font-titulo text-xl font-bold text-gray-900 mb-4">O que você encontra</h2>
      <div className="flex flex-wrap gap-2.5 mb-10">
        {CAFE_DA_MANHA.itens.map((i) => (
          <span key={i} className="text-sm bg-marca-sutil text-marca-ativa px-4 py-2 rounded-full">{i}</span>
        ))}
      </div>

      <div className="bg-fundo-suave rounded-marca p-6">
        <p className="text-sm text-gray-600 leading-relaxed">
          O check-out é até as <strong>{POLITICAS.checkOut}</strong>, então dá tempo de tomar café com calma antes de sair.
          {" "}Se a sua travessia for cedo, avise a recepção na véspera.
        </p>
        <Link href="/politicas" className="inline-block mt-3 text-sm text-marca font-medium hover:text-marca-hover transition-marca">
          Ver todas as políticas →
        </Link>
      </div>
    </div>
  );
}

function Info({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="bg-white rounded-marca p-5 border border-gray-100 shadow-marca text-center">
      <p className="text-xs text-gray-400 uppercase tracking-wider mb-1.5">{titulo}</p>
      <p className="font-semibold text-gray-900">{valor}</p>
    </div>
  );
}
