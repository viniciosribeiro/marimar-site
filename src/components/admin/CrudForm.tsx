"use client";

import { SubmitButton } from "./SubmitButton";

interface Field {
  name: string;
  label?: string;
  type?: string;
  defaultValue?: string | number;
  options?: { value: string; label: string }[];
  required?: boolean;
  className?: string;
}

export function CrudForm({
  action,
  fields,
  submitLabel = "Salvar",
  error,
  ok,
  extra,
}: {
  action: (formData: FormData) => void;
  fields: Field[];
  submitLabel?: string;
  error?: string;
  ok?: string;
  extra?: React.ReactNode;
}) {
  return (
    <div>
      {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded mb-2">{error}</p>}
      {ok && <p className="text-sm text-green-600 bg-green-50 p-2 rounded mb-2">{ok}</p>}
      <form action={action} className="bg-white rounded-lg shadow p-4 flex flex-wrap gap-3 items-end">
        {fields.map((f) => {
          if (f.type === "hidden") {
            return <input key={f.name} type="hidden" name={f.name} value={f.defaultValue} />;
          }
          if (f.type === "checkbox") {
            return (
              <div key={f.name} className="flex items-center gap-2">
                <input type="checkbox" name={f.name} defaultChecked={!!f.defaultValue} id={`f-${f.name}`} />
                <label htmlFor={`f-${f.name}`} className="text-xs">{f.label}</label>
              </div>
            );
          }
          if (f.type === "select" && f.options) {
            return (
              <div key={f.name} className={f.className || "flex-1 min-w-32"}>
                <label className="block text-xs font-medium mb-1">{f.label}</label>
                <select name={f.name} defaultValue={f.defaultValue} className="w-full border rounded p-2 text-sm">
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            );
          }
          return (
            <div key={f.name} className={f.className || "flex-1 min-w-32"}>
              <label className="block text-xs font-medium mb-1">{f.label}</label>
              <input
                type={f.type || "text"}
                name={f.name}
                defaultValue={f.defaultValue}
                required={f.required}
                className="w-full border rounded p-2 text-sm"
              />
            </div>
          );
        })}
        {extra}
        <SubmitButton>{submitLabel}</SubmitButton>
      </form>
    </div>
  );
}