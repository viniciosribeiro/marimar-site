"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import postgres from "postgres";
const db = () => postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });

export async function criarMidia(f: FormData) {
  const url=f.get("url") as string; const alt=f.get("alt") as string; const quarto=f.get("quarto_id") as string;
  if(!url||!alt) redirect("/admin/midias?erro=URL+e+alt+obrigatorios");
  const s=db(); await s`INSERT INTO midias (url, alt, quarto_id) VALUES (${url},${alt},${quarto||null})`; await s.end();
  revalidatePath("/admin/midias"); redirect("/admin/midias?ok=Midia+criada");
}
export async function excluirMidia(f: FormData) {
  const s=db(); await s`DELETE FROM midias WHERE id=${f.get("id") as string}`; await s.end();
  revalidatePath("/admin/midias"); redirect("/admin/midias?ok=Excluida");
}

export async function criarPacote(f: FormData) {
  const nome=f.get("nome") as string; const slug=f.get("slug") as string;
  if(!nome||!slug) redirect("/admin/pacotes?erro=Nome+e+slug+obrigatorios");
  const s=db(); await s`INSERT INTO pacotes (nome,slug,descricao,diaria_minima,ordem) VALUES (${nome},${slug},${f.get("descricao") as string},${parseInt(f.get("diaria_minima") as string)||1},${parseInt(f.get("ordem") as string)||0})`; await s.end();
  revalidatePath("/admin/pacotes"); redirect("/admin/pacotes?ok=Pacote+criado");
}
export async function editarPacote(f: FormData) {
  const s=db(); await s`UPDATE pacotes SET nome=${f.get("nome") as string},slug=${f.get("slug") as string},descricao=${f.get("descricao") as string},diaria_minima=${parseInt(f.get("diaria_minima") as string)||1},ordem=${parseInt(f.get("ordem") as string)||0},ativo=${f.get("ativo")==="on"} WHERE id=${f.get("id") as string}`; await s.end();
  revalidatePath("/admin/pacotes"); redirect("/admin/pacotes?ok=Atualizado");
}
export async function excluirPacote(f: FormData) {
  const s=db(); await s`DELETE FROM pacotes WHERE id=${f.get("id") as string}`; await s.end();
  revalidatePath("/admin/pacotes"); redirect("/admin/pacotes?ok=Excluido");
}

export async function criarPasseio(f: FormData) {
  const nome=f.get("nome") as string; if(!nome) redirect("/admin/passeios?erro=Nome+obrigatorio");
  const s=db(); await s`INSERT INTO passeios (nome,descricao,duracao,preco_referencia,imagem_url,ordem) VALUES (${nome},${f.get("descricao") as string},${f.get("duracao") as string},${parseFloat(f.get("preco") as string)||0},${f.get("imagem_url") as string||null},${parseInt(f.get("ordem") as string)||0})`; await s.end();
  revalidatePath("/admin/passeios"); redirect("/admin/passeios?ok=Criado");
}
export async function editarPasseio(f: FormData) {
  const s=db(); await s`UPDATE passeios SET nome=${f.get("nome") as string},descricao=${f.get("descricao") as string},duracao=${f.get("duracao") as string},preco_referencia=${parseFloat(f.get("preco") as string)||0},imagem_url=${f.get("imagem_url") as string||null},ordem=${parseInt(f.get("ordem") as string)||0},ativo=${f.get("ativo")==="on"} WHERE id=${f.get("id") as string}`; await s.end();
  revalidatePath("/admin/passeios"); redirect("/admin/passeios?ok=Atualizado");
}
export async function excluirPasseio(f: FormData) {
  const s=db(); await s`DELETE FROM passeios WHERE id=${f.get("id") as string}`; await s.end();
  revalidatePath("/admin/passeios"); redirect("/admin/passeios?ok=Excluido");
}

export async function salvarPoliticas(f: FormData) {
  const s=db(); await s`UPDATE politicas SET diaria_minima_padrao=${parseInt(f.get("diaria_minima") as string)||1},check_in=${f.get("check_in") as string},check_out=${f.get("check_out") as string},cancelamento=${f.get("cancelamento") as string},pet=${f.get("pet")==="on"},pet_texto=${f.get("pet_texto") as string},regras_gerais=${f.get("regras_gerais") as string} WHERE id=${f.get("id") as string}`; await s.end();
  revalidatePath("/admin/politicas"); redirect("/admin/politicas?ok=Politicas+salvas");
}

