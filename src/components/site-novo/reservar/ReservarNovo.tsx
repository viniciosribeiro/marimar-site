import Image from "next/image";
import Link from "next/link";
import { after } from "next/server";
import { fetchTarifas, validarConsulta, TIMEOUT_BUSCA } from "@/lib/worker";
import { comSql } from "@/lib/db-conexao";
import { lerContato } from "@/lib/pousada";
import {
  lerRegras, lerAdicionais, calcularOcupacao, precoAdicional, REGRAS_PADRAO, type Adicional,
} from "@/lib/regras-hospedagem";
import { talvezSincronizarFotos } from "@/lib/sincronizar-fotos-desbravador";
import { brl, pluralizar } from "@/lib/format";
import { RolarParaResultados } from "@/components/site/RolarParaResultados";
import { CardQuartoModal, type DadosDetalhesSuite } from "@/components/site/CardQuartoModal";
import { BuscaNovo } from "../BuscaNovo";
import { hospedes, paramsDaConsulta, periodo } from "../quartos/preco";
import { montarResultados, ordenar, textoMotivo, type FotoLocal, type QuartoLocal, type Resultado } from "./resultados";
import { Migalhas } from "../DadosEstruturados";

/**
 * /reservar no site novo. Por baixo é a MESMA busca do Clássico (o que foi
 * aprovado não muda): validarConsulta, a regra de crianças (calcularOcupacao),
 * a consulta ao motor com espera de até 45 s, "Buscando suas suítes" enquanto
 * consulta, a rolagem suave até os resultados (RolarParaResultados), a
 * sincronização de fotos de carona e o link de reserva com o roomCode.
 * Os resultados são montados por `montarResultados` com as regras do
 * Clássico — o teste e2e compara os dois, suíte por suíte.
 *
 * Muda a forma: uma coluna no celular, preço e total legíveis, "Reservar" e
 * "Ver a suíte" (a página da suíte com as mesmas datas; para suíte sem página,
 * a janela de detalhes de sempre — nunca um 404), sem vaga no fim e sem preço.
 */
export type BuscaReservar = {
  check_in?: string; check_out?: string; adultos?: string; criancas?: string; bebes?: string;
  ver_resultados?: string; ordem?: string;
};

