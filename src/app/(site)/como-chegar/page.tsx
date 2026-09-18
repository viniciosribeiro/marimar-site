import postgres from "postgres";
import type { Metadata } from "next";
import Image from "next/image";
import {
  CHEGADA_ETAPAS, TRAVESSIA, ENDERECO, SOBRE_A_ILHA, COMPLEXO, ATUALIZADO_EM, RESTAURANTE,
} from "@/lib/conteudo-pousada";
import { brl } from "@/lib/format";
import { RotaInteligente } from "@/components/site/RotaInteligente";
import {
  Hero, Secao, Onda, TituloSecao, Subtexto, Manuscrita,
  Aviso, Cartao, Botao, Passo,
} from "@/components/site/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Como chegar na Pousada Marimar — Encantadas, Ilha do Mel",
  description: "Passo a passo: chegue a Pontal do Sul, embarque para Encantadas e caminhe até o Marimar Café Bistrô Bar. A pousada fica anexada aos fundos.",
};

/** Foto por categoria, a partir do alt gerado na migração do WordPress. */
async function buscarFotos() {
  const vazio = { capa: null as string | null, fachada: null as string | null };
  try {
    const sql = postgres(process.env.DATABASE_URL!, { max: 1, connect_timeout: 5, prepare: false });
    const [capa] = await sql`
      SELECT url, alt FROM midias WHERE quarto_id IS NULL
      ORDER BY (alt ILIKE '%aérea%' OR url ILIKE '%dji%') DESC, largura DESC NULLS LAST LIMIT 1
    `;
    const [fachada] = await sql`
      SELECT url FROM midias WHERE quarto_id IS NULL AND alt ILIKE '%Pousada Marimar%'
      ORDER BY largura DESC NULLS LAST LIMIT 1
    `;
    await sql.end();
    return { capa: (capa as any)?.url ?? null, fachada: (fachada as any)?.url ?? null };
  } catch (e) {
    console.error("[ComoChegar] banco indisponivel:", (e as Error).message);
    return vazio;
  }
}

const ICONES = ["🚌", "⛴️", "🚶"];

