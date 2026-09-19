"use client";

import { useState } from "react";
import type { ConfigMarina, Ensinamento } from "@/lib/marina";
import {
  salvarVoz, salvarTom, salvarEnsinamento,
  alternarEnsinamento, removerEnsinamento, corrigirResposta,
} from "./actions";

type Conversa = {
  sessao: string;
  quando: string;
  trocas: { id: string; papel: string; conteudo: string; marcada: boolean; correcao: string | null }[];
};

const ABAS = [
  { id: "voz", rotulo: "Voz" },
  { id: "tom", rotulo: "Jeito de falar" },
  { id: "conhecimento", rotulo: "O que ela sabe" },
  { id: "limites", rotulo: "O que ela nunca diz" },
  { id: "conversas", rotulo: "Conversas" },
];

export function PainelMarina({
  aba, ok, erro, config, fatos, limites, conversas,
}: {
  aba: string; ok?: string; erro?: string;
  config: ConfigMarina; fatos: Ensinamento[]; limites: Ensinamento[]; conversas: Conversa[];
}) {
  const [atual, setAtual] = useState(aba);

  return (
    <div>
      {ok && <Aviso tom="ok">{ok}</Aviso>}
      {erro && <Aviso tom="erro">{erro}</Aviso>}

      <div className="flex gap-1 overflow-x-auto border-b border-gray-200 mb-6 -mx-1 px-1">
        {ABAS.map((a) => (
          <button key={a.id} onClick={() => setAtual(a.id)}
            className={`shrink-0 px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              atual === a.id
                ? "border-gray-900 text-gray-900"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}>
            {a.rotulo}
          </button>
        ))}
      </div>

      {atual === "voz" && <AbaVoz config={config} />}
      {atual === "tom" && <AbaTom config={config} />}
      {atual === "conhecimento" && <AbaEnsinamentos tipo="fato" itens={fatos} />}
      {atual === "limites" && <AbaEnsinamentos tipo="limite" itens={limites} />}
      {atual === "conversas" && <AbaConversas conversas={conversas} />}
    </div>
  );
}

/* ── voz ─────────────────────────────────────────────────────────── */

function AbaVoz({ config }: { config: ConfigMarina }) {
  const [voz, setVoz] = useState(config.voz_id ?? "");
  const [modelo, setModelo] = useState(config.voz_modelo);
  const [estab, setEstab] = useState(config.voz_estabilidade);
  const [semel, setSemel] = useState(config.voz_semelhanca);
  const [veloc, setVeloc] = useState(config.voz_velocidade);
  const [provando, setProvando] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);

  /* Ouvir antes de salvar. Sem isso, escolher voz vira tentativa e erro em
     produção — e quem opera acaba com medo de mexer nos ajustes. */
  async function provar() {
    setProvando(true);
    setFalha(null);
    try {
      const r = await fetch("/api/admin/voz-teste", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          voz_id: voz, voz_modelo: modelo,
          voz_estabilidade: estab, voz_semelhanca: semel, voz_velocidade: veloc,
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => null);
        setFalha(d?.erro ?? "Não consegui gerar a prova.");
        return;
      }
      await new Audio(URL.createObjectURL(await r.blob())).play();
    } catch {
      setFalha("Não consegui gerar a prova.");
    } finally {
      setProvando(false);
    }
  }

  return (
    <form action={salvarVoz} className="space-y-6 max-w-2xl">
      <Campo
        rotulo="ID da voz"
        ajuda="É o código da voz escolhida na ElevenLabs. Lá em Voices, abra a voz e copie o ID."
      >
        <input name="voz_id" value={voz} onChange={(e) => setVoz(e.target.value)}
          placeholder="RGymW84CSmfVugnA5tvA"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm" />
      </Campo>

      <Campo rotulo="Modelo" ajuda="O multilingual fala português com naturalidade. Só mude se souber o motivo.">
        <select name="voz_modelo" value={modelo} onChange={(e) => setModelo(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
          <option value="eleven_multilingual_v2">Multilingual v2 (recomendado)</option>
          <option value="eleven_v3">v3</option>
        </select>
      </Campo>

      <Deslizante nome="voz_estabilidade" rotulo="Estabilidade" valor={estab} aoMudar={setEstab}
        min={0} max={100}
        ajuda="Baixa deixa a fala mais expressiva e mais imprevisível. Alta deixa mais uniforme e mais monótona." />

      <Deslizante nome="voz_semelhanca" rotulo="Semelhança com a voz original" valor={semel} aoMudar={setSemel}
        min={0} max={100}
        ajuda="Quanto ela tenta imitar a voz que você escolheu. Muito alta às vezes traz chiado junto." />

      <Deslizante nome="voz_velocidade" rotulo="Velocidade" valor={veloc} aoMudar={setVeloc}
        min={70} max={120} sufixo="%"
        ajuda="100% é o ritmo natural. Quem está decidindo uma viagem entende melhor um pouco mais devagar." />

      {falha && <Aviso tom="erro">{falha}</Aviso>}

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button type="submit"
          className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800">
          Salvar
        </button>
        <button type="button" onClick={provar} disabled={!voz || provando}
          className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40">
          {provando ? "Gerando…" : "▶ Ouvir uma prova"}
        </button>
        <span className="text-xs text-gray-500">A prova usa os valores da tela, mesmo sem salvar.</span>
      </div>
    </form>
  );
}

/* ── jeito de falar ──────────────────────────────────────────────── */

function AbaTom({ config }: { config: ConfigMarina }) {
  return (
    <form action={salvarTom} className="space-y-4 max-w-2xl">
      <Campo
        rotulo="Como a Marina deve falar"
        ajuda="Escreva em português corrido, como se estivesse orientando uma recepcionista nova. Ela segue isto nos dois canais."
      >
        <textarea name="tom" rows={10} defaultValue={config.tom ?? ""}
          placeholder={"Exemplo:\n\nFale como alguém da recepção: cordial, direta, sem formalidade de folheto.\nRespostas curtas — quem está no celular decidindo uma viagem não lê parágrafo longo.\nQuando perguntarem sobre chegar na ilha, lembre que não entra carro e que a travessia tem horário."}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm leading-relaxed" />
      </Campo>
      <button type="submit"
        className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800">
        Salvar
      </button>
    </form>
  );
}

/* ── conhecimento e limites ──────────────────────────────────────── */

function AbaEnsinamentos({ tipo, itens }: { tipo: "fato" | "limite"; itens: Ensinamento[] }) {
  const aba = tipo === "limite" ? "limites" : "conhecimento";
  const ehLimite = tipo === "limite";

  return (
    <div className="space-y-8 max-w-3xl">
      <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-600">
        {ehLimite
          ? "Coisas que a Marina nunca deve dizer, mesmo se o hóspede insistir. Use para promessas que a pousada não pode cumprir."
          : "Fatos sobre a pousada que ela passa a tratar como oficiais. Preço e disponibilidade não entram aqui — isso vem do sistema de reservas, sempre ao vivo."}
      </div>

      <form action={salvarEnsinamento} className="space-y-4 rounded-lg border border-gray-200 p-4">
        <input type="hidden" name="tipo" value={tipo} />
        <Campo rotulo="Assunto" ajuda="Duas ou três palavras, para você achar depois.">
          <input name="titulo" required
            placeholder={ehLimite ? "Desconto por telefone" : "Estacionamento em Pontal do Sul"}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </Campo>
        <Campo rotulo={ehLimite ? "O que ela nunca deve dizer" : "O que ela deve saber"}>
          <textarea name="conteudo" rows={4} required
            placeholder={ehLimite
              ? "Nunca prometa desconto. Diga que valores são os do sistema e ofereça falar com a pousada."
              : "O estacionamento fica em Pontal do Sul, antes da travessia. A diária é paga direto no estacionamento, não conosco."}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm leading-relaxed" />
        </Campo>
        <button type="submit"
          className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800">
          {ehLimite ? "Adicionar limite" : "Ensinar"}
        </button>
      </form>

      {itens.length === 0 ? (
        <p className="text-sm text-gray-500">Nada cadastrado ainda.</p>
      ) : (
        <ul className="space-y-3">
          {itens.map((i) => (
            <li key={i.id} className="rounded-lg border border-gray-200 p-4">
              <p className="font-semibold text-sm text-gray-900">{i.titulo}</p>
              <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{i.conteudo}</p>
              <div className="flex gap-4 mt-3">
                <form action={alternarEnsinamento}>
                  <input type="hidden" name="id" value={i.id} />
                  <input type="hidden" name="aba" value={aba} />
                  <button className="text-xs text-gray-500 hover:text-gray-900 underline">
                    Desligar por enquanto
                  </button>
                </form>
                <form action={removerEnsinamento}>
                  <input type="hidden" name="id" value={i.id} />
                  <input type="hidden" name="aba" value={aba} />
                  <button className="text-xs text-red-600 hover:text-red-800 underline">
                    Apagar
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ── conversas ───────────────────────────────────────────────────── */

function AbaConversas({ conversas }: { conversas: Conversa[] }) {
  return (
    <div className="space-y-6 max-w-3xl">
      <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-600">
        As últimas conversas do chat do site. Quando uma resposta sair errada, escreva o que ela
        deveria ter dito — a correção vira um ensinamento novo na hora.
        <br />
        <span className="text-gray-500">
          As conversas do WhatsApp ainda não aparecem aqui: ficam guardadas no OpenClaw.
        </span>
      </div>

      {conversas.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhuma conversa ainda.</p>
      ) : (
        conversas.map((c) => (
          <details key={c.sessao} className="rounded-lg border border-gray-200">
            <summary className="cursor-pointer px-4 py-3 text-sm">
              <span className="font-medium text-gray-900">{c.quando}</span>
              <span className="text-gray-500"> · {c.trocas.length} mensagens</span>
              {c.trocas.some((t) => t.marcada) && (
                <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-800">
                  corrigida
                </span>
              )}
            </summary>

            <div className="border-t border-gray-100 p-4 space-y-4">
              {c.trocas.map((t) => (
                <div key={t.id}>
                  <p className="text-[11px] uppercase tracking-wide text-gray-400">
                    {t.papel === "marina" ? "Marina" : "Visitante"}
                  </p>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{t.conteudo}</p>

                  {t.papel === "marina" && (
                    t.correcao ? (
                      <p className="mt-2 rounded bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-900">
                        <strong>Você corrigiu:</strong> {t.correcao}
                      </p>
                    ) : (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-900 underline">
                          Isto saiu errado
                        </summary>
                        <form action={corrigirResposta} className="mt-2 space-y-2">
                          <input type="hidden" name="id" value={t.id} />
                          <input name="assunto" placeholder="Assunto (ex.: Estacionamento)"
                            className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs" />
                          <textarea name="correcao" rows={3} required
                            placeholder="O que ela deveria ter dito"
                            className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs" />
                          <button className="rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800">
                            Corrigir e ensinar
                          </button>
                        </form>
                      </details>
                    )
                  )}
                </div>
              ))}
            </div>
          </details>
        ))
      )}
    </div>
  );
}

/* ── peças ───────────────────────────────────────────────────────── */

function Campo({ rotulo, ajuda, children }: { rotulo: string; ajuda?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-900">{rotulo}</span>
      {ajuda && <span className="block text-xs text-gray-500 mt-0.5 mb-1.5">{ajuda}</span>}
      <div className={ajuda ? "" : "mt-1.5"}>{children}</div>
    </label>
  );
}

function Deslizante({
  nome, rotulo, ajuda, valor, aoMudar, min, max, sufixo = "",
}: {
  nome: string; rotulo: string; ajuda: string; valor: number;
  aoMudar: (v: number) => void; min: number; max: number; sufixo?: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-gray-900">{rotulo}</span>
        <span className="text-sm tabular-nums text-gray-600">{valor}{sufixo}</span>
      </div>
      <p className="text-xs text-gray-500 mt-0.5 mb-2">{ajuda}</p>
      <input type="range" name={nome} min={min} max={max} value={valor}
        onChange={(e) => aoMudar(Number(e.target.value))}
        className="w-full accent-gray-900" />
    </div>
  );
}

function Aviso({ tom, children }: { tom: "ok" | "erro"; children: React.ReactNode }) {
  return (
    <div className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
      tom === "ok"
        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
        : "border-red-200 bg-red-50 text-red-900"
    }`}>
      {children}
    </div>
  );
}
