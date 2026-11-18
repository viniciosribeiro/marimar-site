"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { executarAcaoVoz } from "@/app/(admin)/admin/marina/voz-acoes";

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
 * A janela é SÓLIDA (o painel tem uma regra que deixa todo `bg-white`
 * translúcido — por isso aqui o fundo é posto em estilo, não por classe),
 * arrastável, com minimizar/maximizar/redimensionar no computador e folha
 * responsiva no celular.
 *
 * O que muda no painel passa pela MESMA gravação das telas (Server Action
 * `executarAcaoVoz`), com o seu login e registrado. A voz custa por fora
 * (ElevenLabs): há um teto de gasto no mês; se estourar, a voz pausa e o
 * treino segue por texto.
 */

type Papel = "voce" | "marina";
type Fala = { papel: Papel; texto: string };
type Gasto = { usoCentavos: number; limiteCentavos: number; nivel: "ok" | "aviso" | "estourou"; pct: number };
type Pendente = { nome: string; dados: Record<string, unknown>; descricao: string };
type Estado = "parado" | "ouvindo" | "pensando" | "falando";

const SILENCIO_MS = 1100;
const LIMIAR = 0.02;
const MIN_FALA_MS = 250;
const MAX_FALA_MS = 15_000;

const SIM = /\b(sim|pode|confirma|confirmo|isso|exato|ta certo|tá certo|certo|manda|fecha|beleza|claro|ok|okay)\b/i;
const NAO = /\b(nao|não|negativo|cancela|deixa|espera|para|errado|melhor nao|melhor não)\b/i;

const LARGURA_INICIAL = 384;
const ALTURA_INICIAL = 592;
const SUPERFICIE = "#ffffff";
const TINTA = "#1f2937";