export default async function ComoChegarPage() {
  const fotos = await buscarFotos();

  return (
    <div>
      <Hero
        imagem={fotos.capa}
        alt="Praia de Encantadas, Ilha do Mel"
        rotulo="Localização"
        titulo="Como chegar"
        texto={SOBRE_A_ILHA.acesso}
        manuscrita="Um paraíso sem pressa"
        legenda="Ilha do Mel, Paraná"
        atributos={[
          { icone: "🌊", texto: "Natureza preservada" },
          { icone: "🍃", texto: "Sem carros na ilha" },
          { icone: "☀️", texto: "Mais tranquilidade para você" },
        ]}
      />

      {/* ═══ PASSO A PASSO ═══ */}
      <Secao fundo="branco">
        <div className="relative">
          <TituloSecao>Passo a passo da sua chegada</TituloSecao>
          <Manuscrita className="absolute right-0 -top-8 -rotate-3 text-right">
            Da cidade ao paraíso,<br />é só uma travessia
          </Manuscrita>
        </div>

        <div className="flex flex-col lg:flex-row gap-5 lg:gap-10 mt-8">
          {CHEGADA_ETAPAS.map((e, i) => (
            <Passo key={e.n} n={e.n} icone={ICONES[i]} titulo={e.titulo} ultimo={i === CHEGADA_ETAPAS.length - 1}>
              {e.texto}
            </Passo>
          ))}
        </div>

        <div className="mt-8">
          <Aviso titulo="Atenção ao destino">
            Escolha o destino <strong>{TRAVESSIA.destino}</strong>. Nova Brasília é o outro
            atracadouro da ilha e fica longe da pousada.
          </Aviso>
        </div>
      </Secao>

      {/* ═══ A TRAVESSIA ═══ */}
      <Secao fundo="suave">
        <TituloSecao id="travessia">A travessia</TituloSecao>
        <Subtexto className="text-sm mt-2 mb-7">
          Operada pela {TRAVESSIA.operadora}. Duração de {TRAVESSIA.duracao} no trecho
          Pontal do Sul–Encantadas.
        </Subtexto>

        <div className="grid sm:grid-cols-2 gap-4 mb-10">
          {TRAVESSIA.terminais.map((t) => (
            <div key={t.nome} className="bg-white rounded-marca border border-linha/70 shadow-marca p-4 flex items-center gap-4">
              <span className="text-marca text-xl shrink-0" aria-hidden>📍</span>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="font-semibold text-tinta">{t.nome}</h3>
                  {t.principal && (
                    <span className="text-[10px] bg-areia text-tinta border border-linha px-2 py-0.5 rounded-full">
                      mais usado
                    </span>
                  )}
                </div>
                <p className="text-sm text-tinta-suave leading-snug">{t.endereco}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ─── Valores ─── */}
        <div className="flex items-baseline justify-between gap-4 flex-wrap mb-5">
          <TituloSecao>Valores da travessia</TituloSecao>
          <span className="text-xs text-tinta-suave whitespace-nowrap">consultados em {ATUALIZADO_EM}</span>
        </div>

        <div className="grid lg:grid-cols-[1fr_1fr_1fr_1.3fr] gap-4">
          <Tarifa rotulo="Ida" valor={brl(TRAVESSIA.precos.ida)} />
          <Tarifa rotulo="Volta" valor={brl(TRAVESSIA.precos.volta)} />
          <Tarifa rotulo="Ida e volta" valor={brl(TRAVESSIA.precos.idaEVolta)} destaque />
          <div className="text-sm text-tinta-suave leading-relaxed space-y-2 lg:pl-2">
            <p className="flex items-start gap-2">
              <span aria-hidden className="shrink-0">🪙</span>
              <span><strong className="text-tinta">{TRAVESSIA.precos.gratuidade}</strong> não pagam.</span>
            </p>
            <p>
              Horários e preços são definidos pela operadora e podem mudar sem aviso.
              Confira sempre no dia oficial antes de viajar.
            </p>
            <a href={TRAVESSIA.site} target="_blank" rel="noopener noreferrer"
              className="inline-block text-marca font-medium hover:text-marca-hover transition-marca">
              Consultar horários na {TRAVESSIA.operadora} →
            </a>
          </div>
        </div>

        <div className="mt-6">
          <Aviso titulo="E o carro?" tom="info">{TRAVESSIA.estacionamento}</Aviso>
        </div>
      </Secao>

      {/* ═══ CHEGANDO NA POUSADA ═══ */}
      <Secao fundo="branco">
        <TituloSecao>Chegando na pousada</TituloSecao>

        <div className="relative mt-6 bg-areia border border-linha rounded-marca p-5 lg:p-6">
          <div className="grid lg:grid-cols-[minmax(0,17rem)_1fr] gap-6 items-center">
            {fotos.fachada ? (
              <div className="relative h-44 lg:h-40 rounded-marca overflow-hidden">
                <Image src={fotos.fachada} alt={`${RESTAURANTE.nome}, na frente do complexo`} fill
                  sizes="(max-width: 1024px) 100vw, 17rem" className="object-cover" />
              </div>
            ) : (
              <div className="h-44 lg:h-40 rounded-marca bg-areia-forte flex items-center justify-center text-4xl">🏖️</div>
            )}

            <div className="lg:pr-40">
              <p className="text-tinta leading-relaxed mb-3">{COMPLEXO.fraseLonga}</p>
              <p className="text-sm text-tinta-suave leading-relaxed">{SOBRE_A_ILHA.bagagem}</p>
            </div>
          </div>

          <Manuscrita className="absolute right-6 bottom-6 -rotate-3 text-right max-w-[13rem]">
            Restaurante pé na areia<br />e pousada aos fundos
          </Manuscrita>
        </div>
      </Secao>

      {/* ═══ MAPA E ROTA ═══ */}
      <Secao fundo="suave">
        <TituloSecao>Ponto de referência no mapa</TituloSecao>

        <div className="grid lg:grid-cols-2 gap-5 mt-6">
          <Cartao>
            <h3 className="font-semibold text-tinta mb-4 leading-snug">{ENDERECO.rotuloMapa}</h3>

            <dl className="text-sm space-y-2 mb-6">
              <div className="flex gap-2.5">
                <dt className="text-marca shrink-0" aria-hidden>📍</dt>
                <dd className="text-tinta-suave">{ENDERECO.completo}</dd>
              </div>
              <div className="flex gap-2.5">
                <dt className="text-marca shrink-0" aria-hidden>🔑</dt>
                <dd className="text-tinta-suave">
                  Plus Code <span className="font-mono text-tinta">{ENDERECO.plusCode}</span>
                </dd>
              </div>
            </dl>

            <RotaInteligente
              lat={ENDERECO.lat}
              lng={ENDERECO.lng}
              plusCode={ENDERECO.plusCode}
              rotulo={ENDERECO.rotuloMapa}
            />
          </Cartao>

          <div className="rounded-marca overflow-hidden border border-linha/70 min-h-[22rem] bg-areia">
            {/* OpenStreetMap: sem chave de API e sem cookie de rastreamento */}
            <iframe
              title="Mapa da Pousada Marimar em Encantadas"
              loading="lazy"
              className="w-full h-full min-h-[22rem]"
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${ENDERECO.lng - 0.006}%2C${ENDERECO.lat - 0.004}%2C${ENDERECO.lng + 0.006}%2C${ENDERECO.lat + 0.004}&layer=mapnik&marker=${ENDERECO.lat}%2C${ENDERECO.lng}`}
            />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Botao href="/contato" icone="💬" variante="contorno">Falar com a pousada</Botao>
          <Botao href="/reservar" icone="🗓">Consultar disponibilidade</Botao>
        </div>
      </Secao>

      <Onda />
    </div>
  );
}

function Tarifa({ rotulo, valor, destaque = false }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className={`rounded-marca border p-5 flex items-center gap-4 ${
      destaque ? "bg-marca border-transparent text-marca-texto" : "bg-white border-linha/70 shadow-marca"
    }`}>
      <span className={`w-11 h-11 rounded-full flex items-center justify-center text-lg shrink-0 ${
        destaque ? "bg-white/20" : "bg-areia"
      }`} aria-hidden>🎟️</span>
      <div>
        <p className={`text-xs mb-0.5 ${destaque ? "text-marca-texto/75" : "text-tinta-suave"}`}>{rotulo}</p>
        <p className={`font-bold text-lg ${destaque ? "text-marca-texto" : "text-tinta"}`}>{valor}</p>
      </div>
    </div>
  );
}
