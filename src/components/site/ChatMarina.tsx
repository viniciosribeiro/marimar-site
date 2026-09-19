"use client";

import { useState, useRef, useEffect } from "react";
import { Icone } from "./Icone";
import { SUGESTOES, SAUDACAO, INDISPONIVEL } from "@/lib/chat";

type Fala = { de: "visitante" | "marina"; texto: string };

/**
 * O chat de atendimento do site.
 *
 * Fala com a MESMA Marina do WhatsApp, através de `/api/chat`. O widget não
 * conhece token nenhum: manda a pergunta e lê letras chegando.
 *
 * A saída humana fica visível o tempo todo. Um atendimento automático que
 * esconde o caminho para uma pessoa de verdade é pior do que não ter
 * atendimento automático — e quem está decidindo uma viagem sente isso.
 */
export function ChatMarina({ whatsapp, nome }: { whatsapp: string; nome: string }) {
  const [aberto, setAberto] = useState(false);
  const [falas, setFalas] = useState<Fala[]>([]);
  const [rascunho, setRascunho] = useState("");
  const [esperando, setEsperando] = useState(false);
  const [sessao] = useState(() => novaSessao());

  const fimRef = useRef<HTMLDivElement>(null);
  const campoRef = useRef<HTMLTextAreaElement>(null);

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

  async function enviar(texto: string) {
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
  }

  const linkWhats = `https://wa.me/${whatsapp}?text=${encodeURIComponent(
    "Olá! Vim pelo site e gostaria de informações sobre a Pousada Marimar.",
  )}`;

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
        <div className="fixed inset-0 z-[70] sm:inset-auto sm:bottom-24 sm:right-5 sm:w-[23rem] flex flex-col bg-white sm:rounded-marca sm:shadow-marca-forte sm:border sm:border-linha overflow-hidden">
          {/* ── cabeçalho ── */}
          <header className="shrink-0 flex items-center gap-3 px-4 py-3 bg-marca text-marca-texto">
            <span className="flex items-center justify-center w-9 h-9 rounded-full bg-white/20 shrink-0" aria-hidden>
              <Icone nome="coracao" tamanho={18} />
            </span>
            <div className="min-w-0">
              <p className="font-semibold leading-tight">Marina</p>
              <p className="text-[11px] opacity-85 leading-tight truncate">Atendimento da {nome}</p>
            </div>
            <button onClick={() => setAberto(false)} aria-label="Fechar atendimento"
              className="ml-auto p-2 -mr-1 opacity-85 hover:opacity-100">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" aria-hidden>
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </header>

          {/* ── conversa ── */}
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-3 bg-areia/40">
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
                placeholder="Escreva sua pergunta…"
                className="flex-1 min-w-0 resize-none max-h-28 border border-linha rounded-marca px-3 py-2.5 text-sm text-tinta focus:outline-none focus:ring-2 focus:ring-marca/20 focus:border-marca"
              />
              <button type="submit" disabled={!rascunho.trim() || esperando}
                aria-label="Enviar"
                className="shrink-0 flex items-center justify-center w-11 h-11 rounded-marca bg-marca text-marca-texto disabled:opacity-40 transition-marca">
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M4 12 20 4l-4 16-4-6-8-2Z" />
                </svg>
              </button>
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
      <div className={`max-w-[85%] rounded-marca px-3.5 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-wrap ${
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
