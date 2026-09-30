"use client";

import { useState } from "react";
import { Cartao, campo, Rotulo } from "@/components/admin/ui";
import { BotaoEnviar, useAcao } from "@/components/admin/ui-cliente";
import { salvarPersonalidade } from "./actions";
import { AbaConhecimento } from "./AbaConhecimento";
import type { DadosMarina, Rascunho } from "./tipos";

const MODELO_TOM = `Fale como alguém da recepção: cordial, direta, sem formalidade de folheto e sem empolgação de vendedor.
Respostas curtas — quem está no celular decidindo uma viagem não lê parágrafo longo.
Trate por "você". Pode usar um emoji de vez em quando, nunca mais de um por mensagem.
Quando a pergunta depender de outra coisa (levar carro, chegar tarde, vir com criança), avise o detalhe que a pessoa ainda não sabe.`;

const MODELO_ESCALAR = `Passe para a recepção pelo WhatsApp quando:
- o hóspede reclamar de algo da estadia ou pedir reembolso;
- for grupo com mais de 10 pessoas, evento ou casamento;
- pedirem algo que não está no treinamento e for importante para decidir a reserva.
Ao passar, diga que a equipe responde rápido e mande o link do WhatsApp da pousada.`;

/**
 * Quem a Marina é: o jeito de falar, as regras do que ela não diz e quando
 * ela chama uma pessoa. Tudo o que vale para TODA conversa, e não para um
 * assunto só.
 */
export function AbaPersonalidade({ dados, ensinar, verHistorico }: {
  dados: DadosMarina; ensinar: (r?: Rascunho) => void; verHistorico: (id: string) => void;
}) {
  const [tom, setTom] = useState(dados.config.tom ?? "");
  const [escalar, setEscalar] = useState(dados.config.escalonamento ?? "");
  const { executar } = useAcao();

  return (
    <div className="space-y-8">
      <form action={async (fd) => { await executar(salvarPersonalidade, fd); }} className="grid gap-6 lg:grid-cols-2">
        <Cartao titulo="Jeito de falar" descricao="Como se estivesse orientando uma recepcionista nova. Vale nos dois canais.">
          <Rotulo rotulo="Como a Marina fala">
            <textarea name="tom" rows={9} value={tom} onChange={(e) => setTom(e.target.value)} className={campo + " leading-relaxed"}
              placeholder={MODELO_TOM} maxLength={4000} />
          </Rotulo>
          {!tom && (
            <button type="button" onClick={() => setTom(MODELO_TOM)} className="mt-2 min-h-9 text-xs font-medium text-marca hover:underline">
              Começar a partir de um modelo
            </button>
          )}
        </Cartao>
        <Cartao titulo="Quando passar para uma pessoa" descricao="O que faz a Marina parar e chamar a recepção — e como ela faz isso.">
          <Rotulo rotulo="Regra geral de escalonamento">
            <textarea name="escalonamento" rows={9} value={escalar} onChange={(e) => setEscalar(e.target.value)} className={campo + " leading-relaxed"}
              placeholder={MODELO_ESCALAR} maxLength={3000} />
          </Rotulo>
          {!escalar && (
            <button type="button" onClick={() => setEscalar(MODELO_ESCALAR)} className="mt-2 min-h-9 text-xs font-medium text-marca hover:underline">
              Começar a partir de um modelo
            </button>
          )}
        </Cartao>
        <div className="lg:col-span-2 flex justify-end">
          <BotaoEnviar>Salvar personalidade</BotaoEnviar>
        </div>
      </form>

      <AbaConhecimento dados={dados} ensinar={ensinar} verHistorico={verHistorico}
        tipos={["limite", "escalar"]} titulo="Regras específicas: o que ela nunca diz e casos de passar para uma pessoa" />
    </div>
  );
}
