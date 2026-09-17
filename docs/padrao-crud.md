# Padrão de Construção de CRUD — Marimar Admin

Toda página CRUD do painel segue esta estrutura. **Não desvie deste padrão.**

## Estrutura de arquivos

```
src/app/(admin)/admin/<entidade>/
├── actions.ts        ← Server actions separadas ("use server" no topo)
└── page.tsx          ← Server component (apenas dados, zero evento)
```

## O que vai em cada arquivo

### `actions.ts`

```ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import postgres from "postgres";

export async function criarXxx(formData: FormData) {
  // 1. Lê campos do formData
  // 2. Valida (erro → redirect com ?erro=Mensagem)
  // 3. INSERT no banco
  // 4. revalidatePath + redirect com ?ok=Mensagem
}

export async function editarXxx(formData: FormData) { /* UPDATE */ }
export async function excluirXxx(formData: FormData) { /* DELETE */ }
```

### `page.tsx`

```ts
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CrudForm } from "@/components/admin/CrudForm";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { SubmitButton } from "@/components/admin/SubmitButton";

export const dynamic = "force-dynamic";

export default async function XxxPage({ searchParams }) {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");

  // 1. Lê searchParams (erro, ok, editar)
  // 2. Busca dados do banco
  // 3. Renderiza:
  //    - CrudForm (client component que renderiza o <form>)
  //    - Tabela com DeleteButton e SubmitButton (client components)
  // NUNCA: onClick, onSubmit, useState, useEffect no page.tsx
}
```

## Componentes client reutilizáveis (`src/components/admin/`)

| Componente | Props | Uso |
|---|---|---|
| `CrudForm` | `action`, `fields[]`, `submitLabel`, `error`, `ok`, `extra` | Renderiza o form inteiro com mensagens |
| `SubmitButton` | `children`, `className?` | Botão submit com estado `pending` automático |
| `DeleteButton` | `action`, `id`, `label?` | Botão excluir com confirmação em 2 cliques |
| `IconPicker` | `name`, `defaultValue?` | Select com ícones lucide pré-definidos |

### Exemplo de `fields[]`

```ts
const fields = [
  { name: "nome", label: "Nome", required: true },
  { name: "ordem", label: "Ordem", type: "number", defaultValue: 0, className: "w-20" },
  { name: "categoria_id", label: "Categoria", type: "select", options: [{ value: "1", label: "A" }] },
  { name: "id", type: "hidden", defaultValue: editando.id },  // só em edição
  { name: "ativo", label: "Ativo", type: "checkbox", defaultValue: 1 },  // só em edição
];
```

## Erros a evitar

1. **NUNCA** coloque `onClick`, `onSubmit`, `useState`, `useEffect` em `page.tsx` — é server component
2. **SEMPRE** coloque `"use server"` no topo do `actions.ts` — não dentro de função
3. **SEMPRE** chame `revalidatePath` antes de `redirect` após mutação
4. **NUNCA** use `confirm()` inline no JSX — use `<DeleteButton>`
5. **NUNCA** use `<form onSubmit={...}>` em server component — use `action={serverAction}`
6. **SEMPRE** passe erros via `?erro=Mensagem+URL+encoded` no redirect
7. **NUNCA** crie server action no mesmo arquivo do componente
8. **SEMPRE** use `postgres(process.env.DATABASE_URL!, { max: 1 })` dentro da action — conexão por request