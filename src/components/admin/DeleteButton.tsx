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
      <button onClick={() => setAsked(true)} className="text-red-500 hover:underline text-xs">
        {label}
      </button>
    );
  }

  return (
    <form action={action} className="inline">
      <input type="hidden" name="id" value={id} />
      {extras && Object.entries(extras).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <button type="submit" className="text-red-700 font-bold text-xs mr-1">Confirmar</button>
      <button onClick={() => setAsked(false)} className="text-gray-400 text-xs">Cancelar</button>
    </form>
  );
}