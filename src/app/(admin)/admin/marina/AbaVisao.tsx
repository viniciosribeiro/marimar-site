"use client";

import { Cartao, Indicador, Aviso, Selo, botao, quandoFoi, cn } from "@/components/admin/ui";
import { CATEGORIAS } from "@/lib/marina-base";
import type { DadosMarina, Rascunho } from "./tipos";
import type { AbaId } from "./PainelMarina";

const ORIGEM = {
  banco: { rotulo: "Você edita no painel", tom: "marca" as const },
  fixo: { rotulo: "Fixo no sistema", tom: "neutro" as const },
  motor: { rotulo: "Ao vivo, do sistema de reservas", tom: "info" as const },
};

/**
 * A saúde do treinamento numa tela: o que está bom, o que falta, e um botão
 * para cada coisa que falta. Nenhum número aqui é decorativo — cada um leva
 * para onde se resolve.
 */
export function AbaVisao({ dados, irPara, ensinar }: {
  dados: DadosMarina; irPara: (a: AbaId) => void; ensinar: (r?: Rascunho) => void;
}) {
  const s = dados.saude;
  const zap = dados.leituras.whatsapp;
  const site = dados.leituras.site;
  const ativos = dados.itens.filter((i) => i.ativo && !i.excluido_em);
  const testaveis = ativos.filter((i) => i.tipo === "fato" || i.tipo === "pergunta").length;

  /* Pendências em ordem de impacto no hóspede. */
  const pendencias: { tom: "erro" | "aviso" | "info"; titulo: string; texto: string; acao?: { rotulo: string; fazer: () => void } }[] = [];
  if (!s.gateway) pendencias.push({
    tom: "erro", titulo: "A Marina não está ligada a este site.",
    texto: "Faltam OPENCLAW_GATEWAY_URL e OPENCLAW_GATEWAY_TOKEN na Vercel. Sem isso, o chat do site e a área de teste não funcionam (o WhatsApp segue normal).",
  });
  if (s.diasSemWhatsapp === null) pendencias.push({
    tom: "aviso", titulo: "O WhatsApp ainda não leu o treinamento nenhuma vez.",
    texto: "A Marina do WhatsApp lê o treinamento pela rota /api/agent/conhecimento. Se ela nunca leu, a habilidade instalada no OpenClaw está desatualizada ou sem a chave MARIMAR_API_KEY. Veja agente/README.md.",
  });
  else if (s.diasSemWhatsapp >= 3) pendencias.push({
    tom: "aviso", titulo: `O WhatsApp não lê o treinamento há ${s.diasSemWhatsapp} dias.`,
    texto: "Pode ser só falta de conversa. Se houve conversas nesse período, a habilidade no OpenClaw precisa ser reinstalada (agente/README.md).",
  });
  if (s.lacunas) pendencias.push({
    tom: "aviso", titulo: `${s.lacunas} ${s.lacunas === 1 ? "pergunta ficou" : "perguntas ficaram"} sem resposta.`,
    texto: "São dúvidas reais de hóspedes que a Marina não soube responder. Ensinar a resposta é o que mais melhora o atendimento.",
    acao: { rotulo: "Ver perguntas", fazer: () => irPara("sem-resposta") },
  });
  if (s.revisar) pendencias.push({
    tom: "aviso", titulo: `${s.revisar} ${s.revisar === 1 ? "item falhou" : "itens falharam"} no teste.`,
    texto: "No último teste, a Marina não usou o item ao responder. Vale reescrever mais claro ou juntar com outro.",
    acao: { rotulo: "Revisar", fazer: () => irPara("conhecimento") },
  });
  if (s.docsFalhos) pendencias.push({
    tom: "aviso", titulo: `${s.docsFalhos} ${s.docsFalhos === 1 ? "documento não pôde" : "documentos não puderam"} ser lido${s.docsFalhos === 1 ? "" : "s"}.`,
    texto: "Tente de novo ou envie em outro formato (PDF com texto, Word ou foto nítida).",
    acao: { rotulo: "Ver documentos", fazer: () => irPara("documentos") },
  });
  if (s.semEscalonamento) pendencias.push({
    tom: "info", titulo: "Falta dizer quando ela deve chamar uma pessoa.",
    texto: "Reclamação, pedido especial, grupo grande: defina quando a Marina passa para a recepção.",
    acao: { rotulo: "Definir", fazer: () => irPara("personalidade") },
  });
  if (s.semTom) pendencias.push({
    tom: "info", titulo: "O jeito de falar ainda não foi definido.",
    texto: "Ela usa o tom padrão. Em poucas linhas você deixa a Marina com a cara da pousada.",
    acao: { rotulo: "Definir", fazer: () => irPara("personalidade") },
  });
  if (s.nuncaTestados && s.gateway) pendencias.push({
    tom: "info", titulo: `${s.nuncaTestados} ${s.nuncaTestados === 1 ? "item nunca foi testado" : "itens nunca foram testados"}.`,
    texto: "O teste faz a pergunta à Marina e confere se ela usou o item. Leva poucos segundos por item.",
    acao: { rotulo: "Testar agora", fazer: () => irPara("testar") },
  });

  return (
    <div className="space-y-6">
      {/* Números */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador rotulo="O que ela sabe" valor={s.ativos}
          detalhe={`${s.desligados} desligado${s.desligados === 1 ? "" : "s"} · ${s.lixeira} na lixeira`} />
        <Indicador rotulo="Conferidos no teste" valor={testaveis ? `${Math.round((s.verificados / testaveis) * 100)}%` : "—"}
          detalhe={`${s.verificados} de ${testaveis} ${testaveis === 1 ? "item testável" : "itens testáveis"}`} tom={s.revisar ? "aviso" : s.verificados === testaveis && testaveis ? "sucesso" : "neutro"} />
        <Indicador rotulo="Sem resposta" valor={s.lacunas} tom={s.lacunas ? "aviso" : "sucesso"}
          detalhe={s.lacunas ? "perguntas esperando treino" : "nenhuma pendente"} />
        <Indicador rotulo="Categorias vazias" valor={s.categoriasVazias.length} tom={s.categoriasVazias.length > 3 ? "aviso" : "neutro"}
          detalhe={s.categoriasVazias.length ? s.categoriasVazias.slice(0, 3).join(", ") + (s.categoriasVazias.length > 3 ? "…" : "") : "todas com conteúdo"} />
      </div>

      {/* Canais */}
      <div className="grid gap-3 md:grid-cols-2">
        {[
          { nome: "WhatsApp", l: zap, ajuda: "Lê a cada conversa, pela rota do agente." },
          { nome: "Chat do site", l: site, ajuda: "Monta o treinamento a cada mensagem." },
        ].map(({ nome, l, ajuda }) => (
          <div key={nome} className="flex min-w-0 items-center gap-4 rounded-2xl border border-linha/80 bg-white p-4 shadow-sm">
            <span className={cn("h-3 w-3 shrink-0 rounded-full", l ? "bg-emerald-500 shadow-[0_0_0_4px] shadow-emerald-100" : "bg-gray-300")} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-tinta">{nome}</p>
              <p className="text-xs text-tinta-suave">{ajuda}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xs font-medium text-tinta">{l ? `leu ${quandoFoi(l.lido_em)}` : "ainda não leu"}</p>
              {l && <p className="text-[11px] text-tinta-suave">{l.itens} {l.itens === 1 ? "item" : "itens"} · {l.caracteres.toLocaleString("pt-BR")} caracteres</p>}
            </div>
          </div>
        ))}
      </div>

      {/* Pendências */}
      <Cartao titulo="O que fazer agora" descricao="Em ordem do que mais ajuda o hóspede.">
        {pendencias.length === 0 ? (
          <Aviso tom="sucesso" titulo="Tudo em ordem.">A Marina está lendo o treinamento nos dois canais e não há pendências.</Aviso>
        ) : (
          <ul className="space-y-3">
            {pendencias.map((p) => (
              <li key={p.titulo}>
                <Aviso tom={p.tom} titulo={p.titulo}
                  acao={p.acao && <button onClick={p.acao.fazer} className={botao("secundario", "sm")}>{p.acao.rotulo}</button>}>
                  {p.texto}
                </Aviso>
              </li>
            ))}
          </ul>
        )}
      </Cartao>

      {/* Por categoria */}
      <Cartao titulo="Por assunto" descricao="Quanto ela sabe de cada assunto. Clique para ensinar algo novo naquele assunto.">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {CATEGORIAS.map((c) => {
            const n = ativos.filter((i) => i.categoria === c.id).length;
            return (
              <button key={c.id} onClick={() => ensinar({ categoria: c.id })}
                className={cn(
                  "group rounded-2xl border p-3 text-left transition-colors min-h-16",
                  n ? "border-linha bg-white hover:border-marca" : "border-dashed border-amber-300 bg-amber-50/60 hover:bg-amber-50",
                )}>
                <span className="block text-xs font-medium text-tinta-suave">{c.rotulo}</span>
                <span className="mt-0.5 flex items-baseline justify-between">
                  <span className="text-xl font-bold tabular-nums text-tinta">{n}</span>
                  <span className="text-[11px] font-semibold text-marca opacity-0 transition-opacity group-hover:opacity-100">+ ensinar</span>
                </span>
              </button>
            );
          })}
        </div>
      </Cartao>

      {/* Fontes */}
      <Cartao titulo="De onde vêm as respostas dela"
        descricao="Além do que você ensina aqui, a Marina consulta estas fontes. Onde estiver vazio, ela diz que vai confirmar com a pousada em vez de inventar.">
        <ul className="divide-y divide-linha/60">
          {dados.cobertura.map((c) => {
            const vazio = c.quantos === 0;
            return (
              <li key={c.chave} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-tinta">{c.titulo}</p>
                  <p className="text-xs text-tinta-suave truncate">Responde: {c.responde.join(" · ")}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:flex-nowrap">
                  <Selo tom={ORIGEM[c.origem].tom}>{ORIGEM[c.origem].rotulo}</Selo>
                  <Selo tom={c.quantos === -1 ? "erro" : vazio ? "aviso" : "sucesso"} ponto>
                    {c.quantos === -1 ? "falta migration" : c.quantos === null || c.quantos === undefined ? "pronto" : `${c.quantos} ${c.quantos === 1 ? "cadastro" : "cadastros"}`}
                  </Selo>
                  {c.editarEm && <a href={c.editarEm} className={botao(vazio ? "suave" : "fantasma", "sm")}>{vazio ? "Cadastrar" : "Editar"}</a>}
                </div>
              </li>
            );
          })}
        </ul>
      </Cartao>
    </div>
  );
}
