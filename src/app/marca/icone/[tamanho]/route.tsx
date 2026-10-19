import { ImageResponse } from "next/og";
import { lerPousada } from "@/lib/pousada";
import { lerTema } from "@/lib/tema";

/**
 * Ícone do site gerado a partir da logo (19/10/2026). Antes o site usava o
 * favicon padrão do Next — o triângulo da Vercel —, que aparecia na aba, no
 * atalho da tela inicial e na tela de abertura do celular.
 *
 * Fonte: o favicon próprio (Identidade visual), quando é PNG/JPG/SVG; senão a
 * logo; sem nenhum dos dois, um "M" na cor da marca. A logo vai centrada num
 * quadrado branco com margem: serve como ícone comum e como "maskable" (o
 * Android recorta em círculo ou gota sem cortar a logo).
 *
 * Tamanhos: 32 (aba), 180 (iPhone), 192 e 512 (Android). Lido do banco a cada
 * pedido; o endereço leva `?v=` da logo (src/lib/icone.ts), então trocar a
 * logo troca o ícone.
 */
export const dynamic = "force-dynamic";

const TAMANHOS = [32, 180, 192, 512];

/** Baixa a imagem antes de desenhar: se ela não vier (endereço velho, rede), o ícone sai com o "M" em vez de dar erro. */
async function comoDataUrl(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
    const tipo = (r.headers.get("content-type") ?? "").split(";")[0];
    if (!r.ok || !/^image\/(png|jpeg|svg\+xml)$/.test(tipo)) return null;
    return `data:${tipo};base64,${Buffer.from(await r.arrayBuffer()).toString("base64")}`;
  } catch {
    return null;
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ tamanho: string }> }) {
  const pedido = Number((await params).tamanho);
  const lado = TAMANHOS.includes(pedido) ? pedido : 192;
  const p = await lerPousada();
  const tema = lerTema(p);
  const favicon = typeof p?.favicon_url === "string" && /\.(png|jpe?g|svg)(\?|$)/i.test(p.favicon_url) ? p.favicon_url : null;
  const fonte = await comoDataUrl(favicon || p?.logo_url || null);
  /* Na aba (32 px) a logo ocupa quase tudo; no celular, sobra margem para o recorte. */
  const caixa = Math.round(lado * (lado <= 48 ? 0.96 : 0.7));

  const desenho = fonte ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={fonte} width={caixa} height={caixa} alt="" style={{ objectFit: "contain" }} />
  ) : (
    <div style={{
      width: caixa, height: caixa, borderRadius: "50%", background: tema.marca, color: "#ffffff",
      display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.round(caixa * 0.56), fontWeight: 700,
    }}>M</div>
  );

  return new ImageResponse(
    (
      <div style={{ width: lado, height: lado, display: "flex", alignItems: "center", justifyContent: "center", background: "#ffffff" }}>
        {desenho}
      </div>
    ),
    { width: lado, height: lado, headers: { "cache-control": "public, max-age=3600" } },
  );
}
