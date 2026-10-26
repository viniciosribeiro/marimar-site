import type { Metadata } from "next";
import SaudeCecilia from "./SaudeCecilia";

export const metadata: Metadata = {
  title: "Marina cuida da Pousada | Saúde da Marimar",
  description: "A Marina explica, de forma simples, as verificações reais de saúde do site, das reservas e do WhatsApp da Pousada Marimar.",
  robots: { index: false, follow: false },
};

export default function SaudePage() {
  return <SaudeCecilia />;
}
