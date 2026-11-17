---
name: melhorar
description: Melhorar um texto ou prompt (em PT-BR) sem inventar fatos nem mudar o sentido — mais claro, correto e no tom do projeto. Use quando pedirem "/melhorar", "melhora esse texto", "deixa esse prompt melhor" ou "revisa a redação deste trecho".
---

# Melhorar texto/prompt

Melhore o texto que a pessoa passar (ou o que estiver selecionado/colado),
mantendo a intenção. É o lado "de quem desenvolve" do botão "✨ Melhorar
texto" do painel (`/api/admin/marina/melhorar`): mesma ideia, aqui no editor.

## Regras

1. **Não invente.** Não acrescente fato, número, preço, horário, promessa ou
   funcionalidade que não esteja no texto original. Se faltar informação,
   melhore a forma e aponte a lacuna à parte — não preencha por conta própria.
2. **Não mude o sentido.** Preserve a intenção, o público e o tom. Preços,
   horários, nomes próprios e termos do projeto ficam idênticos.
3. **Idioma e tom do projeto.** Português do Brasil, claro e direto, sem
   jargão de folheto nem empolgação de vendedor (ver `AGENTS.md` e
   `docs/ESTADO-DO-PROJETO.md`). Texto que o hóspede lê vai acentuado e por
   extenso ("Diária", "2 noites").
4. **Se for um prompt** (instrução para a Marina/um agente): deixe as
   instruções inequívocas, na ordem certa, sem contradição, mantendo cada
   restrição que já existia. Não afrouxe limites de segurança.

## Como entregar

- Devolva **só o texto melhorado** quando for substituir um trecho.
- Quando a mudança for grande, mostre antes/depois em duas partes curtas e
  diga em uma linha o que mudou e por quê.
- Nunca grave nada: quem decide salvar é a pessoa.
