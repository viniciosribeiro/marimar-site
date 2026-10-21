"use server";

import { revalidatePath } from "next/cache";
import { exigirSessao } from "@/lib/admin-sessao";
import { gerarQr, esperarLeitura, desconectarWhatsapp, faseDoPasso, type Fase } from "@/lib/whatsapp-conexao";
import { comSql } from "@/lib/db-conexao";
import { lerConfigEscalonamento } from "@/lib/escalonamento";
import { chamarRpc } from "@/lib/openclaw-config";
import { faltandoMeta } from "@/lib/whatsapp-meta-base";
import { infoNumeroMeta } from "@/lib/whatsapp-meta";
import { anotarNoHistorico, destravarCanal, lerConexao } from "@/lib/whatsapp-vigia";
import type { EstadoConexao } from "@/lib/whatsapp-saude";

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

const modoAtual = () => comSql(lerConfigEscalonamento).then((c) => c.whatsapp_modo).catch(() => "web");

const semPermissao: RespostaQr = { ok: false, fase: "erro", texto: "Só quem tem acesso de Administração conecta ou desconecta o WhatsApp." };

const atualizar = () => { revalidatePath("/admin/whatsapp"); revalidatePath("/admin"); };

export async function pedirQr(): Promise<RespostaQr> {
  if (!(await exigirAdministracao())) return semPermissao;
  /* Com a API oficial em uso, o QR ligaria a segunda forma no mesmo número
     e a Marina responderia duas vezes. */
  if ((await modoAtual()) === "oficial") {
    return { ok: false, fase: "erro", texto: "A Marina está usando a API oficial da Meta. Para usar o QR, escolha WhatsApp Web (QR) em “Qual WhatsApp a Marina usa”." };
  }
  /* O QR novo APAGA a ligação atual com o celular (ver gerarQr). Só sai
     quando o servidor confirma que não há ligação boa para perder: na
     dúvida, não. Ligada mas travada se resolve destravando, não com QR. */
  const c = await lerConexao();
  if (!c.ok) {
    return { ok: false, fase: "erro", texto: `Não consegui perguntar ao servidor da Marina (${c.erro}). Para não apagar uma conexão que pode estar funcionando, o QR só sai quando ele responde. Tente de novo em 1 minuto.` };
  }
  const estado = c.leitura?.estado;
  if (estado === "conectado") {
    return { ok: false, fase: "conectado", texto: "A Marina já está conectada. Para trocar de celular, desconecte primeiro." };
  }
  if (estado === "travado" || estado === "parado" || estado === "reconectando") {
    return { ok: false, fase: "erro", texto: "O WhatsApp ainda está ligado ao celular, só sem conexão: um QR novo apagaria essa ligação. Use “Destravar a conexão”. Para trocar de celular, desconecte primeiro." };
  }
  if (estado === "conflito") {
    return { ok: false, fase: "erro", texto: "Duas cópias da Marina usaram o mesmo número. Deixe só um OpenClaw ligado e reinicie o gateway (openclaw gateway restart) antes de qualquer QR." };
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

/**
 * Troca a forma em uso: WhatsApp Web (QR, pelo OpenClaw) ou API oficial da
 * Meta. Grava em `marina_escalonamento_config.whatsapp_modo` (a mesma
 * escolha que os chamados usam para mandar) e pausa ou religa o WhatsApp
 * Web no OpenClaw (`channels.stop` / `channels.start`, que guardam o QR),
 * para as duas nunca responderem juntas.
 */
export async function escolherModo(modo: string): Promise<{ ok: boolean; texto: string }> {
  const s = await exigirSessao();
  if ((s.user as { role?: string }).role !== "master") return { ok: false, texto: semPermissao.texto };
  const novo = modo === "oficial" ? "oficial" : "web";
  if (novo === "oficial") {
    const faltam = faltandoMeta();
    if (faltam.length) return { ok: false, texto: `A API oficial ainda não tem as chaves na Vercel: ${faltam.join(", ")}.` };
  }
  const autor = (s.user?.name || s.user?.email || "painel") as string;
  try {
    await comSql((sql) => sql`
      INSERT INTO marina_escalonamento_config (id, whatsapp_modo, atualizado_por, atualizado_em)
      VALUES (1, ${novo}, ${autor}, now())
      ON CONFLICT (id) DO UPDATE SET whatsapp_modo = excluded.whatsapp_modo, atualizado_por = excluded.atualizado_por, atualizado_em = now()`);
  } catch (e) {
    return { ok: false, texto: `Não consegui gravar a escolha: ${(e as Error).message}. Se for "relation does not exist", rode npm run db:migrate.` };
  }
  const r = await chamarRpc(novo === "oficial" ? "channels.stop" : "channels.start", { channel: "whatsapp" }, 20_000);
  atualizar(); revalidatePath("/admin/equipe");
  const feito = novo === "oficial" ? "Pronto: a Marina agora atende pela API oficial da Meta." : "Pronto: a Marina voltou para o WhatsApp Web (QR).";
  if (r.ok) return { ok: true, texto: `${feito} ${novo === "oficial" ? "O WhatsApp Web foi pausado no servidor (o QR fica guardado)." : "O WhatsApp Web foi religado no servidor."}` };
  return {
    ok: true,
    texto: novo === "oficial"
      ? `${feito} Atenção: não consegui pausar o WhatsApp Web no servidor da Marina (${r.erro}). Desconecte o QR abaixo para ela não responder duas vezes.`
      : `${feito} Atenção: não consegui religar o WhatsApp Web no servidor (${r.erro}). Se ele não voltar sozinho, conecte pelo QR abaixo.`,
  };
}

/** "Testar a ligação com a Meta": o número e o nome que a Meta devolve. */
export async function testarMeta(): Promise<{ ok: boolean; texto: string }> {
  if (!(await exigirAdministracao())) return { ok: false, texto: semPermissao.texto };
  const faltam = faltandoMeta();
  if (faltam.length) return { ok: false, texto: `Faltam na Vercel: ${faltam.join(", ")}.` };
  const r = await infoNumeroMeta();
  if (!r.ok) return { ok: false, texto: r.erro };
  return { ok: true, texto: `A Meta respondeu: número ${r.numero ?? "?"}${r.nome ? `, nome “${r.nome}”` : ""}${r.qualidade ? `, qualidade ${r.qualidade}` : ""}.` };
}

/** Depois do QR (e do destravar): o servidor abriu mesmo a conexão? */
export async function conferirConexao(): Promise<{ estado: EstadoConexao | "inalcancavel"; numero: string | null }> {
  if (!(await exigirAdministracao())) return { estado: "desconhecido", numero: null };
  const c = await lerConexao();
  if (!c.ok) return { estado: "inalcancavel", numero: null };
  return { estado: c.leitura?.estado ?? "desconhecido", numero: c.leitura?.numero ?? null };
}

/**
 * Ligada ao celular mas sem conexão (21/10, depois do QR pelo painel):
 * para e liga de novo o canal no OpenClaw. Não apaga a ligação nem pede QR.
 */
export async function destravarConexao(): Promise<{ ok: boolean; texto: string }> {
  const s = await exigirSessao();
  if ((s.user as { role?: string }).role !== "master") return { ok: false, texto: semPermissao.texto };
  if ((await modoAtual()) === "oficial") return { ok: false, texto: "A Marina está usando a API oficial; o WhatsApp Web está pausado de propósito." };
  const r = await destravarCanal();
  await comSql((sql) => anotarNoHistorico(sql, r.ok ? `Destravado pelo painel (${s.user?.name || s.user?.email || "painel"})` : `Destravar pelo painel falhou: ${r.erro}`)).catch(() => {});
  atualizar();
  return r.ok
    ? { ok: true, texto: "Pedido de destravar enviado ao servidor. Conferindo a conexão…" }
    : { ok: false, texto: `Não consegui destravar: ${r.erro}. No terminal da Hostinger: openclaw gateway restart.` };
}
