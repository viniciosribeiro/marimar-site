"use client";

import { useState } from "react";
import { CATEGORIAS, TIPOS, sugerirCategoria, type Tipo } from "@/lib/marina-base";
import { Gaveta, useAcao, Girando } from "@/components/admin/ui-cliente";
import { botao, campo, Rotulo, cn } from "@/components/admin/ui";
import { salvarItem } from "./actions";
import type { Rascunho } from "./tipos";

const EXEMPLOS: Record<Tipo, { titulo: string; conteudo: string }> = {
  fato: {
    titulo: "Ex.: Crianças",
    conteudo: "Ex.: Crianças que não são de colo pagam como adulto, sem desconto. Bebê de colo (até 2 anos) não paga.",
  },
  pergunta: {
    titulo: "Ex.: Posso fazer check-in mais cedo?",
    conteudo: "Ex.: O check-in é a partir das 14h. Se o quarto estiver pronto antes, liberamos sem custo — é só avisar o horário de chegada.",
  },
  limite: {
    titulo: "Ex.: Desconto",
    conteudo: "Ex.: Nunca prometa desconto nem condição especial. Diga que os valores são os do sistema e ofereça falar com a pousada.",
  },
  escalar: {
    titulo: "Ex.: Reclamação",
    conteudo: "Ex.: Se o hóspede estiver reclamando de algo da estadia, peça desculpas e passe o WhatsApp da recepção na hora.",
  },
};

/**
 * Ensinar ou editar um item.
 *
 * Um formulário para os quatro tipos: muda o rótulo dos campos, não a tela.
 * Para quem opera, "ensinar a Marina" é uma coisa só — o tipo é detalhe.
 */
