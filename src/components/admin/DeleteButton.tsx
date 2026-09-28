"use client";

import { useState } from "react";

export function DeleteButton({
  action,
  id,
  label = "Excluir",
  extras,
}: {
  action: (formData: FormData) => void;
  id: string;
  label?: string;
  /** Campos ocultos a mais (ex.: para a tela voltar à mesma aba). */
  extras?: Record<string, string>;
}) {
  const [asked, setAsked] = useState(false);

  if (!asked) {
    return (
      <button onClick={() => setAsked(true)} className="inline-flex items-center text-xs font-medium px-3 min-h-10 rounded-lg text-red-600 hover:bg-red-50">
        {label}
      </button>
    );
  }

  return (
    <form action={action} className="inline">
      <input type="hidden" name="id" value={id} />
      {extras && Object.entries(extras).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <button type="submit" className="inline-flex items-center text-xs font-bold px-3 min-h-10 rounded-lg bg-red-600 text-white hover:bg-red-700 mr-1">Confirmar</button>
      <button type="button" onClick={() => setAsked(false)} className="inline-flex items-center text-xs px-3 min-h-10 rounded-lg text-gray-500 hover:bg-gray-100">Cancelar</button>
    </form>
  );
}