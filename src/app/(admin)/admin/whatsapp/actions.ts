"use server";

import { revalidatePath } from "next/cache";
import { exigirSessao } from "@/lib/admin-sessao";
import { statusWhatsapp } from "@/lib/envio-whatsapp";
import { gerarQr, esperarLeitura, desconectarWhatsapp, faseDoPasso, type Fase } from "@/lib/whatsapp-conexao";

/**
 * Ações da tela "WhatsApp da Marina". Só o perfil Administração (papel
 * "master"): quem lê o QR passa a controlar o WhatsApp da pousada pela
 * Marina, e quem desconecta deixa os clientes sem resposta.
 */

export type RespostaQr = { ok: boolean; fase: Fase; texto: string; qr?: string | null; sessao?: string | null };

async function exigirAdministracao() {
  const s = await exigirSessao();
  return (s.user as { role?: string }).role === "master";
}

const semPermissao: RespostaQr = { ok: false, fase: "erro", texto: "Só quem tem acesso de Administração conecta ou desconecta o WhatsApp." };

const atualizar = () => { revalidatePath("/admin/whatsapp"); revalidatePath("/admin"); };

export async function pedirQr(): Promise<RespostaQr> {
  if (!(await exigirAdministracao())) return semPermissao;
  /* O QR novo apaga a sessão antiga (ver gerarQr): com a Marina no ar, isso
     a derrubaria. Na dúvida (status sem resposta), segue: se o servidor não
     responde, ela já não está atendendo. */
  const status = await statusWhatsapp().catch(() => null);
  if (status?.sabe && status.conectado === true) {
    return { ok: false, fase: "conectado", texto: "A Marina já está conectada. Para trocar de celular, desconecte primeiro." };
  }
  const r = await gerarQr();
  if (!r.ok) return { ok: false, fase: "erro", texto: `Não deu para falar com o servidor da Marina: ${r.erro}` };
  const f = faseDoPasso(r.passo);
  if (f.fase === "conectado") atualizar();
  return { ok: f.fase !== "erro", ...f, qr: r.passo.qr, sessao: r.passo.sessao };
}

export async function aguardarLeitura(sessao: string | null, qrAtual: string | null): Promise<RespostaQr> {
  if (!(await exigirAdministracao())) return semPermissao;
  const r = await esperarLeitura(typeof sessao === "string" ? sessao.slice(0, 500) : null, typeof qrAtual === "string" ? qrAtual : null);
  if (!r.ok) return { ok: false, fase: "erro", texto: `Não deu para falar com o servidor da Marina: ${r.erro}` };
  const f = faseDoPasso(r.passo);
  if (f.fase === "conectado") atualizar();
  return { ok: f.fase !== "erro", ...f, qr: r.passo.qr, sessao: r.passo.sessao };
}

export async function desconectar(confirmacao: string): Promise<{ ok: boolean; texto: string }> {
  if (!(await exigirAdministracao())) return { ok: false, texto: semPermissao.texto };
  if (String(confirmacao).trim().toUpperCase() !== "DESCONECTAR") return { ok: false, texto: "Escreva DESCONECTAR para confirmar." };
  const r = await desconectarWhatsapp();
  atualizar();
  return r.ok
    ? { ok: true, texto: "A Marina foi desconectada do WhatsApp. Os clientes ficam sem resposta automática até conectar de novo." }
    : { ok: false, texto: `Não deu para desconectar: ${r.erro}` };
}
