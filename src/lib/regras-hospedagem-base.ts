/**
 * Regras de hospedagem — a parte que não toca o banco.
 *
 * A regra de criança é um DADO, configurado em Marina → Regras e adicionais,
 * e lido por três lugares que antes contavam histórias diferentes:
 *   - a busca do site (`/reservar`, `/api/disponibilidade`);
 *   - a Marina (texto do treinamento e `/api/agent/disponibilidade`);
 *   - as páginas de política.
 *
 * O preço continua vindo do motor Desbravador. O que a regra muda é COMO a
 * consulta é montada: criança que não é de colo vai ao motor como adulto —
 * assim o preço mostrado e o link "Reservar no site oficial" batem com o que
 * o motor cobra. Sem regra configurada, tudo funciona como antes.
 *
 * Separado de `regras-hospedagem.ts` para poder ser usado em componente de
 * navegador sem levar o driver do Postgres junto.
 */

export type CobrancaBebe = "gratis" | "por_noite" | "por_estadia";

export type Regras = {
  /** Até que idade (inclusive) é de colo. Nulo = regra desligada. */
  idadeColoMax: number | null;
  criancaPagaComoAdulto: boolean;
  bebeCobranca: CobrancaBebe;
  bebeValor: number | null;
  observacao: string | null;
};

export const REGRAS_PADRAO: Regras = {
  idadeColoMax: null,
  criancaPagaComoAdulto: true,
  bebeCobranca: "gratis",
  bebeValor: null,
  observacao: null,
};

export const regraAtiva = (r: Regras) => r.idadeColoMax !== null;

export type CobrancaAdicional = "por_estadia" | "por_noite" | "por_pessoa_noite" | "por_unidade";

export type Adicional = {
  id: string;
  nome: string;
  descricao: string | null;
  preco: number | null;
  cobranca: CobrancaAdicional;
  categoria: string;
  precisaPedir: boolean;
  visivelSite: boolean;
  visivelMarina: boolean;
  ativo: boolean;
};

export const CATEGORIAS_ADICIONAL = [
  { id: "quarto", rotulo: "Quarto" },
  { id: "bebe", rotulo: "Bebê e criança" },
  { id: "alimentacao", rotulo: "Alimentação" },
  { id: "experiencia", rotulo: "Experiências" },
  { id: "transporte", rotulo: "Transporte" },
  { id: "outros", rotulo: "Outros" },
] as const;

export const COBRANCAS_ADICIONAL: Record<CobrancaAdicional, string> = {
  por_estadia: "por estadia",
  por_noite: "por noite",
  por_pessoa_noite: "por pessoa, por noite",
  por_unidade: "por unidade",
};

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const plural = (n: number, s: string, p = s + "s") => `${n} ${n === 1 ? s : p}`;

/* ── a conta ─────────────────────────────────────────────────────── */

export type Ocupacao = {
  /** O que vai ao motor. */
  adultosMotor: number;
  criancasMotor: number;
  /** O que a pessoa informou. */
  adultos: number;
  criancas: number;
  bebes: number;
  /** A regra da pousada foi aplicada (então o aviso de faixa etária do motor não vale). */
  regraAplicada: boolean;
  /** Valor do(s) bebê(s), fora do motor. 0 = grátis; null = sem regra. */
  valorBebes: number | null;
  /** Frase para mostrar ao hóspede / à Marina explicando a conta. */
  explicacao: string | null;
};

/**
 * Monta a consulta ao motor a partir do que a pessoa informou.
 *
 * `criancas` = crianças que NÃO são de colo; `bebes` = de colo. Sem regra
 * configurada, bebês somam às crianças (o comportamento antigo: tudo vai ao
 * motor como criança) — melhor mostrar o preço do motor do que um preço
 * baseado numa regra que a pousada não definiu.
 */
