"use server";

import { revalidatePath } from "next/cache";
import { exigirSessao } from "@/lib/admin-sessao";
import { comSql } from "@/lib/db-conexao";
import { mesclarRota, ROTA_PADRAO, type RotaConfig } from "@/lib/rota-base";
import { salvarRotaNoBanco } from "@/lib/rota";

export type Resultado = { ok: boolean; mensagem: string };

const dentroDoBrasil = (lat: number, lng: number) => lat > -34 && lat < 6 && lng > -74 && lng < -34;
const urlValida = (u: string) => /^https?:\/\/[^\s]+$/i.test(u);

/**
 * Salva a configuração da rota (painel → Rota e mapa). Recebe o JSON inteiro
 * no campo "config" — a tela monta o objeto com os marcadores arrastados.
 * Vale na hora em /como-chegar (página force-dynamic).
 */
export async function salvarRota(fd: FormData): Promise<Resultado> {
  await exigirSessao();
  let bruto: unknown;
  try { bruto = JSON.parse(String(fd.get("config") ?? "")); } catch { return { ok: false, mensagem: "Não entendi os dados enviados. Recarregue a página." }; }
  const c = mesclarRota(bruto);

  for (const p of [c.pousada, c.trapiche, ...c.terminais]) {
    if (!dentroDoBrasil(p.lat, p.lng)) return { ok: false, mensagem: `A posição de “${p.nome}” está fora do Brasil. Arraste o ponto no mapa de novo.` };
  }
  if (c.terminais.some((t) => !t.id || t.barcoMin < 1 || t.barcoMin > 600)) return { ok: false, mensagem: "Confira o tempo de barco de cada terminal (1 a 600 minutos)." };
  if (new Set(c.terminais.map((t) => t.id)).size !== c.terminais.length) return { ok: false, mensagem: "Dois terminais com o mesmo código." };
  for (const u of [...Object.values(c.servicos), ...c.estilos.map((e) => e.url)]) {
    if (!urlValida(u)) return { ok: false, mensagem: `Endereço de serviço inválido: ${u.slice(0, 80)}` };
  }
  const limpo: RotaConfig = {
    ...c,
    terminais: c.terminais.slice(0, 6).map((t) => ({ ...t, nome: t.nome.slice(0, 80), observacao: t.observacao?.slice(0, 300) })),
    textos: Object.fromEntries(Object.entries(c.textos).map(([k, v]) => [k, String(v).slice(0, 400)])) as RotaConfig["textos"],
    estilos: c.estilos.slice(0, 6),
  };
  if (!limpo.terminais.some((t) => t.principal)) limpo.terminais[0].principal = true;

  await comSql((sql) => salvarRotaNoBanco(sql, limpo));
  revalidatePath("/como-chegar");
  revalidatePath("/admin/rota");
  return { ok: true, mensagem: "Rota salva. Já vale em Como chegar." };
}

export async function restaurarRotaPadrao(): Promise<Resultado> {
  await exigirSessao();
  await comSql((sql) => salvarRotaNoBanco(sql, ROTA_PADRAO));
  revalidatePath("/como-chegar");
  revalidatePath("/admin/rota");
  return { ok: true, mensagem: "Voltou ao padrão de fábrica." };
}