export function FormItem({ rascunho, aoFechar }: { rascunho: Rascunho; aoFechar: () => void }) {
  const [tipo, setTipo] = useState<Tipo>((rascunho.tipo as Tipo) ?? "fato");
  const [titulo, setTitulo] = useState(rascunho.titulo ?? "");
  const [conteudo, setConteudo] = useState(rascunho.conteudo ?? "");
  const [categoria, setCategoria] = useState(rascunho.categoria ?? "");
  const [variacoes, setVariacoes] = useState((rascunho.variacoes ?? []).join("\n"));
  const [ativo, setAtivo] = useState(rascunho.ativo ?? true);
  const { executar, pendente } = useAcao();

  const editando = Boolean(rascunho.id);
  const sugerida = sugerirCategoria(`${titulo} ${conteudo}`);
  const cat = categoria || sugerida;
  const ehPergunta = tipo === "pergunta";

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("categoria", cat);
    fd.set("ativo", ativo ? "on" : "off");
    const r = await executar(salvarItem, fd);
    if (r.ok) aoFechar();
  }

  return (
    <Gaveta
      titulo={editando ? "Editar o que a Marina sabe" : "Ensinar a Marina"}
      descricao="Vale no chat do site na hora e no WhatsApp a partir da próxima conversa."
      aoFechar={aoFechar}
      rodape={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={aoFechar} className={botao("secundario")}>Cancelar</button>
          <button type="submit" form="form-item" disabled={pendente} className={botao("primario")}>
            {pendente && <Girando />}
            {pendente ? "Salvando…" : editando ? "Salvar alterações" : "Ensinar"}
          </button>
        </div>
      }
    >
      <form id="form-item" onSubmit={enviar} className="space-y-5">
        {rascunho.id && <input type="hidden" name="id" value={rascunho.id} />}
        {rascunho.lacuna_id && <input type="hidden" name="lacuna_id" value={rascunho.lacuna_id} />}
        <input type="hidden" name="tipo" value={tipo} />

        <fieldset>
          <legend className="text-sm font-medium text-tinta">O que você quer ensinar?</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(Object.keys(TIPOS) as Tipo[]).map((t) => (
              <button key={t} type="button" onClick={() => setTipo(t)} aria-pressed={tipo === t}
                className={cn(
                  "rounded-2xl border p-3 text-left transition-colors min-h-16",
                  tipo === t ? "border-marca bg-marca-sutil ring-2 ring-marca/20" : "border-linha bg-white hover:bg-areia/40",
                )}>
                <span className="block text-sm font-semibold text-tinta">{TIPOS[t].rotulo}</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-tinta-suave">{TIPOS[t].ajuda}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <Rotulo rotulo={ehPergunta ? "Pergunta do hóspede" : "Assunto"} obrigatorio
          ajuda={ehPergunta ? "Como um hóspede perguntaria." : "Poucas palavras, para você achar depois."}>
          <input name="titulo" required value={titulo} onChange={(e) => setTitulo(e.target.value)}
            placeholder={EXEMPLOS[tipo].titulo} className={campo} maxLength={300} />
        </Rotulo>

        {ehPergunta && (
          <Rotulo rotulo="Outras formas de perguntar" ajuda="Uma por linha. Ajuda a Marina a reconhecer a mesma dúvida escrita de outro jeito.">
            <textarea name="variacoes" rows={3} value={variacoes} onChange={(e) => setVariacoes(e.target.value)}
              placeholder={"Dá para chegar de manhã?\nQue horas posso entrar no quarto?"} className={campo} />
          </Rotulo>
        )}

        <Rotulo obrigatorio
          rotulo={ehPergunta ? "Resposta certa" : tipo === "limite" ? "O que ela nunca deve dizer (e o que fazer no lugar)" : tipo === "escalar" ? "Quando e como passar para a recepção" : "O que ela deve saber"}
          ajuda={ehPergunta ? "Ela responde com as palavras dela, mantendo o sentido." : undefined}>
          <textarea name="conteudo" required rows={5} value={conteudo} onChange={(e) => setConteudo(e.target.value)}
            placeholder={EXEMPLOS[tipo].conteudo} className={campo + " leading-relaxed"} maxLength={6000} />
          <span className="mt-1 block text-right text-[11px] text-tinta-suave tabular-nums">{conteudo.length} / 6000</span>
        </Rotulo>

        <fieldset>
          <legend className="text-sm font-medium text-tinta">Assunto</legend>
          {!categoria && <p className="text-xs text-tinta-suave mt-0.5">Sugestão pelo texto: {CATEGORIAS.find((c) => c.id === sugerida)?.rotulo}.</p>}
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {CATEGORIAS.map((c) => (
              <button key={c.id} type="button" onClick={() => setCategoria(c.id)} aria-pressed={cat === c.id}
                className={cn(
                  "min-h-9 rounded-full border px-3 text-xs font-medium transition-colors",
                  cat === c.id ? "border-marca bg-marca text-marca-texto" : "border-linha bg-white text-tinta-suave hover:bg-areia/50",
                )}>
                {c.rotulo}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="flex items-center justify-between gap-4 rounded-2xl border border-linha bg-white p-4">
          <span>
            <span className="block text-sm font-medium text-tinta">Ligado</span>
            <span className="block text-xs text-tinta-suave">Desligado, fica guardado aqui e a Marina não usa.</span>
          </span>
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)}
            className="h-6 w-11 cursor-pointer appearance-none rounded-full bg-gray-300 transition-colors checked:bg-marca relative
                       before:absolute before:left-0.5 before:top-0.5 before:h-5 before:w-5 before:rounded-full before:bg-white before:shadow before:transition-transform checked:before:translate-x-5" />
        </label>

        <p className="rounded-2xl bg-areia/50 px-4 py-3 text-xs leading-relaxed text-tinta-suave">
          <strong className="text-tinta">Preço e vaga não entram aqui</strong> — vêm sempre ao vivo do sistema de reservas.
          Mas regras de como contar (ex.: criança paga como adulto) entram, e a Marina segue ao consultar.
        </p>
      </form>
    </Gaveta>
  );
}
