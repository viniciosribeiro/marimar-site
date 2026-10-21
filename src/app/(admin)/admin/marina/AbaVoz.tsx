"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ExternalLink, KeyRound, Play, RefreshCw, Search, Square } from "lucide-react";
import {
  JEITO_PADRAO, MODELOS_ELEVEN, MODELOS_GOOGLE, MODELOS_OPENAI, PROVEDOR, PROVEDORES_VOZ, VOZES_GOOGLE, VOZES_OPENAI,
  camposDaTela, conectadoA, doProvedor, oProvedor, openaiAceitaInstrucoes, openaiAceitaVelocidade, rotuloVoz,
  type OpcoesVoz, type Provedor, type Voz,
} from "@/lib/voz-base";
import type { Conferencia, VozConta } from "@/lib/voz";
import { Aviso, Cartao, Selo, botao, campo, cn } from "@/components/admin/ui";
import { useAcao, Girando, avisar } from "@/components/admin/ui-cliente";
import { conectarProvedor, conferirVoz, desconectarProvedor, reaplicarVoz, salvarVoz, vozesDaConta, type RespostaVoz } from "./voz-actions";
import type { DadosVoz } from "./tipos";

const FRASES = [
  "Oi! Sou a Marina, da Pousada Marimar. O café da manhã é servido das 8 às 10, e o check-in começa às 14 horas.",
  "Para chegar, pegue o barco em Pontal do Sul com destino a Encantadas. A travessia leva uns 30 minutos.",
  "Que bom que você quer vir! Me conta as datas e quantas pessoas, que eu consulto a disponibilidade agora mesmo.",
];
const AMOSTRA = "Oi! Eu sou a Marina, da Pousada Marimar. Como posso te ajudar?";

/**
 * A voz da Marina, a mesma no site e no WhatsApp (docs/voz-marina.md).
 *
 * Três passos: de onde vem a voz (ElevenLabs, OpenAI, Google), qual voz, e
 * o jeito de falar. Tudo se ouve antes de salvar; ao salvar, o painel leva
 * a voz ao servidor da Marina e confere lendo de volta o que o WhatsApp
 * vai usar.
 */