export function VozTreino() {
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
  const histRef = useRef<{ papel: Papel; conteudo: string }[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const acRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mrRef = useRef<MediaRecorder | null>(null);
  const pararRef = useRef(false);
  const canceladoRef = useRef(false);
  const pendenteRef = useRef<Pendente | null>(null);
  const modoRef = useRef(modo);
  const estadoCaixa = useRef<Estado>("parado");
  const arrastarRef = useRef<{ dx: number; dy: number } | null>(null);
  const redimRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const corpoRolagem = useRef<HTMLDivElement | null>(null);

  useEffect(() => { modoRef.current = modo; }, [modo]);
  useEffect(() => { pendenteRef.current = pendente; }, [pendente]);
  const mudarEstado = (e: Estado) => { estadoCaixa.current = e; setEstado(e); };

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const ler = () => setCelular(mq.matches);
    ler();
    mq.addEventListener?.("change", ler);
    return () => mq.removeEventListener?.("change", ler);
  }, []);

  const log = useCallback((papel: Papel, texto: string) => {
    if (!texto) return;
    setFalas((f) => [...f, { papel, texto }].slice(-40));
    histRef.current = [...histRef.current, { papel, conteudo: texto }].slice(-12);
  }, []);

  /* rola a conversa para o fim quando chega fala nova */
  useEffect(() => {
    const el = corpoRolagem.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [falas, pendente, feito]);

  /* ── estado inicial ao abrir ─────────────────────────────────────── */
  const carregarEstado = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/marina/voz/estado");
      const d = await r.json();
      if (!r.ok) { setAviso(d?.erro ?? "Não consegui abrir o modo voz."); return; }
      setCap({ gateway: d.gateway, voz: d.voz });
      setGasto(d.gasto); setReais(d.reais);
      if (!d.gateway) setAviso("A Marina ainda não está ligada a este site. Fale com quem cuida da Vercel.");
      else if (!d.voz) setAviso("A voz ainda não está configurada. Você pode treinar por texto; para ouvir e falar, configure em Marina → Voz.");
      else if (d.gasto?.nivel === "estourou") setAviso("A voz atingiu o teto de gasto do mês. Dá para continuar por texto.");
    } catch {
      setAviso("Não consegui abrir o modo voz agora.");
    }
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

  const gravarUmaFala = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const stream = streamRef.current;
      if (!stream) return resolve(null);
      const tipo = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const mr = new MediaRecorder(stream, tipo ? { mimeType: tipo } : undefined);
      mrRef.current = mr;
      canceladoRef.current = false;
      const partes: Blob[] = [];
      let teveFala = false;
      const inicio = Date.now();
      let ultimaFala = Date.now();

      mr.ondataavailable = (e) => { if (e.data.size) partes.push(e.data); };
      mr.onstop = () => {
        clearInterval(timer);
        mrRef.current = null;
        if (canceladoRef.current || !teveFala) return resolve(null);
        resolve(new Blob(partes, { type: tipo || "audio/webm" }));
      };

      const timer = setInterval(() => {
        if (pararRef.current) { try { mr.stop(); } catch {} return; }
        const v = volume();
        const agora = Date.now();
        if (v > LIMIAR) { teveFala = true; ultimaFala = agora; }
        const duracao = agora - inicio;
        const silencio = agora - ultimaFala;
        if ((teveFala && silencio > SILENCIO_MS && duracao > MIN_FALA_MS) || duracao > MAX_FALA_MS) {
          try { mr.stop(); } catch {}
        }
      }, 60);

      try { mr.start(); } catch { clearInterval(timer); resolve(null); }
    });
  }, [volume]);

  const transcrever = useCallback(async (blob: Blob, segundos: number): Promise<string | null> => {
    const fd = new FormData();
    fd.append("audio", blob, "fala.webm");
    fd.append("sessao", sessaoRef.current);
    fd.append("segundos", String(Math.round(segundos)));
    try {
      const r = await fetch("/api/admin/marina/voz/ouvir", { method: "POST", body: fd });
      const d = await r.json();
      if (r.status === 402) { setGasto(d.gasto); setAviso("A voz atingiu o teto do mês. Continue por texto."); return null; }
      if (!r.ok) { setAviso(d?.erro ?? "Não entendi o áudio."); return null; }
      return typeof d.texto === "string" ? d.texto : null;
    } catch { setAviso("Falha ao enviar o áudio."); return null; }
  }, []);

  const falar = useCallback(async (texto: string): Promise<void> => {
    // Em modo "só texto" a resposta aparece escrita e nenhum áudio é gerado (sem custo de TTS).
    if (!cap?.voz || !vozRespostaRef.current) return;
    try {
      const r = await fetch("/api/admin/marina/voz/falar", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessao: sessaoRef.current, texto }),
      });
      if (r.status === 402) { setAviso("A voz atingiu o teto do mês. Continue por texto."); return; }
      if (!r.ok) return;
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      mudarEstado("falando");
      await new Promise<void>((resolve) => {
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
        audio.play().catch(() => resolve());
      });
      URL.revokeObjectURL(url);
    } catch { /* fica só o texto na tela */ }
  }, [cap]);

  const confirmar = useCallback(async (p: Pendente) => {
    setPendente(null);
    mudarEstado("pensando");
    try {
      const r = await executarAcaoVoz(sessaoRef.current, p.nome, p.dados);
      log("marina", r.mensagem);
      if (r.ok) setFeito((f) => [...f, r.mensagem]);
      await falar(r.ok ? r.mensagem : "Não consegui fazer: " + r.mensagem);
    } catch {
      log("marina", "Não consegui fazer isso agora.");
      await falar("Não consegui fazer isso agora.");
    }
  }, [falar, log]);

  const cancelarPendente = useCallback(async () => {
    setPendente(null);
    log("marina", "Tudo bem, não vou mexer nisso.");
    await falar("Tudo bem, não vou mexer nisso.");
  }, [falar, log]);

  const conversar = useCallback(async (texto: string) => {
    log("voce", texto);

    const p = pendenteRef.current;
    if (p) {
      if (SIM.test(texto) && !NAO.test(texto)) { await confirmar(p); return; }
      if (NAO.test(texto)) { await cancelarPendente(); return; }
      setPendente(null);
    }

    mudarEstado("pensando");
    try {
      const r = await fetch("/api/admin/marina/voz/conversar", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessao: sessaoRef.current, mensagem: texto, historico: histRef.current }),
      });
      const d = await r.json();
      if (!r.ok) { const m = d?.erro ?? "Não consegui falar com a Marina."; log("marina", m); setAviso(m); return; }
      if (d.gasto) { setGasto(d.gasto); if (d.gasto.nivel === "aviso") setAviso("Atenção: a voz já passou de " + d.gasto.pct + "% do teto do mês."); }
      log("marina", d.resposta);
      if (d.acao && d.acao.valido) setPendente({ nome: d.acao.nome, dados: d.acao.dados, descricao: d.acao.descricao });
      await falar(d.resposta);
    } catch { log("marina", "Falha ao falar com a Marina."); }
  }, [confirmar, cancelarPendente, falar, log]);

  const laco = useCallback(async () => {
    pararRef.current = false;
    while (!pararRef.current && modoRef.current === "vivavoz") {
      mudarEstado("ouvindo");
      const t0 = Date.now();
      const blob = await gravarUmaFala();
      if (pararRef.current || !blob) break;
      const texto = await transcrever(blob, (Date.now() - t0) / 1000);
      if (pararRef.current) break;
      if (texto) await conversar(texto);
    }
    mudarEstado("parado");
  }, [gravarUmaFala, transcrever, conversar]);

  const iniciarVivaVoz = useCallback(async () => {
    setAviso(null);
    if (!(await garantirMic())) return;
    acRef.current?.resume().catch(() => {});
    laco();
  }, [garantirMic, laco]);

  const pararTudo = useCallback(() => {
    pararRef.current = true;
    canceladoRef.current = true;
    try { mrRef.current?.stop(); } catch {}
    mudarEstado("parado");
  }, []);

  const inicioApertar = useRef(0);
  const comecarApertar = useCallback(async () => {
    if (estadoCaixa.current !== "parado") return;
    setAviso(null);
    if (!(await garantirMic())) return;
    acRef.current?.resume().catch(() => {});
    const stream = streamRef.current!;
    const tipo = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
    const mr = new MediaRecorder(stream, tipo ? { mimeType: tipo } : undefined);
    mrRef.current = mr; canceladoRef.current = false;
    const partes: Blob[] = [];
    inicioApertar.current = Date.now();
    mr.ondataavailable = (e) => { if (e.data.size) partes.push(e.data); };
    mr.onstop = async () => {
      mrRef.current = null;
      if (canceladoRef.current) return;
      const blob = new Blob(partes, { type: tipo || "audio/webm" });
      const seg = (Date.now() - inicioApertar.current) / 1000;
      mudarEstado("pensando");
      const texto = await transcrever(blob, seg);
      if (texto) await conversar(texto);
      mudarEstado("parado");
    };
    mr.start();
    mudarEstado("ouvindo");
  }, [garantirMic, transcrever, conversar]);

  const soltarApertar = useCallback(() => {
    try { mrRef.current?.stop(); } catch {}
  }, []);

  /* ── abrir / fechar ──────────────────────────────────────────────── */
  const abrir = useCallback(async () => {
    sessaoRef.current = crypto.randomUUID();
    histRef.current = [];
    setFalas([]); setFeito([]); setPendente(null); setAviso(null);
    setMin(false); setMax(false);
    if (typeof window !== "undefined" && !window.matchMedia("(max-width: 639px)").matches) {
      const w = LARGURA_INICIAL, h = ALTURA_INICIAL;
      setTam({ w, h });
      setPos({ x: Math.max(16, window.innerWidth - w - 24), y: Math.max(16, window.innerHeight - h - 24) });
    }
    setAberto(true);
    await carregarEstado();
  }, [carregarEstado]);

  const fechar = useCallback(() => {
    pararTudo();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    acRef.current?.close().catch(() => {});
    acRef.current = null; analyserRef.current = null;
    setAberto(false);
  }, [pararTudo]);

  useEffect(() => () => { streamRef.current?.getTracks().forEach((t) => t.stop()); acRef.current?.close().catch(() => {}); }, []);

  const enviarDigitado = useCallback(async () => {
    const t = digitado.trim();
    if (!t) return;
    setDigitado("");
    await conversar(t);
  }, [digitado, conversar]);

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
  const ocupada = estado === "pensando" || estado === "falando";
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
        <div className="mr-1 flex rounded-full p-0.5 text-[11px] font-medium" style={{ background: "#f1f3f5" }}>
          <button type="button" onClick={() => { pararTudo(); setModo("vivavoz"); }}
            className="rounded-full px-2 py-1" style={modo === "vivavoz" ? { background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.12)" } : { color: "#6b7280" }}>Viva voz</button>
          <button type="button" onClick={() => { pararTudo(); setModo("apertar"); }}
            className="rounded-full px-2 py-1" style={modo === "apertar" ? { background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.12)" } : { color: "#6b7280" }}>Apertar</button>
        </div>
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
        {falas.map((f, i) => (
          <div key={i} className={f.papel === "voce" ? "text-right" : "text-left"}>
            <span className="inline-block max-w-[85%] rounded-2xl px-3 py-1.5 text-[13px]"
              style={f.papel === "voce" ? { background: "#0284c7", color: "#fff" } : { background: "#eef1f4", color: TINTA }}>{f.texto}</span>
          </div>
        ))}
      </div>

      {pendente && (
        <div className="mx-4 mb-2 rounded-2xl p-3" style={{ background: "#ecfdf5", border: "1px solid #a7f3d0" }}>
          <p className="text-[12px]" style={{ color: "#065f46" }}>A Marina quer <strong>{pendente.descricao}</strong>. Confirma?</p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => confirmar(pendente)} className="rounded-full px-3 py-1 text-[12px] font-semibold text-white" style={{ background: "#0d9488" }}>Confirmar</button>
            <button type="button" onClick={cancelarPendente} className="rounded-full px-3 py-1 text-[12px] font-medium" style={{ background: "#fff", color: "#4b5563", border: "1px solid #e5e7eb" }}>Agora não</button>
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
          <button type="button" role="switch" aria-checked={vozResposta} onClick={() => setVozResposta((v) => !v)}
            className="mb-2 flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-[12px]"
            style={{ background: "#f1f5f9", color: "#475569" }}>
            <span className="min-w-0">{vozResposta ? "A Marina responde falando" : "A Marina responde só por texto (economiza)"}</span>
            <span className="shrink-0 rounded-full px-2.5 py-1 font-semibold"
              style={vozResposta ? { background: "#0ea5a3", color: "#fff" } : { background: "#e2e8f0", color: "#334155" }}>
              {vozResposta ? "Voz" : "Texto"}
            </span>
          </button>
        )}
        {cap?.voz && modo === "vivavoz" && (
          <button type="button" onClick={() => (estado === "parado" ? iniciarVivaVoz() : pararTudo())}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-white transition"
            style={{ background: estado === "parado" ? "#0ea5a3" : "#dc2626" }}>
            <IconeMic small /> {estado === "parado" ? "Começar a falar" : estado === "ouvindo" ? "Ouvindo… (toque para parar)" : ocupada ? "Um instante…" : "Parar"}
          </button>
        )}
        {cap?.voz && modo === "apertar" && (
          <button type="button"
            onPointerDown={comecarApertar} onPointerUp={soltarApertar} onPointerLeave={soltarApertar}
            className="flex h-12 w-full select-none items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-white"
            style={{ background: estado === "ouvindo" ? "#dc2626" : "#0ea5a3", touchAction: "none" }}>
            <IconeMic small /> {estado === "ouvindo" ? "Gravando… solte para enviar" : ocupada ? "Um instante…" : "Segure para falar"}
          </button>
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
  return e === "ouvindo" ? "Ouvindo você…" : e === "pensando" ? "Pensando…" : e === "falando" ? "Falando…" : "Pronta quando você quiser";
}

function BotaoJanela({ titulo, onClick, children }: { titulo: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" title={titulo} aria-label={titulo} onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-black/5"
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
