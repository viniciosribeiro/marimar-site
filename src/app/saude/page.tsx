import type { Metadata } from "next";
import SaudeSimples from "./SaudeSimples";

export const metadata: Metadata = {
  title: "Marina | Cuidando da Pousada Marimar",
  description: "Marina apresenta, em linguagem simples, os resultados reais das verificações do site, reservas e WhatsApp.",
  robots: { index: false, follow: false },
};

export default function SaudePage() {
  return <SaudeSimples />;
}
