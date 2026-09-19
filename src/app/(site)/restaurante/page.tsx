import postgres from "postgres";
import type { Metadata } from "next";
import Image from "next/image";
import { Cardapio } from "@/components/site/Cardapio";
import {
  RESTAURANTE, CAFE_DA_MANHA, COMPLEXO, CONTATO, ENDERECO, POLITICAS,
} from "@/lib/conteudo-pousada";
import {
  Hero, Secao, Onda, TituloSecao, Subtexto, Manuscrita, Aviso, Botao, Selo,
} from "@/components/site/ui";
import type { CategoriaCardapio } from "@/lib/cardapio";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Marimar Café Bistrô Bar — restaurante pé na areia em Encantadas",
  description:
    "Restaurante da Pousada Marimar, pé na areia de frente para a Praia de Encantadas. Cardápio, café da manhã incluso e reserva de mesa.",
};

/**
 * Restaurante e cardapio numa pagina so.
 *
 * Eram duas rotas (/restaurante e /cardapio) dizendo a mesma coisa para o
 * hospede — ele nao pensa "vou ver o restaurante e depois ver o cardapio".
 * O cafe da manha era uma terceira, ainda mais fina, falando do mesmo lugar.
 * As rotas antigas continuam valendo como redirecionamento (ver
 * next.config.ts) para nao quebrar link, QR code ou busca ja indexada.
 */
