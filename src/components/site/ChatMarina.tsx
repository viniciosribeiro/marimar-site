"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Icone } from "./Icone";
import { SUGESTOES, SAUDACAO, INDISPONIVEL } from "@/lib/chat";

type Fala = { de: "visitante" | "marina"; texto: string };

/**
 * O chat de atendimento do site.
 *
 * Fala com a MESMA Marina do WhatsApp, através de `/api/chat`. O widget
 * não conhece token nenhum: manda a pergunta e lê letras chegando.
 *
 * A saída humana fica visível o tempo todo. Um atendimento automático que
 * esconde o caminho para uma pessoa de verdade é pior do que não ter
 * atendimento automático — e quem está decidindo uma viagem sente isso.
 *
 * Sobre o tamanho do painel: quem manda é a classe `.painel-chat`, no
 * `globals.css`. Ela existe porque as medidas mudam em quatro situações
 * (celular em pé, celular deitado, tablet, desktop) e média de tela não
 * cabe em atributo de elemento.
 */
export function ChatMarina({ whatsapp, nome }: { whatsapp: string; nome: string }) {
  const [aberto, setAberto] = useState(false);
  const [ampliado, setAmpliado] = useState(false);
  const [falas, setFalas] = useState<Fala[]>([]);
  const [rascunho, setRascunho] = useState("");
  const [esperando, setEsperando] = useState(false);
  const [ditando, setDitando] = useState(false);
  const [temMicrofone, setTemMicrofone] = useState(false);
  const [sessao] = useState(() => novaSessao());

  const fimRef = useRef<HTMLDivElement>(null);
  const campoRef = useRef<HTMLTextAreaElement>(null);
  const reconhecimentoRef = useRef<Reconhecimento | null>(null);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ block: "end" });
  }, [falas, esperando]);

  useEffect(() => {
    if (aberto) campoRef.current?.focus();
  }, [aberto]);

  // Esc fecha — a mesma tecla que fecha tudo no resto do site.
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === "Escape") setAberto(false); };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, []);

  /* Trava a rolagem do site enquanto o painel cobre a tela.
     Só no celular: no desktop o painel é um cartão no canto e a pessoa
     tem todo o direito de continuar rolando a página por trás dele. */
  useEffect(() => {
    if (!aberto) return;
    const telaCheia = window.matchMedia("(max-width: 639px), (max-height: 480px)");
    if (!telaCheia.matches) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = anterior; };
  }, [aberto]);

  /* O campo cresce com o texto até um teto, como em qualquer mensageiro.
     Zerar a altura antes de medir é o que faz ele DIMINUIR ao apagar. */
  useEffect(() => {
    const campo = campoRef.current;
    if (!campo) return;
    campo.style.height = "auto";
    campo.style.height = Math.min(campo.scrollHeight, 112) + "px";
  }, [rascunho]);

  // Ditado por voz, quando o navegador tem. Ver `alternarDitado`.
  useEffect(() => {
    setTemMicrofone(Boolean(construtorDeReconhecimento()));
    return () => { try { reconhecimentoRef.current?.stop(); } catch {} };
  }, []);

  const enviar = useCallback(async (texto: string) => {
    const pergunta = texto.trim();
    if (!pergunta || esperando) return;

    try { reconhecimentoRef.current?.stop(); } catch {}
    setRascunho("");
    setFalas((f) => [...f, { de: "visitante", texto: pergunta }]);
    setEsperando(true);

    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessao, mensagem: pergunta }),
      });

      if (!r.ok || !r.body) {
        const dados = await r.json().catch(() => null);
        setFalas((f) => [...f, { de: "marina", texto: dados?.erro || INDISPONIVEL }]);
        return;
      }

      // A resposta chega em pedaços; cada pedaço entra na última fala.
      setFalas((f) => [...f, { de: "marina", texto: "" }]);
      const leitor = r.body.getReader();
      const decodificador = new TextDecoder();

      for (;;) {
        const { done, value } = await leitor.read();
        if (done) break;
        const pedaco = decodificador.decode(value, { stream: true });
        setFalas((f) => {
          const copia = [...f];
          copia[copia.length - 1] = {
            de: "marina",
            texto: copia[copia.length - 1].texto + pedaco,
          };
          return copia;
        });
      }
    } catch {
      setFalas((f) => [...f, { de: "marina", texto: INDISPONIVEL }]);
    } finally {
      setEsperando(false);
      campoRef.current?.focus();
    }
  }, [esperando, sessao]);

  /**
   * Ditado por voz.
   *
   * Usa o reconhecimento do próprio navegador: nada de áudio sai daqui,
   * o texto aparece no campo e a pessoa confere antes de enviar. É de
   * propósito — mandar o áudio para transcrever no servidor custa
   * dinheiro por segundo falado e transforma um engano em uma pergunta
   * enviada.
   *
   * Nem todo navegador tem (Firefox não tem). Por isso o botão só
   * aparece quando existe, em vez de aparecer e falhar.
   */
  function alternarDitado() {
    if (ditando) {
      try { reconhecimentoRef.current?.stop(); } catch {}
      return;
    }
    const Construtor = construtorDeReconhecimento();
    if (!Construtor) return;

    const r = new Construtor();
    r.lang = "pt-BR";
    r.continuous = false;
    r.interimResults = true;

    let base = rascunho;
    r.onresult = (e) => {
      let transcrito = "";
      for (let i = 0; i < e.results.length; i++) {
        transcrito += e.results[i][0].transcript;
      }
      setRascunho((base ? base.trimEnd() + " " : "") + transcrito);
    };
    r.onerror = () => setDitando(false);
    r.onend = () => { setDitando(false); base = ""; campoRef.current?.focus(); };

    reconhecimentoRef.current = r;
    setDitando(true);
    try { r.start(); } catch { setDitando(false); }
  }

  const linkWhats = `https://wa.me/${whatsapp}?text=${encodeURIComponent(
    "Olá! Vim pelo site e gostaria de informações sobre a Pousada Marimar.",
  )}`;

  const temTexto = rascunho.trim().length > 0;

  return (
    <>
      {!aberto && (
        <button
          onClick={() => setAberto(true)}
          aria-label="Abrir atendimento"
          className="fixed bottom-24 right-5 z-40 flex items-center gap-2 bg-marca text-marca-texto pl-4 pr-5 py-3 rounded-full shadow-marca-forte hover:bg-marca-hover transition-marca"
        >
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-white/20 shrink-0" aria-hidden>
            <Icone nome="coracao" tamanho={14} />
          </span>
          <span className="text-sm font-semibold">Falar com a Marina</span>
        </button>
      )}

      {aberto && (
        <div
          data-ampliado={ampliado ? "true" : "false"}
          role="dialog"
          aria-label={`Atendimento da ${nome}`}
          className="painel-chat bg-white sm:rounded-marca sm:shadow-marca-forte sm:border sm:border-linha"
        >
          {/* ── cabeçalho ── */}
          <header className="shrink-0 flex items-center gap-3 px-4 py-3 bg-marca text-marca-texto">
            <span className="flex items-center justify-center w-9 h-9 rounded-full bg-white/20 shrink-0" aria-hidden>
              <Icone nome="coracao" tamanho={18} />
            </span>
            <div className="min-w-0">
              <p className="font-semibold leading-tight">Marina</p>
              <p className="text-[11px] opacity-85 leading-tight truncate">Atendimento da {nome}</p>
            </div>

            <div className="ml-auto flex items-center">
              {/* Ampliar só existe onde há espaço sobrando. No celular o
                  painel já ocupa a tela toda e o botão seria mentira. */}
              <button
                onClick={() => setAmpliado((v) => !v)}
                aria-label={ampliado ? "Reduzir janela" : "Ampliar janela"}
                className="hidden sm:flex items-center justify-center p-2 opacity-85 hover:opacity-100"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  {ampliado
                    ? <><path d="M9 3v6H3" /><path d="M15 21v-6h6" /></>
                    : <><path d="M15 3h6v6" /><path d="M9 21H3v-6" /></>}
                </svg>
              </button>
              <button onClick={() => setAberto(false)} aria-label="Fechar atendimento"
                className="p-2 -mr-1 opacity-85 hover:opacity-100">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </header>

          {/* ── conversa ── */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 space-y-3 bg-areia/40">
            <Balao de="marina">{SAUDACAO}</Balao>

            {falas.length === 0 && (
              <div className="space-y-1.5 pt-1">
                {SUGESTOES.map((s) => (
                  <button key={s} onClick={() => enviar(s)}
                    className="block w-full text-left text-[13px] text-tinta bg-white border border-linha rounded-marca px-3 py-2 hover:bg-white/70 transition-marca">
                    {s}
                  </button>
                ))}
              </div>
            )}

            {falas.map((f, i) => (
              <Balao key={i} de={f.de}>
                {f.texto || (f.de === "marina" ? <Pontinhos /> : "")}
              </Balao>
            ))}

            {esperando && falas[falas.length - 1]?.de === "visitante" && (
              <Balao de="marina"><Pontinhos /></Balao>
            )}

            <div ref={fimRef} />
          </div>

          {/* ── escrever ── */}
          <div className="shrink-0 border-t border-linha bg-white p-3"
            style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
            <form
              onSubmit={(e) => { e.preventDefault(); enviar(rascunho); }}
              className="flex items-end gap-2"
            >
              <textarea
                ref={campoRef}
                value={rascunho}
                onChange={(e) => setRascunho(e.target.value)}
                onKeyDown={(e) => {
                  // Enter envia, Shift+Enter quebra linha — é o que a pessoa
                  // espera de um chat, e não de um formulário.
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(rascunho); }
                }}
                rows={1}
                placeholder={ditando ? "Ouvindo…" : "Escreva sua pergunta…"}
                className="flex-1 min-w-0 resize-none border border-linha rounded-marca px-3 py-2.5 text-sm text-tinta focus:outline-none focus:ring-2 focus:ring-marca/20 focus:border-marca"
              />

              {/* Microfone enquanto não há texto, enviar quando há. É o que
                  todo mensageiro faz, e economiza um botão na largura de
                  celular, que é onde a barra aperta. */}
              {temMicrofone && !temTexto ? (
                <button type="button" onClick={alternarDitado}
                  aria-label={ditando ? "Parar de ditar" : "Ditar por voz"}
                  aria-pressed={ditando}
                  className={`shrink-0 flex items-center justify-center w-11 h-11 rounded-marca border transition-marca ${
                    ditando
                      ? "bg-acento text-acento-texto border-transparent animate-pulse"
                      : "bg-white text-tinta-suave border-linha hover:text-tinta"
                  }`}>
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <rect x="9" y="2" width="6" height="11" rx="3" />
                    <path d="M5 11a7 7 0 0 0 14 0" /><line x1="12" y1="18" x2="12" y2="22" />
                  </svg>
                </button>
              ) : (
                <button type="submit" disabled={!temTexto || esperando}
                  aria-label="Enviar"
                  className="shrink-0 flex items-center justify-center w-11 h-11 rounded-marca bg-marca text-marca-texto disabled:opacity-40 transition-marca">
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M4 12 20 4l-4 16-4-6-8-2Z" />
                  </svg>
                </button>
              )}
            </form>

            <a href={linkWhats} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 text-[11px] text-tinta-suave hover:text-tinta mt-2 transition-marca">
              <span className="text-[#25D366]"><Icone nome="telefone" tamanho={13} /></span>
              Prefere falar com uma pessoa? Chame no WhatsApp
            </a>
          </div>
        </div>
      )}
    </>
  );
}

