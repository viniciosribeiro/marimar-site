import postgres from "postgres";
import {
  TRAVESSIA, CHEGADA_ETAPAS, SOBRE_A_ILHA, ATRACOES,
  CUIDADOS_AMBIENTAIS, AVISO_DISTANCIAS, EVENTOS,
} from "@/lib/conteudo-pousada";

/**
 * Conteúdo institucional que a administração edita pelo painel.
 *
 * Travessia, ilha e eventos viviam em `conteudo-pousada.ts`, um arquivo de
 * código. A Cecília não abre o GitHub para corrigir o preço do barco — e
 * preço de barco é dado de terceiro, que muda, e que a Marina cita com a
 * data da consulta. Dado que envelhece preso em código é dado que vai ficar
 * errado.
 *
 * As constantes continuam valendo como PADRÃO: o que estiver no banco
 * sobrescreve, o resto vem do código. É o mesmo desenho de `lerTema()` e
 * `lerBanner()` — campo novo no código não exige migration nem cadastro
 * para começar a funcionar.
 *
 * Esta é a ÚNICA fonte, e é de propósito: as mesmas páginas do site
 * (`/como-chegar`, `/ilha-do-mel`, `/eventos`) e as rotas da Marina
 * (`/api/agent/chegar`, `/ilha`, `/eventos`, `/passeios`) leem daqui. Se
 * fossem duas, o site e a Marina começariam a contar histórias diferentes
 * no primeiro dia em que alguém corrigisse só um lado.
 */

export type Terminal = { nome: string; endereco: string; principal?: boolean };
export type Etapa = { n: number; titulo: string; texto: string };
export type Atracao = {
  slug: string; nome: string; resumo: string; texto: string;
  distanciaTexto: string; destaque?: boolean;
};

export type Travessia = {
  operadora: string;
  site: string;
  destino: string;
  avisoDestino: string;
  duracao: string;
  terminais: Terminal[];
  precos: {
    ida: number; volta: number; idaEVolta: number;
    gratuidade: string;
    /** Quando estes valores foram conferidos. A Marina cita junto. */
    consultadoEm: string;
  };
  estacionamento: string;
};

export type Ilha = { acesso: string; bagagem: string };
export type Eventos = {
  tipos: string[]; espacos: string[];
  capacidade: string | null; avisoPendente: string;
};

export type Conteudo = {
  TRAVESSIA: Travessia;
  CHEGADA_ETAPAS: Etapa[];
  SOBRE_A_ILHA: Ilha;
  ATRACOES: Atracao[];
  CUIDADOS_AMBIENTAIS: string[];
  AVISO_DISTANCIAS: string;
  EVENTOS: Eventos;
};

/** O que vem do código quando o banco ainda não tem nada. */
export function padroes(): Conteudo {
  return {
    TRAVESSIA: JSON.parse(JSON.stringify(TRAVESSIA)),
    CHEGADA_ETAPAS: JSON.parse(JSON.stringify(CHEGADA_ETAPAS)),
    SOBRE_A_ILHA: JSON.parse(JSON.stringify(SOBRE_A_ILHA)),
    ATRACOES: JSON.parse(JSON.stringify(ATRACOES)),
    CUIDADOS_AMBIENTAIS: [...CUIDADOS_AMBIENTAIS],
    AVISO_DISTANCIAS,
    EVENTOS: JSON.parse(JSON.stringify(EVENTOS)),
  };
}

/** As três chaves do banco e o que cada uma guarda. */
export const CHAVES = ["chegar", "ilha", "eventos"] as const;
export type Chave = (typeof CHAVES)[number];

export async function lerConteudo(sql: ReturnType<typeof postgres>): Promise<Conteudo> {
  const base = padroes();

  try {
    const linhas = await sql<{ chave: string; dados: Record<string, unknown> }[]>`
      SELECT chave, dados FROM conteudo_editavel`;

    for (const { chave, dados } of linhas) {
      if (chave === "chegar") {
        if (dados.TRAVESSIA) {
          base.TRAVESSIA = {
            ...base.TRAVESSIA,
            ...(dados.TRAVESSIA as Travessia),
            precos: { ...base.TRAVESSIA.precos, ...((dados.TRAVESSIA as Travessia).precos ?? {}) },
          };
        }
        if (Array.isArray(dados.CHEGADA_ETAPAS)) base.CHEGADA_ETAPAS = dados.CHEGADA_ETAPAS as Etapa[];
      }
      if (chave === "ilha") {
        if (dados.SOBRE_A_ILHA) base.SOBRE_A_ILHA = { ...base.SOBRE_A_ILHA, ...(dados.SOBRE_A_ILHA as Ilha) };
        if (Array.isArray(dados.ATRACOES)) base.ATRACOES = dados.ATRACOES as Atracao[];
        if (Array.isArray(dados.CUIDADOS_AMBIENTAIS)) base.CUIDADOS_AMBIENTAIS = dados.CUIDADOS_AMBIENTAIS as string[];
        if (typeof dados.AVISO_DISTANCIAS === "string") base.AVISO_DISTANCIAS = dados.AVISO_DISTANCIAS;
      }
      if (chave === "eventos" && dados.EVENTOS) {
        base.EVENTOS = { ...base.EVENTOS, ...(dados.EVENTOS as Eventos) };
      }
    }
  } catch {
    /* Antes da migration 0013 a tabela não existe. O site e a Marina seguem
       com os valores do código em vez de cair — nenhuma página institucional
       merece sumir por causa de uma migration não rodada. */
  }

  return base;
}

/**
 * Data de hoje no formato que o conteúdo usa (DD/MM/AAAA).
 *
 * Serve para carimbar `consultadoEm` quando alguém edita os preços da
 * travessia. É automático de propósito: pedir para a pessoa também digitar a
 * data é pedir para ela esquecer, e a data errada é pior que nenhuma — a
 * Marina cita esse valor como "consultado em".
 */
export function hojeBR(): string {
  const d = new Date();
  return [
    String(d.getDate()).padStart(2, "0"),
    String(d.getMonth() + 1).padStart(2, "0"),
    d.getFullYear(),
  ].join("/");
}