export function AbaVoz({ voz }: { voz: DadosVoz }) {
  const [o, setO] = useState<OpcoesVoz>(voz.opcoes);
  const [frase, setFrase] = useState(FRASES[0]);
  const [tocando, setTocando] = useState<string | null>(null);
  const [gerando, setGerando] = useState<string | null>(null);
  const [falha, setFalha] = useState<string | null>(null);
  const [conf, setConf] = useState<Conferencia | "carregando" | null>("carregando");
  const audio = useRef<HTMLAudioElement | null>(null);
  const { executar, pendente } = useAcao();

  const conectado = (p: Provedor) => voz.chaves[p].origem !== null;
  const mudou = JSON.stringify(o) !== JSON.stringify(voz.opcoes);

  /* Ao abrir: o WhatsApp está mesmo com a voz do site? (lê o servidor da Marina) */
  useEffect(() => {
    let vivo = true;
    conferirVoz().then((r) => { if (vivo) setConf(r.conferencia ?? null); }).catch(() => { if (vivo) setConf(null); });
    return () => { vivo = false; audio.current?.pause(); };
  }, []);

  const mudar = <P extends Provedor>(p: P, campos: Partial<OpcoesVoz[P]>) => setO((a) => ({ ...a, [p]: { ...a[p], ...campos } }));

  /** Toca a voz com os ajustes da tela (ou com outra voz, para comparar na lista). */
  async function ouvir(chaveDoBotao: string, opcoes: OpcoesVoz, texto: string) {
    if (tocando === chaveDoBotao) { audio.current?.pause(); setTocando(null); return; }
    audio.current?.pause();
    setTocando(null); setGerando(chaveDoBotao); setFalha(null);
    try {
      const r = await fetch("/api/admin/voz-teste", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...camposDaTela(opcoes), frase: texto }),
      });
      if (!r.ok) { setFalha((await r.json().catch(() => null))?.erro ?? "Não consegui gerar o áudio."); return; }
      tocarUrl(chaveDoBotao, URL.createObjectURL(await r.blob()));
    } catch {
      setFalha("Não consegui gerar o áudio.");
    } finally {
      setGerando(null);
    }
  }

  function tocarUrl(chaveDoBotao: string, url: string) {
    audio.current?.pause();
    const a = new Audio(url);
    audio.current = a;
    a.onended = () => setTocando(null);
    a.play().then(() => setTocando(chaveDoBotao)).catch(() => setFalha("O navegador não tocou o áudio."));
  }

  async function salvar() {
    const fd = new FormData();
    for (const [k, v] of Object.entries(camposDaTela(o))) fd.set(k, String(v));
    const r = (await executar(salvarVoz, fd)) as RespostaVoz;
    if (r.conferencia) setConf(r.conferencia);
  }

  async function levarDeNovo() {
    setConf("carregando");
    const r = await reaplicarVoz();
    avisar(r.mensagem, r.ok ? "ok" : "erro");
    setConf(r.conferencia ?? null);
  }

  const p = o.provedor;
  return (
    <div className="space-y-6">
      <Situacao o={voz.opcoes} conf={conf} mudou={mudou} aoConferir={() => { setConf("carregando"); conferirVoz().then((r) => setConf(r.conferencia ?? null)); }} aoLevar={levarDeNovo} />

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-6">
          <Cartao titulo="1. De onde vem a voz" descricao="Escolha o provedor. A conta precisa estar conectada para ouvir e salvar.">
            <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Provedor de voz">
              {PROVEDORES_VOZ.map((id) => (
                <button key={id} type="button" role="radio" aria-checked={p === id} onClick={() => setO((a) => ({ ...a, provedor: id }))}
                  className={cn("flex min-h-28 flex-col items-start gap-1.5 rounded-2xl border p-4 text-left transition-colors",
                    p === id ? "border-marca bg-marca-sutil ring-2 ring-marca/30" : "border-linha bg-white/60 hover:bg-white/90")}>
                  <span className="flex w-full items-center justify-between gap-2">
                    <span className="font-semibold text-tinta">{PROVEDOR[id].nome}</span>
                    {p === id && <Check className="h-4 w-4 text-marca" aria-hidden />}
                  </span>
                  <span className="text-xs leading-snug text-tinta-suave">{PROVEDOR[id].resumo}</span>
                  <span className="mt-auto pt-1">
                    {voz.chaves[id].origem === "vercel" ? <Selo tom="sucesso" ponto>{conectadoA(id).split(" ").pop()} (Vercel)</Selo>
                      : voz.chaves[id].origem === "painel" ? <Selo tom="sucesso" ponto>{conectadoA(id).split(" ").pop()} {voz.chaves[id].final}</Selo>
                      : <Selo tom="neutro">Falta conectar</Selo>}
                  </span>
                </button>
              ))}
            </div>
            <Conexao provedor={p} estado={voz.chaves[p]} podeConectar={voz.podeConectar} aoConferir={setConf} />
          </Cartao>

          {conectado(p) && (
            <Cartao titulo="2. Qual voz" descricao="Toque em ▶ para ouvir cada uma com a mesma frase curta. As marcadas como sugeridas combinam com uma recepcionista simpática.">
              {p === "elevenlabs" && (
                <VozesEleven escolhida={o.elevenlabs.voz} aoEscolher={(id) => mudar("elevenlabs", { voz: id })}
                  tocando={tocando} gerando={gerando} aoOuvirPrevia={tocarUrl}
                  aoOuvir={(id) => ouvir(`v:${id}`, { ...o, elevenlabs: { ...o.elevenlabs, voz: id } }, AMOSTRA)} />
              )}
              {p === "openai" && (
                <ListaVozes vozes={VOZES_OPENAI} escolhida={o.openai.voz} aoEscolher={(id) => mudar("openai", { voz: id })}
                  tocando={tocando} gerando={gerando} aoOuvir={(id) => ouvir(`v:${id}`, { ...o, openai: { ...o.openai, voz: id } }, AMOSTRA)} />
              )}
              {p === "google" && (
                <ListaVozes vozes={VOZES_GOOGLE} escolhida={o.google.voz} aoEscolher={(id) => mudar("google", { voz: id })}
                  tocando={tocando} gerando={gerando} aoOuvir={(id) => ouvir(`v:${id}`, { ...o, google: { ...o.google, voz: id } }, AMOSTRA)} />
              )}
            </Cartao>
          )}

          {conectado(p) && (
            <Cartao titulo="3. Jeito de falar" descricao="Vale igual no site e no WhatsApp.">
              <JeitoDeFalar o={o} mudar={mudar} />
            </Cartao>
          )}
        </div>

        <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <Cartao titulo="Ouvir antes de salvar" descricao="Com tudo o que está na tela, mesmo sem salvar.">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {FRASES.map((f, i) => (
                  <button key={i} type="button" onClick={() => setFrase(f)}
                    className={cn("min-h-8 rounded-full border px-3 text-xs", frase === f ? "border-marca bg-marca-sutil text-marca" : "border-linha text-tinta-suave hover:bg-areia/50")}>
                    Exemplo {i + 1}
                  </button>
                ))}
              </div>
              <textarea value={frase} onChange={(e) => setFrase(e.target.value.slice(0, 300))} rows={5} className={campo + " leading-relaxed"} aria-label="Frase para ouvir" />
              <p className="text-right text-[11px] tabular-nums text-tinta-suave">{frase.length} / 300</p>
              <button type="button" onClick={() => ouvir("frase", o, frase)}
                disabled={!conectado(p) || !frase.trim() || gerando !== null || (p === "elevenlabs" && !o.elevenlabs.voz)}
                className={botao("secundario", "lg", "w-full")}>
                {gerando === "frase" ? <><Girando /> Gerando…</> : tocando === "frase" ? <><Square className="h-4 w-4" /> Parar</> : <><Play className="h-4 w-4" /> Ouvir a Marina</>}
              </button>
              {falha && <Aviso tom="erro">{falha}</Aviso>}
            </div>
          </Cartao>

          <Cartao titulo="Salvar" descricao="Vale na hora no site; no WhatsApp, depois que o servidor da Marina reconecta (alguns segundos).">
            <p className="mb-3 text-sm text-tinta">{rotuloVoz(o)}</p>
            <button type="button" onClick={salvar} disabled={pendente || !conectado(p) || (p === "elevenlabs" && !o.elevenlabs.voz)}
              className={botao("primario", "lg", "w-full")}>
              {pendente ? <><Girando /> Salvando e levando ao WhatsApp…</> : "Salvar nos dois canais"}
            </button>
            {mudou && !pendente && <p className="mt-2 text-xs text-tinta-suave">Há mudanças ainda não salvas.</p>}
          </Cartao>
        </div>
      </div>
    </div>
  );
}

