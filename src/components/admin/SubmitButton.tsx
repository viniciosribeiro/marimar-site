"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  className = "bg-teal-600 text-white px-4 py-2 rounded text-sm hover:bg-teal-700 disabled:opacity-50",
  disabled = false,
}: {
  children: React.ReactNode;
  className?: string;
  /** Desabilitado por regra da tela (ex.: primeira foto não sobe mais). */
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || disabled} className={className}>
      {pending ? "Salvando..." : children}
    </button>
  );
}