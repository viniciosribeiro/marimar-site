import type { Metadata } from "next";
import SaudeV2 from "./SaudeV2";

export const metadata: Metadata = {
  title: "Saúde da Plataforma | Pousada Marimar",
  description: "Central pública de observabilidade da Pousada Marimar. Estado dos serviços, dependências e a Marina acompanhando a plataforma.",
  robots: { index: false, follow: false },
};

export default function SaudePage() {
  return <SaudeV2 />;
}
