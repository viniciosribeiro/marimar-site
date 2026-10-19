# Estudo: o painel como uma central ("Central Marimar")

> 19/10/2026 · **aprovado pelo Vinicios** ("tudo aprovado, pode agir"), com
> o visual **Liquid Glass**. **Fase 1 implementada** em 19/10/2026. Página com o estudo e o protótipo clicável:
> https://claude.ai/artifact/JGRHkhDLrjmgo65HT88opg (privada, do Vinicios).

## Decisões já tomadas pelo Vinicios
- Quem usa: **Cecília (gestão)** e **Vinicios (técnico)**.
- Celular e computador com o mesmo peso.
- Liberdade para **reimaginar tudo do zero**.
- Entrega: estudo + protótipo para aprovar antes de programar, depois em fases.

## Diagnóstico (do código)
- 27 telas em 7 grupos (`src/app/(admin)/admin/layout.tsx`); a Marina sozinha tem 12 abas.
- A página inicial do site se edita em 3 telas: Banners, Blocos da Home, Cartões.
- "Precisa de atenção" espalhado: Equipe → Chamados, Marina → Sem resposta e
  Aprendizado, Contatos recebidos, Painel (a confirmar).
- Mesma informação em dois lugares: regra de crianças (Políticas e
  `regras_hospedagem`), fotos (biblioteca, suítes, cardápio), WhatsApp.
- Técnico misturado com gestão; usuários só por script.
- No celular, a gaveta tem os 27 itens.

## Proposta
Sete áreas: **Hoje** (caixa de entrada única + semáforo), **Atendimento**
(chamados, sem resposta, aprovar, contatos), **Marina** (o que sabe, jeito de
falar, quem responde, roteiros, testar, histórico), **Hospedagem** (suítes com
categoria e comodidades dentro, regras e políticas numa fonte só, pacotes),
**Restaurante**, **Site** (página inicial num editor com prévia, páginas,
fotos e vídeos, aparência) e **Ajustes** (pousada, pessoas e acessos, sistema
só no perfil Técnico). Busca "O que você quer fazer?" (Ctrl+K). Barra inferior
no celular: Hoje, Atendimento, Marina, Site, Mais.

## Fases
1. Casco novo + tela Hoje + busca + perfis (sem mudança no banco; URLs antigas redirecionam).
2. Atendimento unificado (sem mudança no banco).
3. Site: editor único da página inicial com prévia (sem mudança no banco).
4. Hospedagem: fonte única para regras (junta dados — perguntar antes).
5. Ajustes: pessoas, perfis, registro de atividades (tabela nova — perguntar antes).

## Fase 1 (feita em 19/10/2026)
- Casco novo: `src/components/admin/AdminNav.tsx` + `areas.ts`; busca
  `PaletaTarefas.tsx` (Ctrl+K); tela Hoje (`src/app/(admin)/admin/page.tsx`).
- Material de vidro: `admin.css` + `ui.tsx`/`ui-cliente.tsx`.
- Perfis: Técnico = papel `master`; Gestão = `editor` (não vê Pessoas,
  Integrações, Diagnóstico; no Hoje vê o semáforo sem o botão Diagnóstico).
- Mesmos endereços de antes; nenhuma mudança no banco.
- As 4 perguntas foram respondidas com "tudo aprovado": nomes das áreas como
  propostos, Restaurante como área própria, Cecília só com o semáforo.

## Próximas fases
2. Atendimento unificado (uma caixa de entrada que responde de dentro).
3. Site: página inicial num editor só com prévia.
4. Hospedagem: fonte única para regras (perguntar antes de juntar dados).
5. Ajustes: pessoas e perfis pelo painel (perguntar antes da tabela nova).

## Perguntas que estavam em aberto (respondidas)
1. Os nomes das sete áreas ("Recepção" no lugar de "Atendimento"?).
2. Restaurante como área própria ou dentro de Site.
3. A Cecília vê a parte técnica (nada / só o semáforo)?
4. Começar pela fase 1?
