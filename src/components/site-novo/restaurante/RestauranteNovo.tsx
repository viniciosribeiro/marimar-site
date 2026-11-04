import Image from "next/image";
import Link from "next/link";
import { comSql } from "@/lib/db-conexao";
import { lerContato } from "@/lib/pousada";
import { Cardapio } from "@/components/site/Cardapio";
import { CAFE_DA_MANHA, ENDERECO, POLITICAS, RESTAURANTE } from "@/lib/conteudo-pousada";
import type { CategoriaCardapio } from "@/lib/cardapio";

/**
 * /restaurante no site novo: o Marimar Café Bistrô Bar, o café da manhã e o
 * cardápio do painel (a mesma vitrine do Clássico, com busca e filtros).
 * Mesmos dados e mesmas consultas do Clássico; sem cardápio publicado, a
 * página explica e oferece o WhatsApp — nunca uma seção vazia.
 */
async function lerDados() {
  try {
    return await comSql(async (sql) => {
      let categorias: CategoriaCardapio[] = [];
      try {
        const linhas = await sql`
          SELECT
            c.id, c.nome, c.slug, c.descricao, c.icone, c.horario,
            COALESCE(
              json_agg(
                json_build_object(
                  'id', i.id, 'nome', i.nome, 'descricao', i.descricao,
                  'preco', i.preco, 'preco_promocional', i.preco_promocional,
                  'porcao', i.porcao, 'foto_url', i.foto_url,
                  'marcadores', i.marcadores, 'destaque', i.destaque,
                  'disponivel', i.disponivel,
                  'fotos', COALESCE((
                    SELECT json_agg(json_build_object('url', f.url, 'alt', f.alt)
                           ORDER BY f.capa DESC, f.ordem, f.criado_em)
                    FROM cardapio_fotos f WHERE f.item_id = i.id
                  ), '[]')
                ) ORDER BY i.destaque DESC, i.ordem, i.nome
              ) FILTER (WHERE i.id IS NOT NULL),
              '[]'
            ) AS itens
          FROM cardapio_categorias c
          LEFT JOIN cardapio_itens i ON i.categoria_id = c.id AND i.ativo = true
          WHERE c.ativo = true
          GROUP BY c.id
          ORDER BY c.ordem, c.nome`;
        categorias = (linhas as unknown as CategoriaCardapio[]).filter((c) => c.itens.length > 0);
      } catch (e) {
        console.error("[RestauranteNovo] cardápio indisponível:", (e as Error).message);
      }
      const [capa] = await sql<{ url: string; alt: string | null }[]>`
        SELECT url, alt FROM midias
        WHERE quarto_id IS NULL AND tipo = 'foto' AND (secao = 'restaurante' OR alt ILIKE '%Marimar Café Bistrô Bar%')
        ORDER BY (secao = 'restaurante') DESC, destaque DESC, ordem, largura DESC NULLS LAST LIMIT 1`;
      const [cafe] = await sql<{ url: string; alt: string | null }[]>`
        SELECT url, alt FROM midias
        WHERE quarto_id IS NULL AND tipo = 'foto' AND (secao = 'cafe' OR alt ILIKE '%café da manhã%')
        ORDER BY (secao = 'cafe') DESC, destaque DESC, ordem, largura DESC NULLS LAST LIMIT 1`;
      return { categorias, capa: capa ?? null, cafe: cafe ?? null };
    });
  } catch (e) {
    console.error("[RestauranteNovo] banco indisponível:", (e as Error).message);
    return { categorias: [] as CategoriaCardapio[], capa: null, cafe: null };
  }
}

