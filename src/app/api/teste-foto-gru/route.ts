export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Rota TEMPORARIA de diagnostico. Excluir antes do merge para producao.
export async function GET() {
  const original = "https://reservas.desbravador.com.br/reservas/images/hoteis/img719501/gt_MRFAM_352878.jpeg";
  const otimizada = "https://www.pousadamarimarilhadomel.com.br/_next/image?url=" +
    encodeURIComponent(original) + "&w=1080&q=75";
  const out = [];
  for (const [tipo, url] of [["direta-gru1", original], ["cache-vercel", otimizada]]) {
    try {
      const r = await fetch(url, {
        headers: { Accept: "image/jpeg,image/png,image/webp" },
        signal: AbortSignal.timeout(8000),
        redirect: "error", cache: "no-store",
      });
      const data = await r.arrayBuffer();
      out.push({ tipo, status: r.status, mimetype: r.headers.get("content-type"),
        tamanho: data.byteLength, magic: Array.from(new Uint8Array(data).slice(0, 4)) });
    } catch (e) { out.push({ tipo, erro: e instanceof Error ? e.message : String(e) }); }
  }
  return Response.json(out, { headers: { "cache-control": "no-store" } });
}