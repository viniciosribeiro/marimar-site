"use client";

import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { classificarResposta, mesmaAcao } from "@/lib/marina-voz-base";

/**
 * Treinar a Marina POR VOZ, de qualquer tela do painel.
 *
 * É uma conversa de verdade: você fala, ela responde em áudio e vai puxando o
 * que falta aprender; e quando você pede, ela PROPÕE uma mudança no painel e
 * só faz depois do seu "sim". O cérebro é o mesmo da Marina (gateway do
 * OpenClaw); a voz é a mesma do WhatsApp (ElevenLabs). Dois modos:
 *
 *  • Viva voz  — ela ouve sozinha, espera você parar de falar e responde.
 *  • Apertar   — segure o botão para falar (bom para lugar barulhento).
 *
 * Regras que impedem travar (docs/modo-voz-treino.md, "Não trava"):
 *  - um contador de "época": Parar/Fechar invalida tudo o que estava no ar
 *    (resposta que chega depois não fala nem muda a tela) e nunca ficam dois
 *    ciclos de escuta rodando juntos;
 *  - todo pedido tem prazo (inclusive baixar o áudio) e toda reprodução tem
 *    teto; o estado SEMPRE volta (parado, ou ouvindo no viva voz);
 *  - confirmar é uma ROTA leve (/api/admin/marina/voz/acao), não Server Action:
 *    a resposta sai assim que grava e a página de trás atualiza sozinha depois;
 *  - "sim"/"não" claros são decididos aqui, sem ida à Marina; o resto vai a ela
 *    com a ação pendente, e se ela repropõe a MESMA ação vale como sim (fim do
 *    loop "confirma?" → "sim" → "confirma?");
 *  - tocar em Confirmar/Agora não durante o viva voz cala a Marina, descarta o
 *    que o microfone estava gravando e volta a ouvir depois.
 *
 * A janela é SÓLIDA (o painel tem uma regra que deixa todo `bg-white`
 * translúcido — por isso aqui o fundo é posto em estilo, não por classe),
 * arrastável, com minimizar/maximizar/redimensionar no computador e folha
 * responsiva no celular. A voz custa por fora (ElevenLabs): há um teto de
 * gasto no mês; se estourar, a voz pausa e o treino segue por texto.
 */

type Papel = "voce" | "marina" | "sistema";
type Fala = { id: number; papel: Papel; texto: string; editado?: boolean };
type Pilha = { desfazer: string | null; refazer: string | null };
type Gasto = { usoCentavos: number; limiteCentavos: number; nivel: "ok" | "aviso" | "estourou"; pct: number };
type Pendente = { nome: string; dados: Record<string, unknown>; descricao: string };
type Estado = "parado" | "ouvindo" | "pensando" | "salvando" | "falando";
type Gravacao = { blob: Blob | null; segundos: number; motivo: "fala" | "silencio" | "interrompido" | "parado" };

/** Silêncio que encerra uma fala (ms). */
const SILENCIO_MS = 1100;
const LIMIAR = 0.02;
const MIN_FALA_MS = 250;
/** Teto de UMA fala, contado de quando a pessoa COMEÇA a falar (antes contava do início da escuta e cortava frases). */
const MAX_FALA_MS = 30_000;
/** Sem ninguém falar por este tempo, o viva voz descansa (microfone não fica aberto à toa). */
const ESPERA_MAX_MS = 45_000;
/** Enquanto espera, o gravador recomeça a cada tantos ms — o áudio enviado não carrega silêncio longo (e o custo). */
const RECICLAR_MS = 8_000;
/** Arrastar o botão de gravar: tanto para a esquerda cancela, tanto para a direita trava (como no WhatsApp). */
const ARRASTO_PX = 70;
const AUDIO_MUDO = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

/** Nunca deixa um fetch travar: aborta depois de `ms` (inclusive a leitura do corpo). */
async function buscar(url: string, init: RequestInit, ms: number, externo?: AbortController): Promise<Response> {
  const controle = externo ?? new AbortController();
  const t = setTimeout(() => controle.abort(), ms);
  try {
    const r = await fetch(url, { ...init, signal: controle.signal });
    /* Lê o corpo DENTRO do prazo: o travamento antigo era o corpo do áudio que nunca terminava. */
    const corpo = await r.arrayBuffer();
    return new Response(corpo, { status: r.status, headers: r.headers });
  } finally {
    clearTimeout(t);
  }
}

const LARGURA_INICIAL = 384;
const ALTURA_INICIAL = 592;
const SUPERFICIE = "#ffffff";
const TINTA = "#1f2937";

