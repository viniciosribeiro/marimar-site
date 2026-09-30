import Link from "next/link";
import type { Metadata } from "next";
import { comSql } from "@/lib/db-conexao";
import { SECOES_FOTO } from "@/lib/fotos";
import { tituloQuarto } from "@/lib/format";
import { GaleriaSecoes, type GrupoGaleria } from "@/components/site/GaleriaSecoes";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Galeria — Pousada Marimar, Ilha do Mel",
  description: "Fotos da pousada, das suítes, do restaurante pé na areia, do café da manhã e da praia de Encantadas.",
};

type Linha = { url: string; alt: string; secao: string; quarto_id: string | null; quarto_nome: string | null; quarto_slug: string | null };

export default async function GaleriaPage() {
  let linhas: Linha[] = [];
  try {
    linhas = await comSql((sql) => sql<Linha[]>`
      SELECT m.url, m.alt, m.secao, m.quarto_id, q.nome AS quarto_nome, q.slug AS quarto_slug
      FROM midias m
      LEFT JOIN quartos q ON q.id = m.quarto_id
      WHERE m.tipo = 'foto' AND m.secao <> 'orientacao' AND (m.quarto_id IS NULL OR q.ativo = true)
      ORDER BY q.ordem NULLS FIRST, m.destaque DESC, m.ordem, m.criado_em`);
  } catch (e) {
    console.error("[Galeria] banco indisponivel:", (e as Error).message);
  }

  /* Um grupo por seção; em "Suítes", um grupo por suíte — as fotos de uma
     suíte nunca aparecem no bloco de outra. A mesma imagem cadastrada duas
     vezes no MESMO grupo aparece uma vez só. */
  const grupos: GrupoGaleria[] = [];
  const porChave = new Map<string, GrupoGaleria>();
  for (const s of SECOES_FOTO) {
    for (const l of linhas.filter((x) => (x.quarto_id ? "quarto" : x.secao) === s.chave)) {
      const chave = l.quarto_id ? `quarto:${l.quarto_id}` : s.chave;
      let g = porChave.get(chave);
      if (!g) {
        g = l.quarto_id
          ? { secao: "quarto", titulo: tituloQuarto(l.quarto_nome), href: `/quartos/${l.quarto_slug}`, fotos: [] }
          : { secao: s.chave, titulo: s.nome, fotos: [] };
        porChave.set(chave, g);
        grupos.push(g);
      }
      if (!g.fotos.some((f) => f.url === l.url)) g.fotos.push({ url: l.url, alt: l.alt || g.titulo });
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
      <span className="text-marca font-semibold text-[0.7rem] uppercase tracking-[0.22em]">Fotos</span>
      <h1 className="font-titulo text-3xl lg:text-5xl font-bold text-tinta mt-2 mb-3">Galeria</h1>
      <p className="text-tinta-suave leading-relaxed mb-8 max-w-2xl">
        A pousada, cada suíte, o restaurante pé na areia e a Ilha do Mel. Toque numa foto para ver em tela cheia.
      </p>

      {grupos.length === 0 ? (
        <div className="bg-fundo-suave rounded-marca p-10 text-center">
          <p className="text-tinta-suave mb-4">As fotos estão sendo preparadas.</p>
          <Link href="/reservar" className="text-sm text-marca font-semibold hover:text-marca-hover">
            Consultar disponibilidade →
          </Link>
        </div>
      ) : (
        <GaleriaSecoes grupos={grupos} secoes={SECOES_FOTO.map((s) => ({ chave: s.chave, nome: s.nome }))} />
      )}
    </div>
  );
}
