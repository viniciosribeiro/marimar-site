"use client";

import { useFormStatus } from "react-dom";
import { botao } from "./ui";
import { Girando } from "./ui-cliente";

/** Botão de enviar com estado "Salvando…". Sem `className`, usa o botão primário do design system. */
export function SubmitButton({
  children,
  className,
  disabled = false,
}: {
  children: React.ReactNode;
  className?: string;
  /** Desabilitado por regra da tela (ex.: primeira foto não sobe mais). */
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || disabled} className={className ?? botao("primario")}>
      {pending && !className && <Girando />}
      {pending ? "Salvando…" : children}
    </button>
  );
}
