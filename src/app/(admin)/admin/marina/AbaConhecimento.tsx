"use client";

import { useMemo, useState } from "react";
import { Search, Plus, History, FlaskConical, Pencil, Power, Trash2, RotateCcw, MoreHorizontal } from "lucide-react";
import { CATEGORIAS, TIPOS, rotuloCategoria, situacaoItem, type Tipo } from "@/lib/marina-base";
import type { ItemTreino } from "@/lib/marina";
import { botao, campo, Selo, Vazio, cn, quandoFoi } from "@/components/admin/ui";
import { useAcao, useConfirmar, avisar, Girando } from "@/components/admin/ui-cliente";
import { ligarItem, desligarItem, excluirItem, restaurarItem, apagarDeVez } from "./actions";
import type { DadosMarina, Rascunho } from "./tipos";
import { useRouter } from "next/navigation";

const TOM_SITUACAO = {
  "em-uso": "sucesso", aguardando: "info", falhou: "aviso", desligado: "neutro", lixeira: "neutro",
} as const;

const TOM_TIPO: Record<string, "marca" | "info" | "erro" | "aviso"> = {
  fato: "marca", pergunta: "info", limite: "erro", escalar: "aviso",
};

type Filtro = "todos" | "em-uso" | "aguardando" | "falhou" | "desligado" | "nunca-testado";

/**
 * Tudo o que a Marina sabe, com busca e filtros.
 *
 * O filtro de situação é o que responde "o que eu ensinei está valendo?":
 * em uso (o WhatsApp já leu), aguardando (salvo, o WhatsApp lê na próxima
 * conversa), revisar (falhou no teste), desligado.
 */
