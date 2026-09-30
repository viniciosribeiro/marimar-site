"use client";

import { useState } from "react";
import { Cartao, Selo, Vazio, quandoFoi, campo } from "@/components/admin/ui";
import { HistoricoItem, ACOES, resumoMudanca } from "./HistoricoItem";
import type { DadosMarina } from "./tipos";

/**
 * Tudo o que mudou no treinamento, de todos, mais recente primeiro.
 * Clicar numa linha abre o histórico daquele item, com "voltar para esta
 * versão" — inclusive de item já apagado de vez.
 */
export function AbaHistorico({ dados }: { dados: DadosMarina }) {
  const [aberto, setAberto] = useState<string | null>(null);
  const [acao, setAcao] = useState("todas");
  const titulos = new Map(dados.itens.map((i) => [i.id, i.titulo]));
  const lista = dados.historico.filter((h) => acao === "todas" || h.acao === acao);

  return (
    <Cartao titulo="Atividade do treinamento" descricao="Quem mudou o quê, e quando. Nada se perde: toda versão pode ser restaurada."
      acoes={
        <select value={acao} onChange={(e) => setAcao(e.target.value)} className={campo + " w-auto min-h-9 py-1.5 text-xs"} aria-label="Filtrar ação">
          <option value="todas">Todas as ações</option>
          {Object.entries(ACOES).map(([k, v]) => <option key={k} value={k}>{v.rotulo}</option>)}
        </select>
      }>
      {lista.length === 0 ? (
        <Vazio icone="🕓" titulo="Nada registrado ainda">As mudanças no treinamento aparecem aqui a partir de agora.</Vazio>
      ) : (
        <ul className="divide-y divide-linha/60">
          {lista.slice(0, 150).map((h) => {
            const a = ACOES[h.acao] ?? { rotulo: h.acao, tom: "neutro" as const };
            const titulo = titulos.get(h.conhecimento_id) ?? String(h.depois?.titulo ?? h.antes?.titulo ?? "Item apagado");
            return (
              <li key={h.id}>
                <button onClick={() => setAberto(h.conhecimento_id)} className="flex w-full flex-col gap-1 py-3 text-left hover:bg-areia/20 sm:flex-row sm:items-center sm:gap-3 min-h-12">
                  <Selo tom={a.tom} className="self-start sm:self-auto">{a.rotulo}</Selo>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-tinta">{titulo}</span>
                    <span className="block truncate text-xs text-tinta-suave">{resumoMudanca(h)[0] ?? ""}</span>
                  </span>
                  <span className="shrink-0 text-[11px] text-tinta-suave">{quandoFoi(h.criado_em)}{h.autor ? ` · ${h.autor}` : ""}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {aberto && (
        <HistoricoItem id={aberto} item={dados.itens.find((i) => i.id === aberto)}
          historico={dados.historico.filter((h) => h.conhecimento_id === aberto)} aoFechar={() => setAberto(null)} />
      )}
    </Cartao>
  );
}
