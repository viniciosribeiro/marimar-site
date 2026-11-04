import { createHash } from "crypto";

/**
 * Memória do que o motor (Desbravador) já devolveu de fotos para cada suíte.
 *
 * Em 04/11/2026 o motor devolveu, para a STANDARD FAMILIA, 4 fotos novas
 * das 16:05 às 16:33 UTC e, a partir das 17:35, voltou a devolver só a foto
 * antiga — por horas, para qualquer período consultado. A sincronização
 * copiava o que viesse por último: apagou as novas e recriou a antiga, e o
 * site ficou com "fotos antigas" (relato do proprietário).
 *
 * Regra daqui em diante: uma lista que o motor MOSTROU PELA PRIMEIRA VEZ
 * ANTES da lista em vigor é uma volta atrás do motor, não uma decisão da
 * pousada — é ignorada e o site mantém a lista mais recente. Uma lista com
 * foto que nunca apareceu é uma mudança da pousada (foto nova) e entra. O
 * botão "Sincronizar com o Desbravador" do painel força a lista atual do
 * motor SEM apagar a memória: se o motor voltar a mostrar a lista mais
 * recente, ela volta sozinha; se voltar à mais antiga, continua ignorada.
 *
 * Guardado em `integracoes` (`fotos_sync_historico`), por código do motor.
 */
export type HistoricoSuite = {
  /** A lista em vigor no site (URLs do motor) e desde quando. */
  aplicada: { assinatura: string; desde: string; fotos: string[] } | null;
  /** Assinatura de cada lista que o motor já devolveu → quando foi vista pela primeira vez. */
  vistas: Record<string, string>;
  /** Todas as URLs que o motor já devolveu para a suíte (as mais antigas saem quando passa do limite). */
  urls: string[];
};
export type Historico = Record<string, HistoricoSuite>;

export const MAX_VISTAS = 24;
export const MAX_URLS = 120;

export function assinaturaFotos(fotos: string[]): string {
  return createHash("sha1").update([...new Set(fotos)].sort().join("\n")).digest("hex").slice(0, 16);
}

export type Decisao =
  | { acao: "igual" | "aplicar"; historico: HistoricoSuite; motivo: string }
  | { acao: "ignorar"; historico: HistoricoSuite; motivo: string; vigente: string[] };

const hora = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};

function limpar(h: unknown): HistoricoSuite | null {
  if (!h || typeof h !== "object") return null;
  const o = h as Partial<HistoricoSuite>;
  const aplicada = o.aplicada && typeof o.aplicada === "object" && Array.isArray(o.aplicada.fotos) && typeof o.aplicada.desde === "string"
    ? { assinatura: assinaturaFotos(o.aplicada.fotos), desde: o.aplicada.desde, fotos: o.aplicada.fotos.filter((u) => typeof u === "string") }
    : null;
  const vistas: Record<string, string> = {};
  if (o.vistas && typeof o.vistas === "object") {
    for (const [k, v] of Object.entries(o.vistas)) if (typeof v === "string") vistas[k] = v;
  }
  return { aplicada, vistas, urls: Array.isArray(o.urls) ? o.urls.filter((u) => typeof u === "string") : [] };
}

function podar(h: HistoricoSuite): HistoricoSuite {
  const entradas = Object.entries(h.vistas).sort((a, b) => a[1].localeCompare(b[1]));
  while (entradas.length > MAX_VISTAS) {
    const i = entradas.findIndex(([k]) => k !== h.aplicada?.assinatura);
    if (i < 0) break;
    entradas.splice(i, 1);
  }
  return { ...h, vistas: Object.fromEntries(entradas), urls: h.urls.slice(-MAX_URLS) };
}

/**
 * Decide o que fazer com a lista que o motor devolveu agora para uma suíte.
 * `noSite`: as URLs do motor que o site já tem (para a primeira rodada com
 * histórico, quando ainda não há nada guardado).
 */
export function decidirLista(
  guardado: HistoricoSuite | undefined | null, doMotor: string[], agoraIso: string,
  opcoes: { forcar?: boolean; noSite?: string[] } = {},
): Decisao {
  const lista = [...new Set(doMotor)];
  const assinatura = assinaturaFotos(lista);
  let h = limpar(guardado);
  if (!h) {
    const noSite = [...new Set(opcoes.noSite ?? [])];
    h = {
      aplicada: noSite.length ? { assinatura: assinaturaFotos(noSite), desde: agoraIso, fotos: noSite } : null,
      vistas: noSite.length ? { [assinaturaFotos(noSite)]: agoraIso } : {},
      urls: noSite,
    };
  }
  const aplicar = (motivo: string): Decisao => {
    const vistas = { ...h!.vistas, [assinatura]: h!.vistas[assinatura] ?? agoraIso };
    const urls = [...h!.urls, ...lista.filter((u) => !h!.urls.includes(u))];
    return { acao: "aplicar", motivo, historico: podar({ aplicada: { assinatura, desde: agoraIso, fotos: lista }, vistas, urls }) };
  };

  if (opcoes.forcar) return aplicar("forçada pelo painel");
  if (h.aplicada && assinatura === h.aplicada.assinatura) {
    return { acao: "igual", motivo: "a mesma lista em vigor", historico: podar({ ...h, vistas: { ...h.vistas, [assinatura]: h.vistas[assinatura] ?? h.aplicada.desde } }) };
  }
  if (!lista.length) {
    if (!h.aplicada?.fotos.length) return { acao: "igual", motivo: "sem fotos no motor e no site", historico: h };
    return { acao: "ignorar", motivo: `o motor não trouxe nenhuma foto; mantidas as ${h.aplicada.fotos.length} de ${hora(h.aplicada.desde)} (o botão do painel força)`, vigente: h.aplicada.fotos, historico: podar({ ...h, vistas: { ...h.vistas, [assinatura]: h.vistas[assinatura] ?? agoraIso } }) };
  }
  const novas = lista.filter((u) => !h!.urls.includes(u));
  if (novas.length) return aplicar(`${novas.length} foto(s) nova(s) no motor`);
  /* Quem decide é a PRIMEIRA vez em que cada lista apareceu, não a última
     aplicação: assim uma forçada para a lista antiga não "rejuvenesce" essa
     lista, e a mais recente volta sozinha quando o motor a mostrar de novo. */
  const vistaEm = h.vistas[assinatura];
  const vigenteDesde = h.aplicada ? (h.vistas[h.aplicada.assinatura] ?? h.aplicada.desde) : null;
  if (h.aplicada && vistaEm && vigenteDesde && vistaEm < vigenteDesde) {
    return {
      acao: "ignorar",
      motivo: `o motor devolveu a lista antiga (de ${hora(vistaEm)}); mantida a de ${hora(vigenteDesde)}`,
      vigente: h.aplicada.fotos,
      historico: podar(h),
    };
  }
  return aplicar(h.aplicada ? "lista nova só com fotos já conhecidas (foto retirada no motor)" : "primeira lista");
}
