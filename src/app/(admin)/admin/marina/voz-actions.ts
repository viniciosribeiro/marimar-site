"use server";

import { revalidatePath } from "next/cache";
import { exigirSessao } from "@/lib/admin-sessao";
import { comSql } from "@/lib/db-conexao";
import { podeCifrar, finalDaChave } from "@/lib/cifra-chaves";
import { PROVEDORES_VOZ, conectadoA, oProvedor, opcoesDeCampos, type Provedor } from "@/lib/voz-base";
import {
  aplicarVozNoWhatsapp, apagarChave, chaveDoProvedor, conferirVozNoWhatsapp, guardarChave, gravarOpcoesVoz,
  lerOpcoesVoz, listarVozesEleven, testarChave, type Conferencia, type VozConta,
} from "@/lib/voz";

/**
 * A voz da Marina pelo painel (docs/voz-marina.md). Salvar grava para o
 * site e leva a MESMA voz ao WhatsApp (OpenClaw), conferindo no servidor.
 * Conectar uma chave é só do perfil Administração.
 */

export type RespostaVoz = { ok: boolean; mensagem: string; conferencia?: Conferencia };

const atualizar = () => revalidatePath("/admin/marina");
const provedorValido = (p: unknown): p is Provedor => PROVEDORES_VOZ.includes(p as Provedor);

async function exigirAdministracao() {
  const s = await exigirSessao();
  return (s.user as { role?: string }).role === "master";
}

function explicar(c: Conferencia, salvo: string): RespostaVoz {
  if (c.igual) return { ok: true, mensagem: `${salvo} Site e WhatsApp com a mesma voz (conferido no servidor da Marina). O WhatsApp reconecta sozinho em alguns segundos.`, conferencia: c };
  if (!c.alcancou) return { ok: false, mensagem: `${salvo} Mas não consegui falar com o servidor da Marina (${c.erro}); o WhatsApp segue com a voz antiga. Use “Levar ao WhatsApp de novo” depois.`, conferencia: c };
  if (c.erro) return { ok: false, mensagem: `${salvo} Mas o servidor da Marina recusou a voz: ${c.erro}`, conferencia: c };
  return { ok: false, mensagem: `${salvo} Mas o WhatsApp ainda difere: ${c.diferencas.join("; ")}.`, conferencia: c };
}

export async function salvarVoz(fd: FormData): Promise<RespostaVoz> {
  await exigirSessao();
  const o = opcoesDeCampos((k) => fd.get(k));
  if (o.provedor === "elevenlabs" && !o.elevenlabs.voz) return { ok: false, mensagem: "Escolha uma voz da ElevenLabs (ou cole o ID)." };
  const { chave } = await comSql((sql) => chaveDoProvedor(sql, o.provedor));
  if (!chave) return { ok: false, mensagem: `Conecte ${oProvedor(o.provedor)} antes de usar essas vozes.` };
  await comSql((sql) => gravarOpcoesVoz(sql, o));
  atualizar();
  return explicar(await aplicarVozNoWhatsapp(o, chave), "Voz salva no site.");
}

/** Só lê o servidor da Marina e compara com a voz do site. */
export async function conferirVoz(): Promise<RespostaVoz> {
  await exigirSessao();
  const o = await comSql(lerOpcoesVoz);
  const c = await conferirVozNoWhatsapp(o);
  if (c.igual) return { ok: true, mensagem: "O WhatsApp está com a mesma voz do site.", conferencia: c };
  if (!c.alcancou) return { ok: false, mensagem: `Não consegui ler o servidor da Marina: ${c.erro}`, conferencia: c };
  return { ok: false, mensagem: `O WhatsApp está diferente: ${c.diferencas.join("; ")}.`, conferencia: c };
}

/** Leva de novo a voz gravada ao WhatsApp (depois de o servidor voltar, por exemplo). */
export async function reaplicarVoz(): Promise<RespostaVoz> {
  await exigirSessao();
  const { o, chave } = await comSql(async (sql) => {
    const o = await lerOpcoesVoz(sql);
    return { o, chave: (await chaveDoProvedor(sql, o.provedor)).chave };
  });
  if (!chave) return { ok: false, mensagem: `Falta conectar ${oProvedor(o.provedor)}.` };
  return explicar(await aplicarVozNoWhatsapp(o, chave), "");
}

export async function conectarProvedor(provedor: string, chaveColada: string): Promise<RespostaVoz> {
  if (!(await exigirAdministracao())) return { ok: false, mensagem: "Só quem tem acesso de Administração conecta uma conta de voz." };
  if (!provedorValido(provedor)) return { ok: false, mensagem: "Provedor desconhecido." };
  const chave = String(chaveColada ?? "").trim();
  if (chave.length < 20 || chave.length > 400 || /\s/.test(chave)) return { ok: false, mensagem: "Isso não parece uma chave. Copie a chave inteira, sem espaços." };
  if (!podeCifrar()) return { ok: false, mensagem: "O site está sem AUTH_SECRET na Vercel; sem ela o painel não guarda chaves." };
  const teste = await testarChave(provedor, chave);
  if (!teste.ok) return { ok: false, mensagem: teste.erro };
  const o = await comSql(async (sql) => { await guardarChave(sql, provedor, chave); return lerOpcoesVoz(sql); });
  atualizar();
  const feito = `${conectadoA(provedor)} (chave ${finalDaChave(chave)}).`;
  /* Já é o provedor em uso: o WhatsApp passa a usar a chave nova agora. */
  if (o.provedor === provedor && (await comSql((sql) => chaveDoProvedor(sql, provedor))).origem === "painel") {
    return explicar(await aplicarVozNoWhatsapp(o, chave), feito);
  }
  return { ok: true, mensagem: `${feito} Agora escolha uma voz e salve.` };
}

export async function desconectarProvedor(provedor: string): Promise<RespostaVoz> {
  if (!(await exigirAdministracao())) return { ok: false, mensagem: "Só quem tem acesso de Administração desconecta uma conta de voz." };
  if (!provedorValido(provedor)) return { ok: false, mensagem: "Provedor desconhecido." };
  const o = await comSql(lerOpcoesVoz);
  if (o.provedor === provedor) return { ok: false, mensagem: `A Marina está falando com ${oProvedor(provedor)}. Escolha e salve outra voz antes de desconectar.` };
  await comSql((sql) => apagarChave(sql, provedor));
  atualizar();
  return { ok: true, mensagem: `${conectadoA(provedor).replace(/conectad/, "desconectad")} do painel.` };
}

/** As vozes da conta ElevenLabs conectada (inclui as clonadas). */
export async function vozesDaConta(): Promise<{ ok: true; vozes: VozConta[] } | { ok: false; erro: string }> {
  await exigirSessao();
  const { chave } = await comSql((sql) => chaveDoProvedor(sql, "elevenlabs"));
  if (!chave) return { ok: false, erro: "Conecte a ElevenLabs para ver as vozes da conta." };
  return listarVozesEleven(chave);
}