export default async function RestaurantePage() {
  let categorias: CategoriaCardapio[] = [];
  let capa: string | null = null;
  let fotoCafe: string | null = null;

  try {
    const sql = postgres(process.env.DATABASE_URL!, { max: 1, connect_timeout: 5, prepare: false });

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
        ORDER BY c.ordem, c.nome
      `;
      categorias = (linhas as any[]).filter((c) => c.itens.length > 0) as CategoriaCardapio[];
    } catch (e) {
      // Cardapio ainda nao migrado: o resto da pagina continua de pe
      console.error("[Restaurante] cardapio indisponivel:", (e as Error).message);
    }

    const [f1] = await sql`
      SELECT url FROM midias WHERE quarto_id IS NULL AND alt ILIKE '%Marimar Café Bistrô Bar%'
      ORDER BY largura DESC NULLS LAST LIMIT 1
    `;
    capa = (f1 as any)?.url ?? null;

    const [f2] = await sql`
      SELECT url FROM midias WHERE quarto_id IS NULL AND alt ILIKE '%café da manhã%'
      ORDER BY largura DESC NULLS LAST LIMIT 1
    `;
    fotoCafe = (f2 as any)?.url ?? null;

    await sql.end();
  } catch (e) {
    console.error("[Restaurante] banco indisponivel:", (e as Error).message);
  }

  const semCardapio = categorias.length === 0;

  return (
    <div>
      <Hero
        imagem={capa}
        alt={RESTAURANTE.nome}
        rotulo="Gastronomia"
        titulo={RESTAURANTE.nome}
        texto={RESTAURANTE.posicao}
        manuscrita={"Pé na areia,\nde frente pro mar"}
        atributos={[
          { icone: "🐟", texto: "Peixes e frutos do mar" },
          { icone: "🍹", texto: "Drinks e bebidas" },
          { icone: "☕", texto: `Café da manhã ${CAFE_DA_MANHA.horario}` },
        ]}
      >
        <div className="flex flex-wrap gap-3 mt-7">
          <Botao href="#cardapio" icone="📖">Ver o cardápio</Botao>
          <Botao
            href={`https://wa.me/${CONTATO.whatsappDigitos}?text=${encodeURIComponent("Olá! Gostaria de reservar uma mesa no Marimar Café Bistrô Bar.")}`}
            icone="💬" variante="contorno" externo
          >
            Reservar mesa
          </Botao>
        </div>
      </Hero>

      {/* ═══ ONDE FICA ═══ */}
      <Secao fundo="branco">
        <div className="bg-areia border border-linha rounded-marca p-6 lg:p-7 relative">
          <div className="lg:pr-44">
            <p className="text-tinta leading-relaxed mb-3">{COMPLEXO.fraseLonga}</p>
            <p className="text-sm text-tinta-suave leading-relaxed">
              {ENDERECO.completo} · Plus Code {ENDERECO.plusCode}
            </p>
            <div className="flex flex-wrap gap-3 mt-5">
              <Botao href="/como-chegar" icone="📍" variante="contorno">Como chegar</Botao>
            </div>
          </div>
          <Manuscrita className="absolute right-6 bottom-6 -rotate-3 text-right max-w-[13rem]">
            Restaurante na frente,<br />pousada aos fundos
          </Manuscrita>
        </div>
      </Secao>

      {/* ═══ CAFÉ DA MANHÃ ═══ */}
      <Secao fundo="suave">
        <TituloSecao id="cafe-da-manha">Café da manhã</TituloSecao>
        <Subtexto className="text-sm mt-2 mb-7 max-w-2xl">
          Incluso na diária de quem se hospeda. {CAFE_DA_MANHA.estilo}, servido todos os
          dias das <strong className="text-tinta">{CAFE_DA_MANHA.horario}</strong>, aqui
          mesmo no restaurante.
        </Subtexto>

        <div className="grid lg:grid-cols-[minmax(0,20rem)_1fr] gap-6 items-start">
          {fotoCafe ? (
            <div className="relative h-52 rounded-marca overflow-hidden">
              <Image src={fotoCafe} alt="Café da manhã da Pousada Marimar" fill
                sizes="(max-width: 1024px) 100vw, 20rem" className="object-cover" />
            </div>
          ) : (
            <div className="h-52 rounded-marca bg-areia-forte flex items-center justify-center text-4xl">☕</div>
          )}

          <div>
            <div className="flex flex-wrap gap-2 mb-5">
              {CAFE_DA_MANHA.itens.map((i) => <Selo key={i}>{i}</Selo>)}
            </div>
            <p className="text-sm text-tinta-suave leading-relaxed">
              O check-out é até as <strong className="text-tinta">{POLITICAS.checkOut}</strong>,
              então dá tempo de tomar café com calma antes de sair. Se a sua travessia for
              cedo, avise a recepção na véspera.
            </p>
          </div>
        </div>
      </Secao>

      {/* ═══ CARDÁPIO ═══ */}
      <Secao fundo="branco">
        <TituloSecao id="cardapio">Cardápio</TituloSecao>

        {semCardapio ? (
          <div className="max-w-2xl mx-auto text-center py-10">
            <p className="text-5xl mb-5" aria-hidden>🍽️</p>
            <h3 className="font-titulo text-xl font-bold text-tinta mb-3">Cardápio em montagem</h3>
            <p className="text-tinta-suave leading-relaxed mb-5">
              Estamos organizando o cardápio completo aqui no site. Enquanto isso, fale com
              a gente que passamos os pratos do dia e os valores atualizados.
            </p>
            <p className="text-sm text-tinta-suave mb-7">{RESTAURANTE.cardapioResumo}</p>
            <Botao href={`https://wa.me/${CONTATO.whatsappDigitos}`} icone="💬" externo>
              Perguntar no WhatsApp
            </Botao>
          </div>
        ) : (
          <div className="mt-7">
            <Cardapio categorias={categorias} />
          </div>
        )}
      </Secao>

      {/* ═══ AVISOS + CTA ═══ */}
      <Secao fundo="suave">
        <div className="space-y-4">
          <Aviso titulo="Antes de vir" tom="info">
            Os valores podem mudar conforme a temporada e a disponibilidade do pescado.
            {" "}{RESTAURANTE.avisoPendente}
          </Aviso>

          <div className="bg-white border border-linha rounded-marca p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-tinta mb-1">Quer garantir mesa?</p>
              <p className="text-sm text-tinta-suave">Em alta temporada, vale avisar antes.</p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Botao
                href={`https://wa.me/${CONTATO.whatsappDigitos}?text=${encodeURIComponent("Olá! Gostaria de reservar uma mesa no Marimar Café Bistrô Bar.")}`}
                icone="💬" externo variante="contorno"
              >
                Reservar mesa
              </Botao>
              <Botao href="/reservar" icone="🗓">Consultar hospedagem</Botao>
            </div>
          </div>
        </div>
      </Secao>

      <Onda />
    </div>
  );
}
