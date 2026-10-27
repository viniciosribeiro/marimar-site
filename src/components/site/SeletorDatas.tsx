"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
  DIAS_SEMANA, chaveMes, dataBarra, dataCurta, dataPorExtenso, diaSemana, feriadosDoAno, gradeDoMes, hojeIso,
  isoValido, mesAntes, mesDe, mesmoMes, noitesEntre, noitesTexto, somarDias, somarMeses, tituloMes, type Mes,
} from "@/lib/calendario";

/**
 * Calendário de estadia (aprovado pelo Vinicios em 19/10/2026, protótipo
 * antes): um calendário só para entrada e saída, no lugar das duas caixas
 * de data do aparelho — a de saída abria no mês atual, e quem escolhia
 * 28/12 tinha de avançar mês a mês até janeiro.
 *
 * - O primeiro toque marca a entrada; o segundo, a saída. Escolhida a
 *   entrada, o calendário fica naquele mês, com o seguinte ao lado.
 * - Reaberto pela saída, abre no mês da entrada — nunca volta ao mês atual.
 * - Computador: janela com dois meses lado a lado. Celular: folha que sobe
 *   com os meses um embaixo do outro.
 * - O formulário continua mandando `check_in` e `check_out` (AAAA-MM-DD),
 *   como antes: a busca, o motor e a Marina não mudam.
 * Desenhado no <body> (createPortal): a caixa de busca da home corta o que
 * passa da borda (overflow-hidden) e o movimento do site prende `fixed`.
 */

type Props = {
  entradaInicial?: string | null;
  saidaInicial?: string | null;
  /** Visual dos dois campos: a caixa do topo da home ou a página Reservar. */
  variante: "home" | "reservar";
};

const MESES_NO_CELULAR = 18;
const CELULAR = "(max-width: 639px)";

const ESTILO = {
  home: {
    caixa: "col-span-2 sm:col-span-1 min-w-0",
    rotulo: "block text-[11px] font-medium text-tinta-suave px-1 mb-1",
    campo: "w-full px-3 py-2.5 rounded-lg border border-linha bg-white sm:border-white/80 sm:bg-white/80 text-tinta text-sm text-left focus:ring-2 focus:ring-marca outline-none truncate",
  },
  reservar: {
    caixa: "col-span-2 sm:col-span-1 min-w-0",
    rotulo: "block text-xs font-medium text-tinta-suave mb-1 px-1",
    campo: "w-full h-12 border border-linha rounded-xl px-3 text-[0.95rem] text-tinta bg-white text-left focus:ring-2 focus:ring-marca outline-none truncate",
  },
};

function useCelular() {
  return useSyncExternalStore(
    (avisar) => {
      const media = window.matchMedia(CELULAR);
      // iPhones com WebKit antigo so implementam addListener/removeListener.
      // Falhar na inscricao pode impedir a hidratacao e deixar os botoes mudos.
      if (typeof media.addEventListener === "function") {
        media.addEventListener("change", avisar);
        return () => media.removeEventListener("change", avisar);
      }
      media.addListener(avisar);
      return () => media.removeListener(avisar);
    },
    () => window.matchMedia(CELULAR).matches,
    () => false,
  );
}

