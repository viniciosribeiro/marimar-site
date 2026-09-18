import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // As fotos dos quartos vivem no motor Desbravador. Passando por next/image
    // elas sao redimensionadas, convertidas para AVIF/WebP e cacheadas na borda
    // da Vercel — em vez de 12 hotlinks crus de ~800ms cada.
    remotePatterns: [
      { protocol: "https", hostname: "reservas.desbravador.com.br" },
      { protocol: "https", hostname: "**.desbravador.com.br" },
      // Fotos proprias hospedadas fora do motor (Blob, CDN, WordPress legado)
      { protocol: "https", hostname: "**.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "pousadamarimarilhadomel.com.br" },
    ],
    // O motor serve JPEG pesado; o cache longo evita reprocessar a cada request.
    minimumCacheTTL: 60 * 60 * 24 * 7,
  },
};

export default nextConfig;
