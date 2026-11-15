/**
 * Mensagem de status do motor do Desbravador só com a frase legível.
 *
 * Em 15/11/2026 o motor passou a recusar o serviço de tarifas com
 * "Acesso não autorizado à API: Interface.php -> {…}". O que vem depois da
 * seta (ou de uma chave/colchete) são dados internos do servidor deles:
 * nunca repassar nem guardar. Entidades HTML viram acentos.
 */
const ENTIDADES: Record<string, string> = {
  atilde: "ã", otilde: "õ", agrave: "à", aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú",
  acirc: "â", ecirc: "ê", ocirc: "ô", ccedil: "ç", Atilde: "Ã", Aacute: "Á", Eacute: "É", Ccedil: "Ç",
  gt: ">", lt: "<", quot: '"', amp: "&", apos: "'", nbsp: " ",
};

export function fraseDoMotor(msg: unknown, max = 120): string {
  const legivel = String(msg ?? "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&([a-zA-Z]+);/g, (m, n) => ENTIDADES[n] ?? m);
  return legivel.split(/\s*->\s*|\s*[{[]/)[0].replace(/\s+/g, " ").trim().slice(0, max);
}