function Balao({ de, children }: { de: "visitante" | "marina"; children: React.ReactNode }) {
  const meu = de === "visitante";
  return (
    <div className={`flex ${meu ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] min-w-0 rounded-marca px-3.5 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-wrap break-words ${
        meu ? "bg-marca text-marca-texto" : "bg-white text-tinta border border-linha"
      }`}>
        {children}
      </div>
    </div>
  );
}

function Pontinhos() {
  return (
    <span className="inline-flex gap-1 py-1" aria-label="Escrevendo">
      {[0, 150, 300].map((atraso) => (
        <span key={atraso}
          className="w-1.5 h-1.5 rounded-full bg-tinta-suave/60 animate-bounce"
          style={{ animationDelay: `${atraso}ms` }} />
      ))}
    </span>
  );
}

/* ── ditado por voz ─────────────────────────────────────────────────
   A API de reconhecimento do navegador não está nos tipos do DOM, e
   ainda vem com prefixo no Chrome. Declarar só o que se usa evita um
   `any` solto atravessando o arquivo.                                */
type Reconhecimento = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

function construtorDeReconhecimento(): (new () => Reconhecimento) | null {
  if (typeof window === "undefined") return null;
  const janela = window as unknown as {
    SpeechRecognition?: new () => Reconhecimento;
    webkitSpeechRecognition?: new () => Reconhecimento;
  };
  return janela.SpeechRecognition ?? janela.webkitSpeechRecognition ?? null;
}

/**
 * Identificador da conversa.
 *
 * Fica só no `sessionStorage`: dura enquanto a aba estiver aberta e não
 * segue a pessoa por aí. É o suficiente para o fio da conversa, e é o
 * mínimo para quem só quer perguntar o horário do café.
 */
function novaSessao(): string {
  try {
    const guardada = sessionStorage.getItem("marimar:chat");
    if (guardada) return guardada;
    const nova = crypto.randomUUID();
    sessionStorage.setItem("marimar:chat", nova);
    return nova;
  } catch {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}
