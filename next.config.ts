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
  /**
   * robots e sitemap sao gerados em /api/robots e /api/sitemap, mas
   * buscadores so procuram /robots.txt e /sitemap.xml — e o robots apontava
   * para um /sitemap.xml que nao existia. O rewrite serve os dois nos
   * enderecos padrao sem mudar a URL.
   */
  async rewrites() {
    return [
      { source: "/robots.txt", destination: "/api/robots" },
      { source: "/sitemap.xml", destination: "/api/sitemap" },
    ];
  },
  images: {
    // As fotos dos quartos vivem no motor Desbravador. Passando por next/image
    // elas sao redimensionadas, convertidas para AVIF/WebP e cacheadas na borda
    // da Vercel — em vez de 12 hotlinks crus de ~800ms cada.
    remotePatterns: [
      { protocol: "https", hostname: "reservas.desbravador.com.br" },
      { protocol: "https", hostname: "**.desbravador.com.br" },
      // Fotos proprias, hospedadas conosco.
      { protocol: "https", hostname: "**.public.blob.vercel-storage.com" },
      /* O WordPress antigo saiu daqui em 20/09/2026, depois que as 56 fotos
         importadas foram trazidas para o Blob (`npm run db:migrar-fotos`).
         Nao e limpeza: enquanto ele estivesse permitido, uma imagem antiga
         reintroduzida por engano continuaria carregando em silencio ate o
         dia em que aquele servidor saisse do ar. Agora falha na hora, que e
         quando da para consertar. */
    ],
    // O motor serve JPEG pesado; o cache longo evita reprocessar a cada request.
    minimumCacheTTL: 60 * 60 * 24 * 7,
  },
};

export default nextConfig;
