"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CrudForm } from "./CrudForm";
import { DeleteButton } from "./DeleteButton";
import { Modal } from "./Modal";

export function CrudPage({ title, subtitle, lista, columns, fields, criarAction, editarAction, excluirAction, editId, novo, erro, ok, basePath }: any) {
  const router = useRouter();
  const isEdit = !!editId;
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (editId || novo) setModalOpen(true);
  }, [editId, novo]);

  const closeModal = () => {
    setModalOpen(false);
    router.push(basePath);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>
        {criarAction && (
          <Link href={`${basePath}?novo=1`}
            className="inline-flex items-center gap-2 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
            style={{ backgroundColor: "var(--color-primary, #0D9488)" }}>
            + Novo
          </Link>
        )}
      </div>

      {erro && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-xl mb-4">{erro}</p>}
      {ok && <p className="text-sm text-green-600 bg-green-50 p-3 rounded-xl mb-4">{ok}</p>}

      <Modal open={modalOpen} onClose={closeModal} title={isEdit ? "Editar" : "Novo"}>
        <CrudForm
          action={isEdit ? editarAction : criarAction}
          fields={isEdit ? fields : fields.filter((f: any) => f.name !== "id" && f.name !== "ativo")}
          submitLabel={isEdit ? "Salvar" : "Criar"}
        />
        {isEdit && (
          <div className="mt-4 pt-4 border-t">
            <button onClick={closeModal} className="text-sm text-gray-500 hover:underline">Cancelar e voltar</button>
          </div>
        )}
      </Modal>

      {/* overflow-x-auto: no celular a tabela rola em vez de espremer as
          colunas a ponto de virar uma coluna de letras. min-w garante que
          ela nao encolha a ponto de quebrar cada palavra. */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm min-w-[36rem]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              {columns.map((c: string) => (
                <th key={c} className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">{c}</th>
              ))}
              <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Ações</th>
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 ? (
              <tr><td colSpan={columns.length + 1} className="text-center text-gray-400 py-12">Nenhum registro encontrado</td></tr>
            ) : (
              lista.map((item: any) => (
                <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  {columns.map((c: string) => (
                    <td key={c} className="px-4 py-3">{renderCell(c, item)}</td>
                  ))}
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {editarAction && (
                        <Link href={`${basePath}?editar=${item.id}`}
                          className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
                          Editar
                        </Link>
                      )}
                      {excluirAction && <DeleteButton action={excluirAction} id={item.id} />}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400 mt-3">{lista.length} registros</p>
    </div>
  );
}

function renderCell(col: string, item: any) {
  const v = item[col];
  if (col === "ativo" || col === "lido" || col === "destaque" || col === "visivel_agente" || col === "pet") {
    return v ? <span className="text-green-500">✅</span> : <span className="text-gray-300">—</span>;
  }
  if (col === "preco_referencia") return v ? <span className="text-teal-600 font-medium">R$ {v}</span> : "—";
  if (col === "nota") return <span className="text-amber-400">{"★".repeat(v||0)}{"☆".repeat(5-(v||0))}</span>;
  if (col === "url") return v ? <span className="text-xs text-teal-600">🔗</span> : "—";
  if (col === "duracao") return <span className="text-gray-500">{v || "—"}</span>;
  if (typeof v === "string" && v.length > 60) return <span className="text-xs text-gray-500">{v.slice(0, 60)}...</span>;
  return <span className="text-gray-700">{v ?? "—"}</span>;
}