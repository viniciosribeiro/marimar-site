/**
 * Site → Modelo do site: a chave Clássico/Novo e a prévia assinada.
 *   npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assinarPrevia, conferirPrevia, lerConfigModelo, hostPublico, voltarSeguro, DURACAO_LINK_MS, DURACAO_PREVIA_MS,
} from "../../src/lib/modelo-site";
import { PAGINAS_SITE, paginaDoEndereco, todasProntas } from "../../src/lib/site-novo/paginas";

const SEGREDO = "segredo-de-teste-com-mais-de-16";

test("link de prévia: assinado, com prazo, e só para a finalidade certa", () => {
  const agora = 1_800_000_000_000;
  const link = assinarPrevia("entrar", agora + DURACAO_LINK_MS, SEGREDO)!;
  assert.ok(conferirPrevia(link, "entrar", agora, SEGREDO));
  assert.equal(conferirPrevia(link, "previa", agora, SEGREDO), false, "link não vale como cookie");
  assert.equal(conferirPrevia(link, "entrar", agora + DURACAO_LINK_MS + 1, SEGREDO), false, "vencido");
  assert.equal(conferirPrevia(link, "entrar", agora, "outro-segredo-qualquer-123"), false, "outro segredo");
  const adulterado = link.replace(/\.(\d+)\./, (_, n) => `.${Number(n) + 999_999}.`);
  assert.equal(conferirPrevia(adulterado, "entrar", agora, SEGREDO), false, "prazo trocado à mão");
  assert.equal(conferirPrevia("v1.entrar.123", "entrar", agora, SEGREDO), false);
  assert.equal(conferirPrevia(null, "entrar", agora, SEGREDO), false);
});

test("validade maior que a emitida pelo site é recusada", () => {
  const agora = 1_800_000_000_000;
  const longe = assinarPrevia("previa", agora + DURACAO_PREVIA_MS * 3, SEGREDO)!;
  assert.equal(conferirPrevia(longe, "previa", agora, SEGREDO), false);
  const certo = assinarPrevia("previa", agora + DURACAO_PREVIA_MS, SEGREDO)!;
  assert.ok(conferirPrevia(certo, "previa", agora, SEGREDO));
});

test("sem AUTH_SECRET não há prévia (falha fechada)", () => {
  assert.equal(assinarPrevia("entrar", Date.now() + 1000, null), null);
  assert.equal(conferirPrevia("v1.entrar.1.x", "entrar", Date.now(), null), false);
});

test("modelo: coluna ausente ou estranha = Clássico; Novo só com tudo pronto", () => {
  assert.equal(lerConfigModelo(null).modelo, "classico");
  assert.equal(lerConfigModelo({}).modelo, "classico");
  assert.equal(lerConfigModelo({ modelo_site: "novo" }).modelo, "classico");
  const novo = lerConfigModelo({ modelo_site: { modelo: "novo", ceu_por_hora: false, alterado_por: "x@y" } });
  assert.equal(novo.modelo, todasProntas() ? "novo" : "classico", "enquanto houver página em construção, os visitantes ficam no Clássico");
  assert.equal(novo.ceuPorHora, false);
  assert.equal(novo.alteradoPor, "x@y");
  assert.equal(lerConfigModelo({ modelo_site: { modelo: "classico" } }).ceuPorHora, true, "céu ligado por padrão");
});

test("páginas: endereço encontra a página da lista", () => {
  assert.equal(paginaDoEndereco("/")?.caminho, "/");
  assert.equal(paginaDoEndereco("/quartos/suite-queen")?.caminho, "/quartos/[slug]");
  assert.equal(paginaDoEndereco("/pacotes/reveillon")?.caminho, "/pacotes");
  assert.equal(paginaDoEndereco("/reservar?check_in=2026-12-09")?.caminho, "/reservar");
  assert.equal(paginaDoEndereco("/admin"), null);
  assert.equal(new Set(PAGINAS_SITE.map((p) => p.caminho)).size, PAGINAS_SITE.length, "sem página repetida");
});

test("o link de prévia aponta para o site público, não para o painel", () => {
  assert.equal(hostPublico("admin.pousadamarimarilhadomel.com.br"), "www.pousadamarimarilhadomel.com.br");
  assert.equal(hostPublico("marimar-site.vercel.app"), "marimar-site.vercel.app");
  assert.equal(hostPublico("localhost:3000"), "localhost:3000");
});

test("barrinha da prévia só volta para página do próprio site", () => {
  const base = "https://www.pousada.test/api/modelo-site/ver";
  assert.equal(voltarSeguro("/reservar?check_in=2026-12-09", base).href, "https://www.pousada.test/reservar?check_in=2026-12-09");
  assert.equal(voltarSeguro("/quartos/suite-queen#fotos", base).href, "https://www.pousada.test/quartos/suite-queen");
  for (const golpe of ["//outro.com", "/\\outro.com", "/\t/outro.com", "/\n/outro.com", "https://outro.com/x", "javascript:alert(1)", ""]) {
    assert.equal(voltarSeguro(golpe, base).href, "https://www.pousada.test/", JSON.stringify(golpe));
  }
  assert.equal(voltarSeguro("/api/modelo-site/ver", base).href, "https://www.pousada.test/");
});
