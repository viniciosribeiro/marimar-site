import { test } from "node:test";
import assert from "node:assert/strict";
import { fraseDoMotor } from "../../src/lib/frase-do-motor";

test("recusa do motor: fica só a frase, sem os dados do servidor depois da seta", () => {
  const msg = 'Acesso n&atilde;o autorizado &agrave; API: Interface.php -&gt; {&quot;USER&quot;:&quot;apache&quot;,&quot;HOME&quot;:&quot;\\/usr\\/share\\/httpd&quot;}';
  assert.equal(fraseDoMotor(msg), "Acesso não autorizado à API: Interface.php");
});

test("mensagem normal do motor só ganha acentos", () => {
  assert.equal(fraseDoMotor("Identifica&ccedil;&atilde;o OK."), "Identificação OK.");
});

test("corta em chave ou colchete e limita o tamanho", () => {
  assert.equal(fraseDoMotor('erro {"x":1}'), "erro");
  assert.equal(fraseDoMotor("a".repeat(300)).length, 120);
  assert.equal(fraseDoMotor(undefined), "");
});
