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

const SILENCIO_MS = 1100;   // silêncio que encerra uma fala na viva voz
const LIMIAR = 0.02;        // volume mínimo que conta como fala
const MIN_FALA_MS = 250;    // abaixo disso é ruído, não fala
const MAX_FALA_MS = 15_000; // trava de segurança por fala

const SIM = /\b(sim|pode|confirma|confirmo|isso|exato|ta certo|tá certo|certo|manda|fecha|beleza|claro|ok|okay)\b/i;
const NAO = /\b(nao|não|negativo|cancela|deixa|espera|para|errado|melhor nao|melhor não)\b/i;

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

  useEffect(() => { modoRef.current = modo; }, [modo]);
  useEffect(() => { pendenteRef.current = pendente; }, [pendente]);
  const mudarEstado = (e: Estado) => { estadoCaixa.current = e; setEstado(e); };

  const log = useCallback((papel: Papel, texto: string) => {
    if (!texto) return;
    setFalas((f) => [...f, { papel, texto }].slice(-40));
    histRef.current = [...histRef.current, { papel, conteudo: texto }].slice(-12);
  }, []);

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

  /** Grava UMA fala (viva voz): começa a ouvir, para quando você silencia. */
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
        const duração = agora - inicio;
        const silêncio = agora - ultimaFala;
        if ((teveFala && silêncio > SILENCIO_MS && duração > MIN_FALA_MS) || duração > MAX_FALA_MS) {
          try { mr.stop(); } catch {}
        }
      }, 60);

      try { mr.start(); } catch { clearInterval(timer); resolve(null); }
    });
  }, [volume]);

  /* ── enviar áudio → texto ────────────────────────────────────────── */
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

  /* ── falar (texto → áudio) ───────────────────────────────────────── */
  const falar = useCallback(async (texto: string): Promise<void> => {
    if (!cap?.voz) return;
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

  /* ── executar a ação confirmada ──────────────────────────────────── */
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

  /* ── um turno: texto da pessoa → Marina → (ação?) → voz ──────────── */
  const conversar = useCallback(async (texto: string) => {
    log("voce", texto);

    /* Se há uma ação esperando confirmação, a resposta pode ser só "sim/não". */
    const p = pendenteRef.current;
    if (p) {
      if (SIM.test(texto) && !NAO.test(texto)) { await confirmar(p); return; }
      if (NAO.test(texto)) { await cancelarPendente(); return; }
      setPendente(null); // virou outro assunto: segue como mensagem normal
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
      if (d.acao && d.acao.valido) {
        const nova = { nome: d.acao.nome, dados: d.acao.dados, descricao: d.acao.descricao };
        setPendente(nova);
      } else if (d.acao && !d.acao.valido) {
        // a Marina tentou uma ação que não deu: deixa só o texto/ a explicação
      }
      await falar(d.resposta);
    } catch { log("marina", "Falha ao falar com a Marina."); }
  }, [confirmar, cancelarPendente, falar, log]);

  /* ── laço da viva voz ────────────────────────────────────────────── */
  const laço = useCallback(async () => {
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
    laço();
  }, [garantirMic, laço]);

  const pararTudo = useCallback(() => {
    pararRef.current = true;
    canceladoRef.current = true;
    try { mrRef.current?.stop(); } catch {}
    mudarEstado("parado");
  }, []);

  /* ── apertar para falar ──────────────────────────────────────────── */
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

  /* ── visual ──────────────────────────────────────────────────────── */
  const ocupada = estado === "pensando" || estado === "falando";

  return (
    <>
      <button
        type="button"
        onClick={() => (aberto ? fechar() : abrir())}
        aria-label={aberto ? "Fechar o treino por voz" : "Treinar a Marina por voz"}
        className="fixed right-4 z-[60] flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition active:scale-95"
        style={{
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 5.5rem)",
          background: aberto ? "#6b7280" : "linear-gradient(135deg,#0ea5a3,#0369a1)",
          color: "#fff",
        }}
      >
        {aberto ? <IconeX /> : <IconeMic />}
      </button>

      {aberto && (
        <div className="fixed inset-x-0 bottom-0 z-[59] sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[26rem]"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
          <div className="mx-auto flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl ring-1 ring-black/10 sm:rounded-3xl"
            style={{ color: "#1f2937" }}>
            {/* cabeçalho */}
            <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: "#e0f2f1", color: "#0f766e" }}><IconeMic small /></span>
                <div>
                  <p className="text-sm font-semibold leading-tight">Treinar a Marina por voz</p>
                  <p className="text-[11px] leading-tight text-gray-500">{rotuloEstado(estado)}</p>
                </div>
              </div>
              <div className="flex rounded-full bg-gray-100 p-0.5 text-[11px] font-medium">
                <button type="button" onClick={() => { pararTudo(); setModo("vivavoz"); }}
                  className="rounded-full px-2.5 py-1" style={modo === "vivavoz" ? { background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.1)" } : { color: "#6b7280" }}>Viva voz</button>
                <button type="button" onClick={() => { pararTudo(); setModo("apertar"); }}
                  className="rounded-full px-2.5 py-1" style={modo === "apertar" ? { background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.1)" } : { color: "#6b7280" }}>Apertar</button>
              </div>
            </div>

            {/* avisos */}
            {aviso && <p className="bg-amber-50 px-4 py-2 text-[12px] text-amber-800">{aviso}</p>}
            {gasto && gasto.limiteCentavos > 0 && (
              <div className="px-4 pt-2">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full rounded-full transition-all" style={{ width: Math.min(100, gasto.pct) + "%", background: gasto.nivel === "estourou" ? "#dc2626" : gasto.nivel === "aviso" ? "#d97706" : "#0ea5a3" }} />
                </div>
                {reais && <p className="mt-0.5 text-right text-[10px] text-gray-400">voz do mês: {reais.uso} de {reais.limite} (estimativa)</p>}
              </div>
            )}

            {/* conversa */}
            <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
              {falas.length === 0 && (
                <p className="py-6 text-center text-[13px] text-gray-400">
                  {modo === "vivavoz" ? "Toque no microfone e fale. A Marina ouve, responde e vai te perguntando o que falta." : "Segure o botão e fale. Solte quando terminar."}
                </p>
              )}
              {falas.map((f, i) => (
                <div key={i} className={f.papel === "voce" ? "text-right" : "text-left"}>
                  <span className={"inline-block max-w-[85%] rounded-2xl px-3 py-1.5 text-[13px] " + (f.papel === "voce" ? "bg-sky-600 text-white" : "bg-gray-100 text-gray-800")}>{f.texto}</span>
                </div>
              ))}
            </div>

            {/* confirmação de ação */}
            {pendente && (
              <div className="mx-4 mb-2 rounded-2xl border border-teal-200 bg-teal-50 p-3">
                <p className="text-[12px] text-teal-900">A Marina quer <strong>{pendente.descricao}</strong>. Confirma?</p>
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={() => confirmar(pendente)} className="rounded-full bg-teal-600 px-3 py-1 text-[12px] font-semibold text-white">Confirmar</button>
                  <button type="button" onClick={cancelarPendente} className="rounded-full bg-white px-3 py-1 text-[12px] font-medium text-gray-600 ring-1 ring-gray-200">Agora não</button>
                </div>
              </div>
            )}

            {/* feito nesta conversa */}
            {feito.length > 0 && (
              <div className="mx-4 mb-2 rounded-xl bg-gray-50 p-2">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Feito nesta conversa</p>
                <ul className="space-y-0.5">
                  {feito.map((f, i) => <li key={i} className="text-[11px] text-gray-600">✓ {f}</li>)}
                </ul>
              </div>
            )}

            {/* controles */}
            <div className="border-t border-gray-100 p-3">
              <div className="flex items-center gap-2">
                {cap?.voz && modo === "vivavoz" && (
                  <button type="button" onClick={() => (estado === "parado" ? iniciarVivaVoz() : pararTudo())}
                    className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-white transition"
                    style={{ background: estado === "parado" ? "#0ea5a3" : "#dc2626" }}>
                    <IconeMic small /> {estado === "parado" ? "Começar a falar" : estado === "ouvindo" ? "Ouvindo… (toque para parar)" : ocupada ? "Um instante…" : "Parar"}
                  </button>
                )}
                {cap?.voz && modo === "apertar" && (
                  <button type="button"
                    onPointerDown={comecarApertar} onPointerUp={soltarApertar} onPointerLeave={soltarApertar}
                    className="flex h-12 flex-1 select-none items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-white"
                    style={{ background: estado === "ouvindo" ? "#dc2626" : "#0ea5a3", touchAction: "none" }}>
                    <IconeMic small /> {estado === "ouvindo" ? "Gravando… solte para enviar" : ocupada ? "Um instante…" : "Segure para falar"}
                  </button>
                )}
              </div>
              {/* texto como rede de segurança (e único caminho se a voz pausar) */}
              <div className="mt-2 flex items-center gap-2">
                <input value={digitado} onChange={(e) => setDigitado(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") enviarDigitado(); }}
                  placeholder={cap?.gateway ? "…ou escreva aqui" : "Marina não está ligada"} disabled={!cap?.gateway}
                  className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-[13px] outline-none focus:border-teal-400" />
                <button type="button" onClick={enviarDigitado} disabled={!cap?.gateway || !digitado.trim()}
                  className="rounded-xl bg-gray-800 px-3 py-2 text-[13px] font-medium text-white disabled:opacity-40">Enviar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function rotuloEstado(e: Estado): string {
  return e === "ouvindo" ? "Ouvindo você…" : e === "pensando" ? "Pensando…" : e === "falando" ? "Falando…" : "Pronta quando você quiser";
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
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