export async function ReservarNovo({ sp }: { sp: BuscaReservar }) {
  const v = sp.check_in && sp.check_out
    ? validarConsulta({ checkIn: sp.check_in, checkOut: sp.check_out, adultos: sp.adultos, criancas: sp.criancas, bebes: sp.bebes })
    : null;
  const { regras, adicionais } = await comSql(async (sql) => ({
    regras: await lerRegras(sql),
    adicionais: (await lerAdicionais(sql)).filter((a) => a.visivelSite),
  })).catch(() => ({ regras: REGRAS_PADRAO, adicionais: [] as Adicional[] }));
  const consulta = v?.ok ? v.consulta : null;
  const noites = consulta ? Math.round((Date.parse(consulta.checkOut) - Date.parse(consulta.checkIn)) / 86_400_000) : 0;
  const oc = calcularOcupacao({ adultos: consulta?.adultos ?? 2, criancas: consulta?.criancas ?? 0, bebes: consulta?.bebes ?? 0, noites }, regras);
  const regraCriancas = regras.idadeColoMax !== null ? { idadeColoMax: regras.idadeColoMax } : null;

  /* Cada busca também confere, depois da resposta, se as fotos das suítes estão em dia com o Desbravador (1×/hora). */
  if (consulta) after(() => comSql((sql) => talvezSincronizarFotos(sql)).catch(() => {}));
  /* O motor é a parte lenta: começa antes do banco, em paralelo. */
  const tarifas = consulta
    ? fetchTarifas(consulta.checkIn, consulta.checkOut, oc.adultosMotor, oc.criancasMotor, { timeoutMs: TIMEOUT_BUSCA })
    : null;
  tarifas?.catch(() => {});
  const contato = await lerContato();
  const query = consulta ? paramsDaConsulta(consulta, regraCriancas !== null) : "";

  let resultados: Resultado[] = [];
  let erro = "";
  let avisoCrianca = "";
  if (v && !v.ok) {
    erro = v.motivo === "ordem"
      ? "A data de saída precisa ser depois da data de entrada."
      : "Não entendemos as datas escolhidas. Escolha de novo no formulário.";
  }
  if (consulta && tarifas) {
    try {
      const dados = await tarifas;
      avisoCrianca = oc.regraAplicada ? "" : dados.aviso_crianca || "";
      const codigos = [...dados.quartos, ...dados.indisponiveis].map((r) => r.id);
      const locais = codigos.length ? await comSql(async (sql) => {
        const qs = await sql<QuartoLocal[]>`
          SELECT q.id, q.slug, q.nome, q.ativo, c.nome AS cat_nome, q.descricao, q.descricao_motor, q.cama, q.metragem, q.vista, q.desbravador_room_id
          FROM quartos q LEFT JOIN categorias c ON q.categoria_id = c.id WHERE q.desbravador_room_id = ANY(${codigos})`;
        const ids = qs.map((q) => q.id);
        const fotos = ids.length
          ? await sql<FotoLocal[]>`SELECT quarto_id, url, alt FROM midias WHERE quarto_id = ANY(${ids}) AND tipo = 'foto' ORDER BY destaque DESC, ordem`
          : [];
        const comodidades = ids.length
          ? await sql<{ quarto_id: string; nome: string }[]>`
              SELECT qc.quarto_id, cm.nome FROM quarto_comodidades qc JOIN comodidades cm ON cm.id = qc.comodidade_id
              WHERE qc.quarto_id = ANY(${ids}) ORDER BY cm.nome`.catch(() => [])
          : [];
        return { quartos: [...qs], fotos: [...fotos], comodidades: [...comodidades] };
      }) : { quartos: [], fotos: [], comodidades: [] };
      resultados = montarResultados(dados, {
        consulta, noites, oc, locais: locais.quartos, fotos: locais.fotos, comodidades: locais.comodidades,
        whatsapp: contato.whatsappDigitos, query,
      });
    } catch (e) {
      /* O motivo vai para os logs da Vercel (Logs → /reservar). */
      console.error("[reservar novo] busca falhou:", consulta.checkIn, consulta.checkOut, (e as Error)?.message ?? e);
      erro = "Não conseguimos consultar a disponibilidade agora. Tente novamente em instantes ou fale com a gente no WhatsApp.";
    }
  }

  const ordem = sp.ordem === "preco" ? "preco" : "pousada";
  const disponiveis = ordenar(resultados.filter((r) => r.disponivel), ordem);
  const esgotados = resultados.filter((r) => !r.disponivel);
  const wa = contato.whatsappDigitos;

  return (
    <div className="pb-16 lg:pb-24">
      <Migalhas trilha={[["Reservar", "/reservar"]]} />
      <section className="sn-margem mx-auto grid max-w-[1240px] gap-8 pt-10 lg:grid-cols-[minmax(0,1fr)_27rem] lg:items-end lg:gap-16 lg:pt-16">
        <div className="max-w-[36rem]">
          <h1 className="sn-titulo-pagina">{consulta ? "Suítes para as suas datas" : "Datas e preços"}</h1>
          <p className="mt-4 text-[1.06rem] leading-relaxed text-sn-texto-2">
            Vagas e preços do sistema de reservas da pousada, na hora. Você reserva direto com a pousada.
          </p>
        </div>
        <div id="busca" data-sem-flutuante className="scroll-mt-[calc(var(--sn-topo)+1rem)]">
          <BuscaNovo regra={regraCriancas} estilo="contorno" nota={null} titulo={consulta ? "Suas datas" : "Quando você vem?"}
            inicial={{ checkIn: consulta?.checkIn ?? sp.check_in ?? null, checkOut: consulta?.checkOut ?? sp.check_out ?? null,
              adultos: consulta?.adultos, criancas: consulta?.criancas, bebes: consulta?.bebes }} />
        </div>
      </section>

      {/* A âncora só surge depois de uma busca; nunca rolar a página ao abrir /reservar sem datas. */}
      {sp.check_in && sp.check_out && (
        <div id="resultados-disponibilidade" className="scroll-mt-[calc(var(--sn-topo)+0.75rem)]">
          <RolarParaResultados ativo={sp.ver_resultados === "1"} />
        </div>
      )}

      {erro && (
        <div role="alert" className="sn-margem mx-auto mt-10 max-w-[1240px]">
          <div className="rounded-[18px] bg-sn-areia/70 p-6">
            <p className="text-[1.05rem]">{erro}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              {consulta && <a href={`/reservar?${query}&ver_resultados=1`} className="sn-botao">Tentar de novo</a>}
              {wa && <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="sn-botao-linha">Falar no WhatsApp</a>}
            </div>
          </div>
        </div>
      )}

      {consulta && !erro && (
        <section aria-labelledby="sn-resultados" className="sn-margem mx-auto mt-12 max-w-[1240px] lg:mt-16">
          <p className="text-[0.98rem] text-sn-texto-2">
            {periodo(consulta.checkIn, consulta.checkOut)}, {pluralizar(noites, "noite")}, {hospedes({ adultos: consulta.adultos, criancas: consulta.criancas, bebes: oc.bebes })}.{" "}
            <a href="#busca" className="sn-link">Alterar</a>
          </p>
          {oc.explicacao && <p className="mt-3 max-w-[44rem] rounded-xl bg-sn-areia/60 px-4 py-3 text-[0.95rem]">{oc.explicacao} Regra da pousada.</p>}
          {avisoCrianca && <p className="mt-3 max-w-[44rem] rounded-xl bg-sn-areia/60 px-4 py-3 text-[0.95rem]">{avisoCrianca}</p>}

          <div className="mt-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
            <h2 id="sn-resultados" className="sn-h2">
              {disponiveis.length
                ? `${pluralizar(disponiveis.length, "tipo de suíte", "tipos de suíte")} ${disponiveis.length === 1 ? "disponível" : "disponíveis"} para você`
                : "Nenhuma suíte livre nestas datas"}
            </h2>
            {disponiveis.length > 1 && (
              <nav aria-label="Ordem das suítes" className="flex items-center gap-2 text-[0.95rem]">
                <span className="text-sn-texto-2">Ordem:</span>
                <Ordem href={`/reservar?${query}`} ativo={ordem === "pousada"}>Da pousada</Ordem>
                <Ordem href={`/reservar?${query}&ordem=preco`} ativo={ordem === "preco"}>Menor preço</Ordem>
              </nav>
            )}
          </div>

          {disponiveis.length > 0 ? (
            <ul className="mt-8 grid gap-x-8 gap-y-14 sm:grid-cols-2 xl:grid-cols-3">
              {disponiveis.map((r) => <li key={r.codigo} className="min-w-0"><CartaoResultado r={r} noites={noites} /></li>)}
            </ul>
          ) : (
            <div className="mt-6 max-w-[44rem] rounded-[18px] bg-sn-areia/60 p-6">
              <p className="text-[1.05rem]">Tente outras datas ou pergunte à pousada: às vezes abre vaga.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <a href="#busca" className="sn-botao">Trocar as datas</a>
                {wa && <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="sn-botao-linha">Consultar outras datas no WhatsApp</a>}
              </div>
            </div>
          )}

          {esgotados.length > 0 && (
            <div className="mt-16 border-t border-sn-linha pt-8">
              <h2 className="sn-h3">Sem vaga nestas datas</h2>
              <ul className="mt-4 divide-y divide-sn-linha">
                {esgotados.map((r) => (
                  <li key={r.codigo} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3.5">
                    <span className="min-w-0">
                      <span className="font-medium">{r.nome}</span>
                      <span className="text-sn-texto-2">, até {pluralizar(r.ocupacao, "pessoa")}</span>
                    </span>
                    <span className="flex items-baseline gap-4 text-[0.93rem] text-sn-texto-2">
                      {r.temTarifa ? textoMotivo(r.motivo) : "Sem tarifa publicada"}
                      {r.paginaSuite && <Link href={r.paginaSuite} className="sn-link">Ver a suíte</Link>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {adicionais.length > 0 && <Adicionais itens={adicionais} destacarBebe={oc.bebes > 0} />}
    </div>
  );
}

function Ordem({ href, ativo, children }: { href: string; ativo: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} scroll={false} aria-current={ativo ? "true" : undefined}
      className={`inline-flex h-10 items-center rounded-full px-3.5 font-medium transition-colors ${ativo ? "bg-sn-mar text-white" : "bg-white ring-1 ring-sn-linha hover:ring-sn-texto-2"}`}>
      {children}
    </Link>
  );
}

function CartaoResultado({ r, noites }: { r: Resultado; noites: number }) {
  const foto = r.fotoCapa ? (
    <Image src={r.fotoCapa} alt={r.fotos[0]?.alt || r.nome} fill sizes="(min-width: 1280px) 380px, (min-width: 640px) 50vw, 100vw" className="object-cover" />
  ) : (
    <span className="absolute inset-0 flex items-center justify-center text-sn-texto-2">Fotos em breve</span>
  );
  const conteudo = (
    <article className="flex h-full flex-col">
      {r.paginaSuite ? (
        <Link href={r.paginaSuite} tabIndex={-1} aria-hidden className="relative block aspect-[4/3] overflow-hidden rounded-[14px] bg-sn-areia">{foto}</Link>
      ) : (
        <button type="button" className="relative block aspect-[4/3] w-full overflow-hidden rounded-[14px] bg-sn-areia" aria-label={`Ver fotos e detalhes de ${r.nome}`}>{foto}</button>
      )}
      <h3 className="sn-h3 mt-3">
        {r.paginaSuite ? <Link href={r.paginaSuite} className="hover:underline hover:decoration-1 hover:underline-offset-4">{r.nome}</Link> : r.nome}
      </h3>
      <p className="mt-0.5 text-[0.93rem] text-sn-texto-2">Até {pluralizar(r.ocupacao, "pessoa")}{r.cama ? `, ${r.cama.trim().toLowerCase()}` : ""}</p>
      {r.escassez && <p className="mt-1 text-[0.92rem] font-medium text-sn-mata">{r.escassez}</p>}
      {r.temTarifa ? (
        <div className="mt-3">
          <p><span className="font-titulo text-[1.8rem] leading-none tabular-nums">{brl(r.diaria)}</span> <span className="text-sn-texto-2">por noite</span></p>
          <p className="mt-1 text-[0.98rem]">Total de {pluralizar(noites, "noite")}: <strong className="font-semibold tabular-nums">{brl(r.totalFinal)}</strong></p>
          {r.valorBebes > 0 && <p className="mt-0.5 text-[0.86rem] text-sn-texto-2">Inclui {brl(r.valorBebes)} de bebê de colo, pago à parte na pousada.</p>}
        </div>
      ) : (
        <p className="mt-3 text-sn-texto-2">Sem tarifa publicada para estas datas.</p>
      )}
      {r.avisoEstadia && <p className="mt-1.5 text-[0.9rem]">Estadia mínima de {pluralizar(r.avisoEstadia, "noite")} nestas datas.</p>}
      <div className="mt-auto grid grid-cols-2 gap-2.5 pt-4">
        {r.temTarifa && (
          <a href={r.linkReserva} target="_blank" rel="noopener noreferrer" className="sn-botao rounded-xl px-3"
            aria-label={`Reservar ${r.nome} no site oficial`}>Reservar</a>
        )}
        {r.paginaSuite
          ? <Link href={r.paginaSuite} className={`sn-botao-linha rounded-xl px-3 ${r.temTarifa ? "" : "col-span-2"}`}>Ver a suíte</Link>
          : <button type="button" className={`sn-botao-linha rounded-xl px-3 ${r.temTarifa ? "" : "col-span-2"}`}>Ver detalhes</button>}
      </div>
    </article>
  );
  /* Suíte sem página no site (ainda não cadastrada): a janela de detalhes com os dados do motor. */
  return r.paginaSuite ? conteudo : <CardQuartoModal dados={dadosModal(r, noites)}>{conteudo}</CardQuartoModal>;
}

function dadosModal(r: Resultado, noites: number): DadosDetalhesSuite {
  return {
    nome: r.nome, categoria: r.categoria, descricao: r.descricao, descricaoMotor: r.descricaoMotor,
    fotos: r.fotos, comodidades: r.comodidades, cama: r.cama, metragem: r.metragem, vista: r.vista,
    ocupacao: r.ocupacao, disponivel: r.disponivel, diaria: r.diaria, total: r.totalFinal, noites,
    reservaUrl: r.linkReserva, whatsappUrl: r.whatsappUrl, avisoEstadia: r.avisoEstadia, motivoIndisponivel: r.motivo,
  };
}

/** Adicionais de Marina → Regras e adicionais. Sem preço: "sob consulta" — nunca um valor inventado. */
function Adicionais({ itens, destacarBebe }: { itens: Adicional[]; destacarBebe: boolean }) {
  const lista = destacarBebe ? [...itens].sort((a, b) => Number(b.categoria === "bebe") - Number(a.categoria === "bebe")) : itens;
  return (
    <section aria-labelledby="sn-adicionais" className="sn-margem mx-auto mt-16 max-w-[1240px]">
      <h2 id="sn-adicionais" className="sn-h3">Adicionais para a sua estadia</h2>
      <p className="mt-1 text-[0.95rem] text-sn-texto-2">Peça na reserva ou pelo WhatsApp. Valores cobrados à parte.</p>
      <ul className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        {lista.map((a) => (
          <li key={a.id} className="border-t border-sn-linha pt-3">
            <p className="flex items-baseline justify-between gap-3">
              <span className="font-medium">{a.nome}</span>
              <span className="shrink-0 text-[0.95rem] font-semibold tabular-nums">{precoAdicional(a)}</span>
            </p>
            {a.descricao && <p className="mt-1 text-[0.93rem] leading-relaxed text-sn-texto-2">{a.descricao}</p>}
            {a.precisaPedir && <p className="mt-1 text-[0.86rem] text-sn-texto-2">Pedir com antecedência</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
