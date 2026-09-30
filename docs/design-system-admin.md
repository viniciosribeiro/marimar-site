# Design system do painel

> Criado em 30/09/2026. Vale para tudo em `/admin`. O site público tem os
> próprios componentes (`src/components/site/`), com os mesmos tokens.

## Princípios

1. **O painel veste a identidade da pousada.** Cor só por token do tema —
   `marca`, `acento`, `tinta`, `tinta-suave`, `areia`, `fundo-suave`, `linha`.
   Os valores vêm do banco (Identidade visual) e são injetados pelo layout
   raiz; trocar a cor lá troca o site e o painel. Nunca `bg-teal-600`,
   `bg-gray-900`, `#0D9488`.
   Exceção: cores de **estado** (verde = ok, âmbar = atenção, vermelho = erro,
   azul = informação), que não podem mudar com a marca.
2. **Feito para o celular da recepção.** Alvo de toque ≥ 40px (`min-h-10`),
   campos ≥ 44px nas telas de entrada, nada de rolagem horizontal em 375px.
3. **Português simples, com acento e plural certo.** "Salvar", "Mandar para a
   lixeira", "1 item / 2 itens". Nada de "Submeter", "Registro", "noite(s)".
4. **Toda ação destrutiva confirma** num diálogo que diz o que vai acontecer.
   Excluir, quando possível, vai para a lixeira.
5. **Todo retorno vira toast.** Nada de mensagem que fica na tela para sempre.

## Onde estão as peças

| Arquivo | O quê | Onde roda |
|---|---|---|
| `src/components/admin/ui.tsx` | `botao()`, `campo`, `Rotulo`, `Pagina`, `Cabecalho`, `Cartao`, `Selo`, `Aviso`, `Vazio`, `Esqueleto`, `Carregando`, `Indicador`, `Lista`, `quandoFoi()`, `cn()` | servidor e cliente (sem estado) |
| `src/components/admin/ui-cliente.tsx` | `Toaster` + `avisar()`, `useConfirmar()`, `BotaoConfirmar`, `Dialogo`, `Gaveta`, `JanelaRota`, `BotaoEnviar`, `Girando`, `useAcao()`, `Abas` | cliente |
| `src/components/admin/AdminNav.tsx` | casco: menu lateral recolhível, barra e gaveta no celular, Toaster | cliente |
| `src/components/admin/CrudPage.tsx` / `CrudForm.tsx` | tela de cadastro padrão (mesma API de antes) | cliente |
| `src/app/(admin)/admin/admin.css` | animações (`entrar`, `subir`, `deslizar`), respeita `prefers-reduced-motion` | — |
| `src/app/(admin)/admin/loading.tsx` / `error.tsx` | carregando e erro de toda tela | — |

## Receitas

**Tela nova de servidor:**
```tsx
<Pagina larga>
  <Cabecalho sobre="Grupo do menu" titulo="Título" descricao="Para que serve, em uma frase."
    acoes={<BotaoLink href="?novo=1"><Plus className="h-4 w-4" /> Novo</BotaoLink>} />
  <Lista itens={...} chave={(i) => i.id} colunas={[...]} acoes={(i) => ...}
    vazio={<Vazio titulo="Nada ainda" acao={...} />} />
</Pagina>
```
`Lista` vira tabela a partir de 768px e cartões abaixo disso. Marque
`soDesktop` nas colunas que o cartão pode omitir.

**Edição em janela a partir de tela de servidor:** `JanelaRota` abre por
`?novo=1` / `?editar=<id>` e fechar volta para a URL de `voltar`. O conteúdo
pode ser um `<form action={serverAction}>`.

**Ação sem redirect (tela cliente):** a Server Action devolve
`{ ok, mensagem }`; a tela chama `executar(acao, formData)` de `useAcao()`,
que mostra o toast e faz `router.refresh()` — sem perder filtro nem rolagem.
Padrão usado em todo o módulo Marina.

**Ação com redirect (padrão antigo):** continua valendo. `?ok=` e `?erro=`
na URL viram toast sozinhos (o `Toaster` lê e limpa a URL).

**Confirmação:**
```tsx
const { confirmar, dialogo } = useConfirmar();
if (await confirmar({ titulo: "Apagar?", texto: "O que acontece.", confirmar: "Apagar", perigo: true })) ...
return <>{...}{dialogo}</>;
```
Em formulário de servidor, `DeleteButton` já faz isso.

## Tipografia e espaço

- Títulos de página: `font-titulo` (a fonte de título escolhida no tema),
  `text-2xl sm:text-[1.75rem] font-bold tracking-tight text-tinta`.
- Texto de interface: Geist (legibilidade em tela pequena), 14px; apoio 12px
  em `text-tinta-suave`.
- Cartões `rounded-2xl`, botões e campos `rounded-xl`, selos `rounded-full`.
- Margens de página: 16px no celular, 24px no tablet, 40px no desktop.

## Verificar

```bash
# capturas em 375, 768 e 1440 e aviso de rolagem horizontal
BASE=http://localhost:3000 SAIDA=capturas node testes/capturas.mjs
```