export async function RestauranteNovo() {
  const [d, contato] = await Promise.all([lerDados(), lerContato()]);
  const wa = contato.whatsappDigitos;
  const mesa = wa ? `https://wa.me/${wa}?text=${encodeURIComponent("Olá! Gostaria de reservar uma mesa no Marimar Café Bistrô Bar.")}` : null;
  const itensCafe = CAFE_DA_MANHA.itens.map((i) => i.toLowerCase());
  const listaCafe = `${itensCafe.slice(0, -1).join(", ")} e ${itensCafe[itensCafe.length - 1]}`;

  return (
    <div>
      {/* ── o restaurante ───────────────────────────────────────────── */}
      <section aria-labelledby="sn-restaurante" className="mx-auto grid max-w-[1240px] gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center lg:gap-16 lg:px-10 lg:pt-14">
        <div className="relative aspect-[4/3] overflow-hidden bg-sn-areia lg:order-2 lg:aspect-[5/4] lg:rounded-[18px]">
          {d.capa && <Image src={d.capa.url} alt={d.capa.alt || RESTAURANTE.nome} fill preload sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />}
        </div>
        <div className="sn-margem lg:px-0">
          <h1 id="sn-restaurante" className="sn-titulo-pagina">{RESTAURANTE.nome}</h1>
          <p className="mt-4 max-w-[34rem] text-[1.08rem] leading-relaxed text-sn-texto-2">{RESTAURANTE.posicao}</p>
          <p className="mt-3 max-w-[34rem] leading-relaxed">{RESTAURANTE.cardapioResumo}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="#cardapio" className="sn-botao">Ver o cardápio</a>
            {mesa && <a href={mesa} target="_blank" rel="noopener noreferrer" className="sn-botao-linha">Reservar mesa</a>}
          </div>
        </div>
      </section>

      {/* ── café da manhã ───────────────────────────────────────────── */}
      {/* Sem foto do café no painel (Fotos e vídeos → Café da manhã), só o texto: nada de caixa vazia. */}
      <section id="cafe-da-manha" aria-labelledby="sn-cafe" className={`sn-margem mx-auto mt-20 grid max-w-[1240px] scroll-mt-[calc(var(--sn-topo)+1rem)] gap-8 lg:mt-28 lg:items-center lg:gap-16 ${d.cafe ? "lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]" : ""}`}>
        {d.cafe && (
          <div className="relative aspect-[4/3] overflow-hidden rounded-[18px] bg-sn-areia">
            <Image src={d.cafe.url} alt={d.cafe.alt || "Café da manhã da Pousada Marimar"} fill sizes="(min-width: 1024px) 45vw, 100vw" className="object-cover" />
          </div>
        )}
        <div>
          <h2 id="sn-cafe" className="sn-h2">Café da manhã</h2>
          <p className="mt-4 max-w-[34rem] text-[1.04rem] leading-relaxed">
            Incluso na diária de quem se hospeda. {CAFE_DA_MANHA.estilo}, servido todos os dias das{" "}
            <strong className="font-semibold">{CAFE_DA_MANHA.horario}</strong>, aqui mesmo no restaurante: {listaCafe}.
          </p>
          <p className="mt-3 max-w-[34rem] leading-relaxed text-sn-texto-2">
            O check-out é até as {POLITICAS.checkOut}, então dá tempo de tomar café com calma antes de sair. Se a sua
            travessia for cedo, avise a recepção na véspera.
          </p>
        </div>
      </section>

      {/* ── cardápio ────────────────────────────────────────────────── */}
      <section id="cardapio" aria-labelledby="sn-cardapio" className="sn-margem mx-auto mt-20 max-w-[1240px] scroll-mt-[calc(var(--sn-topo)+1rem)] lg:mt-28">
        <h2 id="sn-cardapio" className="sn-h2">Cardápio</h2>
        {d.categorias.length === 0 ? (
          <div className="mt-6 max-w-[44rem] rounded-[18px] bg-sn-areia/60 p-6 sm:p-8">
            <p className="text-[1.05rem] leading-relaxed">
              O cardápio completo ainda está sendo montado aqui no site. Pergunte os pratos do dia e os valores
              atualizados no WhatsApp.
            </p>
            <p className="mt-2 text-sn-texto-2">{RESTAURANTE.cardapioResumo}</p>
            {wa && <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="sn-botao mt-5">Perguntar no WhatsApp</a>}
          </div>
        ) : (
          <div className="sn-cardapio mt-6">
            <Cardapio categorias={d.categorias} />
          </div>
        )}
        <p className="mt-8 max-w-[44rem] text-[0.95rem] leading-relaxed text-sn-texto-2">
          Os valores podem mudar conforme a temporada e a disponibilidade do pescado. {RESTAURANTE.avisoPendente}
        </p>
      </section>

      {/* ── onde fica e mesa ────────────────────────────────────────── */}
      <section aria-labelledby="sn-mesa" className="mt-20 bg-sn-areia/60 lg:mt-28">
        <div className="sn-margem mx-auto grid max-w-[1240px] gap-6 py-14 lg:grid-cols-[1fr_auto] lg:items-center lg:py-16">
          <div className="max-w-[38rem]">
            <h2 id="sn-mesa" className="sn-h2">Quer garantir mesa?</h2>
            <p className="mt-3 leading-relaxed text-sn-texto-2">
              Em alta temporada, vale avisar antes. O restaurante fica na própria pousada, de frente para o mar: {ENDERECO.completo}.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {mesa && <a href={mesa} target="_blank" rel="noopener noreferrer" className="sn-botao">Reservar mesa</a>}
            <Link href="/como-chegar" className="sn-botao-linha">Como chegar</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
