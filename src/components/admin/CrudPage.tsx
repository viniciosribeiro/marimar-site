"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Pencil, Search } from "lucide-react";
import { CrudForm } from "./CrudForm";
import { DeleteButton } from "./DeleteButton";
import { Modal } from "./Modal";
import { Pagina, Cabecalho, Lista, Selo, Vazio, botao, campo, type Coluna } from "./ui";

/**
 * Tela padrão de cadastro (FAQ, pacotes, depoimentos, categorias…).
 *
 * Mesma API de antes — as telas não precisaram mudar — com o visual do
 * design system: tabela no computador, cartões no celular, busca quando a
 * lista cresce, janela de edição e exclusão com confirmação.
 */

/** Nome de coluna do banco → rótulo que quem opera entende. */
const ROTULOS: Record<string, string> = {
  nome: "Nome", slug: "Endereço", ordem: "Ordem", ativo: "Situação", ativa: "Situação",
  pergunta: "Pergunta", resposta: "Resposta", autor: "Autor", nota: "Nota", origem: "Plataforma",
  texto: "Texto", preco_referencia: "Preço de referência", duracao: "Duração", visivel_agente: "Marina usa",
  escopo: "Onde vale", icone: "Ícone", descricao: "Descrição", lido: "Lido", destaque: "Destaque",
  diaria_minima: "Mínimo de diárias", url: "Link", pet: "Aceita pet", email: "E-mail", telefone: "Telefone",
};

type Registro = Record<string, unknown> & { id: string };

export function CrudPage({
  title, subtitle, lista, columns, fields, criarAction, editarAction, excluirAction, editId, novo, basePath,
}: {
  title: string; subtitle?: string; lista: ReadonlyArray<object>; columns: string[];
  fields: { name: string; [k: string]: unknown }[];
  criarAction?: (fd: FormData) => void; editarAction?: (fd: FormData) => void; excluirAction?: (fd: FormData) => void;
  editId?: string; novo?: string; erro?: string; ok?: string; basePath: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const registros = lista as Registro[];
  const [busca, setBusca] = useState("");
  const isEdit = !!editId;
  /* O botão "+ Novo" leva a ?novo=1. Antes a janela só abria se a PÁGINA
     repassasse `novo` — e 6 das 7 telas não repassavam. Agora o próprio
     componente lê a URL. */
  const pedido = Boolean(editId || novo || params.get("novo") === "1");
  const chave = `${editId ?? ""}|${params.toString()}`;
  const [fechadoEm, setFechadoEm] = useState<string | null>(null);
  const modalOpen = pedido && fechadoEm !== chave;

  const closeModal = useCallback(() => {
    setFechadoEm(chave);
    router.push(basePath);
  }, [chave, router, basePath]);

  const filtrada = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return registros;
    return registros.filter((i) => columns.some((c) => String(i[c] ?? "").toLowerCase().includes(q)));
  }, [busca, registros, columns]);

  const colunas: Coluna<Registro>[] = columns.map((c) => ({
    titulo: ROTULOS[c] ?? c,
    celula: (item) => celula(c, item),
    soDesktop: c === "ordem" || c === "slug",
    className: c === "ordem" ? "w-20" : undefined,
  }));

  return (
    <Pagina larga>
      <Cabecalho
        titulo={title.replace(/^[^\p{L}]+/u, "")}
        descricao={subtitle}
        acoes={criarAction && (
          <Link href={`${basePath}?novo=1`} className={botao("primario")}>
            <Plus className="h-4 w-4" /> Novo
          </Link>
        )}
      />

      <Modal open={modalOpen} onClose={closeModal} title={isEdit ? "Editar" : "Novo cadastro"}>
        <CrudForm
          action={(isEdit ? editarAction : criarAction) as (fd: FormData) => void}
          fields={(isEdit ? fields : fields.filter((f) => f.name !== "id" && f.name !== "ativo")) as never}
          submitLabel={isEdit ? "Salvar alterações" : "Criar"}
        />
      </Modal>

      {lista.length > 6 && (
        <label className="relative mb-4 block max-w-sm">
          <span className="sr-only">Buscar</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-tinta-suave" />
          <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar…" className={campo + " pl-10"} />
        </label>
      )}

      <Lista
        itens={filtrada}
        colunas={colunas}
        chave={(i) => i.id}
        vazio={
          busca
            ? <Vazio icone="🔎" titulo="Nada encontrado">Tente outra palavra.</Vazio>
            : <Vazio titulo="Nada cadastrado ainda" acao={criarAction && <Link href={`${basePath}?novo=1`} className={botao()}><Plus className="h-4 w-4" /> Cadastrar o primeiro</Link>} />
        }
        acoes={(editarAction || excluirAction) ? (item) => (
          <>
            {editarAction && (
              <Link href={`${basePath}?editar=${item.id}`} className={botao("secundario", "sm")}>
                <Pencil className="h-3.5 w-3.5" /> Editar
              </Link>
            )}
            {excluirAction && <DeleteButton action={excluirAction} id={item.id} />}
          </>
        ) : undefined}
      />
      {lista.length > 0 && (
        <p className="mt-3 px-1 text-xs text-tinta-suave">
          {filtrada.length === lista.length ? `${lista.length} ${lista.length === 1 ? "cadastro" : "cadastros"}` : `${filtrada.length} de ${lista.length}`}
        </p>
      )}
    </Pagina>
  );
}

function celula(col: string, item: Registro): React.ReactNode {
  const v = item[col];
  if (["ativo", "ativa", "destaque", "visivel_agente", "pet"].includes(col)) {
    const rot = col === "visivel_agente" ? ["Usa", "Não usa"] : col === "pet" ? ["Sim", "Não"] : col === "destaque" ? ["Destaque", "—"] : ["Ativo", "Inativo"];
    return <Selo tom={v ? "sucesso" : "neutro"} ponto>{v ? rot[0] : rot[1]}</Selo>;
  }
  if (col === "lido") return <Selo tom={v ? "neutro" : "info"} ponto>{v ? "Lido" : "Novo"}</Selo>;
  if (col === "preco_referencia") {
    const n = Number(v);
    return v && Number.isFinite(n) ? <span className="font-medium tabular-nums">{n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span> : <span className="text-tinta-suave">—</span>;
  }
  if (col === "nota") {
    const n = Math.max(0, Math.min(5, Number(v) || 0));
    return <span className="text-amber-500" aria-label={`${n} de 5`}>{"★".repeat(n)}<span className="text-gray-300">{"★".repeat(5 - n)}</span></span>;
  }
  if (col === "escopo") return <Selo>{v === "pousada" ? "Da pousada" : "Das suítes"}</Selo>;
  if (col === "url") return v ? <a href={String(v)} target="_blank" rel="noreferrer" className="text-marca underline">abrir</a> : "—";
  if (col === "slug") return <span className="font-mono text-xs text-tinta-suave">/{String(v ?? "")}</span>;
  if (typeof v === "string" && v.length > 80) return <span className="text-tinta-suave">{v.slice(0, 80)}…</span>;
  if (v === null || v === undefined || v === "") return <span className="text-tinta-suave">—</span>;
  return String(v);
}
