"use client";

import { BotaoEnviar } from "./ui-cliente";
import { campo, cn } from "./ui";

interface Field {
  name: string;
  label?: string;
  type?: string;
  defaultValue?: string | number;
  options?: { value: string; label: string }[];
  required?: boolean;
  className?: string;
  /** textarea: linhas visiveis. */
  rows?: number;
  /** Texto de apoio abaixo do campo. */
  ajuda?: string;
}

/**
 * Formulário padrão das telas de cadastro.
 *
 * Mesma API de antes (as telas não mudaram), visual do design system:
 * campos em grade, texto longo em linha inteira, liga/desliga no lugar da
 * caixinha, botão de salvar com "Salvando…". Os avisos de sucesso e erro
 * saem da URL (?ok= / ?erro=) como toast, pelo Toaster do casco — por isso
 * `error` e `ok` só aparecem aqui quando a tela passa texto que NÃO veio
 * da URL.
 */
export function CrudForm({
  action,
  fields,
  submitLabel = "Salvar",
  extra,
}: {
  action: (formData: FormData) => void;
  fields: Field[];
  submitLabel?: string;
  error?: string;
  ok?: string;
  extra?: React.ReactNode;
}) {
  const visiveis = fields.filter((f) => f.type !== "hidden");
  const ocultos = fields.filter((f) => f.type === "hidden");
  return (
    <form action={action} className="rounded-2xl border border-linha/80 bg-white p-5 shadow-sm">
      {ocultos.map((f) => <input key={f.name} type="hidden" name={f.name} value={f.defaultValue ?? ""} />)}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {visiveis.map((f) => {
          const id = `f-${f.name}`;
          const rotulo = f.label && (
            <span className="block text-sm font-medium text-tinta">
              {f.label}{f.required && <span className="text-red-600" aria-hidden> *</span>}
            </span>
          );
          const ajuda = f.ajuda && <span className="mt-1 block text-xs text-tinta-suave">{f.ajuda}</span>;

          if (f.type === "checkbox") {
            return (
              <label key={f.name} htmlFor={id}
                className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-linha/80 bg-fundo-suave/50 px-4 py-3 sm:col-span-2">
                <span className="text-sm text-tinta">{f.label}</span>
                <input type="checkbox" id={id} name={f.name} defaultChecked={!!f.defaultValue}
                  className="relative h-6 w-11 shrink-0 cursor-pointer appearance-none rounded-full bg-gray-300 transition-colors checked:bg-marca
                             before:absolute before:left-0.5 before:top-0.5 before:h-5 before:w-5 before:rounded-full before:bg-white before:shadow before:transition-transform checked:before:translate-x-5
                             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca focus-visible:ring-offset-2" />
              </label>
            );
          }
          if (f.type === "textarea") {
            return (
              <label key={f.name} htmlFor={id} className="block sm:col-span-2">
                {rotulo}
                <textarea id={id} name={f.name} defaultValue={f.defaultValue} required={f.required}
                  rows={f.rows ?? 4} className={cn(campo, "mt-1.5 leading-relaxed")} />
                {ajuda}
              </label>
            );
          }
          if (f.type === "select" && f.options) {
            return (
              <label key={f.name} htmlFor={id} className="block">
                {rotulo}
                <select id={id} name={f.name} defaultValue={f.defaultValue} className={cn(campo, "mt-1.5")}>
                  {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {ajuda}
              </label>
            );
          }
          const curto = f.type === "number" || f.type === "date" || f.type === "time";
          return (
            <label key={f.name} htmlFor={id} className={cn("block", !curto && (f.className?.includes("basis-full") || f.className?.includes("col-span-2")) && "sm:col-span-2")}>
              {rotulo}
              <input id={id} type={f.type || "text"} name={f.name} defaultValue={f.defaultValue}
                required={f.required} className={cn(campo, "mt-1.5")}
                {...(f.type === "number" ? { inputMode: "numeric" as const } : {})} />
              {ajuda}
            </label>
          );
        })}
      </div>
      {extra}
      <div className="mt-5 flex justify-end border-t border-linha/60 pt-4">
        <BotaoEnviar>{submitLabel}</BotaoEnviar>
      </div>
    </form>
  );
}
