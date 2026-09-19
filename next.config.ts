import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Indicador de desenvolvimento do Next (o circulo com "N" no canto).
   * Desligado porque cobre o botao flutuante de WhatsApp e atrapalha a
   * avaliacao visual das telas. Erros de compilacao e de runtime continuam
   * aparecendo normalmente — so o selo sai.
   * So existia em desenvolvimento; em producao nunca apareceu.
   */
  devIndicators: false,

  /**
   * /cardapio e /cafe-da-manha foram absorvidas por /restaurante: eram tres
   * paginas falando do mesmo lugar, e o hospede nao separa "restaurante" de
   * "cardapio" na cabeca. As rotas antigas continuam valendo — QR code
   * impresso, link enviado no WhatsApp e resultado de busca ja indexado
   * seguem funcionando. permanent: true transfere o ranking para a nova URL.
   */
  async redirects() {
    return [
      { source: "/cardapio", destination: "/restaurante#cardapio", permanent: true },
      { source: "/cafe-da-manha", destination: "/restaurante#cafe-da-manha", permanent: true },
    ];
  },
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