export function calcularOcupacao(
  p: { adultos: number; criancas: number; bebes?: number; noites: number },
  r: Regras,
): Ocupacao {
  const bebes = Math.max(0, p.bebes ?? 0);
  if (!regraAtiva(r)) {
    return {
      adultosMotor: p.adultos, criancasMotor: p.criancas + bebes,
      adultos: p.adultos, criancas: p.criancas + bebes, bebes: 0,
      regraAplicada: false, valorBebes: null, explicacao: null,
    };
  }
  const comoAdulto = r.criancaPagaComoAdulto;
  const valorBebes = bebes === 0 || r.bebeCobranca === "gratis" || !r.bebeValor
    ? 0
    : r.bebeCobranca === "por_noite" ? r.bebeValor * p.noites * bebes : r.bebeValor * bebes;

  const partes: string[] = [];
  if (p.criancas > 0 && comoAdulto) {
    partes.push(`${plural(p.criancas, "criança")} a partir de ${r.idadeColoMax! + 1} anos ${p.criancas === 1 ? "paga" : "pagam"} como adulto`);
  }
  if (bebes > 0) {
    partes.push(valorBebes > 0
      ? `${plural(bebes, "bebê")} de colo: ${brl(valorBebes)}, pago à parte na pousada`
      : `${plural(bebes, "bebê")} de colo não ${bebes === 1 ? "paga" : "pagam"}`);
  }

  return {
    adultosMotor: comoAdulto ? p.adultos + p.criancas : p.adultos,
    criancasMotor: comoAdulto ? 0 : p.criancas,
    adultos: p.adultos, criancas: p.criancas, bebes,
    regraAplicada: true,
    valorBebes,
    explicacao: partes.length ? partes.join("; ") + "." : null,
  };
}

/* ── os textos ───────────────────────────────────────────────────── */

/** A regra de criança numa frase, para o site e para a Marina. Nulo sem regra. */
export function textoCriancas(r: Regras): string | null {
  if (!regraAtiva(r)) return null;
  const colo = r.idadeColoMax!;
  const bebe = r.bebeCobranca === "gratis" || !r.bebeValor
    ? `Bebês de colo (até ${plural(colo, "ano")}) não pagam.`
    : `Bebês de colo (até ${plural(colo, "ano")}) pagam ${brl(r.bebeValor)} ${r.bebeCobranca === "por_noite" ? "por noite" : "por estadia"}.`;
  const crianca = r.criancaPagaComoAdulto
    ? `Crianças a partir de ${colo + 1} anos pagam como adulto, sem desconto.`
    : `Crianças a partir de ${colo + 1} anos pagam a tarifa de criança do sistema de reservas.`;
  return [crianca, bebe, r.observacao?.trim()].filter(Boolean).join(" ");
}

export function precoAdicional(a: Pick<Adicional, "preco" | "cobranca">): string {
  return a.preco === null ? "sob consulta" : `${brl(a.preco)} ${COBRANCAS_ADICIONAL[a.cobranca]}`;
}

/** O bloco que entra no treinamento da Marina. Vazio quando não há nada configurado. */
export function textoRegrasMarina(r: Regras, adicionais: Adicional[]): string {
  const partes: string[] = [];
  const criancas = textoCriancas(r);
  if (criancas) {
    partes.push(
      "REGRA DE CRIANÇAS (configurada pela pousada — vale sobre qualquer outro texto):\n" +
      criancas + "\n" +
      "Ao consultar preço e vaga: NÃO peça a idade exata. Pergunte só quantos adultos, quantas crianças " +
      `a partir de ${r.idadeColoMax! + 1} anos e quantos bebês de colo. ` +
      "Na consulta de disponibilidade, envie os três separados (`adultos`, `criancas`, `bebes`) — " +
      "a rota aplica a regra sozinha e o total que ela devolve já é o final." +
      (r.criancaPagaComoAdulto
        ? ` Se consultar o sistema de reservas por outra ferramenta, conte as crianças a partir de ${r.idadeColoMax! + 1} anos como adultos e não informe os bebês.`
        : ""),
    );
  }
  const visiveis = adicionais.filter((a) => a.ativo && a.visivelMarina);
  if (visiveis.length) {
    partes.push(
      "ADICIONAIS QUE O HÓSPEDE PODE PEDIR (ofereça quando fizer sentido; preço é o daqui, não invente):\n" +
      visiveis.map((a) => `• ${a.nome} — ${precoAdicional(a)}${a.precisaPedir ? " (pedir com antecedência)" : ""}${a.descricao ? `. ${a.descricao}` : ""}`).join("\n"),
    );
  }
  return partes.join("\n\n");
}