export async function criarFaq(f: FormData) {
  const p=f.get("pergunta") as string; const r=f.get("resposta") as string;
  if(!p||!r) redirect("/admin/faq?erro=Preencha+pergunta+e+resposta");
  const s=db(); await s`INSERT INTO faq (pergunta,resposta,ordem,ativo,visivel_agente) VALUES (${p},${r},${parseInt(f.get("ordem") as string)||0},true,${f.get("visivel_agente")==="on"})`; await s.end();
  revalidatePath("/admin/faq"); redirect("/admin/faq?ok=FAQ+criada");
}
export async function editarFaq(f: FormData) {
  const s=db(); await s`UPDATE faq SET pergunta=${f.get("pergunta") as string},resposta=${f.get("resposta") as string},ordem=${parseInt(f.get("ordem") as string)||0},visivel_agente=${f.get("visivel_agente")==="on"},ativo=${f.get("ativo")==="on"} WHERE id=${f.get("id") as string}`; await s.end();
  revalidatePath("/admin/faq"); redirect("/admin/faq?ok=Atualizada");
}
export async function excluirFaq(f: FormData) {
  const s=db(); await s`DELETE FROM faq WHERE id=${f.get("id") as string}`; await s.end();
  revalidatePath("/admin/faq"); redirect("/admin/faq?ok=Excluida");
}

export async function criarDepoimento(f: FormData) {
  const a=f.get("autor") as string; const t=f.get("texto") as string;
  if(!a||!t) redirect("/admin/depoimentos?erro=Preencha+autor+e+texto");
  const s=db(); await s`INSERT INTO depoimentos (autor,origem,nota,texto,ordem) VALUES (${a},${f.get("origem") as string},${parseInt(f.get("nota") as string)||5},${t},${parseInt(f.get("ordem") as string)||0})`; await s.end();
  revalidatePath("/admin/depoimentos"); redirect("/admin/depoimentos?ok=Criado");
}
export async function editarDepoimento(f: FormData) {
  const s=db(); await s`UPDATE depoimentos SET autor=${f.get("autor") as string},origem=${f.get("origem") as string},nota=${parseInt(f.get("nota") as string)||5},texto=${f.get("texto") as string},ordem=${parseInt(f.get("ordem") as string)||0},ativo=${f.get("ativo")==="on"} WHERE id=${f.get("id") as string}`; await s.end();
  revalidatePath("/admin/depoimentos"); redirect("/admin/depoimentos?ok=Atualizado");
}
export async function excluirDepoimento(f: FormData) {
  const s=db(); await s`DELETE FROM depoimentos WHERE id=${f.get("id") as string}`; await s.end();
  revalidatePath("/admin/depoimentos"); redirect("/admin/depoimentos?ok=Excluido");
}

export async function marcarLido(f: FormData) {
  const s=db(); await s`UPDATE leads SET lido = NOT lido WHERE id=${f.get("id") as string}`; await s.end();
  revalidatePath("/admin/leads"); redirect("/admin/leads");
}

export async function salvarIdentidadeVisual(f: FormData) {
  const s=db(); await s`UPDATE pousada SET cor_primaria=${f.get("cor_primaria") as string},cor_secundaria=${f.get("cor_secundaria") as string},logo_url=${f.get("logo_url") as string},favicon_url=${f.get("favicon_url") as string},seo_title=${f.get("seo_title") as string},seo_description=${f.get("seo_description") as string} WHERE id=(SELECT id FROM pousada LIMIT 1)`; await s.end();
  revalidatePath("/admin/identidade-visual"); redirect("/admin/identidade-visual?ok=Salvo");
}

export async function alternarBloco(f: FormData) {
  const s=db(); await s`UPDATE blocos_home SET ativo = NOT ativo WHERE id=${f.get("id") as string}`; await s.end();
  revalidatePath("/admin/blocos-home"); redirect("/admin/blocos-home");
}
export async function salvarBloco(f: FormData) {
  const s=db(); await s`UPDATE blocos_home SET titulo=${f.get("titulo") as string}, subtitulo=${f.get("subtitulo") as string}, imagem_url=${f.get("imagem_url") as string} WHERE id=${f.get("id") as string}`; await s.end();
  revalidatePath("/admin/blocos-home"); redirect("/admin/blocos-home?ok=Bloco+salvo");
}