export function AbaConhecimento({ dados, ensinar, verHistorico, tipos, titulo, categoriaInicial }: {
  dados: DadosMarina; ensinar: (r?: Rascunho) => void; verHistorico: (id: string) => void;
  /** Restringe a lista (a aba Personalidade reutiliza para limites e escalonamento). */
  tipos?: Tipo[]; titulo?: string; categoriaInicial?: string;
}) {
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState<string>(categoriaInicial ?? "todas");
  const [tipo, setTipo] = useState<string>("todos");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [lixeira, setLixeira] = useState(false);
  const [testando, setTestando] = useState<string | null>(null);
  const [lote, setLote] = useState<{ feitos: number; total: number } | null>(null);
  const router = useRouter();

  const base = useMemo(
    () => dados.itens.filter((i) => (tipos ? tipos.includes(i.tipo as Tipo) : true)),
    [dados.itens, tipos],
  );
  const naLixeira = base.filter((i) => i.excluido_em);

  const lista = useMemo(() => {
    const q = busca.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
    return base.filter((i) => {
      if (lixeira ? !i.excluido_em : i.excluido_em) return false;
      if (categoria !== "todas" && i.categoria !== categoria) return false;
      if (tipo !== "todos" && i.tipo !== tipo) return false;
      if (!lixeira && filtro !== "todos") {
        if (filtro === "nunca-testado") { if (i.verificacao || !i.ativo) return false; }
        else if (situacaoItem(i, dados.leituras).id !== filtro) return false;
      }
      if (!q) return true;
      const alvo = [i.titulo, i.conteudo, ...i.variacoes].join(" ").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
      return q.split(/\s+/).every((p) => alvo.includes(p));
    });
  }, [base, busca, categoria, tipo, filtro, lixeira, dados.leituras]);

  async function testar(id: string) {
    setTestando(id);
    try {
      const r = await fetch("/api/admin/marina/teste", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ verificar: id }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) { avisar(d?.erro ?? "Não consegui testar agora.", "erro"); return false; }
      avisar(d.verificacao === "ok" ? "Passou: a Marina usou este item na resposta." : "A Marina não usou este item. Veja a resposta no item.", d.verificacao === "ok" ? "ok" : "erro");
      return true;
    } finally {
      setTestando(null);
      router.refresh();
    }
  }

  /** Testa um por um os itens da lista atual (fato e pergunta, ligados). */
  async function testarTodos() {
    const alvo = lista.filter((i) => i.ativo && (i.tipo === "fato" || i.tipo === "pergunta"));
    if (!alvo.length) return avisar("Nada para testar nesta lista.", "info");
    setLote({ feitos: 0, total: alvo.length });
    for (let n = 0; n < alvo.length; n++) {
      setTestando(alvo[n].id);
      const r = await fetch("/api/admin/marina/teste", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ verificar: alvo[n].id }),
      }).catch(() => null);
      if (!r || r.status === 503) { avisar("A Marina não está ligada a este site; o teste não roda.", "erro"); break; }
      setLote({ feitos: n + 1, total: alvo.length });
    }
    setTestando(null);
    setLote(null);
    router.refresh();
    avisar("Teste terminado. Veja o resultado em cada item.");
  }

  const tiposDaLista = (tipos ?? (Object.keys(TIPOS) as Tipo[]));

  return (
    <div className="space-y-4">
      {titulo && <h2 className="text-base font-semibold text-tinta">{titulo}</h2>}

      {/* Barra de ferramentas */}
      <div className="flex flex-col gap-3 rounded-2xl border border-linha/80 bg-white p-3 shadow-sm 2xl:flex-row 2xl:items-center">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Buscar</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-tinta-suave" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar no que ela sabe…"
            className={campo + " pl-10"} type="search" />
        </label>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap 2xl:shrink-0">
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={campo + " sm:w-auto"} aria-label="Assunto">
            <option value="todas">Todos os assuntos</option>
            {CATEGORIAS.map((c) => <option key={c.id} value={c.id}>{c.rotulo}</option>)}
          </select>
          {tiposDaLista.length > 1 && (
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={campo + " sm:w-auto"} aria-label="Tipo">
              <option value="todos">Todos os tipos</option>
              {tiposDaLista.map((t) => <option key={t} value={t}>{TIPOS[t].plural}</option>)}
            </select>
          )}
          {!lixeira && (
            <select value={filtro} onChange={(e) => setFiltro(e.target.value as Filtro)} className={campo + " col-span-2 sm:col-span-1 sm:w-auto"} aria-label="Situação">
              <option value="todos">Qualquer situação</option>
              <option value="em-uso">Em uso</option>
              <option value="aguardando">Aguardando WhatsApp</option>
              <option value="falhou">Revisar (falhou no teste)</option>
              <option value="nunca-testado">Nunca testado</option>
              <option value="desligado">Desligado</option>
            </select>
          )}
        </div>
        <div className="flex gap-2 sm:justify-end 2xl:shrink-0">
          {!lixeira && (
            <button onClick={testarTodos} disabled={!!lote || !dados.saude.gateway} className={botao("secundario", "md", "flex-1 sm:flex-none")}
              title={dados.saude.gateway ? "Testa cada item desta lista com a Marina" : "A Marina não está ligada a este site"}>
              {lote ? <><Girando /> {lote.feitos}/{lote.total}</> : <><FlaskConical className="h-4 w-4" /> Testar lista</>}
            </button>
          )}
          <button onClick={() => ensinar(tipos?.length === 1 ? { tipo: tipos[0] } : {})} className={botao("primario", "md", "flex-1 sm:flex-none")}>
            <Plus className="h-4 w-4" /> Ensinar
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-tinta-suave">
        <span>{lista.length} {lista.length === 1 ? "item" : "itens"}{lixeira ? " na lixeira" : ""}</span>
        <button onClick={() => setLixeira((l) => !l)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 font-medium hover:bg-areia/60 hover:text-tinta">
          {lixeira ? <>← Voltar para a lista</> : <><Trash2 className="h-3.5 w-3.5" /> Lixeira ({naLixeira.length})</>}
        </button>
      </div>

      {lista.length === 0 ? (
        lixeira ? <Vazio icone="🗑️" titulo="A lixeira está vazia" />
          : base.filter((i) => !i.excluido_em).length === 0
            ? <Vazio titulo="Ainda não há nada aqui" acao={<button onClick={() => ensinar(tipos?.length === 1 ? { tipo: tipos[0] } : {})} className={botao()}><Plus className="h-4 w-4" /> Ensinar a primeira coisa</button>}>
                Comece pelo que os hóspedes mais perguntam: horários, crianças, pets, como chegar.
              </Vazio>
            : <Vazio icone="🔎" titulo="Nada encontrado com esses filtros">Tente outra palavra ou limpe os filtros.</Vazio>
      ) : (
        <ul className="grid gap-3 xl:grid-cols-2">
          {lista.map((i) => (
            <CartaoItem key={i.id} item={i} dados={dados} testando={testando === i.id}
              aoEditar={() => ensinar({ id: i.id, tipo: i.tipo, categoria: i.categoria, titulo: i.titulo, conteudo: i.conteudo, variacoes: i.variacoes, ativo: i.ativo })}
              aoTestar={() => testar(i.id)} aoHistorico={() => verHistorico(i.id)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function CartaoItem({ item: i, dados, testando, aoEditar, aoTestar, aoHistorico }: {
  item: ItemTreino; dados: DadosMarina; testando: boolean;
  aoEditar: () => void; aoTestar: () => void; aoHistorico: () => void;
}) {
  const { executar, pendente } = useAcao();
  const { confirmar, dialogo } = useConfirmar();
  const [aberto, setAberto] = useState(false);
  const sit = situacaoItem(i, dados.leituras);
  const fd = () => { const f = new FormData(); f.set("id", i.id); return f; };
  const testavel = i.ativo && !i.excluido_em && (i.tipo === "fato" || i.tipo === "pergunta");

  return (
    <li className={cn(
      "flex flex-col rounded-2xl border bg-white p-4 shadow-sm transition-opacity",
      sit.id === "falhou" ? "border-amber-300" : "border-linha/80",
      (!i.ativo || i.excluido_em) && "opacity-70",
      pendente && "opacity-50",
    )}>
      <div className="flex flex-wrap items-center gap-1.5">
        <Selo tom={TOM_TIPO[i.tipo] ?? "neutro"}>{TIPOS[i.tipo as Tipo]?.rotulo ?? i.tipo}</Selo>
        <Selo>{rotuloCategoria(i.categoria)}</Selo>
        <span className="ml-auto"><Selo tom={TOM_SITUACAO[sit.id]} ponto title={sit.detalhe}>{sit.rotulo}</Selo></span>
      </div>

      <button onClick={() => setAberto((a) => !a)} className="mt-3 text-left" aria-expanded={aberto}>
        <p className="font-semibold text-tinta">{i.tipo === "pergunta" ? `“${i.titulo}”` : i.titulo}</p>
        <p className={cn("mt-1 text-sm text-tinta-suave whitespace-pre-wrap leading-relaxed", !aberto && "line-clamp-3")}>{i.conteudo}</p>
      </button>

      {i.variacoes.length > 0 && (
        <p className="mt-2 text-xs text-tinta-suave">
          Também reconhece: {i.variacoes.slice(0, aberto ? undefined : 2).map((v) => `“${v}”`).join(" · ")}
          {!aberto && i.variacoes.length > 2 && ` e mais ${i.variacoes.length - 2}`}
        </p>
      )}

      {i.verificacao && aberto && i.verificacao_resposta && (
        <div className={cn("mt-3 rounded-xl px-3 py-2 text-xs whitespace-pre-wrap leading-relaxed",
          i.verificacao === "ok" ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-950")}>
          <strong>Último teste ({quandoFoi(i.verificado_em)}):</strong>{"\n"}{i.verificacao_resposta}
        </div>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-1 border-t border-linha/60 pt-3 mt-4">
        <span className="mr-auto w-full pb-1 text-[11px] text-tinta-suave sm:w-auto sm:pb-0">
          {i.verificacao === "ok" ? `✓ testado ${quandoFoi(i.verificado_em)}` : `alterado ${quandoFoi(i.atualizado_em)}`}
          {i.atualizado_por ? ` · ${i.atualizado_por}` : ""}
        </span>
        {i.excluido_em ? (
          <>
            <button onClick={() => executar(restaurarItem, fd())} className={botao("secundario", "sm")}>
              <RotateCcw className="h-3.5 w-3.5" /> Restaurar
            </button>
            <button onClick={async () => {
              if (await confirmar({ titulo: "Apagar de vez?", texto: "O item some da lixeira. O histórico continua guardado e dá para recriar a partir dele.", confirmar: "Apagar de vez", perigo: true }))
                executar(apagarDeVez, fd());
            }} className={botao("fantasma", "sm", "text-red-700 hover:bg-red-50")}>Apagar de vez</button>
          </>
        ) : (
          <>
            {testavel && (
              <button onClick={aoTestar} disabled={testando || !dados.saude.gateway} className={botao("fantasma", "sm")} title="Pergunta à Marina e confere se ela usa este item">
                {testando ? <Girando className="h-3.5 w-3.5" /> : <FlaskConical className="h-3.5 w-3.5" />} Testar
              </button>
            )}
            <button onClick={aoEditar} className={botao("fantasma", "sm")}><Pencil className="h-3.5 w-3.5" /> Editar</button>
            <Mais>
              <button onClick={aoHistorico} className={itemMenu}><History className="h-4 w-4" /> Histórico</button>
              <button onClick={() => executar(i.ativo ? desligarItem : ligarItem, fd())} className={itemMenu}>
                <Power className="h-4 w-4" /> {i.ativo ? "Desligar" : "Ligar"}
              </button>
              <button onClick={async () => {
                if (await confirmar({ titulo: "Mandar para a lixeira?", texto: "A Marina para de usar este item. Dá para restaurar depois, pela Lixeira.", confirmar: "Mandar para a lixeira", perigo: true }))
                  executar(excluirItem, fd());
              }} className={cn(itemMenu, "text-red-700 hover:bg-red-50")}><Trash2 className="h-4 w-4" /> Excluir</button>
            </Mais>
          </>
        )}
      </div>
      {dialogo}
    </li>
  );
}

const itemMenu = "flex w-full min-h-10 items-center gap-2 rounded-lg px-3 text-left text-sm text-tinta hover:bg-areia/60";

function Mais({ children }: { children: React.ReactNode }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setAberto((a) => !a)} aria-label="Mais ações" aria-expanded={aberto} className={botao("fantasma", "sm", "px-2")}>
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {aberto && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setAberto(false)} />
          <div className="absolute bottom-full right-0 z-20 mb-1 w-48 rounded-xl border border-linha bg-white p-1 shadow-lg" onClick={() => setAberto(false)}>
            {children}
          </div>
        </>
      )}
    </div>
  );
}
