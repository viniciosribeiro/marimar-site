"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useState } from "react";
import type { RotaConfig, Terminal } from "@/lib/rota-base";
import type { Marcador } from "@/components/site/rota/MapaRota";
import { Cartao, Aviso, Selo, Rotulo, campo, botao, cn } from "@/components/admin/ui";
import { Abas, useAcao, useConfirmar } from "@/components/admin/ui-cliente";
import { salvarRota, restaurarRotaPadrao } from "./actions";

const MapaRota = dynamic(() => import("@/components/site/rota/MapaRota"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-tinta-suave">Carregando o mapa…</div>,
});

type Aba = "pontos" | "terminais" | "textos" | "mapa";
type Alvo = "pousada" | "trapiche" | `terminal:${string}`;

const arred = (n: number) => Math.round(n * 1e6) / 1e6;
const idNovo = (nome: string, usados: string[]) => {
  const base = nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "terminal";
  let id = base, n = 2;
  while (usados.includes(id)) id = `${base}-${n++}`;
  return id;
};

/**
 * Editor da rota: pontos arrastáveis no mesmo mapa que o hóspede vê,
 * terminais de barco, textos e o visual. Salva tudo de uma vez.
 */
export function EditorRota({ inicial }: { inicial: RotaConfig }) {
  const [c, setC] = useState<RotaConfig>(inicial);
  const [aba, setAba] = useState<Aba>("pontos");
  const [alvo, setAlvo] = useState<Alvo>("pousada");
  const [mudou, setMudou] = useState(false);
  const { executar, pendente } = useAcao();
  const { confirmar, dialogo } = useConfirmar();

  const mudar = useCallback((f: (x: RotaConfig) => RotaConfig) => { setC(f); setMudou(true); }, []);
  const mudarTerminal = (id: string, p: Partial<Terminal>) =>
    mudar((x) => ({ ...x, terminais: x.terminais.map((t) => (t.id === id ? { ...t, ...p } : t)) }));

  /* Arrastar um pino no mapa. Callback estável: o mapa guarda a primeira. */
  const aoMover = useCallback((id: string, lat: number, lng: number) => {
    const ll = { lat: arred(lat), lng: arred(lng) };
    mudar((x) => {
      if (id === "pousada") return { ...x, pousada: { ...x.pousada, ...ll } };
      if (id === "trapiche") return { ...x, trapiche: { ...x.trapiche, ...ll } };
      const tid = id.replace(/^terminal:/, "");
      return { ...x, terminais: x.terminais.map((t) => (t.id === tid ? { ...t, ...ll } : t)) };
    });
  }, [mudar]);

  const marcadores = useMemo<Marcador[]>(() => [
    { id: "pousada", tipo: "pousada", nome: c.pousada.nome, lat: c.pousada.lat, lng: c.pousada.lng, arrastavel: true },
    { id: "trapiche", tipo: "trapiche", nome: c.trapiche.nome, lat: c.trapiche.lat, lng: c.trapiche.lng, arrastavel: true },
    ...c.terminais.map((t) => ({ id: `terminal:${t.id}`, tipo: "terminal" as const, nome: t.nome, lat: t.lat, lng: t.lng, arrastavel: true })),
  ], [c.pousada, c.trapiche, c.terminais]);

  const pontoAlvo = alvo === "pousada" ? c.pousada : alvo === "trapiche" ? c.trapiche : c.terminais.find((t) => `terminal:${t.id}` === alvo) ?? c.pousada;
  const centro = useMemo(() => ({ lat: inicial.pousada.lat, lng: inicial.pousada.lng }), [inicial.pousada]);

  function salvar() {
    const fd = new FormData();
    fd.set("config", JSON.stringify(c));
    executar(salvarRota, fd, (r) => { if (r.ok) setMudou(false); });
  }

  async function restaurar() {
    if (!(await confirmar({ titulo: "Voltar ao padrão?", texto: "Pontos, terminais, textos e mapa voltam ao que veio com o site. O que você ajustou aqui se perde.", confirmar: "Voltar ao padrão", perigo: true }))) return;
    const r = await executar(() => restaurarRotaPadrao(), new FormData());
    if (r.ok) { window.location.reload(); }
  }

  const coordCampo = (rotulo: string, valor: number, set: (n: number) => void) => (
    <Rotulo rotulo={rotulo}>
      <input type="number" step="0.000001" className={cn(campo, "tabular-nums")} value={valor}
        onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) set(n); }} />
    </Rotulo>
  );

  return (
    <div className="space-y-5">
      {dialogo}
      {!c.conferido && (
        <Aviso tom="aviso" titulo="Confira os pontos no mapa">
          A pousada, o trapiche e os terminais vieram de um mapa público e podem estar alguns metros fora.
          Arraste cada um até o lugar certo e marque “Conferi os pontos” — só então este aviso some.
        </Aviso>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Cartao semPadding className="overflow-hidden lg:sticky lg:top-6">
          <div className="relative h-[420px] sm:h-[520px]">
            <MapaRota className="h-full w-full" estilos={c.estilos} estilo={c.estiloPadrao} marcadores={marcadores} trechos={[]} centro={centro} aoMover={aoMover} />
          </div>
          <p className="border-t border-linha/70 px-4 py-3 text-xs text-tinta-suave">
            Arraste 🏡 pousada, ⚓ trapiche e ⛴️ terminais. Para precisão, aproxime bem (roda do mouse ou dois dedos).
          </p>
        </Cartao>

        <div className="space-y-4">
          <Cartao>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-3 text-sm font-medium text-tinta">
                <input type="checkbox" className="h-5 w-5 accent-[var(--color-marca)]" checked={c.ativo}
                  onChange={(e) => mudar((x) => ({ ...x, ativo: e.target.checked }))} />
                Mostrar a rota em Como chegar
              </label>
              <Selo tom={c.ativo ? "sucesso" : "neutro"} ponto>{c.ativo ? "No ar" : "Desligada"}</Selo>
            </div>
            <label className="mt-3 flex items-center gap-3 text-sm text-tinta">
              <input type="checkbox" className="h-5 w-5 accent-[var(--color-marca)]" checked={c.conferido}
                onChange={(e) => mudar((x) => ({ ...x, conferido: e.target.checked }))} />
              Conferi os pontos no mapa
            </label>
          </Cartao>

          <Abas<Aba> atual={aba} aoTrocar={setAba} abas={[
            { id: "pontos", rotulo: "Pontos" },
            { id: "terminais", rotulo: "Terminais", contador: c.terminais.length },
            { id: "textos", rotulo: "Textos" },
            { id: "mapa", rotulo: "Visual e serviços" },
          ]} />

          {aba === "pontos" && (
            <Cartao titulo="Posição exata" descricao="Escolha o ponto e ajuste pelo mapa ou digitando latitude e longitude (copie do Google Maps: botão direito no lugar → primeiro item).">
              <div className="mb-4 flex flex-wrap gap-2">
                {([["pousada", `🏡 ${c.pousada.nome}`], ["trapiche", `⚓ ${c.trapiche.nome}`], ...c.terminais.map((t) => [`terminal:${t.id}`, `⛴️ ${t.nome}`])] as [Alvo, string][]).map(([id, nome]) => (
                  <button key={id} type="button" onClick={() => setAlvo(id)}
                    className={cn("rounded-full border px-3 py-1.5 text-xs font-medium", alvo === id ? "border-marca bg-marca-suave text-marca-escura" : "border-linha text-tinta-suave hover:text-tinta")}>
                    {nome}
                  </button>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Rotulo rotulo="Nome no mapa" className="sm:col-span-2">
                  <input className={campo} value={pontoAlvo.nome} maxLength={80} onChange={(e) => {
                    const nome = e.target.value;
                    if (alvo === "pousada") mudar((x) => ({ ...x, pousada: { ...x.pousada, nome } }));
                    else if (alvo === "trapiche") mudar((x) => ({ ...x, trapiche: { ...x.trapiche, nome } }));
                    else mudarTerminal(alvo.slice(9), { nome });
                  }} />
                </Rotulo>
                {coordCampo("Latitude", pontoAlvo.lat, (lat) => aoMover(alvo, lat, pontoAlvo.lng))}
                {coordCampo("Longitude", pontoAlvo.lng, (lng) => aoMover(alvo, pontoAlvo.lat, lng))}
              </div>
              <p className="mt-3 text-xs text-tinta-suave">
                A pousada é onde o hóspede “chega”; o trapiche é onde o barco desembarca, de onde sai o trecho a pé.
              </p>
            </Cartao>
          )}

          {aba === "terminais" && (
            <Cartao titulo="Terminais de barco" descricao="De onde o hóspede embarca. O principal é sugerido primeiro; a pessoa pode trocar no site.">
              <ul className="space-y-4">
                {c.terminais.map((t) => (
                  <li key={t.id} className="rounded-xl border border-linha/80 p-4">
                    <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
                      <Rotulo rotulo="Nome"><input className={campo} value={t.nome} maxLength={80} onChange={(e) => mudarTerminal(t.id, { nome: e.target.value })} /></Rotulo>
                      <Rotulo rotulo="Barco (min)"><input type="number" min={1} max={600} className={campo} value={t.barcoMin} onChange={(e) => mudarTerminal(t.id, { barcoMin: Number(e.target.value) || 1 })} /></Rotulo>
                      <Rotulo rotulo="Observação para o hóspede" className="sm:col-span-2">
                        <input className={campo} value={t.observacao ?? ""} maxLength={300} onChange={(e) => mudarTerminal(t.id, { observacao: e.target.value })} />
                      </Rotulo>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-2 text-sm">
                        <input type="radio" name="principal" checked={!!t.principal} className="accent-[var(--color-marca)]"
                          onChange={() => mudar((x) => ({ ...x, terminais: x.terminais.map((o) => ({ ...o, principal: o.id === t.id })) }))} />
                        Principal
                      </label>
                      <button type="button" className={botao("fantasma", "sm")} onClick={() => { setAlvo(`terminal:${t.id}`); setAba("pontos"); }}>Ajustar posição</button>
                      {c.terminais.length > 1 && (
                        <button type="button" className={botao("fantasma", "sm", "text-red-700")}
                          onClick={() => mudar((x) => ({ ...x, terminais: x.terminais.filter((o) => o.id !== t.id) }))}>Remover</button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              {c.terminais.length < 6 && (
                <button type="button" className={botao("secundario", "sm", "mt-4")} onClick={() => mudar((x) => {
                  const id = idNovo("novo terminal", x.terminais.map((t) => t.id));
                  return { ...x, terminais: [...x.terminais, { id, nome: "Novo terminal", lat: x.trapiche.lat - 0.01, lng: x.trapiche.lng - 0.03, barcoMin: 45 }] };
                })}>+ Terminal</button>
              )}
            </Cartao>
          )}

          {aba === "textos" && (
            <Cartao titulo="Textos da seção" descricao="O que o hóspede lê. Escreva com acentos e por extenso.">
              <div className="space-y-3">
                {([
                  ["titulo", "Título", 1],
                  ["subtitulo", "Subtítulo", 2],
                  ["dicaSinal", "Dica sobre o sinal de celular", 2],
                  ["chegada", "Mensagem ao chegar", 2],
                ] as const).map(([k, rotulo, linhas]) => (
                  <Rotulo key={k} rotulo={rotulo}>
                    {linhas === 1
                      ? <input className={campo} value={c.textos[k]} maxLength={400} onChange={(e) => mudar((x) => ({ ...x, textos: { ...x.textos, [k]: e.target.value } }))} />
                      : <textarea rows={linhas + 1} className={campo} value={c.textos[k]} maxLength={400} onChange={(e) => mudar((x) => ({ ...x, textos: { ...x.textos, [k]: e.target.value } }))} />}
                  </Rotulo>
                ))}
              </div>
            </Cartao>
          )}

          {aba === "mapa" && (
            <Cartao titulo="Visual do mapa e serviços" descricao="Tudo gratuito e sem chave. Só troque os endereços se um serviço sair do ar (ver docs/fluxo-rota.md).">
              <Rotulo rotulo="Estilo que abre primeiro">
                <div className="flex flex-wrap gap-2">
                  {c.estilos.map((e) => (
                    <button key={e.id} type="button" onClick={() => mudar((x) => ({ ...x, estiloPadrao: e.id }))}
                      className={cn("rounded-full border px-3 py-1.5 text-xs font-medium", c.estiloPadrao === e.id ? "border-marca bg-marca-suave text-marca-escura" : "border-linha text-tinta-suave")}>
                      {e.nome}
                    </button>
                  ))}
                </div>
              </Rotulo>
              <details className="mt-4 rounded-xl border border-linha/80 p-3">
                <summary className="cursor-pointer text-sm font-medium text-tinta">Endereços (avançado)</summary>
                <div className="mt-3 space-y-3">
                  {c.estilos.map((e) => (
                    <Rotulo key={e.id} rotulo={`Estilo “${e.nome}”`}>
                      <input className={cn(campo, "font-mono text-xs")} value={e.url}
                        onChange={(ev) => mudar((x) => ({ ...x, estilos: x.estilos.map((o) => (o.id === e.id ? { ...o, url: ev.target.value.trim() } : o)) }))} />
                    </Rotulo>
                  ))}
                  {([["rotaCarro", "Rotas de carro (OSRM)"], ["rotaPe", "Rotas a pé (OSRM)"], ["busca", "Busca de endereço (Photon)"]] as const).map(([k, rotulo]) => (
                    <Rotulo key={k} rotulo={rotulo}>
                      <input className={cn(campo, "font-mono text-xs")} value={c.servicos[k]}
                        onChange={(ev) => mudar((x) => ({ ...x, servicos: { ...x.servicos, [k]: ev.target.value.trim() } }))} />
                    </Rotulo>
                  ))}
                </div>
              </details>
            </Cartao>
          )}
        </div>
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-linha bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
        <span className="text-sm text-tinta-suave">{mudou ? "Há mudanças não salvas." : "Tudo salvo."}</span>
        <div className="flex gap-2">
          <button type="button" className={botao("fantasma", "md")} onClick={restaurar} disabled={pendente}>Voltar ao padrão</button>
          <button type="button" className={botao("primario", "md")} onClick={salvar} disabled={pendente || !mudou}>{pendente ? "Salvando…" : "Salvar rota"}</button>
        </div>
      </div>
    </div>
  );
}