/* ── a situação agora: site × WhatsApp ───────────────────────────── */

function Situacao({ o, conf, mudou, aoConferir, aoLevar }: {
  o: OpcoesVoz; conf: Conferencia | "carregando" | null; mudou: boolean; aoConferir: () => void; aoLevar: () => void;
}) {
  return (
    <Cartao titulo="A voz da Marina agora" descricao={rotuloVoz(o)}
      acoes={<button type="button" onClick={aoConferir} disabled={conf === "carregando"} className={botao("fantasma", "sm")}><RefreshCw className="h-3.5 w-3.5" /> Conferir de novo</button>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-linha/70 bg-white/60 p-3">
          <p className="text-xs text-tinta-suave">Chat do site</p>
          <p className="mt-1 flex items-center gap-2 text-sm font-medium text-tinta"><Selo tom="sucesso" ponto>Esta voz</Selo></p>
        </div>
        <div className="rounded-2xl border border-linha/70 bg-white/60 p-3" aria-live="polite">
          <p className="text-xs text-tinta-suave">WhatsApp (servidor da Marina)</p>
          <div className="mt-1 text-sm text-tinta">
            {conf === "carregando" ? <span className="flex items-center gap-2"><Girando /> Conferindo no servidor…</span>
              : !conf || !conf.alcancou ? <Selo tom="aviso" ponto>Não deu para conferir</Selo>
              : conf.igual ? <Selo tom="sucesso" ponto>Mesma voz do site</Selo>
              : <Selo tom="erro" ponto>Voz diferente</Selo>}
          </div>
        </div>
      </div>
      {conf && conf !== "carregando" && !conf.igual && (
        <Aviso tom={conf.alcancou ? "erro" : "aviso"} className="mt-4"
          titulo={conf.alcancou ? "O WhatsApp está falando diferente do site" : "O painel não conseguiu ler o servidor da Marina"}
          acao={conf.alcancou && !mudou ? <button type="button" onClick={aoLevar} className={botao("primario", "sm")}>Levar ao WhatsApp de novo</button> : undefined}>
          {conf.alcancou
            ? <ul className="list-disc space-y-0.5 pl-4">{conf.diferencas.map((d) => <li key={d}>{d}</li>)}</ul>
            : <>{conf.erro}. Confira se o servidor está no ar (WhatsApp da Marina → Saúde e proteções).</>}
        </Aviso>
      )}
      {conf && conf !== "carregando" && conf.igual && conf.efetiva?.camadas.some((c) => c !== "geral") && (
        <p className="mt-3 text-xs text-tinta-suave">O servidor tem a voz também em: {conf.efetiva.camadas.filter((c) => c !== "geral").join(", ")} — o painel atualiza todas.</p>
      )}
    </Cartao>
  );
}

/* ── conectar a conta do provedor ────────────────────────────────── */

function Conexao({ provedor, estado, podeConectar, aoConferir }: {
  provedor: Provedor; estado: DadosVoz["chaves"][Provedor]; podeConectar: boolean; aoConferir: (c: Conferencia) => void;
}) {
  const [chave, setChave] = useState("");
  const [trocando, setTrocando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const { executar } = useAcao();
  const info = PROVEDOR[provedor];

  async function conectar() {
    setOcupado(true);
    const fd = new FormData();
    const r = (await executar(() => conectarProvedor(provedor, chave), fd)) as RespostaVoz;
    setOcupado(false);
    /* Conectar a conta da voz em uso já leva a chave ao WhatsApp e confere. */
    if (r.conferencia) aoConferir(r.conferencia);
    if (r.ok) { setChave(""); setTrocando(false); }
  }

  if (estado.origem === "vercel") {
    return <p className="mt-4 text-xs text-tinta-suave">A chave {doProvedor(provedor)} está na Vercel ({info.variaveis[0]}).</p>;
  }
  if (estado.origem === "painel" && !trocando) {
    return podeConectar ? (
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => setTrocando(true)} className={botao("fantasma", "sm")}><KeyRound className="h-3.5 w-3.5" /> Trocar a chave</button>
        <button type="button" onClick={() => executar(() => desconectarProvedor(provedor), new FormData())} className={botao("fantasma", "sm")}>Desconectar</button>
      </div>
    ) : null;
  }
  if (!podeConectar) {
    return <Aviso tom="info" className="mt-4">Para conectar {oProvedor(provedor)}, peça a quem tem acesso de Administração.</Aviso>;
  }
  return (
    <div className="mt-4 rounded-2xl border border-linha bg-white/70 p-4">
      <p className="text-sm font-semibold text-tinta">Conectar {oProvedor(provedor)}</p>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-tinta">
        {info.passos.map((passo) => <li key={passo}>{passo}</li>)}
      </ol>
      <a href={info.paginaChave} target="_blank" rel="noreferrer" className={botao("secundario", "sm", "mt-3")}>
        Abrir a página da chave <ExternalLink className="h-3.5 w-3.5" />
      </a>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input type="password" value={chave} onChange={(e) => setChave(e.target.value)} placeholder={`Cole a chave (${info.formato})`}
          autoComplete="off" spellCheck={false} aria-label={`Chave ${doProvedor(provedor)}`} className={campo + " font-mono"} />
        <button type="button" onClick={conectar} disabled={ocupado || chave.trim().length < 20} className={botao("primario", "md", "shrink-0")}>
          {ocupado ? <><Girando /> Testando…</> : "Testar e conectar"}
        </button>
      </div>
      <p className="mt-2 text-xs text-tinta-suave">
        A chave é testada na hora, guardada cifrada e enviada só ao servidor da Marina. Nunca mande chave por chat ou e-mail.
      </p>
      {trocando && <button type="button" onClick={() => setTrocando(false)} className={botao("fantasma", "sm", "mt-2")}>Cancelar</button>}
    </div>
  );
}

/* ── listas de vozes ─────────────────────────────────────────────── */

function BotaoOuvir({ id, tocando, gerando, aoOuvir, nome }: { id: string; tocando: string | null; gerando: string | null; aoOuvir: () => void; nome: string }) {
  const k = `v:${id}`;
  return (
    <button type="button" onClick={aoOuvir} disabled={gerando !== null && gerando !== k} aria-label={`Ouvir ${nome}`}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-linha bg-white text-tinta hover:bg-areia/60 disabled:opacity-40">
      {gerando === k ? <Girando /> : tocando === k ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
    </button>
  );
}

function CartaoVoz({ selecionada, children, aoEscolher }: { selecionada: boolean; children: React.ReactNode; aoEscolher: () => void }) {
  return (
    <li className={cn("flex min-w-0 items-center gap-3 rounded-2xl border p-2.5 pr-3", selecionada ? "border-marca bg-marca-sutil" : "border-linha/70 bg-white/60")}>
      {children}
      <button type="button" onClick={aoEscolher} aria-pressed={selecionada} aria-label={selecionada ? "Escolhida" : undefined}
        className={cn(botao(selecionada ? "primario" : "fantasma", "sm"), "ml-auto shrink-0")}>
        {selecionada ? <><Check className="h-3.5 w-3.5" /><span className="hidden sm:inline">Escolhida</span></> : "Usar"}
      </button>
    </li>
  );
}

function ListaVozes({ vozes, escolhida, aoEscolher, tocando, gerando, aoOuvir }: {
  vozes: Voz[]; escolhida: string; aoEscolher: (id: string) => void; tocando: string | null; gerando: string | null; aoOuvir: (id: string) => void;
}) {
  const [todas, setTodas] = useState(false);
  const lista = todas ? vozes : vozes.filter((v) => v.sugerida || v.id === escolhida);
  return (
    <div>
      <ul className="grid grid-cols-1 gap-2 2xl:grid-cols-2">
        {lista.map((v) => (
          <CartaoVoz key={v.id} selecionada={v.id === escolhida} aoEscolher={() => aoEscolher(v.id)}>
            <BotaoOuvir id={v.id} nome={v.nome} tocando={tocando} gerando={gerando} aoOuvir={() => aoOuvir(v.id)} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-tinta">{v.nome}{v.sugerida && <span className="ml-1.5 text-[11px] font-normal text-marca">sugerida</span>}</span>
              <span className="block truncate text-xs text-tinta-suave">{v.jeito}</span>
            </span>
          </CartaoVoz>
        ))}
      </ul>
      {vozes.length > lista.length || todas ? (
        <button type="button" onClick={() => setTodas((t) => !t)} className={botao("fantasma", "sm", "mt-3")}>
          {todas ? "Mostrar só as sugeridas" : `Ver todas as ${vozes.length} vozes`}
        </button>
      ) : null}
    </div>
  );
}

function VozesEleven({ escolhida, aoEscolher, tocando, gerando, aoOuvir, aoOuvirPrevia }: {
  escolhida: string | null; aoEscolher: (id: string) => void; tocando: string | null; gerando: string | null;
  aoOuvir: (id: string) => void; aoOuvirPrevia: (chave: string, url: string) => void;
}) {
  const [vozes, setVozes] = useState<VozConta[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [manual, setManual] = useState(false);

  useEffect(() => {
    let vivo = true;
    vozesDaConta().then((r) => { if (!vivo) return; if (r.ok) setVozes(r.vozes); else setErro(r.erro); }).catch(() => vivo && setErro("Não consegui carregar as vozes."));
    return () => { vivo = false; };
  }, []);

  const filtradas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return (vozes ?? []).filter((v) => !t || `${v.nome} ${v.jeito}`.toLowerCase().includes(t));
  }, [vozes, busca]);
  const conhecida = vozes?.some((v) => v.id === escolhida);

  return (
    <div className="space-y-3">
      {erro && <Aviso tom="erro">{erro}</Aviso>}
      {!vozes && !erro && <p className="flex items-center gap-2 text-sm text-tinta-suave"><Girando /> Carregando as vozes da sua conta…</p>}
      {vozes && (
        <>
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tinta-suave" aria-hidden />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={`Buscar entre ${vozes.length} vozes (nome, feminina, calma…)`}
              aria-label="Buscar voz" className={campo + " pl-9"} />
          </label>
          <ul className="grid max-h-[28rem] grid-cols-1 gap-2 overflow-y-auto pr-1 2xl:grid-cols-2">
            {filtradas.map((v) => (
              <CartaoVoz key={v.id} selecionada={v.id === escolhida} aoEscolher={() => aoEscolher(v.id)}>
                <BotaoOuvir id={v.id} nome={v.nome} tocando={tocando} gerando={gerando}
                  aoOuvir={() => (v.previa ? aoOuvirPrevia(`v:${v.id}`, v.previa) : aoOuvir(v.id))} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-tinta">{v.nome}{v.categoria !== "premade" && <span className="ml-1.5 text-[11px] font-normal text-marca">da sua conta</span>}</span>
                  <span className="block truncate text-xs text-tinta-suave">{v.jeito || "—"}</span>
                </span>
              </CartaoVoz>
            ))}
          </ul>
          {filtradas.length === 0 && <p className="text-sm text-tinta-suave">Nenhuma voz com “{busca}”.</p>}
        </>
      )}
      {escolhida && vozes && !conhecida && (
        <Aviso tom="aviso">A voz salva ({escolhida}) não está nesta conta. Escolha uma da lista; com outra conta, a ElevenLabs recusa o áudio.</Aviso>
      )}
      <button type="button" onClick={() => setManual((m) => !m)} className={botao("fantasma", "sm")}>{manual ? "Esconder" : "Colar o ID de uma voz"}</button>
      {manual && (
        <input value={escolhida ?? ""} onChange={(e) => aoEscolher(e.target.value.trim())} placeholder="ID da voz (ElevenLabs → Voices → ID)"
          aria-label="ID da voz" className={campo + " font-mono"} />
      )}
    </div>
  );
}

/* ── jeito de falar ──────────────────────────────────────────────── */

function JeitoDeFalar({ o, mudar }: { o: OpcoesVoz; mudar: <P extends Provedor>(p: P, campos: Partial<OpcoesVoz[P]>) => void }) {
  if (o.provedor === "elevenlabs") {
    const e = o.elevenlabs;
    return (
      <div className="space-y-6">
        <Escolha rotulo="Modelo" valor={e.modelo} opcoes={MODELOS_ELEVEN} aoMudar={(v) => mudar("elevenlabs", { modelo: v })} />
        <Deslizante id="eleven_estabilidade" rotulo="Estabilidade" valor={e.estabilidade} aoMudar={(v) => mudar("elevenlabs", { estabilidade: v })} min={0} max={100} esquerda="mais expressiva" direita="mais uniforme" />
        <Deslizante id="eleven_semelhanca" rotulo="Semelhança com a voz original" valor={e.semelhanca} aoMudar={(v) => mudar("elevenlabs", { semelhanca: v })} min={0} max={100} esquerda="mais livre" direita="mais fiel (pode chiar)" />
        <Deslizante id="eleven_velocidade" rotulo="Velocidade" valor={e.velocidade} aoMudar={(v) => mudar("elevenlabs", { velocidade: v })} min={70} max={120} sufixo="%" esquerda="mais devagar" direita="mais rápida" />
      </div>
    );
  }
  if (o.provedor === "openai") {
    const a = o.openai;
    return (
      <div className="space-y-5">
        <Escolha rotulo="Modelo" valor={a.modelo} opcoes={MODELOS_OPENAI} aoMudar={(v) => mudar("openai", { modelo: v })} />
        {openaiAceitaInstrucoes(a.modelo) && (
          <Instrucoes valor={a.instrucoes} aoMudar={(v) => mudar("openai", { instrucoes: v })} />
        )}
        {openaiAceitaVelocidade(a.modelo) && (
          <Deslizante id="openai_velocidade" rotulo="Velocidade" valor={a.velocidade} aoMudar={(v) => mudar("openai", { velocidade: v })} min={70} max={130} sufixo="%" esquerda="mais devagar" direita="mais rápida" />
        )}
      </div>
    );
  }
  const g = o.google;
  return (
    <div className="space-y-5">
      <Escolha rotulo="Modelo" valor={g.modelo} opcoes={MODELOS_GOOGLE} aoMudar={(v) => mudar("google", { modelo: v })} />
      <Instrucoes valor={g.estilo} aoMudar={(v) => mudar("google", { estilo: v })} />
    </div>
  );
}

function Instrucoes({ valor, aoMudar }: { valor: string; aoMudar: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-tinta">Como ela fala</span>
      <span className="mt-0.5 block text-xs text-tinta-suave">Sotaque, ritmo, simpatia. Ex.: “mais devagar”, “sorrindo”, “sotaque carioca”.</span>
      <textarea value={valor} onChange={(e) => aoMudar(e.target.value.slice(0, 600))} rows={4} className={campo + " mt-2 leading-relaxed"} />
      {valor !== JEITO_PADRAO && (
        <button type="button" onClick={() => aoMudar(JEITO_PADRAO)} className={botao("fantasma", "sm", "mt-1")}>Voltar ao texto sugerido</button>
      )}
    </label>
  );
}

function Escolha({ rotulo, valor, opcoes, aoMudar }: { rotulo: string; valor: string; opcoes: { id: string; nome: string }[]; aoMudar: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-tinta">{rotulo}</span>
      <select value={valor} onChange={(e) => aoMudar(e.target.value)} className={campo + " mt-2"}>
        {opcoes.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
      </select>
    </label>
  );
}

function Deslizante({ id, rotulo, valor, aoMudar, min, max, sufixo = "", esquerda, direita }: {
  id: string; rotulo: string; valor: number; aoMudar: (v: number) => void;
  min: number; max: number; sufixo?: string; esquerda: string; direita: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm font-medium text-tinta">{rotulo}</label>
        <span className="rounded-lg bg-areia px-2 py-0.5 text-xs font-semibold tabular-nums text-tinta">{valor}{sufixo}</span>
      </div>
      <input id={id} type="range" min={min} max={max} value={valor}
        onChange={(e) => aoMudar(Number(e.target.value))} className="mt-3 h-2 w-full accent-[var(--marca)]" />
      <div className="mt-1 flex justify-between text-[11px] text-tinta-suave"><span>{esquerda}</span><span>{direita}</span></div>
    </div>
  );
}
