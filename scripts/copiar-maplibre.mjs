/**
 * Copia o worker do MapLibre GL (v6) para public/vendor/maplibre/.
 *
 * O MapLibre 6 carrega o worker em tempo de execução por um endereço que o
 * empacotador do Next não enxerga. Servindo os dois arquivos como estáticos
 * e apontando `setWorkerUrl` para eles (src/components/site/rota/MapaRota.tsx),
 * o mapa funciona igual no dev e na Vercel. Roda sozinho antes do dev e do
 * build (package.json: predev/prebuild). A pasta está no .gitignore.
 */
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const origem = join(raiz, "node_modules/maplibre-gl/dist");
const destino = join(raiz, "public/vendor/maplibre");
if (!existsSync(origem)) {
  console.warn("[maplibre] node_modules/maplibre-gl ausente — rode npm install.");
  process.exit(0);
}
mkdirSync(destino, { recursive: true });
for (const f of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) copyFileSync(join(origem, f), join(destino, f));
console.log("[maplibre] worker copiado para public/vendor/maplibre/");
