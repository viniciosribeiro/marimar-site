import Link from "next/link";
import { comSql } from "@/lib/db-conexao";
import { SECOES_FOTO } from "@/lib/fotos";
import { tituloQuarto } from "@/lib/format";
import { CapitulosGaleria, type Capitulo, type GrupoFotos } from "./CapitulosGaleria";
import { Migalhas } from "../DadosEstruturados";

type Linha = { url: string; alt: string; secao: string; quarto_id: string | null; quarto_nome: string | null; quarto_slug: string | null };

/**
 * /galeria no site novo. Mesmas fotos e mesma separação do Clássico (cada
 * foto na sua seção; cada suíte com as suas; a mesma imagem duas vezes no
 * mesmo grupo aparece uma vez), em capítulos curtos.
 */
export async function GaleriaNovo() {
  let linhas: Linha[] | null;
  try {
    linhas = await comSql((sql) => sql<Linha[]>`
      SELECT m.url, m.alt, m.secao, m.quarto_id, q.nome AS quarto_nome, q.slug AS quarto_slug
      FROM midias m
      LEFT JOIN quartos q ON q.id = m.quarto_id
      WHERE m.tipo = 'foto' AND m.secao <> 'orientacao' AND (m.quarto_id IS NULL OR q.ativo = true)
      ORDER BY q.ordem NULLS FIRST, m.destaque DESC, m.ordem, m.criado_em`).then((l) => [...l]);
  } catch (e) {
    console.error("[GaleriaNovo] banco indisponível:", (e as Error).message);
    linhas = null;
  }
  const capitulos = linhas ? montarCapitulos(linhas) : [];

  return (
    <div className="pb-16 lg:pb-24">
      <Migalhas trilha={[["Galeria", "/galeria"]]} />
      <div className="sn-margem mx-auto max-w-[1240px] pt-10 lg:pt-16">
        <h1 className="sn-titulo-pagina">Galeria</h1>
        <p className="mt-4 max-w-[38rem] text-[1.06rem] leading-relaxed text-sn-texto-2">
          A pousada, as suítes, o restaurante à beira-mar e Encantadas. Toque numa foto para ver em tela cheia.
        </p>
        {capitulos.length > 1 && (
          <nav aria-label="Capítulos da galeria" className="mt-7">
            <ul className="flex flex-wrap gap-2">
              {capitulos.map((c) => (
                <li key={c.chave}>
                  <a href={`#capitulo-${c.chave}`} className="inline-flex h-11 items-center rounded-full bg-white px-4 text-[0.97rem] font-medium ring-1 ring-sn-linha hover:ring-sn-texto-2">
                    {c.nome}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
      <div className="mt-12 lg:mt-16">
        {linhas === null ? (
          <Vazio texto="Não conseguimos carregar as fotos agora. Tente de novo em instantes." />
        ) : capitulos.length === 0 ? (
          <Vazio texto="As fotos estão sendo preparadas." />
        ) : (
          <CapitulosGaleria capitulos={capitulos} />
        )}
      </div>
    </div>
  );
}

function Vazio({ texto }: { texto: string }) {
  return (
    <div className="sn-margem mx-auto max-w-[1240px]">
      <div className="rounded-[18px] bg-sn-areia/60 p-8">
        <p className="text-[1.05rem]">{texto}</p>
        <Link href="/reservar" className="sn-botao mt-5">Ver datas e preços</Link>
      </div>
    </div>
  );
}

/** Um capítulo por seção, na ordem de SECOES_FOTO; em "Suítes", um grupo por suíte. */
export function montarCapitulos(linhas: Linha[]): Capitulo[] {
  const capitulos: Capitulo[] = [];
  for (const s of SECOES_FOTO) {
    const daSecao = linhas.filter((x) => (x.quarto_id ? "quarto" : x.secao) === s.chave);
    if (!daSecao.length) continue;
    if (s.chave === "quarto") {
      const porSuite = new Map<string, GrupoFotos>();
      for (const l of daSecao) {
        let g = porSuite.get(l.quarto_id!);
        if (!g) {
          g = { titulo: tituloQuarto(l.quarto_nome), href: l.quarto_slug ? `/quartos/${l.quarto_slug}` : undefined, fotos: [] };
          porSuite.set(l.quarto_id!, g);
        }
        if (!g.fotos.some((f) => f.url === l.url)) g.fotos.push({ url: l.url, alt: l.alt || g.titulo });
      }
      capitulos.push({ tipo: "suites", chave: s.chave, nome: "As suítes", suites: [...porSuite.values()] });
    } else {
      const grupo: GrupoFotos = { titulo: s.nome, fotos: [] };
      for (const l of daSecao) if (!grupo.fotos.some((f) => f.url === l.url)) grupo.fotos.push({ url: l.url, alt: l.alt || s.nome });
      capitulos.push({ tipo: "secao", chave: s.chave, nome: s.nome, grupo });
    }
  }
  return capitulos;
}
