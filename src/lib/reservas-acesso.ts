import "server-only";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export const COOKIE_RESERVAS = "marimar_reservas_sessao";
export const DURACAO_SESSAO_SEG = 8 * 60 * 60;
const USUARIO = "cecilia";

function iguais(a: Buffer, b: Buffer) {
  return a.length === b.length && timingSafeEqual(a, b);
}

export function loginConfigurado(): boolean {
  const hash = process.env.RESERVAS_PASSWORD_SCRYPT ?? "";
  const secret = process.env.RESERVAS_SESSION_SECRET ?? "";
  return /^[a-f0-9]{32}:[a-f0-9]{64}$/.test(hash) && /^[a-f0-9]{64,}$/.test(secret);
}

/** O texto da senha nao existe no repositorio: so hash scrypt no cofre Vercel. */
export function verificarLogin(usuario: string, senha: string): boolean {
  if (!loginConfigurado() || typeof senha !== "string" || senha.length > 128 || typeof usuario !== "string") return false;
  const [sal, hash] = process.env.RESERVAS_PASSWORD_SCRYPT!.split(":");
  const calculado = scryptSync(senha, Buffer.from(sal, "hex"), 32, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  const user = iguais(Buffer.from(usuario.trim().toLowerCase()), Buffer.from(USUARIO));
  const senhaOk = iguais(calculado, Buffer.from(hash, "hex"));
  return user && senhaOk;
}

function assinatura(corpo: string) {
  const segredo = process.env.RESERVAS_SESSION_SECRET;
  if (!segredo || !loginConfigurado()) return null;
  return createHmac("sha256", Buffer.from(segredo, "hex")).update(corpo).digest("base64url");
}

export function criarSessao(): string {
  if (!loginConfigurado()) throw new Error("Painel de reservas sem configuracao de acesso");
  const corpo = Buffer.from(JSON.stringify({
    u: USUARIO, exp: Date.now() + DURACAO_SESSAO_SEG * 1000,
    nonce: randomBytes(16).toString("hex"),
  })).toString("base64url");
  const sig = assinatura(corpo);
  if (!sig) throw new Error("Sessao de reservas sem chave");
  return corpo + "." + sig;
}

export function sessaoValida(token?: string): boolean {
  if (!token || !loginConfigurado() || token.length > 600) return false;
  const partes = token.split(".");
  if (partes.length !== 2) return false;
  const [corpo, sig] = partes;
  const assinaturaEsperada = assinatura(corpo);
  if (!assinaturaEsperada || !iguais(Buffer.from(sig), Buffer.from(assinaturaEsperada))) return false;
  try {
    const p = JSON.parse(Buffer.from(corpo, "base64url").toString("utf8"));
    return p?.u === USUARIO && typeof p.exp === "number" && p.exp > Date.now() &&
      p.exp <= Date.now() + DURACAO_SESSAO_SEG * 1000 + 30_000 && typeof p.nonce === "string" && /^[a-f0-9]{32}$/.test(p.nonce);
  } catch { return false; }
}

/** Para formularios POST: bloquear pedidos de origens externas. */
export function origemPermitida(req: Request): boolean {
  const origem = req.headers.get("origin");
  if (!origem) return true; // alguns navegadores omitem Origin em formulario comum
  try { return new URL(origem).origin === new URL(req.url).origin; }
  catch { return false; }
}
