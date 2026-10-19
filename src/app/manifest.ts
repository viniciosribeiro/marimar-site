import type { MetadataRoute } from "next";
import { lerPousada } from "@/lib/pousada";
import { lerTema } from "@/lib/tema";
import { versaoIcone } from "@/lib/icone";

/**
 * Manifesto do site (19/10/2026): nome, cores e ícones quando alguém põe o
 * site na tela inicial do celular. Sem ele, o Android abria o atalho com o
 * triângulo da Vercel no meio de uma tela branca.
 */
export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const p = await lerPousada();
  const tema = lerTema(p);
  const v = versaoIcone(p);
  return {
    name: "Pousada Marimar — Ilha do Mel",
    short_name: "Marimar",
    description: p?.seo_description || "Pousada na Ilha do Mel (Encantadas, PR), com restaurante à beira-mar.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: tema.marca,
    lang: "pt-BR",
    icons: [
      { src: `/marca/icone/192?v=${v}`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `/marca/icone/512?v=${v}`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `/marca/icone/512?v=${v}`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
