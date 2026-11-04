import { urlDoSite } from "@/lib/seo";
import { jsonLd, noMigalhas, type No } from "@/lib/site-novo/dados-estruturados";

/** O bloco JSON-LD de uma página do site novo (src/lib/site-novo/dados-estruturados.ts). */
export function DadosEstruturados({ nos }: { nos: (No | null | undefined)[] }) {
  const texto = jsonLd(nos);
  return texto ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: texto }} /> : null;
}

/** O caminho da página para os buscadores (Início › …), sem nada visível. */
export function Migalhas({ trilha }: { trilha: [nome: string, caminho: string][] }) {
  return <DadosEstruturados nos={[noMigalhas(urlDoSite(), trilha)]} />;
}
