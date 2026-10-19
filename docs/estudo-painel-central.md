# Estudo: o painel como uma central ("Central Marimar")

> 19/10/2026 · proposta **aguardando aprovação do Vinicios**. Nada foi
> implementado ainda. Página com o estudo e o protótipo clicável:
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

## Perguntas em aberto
1. Os nomes das sete áreas ("Recepção" no lugar de "Atendimento"?).
2. Restaurante como área própria ou dentro de Site.
3. A Cecília vê a parte técnica (nada / só o semáforo)?
4. Começar pela fase 1?
