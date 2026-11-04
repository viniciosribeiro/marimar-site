import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/* A skill da Marina é texto, mas carrega regras que o site depende: as
   rotas de fotos e o bloco de fala. Se alguém apagar sem querer, este teste
   avisa antes do WhatsApp voltar a soletrar link. */
const skill = readFileSync(new URL("../../agente/skills/marimar-pousada/SKILL.md", import.meta.url), "utf8");

test("skill: conhece a rota de fotos por seção (café da manhã, restaurante…)", () => {
  assert.match(skill, /\/api\/agent\/fotos/);
  assert.match(skill, /secao=cafe/);
  assert.match(skill, /url_whatsapp/);
});

test("skill: exige o bloco de fala curto, sem URL, nas respostas com link", () => {
  assert.match(skill, /\[\[tts:text\]\]frase curta\[\[\/tts:text\]\]/);
  assert.match(skill, /menos de 180 caracteres/);
  assert.match(skill, /maxLength/);
});

test("skill: continua mandando o link por texto e nunca narrado", () => {
  assert.match(skill, /nunca narrado|NÃO soletrar/i);
  assert.match(skill, /bestEffort: false/);
});
