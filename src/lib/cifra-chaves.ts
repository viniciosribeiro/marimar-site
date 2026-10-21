import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

/**
 * Chaves de API conectadas pelo painel (voz da Marina), guardadas no banco
 * cifradas. A chave de cifra sai do AUTH_SECRET, que só existe na Vercel:
 * quem copiar o banco não lê as chaves. Sem AUTH_SECRET, falha fechado —
 * não guarda nada em texto puro.
 *
 * Formato: "v1:" + base64(iv 12 bytes | tag 16 bytes | dados), AES-256-GCM.
 */

function chaveDeCifra(): Buffer | null {
  const s = process.env.AUTH_SECRET?.trim();
  return s ? createHash("sha256").update(`${s}|chaves-de-voz-da-marina`).digest() : null;
}

export function podeCifrar(): boolean {
  return chaveDeCifra() !== null;
}

export function cifrar(texto: string): string {
  const k = chaveDeCifra();
  if (!k) throw new Error("AUTH_SECRET ausente: o painel não guarda chave sem cifrar.");
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", k, iv);
  const dados = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  return "v1:" + Buffer.concat([iv, c.getAuthTag(), dados]).toString("base64");
}

/** null quando não dá para abrir (AUTH_SECRET trocado, valor corrompido). */
export function decifrar(guardado: string | null | undefined): string | null {
  const k = chaveDeCifra();
  if (!k || !guardado?.startsWith("v1:")) return null;
  try {
    const b = Buffer.from(guardado.slice(3), "base64");
    const d = createDecipheriv("aes-256-gcm", k, b.subarray(0, 12));
    d.setAuthTag(b.subarray(12, 28));
    return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** "sk-…9f2c": o bastante para a pessoa reconhecer qual chave é, nunca a chave. */
export const finalDaChave = (chave: string) => `…${chave.slice(-4)}`;
