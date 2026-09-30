"use client";

import { useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Abas } from "@/components/admin/ui-cliente";
import type { DadosMarina, Rascunho } from "./tipos";
import { FormItem } from "./FormItem";
import { HistoricoItem } from "./HistoricoItem";
import { AbaVisao } from "./AbaVisao";
import { AbaConhecimento } from "./AbaConhecimento";
import { AbaTeste } from "./AbaTeste";
import { AbaLacunas } from "./AbaLacunas";
import { AbaConversas } from "./AbaConversas";
import { AbaDocumentos } from "./AbaDocumentos";
import { AbaPersonalidade } from "./AbaPersonalidade";
import { AbaVoz } from "./AbaVoz";
import { AbaHistorico } from "./AbaHistorico";
import { AbaRegras } from "./AbaRegras";
import { AbaRoteiros } from "./AbaRoteiros";

export type AbaId =
  | "visao" | "conhecimento" | "testar" | "sem-resposta" | "conversas"
  | "documentos" | "roteiros" | "regras" | "personalidade" | "voz" | "historico";

/**
 * O módulo da Marina, organizado pelo que a Cecília quer FAZER:
 * ver como está (Visão geral) → ensinar (Conhecimento, Documentos,
 * Personalidade) → conferir (Testar) → aprender com o uso (Sem resposta,
 * Conversas) → desfazer (Histórico). A voz fica no fim: mexe-se pouco.
 */
export function PainelMarina({ dados, abaInicial }: { dados: DadosMarina; abaInicial: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [aba, setAba] = useState<AbaId>(abaInicial as AbaId);
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [historicoDe, setHistoricoDe] = useState<string | null>(null);

  const trocar = useCallback((id: AbaId) => {
    setAba(id);
    router.replace(`${pathname}?aba=${id}`, { scroll: false });
  }, [router, pathname]);

  const vivos = dados.itens.filter((i) => !i.excluido_em);
  const s = dados.saude;

  const abas: { id: AbaId; rotulo: string; contador?: number; alerta?: boolean }[] = [
    { id: "visao", rotulo: "Visão geral" },
    { id: "conhecimento", rotulo: "Conhecimento", contador: vivos.length },
    { id: "testar", rotulo: "Testar" },
    { id: "sem-resposta", rotulo: "Sem resposta", contador: s.lacunas, alerta: s.lacunas > 0 },
    { id: "conversas", rotulo: "Conversas", contador: dados.conversas.length },
    { id: "documentos", rotulo: "Documentos", contador: dados.documentos.length, alerta: s.docsFalhos > 0 },
    { id: "roteiros", rotulo: "Mídias de orientação", contador: dados.roteiros.filter((r) => r.ativo).length },
    { id: "regras", rotulo: "Crianças e adicionais" },
    { id: "personalidade", rotulo: "Personalidade e regras" },
    { id: "voz", rotulo: "Voz" },
    { id: "historico", rotulo: "Histórico" },
  ];

  const ensinar = (r: Rascunho = {}) => setRascunho(r);

  return (
    <div className="space-y-6">
      <Abas abas={abas} atual={aba} aoTrocar={trocar} />

      {aba === "visao" && <AbaVisao dados={dados} irPara={trocar} ensinar={ensinar} />}
      {aba === "conhecimento" && (
        <AbaConhecimento dados={dados} ensinar={ensinar} verHistorico={setHistoricoDe} />
      )}
      {aba === "testar" && <AbaTeste dados={dados} ensinar={ensinar} />}
      {aba === "sem-resposta" && <AbaLacunas lacunas={dados.lacunas} ensinar={ensinar} />}
      {aba === "conversas" && <AbaConversas conversas={dados.conversas} />}
      {aba === "documentos" && <AbaDocumentos documentos={dados.documentos} />}
      {aba === "roteiros" && <AbaRoteiros roteiros={dados.roteiros} midias={dados.midiasEscolha} blobOk={dados.blobOk} />}
      {aba === "regras" && <AbaRegras regras={dados.regras} adicionais={dados.adicionais} />}
      {aba === "personalidade" && (
        <AbaPersonalidade dados={dados} ensinar={ensinar} verHistorico={setHistoricoDe} />
      )}
      {aba === "voz" && <AbaVoz config={dados.config} vozApi={s.vozApi} />}
      {aba === "historico" && <AbaHistorico dados={dados} />}

      {rascunho && <FormItem rascunho={rascunho} aoFechar={() => setRascunho(null)} />}
      {historicoDe && (
        <HistoricoItem
          item={dados.itens.find((i) => i.id === historicoDe)}
          id={historicoDe}
          historico={dados.historico.filter((h) => h.conhecimento_id === historicoDe)}
          aoFechar={() => setHistoricoDe(null)}
        />
      )}
    </div>
  );
}