export function SeletorDatas({ entradaInicial, saidaInicial, variante }: Props) {
  const inicialOk = isoValido(entradaInicial) && isoValido(saidaInicial) && saidaInicial > entradaInicial;
  const [entrada, setEntrada] = useState<string | null>(inicialOk ? entradaInicial : null);
  const [saida, setSaida] = useState<string | null>(inicialOk ? saidaInicial! : null);
  const [aberto, setAberto] = useState(false);
  const [foco, setFoco] = useState<"entrada" | "saida">("entrada");
  const [previa, setPrevia] = useState<string | null>(null);
  const [vista, setVista] = useState<Mes>({ ano: 2026, mes: 0 });
  const [anima, setAnima] = useState<"esq" | "dir" | null>(null);
  const [hoje, setHoje] = useState("");
  const [posicao, setPosicao] = useState<{ top: number; left: number; largura: number } | null>(null);
  const [falta, setFalta] = useState(false);
  const celular = useCelular();

  const btEntrada = useRef<HTMLButtonElement>(null);
  const btSaida = useRef<HTMLButtonElement>(null);
  const janela = useRef<HTMLDivElement>(null);
  const lista = useRef<HTMLDivElement>(null);
  const focarDia = useRef<string | null>(null);
  const abriuAgora = useRef(false);
  const rolarPara = useRef<Mes | null>(null);
  const atual = useRef({ entrada, saida });
  useEffect(() => { atual.current = { entrada, saida }; });

  const mesHoje = useMemo<Mes>(() => (hoje ? mesDe(hoje) : vista), [hoje, vista]);
  const feriados = useMemo(() => {
    const a = mesHoje.ano;
    return { ...feriadosDoAno(a), ...feriadosDoAno(a + 1), ...feriadosDoAno(a + 2) };
  }, [mesHoje.ano]);

  /* ── abrir, posicionar, fechar ─────────────────────────────────── */
  const medir = useCallback(() => {
    const a = btEntrada.current?.getBoundingClientRect(), b = btSaida.current?.getBoundingClientRect();
    if (!a || !b) return;
    const largura = Math.min(800, window.innerWidth - 32);
    /* Centrado embaixo da caixa de busca inteira (não só dos dois campos). */
    const caixa = btEntrada.current?.form?.getBoundingClientRect();
    const meio = caixa ? (caixa.left + caixa.right) / 2 : (Math.min(a.left, b.left) + Math.max(a.right, b.right)) / 2;
    const left = Math.max(16, Math.min(window.innerWidth - largura - 16, meio - largura / 2));
    setPosicao({ top: Math.max(a.bottom, b.bottom) + window.scrollY + 10, left: left + window.scrollX, largura });
  }, []);

  // Chamado pelos dois campos, mesmo com o calendario aberto. Reabrir muda
  // o foco sem desmontar o popup (antes o segundo toque o fechava).
  function abrir(campo: "entrada" | "saida") {
    const h = hojeIso();
    const mh = mesDe(h);
    /* Abre no mês da entrada (nunca volta para o mês atual). */
    const base = entrada && !mesAntes(mesDe(entrada), mh) ? mesDe(entrada) : mh;
    setHoje(h);
    setFoco(campo === "saida" && entrada ? "saida" : "entrada");
    setVista(base);
    setAnima(null);
    setPrevia(null);
    setFalta(false);
    rolarPara.current = base;
    focarDia.current = (campo === "saida" ? saida ?? entrada : entrada) ?? null;
    medir();
    abriuAgora.current = true;
    setAberto(true);
  }

  const fechar = useCallback((devolverFoco = true) => {
    setAberto(false);
    setPrevia(null);
    if (devolverFoco) (atual.current.entrada && !atual.current.saida ? btSaida : btEntrada).current?.focus({ preventScroll: true });
  }, []);

  /* Fora da janela (computador), Esc, girar a tela: fecha. */
  useEffect(() => {
    if (!aberto) return;
    const aoTocarFora = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (janela.current?.contains(alvo) || btEntrada.current?.contains(alvo) || btSaida.current?.contains(alvo)) return;
      fechar(false);
    };
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === "Escape") fechar(); };
    const aoRedimensionar = () => medir();
    if (!celular) document.addEventListener("mousedown", aoTocarFora);
    document.addEventListener("keydown", aoTeclar);
    window.addEventListener("resize", aoRedimensionar);
    /* Celular: a página atrás da folha não rola. */
    const rolagem = document.documentElement.style.overflow;
    if (celular) document.documentElement.style.overflow = "hidden";
    return () => {
      document.removeEventListener("mousedown", aoTocarFora);
      document.removeEventListener("keydown", aoTeclar);
      window.removeEventListener("resize", aoRedimensionar);
      document.documentElement.style.overflow = rolagem;
    };
  }, [aberto, celular, fechar, medir]);

  /* Celular: a lista abre já no mês da entrada. Depois, o foco no dia certo. */
  useLayoutEffect(() => {
    if (!aberto) return;
    const m = rolarPara.current;
    if (celular && m && lista.current) {
      const sec = lista.current.querySelector<HTMLElement>(`[data-mes="${chaveMes(m)}"]`);
      if (sec) lista.current.scrollTop = sec.offsetTop - 8;
      rolarPara.current = null;
    }
    /* Foco: no dia pedido (ou no primeiro livre, ao abrir); trocar de mês pelas setas não rouba o foco. */
    const d = focarDia.current;
    const bt = d ? janela.current?.querySelector<HTMLButtonElement>(`[data-iso="${d}"]:not(:disabled)`) : null;
    if (bt || abriuAgora.current) (bt ?? janela.current?.querySelector<HTMLButtonElement>(".cal-dia:not(:disabled)"))?.focus({ preventScroll: true });
    /* Computador: com a busca no pé da tela, a página desce até o calendário aparecer inteiro. */
    if (abriuAgora.current && !celular) {
      const suave = !matchMedia("(prefers-reduced-motion: reduce)").matches;
      requestAnimationFrame(() => janela.current?.scrollIntoView({ block: "nearest", behavior: suave ? "smooth" : "auto" }));
    }
    focarDia.current = null;
    abriuAgora.current = false;
  }, [aberto, celular, vista]);

  /* O formulário não sai sem as duas datas: abre o calendário no lugar. */
  useEffect(() => {
    const form = btEntrada.current?.form;
    if (!form) return;
    const aoEnviar = (e: SubmitEvent) => {
      const { entrada: en, saida: sa } = atual.current;
      if (en && sa) return;
      e.preventDefault();
      setFalta(true);
      (en ? btSaida : btEntrada).current?.click();
    };
    form.addEventListener("submit", aoEnviar);
    return () => form.removeEventListener("submit", aoEnviar);
  }, []);

  /* ── escolher ──────────────────────────────────────────────────── */
  function escolher(s: string) {
    setFalta(false);
    if (foco === "entrada" || !entrada || s <= entrada) {
      setEntrada(s); setSaida(null); setFoco("saida"); setPrevia(null);
      /* Computador: se a entrada caiu no mês da direita, os meses andam um
         passo — a entrada vai para a esquerda e o mês seguinte aparece. */
      if (!celular && mesmoMes(mesDe(s), somarMeses(vista, 1))) { setVista(mesDe(s)); setAnima("esq"); focarDia.current = s; }
    } else {
      setSaida(s); setPrevia(null);
    }
  }

  function mudarVista(passo: number) {
    const nova = somarMeses(vista, passo);
    if (mesAntes(nova, mesHoje)) return;
    setVista(nova);
    setAnima(passo > 0 ? "esq" : "dir");
  }

  function aoTeclarDia(e: React.KeyboardEvent<HTMLButtonElement>, s: string) {
    const passo = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 } as Record<string, number>)[e.key];
    if (!passo) return;
    e.preventDefault();
    const alvo = somarDias(s, passo);
    if (alvo < hoje) return;
    const bt = janela.current?.querySelector<HTMLButtonElement>(`[data-iso="${alvo}"]`);
    if (bt) { bt.focus(); return; }
    if (!celular) { focarDia.current = alvo; mudarVista(passo > 0 ? 1 : -1); }
  }

  /* ── desenho ───────────────────────────────────────────────────── */
  const fimVisual = saida ?? (previa && entrada && previa > entrada ? previa : null);
  const noites = entrada && saida ? noitesEntre(entrada, saida) : null;

  function dia(s: string, coluna: number, ultimoDia: boolean) {
    const p = Number(s.slice(8));
    const feriado = feriados[s];
    const classes = [
      "cal-dia",
      coluna === 0 && "dom", coluna === 6 && "sab", p === 1 && "primeiro", ultimoDia && "ultimo",
      s === hoje && "hoje",
      s === entrada && "inicio", s === entrada && fimVisual && "com-faixa",
      s === saida && "fim", !saida && s === fimVisual && "fim-previa",
      entrada && fimVisual && s > entrada && s < fimVisual && "na-faixa",
    ].filter(Boolean).join(" ");
    const dica = !saida && s === fimVisual && entrada ? noitesTexto(noitesEntre(entrada, s)) : undefined;
    return (
      <button key={s} type="button" className={classes} data-iso={s} data-dica={dica} disabled={s < hoje}
        aria-label={`${dataPorExtenso(s)}${feriado ? `, ${feriado}` : ""}`} aria-pressed={s === entrada || s === saida}
        title={feriado} onClick={() => escolher(s)} onKeyDown={(e) => aoTeclarDia(e, s)}
        onMouseEnter={!celular && entrada && !saida && foco === "saida" && s > entrada ? () => setPrevia(s) : undefined}>
        <span>{p}</span>
        {feriado && <i className="cal-feriado" aria-hidden="true" />}
      </button>
    );
  }

  function mes(m: Mes, comSemana: boolean) {
    const grade = gradeDoMes(m);
    const total = grade.filter(Boolean).length;
    return (
      <section key={chaveMes(m)} className="cal-mes" data-mes={chaveMes(m)} aria-label={tituloMes(m)}>
        <h3 className="cal-mes__titulo">{tituloMes(m)}</h3>
        {comSemana && <div className="cal-semana" aria-hidden="true">{DIAS_SEMANA.map((d) => <span key={d}>{d}</span>)}</div>}
        <div className="cal-grade">
          {grade.map((s, i) => (s ? dia(s, i % 7, Number(s.slice(8)) === total) : <span key={`v${i}`} aria-hidden="true" />))}
        </div>
      </section>
    );
  }

  const campoTopo = (qual: "entrada" | "saida") => {
    const v = qual === "entrada" ? entrada : saida;
    return (
      <button type="button" className="cal-topo__campo" aria-current={foco === qual}
        onClick={() => { setFoco(qual === "saida" && entrada ? "saida" : "entrada"); if (!celular && qual === "saida" && entrada && !mesmoMes(mesDe(entrada), vista) && !mesmoMes(mesDe(entrada), somarMeses(vista, 1))) setVista(mesDe(entrada)); }}>
        <small>{qual === "entrada" ? "Check-in" : "Check-out"}</small>
        <b className={v ? "" : "vazio"}>{v ? dataCurta(v) : qual === "entrada" ? "Escolha a entrada" : "Escolha a saída"}</b>
        <i>{v ? DIAS_SEMANA[diaSemana(v)] : " "}</i>
      </button>
    );
  };

  const calendario = aberto && (
    <>
      {celular && <div className="cal-veu" onClick={() => fechar()} aria-hidden="true" />}
      <div ref={janela} role="dialog" aria-modal={celular} aria-label="Escolher as datas da estadia"
        className={`cal ${celular ? "cal--folha" : "cal--janela"}`}
        style={!celular && posicao ? { top: posicao.top, left: posicao.left, width: posicao.largura } : undefined}
        onMouseLeave={() => previa && setPrevia(null)}>
        <div className="cal-topo">
          {campoTopo("entrada")}
          <span className="cal-topo__seta" aria-hidden="true">→</span>
          {campoTopo("saida")}
          <div className="cal-topo__noites" aria-live="polite"><b>{noites ?? "–"}</b><small>{noites === 1 ? "noite" : "noites"}</small></div>
        </div>
        {celular ? (
          <>
            <div className="cal-semana cal-semana--fixa" aria-hidden="true">{DIAS_SEMANA.map((d) => <span key={d}>{d}</span>)}</div>
            <div ref={lista} className="cal-lista">
              {Array.from({ length: MESES_NO_CELULAR }, (_, i) => mes(somarMeses(mesHoje, i), false))}
            </div>
          </>
        ) : (
          <div className={`cal-corpo${anima ? ` cal-corpo--${anima}` : ""}`} key={chaveMes(vista)}>
            <button type="button" className="cal-nav cal-nav--ant" aria-label="Mês anterior" disabled={!mesAntes(mesHoje, vista)} onClick={() => mudarVista(-1)}>‹</button>
            {mes(vista, true)}
            {mes(somarMeses(vista, 1), true)}
            <button type="button" className="cal-nav cal-nav--prox" aria-label="Próximo mês" onClick={() => mudarVista(1)}>›</button>
          </div>
        )}
        <div className="cal-rodape">
          {!celular && (
            <div className="cal-legenda" aria-hidden="true">
              <span><i className="cal-legenda__ponta" />Entrada e saída</span>
              <span><i className="cal-legenda__faixa" />Noites</span>
              <span><i className="cal-legenda__feriado" />Feriado</span>
            </div>
          )}
          {falta && !noites && <p className="cal-falta" role="status">{entrada ? "Falta escolher a saída." : "Escolha a entrada e a saída."}</p>}
          <button type="button" className="cal-limpar" onClick={() => { setEntrada(null); setSaida(null); setFoco("entrada"); setPrevia(null); }}>Limpar</button>
          <button type="button" className="cal-confirmar" disabled={!noites} onClick={() => fechar()}>
            {noites ? `Confirmar · ${noitesTexto(noites)}` : entrada ? "Agora escolha a saída" : "Escolha a entrada"}
          </button>
        </div>
      </div>
    </>
  );

  const e = ESTILO[variante];
  const valor = (v: string | null) => (v ? `${dataBarra(v)} · ${DIAS_SEMANA[diaSemana(v)]}` : null);
  return (
    <>
      {(["entrada", "saida"] as const).map((qual) => {
        const v = valor(qual === "entrada" ? entrada : saida);
        return (
          <div key={qual} className={e.caixa}>
            <span className={e.rotulo} id={`rotulo-${variante}-${qual}`}>{qual === "entrada" ? "Check-in" : "Check-out"}</span>
            <button ref={qual === "entrada" ? btEntrada : btSaida} type="button" className={e.campo}
              aria-haspopup="dialog" aria-expanded={aberto} aria-labelledby={`rotulo-${variante}-${qual}`}
              aria-describedby={`valor-${variante}-${qual}`}
              onClick={() => abrir(qual)}>
              <span id={`valor-${variante}-${qual}`} className={v ? "" : "text-tinta-suave/60"}>{v ?? "Escolher data"}</span>
            </button>
          </div>
        );
      })}
      <input type="hidden" name="check_in" value={entrada ?? ""} />
      <input type="hidden" name="check_out" value={saida ?? ""} />
      {calendario && createPortal(calendario, document.body)}
    </>
  );
}