export function VozTreino() {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [modo, setModo] = useState<"vivavoz" | "apertar">("vivavoz");
  const [estado, setEstado] = useState<Estado>("parado");
  const [falas, setFalas] = useState<Fala[]>([]);
  const [feito, setFeito] = useState<string[]>([]);
  const [pendente, setPendente] = useState<Pendente | null>(null);
  const [gasto, setGasto] = useState<Gasto | null>(null);
  const [reais, setReais] = useState<{ uso: string; limite: string } | null>(null);
  const [cap, setCap] = useState<{ gateway: boolean; voz: boolean } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [digitado, setDigitado] = useState("");
  const [pilha, setPilha] = useState<Pilha>({ desfazer: null, refazer: null });
  const [editando, setEditando] = useState<{ id: number; texto: string } | null>(null);
  /** Gravando no botão (segurando ou travado), com o arrasto e os segundos. */
  const [gravacao, setGravacao] = useState<{ dx: number; travado: boolean; seg: number } | null>(null);
  // Como a Marina responde: falando (voz) ou só por texto (economiza TTS).
  const [vozResposta, setVozResposta] = useState<boolean>(() => {
    try { return localStorage.getItem("marimar_voz_resposta") !== "texto"; } catch { return true; }
  });
  const vozRespostaRef = useRef(true);
  useEffect(() => {
    vozRespostaRef.current = vozResposta;
    try { localStorage.setItem("marimar_voz_resposta", vozResposta ? "voz" : "texto"); } catch {}
  }, [vozResposta]);

  // janela
  const [celular, setCelular] = useState(false);
  const [min, setMin] = useState(false);
  const [max, setMax] = useState(false);
  const [pos, setPos] = useState({ x: 24, y: 24 });
  const [tam, setTam] = useState({ w: LARGURA_INICIAL, h: ALTURA_INICIAL });

  const sessaoRef = useRef<string>("");
  const histRef = useRef<{ papel: "voce" | "marina"; conteudo: string }[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const acRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mrRef = useRef<MediaRecorder | null>(null);
  const capRef = useRef<{ gateway: boolean; voz: boolean } | null>(null);
  /** Cada Parar/Fechar avança a época; o que começou antes dela não fala nem mexe na tela. */
  const epocaRef = useRef(0);
  const abertoRef = useRef(false);
  const pararRef = useRef(false);
  const canceladoRef = useRef(false);
  const interrompidoRef = useRef(false);
  const pendenteRef = useRef<Pendente | null>(null);
  const lacoAtivoRef = useRef(false);
  /** Confirmar/Agora não/Enviar texto em andamento: o viva voz espera por ele antes de voltar a ouvir. */
  const operacaoRef = useRef<Promise<void> | null>(null);
  const pedidoRef = useRef<AbortController | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioLiberado = useRef(false);
  const tocandoRef = useRef<(() => void) | null>(null);
  const modoRef = useRef(modo);
  const estadoCaixa = useRef<Estado>("parado");
  const arrastarRef = useRef<{ dx: number; dy: number } | null>(null);
  const redimRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const corpoRolagem = useRef<HTMLDivElement | null>(null);
  const proxId = useRef(1);
  const arrastoRef = useRef<{ x0: number; travado: boolean } | null>(null);

  useEffect(() => { modoRef.current = modo; }, [modo]);
  useEffect(() => { capRef.current = cap; }, [cap]);
  const mudarEstado = useCallback((e: Estado) => { estadoCaixa.current = e; setEstado(e); }, []);
  const definirPendente = useCallback((p: Pendente | null) => { pendenteRef.current = p; setPendente(p); }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const ler = () => setCelular(mq.matches);
    ler();
    mq.addEventListener?.("change", ler);
    return () => mq.removeEventListener?.("change", ler);
  }, []);

  const log = useCallback((papel: Papel, texto: string) => {
    if (!texto) return;
    setFalas((f) => [...f, { id: proxId.current++, papel, texto }].slice(-40));
    if (papel !== "sistema") histRef.current = [...histRef.current, { papel, conteudo: texto }].slice(-12);
  }, []);

  /* rola a conversa para o fim quando chega fala nova */
  useEffect(() => {
    const el = corpoRolagem.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [falas, pendente, feito]);

  /* ── estado inicial ao abrir ─────────────────────────────────────── */
  const carregarEstado = useCallback(async () => {
    try {
      const r = await buscar("/api/admin/marina/voz/estado", {}, 12000);
      const d = await r.json();
      if (!r.ok) { setAviso(d?.erro ?? "Não consegui abrir o modo voz."); return; }
      setCap({ gateway: d.gateway, voz: d.voz });
      if (d.pilha) setPilha(d.pilha);
      setGasto(d.gasto); setReais(d.reais);
      if (!d.gateway) setAviso("A Marina ainda não está ligada a este site. Fale com quem cuida da Vercel.");
      else if (!d.voz) setAviso("A voz ainda não está configurada. Você pode treinar por texto; para ouvir e falar, configure em Marina → Voz.");
      else if (d.gasto?.nivel === "estourou") setAviso("A voz atingiu o teto de gasto do mês. Dá para continuar por texto.");

      // Retoma a conversa anterior (a Marina lembra onde paramos).
      const turnos: Fala[] = Array.isArray(d.ultima?.turnos)
        ? d.ultima.turnos.filter((t: Fala) => t && (t.papel === "voce" || t.papel === "marina") && typeof t.texto === "string")
        : [];
      if (turnos.length) {
        histRef.current = turnos.map((t) => ({ papel: t.papel as "voce" | "marina", conteudo: t.texto })).slice(-12);
        const quando = d.ultima?.quando ? new Date(d.ultima.quando).toLocaleDateString("pt-BR") : "";
        setFalas([{ id: proxId.current++, papel: "sistema", texto: quando ? `— retomando a conversa de ${quando} —` : "— retomando a conversa anterior —" }, ...turnos.map((t) => ({ ...t, id: proxId.current++ }))]);
      }
    } catch {
      setAviso("Não consegui abrir o modo voz agora. Feche e abra de novo daqui a pouco.");
    }
  }, []);

  /* ── áudio de saída: um só elemento, liberado num toque (iPhone) ─── */
  const destravarAudio = useCallback(() => {
    if (!audioRef.current) audioRef.current = new Audio();
    if (audioLiberado.current) return;
    audioLiberado.current = true;
    const a = audioRef.current;
    try { a.src = AUDIO_MUDO; a.play().then(() => a.pause()).catch(() => {}); } catch {}
  }, []);

  /** Cala a Marina na hora (e libera quem esperava o fim da fala). */
  const calarMarina = useCallback(() => {
    const fim = tocandoRef.current;
    tocandoRef.current = null;
    try { audioRef.current?.pause(); } catch {}
    fim?.();
  }, []);

  /* ── microfone + medidor de volume ───────────────────────────────── */
  const garantirMic = useCallback(async (): Promise<boolean> => {
    if (streamRef.current) return true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ac = new AC();
      const fonte = ac.createMediaStreamSource(stream);
      const analyser = ac.createAnalyser();
      analyser.fftSize = 2048;
      fonte.connect(analyser);
      acRef.current = ac; analyserRef.current = analyser;
      return true;
    } catch {
      setAviso("Não consegui usar o microfone. Dê permissão ao navegador (cadeado ao lado do endereço) ou treine por texto.");
      return false;
    }
  }, []);

  const volume = useCallback((): number => {
    const a = analyserRef.current;
    if (!a) return 0;
    const buf = new Float32Array(a.fftSize);
    a.getFloatTimeDomainData(buf);
    let soma = 0;
    for (let i = 0; i < buf.length; i++) soma += buf[i] * buf[i];
    return Math.sqrt(soma / buf.length);
  }, []);

  /** Um trecho de gravação. Sem fala em RECICLAR_MS, devolve "reciclar" (o chamador recomeça). */
  const gravarTrecho = useCallback((): Promise<Gravacao | "reciclar"> => {
    return new Promise((resolve) => {
      const stream = streamRef.current;
      if (!stream) return resolve({ blob: null, segundos: 0, motivo: "parado" });
      const tipo = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      let mr: MediaRecorder;
      try { mr = new MediaRecorder(stream, tipo ? { mimeType: tipo } : undefined); }
      catch { return resolve({ blob: null, segundos: 0, motivo: "parado" }); }
      mrRef.current = mr;
      canceladoRef.current = false;
      const partes: Blob[] = [];
      let teveFala = false, reciclar = false;
      const inicio = Date.now();
      let inicioFala = 0, ultimaFala = Date.now();

      mr.ondataavailable = (e) => { if (e.data.size) partes.push(e.data); };
      mr.onstop = () => {
        clearInterval(timer);
        if (mrRef.current === mr) mrRef.current = null;
        const segundos = (Date.now() - inicio) / 1000;
        if (interrompidoRef.current) { interrompidoRef.current = false; return resolve({ blob: null, segundos, motivo: "interrompido" }); }
        if (canceladoRef.current || pararRef.current) return resolve({ blob: null, segundos, motivo: "parado" });
        if (reciclar) return resolve("reciclar");
        if (!teveFala) return resolve({ blob: null, segundos, motivo: "silencio" });
        resolve({ blob: new Blob(partes, { type: tipo || "audio/webm" }), segundos, motivo: "fala" });
      };

      const timer = setInterval(() => {
        if (pararRef.current) { try { mr.stop(); } catch {} return; }
        const agora = Date.now();
        if (volume() > LIMIAR) { if (!teveFala) inicioFala = agora; teveFala = true; ultimaFala = agora; }
        const terminou = teveFala && agora - ultimaFala > SILENCIO_MS && agora - inicioFala > MIN_FALA_MS;
        const longaDemais = teveFala && agora - inicioFala > MAX_FALA_MS;
        if (terminou || longaDemais) { try { mr.stop(); } catch {} return; }
        if (!teveFala && agora - inicio > RECICLAR_MS) { reciclar = true; try { mr.stop(); } catch {} }
      }, 60);

      try { mr.start(); } catch { clearInterval(timer); resolve({ blob: null, segundos: 0, motivo: "parado" }); }
    });
  }, [volume]);

  /** Grava até a pessoa falar e parar. Sem ninguém falar por ESPERA_MAX_MS → "silencio". */
  const gravarUmaFala = useCallback(async (): Promise<Gravacao> => {
    const inicio = Date.now();
    for (;;) {
      if (pararRef.current) return { blob: null, segundos: 0, motivo: "parado" };
      const r = await gravarTrecho();
      if (r !== "reciclar") return r;
      if (Date.now() - inicio > ESPERA_MAX_MS) return { blob: null, segundos: 0, motivo: "silencio" };
    }
  }, [gravarTrecho]);

  /** Para o que o microfone estava gravando, SEM encerrar o viva voz. */
  const interromperGravacao = useCallback(() => {
    if (!mrRef.current) return;
    interrompidoRef.current = true;
    try { mrRef.current.stop(); } catch {}
  }, []);

  /* ── parar tudo (o botão vermelho e o fechar) ───────────────────── */
  const pararTudo = useCallback(() => {
    epocaRef.current += 1;
    lacoAtivoRef.current = false;
    pararRef.current = true;
    canceladoRef.current = true;
    try { mrRef.current?.stop(); } catch {}
    try { pedidoRef.current?.abort(); } catch {}
    calarMarina();
    mudarEstado("parado");
  }, [calarMarina, mudarEstado]);

  /* ── ouvir (fala → texto) ────────────────────────────────────────── */
  const transcrever = useCallback(async (blob: Blob, segundos: number): Promise<string | null> => {
    const fd = new FormData();
    fd.append("audio", blob, "fala.webm");
    fd.append("sessao", sessaoRef.current);
    fd.append("segundos", String(Math.round(segundos)));
    const epoca = epocaRef.current;
    const controle = new AbortController();
    pedidoRef.current = controle;
    try {
      const r = await buscar("/api/admin/marina/voz/ouvir", { method: "POST", body: fd }, 20000, controle);
      const d = await r.json().catch(() => ({}));
      if (r.status === 402) {
        if (d.gasto) setGasto(d.gasto);
        setAviso("A voz atingiu o teto do mês. Continue por texto.");
        pararTudo();
        return null;
      }
      if (!r.ok) { setAviso(d?.erro ?? "Não entendi o áudio."); return null; }
      return typeof d.texto === "string" && d.texto.trim() ? d.texto.trim() : null;
    } catch {
      if (epocaRef.current === epoca) setAviso("Não consegui entender o áudio. Pode repetir?"); // parar não é erro
      return null;
    }
  }, [pararTudo]);

  /* ── falar (texto → áudio) ───────────────────────────────────────── */
  const falar = useCallback(async (texto: string): Promise<void> => {
    // Em modo "só texto" a resposta aparece escrita e nenhum áudio é gerado (sem custo de TTS).
    if (!capRef.current?.voz || !vozRespostaRef.current || !abertoRef.current || !texto) return;
    const epoca = epocaRef.current;
    try {
      const r = await buscar("/api/admin/marina/voz/falar", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessao: sessaoRef.current, texto }),
      }, 15000);
      if (r.status === 402) { setAviso("A voz atingiu o teto do mês. Continue por texto."); return; }
      if (!r.ok || epocaRef.current !== epoca || !abertoRef.current) return;
      const url = URL.createObjectURL(await r.blob());
      if (!audioRef.current) audioRef.current = new Audio();
      const audio = audioRef.current;
      mudarEstado("falando");
      // Nunca trava na reprodução: um teto (pelo tamanho do texto) garante que o
      // fluxo siga mesmo se o navegador não disparar "ended" (áudio bloqueado…).
      await new Promise<void>((resolve) => {
        let acabou = false;
        const fim = () => {
          if (acabou) return;
          acabou = true; clearTimeout(t);
          audio.onended = null; audio.onerror = null;
          if (tocandoRef.current === fim) tocandoRef.current = null;
          resolve();
        };
        const t = setTimeout(fim, Math.min(60000, 6000 + texto.length * 90));
        tocandoRef.current = fim;
        audio.onended = fim; audio.onerror = fim;
        audio.src = url;
        audio.play().catch(fim);
      });
      URL.revokeObjectURL(url);
    } catch { /* fica só o texto na tela */ }
  }, [mudarEstado]);

  /* ── a resposta a um "confirma?" ─────────────────────────────────── */
  const confirmar = useCallback(async (p: Pendente, fala: string) => {
    const epoca = epocaRef.current;
    definirPendente(null);
    mudarEstado("salvando");
    let r: { ok: boolean; mensagem: string };
    try {
      const resp = await buscar("/api/admin/marina/voz/acao", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessao: sessaoRef.current, nome: p.nome, dados: p.dados, fala }),
      }, 20000);
      const d = await resp.json().catch(() => null);
      r = resp.status === 401
        ? { ok: false, mensagem: "Sua entrada no painel expirou. Entre de novo e repita." }
        : { ok: Boolean(d?.ok), mensagem: typeof d?.mensagem === "string" ? d.mensagem : "Não consegui gravar agora." };
      if (d?.pilha) setPilha(d.pilha);
    } catch {
      r = { ok: false, mensagem: "Demorou demais para gravar. Confira na tela se mudou e, se não, peça de novo." };
    }
    // O resultado SEMPRE aparece (mesmo se a pessoa parou no meio): é o registro do que mudou.
    log("marina", r.mensagem);
    if (r.ok) {
      setFeito((f) => [...f, r.mensagem]);
      startTransition(() => router.refresh()); // a tela de trás mostra a mudança, sem prender a conversa
    }
    if (epocaRef.current === epoca) await falar(r.ok ? "Pronto!" : "Não consegui agora.");
    if (!lacoAtivoRef.current && epocaRef.current === epoca) mudarEstado("parado");
  }, [falar, log, router, mudarEstado, definirPendente]);

  const cancelarPendente = useCallback(async (fala: string) => {
    const epoca = epocaRef.current;
    definirPendente(null);
    log("marina", "Tudo bem, não vou mexer nisso.");
    // Fica na conversa (para a Marina lembrar), sem esperar.
    fetch("/api/admin/marina/voz/acao", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessao: sessaoRef.current, cancelar: true, fala }),
    }).catch(() => {});
    if (epocaRef.current === epoca) await falar("Tudo bem, não vou mexer nisso.");
    if (!lacoAtivoRef.current && epocaRef.current === epoca) mudarEstado("parado");
  }, [falar, log, mudarEstado, definirPendente]);

  /* ── desfazer / refazer (botões do topo e "desfaz isso" falado) ── */
  const executarDesfazer = useCallback(async (sentido: "desfazer" | "refazer") => {
    const epoca = epocaRef.current;
    mudarEstado("salvando");
    let r: { ok: boolean; mensagem: string };
    try {
      const resp = await buscar("/api/admin/marina/voz/desfazer", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sentido }),
      }, 20000);
      const d = await resp.json().catch(() => null);
      if (d?.pilha) setPilha(d.pilha);
      r = { ok: Boolean(d?.ok), mensagem: typeof d?.mensagem === "string" ? d.mensagem : "Não consegui agora." };
    } catch {
      r = { ok: false, mensagem: "Demorou demais. Confira na tela e tente de novo." };
    }
    log("marina", r.mensagem);
    if (r.ok) {
      setFeito((f) => [...f, `${sentido === "desfazer" ? "↶" : "↷"} ${r.mensagem}`]);
      startTransition(() => router.refresh());
    }
    if (epocaRef.current === epoca) await falar(r.ok ? (sentido === "desfazer" ? "Pronto, desfiz." : "Pronto, refiz.") : "Não consegui.");
    if (!lacoAtivoRef.current && epocaRef.current === epoca) mudarEstado("parado");
  }, [falar, log, router, mudarEstado]);

  /* ── um turno com a Marina ───────────────────────────────────────── */
  const conversar = useCallback(async (texto: string, opc?: { registrar?: boolean }) => {
    const epoca = epocaRef.current;
    const historico = histRef.current.slice(); // ANTES de registrar a fala nova (senão ela ia duas vezes)
    if (opc?.registrar === false) histRef.current = [...histRef.current, { papel: "voce" as const, conteudo: texto }].slice(-12);
    else log("voce", texto);

    /* "desfaz isso" / "refaz": os mesmos botões do topo, falados. */
    const comando = /^\s*(desfaz|desfazer|desfa[cç]a|volta atr[aá]s|anula)\b/i.test(texto) ? "desfazer"
      : /^\s*(refaz|refazer|refa[cç]a)\b/i.test(texto) ? "refazer" : null;
    if (comando === "desfazer" && pendenteRef.current) { await cancelarPendente(texto); return; }
    if (comando) { await executarDesfazer(comando); return; }

    /* Havia um "confirma?" no ar: sim/não claros resolvem aqui, sem ida à Marina. */
    const p = pendenteRef.current;
    let contexto: { pendente: Pendente; situacao: "outra" | "corrige" } | null = null;
    if (p) {
      const c = classificarResposta(texto);
      if (c === "sim") { await confirmar(p, texto); return; }
      if (c === "nao") { await cancelarPendente(texto); return; }
      if (c === "corrige") definirPendente(null);
      contexto = { pendente: p, situacao: c === "corrige" ? "corrige" : "outra" };
    }

    mudarEstado("pensando");
    const controle = new AbortController();
    pedidoRef.current = controle;
    try {
      const r = await buscar("/api/admin/marina/voz/conversar", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessao: sessaoRef.current, mensagem: texto, historico,
          ...(contexto ? { pendente: contexto.pendente, situacao: contexto.situacao } : {}),
        }),
      }, 40000, controle);
      if (epocaRef.current !== epoca) return; // a pessoa parou no meio: não fala nem muda a tela
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { const m = d?.erro ?? "Não consegui falar com a Marina."; log("marina", m); setAviso(m); return; }
      setAviso(null);
      if (d.gasto) { setGasto(d.gasto); if (d.gasto.nivel === "aviso") setAviso("Atenção: a voz já passou de " + d.gasto.pct + "% do teto do mês."); }
      const nova: Pendente | null = d.acao && d.acao.valido ? { nome: d.acao.nome, dados: d.acao.dados ?? {}, descricao: d.acao.descricao } : null;

      /* Fim do loop: ela repropôs a MESMA ação depois de a pessoa responder → é um sim. */
      if (contexto?.situacao === "outra" && nova && mesmaAcao(nova, contexto.pendente)) {
        if (pendenteRef.current === contexto.pendente) await confirmar(contexto.pendente, texto);
        return;
      }
      log("marina", d.resposta);
      if (nova) definirPendente(nova);
      await falar(d.resposta);
    } catch {
      if (epocaRef.current === epoca) log("marina", "Demorei demais para responder. Pode falar de novo?");
    }
  }, [confirmar, cancelarPendente, executarDesfazer, falar, log, mudarEstado, definirPendente]);

  /* ── viva voz: ouvir → entender → responder, em ciclo ───────────── */
  const laco = useCallback(async () => {
    if (lacoAtivoRef.current) return; // nunca dois ciclos juntos
    const epoca = epocaRef.current;
    lacoAtivoRef.current = true;
    pararRef.current = false;
    try {
      while (epocaRef.current === epoca && modoRef.current === "vivavoz") {
        if (operacaoRef.current) { await operacaoRef.current; continue; } // um botão está agindo: espera
        mudarEstado("ouvindo");
        const pendenteAntes = pendenteRef.current;
        const g = await gravarUmaFala();
        if (epocaRef.current !== epoca) break;
        if (g.motivo === "interrompido") continue;
        if (g.motivo === "silencio") { log("sistema", "Fiquei sem ouvir nada por um tempo e pausei. Toque no microfone para continuar."); break; }
        if (!g.blob) break;
        mudarEstado("pensando");
        const texto = await transcrever(g.blob, g.segundos);
        if (epocaRef.current !== epoca) break;
        if (!texto) continue;
        // A fala respondia a um "confirma?" que um botão já resolveu enquanto ela falava: descarta.
        if (pendenteAntes && pendenteRef.current !== pendenteAntes) continue;
        await conversar(texto);
      }
    } finally {
      if (epocaRef.current === epoca) { lacoAtivoRef.current = false; mudarEstado("parado"); }
    }
  }, [gravarUmaFala, transcrever, conversar, log, mudarEstado]);

  const iniciarVivaVoz = useCallback(async () => {
    setAviso(null);
    destravarAudio();
    if (!(await garantirMic())) return;
    acRef.current?.resume().catch(() => {});
    laco();
  }, [destravarAudio, garantirMic, laco]);

  /* ── botões Confirmar / Agora não, e o campo de texto ───────────── */
  /** Roda uma operação "por fora" do viva voz: cala a Marina, descarta a gravação em curso e o ciclo espera. */
  const operar = useCallback((op: () => Promise<void>) => {
    destravarAudio();
    calarMarina();
    if (lacoAtivoRef.current) interromperGravacao();
    // Se já havia uma em curso, esta entra na fila (nunca é ignorada).
    const anterior = operacaoRef.current ?? Promise.resolve();
    const feita: Promise<void> = anterior.then(op).catch(() => {}).finally(() => {
      if (operacaoRef.current === feita) operacaoRef.current = null;
    });
    operacaoRef.current = feita;
  }, [destravarAudio, calarMarina, interromperGravacao]);

  const responderPeloBotao = useCallback((sim: boolean) => {
    const p = pendenteRef.current;
    if (!p) return;
    definirPendente(null); // o cartão some no 1º toque: não há segundo "Confirmar"
    operar(() => (sim ? confirmar(p, "(confirmou pelo botão)") : cancelarPendente("(recusou pelo botão)")));
  }, [operar, confirmar, cancelarPendente, definirPendente]);

  const enviarDigitado = useCallback(() => {
    const t = digitado.trim();
    if (!t) return;
    setDigitado("");
    operar(async () => {
      const epoca = epocaRef.current;
      await conversar(t);
      if (!lacoAtivoRef.current && epocaRef.current === epoca) mudarEstado("parado");
    });
  }, [digitado, operar, conversar, mudarEstado]);

  /** Corrigir o texto de uma fala já enviada (a transcrição errou uma palavra). */
  const corrigirFala = useCallback((id: number, novo: string) => {
    const f = falas.find((x) => x.id === id);
    const t = novo.trim();
    setEditando(null);
    if (!f || !t || t === f.texto) return;
    setFalas((lista) => lista.map((x) => (x.id === id ? { ...x, texto: t, editado: true } : x)));
    definirPendente(null); // o que ela propôs veio do texto errado
    operar(async () => {
      const epoca = epocaRef.current;
      await conversar(`Corrigindo o que eu disse antes («${f.texto}»): ${t}`, { registrar: false });
      if (!lacoAtivoRef.current && epocaRef.current === epoca) mudarEstado("parado");
    });
  }, [falas, operar, conversar, mudarEstado, definirPendente]);

  /* ── segurar para falar (como o áudio do WhatsApp) ──────────────────
     Segura e fala; solta → envia. Arrasta para a ESQUERDA → cancela.
     Arrasta para a DIREITA → trava (pode soltar o dedo); depois toca em
     Enviar (ou na lixeira). */
  const inicioApertar = useRef(0);
  const comecarApertar = useCallback(async () => {
    if (estadoCaixa.current !== "parado") return;
    setAviso(null);
    destravarAudio();
    if (!(await garantirMic())) { arrastoRef.current = null; setGravacao(null); return; }
    /* Soltou (ou cancelou) enquanto o navegador pedia o microfone: não começa. */
    if (!arrastoRef.current) return;
    acRef.current?.resume().catch(() => {});
    const epoca = epocaRef.current;
    const stream = streamRef.current!;
    const tipo = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
    const mr = new MediaRecorder(stream, tipo ? { mimeType: tipo } : undefined);
    mrRef.current = mr; canceladoRef.current = false; pararRef.current = false;
    const partes: Blob[] = [];
    inicioApertar.current = Date.now();
    mr.ondataavailable = (e) => { if (e.data.size) partes.push(e.data); };
    mr.onstop = async () => {
      if (mrRef.current === mr) mrRef.current = null;
      if (canceladoRef.current || epocaRef.current !== epoca) return;
      const seg = (Date.now() - inicioApertar.current) / 1000;
      if (seg < 0.5) { setAviso("Segure o botão enquanto fala e solte para enviar."); mudarEstado("parado"); return; }
      mudarEstado("pensando");
      const texto = await transcrever(new Blob(partes, { type: tipo || "audio/webm" }), seg);
      if (texto && epocaRef.current === epoca) await conversar(texto);
      if (epocaRef.current === epoca) mudarEstado("parado");
    };
    mr.start();
    mudarEstado("ouvindo");
  }, [destravarAudio, garantirMic, transcrever, conversar, mudarEstado]);

  const soltarApertar = useCallback(() => {
    try { mrRef.current?.stop(); } catch {}
  }, []);

  const cancelarGravacao = useCallback(() => {
    arrastoRef.current = null;
    setGravacao(null);
    canceladoRef.current = true;
    try { mrRef.current?.stop(); } catch {}
    try { navigator.vibrate?.(30); } catch {}
    mudarEstado("parado");
  }, [mudarEstado]);

  const enviarGravacao = useCallback(() => {
    arrastoRef.current = null;
    setGravacao(null);
    soltarApertar();
  }, [soltarApertar]);

  const aoSegurar = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (estadoCaixa.current !== "parado" || arrastoRef.current) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    arrastoRef.current = { x0: e.clientX, travado: false };
    inicioApertar.current = Date.now();
    setGravacao({ dx: 0, travado: false, seg: 0 });
    comecarApertar();
  }, [comecarApertar]);

  const aoArrastarGravando = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const a = arrastoRef.current;
    if (!a || a.travado) return;
    const dx = e.clientX - a.x0;
    if (dx < -ARRASTO_PX) { cancelarGravacao(); return; }
    if (dx > ARRASTO_PX) {
      a.travado = true;
      try { navigator.vibrate?.(20); } catch {}
      setGravacao((g) => (g ? { ...g, dx: 0, travado: true } : g));
      return;
    }
    setGravacao((g) => (g ? { ...g, dx } : g));
  }, [cancelarGravacao]);

  const aoSoltar = useCallback(() => {
    const a = arrastoRef.current;
    if (!a || a.travado) return; // travado: continua gravando até tocar em Enviar
    enviarGravacao();
  }, [enviarGravacao]);

  /* relógio da gravação */
  const gravando = gravacao !== null;
  useEffect(() => {
    if (!gravando) return;
    const t = setInterval(() => {
      setGravacao((g) => (g ? { ...g, seg: Math.max(0, Math.floor((Date.now() - inicioApertar.current) / 1000)) } : g));
    }, 250);
    return () => clearInterval(t);
  }, [gravando]);

  /* ── abrir / fechar ──────────────────────────────────────────────── */
  const abrir = useCallback(async () => {
    sessaoRef.current = crypto.randomUUID();
    histRef.current = [];
    abertoRef.current = true;
    setFalas([]); setFeito([]); definirPendente(null); setAviso(null);
    setMin(false); setMax(false);
    if (typeof window !== "undefined" && !window.matchMedia("(max-width: 639px)").matches) {
      const w = LARGURA_INICIAL, h = ALTURA_INICIAL;
      setTam({ w, h });
      setPos({ x: Math.max(16, Math.round((window.innerWidth - w) / 2)), y: Math.max(16, Math.round((window.innerHeight - h) / 2)) });
    }
    setAberto(true);
    await carregarEstado();
  }, [carregarEstado, definirPendente]);

  const fechar = useCallback(() => {
    abertoRef.current = false;
    pararTudo();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    acRef.current?.close().catch(() => {});
    acRef.current = null; analyserRef.current = null;
    setAberto(false);
  }, [pararTudo]);

  useEffect(() => () => {
    abertoRef.current = false;
    epocaRef.current += 1;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    acRef.current?.close().catch(() => {});
    try { audioRef.current?.pause(); } catch {}
  }, []);

  /* ── arrastar e redimensionar (computador) ──────────────────────── */
  const aoArrastar = (e: React.PointerEvent) => {
    if (celular || max) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    arrastarRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
  };
  const moverArrasto = (e: React.PointerEvent) => {
    if (!arrastarRef.current) return;
    const w = tam.w, h = min ? 56 : tam.h;
    const x = Math.max(8, Math.min(window.innerWidth - w - 8, e.clientX - arrastarRef.current.dx));
    const y = Math.max(8, Math.min(window.innerHeight - h - 8, e.clientY - arrastarRef.current.dy));
    setPos({ x, y });
  };
  const soltarArrasto = () => { arrastarRef.current = null; };

  const aoRedim = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    redimRef.current = { x: e.clientX, y: e.clientY, w: tam.w, h: tam.h };
  };
  const moverRedim = (e: React.PointerEvent) => {
    if (!redimRef.current) return;
    const w = Math.max(300, Math.min(window.innerWidth - pos.x - 8, redimRef.current.w + (e.clientX - redimRef.current.x)));
    const h = Math.max(360, Math.min(window.innerHeight - pos.y - 8, redimRef.current.h + (e.clientY - redimRef.current.y)));
    setTam({ w, h });
  };
  const soltarRedim = () => { redimRef.current = null; };

  /* ── visual ──────────────────────────────────────────────────────── */
  const ocupada = estado === "pensando" || estado === "salvando" || estado === "falando";
  const semParar = (e: React.PointerEvent) => e.stopPropagation();

  const cabecalho = (
    <div
      onPointerDown={aoArrastar}
      onPointerMove={moverArrasto}
      onPointerUp={soltarArrasto}
      className="flex items-center justify-between gap-2 px-3 py-2.5 select-none"
      style={{ borderBottom: "1px solid rgba(12,38,56,.1)", cursor: celular || max ? "default" : "grab", touchAction: "none" }}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: "#e0f2f1", color: "#0f766e" }}><IconeMic small /></span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">Treinar a Marina por voz</p>
          <p className="truncate text-[11px] leading-tight" style={{ color: "#6b7280" }}>{rotuloEstado(estado)}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1" onPointerDown={semParar}>
        <BotaoJanela titulo={pilha.desfazer ? `Desfazer: ${pilha.desfazer}` : "Nada para desfazer"} desligado={!pilha.desfazer || ocupada}
          onClick={() => operar(() => executarDesfazer("desfazer"))}><IconeDesfazer /></BotaoJanela>
        <BotaoJanela titulo={pilha.refazer ? `Refazer: ${pilha.refazer}` : "Nada para refazer"} desligado={!pilha.refazer || ocupada}
          onClick={() => operar(() => executarDesfazer("refazer"))}><IconeDesfazer refazer /></BotaoJanela>
        {!celular && (
          <>
            <BotaoJanela titulo="Minimizar" onClick={() => setMin((v) => !v)}><IconeMenos /></BotaoJanela>
            <BotaoJanela titulo={max ? "Restaurar" : "Maximizar"} onClick={() => { setMax((v) => !v); setMin(false); }}><IconeQuadrado /></BotaoJanela>
          </>
        )}
        <BotaoJanela titulo="Fechar" onClick={fechar}><IconeX /></BotaoJanela>
      </div>
    </div>
  );

  const corpo = (
    <>
      {aviso && <p className="px-4 py-2 text-[12px]" style={{ background: "#fef3c7", color: "#92400e" }}>{aviso}</p>}
      {gasto && gasto.limiteCentavos > 0 && (
        <div className="px-4 pt-2">
          <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "#edf0f2" }}>
            <div className="h-full rounded-full transition-all" style={{ width: Math.min(100, gasto.pct) + "%", background: gasto.nivel === "estourou" ? "#dc2626" : gasto.nivel === "aviso" ? "#d97706" : "#0ea5a3" }} />
          </div>
          {reais && <p className="mt-0.5 text-right text-[10px]" style={{ color: "#9aa3ab" }}>voz do mês: {reais.uso} de {reais.limite} (estimativa)</p>}
        </div>
      )}

      <div ref={corpoRolagem} className="flex-1 space-y-2 overflow-y-auto px-4 py-3" style={{ minHeight: 0 }}>
        {falas.length === 0 && (
          <p className="py-6 text-center text-[13px]" style={{ color: "#9aa3ab" }}>
            {modo === "vivavoz" ? "Toque no microfone e fale. A Marina ouve, responde e vai te perguntando o que falta." : "Segure o botão e fale. Solte quando terminar."}
          </p>
        )}
        {falas.map((f) => (
          f.papel === "sistema" ? (
            <div key={f.id} className="py-1 text-center text-[11px]" style={{ color: "#9aa3ab" }}>{f.texto}</div>
          ) : f.papel === "voce" && editando?.id === f.id ? (
            <div key={f.id} className="ml-auto max-w-[92%] rounded-2xl p-2" style={{ background: "#f0f9ff", border: "1px solid #bae6fd" }}>
              <label className="sr-only" htmlFor={`editar-${f.id}`}>Corrigir o que você disse</label>
              <textarea id={`editar-${f.id}`} autoFocus rows={2} value={editando.texto}
                onChange={(e) => setEditando({ id: f.id, texto: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); corrigirFala(f.id, editando.texto); } if (e.key === "Escape") setEditando(null); }}
                className="w-full resize-none rounded-xl px-2.5 py-1.5 text-[13px] outline-none" style={{ border: "1px solid #e5e7eb", background: "#fff", color: TINTA }} />
              <div className="mt-1.5 flex justify-end gap-2">
                <button type="button" onClick={() => setEditando(null)} className="rounded-full px-3 py-1 text-[12px]" style={{ background: "#fff", color: "#4b5563", border: "1px solid #e5e7eb" }}>Cancelar</button>
                <button type="button" onClick={() => corrigirFala(f.id, editando.texto)} className="rounded-full px-3 py-1 text-[12px] font-semibold text-white" style={{ background: "#0284c7" }}>Enviar correção</button>
              </div>
            </div>
          ) : (
            <div key={f.id} className={f.papel === "voce" ? "group flex items-end justify-end gap-1" : "text-left"}>
              {f.papel === "voce" && (
                <button type="button" onClick={() => setEditando({ id: f.id, texto: f.texto })}
                  aria-label="Corrigir o que eu disse" title="Corrigir o texto"
                  className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full opacity-70 transition hover:opacity-100 focus-visible:opacity-100"
                  style={{ color: "#64748b" }}><IconeLapis /></button>
              )}
              <span className="inline-block max-w-[85%] rounded-2xl px-3 py-1.5 text-left text-[13px]"
                style={f.papel === "voce" ? { background: "#0284c7", color: "#fff" } : { background: "#eef1f4", color: TINTA }}>
                {f.texto}{f.editado && <span className="ml-1 text-[10px] opacity-75">(corrigido)</span>}
              </span>
            </div>
          )
        ))}
      </div>

      {pendente && (
        <div className="mx-4 mb-2 rounded-2xl p-3" style={{ background: "#ecfdf5", border: "1px solid #a7f3d0" }}>
          <p className="text-[12px]" style={{ color: "#065f46" }}>A Marina quer <strong>{pendente.descricao}</strong>. Confirma?</p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => responderPeloBotao(true)} className="rounded-full px-3 py-1 text-[12px] font-semibold text-white" style={{ background: "#0d9488" }}>Confirmar</button>
            <button type="button" onClick={() => responderPeloBotao(false)} className="rounded-full px-3 py-1 text-[12px] font-medium" style={{ background: "#fff", color: "#4b5563", border: "1px solid #e5e7eb" }}>Agora não</button>
          </div>
        </div>
      )}

      {feito.length > 0 && (
        <div className="mx-4 mb-2 rounded-xl p-2" style={{ background: "#f6f8fa" }}>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#9aa3ab" }}>Feito nesta conversa</p>
          <ul className="space-y-0.5">
            {feito.map((f, i) => <li key={i} className="text-[11px]" style={{ color: "#4b5563" }}>✓ {f}</li>)}
          </ul>
        </div>
      )}

      <div className="p-3" style={{ borderTop: "1px solid rgba(12,38,56,.1)" }}>
        {cap?.voz && (
          /* Como VOCÊ fala (viva voz ou segurando) e como ELA responde (voz ou texto). */
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex rounded-full p-0.5 text-[12px] font-medium" style={{ background: "#f1f3f5" }} role="group" aria-label="Como você fala">
              <button type="button" onClick={() => { pararTudo(); setModo("vivavoz"); }} aria-pressed={modo === "vivavoz"}
                className="rounded-full px-2.5 py-1.5" style={modo === "vivavoz" ? { background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.12)", color: TINTA } : { color: "#6b7280" }}>Viva voz</button>
              <button type="button" onClick={() => { pararTudo(); setModo("apertar"); }} aria-pressed={modo === "apertar"}
                className="rounded-full px-2.5 py-1.5" style={modo === "apertar" ? { background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.12)", color: TINTA } : { color: "#6b7280" }}>Apertar</button>
            </div>
            <button type="button" role="switch" aria-checked={vozResposta} onClick={() => setVozResposta((v) => !v)}
              title={vozResposta ? "A Marina responde falando" : "A Marina responde só por texto (economiza)"}
              className="flex min-w-0 items-center gap-1.5 rounded-full py-1 pl-3 pr-1 text-[12px]" style={{ background: "#f1f5f9", color: "#475569" }}>
              <span className="truncate">Resposta</span>
              <span className="shrink-0 rounded-full px-2.5 py-1 font-semibold"
                style={vozResposta ? { background: "#0ea5a3", color: "#fff" } : { background: "#e2e8f0", color: "#334155" }}>
                {vozResposta ? "Voz" : "Texto"}
              </span>
            </button>
          </div>
        )}
        {cap?.voz && modo === "vivavoz" && (
          <button type="button" onClick={() => (estado === "parado" ? iniciarVivaVoz() : pararTudo())}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-white transition"
            style={{ background: estado === "parado" ? "#0ea5a3" : "#dc2626" }}>
            <IconeMic small /> {rotuloBotao(estado)}
          </button>
        )}
        {cap?.voz && modo === "apertar" && gravacao?.travado && (
          <div className="flex h-12 w-full items-center gap-2" role="group" aria-label="Gravação travada">
            <button type="button" onClick={cancelarGravacao} aria-label="Cancelar a gravação"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={{ background: "#fee2e2", color: "#b91c1c" }}><IconeLixeira /></button>
            <div className="flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl text-sm font-semibold" style={{ background: "#fef2f2", color: "#b91c1c" }}>
              <span className="h-2.5 w-2.5 animate-pulse rounded-full" style={{ background: "#dc2626" }} aria-hidden />
              Gravando {relogio(gravacao.seg)}
            </div>
            <button type="button" onClick={enviarGravacao} aria-label="Enviar o áudio"
              className="flex h-12 shrink-0 items-center gap-1.5 rounded-2xl px-4 text-sm font-semibold text-white" style={{ background: "#0ea5a3" }}>Enviar <IconeEnviar /></button>
          </div>
        )}
        {cap?.voz && modo === "apertar" && !gravacao?.travado && (
          <button type="button"
            onPointerDown={aoSegurar} onPointerMove={aoArrastarGravando} onPointerUp={aoSoltar} onPointerCancel={cancelarGravacao}
            onContextMenu={(e) => e.preventDefault()}
            disabled={!gravacao && ocupada}
            className="relative flex h-12 w-full select-none items-center justify-center gap-2 overflow-hidden rounded-2xl text-sm font-semibold text-white disabled:opacity-70"
            style={{ background: gravacao ? "#dc2626" : "#0ea5a3", touchAction: "none", WebkitTouchCallout: "none", WebkitUserSelect: "none" }}>
            {gravacao ? (
              <>
                <span className="absolute left-3 text-[12px] font-medium" aria-hidden style={{ opacity: gravacao.dx < -20 ? 1 : 0.8 }}>‹ cancelar</span>
                <span className="flex items-center gap-1.5 rounded-full px-3 py-1" style={{ background: "rgba(255,255,255,.2)", transform: `translateX(${Math.max(-ARRASTO_PX, Math.min(ARRASTO_PX, gravacao.dx))}px)` }}>
                  <IconeMic small /> {relogio(gravacao.seg)}
                </span>
                <span className="absolute right-3 text-[12px] font-medium" aria-hidden style={{ opacity: gravacao.dx > 20 ? 1 : 0.8 }}>travar ›</span>
                <span className="sr-only">Gravando. Solte para enviar, arraste para a esquerda para cancelar ou para a direita para travar.</span>
              </>
            ) : (
              <><IconeMic small /> {estado === "salvando" ? "Salvando…" : ocupada ? "Um instante…" : "Segure para falar"}</>
            )}
          </button>
        )}
        {cap?.voz && modo === "apertar" && !gravacao && !ocupada && (
          <p className="mt-1 text-center text-[11px]" style={{ color: "#94a3b8" }}>Solte para enviar · arraste ‹ para cancelar · arraste › para travar</p>
        )}
        <div className="mt-2 flex items-center gap-2">
          <input value={digitado} onChange={(e) => setDigitado(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") enviarDigitado(); }}
            placeholder={cap?.gateway ? "…ou escreva aqui" : "Marina não está ligada"} disabled={!cap?.gateway}
            className="min-w-0 flex-1 rounded-xl px-3 py-2 text-[13px] outline-none"
            style={{ border: "1px solid #e5e7eb", background: "#fff", color: TINTA }} />
          <button type="button" onClick={enviarDigitado} disabled={!cap?.gateway || !digitado.trim()}
            className="shrink-0 rounded-xl px-3 py-2 text-[13px] font-medium text-white disabled:opacity-40" style={{ background: "#374151" }}>Enviar</button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {!aberto && (
        <button
          type="button"
          onClick={abrir}
          aria-label="Treinar a Marina por voz"
          className="fixed right-4 z-[60] flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition active:scale-95"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 5.5rem)", background: "linear-gradient(135deg,#0ea5a3,#0369a1)", color: "#fff" }}
        >
          <IconeMic />
        </button>
      )}

      {/* Fundo desfocado: dá foco ao chat. Some ao minimizar, para ver a página. */}
      {aberto && !min && (
        <div aria-hidden className="fixed inset-0 z-[65]"
          style={{ background: "rgba(8,28,40,0.34)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }} />
      )}

      {aberto && celular && (
        <div role="dialog" aria-label="Treinar a Marina por voz"
          className="fixed inset-x-0 bottom-0 z-[70] flex max-h-[86vh] flex-col overflow-hidden"
          style={{ background: SUPERFICIE, color: TINTA, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: "env(safe-area-inset-bottom, 0px)", boxShadow: "0 -14px 44px -14px rgba(12,38,56,.5)", borderTop: "1px solid rgba(12,38,56,.1)" }}>
          {cabecalho}
          {corpo}
        </div>
      )}

      {aberto && !celular && (
        <div role="dialog" aria-label="Treinar a Marina por voz"
          className="fixed z-[70] flex flex-col overflow-hidden"
          style={{
            left: max ? "50%" : pos.x,
            top: max ? "50%" : pos.y,
            transform: max ? "translate(-50%,-50%)" : undefined,
            width: max ? "min(940px,94vw)" : tam.w,
            height: min ? "auto" : max ? "90vh" : tam.h,
            maxWidth: "96vw", maxHeight: "92vh",
            background: SUPERFICIE, color: TINTA, borderRadius: 18,
            border: "1px solid rgba(12,38,56,.12)",
            boxShadow: "0 24px 64px -20px rgba(12,38,56,.55), 0 6px 20px -8px rgba(12,38,56,.28)",
          }}>
          {cabecalho}
          {!min && corpo}
          {!min && !max && (
            <div onPointerDown={aoRedim} onPointerMove={moverRedim} onPointerUp={soltarRedim}
              title="Arraste para redimensionar"
              className="absolute bottom-0 right-0 h-5 w-5"
              style={{ cursor: "nwse-resize", touchAction: "none", background: "linear-gradient(135deg, transparent 50%, rgba(12,38,56,.22) 50%)", borderBottomRightRadius: 18 }} />
          )}
        </div>
      )}
    </>
  );
}

function rotuloEstado(e: Estado): string {
  return e === "ouvindo" ? "Ouvindo você…" : e === "pensando" ? "Pensando…" : e === "salvando" ? "Salvando no painel…" : e === "falando" ? "Falando…" : "Pronta quando você quiser";
}

function rotuloBotao(e: Estado): string {
  if (e === "parado") return "Começar a falar";
  if (e === "ouvindo") return "Ouvindo… (toque para parar)";
  if (e === "salvando") return "Salvando… (toque para parar)";
  if (e === "falando") return "Falando… (toque para parar)";
  return "Pensando… (toque para parar)";
}

function BotaoJanela({ titulo, onClick, children, desligado }: { titulo: string; onClick: () => void; children: React.ReactNode; desligado?: boolean }) {
  return (
    <button type="button" title={titulo} aria-label={titulo} onClick={onClick} disabled={desligado}
      className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-black/5 disabled:opacity-30 disabled:hover:bg-transparent"
      style={{ color: "#4b5563" }}>
      {children}
    </button>
  );
}

function IconeMic({ small }: { small?: boolean }) {
  const s = small ? 16 : 22;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
      <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4" />
    </svg>
  );
}
function IconeX() {
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M18 6 6 18M6 6l12 12" /></svg>);
}
function IconeMenos() {
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M5 12h14" /></svg>);
}
function IconeQuadrado() {
  return (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="4" y="4" width="16" height="16" rx="2" /></svg>);
}
function IconeDesfazer({ refazer }: { refazer?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden
      style={refazer ? { transform: "scaleX(-1)" } : undefined}>
      <path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
    </svg>
  );
}
function IconeLapis() {
  return (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>);
}
function IconeLixeira() {
  return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /></svg>);
}
function IconeEnviar() {
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4Z" /></svg>);
}
function relogio(seg: number): string {
  return `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, "0")}`;
}
