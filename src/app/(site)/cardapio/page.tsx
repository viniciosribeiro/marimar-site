import postgres from "postgres";
import type { Metadata } from "next";
import { Cardapio } from "@/components/site/Cardapio";
import { RESTAURANTE, CAFE_DA_MANHA, CONTATO, COMPLEXO } from "@/lib/conteudo-pousada";
import { Hero, Secao, Onda, Botao, Aviso, Manuscrita } from "@/components/site/ui";
import type { CategoriaCardapio } from "@/lib/cardapio";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cardápio — Marimar Café Bistrô Bar, Ilha do Mel",
  description: "Peixes, camarões, saladas, drinks e bebidas no restaurante pé na areia da Pousada Marimar, em Encantadas.",
};

export default async function CardapioPage() {
  let categorias: CategoriaCardapio[] = [];
  let capa: string | null = null;

  try {
    const sql = postgres(process.env.DATABASE_URL!, { max: 1, connect_timeout: 5, prepare: false });

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

    const [foto] = await sql`
      SELECT url FROM midias WHERE quarto_id IS NULL AND alt ILIKE '%Marimar Café Bistrô Bar%'
      ORDER BY largura DESC NULLS LAST LIMIT 1
    `;
    capa = (foto as any)?.url ?? null;

    await sql.end();
  } catch (e) {
    // Tabela ainda nao migrada ou banco fora: a pagina explica em vez de quebrar
    console.error("[Cardapio] indisponivel:", (e as Error).message);
  }

  const vazio = categorias.length === 0;

  return (
    <div>
      <Hero
        imagem={capa}
        alt={RESTAURANTE.nome}
        rotulo="Marimar Café Bistrô Bar"
        titulo="Cardápio"
        texto={RESTAURANTE.posicao}
        manuscrita="Pé na areia,&#10;de frente pro mar"
        atributos={[
          { icone: "🐟", texto: "Peixes e frutos do mar" },
          { icone: "🍹", texto: "Drinks e bebidas" },
          { icone: "☕", texto: `Café da manhã ${CAFE_DA_MANHA.horario}` },
        ]}
      />

      <Secao fundo="branco">
        {vazio ? (
          <div className="max-w-2xl mx-auto text-center py-8">
            <p className="text-5xl mb-5" aria-hidden>🍽️</p>
            <h2 className="font-titulo text-2xl font-bold text-tinta mb-3">
              Cardápio em montagem
            </h2>
            <p className="text-tinta-suave leading-relaxed mb-6">
              Estamos organizando o cardápio completo aqui no site. Enquanto isso,
              fale com a gente que passamos os pratos do dia e os valores atualizados.
            </p>
            <p className="text-sm text-tinta-suave mb-8">{RESTAURANTE.cardapioResumo}</p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Botao href={`https://wa.me/${CONTATO.whatsappDigitos}`} icone="💬" externo>
                Perguntar no WhatsApp
              </Botao>
              <Botao href="/restaurante" variante="contorno">Sobre o restaurante</Botao>
            </div>
          </div>
        ) : (
          <>
            <Cardapio categorias={categorias} />

            <div className="mt-14 space-y-4">
              <Aviso titulo="Antes de vir" tom="info">
                Os valores podem mudar conforme a temporada e a disponibilidade do
                pescado. {RESTAURANTE.avisoPendente}
              </Aviso>
              <div className="bg-areia border border-linha rounded-marca p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <p className="text-sm text-tinta leading-relaxed">{COMPLEXO.fraseLonga}</p>
                <div className="flex gap-2 shrink-0">
                  <Botao href={`https://wa.me/${CONTATO.whatsappDigitos}`} icone="💬" externo variante="contorno">
                    Reservar mesa
                  </Botao>
                  <Botao href="/como-chegar" icone="📍">Como chegar</Botao>
                </div>
              </div>
            </div>
          </>
        )}
      </Secao>

      <Onda />
    </div>
  );
}
