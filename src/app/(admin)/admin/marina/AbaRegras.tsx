"use client";

import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Baby, Users } from "lucide-react";
import {
  calcularOcupacao, textoCriancas, textoRegrasMarina, precoAdicional,
  CATEGORIAS_ADICIONAL, COBRANCAS_ADICIONAL,
  type Regras, type Adicional, type CobrancaBebe,
} from "@/lib/regras-hospedagem-base";
import { Aviso, Cartao, Rotulo, Selo, Vazio, botao, campo, cn } from "@/components/admin/ui";
import { Gaveta, Girando, useAcao, useConfirmar } from "@/components/admin/ui-cliente";
import { salvarRegras, salvarAdicional, excluirAdicional } from "./actions";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Crianças, bebês e adicionais: regras que são DADOS, não texto.
 *
 * O que se configura aqui a busca do site usa para montar a consulta ao
 * motor, e a Marina recebe no treinamento — por isso o site e ela dão o
 * mesmo preço. A prévia embaixo mostra exatamente o que cada um vai dizer.
 */
export function AbaRegras({ regras, adicionais }: { regras: Regras; adicionais: Adicional[] }) {
  const [ligada, setLigada] = useState(regras.idadeColoMax !== null);
  const [idade, setIdade] = useState(regras.idadeColoMax ?? 2);
  const [comoAdulto, setComoAdulto] = useState(regras.criancaPagaComoAdulto);
  const [cobranca, setCobranca] = useState<CobrancaBebe>(regras.bebeCobranca);
  const [valor, setValor] = useState(regras.bebeValor ? String(regras.bebeValor).replace(".", ",") : "");
  const [obs, setObs] = useState(regras.observacao ?? "");
  const [editando, setEditando] = useState<Partial<Adicional> | null>(null);
  const { executar, pendente } = useAcao();

  /* A regra como ficaria se salva agora — alimenta a prévia. */
  const previa: Regras = useMemo(() => ({
    idadeColoMax: ligada ? idade : null,
    criancaPagaComoAdulto: comoAdulto,
    bebeCobranca: cobranca,
    bebeValor: cobranca === "gratis" ? null : Number(valor.replace(/\./g, "").replace(",", ".")) || null,
    observacao: obs || null,
  }), [ligada, idade, comoAdulto, cobranca, valor, obs]);
  const exemplo = calcularOcupacao({ adultos: 2, criancas: 2, bebes: 1, noites: 2 }, previa);

  return (
    <div className="space-y-6">
      <Aviso tom="info" titulo="Uma regra só, para o site e para a Marina.">
        O que você configura aqui muda o preço mostrado na busca do site e o que a Marina responde.
        O preço continua vindo do sistema de reservas — a regra decide como a consulta é feita
        (por exemplo, criança que não é de colo entra como adulto).
      </Aviso>

      <form action={async (fd) => { await executar(salvarRegras, fd); }} className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Cartao titulo="Crianças e bebês" descricao="Quem é de colo, quem paga como adulto e quanto paga o bebê.">
          <div className="space-y-5">
            <label className="flex items-center justify-between gap-4 rounded-xl border border-linha/80 bg-fundo-suave/50 px-4 py-3">
              <span>
                <span className="block text-sm font-medium text-tinta">Usar esta regra</span>
                <span className="block text-xs text-tinta-suave">Desligada, o site usa o cálculo de criança do sistema de reservas (e mostra o aviso dele).</span>
              </span>
              <Chave ligada={ligada} aoMudar={setLigada} rotulo="Usar esta regra" />
            </label>

            <fieldset disabled={!ligada} className={cn("space-y-5 transition-opacity", !ligada && "opacity-50")}>
              <input type="hidden" name="idade_colo_max" value={ligada ? idade : ""} />
              <Rotulo rotulo="Até que idade é considerada de colo?" ajuda="Inclusive. Ex.: 2 = bebês de 0, 1 e 2 anos são de colo.">
                <div className="flex items-center gap-3">
                  <input type="range" min={0} max={8} value={idade} onChange={(e) => setIdade(Number(e.target.value))}
                    className="flex-1 accent-[var(--marca)]" aria-label="Idade máxima de colo" />
                  <span className="w-24 shrink-0 rounded-lg bg-areia px-2 py-1 text-center text-sm font-semibold tabular-nums text-tinta">
                    até {idade} {idade === 1 ? "ano" : "anos"}
                  </span>
                </div>
              </Rotulo>

              <label className="flex items-center justify-between gap-4 rounded-xl border border-linha/80 px-4 py-3">
                <span>
                  <span className="block text-sm font-medium text-tinta">Criança a partir de {idade + 1} anos paga como adulto</span>
                  <span className="block text-xs text-tinta-suave">Sem desconto. Desligado, vale a tarifa de criança do sistema de reservas.</span>
                </span>
                <Chave ligada={comoAdulto} aoMudar={setComoAdulto} nome="crianca_paga_como_adulto" rotulo="Paga como adulto" />
              </label>

              <fieldset>
                <legend className="text-sm font-medium text-tinta">Bebê de colo</legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {([["gratis", "Não paga"], ["por_noite", "Paga por noite"], ["por_estadia", "Paga por estadia"]] as const).map(([v, r]) => (
                    <label key={v} className={cn("flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm",
                      cobranca === v ? "border-marca bg-marca-sutil text-tinta ring-2 ring-marca/20" : "border-linha bg-white text-tinta-suave")}>
                      <input type="radio" name="bebe_cobranca" value={v} checked={cobranca === v} onChange={() => setCobranca(v)} className="accent-[var(--marca)]" />
                      {r}
                    </label>
                  ))}
                </div>
                {cobranca !== "gratis" && (
                  <Rotulo rotulo={`Valor ${cobranca === "por_noite" ? "por noite" : "por estadia"}, por bebê`} className="mt-3">
                    <input name="bebe_valor" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Ex.: 35,00" className={campo + " max-w-40"} />
                  </Rotulo>
                )}
              </fieldset>

              <Rotulo rotulo="Observação (opcional)" ajuda="Vai junto da regra, no site e para a Marina. Ex.: berço sob pedido.">
                <textarea name="observacao" rows={2} value={obs} onChange={(e) => setObs(e.target.value)} className={campo} maxLength={600} />
              </Rotulo>
            </fieldset>

            <div className="flex justify-end border-t border-linha/60 pt-4">
              <button type="submit" disabled={pendente} className={botao()}>{pendente && <Girando />} Salvar regra</button>
            </div>
          </div>
        </Cartao>

        <Cartao titulo="Como vai ficar" descricao="Prévia com o que está na tela, antes de salvar.">
          {ligada ? (
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-tinta-suave">No site e na Marina</p>
                <p className="mt-1 leading-relaxed text-tinta">{textoCriancas(previa)}</p>
              </div>
              <div className="rounded-xl bg-fundo-suave p-3">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-tinta-suave"><Users className="h-3.5 w-3.5" /> Exemplo: 2 adultos, 2 crianças, 1 bebê, 2 noites</p>
                <p className="mt-1 text-tinta">Consulta ao sistema de reservas: <strong>{exemplo.adultosMotor} adultos</strong>{exemplo.criancasMotor ? ` e ${exemplo.criancasMotor} crianças` : ""}.</p>
                <p className="mt-1 text-tinta-suave">{exemplo.explicacao}</p>
                {exemplo.valorBebes ? <p className="mt-1 text-tinta-suave">Bebê: {brl(exemplo.valorBebes)} à parte.</p> : null}
              </div>
            </div>
          ) : (
            <Aviso tom="aviso" titulo="Sem regra configurada">
              O site mostra o valor de criança calculado pelo sistema de reservas e o aviso dele; a Marina diz para confirmar com a pousada.
            </Aviso>
          )}
        </Cartao>
      </form>

      <Cartao titulo="Adicionais" descricao="O que o hóspede pode pedir à parte: berço, cama extra, café no quarto, decoração, late checkout… Aparece na busca do site e a Marina oferece."
        acoes={<button onClick={() => setEditando({ ativo: true, visivelSite: true, visivelMarina: true, precisaPedir: true, cobranca: "por_estadia", categoria: "quarto" })} className={botao("primario", "sm")}><Plus className="h-4 w-4" /> Novo adicional</button>}>
        {adicionais.length === 0 ? (
          <Vazio icone={<Baby className="h-6 w-6 text-tinta-suave" />} titulo="Nenhum adicional ainda">
            Comece pelo que já é pedido na recepção: berço, cama extra, café da manhã no quarto.
          </Vazio>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {adicionais.map((a) => <ItemAdicional key={a.id} a={a} aoEditar={() => setEditando(a)} />)}
          </ul>
        )}
      </Cartao>

      <details className="rounded-2xl border border-linha/80 bg-white shadow-sm">
        <summary className="min-h-12 cursor-pointer px-5 py-3 text-sm font-semibold text-tinta">Ver o texto exato que a Marina recebe (depois de salvar)</summary>
        <pre className="whitespace-pre-wrap border-t border-linha/60 bg-fundo-suave p-4 text-xs leading-relaxed text-tinta">
          {textoRegrasMarina(regras, adicionais) || "Nada configurado ainda."}
        </pre>
      </details>

      {editando && <FormAdicional a={editando} aoFechar={() => setEditando(null)} />}
    </div>
  );
}

