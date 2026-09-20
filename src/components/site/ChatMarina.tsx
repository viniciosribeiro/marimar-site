"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Icone } from "./Icone";
import { SUGESTOES, SAUDACAO, INDISPONIVEL, LIMITE_AUDIO_SEGUNDOS } from "@/lib/chat";

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
  const [gravando, setGravando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [transcrevendo, setTranscrevendo] = useState(false);
  /* O painel so existe depois de aberto, entao este calculo nunca roda no
     servidor e nao ha divergencia de hidratacao — por isso da para decidir
     na criacao do estado em vez de num efeito. */
  const [temMicrofone, setTemMicrofone] = useState(
    () =>
      typeof window !== "undefined" &&
      typeof MediaRecorder !== "undefined" &&
      Boolean(navigator.mediaDevices?.getUserMedia),
  );
  const [sessao] = useState(() => novaSessao());

  /* Voz sob demanda. `vozDisponivel` comeca otimista e so vira falso se o
     servidor disser que nao ha chave — assim o botao some sozinho em vez de
     ficar ali falhando a cada clique. */
  const [vozDisponivel, setVozDisponivel] = useState(true);
  const [vozCarregando, setVozCarregando] = useState<number | null>(null);
  const [vozTocando, setVozTocando] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const fimRef = useRef<HTMLDivElement>(null);
  const campoRef = useRef<HTMLTextAreaElement>(null);
  const gravadorRef = useRef<MediaRecorder | null>(null);
  const pedacosRef = useRef<BlobPart[]>([]);
  const relogioRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const contagemRef = useRef(0);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ block: "end" });
  }, [falas, esperando]);

  useEffect(() => {
    if (aberto) campoRef.current?.focus();
  }, [aberto]);

  /* Fechar silencia o audio: ninguem espera que a voz continue tocando
     depois de fechar a janela. Fica numa funcao, e nao num efeito que
     observa `aberto`, porque parar audio e consequencia da ACAO de fechar —
     um efeito faria o React recalcular a tela so para descobrir isso. */
  const fechar = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    setVozTocando(null);
    setAberto(false);
  }, []);

  // Esc fecha — a mesma tecla que fecha tudo no resto do site.
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === "Escape") fechar(); };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [fechar]);

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

  // Ao desmontar: solta o microfone e o relogio. Sem isto a luzinha da
  // camera/microfone continua acesa depois de fechar a aba do chat.
  useEffect(() => () => {
    if (relogioRef.current) clearInterval(relogioRef.current);
    try { gravadorRef.current?.stream.getTracks().forEach((t) => t.stop()); } catch {}
    gravadorRef.current = null;
  }, []);

  async function enviar(texto: string, porVoz = false) {
    const pergunta = texto.trim();
    if (!pergunta || esperando) return;

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
      let indiceResposta = -1;
      setFalas((f) => { indiceResposta = f.length; return [...f, { de: "marina", texto: "" }]; });

      const leitor = r.body.getReader();
      const decodificador = new TextDecoder();
      let completa = "";

      for (;;) {
        const { done, value } = await leitor.read();
        if (done) break;
        const pedaco = decodificador.decode(value, { stream: true });
        completa += pedaco;
        setFalas((f) => {
          const copia = [...f];
          copia[copia.length - 1] = {
            de: "marina",
            texto: copia[copia.length - 1].texto + pedaco,
          };
          return copia;
        });
      }

      /* Perguntou falando, responde falando. É o que a pessoa espera de
         quem gravou um áudio — e é o mesmo critério do WhatsApp, onde o
         `tts.auto` está em "inbound". Quem escreveu continua lendo, e
         decide se quer ouvir pelo botão. */
      if (porVoz && completa.trim() && indiceResposta >= 0) {
        ouvir(indiceResposta, completa.trim());
      }
    } catch {
      setFalas((f) => [...f, { de: "marina", texto: INDISPONIVEL }]);
    } finally {
      setEsperando(false);
      campoRef.current?.focus();
    }
  }

  /* ── gravar e mandar áudio ────────────────────────────────────────
     Igual ao WhatsApp: grava, manda, e a resposta volta falada. O áudio
     vira texto no servidor e segue pelo MESMO caminho de uma pergunta
     escrita — se cada canal tivesse sua própria conversa, a Marina
     perderia o fio quando a pessoa alternasse entre falar e escrever,
     que é o que toda pessoa faz. */

  function pararTudo() {
    try { gravadorRef.current?.stream.getTracks().forEach((t) => t.stop()); } catch {}
    gravadorRef.current = null;
  }

  function encerrarRelogio() {
    if (relogioRef.current) clearInterval(relogioRef.current);
    relogioRef.current = null;
    setSegundos(0);
  }

  async function gravar() {
    if (gravando || esperando || transcrevendo) return;
    try {
      const fluxo = await navigator.mediaDevices.getUserMedia({ audio: true });
      const gravador = new MediaRecorder(fluxo);
      pedacosRef.current = [];
      gravador.ondataavailable = (e) => { if (e.data.size) pedacosRef.current.push(e.data); };
      gravadorRef.current = gravador;
      gravador.start();
      setGravando(true);
      setSegundos(0);

      contagemRef.current = 0;
      relogioRef.current = setInterval(() => {
        contagemRef.current += 1;
        setSegundos(contagemRef.current);
        // Corta sozinho no teto: um áudio esquecido aberto no bolso é gasto
        // sem pergunta nenhuma do outro lado. A contagem vive num ref porque
        // disparar o encerramento de dentro do cálculo do próximo estado é
        // efeito colateral no lugar errado.
        if (contagemRef.current >= LIMITE_AUDIO_SEGUNDOS) concluir();
      }, 1000);
    } catch {
      // Permissão negada ou sem microfone: o botão some e o campo de
      // texto continua ali. Nada a explicar, nada quebrado.
      setTemMicrofone(false);
    }
  }

  function descartar() {
    const gravador = gravadorRef.current;
    encerrarRelogio();
    setGravando(false);
    if (!gravador) return;
    gravador.ondataavailable = null;
    gravador.onstop = null;
    try { gravador.stop(); } catch {}
    pedacosRef.current = [];
    pararTudo();
  }

  function concluir() {
    const gravador = gravadorRef.current;
    encerrarRelogio();
    setGravando(false);
    if (!gravador) return;

    gravador.onstop = async () => {
      const audio = new Blob(pedacosRef.current, { type: gravador.mimeType || "audio/webm" });
      pedacosRef.current = [];
      pararTudo();
      if (audio.size < 1200) return;   // clique sem querer

      setTranscrevendo(true);
      try {
        const envio = new FormData();
        envio.append("audio", audio, "pergunta.webm");
        envio.append("sessao", sessao);

        const r = await fetch("/api/chat/transcrever", { method: "POST", body: envio });
        const dados = await r.json().catch(() => null);

        if (!r.ok || !dados?.texto) {
          setFalas((f) => [...f, {
            de: "marina",
            texto: dados?.erro || "Não consegui entender o áudio. Pode repetir ou escrever?",
          }]);
          return;
        }
        // Veio por voz: a resposta volta falada, sem pedir clique.
        await enviar(dados.texto, true);
      } catch {
        setFalas((f) => [...f, { de: "marina", texto: INDISPONIVEL }]);
      } finally {
        setTranscrevendo(false);
      }
    };
    try { gravador.stop(); } catch {}
  }

  /**
   * Toca uma resposta da Marina em voz.
   *
   * Sob demanda, nunca automatico: a sintese e cobrada por caractere, e num
   * chat publico tocar audio sozinho transformaria todo visitante curioso em
   * gasto. Quem quer ouvir, clica — e clicar de novo para.
   */
  async function ouvir(indice: number, texto: string) {
    if (vozTocando === indice || vozCarregando !== null) {
      audioRef.current?.pause();
      audioRef.current = null;
      setVozTocando(null);
      return;
    }
    audioRef.current?.pause();
    setVozCarregando(indice);

    try {
      const r = await fetch("/api/chat/voz", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessao, texto }),
      });
      if (r.status === 503) { setVozDisponivel(false); return; }
      if (!r.ok) return;

      const som = new Audio(URL.createObjectURL(await r.blob()));
      audioRef.current = som;
      som.onended = () => setVozTocando(null);
      som.onerror = () => setVozTocando(null);
      await som.play();
      setVozTocando(indice);
    } catch {
      setVozTocando(null);
    } finally {
      setVozCarregando(null);
    }
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
              <button onClick={fechar} aria-label="Fechar atendimento"
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
              <div key={i}>
                <Balao de={f.de}>
                  {f.texto
                    ? (f.de === "marina" ? <Marcacao texto={f.texto} /> : f.texto)
                    : (f.de === "marina" ? <Pontinhos /> : "")}
                </Balao>

                {f.de === "marina" && f.texto && vozDisponivel && !esperando && (
                  <button
                    onClick={() => ouvir(i, f.texto)}
                    aria-label={vozTocando === i ? "Parar o áudio" : "Ouvir esta resposta"}
                    className="flex items-center gap-1 mt-1 ml-0.5 text-[11px] text-tinta-suave hover:text-tinta transition-marca"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      {vozTocando === i
                        ? <><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></>
                        : <path d="M8 5v14l11-7z" />}
                    </svg>
                    {vozCarregando === i ? "gerando…" : vozTocando === i ? "parar" : "ouvir"}
                  </button>
                )}
              </div>
            ))}

            {esperando && falas[falas.length - 1]?.de === "visitante" && (
              <Balao de="marina"><Pontinhos /></Balao>
            )}

            <div ref={fimRef} />
          </div>

          {/* ── escrever ── */}
          <div className="shrink-0 border-t border-linha bg-white p-3"
            style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
            {gravando ? (
              /* Barra de gravação: some o campo de texto e fica só o que
                 importa — o tempo correndo, cancelar e enviar. Misturar
                 gravação e digitação na mesma barra faz a pessoa errar o
                 botão, e errar aqui significa perder o que ela falou. */
              <div className="flex items-center gap-3 h-11">
                <button type="button" onClick={descartar} aria-label="Descartar gravação"
                  className="shrink-0 flex items-center justify-center w-10 h-10 rounded-marca text-tinta-suave hover:text-tinta transition-marca">
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2" strokeLinecap="round" aria-hidden>
                    <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
                  </svg>
                </button>

                <span className="flex items-center gap-2 flex-1 min-w-0 text-sm text-tinta">
                  <span className="w-2.5 h-2.5 rounded-full bg-acento animate-pulse shrink-0" aria-hidden />
                  <span className="tabular-nums">{relogio(segundos)}</span>
                  <span className="text-tinta-suave text-[11px] truncate">
                    / {relogio(LIMITE_AUDIO_SEGUNDOS)}
                  </span>
                </span>

                <button type="button" onClick={concluir} aria-label="Enviar áudio"
                  className="shrink-0 flex items-center justify-center w-11 h-11 rounded-marca bg-marca text-marca-texto transition-marca">
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M4 12 20 4l-4 16-4-6-8-2Z" />
                  </svg>
                </button>
              </div>
            ) : (
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
                disabled={transcrevendo}
                placeholder={transcrevendo ? "Entendendo o que você falou…" : "Escreva sua pergunta…"}
                className="flex-1 min-w-0 resize-none border border-linha rounded-marca px-3 py-2.5 text-sm text-tinta disabled:bg-areia/40 focus:outline-none focus:ring-2 focus:ring-marca/20 focus:border-marca"
              />

              {/* Microfone enquanto não há texto, enviar quando há. É o que
                  todo mensageiro faz, e economiza um botão na largura de
                  celular, que é onde a barra aperta. */}
              {temMicrofone && !temTexto ? (
                <button type="button" onClick={gravar} disabled={transcrevendo || esperando}
                  aria-label="Gravar um áudio"
                  className="shrink-0 flex items-center justify-center w-11 h-11 rounded-marca border border-linha bg-white text-tinta-suave hover:text-tinta disabled:opacity-40 transition-marca">
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
            )}

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

/* ── o pouco de markdown que a Marina usa ───────────────────────────
   Ela escreve **negrito**, links e imagens. Sem isto a pessoa lê
   "**Suite Lua de Mel**" com os asteriscos e o endereco aparece como
   texto solto, que ninguem clica.

   E um analisador minusculo de proposito: uma biblioteca de markdown
   inteira num widget de chat traz tabela, HTML embutido e um vetor de
   injecao que nao precisamos. Aqui nada vira HTML — tudo vira elemento
   React, e so `https://` passa. */
function Marcacao({ texto }: { texto: string }) {
  return (
    <>
      {texto.split("\n").map((linha, i) => {
        const imagem = linha.trim().match(/^!\[([^\]]*)\]\((https:\/\/[^\s)]+)\)$/);
        if (imagem) {
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={imagem[2]}
              alt={imagem[1] || "Foto da pousada"}
              loading="lazy"
              className="block w-full max-w-[16rem] rounded-marca my-1.5 border border-linha"
            />
          );
        }
        return (
          <span key={i} className="block min-h-[1px]">{pedacos(linha)}</span>
        );
      })}
    </>
  );
}

/** Quebra uma linha em negrito, links e texto comum. */
function pedacos(linha: string): React.ReactNode[] {
  const saida: React.ReactNode[] = [];
  const padrao = /\*\*([^*]+)\*\*|\[([^\]]+)\]\((https:\/\/[^\s)]+)\)|(https:\/\/[^\s<>"]+)/g;
  let ultimo = 0;
  let m: RegExpExecArray | null;
  let n = 0;

  while ((m = padrao.exec(linha)) !== null) {
    if (m.index > ultimo) saida.push(linha.slice(ultimo, m.index));
    if (m[1] !== undefined) {
      saida.push(<strong key={n++} className="font-semibold">{m[1]}</strong>);
    } else {
      const texto = m[2] ?? m[4];
      const href = m[3] ?? m[4];
      saida.push(
        <a key={n++} href={href} target="_blank" rel="noopener noreferrer"
          className="underline decoration-current/40 underline-offset-2 break-all hover:decoration-current">
          {texto}
        </a>,
      );
    }
    ultimo = m.index + m[0].length;
  }
  if (ultimo < linha.length) saida.push(linha.slice(ultimo));
  return saida;
}

/** Segundos em m:ss — o formato que todo mundo le sem pensar. */
function relogio(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
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
