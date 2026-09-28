"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import postgres from "postgres";
import { exigirSessao } from "@/lib/admin-sessao";

// Toda action exige sessao antes de abrir conexao (ver lib/admin-sessao.ts).
const db = async () => {
  await exigirSessao();
  return postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
};

// Fotos: ver src/app/(admin)/admin/midias/actions.ts (tela nova, com envio de arquivo e secoes).

/** Textarea "um por linha" → lista sem linhas vazias. */
const porLinha = (f: FormData, k: string) =>
  String(f.get(k) ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
/** input type=date → Date ou null. */
const dataOuNula = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "");
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(v + "T12:00:00") : null;
};
/** O site e a Marina leem pacotes: salvar precisa refletir nos dois. */
const refrescarPacotes = () => { revalidatePath("/pacotes"); revalidatePath("/"); revalidatePath("/admin/pacotes"); };

export async function criarPacote(f: FormData) {
  const nome=f.get("nome") as string; const slug=f.get("slug") as string;
  if(!nome||!slug) redirect("/admin/pacotes?erro=Nome+e+slug+obrigatorios");
  const s=await db();
  await s`INSERT INTO pacotes (nome,slug,descricao,inclusos,vigencia_inicio,vigencia_fim,diaria_minima,ordem)
    VALUES (${nome},${slug},${f.get("descricao") as string},${s.json(porLinha(f,"inclusos"))},${dataOuNula(f,"vigencia_inicio")},${dataOuNula(f,"vigencia_fim")},${parseInt(f.get("diaria_minima") as string)||1},${parseInt(f.get("ordem") as string)||0})`;
  await s.end();
  refrescarPacotes(); redirect("/admin/pacotes?ok=Pacote+criado");
}
export async function editarPacote(f: FormData) {
  const s=await db();
  await s`UPDATE pacotes SET nome=${f.get("nome") as string},slug=${f.get("slug") as string},descricao=${f.get("descricao") as string},
    inclusos=${s.json(porLinha(f,"inclusos"))},vigencia_inicio=${dataOuNula(f,"vigencia_inicio")},vigencia_fim=${dataOuNula(f,"vigencia_fim")},
    diaria_minima=${parseInt(f.get("diaria_minima") as string)||1},ordem=${parseInt(f.get("ordem") as string)||0},ativo=${f.get("ativo")==="on"}
    WHERE id=${f.get("id") as string}`;
  await s.end();
  refrescarPacotes(); redirect("/admin/pacotes?ok=Atualizado");
}
export async function excluirPacote(f: FormData) {
  const s=await db(); await s`DELETE FROM pacotes WHERE id=${f.get("id") as string}`; await s.end();
  revalidatePath("/admin/pacotes"); redirect("/admin/pacotes?ok=Excluido");
}

export async function criarPasseio(f: FormData) {
  const nome=f.get("nome") as string; if(!nome) redirect("/admin/passeios?erro=Nome+obrigatorio");
  const s=await db(); await s`INSERT INTO passeios (nome,descricao,duracao,preco_referencia,imagem_url,ordem) VALUES (${nome},${f.get("descricao") as string},${f.get("duracao") as string},${parseFloat(f.get("preco") as string)||0},${f.get("imagem_url") as string||null},${parseInt(f.get("ordem") as string)||0})`; await s.end();
  revalidatePath("/admin/passeios"); redirect("/admin/passeios?ok=Criado");
}
export async function editarPasseio(f: FormData) {
  const s=await db(); await s`UPDATE passeios SET nome=${f.get("nome") as string},descricao=${f.get("descricao") as string},duracao=${f.get("duracao") as string},preco_referencia=${parseFloat(f.get("preco") as string)||0},imagem_url=${f.get("imagem_url") as string||null},ordem=${parseInt(f.get("ordem") as string)||0},ativo=${f.get("ativo")==="on"} WHERE id=${f.get("id") as string}`; await s.end();
  revalidatePath("/admin/passeios"); redirect("/admin/passeios?ok=Atualizado");
}
export async function excluirPasseio(f: FormData) {
  const s=await db(); await s`DELETE FROM passeios WHERE id=${f.get("id") as string}`; await s.end();
  revalidatePath("/admin/passeios"); redirect("/admin/passeios?ok=Excluido");
}

/**
 * Politicas: linha unica. Se ela ainda nao existe, e criada — antes o UPDATE
 * nao achava linha nenhuma e a tela dizia "Politicas salvas" sem ter gravado.
 */
