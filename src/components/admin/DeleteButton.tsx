"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { Trash2 } from "lucide-react";
import { botao } from "./ui";
import { useConfirmar } from "./ui-cliente";

/**
 * Excluir com confirmação num diálogo de verdade.
 * Mesma API de antes; a confirmação diz o que vai acontecer.
 */
export function DeleteButton({
  action,
  id,
  label = "Excluir",
  extras,
  texto = "Esta ação não pode ser desfeita.",
}: {
  action: (formData: FormData) => void;
  id: string;
  label?: string;
  /** Campos ocultos a mais (ex.: para a tela voltar à mesma aba). */
  extras?: Record<string, string>;
  texto?: string;
}) {
  const form = useRef<HTMLFormElement>(null);
  const { confirmar, dialogo } = useConfirmar();
  return (
    <form ref={form} action={action} className="inline">
      <input type="hidden" name="id" value={id} />
      {extras && Object.entries(extras).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <Gatilho label={label} aoClicar={async () => {
        if (await confirmar({ titulo: `${label}?`, texto, confirmar: label, perigo: true })) form.current?.requestSubmit();
      }} />
      {dialogo}
    </form>
  );
}

function Gatilho({ label, aoClicar }: { label: string; aoClicar: () => void }) {
  const { pending } = useFormStatus();
  return (
    <button type="button" onClick={aoClicar} disabled={pending}
      className={botao("fantasma", "sm", "text-red-700 hover:bg-red-50 hover:text-red-800")}>
      <Trash2 className="h-3.5 w-3.5" /> {pending ? "Excluindo…" : label}
    </button>
  );
}
