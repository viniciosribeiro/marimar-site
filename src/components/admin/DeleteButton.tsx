"use client";

import { useState } from "react";

export function DeleteButton({
  action,
  id,
  label = "Excluir",
}: {
  action: (formData: FormData) => void;
  id: string;
  label?: string;
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
      <button type="submit" className="text-red-700 font-bold text-xs mr-1">Confirmar</button>
      <button onClick={() => setAsked(false)} className="text-gray-400 text-xs">Cancelar</button>
    </form>
  );
}