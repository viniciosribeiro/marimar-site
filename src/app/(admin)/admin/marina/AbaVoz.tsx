"use client";

import { useRef, useState } from "react";
import { Play, Square } from "lucide-react";
import type { ConfigMarina } from "@/lib/marina";
import { Aviso, Cartao, botao, campo, Rotulo } from "@/components/admin/ui";
import { useAcao, Girando } from "@/components/admin/ui-cliente";
import { salvarVoz } from "./actions";

const FRASES = [
  "Oi! Sou a Marina, da Pousada Marimar. O café da manhã é servido das 8 às 10, e o check-in começa às 14 horas.",
  "Para chegar, pegue o barco em Pontal do Sul com destino a Encantadas. A travessia leva uns 30 minutos.",
  "Que bom que você quer vir! Me conta as datas e quantas pessoas, que eu consulto a disponibilidade agora mesmo.",
];

/**
 * A voz da Marina (ElevenLabs), nos dois canais.
 *
 * Ouvir antes de salvar — com uma frase de exemplo ou uma escrita na hora.
 * Sem isso, escolher voz vira tentativa e erro em produção.
 */
export function AbaVoz({ config, vozApi }: { config: ConfigMarina; vozApi: boolean }) {
  const [voz, setVoz] = useState(config.voz_id ?? "");
  const [modelo, setModelo] = useState(config.voz_modelo);
  const [estab, setEstab] = useState(config.voz_estabilidade);
  const [semel, setSemel] = useState(config.voz_semelhanca);
  const [veloc, setVeloc] = useState(config.voz_velocidade);
  const [frase, setFrase] = useState(FRASES[0]);
  const [estado, setEstado] = useState<"parado" | "gerando" | "tocando">("parado");
  const [falha, setFalha] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const { executar, pendente } = useAcao();

  async function ouvir() {
    if (estado === "tocando") { audio.current?.pause(); setEstado("parado"); return; }
    setEstado("gerando");
    setFalha(null);
    try {
      const r = await fetch("/api/admin/voz-teste", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ voz_id: voz, voz_modelo: modelo, voz_estabilidade: estab, voz_semelhanca: semel, voz_velocidade: veloc, frase }),
      });
      if (!r.ok) { setFalha((await r.json().catch(() => null))?.erro ?? "Não consegui gerar o áudio."); setEstado("parado"); return; }
      const a = new Audio(URL.createObjectURL(await r.blob()));
      audio.current = a;
      a.onended = () => setEstado("parado");
      await a.play();
      setEstado("tocando");
    } catch {
      setFalha("Não consegui gerar o áudio.");
      setEstado("parado");
    }
  }

  return (
    <form action={async (fd) => { await executar(salvarVoz, fd); }} className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <Cartao titulo="Ajustes da voz" descricao="Ao salvar, a voz vale no chat do site e no WhatsApp. Se o WhatsApp recusar, o aviso diz o motivo — e o site já fica com a voz nova.">
        <div className="space-y-6">
          {!vozApi && <Aviso tom="aviso">Falta a chave da ElevenLabs (ELEVENLABS_API_KEY) na Vercel: dá para salvar, mas não para ouvir a prova.</Aviso>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Rotulo rotulo="ID da voz" ajuda="Na ElevenLabs, em Voices, abra a voz e copie o ID.">
              <input name="voz_id" value={voz} onChange={(e) => setVoz(e.target.value)} placeholder="RGymW84CSmfVugnA5tvA" className={campo + " font-mono"} />
            </Rotulo>
            <Rotulo rotulo="Modelo" ajuda="O multilingual fala português com naturalidade.">
              <select name="voz_modelo" value={modelo} onChange={(e) => setModelo(e.target.value)} className={campo}>
                <option value="eleven_multilingual_v2">Multilingual v2 (recomendado)</option>
                <option value="eleven_v3">v3</option>
              </select>
            </Rotulo>
          </div>
          <Deslizante nome="voz_estabilidade" rotulo="Estabilidade" valor={estab} aoMudar={setEstab} min={0} max={100}
            esquerda="mais expressiva" direita="mais uniforme" />
          <Deslizante nome="voz_semelhanca" rotulo="Semelhança com a voz original" valor={semel} aoMudar={setSemel} min={0} max={100}
            esquerda="mais livre" direita="mais fiel (pode chiar)" />
          <Deslizante nome="voz_velocidade" rotulo="Velocidade" valor={veloc} aoMudar={setVeloc} min={70} max={120} sufixo="%"
            esquerda="mais devagar" direita="mais rápida" />
          <div className="flex justify-end border-t border-linha/60 pt-4">
            <button type="submit" disabled={pendente} className={botao("primario")}>{pendente && <Girando />} Salvar voz</button>
          </div>
        </div>
      </Cartao>

      <Cartao titulo="Ouvir antes de salvar" descricao="Usa os ajustes da tela, mesmo sem salvar.">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {FRASES.map((f, i) => (
              <button key={i} type="button" onClick={() => setFrase(f)}
                className={`min-h-8 rounded-full border px-3 text-xs ${frase === f ? "border-marca bg-marca-sutil text-marca" : "border-linha text-tinta-suave hover:bg-areia/50"}`}>
                Exemplo {i + 1}
              </button>
            ))}
          </div>
          <textarea value={frase} onChange={(e) => setFrase(e.target.value.slice(0, 300))} rows={5} className={campo + " leading-relaxed"} aria-label="Frase para ouvir" />
          <p className="text-right text-[11px] text-tinta-suave tabular-nums">{frase.length} / 300</p>
          <button type="button" onClick={ouvir} disabled={!voz || !frase.trim() || estado === "gerando" || !vozApi} className={botao("secundario", "lg", "w-full")}>
            {estado === "gerando" ? <><Girando /> Gerando…</> : estado === "tocando" ? <><Square className="h-4 w-4" /> Parar</> : <><Play className="h-4 w-4" /> Ouvir a Marina</>}
          </button>
          {falha && <Aviso tom="erro">{falha}</Aviso>}
        </div>
      </Cartao>
    </form>
  );
}

function Deslizante({ nome, rotulo, valor, aoMudar, min, max, sufixo = "", esquerda, direita }: {
  nome: string; rotulo: string; valor: number; aoMudar: (v: number) => void;
  min: number; max: number; sufixo?: string; esquerda: string; direita: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor={nome} className="text-sm font-medium text-tinta">{rotulo}</label>
        <span className="rounded-lg bg-areia px-2 py-0.5 text-xs font-semibold tabular-nums text-tinta">{valor}{sufixo}</span>
      </div>
      <input id={nome} type="range" name={nome} min={min} max={max} value={valor}
        onChange={(e) => aoMudar(Number(e.target.value))} className="mt-3 w-full accent-[var(--marca)] h-2" />
      <div className="mt-1 flex justify-between text-[11px] text-tinta-suave"><span>{esquerda}</span><span>{direita}</span></div>
    </div>
  );
}