function ItemAdicional({ a, aoEditar }: { a: Adicional; aoEditar: () => void }) {
  const { executar } = useAcao();
  const { confirmar, dialogo } = useConfirmar();
  return (
    <li className={cn("flex flex-col rounded-2xl border border-linha/80 bg-white p-4", !a.ativo && "opacity-60")}>
      <div className="flex flex-wrap items-center gap-1.5">
        <Selo>{CATEGORIAS_ADICIONAL.find((c) => c.id === a.categoria)?.rotulo ?? "Outros"}</Selo>
        {!a.ativo && <Selo>Desligado</Selo>}
        {a.ativo && !a.visivelSite && <Selo tom="aviso">Fora do site</Selo>}
        {a.ativo && !a.visivelMarina && <Selo tom="aviso">Marina não oferece</Selo>}
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-3">
        <p className="font-semibold text-tinta">{a.nome}</p>
        <p className="shrink-0 text-sm font-semibold text-marca">{precoAdicional(a)}</p>
      </div>
      {a.descricao && <p className="mt-1 text-sm text-tinta-suave">{a.descricao}</p>}
      <div className="mt-auto flex justify-end gap-1 pt-3">
        <button onClick={aoEditar} className={botao("fantasma", "sm")}><Pencil className="h-3.5 w-3.5" /> Editar</button>
        <button className={botao("fantasma", "sm", "text-red-700 hover:bg-red-50")} onClick={async () => {
          if (await confirmar({ titulo: "Apagar este adicional?", texto: "Ele sai do site e a Marina deixa de oferecer.", confirmar: "Apagar", perigo: true })) {
            const f = new FormData(); f.set("id", a.id); executar(excluirAdicional, f);
          }
        }}><Trash2 className="h-3.5 w-3.5" /> Apagar</button>
      </div>
      {dialogo}
    </li>
  );
}

