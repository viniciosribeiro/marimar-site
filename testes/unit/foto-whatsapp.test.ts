import { test } from "node:test";
import assert from "node:assert/strict";
import {
  slugFotoValido, indiceFotoValido, urlFotoWhatsapp,
  origemFotoPermitida, tipoFotoPermitido, urlOtimizadaFoto,
} from "../../src/lib/foto-whatsapp";

test("URL publica da foto usa somente slug e indice, sem links Desbravador", () => {
  assert.equal(urlFotoWhatsapp("familia", 0),
    "https://www.pousadamarimarilhadomel.com.br/api/midia-quarto/familia/0");
  assert.equal(urlFotoWhatsapp("suite-king", 2).endsWith("/suite-king/2"), true);
  assert.throws(() => urlFotoWhatsapp("../admin", 0));
  assert.throws(() => urlFotoWhatsapp("familia", 6));
});

test("indice e slug nao aceitam valores que contornem a lista de fotos", () => {
  assert.ok(slugFotoValido("familia"));
  assert.equal(slugFotoValido("https://localhost"), false);
  assert.equal(slugFotoValido("FAMILIA"), false);
  assert.equal(indiceFotoValido("0"), 0);
  assert.equal(indiceFotoValido("5"), 5);
  for (const n of ["-1", "06", "6", "999", "1?x=2"]) assert.equal(indiceFotoValido(n), null);
});

test("repassa apenas imagens oficiais Desbravador e Vercel Blob", () => {
  const foto = "https://reservas.desbravador.com.br/reservas/images/hoteis/img719501/gt_MRFAM_352878.jpeg";
  assert.equal(origemFotoPermitida(foto), true);
  assert.equal(origemFotoPermitida("https://abc.public.blob.vercel-storage.com/midias/fotos/exemplo.jpg"), true);
  for (const url of [
    "http://reservas.desbravador.com.br/reservas/images/hoteis/x.jpg",
    "https://reservas.desbravador.com.br.evil.com/reservas/images/hoteis/x.jpg",
    "https://reservas.desbravador.com.br@127.0.0.1/admin.jpg",
    "https://localhost/internal.jpg", "file:///etc/passwd",
    "https://reservas.desbravador.com.br/admin.jpg",
    "https://reservas.desbravador.com.br/reservas/images/hoteis/../secret.png",
  ]) assert.equal(origemFotoPermitida(url), false, url);
});

test("conteudo da imagem so pode ser jpeg, png ou webp", () => {
  assert.equal(tipoFotoPermitido("image/jpeg; charset=binary"), "image/jpeg");
  assert.equal(tipoFotoPermitido("image/webp"), "image/webp");
  assert.equal(tipoFotoPermitido("text/html"), null);
  assert.equal(tipoFotoPermitido("image/svg+xml"), null);
});

test("URL do cache interno limita largura e qualidade", () => {
  const original = "https://reservas.desbravador.com.br/reservas/images/hoteis/img719501/gt_MRFAM_352878.jpeg";
  const destino = new URL(urlOtimizadaFoto(original));
  assert.equal(destino.pathname, "/_next/image");
  assert.equal(destino.searchParams.get("url"), original);
  assert.equal(destino.searchParams.get("w"), "1080");
  assert.equal(destino.searchParams.get("q"), "75");
});