export async function salvarPoliticas(f: FormData) {
  const dados = {
    diaria_minima_padrao: parseInt(f.get("diaria_minima") as string) || 1,
    check_in: String(f.get("check_in") ?? "").trim() || "14:00",
    check_out: String(f.get("check_out") ?? "").trim() || "12:00",
    cancelamento: (f.get("cancelamento") as string) || null,
    pet: f.get("pet") === "on",
    pet_texto: (f.get("pet_texto") as string) || null,
    criancas_texto: (f.get("criancas_texto") as string) || null,
    regras_gerais: (f.get("regras_gerais") as string) || null,
  };
  const s=await db();
  const [linha] = await s`SELECT id FROM politicas LIMIT 1`;
  if (linha) {
    await s`UPDATE politicas SET ${s(dados)}, formas_pagamento=${s.json(porLinha(f,"formas_pagamento"))}, atualizado_em=now() WHERE id=${linha.id}`;
  } else {
    await s`INSERT INTO politicas ${s(dados)}`;
    await s`UPDATE politicas SET formas_pagamento=${s.json(porLinha(f,"formas_pagamento"))}`;
  }
  await s.end();
  revalidatePath("/politicas"); revalidatePath("/admin/politicas"); redirect("/admin/politicas?ok=Politicas+salvas");
}

export async function criarFaq(f: FormData) {
  const p=f.get("pergunta") as string; const r=f.get("resposta") as string;
  if(!p||!r) redirect("/admin/faq?erro=Preencha+pergunta+e+resposta");
  const s=await db(); await s`INSERT INTO faq (pergunta,resposta,ordem,ativo,visivel_agente) VALUES (${p},${r},${parseInt(f.get("ordem") as string)||0},true,${f.get("visivel_agente")==="on"})`; await s.end();
  revalidatePath("/faq"); revalidatePath("/admin/faq"); redirect("/admin/faq?ok=FAQ+criada");
}
export async function editarFaq(f: FormData) {
  const s=await db(); await s`UPDATE faq SET pergunta=${f.get("pergunta") as string},resposta=${f.get("resposta") as string},ordem=${parseInt(f.get("ordem") as string)||0},visivel_agente=${f.get("visivel_agente")==="on"},ativo=${f.get("ativo")==="on"} WHERE id=${f.get("id") as string}`; await s.end();
  revalidatePath("/faq"); revalidatePath("/admin/faq"); redirect("/admin/faq?ok=Atualizada");
}
export async function excluirFaq(f: FormData) {
  const s=await db(); await s`DELETE FROM faq WHERE id=${f.get("id") as string}`; await s.end();
  revalidatePath("/admin/faq"); redirect("/admin/faq?ok=Excluida");
}

export async function criarDepoimento(f: FormData) {
  const a=f.get("autor") as string; const t=f.get("texto") as string;
  if(!a||!t) redirect("/admin/depoimentos?erro=Preencha+autor+e+texto");
  const s=await db(); await s`INSERT INTO depoimentos (autor,origem,nota,texto,ordem) VALUES (${a},${f.get("origem") as string},${parseInt(f.get("nota") as string)||5},${t},${parseInt(f.get("ordem") as string)||0})`; await s.end();
  revalidatePath("/admin/depoimentos"); redirect("/admin/depoimentos?ok=Criado");
}
export async function editarDepoimento(f: FormData) {
  const s=await db(); await s`UPDATE depoimentos SET autor=${f.get("autor") as string},origem=${f.get("origem") as string},nota=${parseInt(f.get("nota") as string)||5},texto=${f.get("texto") as string},ordem=${parseInt(f.get("ordem") as string)||0},ativo=${f.get("ativo")==="on"} WHERE id=${f.get("id") as string}`; await s.end();
  revalidatePath("/admin/depoimentos"); redirect("/admin/depoimentos?ok=Atualizado");
}
export async function excluirDepoimento(f: FormData) {
  const s=await db(); await s`DELETE FROM depoimentos WHERE id=${f.get("id") as string}`; await s.end();
  revalidatePath("/admin/depoimentos"); redirect("/admin/depoimentos?ok=Excluido");
}

export async function marcarLido(f: FormData) {
  const s=await db(); await s`UPDATE leads SET lido = NOT lido WHERE id=${f.get("id") as string}`; await s.end();
  revalidatePath("/admin/leads"); redirect("/admin/leads");
}

export async function salvarIdentidadeVisual(f: FormData) {
  const s=await db(); await s`UPDATE pousada SET cor_primaria=${f.get("cor_primaria") as string},cor_secundaria=${f.get("cor_secundaria") as string},logo_url=${f.get("logo_url") as string},favicon_url=${f.get("favicon_url") as string},seo_title=${f.get("seo_title") as string},seo_description=${f.get("seo_description") as string} WHERE id=(SELECT id FROM pousada LIMIT 1)`; await s.end();
  revalidatePath("/admin/identidade-visual"); redirect("/admin/identidade-visual?ok=Salvo");
}

export async function alternarBloco(f: FormData) {
  const s=await db(); await s`UPDATE blocos_home SET ativo = NOT ativo WHERE id=${f.get("id") as string}`; await s.end();
  revalidatePath("/admin/blocos-home"); redirect("/admin/blocos-home");
}
export async function salvarBloco(f: FormData) {
  const s=await db(); await s`UPDATE blocos_home SET titulo=${f.get("titulo") as string}, subtitulo=${f.get("subtitulo") as string}, imagem_url=${f.get("imagem_url") as string} WHERE id=${f.get("id") as string}`; await s.end();
  revalidatePath("/admin/blocos-home"); redirect("/admin/blocos-home?ok=Bloco+salvo");
}