function FormAdicional({ a, aoFechar }: { a: Partial<Adicional>; aoFechar: () => void }) {
  const { executar, pendente } = useAcao();
  return (
    <Gaveta titulo={a.id ? "Editar adicional" : "Novo adicional"} descricao="Aparece na busca do site e a Marina oferece quando fizer sentido." aoFechar={aoFechar}
      rodape={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button onClick={aoFechar} className={botao("secundario")}>Cancelar</button>
          <button form="form-adicional" disabled={pendente} className={botao()}>{pendente && <Girando />} {a.id ? "Salvar" : "Criar"}</button>
        </div>
      }>
      <form id="form-adicional" className="space-y-5" onSubmit={async (e) => {
        e.preventDefault();
        const r = await executar(salvarAdicional, new FormData(e.currentTarget));
        if (r.ok) aoFechar();
      }}>
        {a.id && <input type="hidden" name="id" value={a.id} />}
        <Rotulo rotulo="Nome" obrigatorio>
          <input name="nome" required defaultValue={a.nome ?? ""} placeholder="Ex.: Berço" className={campo} maxLength={120} />
        </Rotulo>
        <Rotulo rotulo="Descrição (opcional)">
          <textarea name="descricao" rows={2} defaultValue={a.descricao ?? ""} placeholder="Ex.: Berço portátil com lençóis, montado no quarto antes da chegada." className={campo} />
        </Rotulo>
        <div className="grid gap-4 sm:grid-cols-2">
          <Rotulo rotulo="Preço (R$)" ajuda="Em branco = sob consulta.">
            <input name="preco" inputMode="decimal" defaultValue={a.preco != null ? String(a.preco).replace(".", ",") : ""} placeholder="Ex.: 40,00" className={campo} />
          </Rotulo>
          <Rotulo rotulo="Cobrança">
            <select name="cobranca" defaultValue={a.cobranca ?? "por_estadia"} className={campo}>
              {Object.entries(COBRANCAS_ADICIONAL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Rotulo>
          <Rotulo rotulo="Tipo" className="sm:col-span-2">
            <select name="categoria" defaultValue={a.categoria ?? "quarto"} className={campo}>
              {CATEGORIAS_ADICIONAL.map((c) => <option key={c.id} value={c.id}>{c.rotulo}</option>)}
            </select>
          </Rotulo>
        </div>
        {([
          ["precisa_pedir", "Precisa pedir com antecedência", a.precisaPedir],
          ["visivel_site", "Mostrar no site", a.visivelSite],
          ["visivel_marina", "A Marina oferece", a.visivelMarina],
          ["ativo", "Ligado", a.ativo],
        ] as const).map(([nome, rotulo, valor]) => (
          <label key={nome} className="flex min-h-12 items-center justify-between gap-4 rounded-xl border border-linha/80 bg-white px-4">
            <span className="text-sm text-tinta">{rotulo}</span>
            <input type="checkbox" name={nome} defaultChecked={valor !== false}
              className="relative h-6 w-11 shrink-0 cursor-pointer appearance-none rounded-full bg-gray-300 transition-colors checked:bg-marca before:absolute before:left-0.5 before:top-0.5 before:h-5 before:w-5 before:rounded-full before:bg-white before:shadow before:transition-transform checked:before:translate-x-5" />
          </label>
        ))}
      </form>
    </Gaveta>
  );
}

/** Liga/desliga controlado. Com `nome`, entra no formulário. */
function Chave({ ligada, aoMudar, nome, rotulo }: { ligada: boolean; aoMudar: (v: boolean) => void; nome?: string; rotulo: string }) {
  return (
    <input type="checkbox" name={nome} checked={ligada} onChange={(e) => aoMudar(e.target.checked)} aria-label={rotulo}
      className="relative h-6 w-11 shrink-0 cursor-pointer appearance-none rounded-full bg-gray-300 transition-colors checked:bg-marca before:absolute before:left-0.5 before:top-0.5 before:h-5 before:w-5 before:rounded-full before:bg-white before:shadow before:transition-transform checked:before:translate-x-5" />
  );
}
