# Agente Marina — habilidades

A Marina atende no WhatsApp pelo OpenClaw (Hostinger) e, quando o chat do
site entrar no ar, tambem por ele. As habilidades que ela usa vivem aqui,
**versionadas junto com o sistema** — nao soltas no servidor.

O motivo e concreto: quando a politica de pets muda, ela muda no banco, e a
habilidade que ensina a Marina a consultar o banco nao precisa mudar. Mas
quando a REGRA do atendimento muda ("nunca prometa cancelamento gratis"),
isso e codigo, e codigo revisado e versionado.

## `marimar-pousada`

Ensina a Marina a consultar os fatos oficiais pelas rotas `/api/agent/*`:
politicas, quartos, FAQ e pacotes. Complementa a `consulta-desbravador`, que
ja cuida de datas, disponibilidade e tarifas.

### Instalar no OpenClaw

```
openclaw skills install https://github.com/viniciosribeiro/marimar-site --path agente/skills/marimar-pousada
```

(Se o `--path` nao existir nessa versao, rode `openclaw skills install --help`
para ver como apontar um subdiretorio do repositorio.)

### Depois de instalar, duas coisas OBRIGATORIAS

**1. A chave.** Em Ambiente, no painel da Hostinger, crie:

```
MARIMAR_API_KEY = <o mesmo valor de AGENT_API_KEY na Vercel>
```

Sem ela todas as rotas devolvem 401 e a Marina volta a improvisar.

**2. O allowlist.** As habilidades do agente estao restritas a uma lista.
Uma habilidade nova NAO entra sozinha — precisa ser adicionada:

```
openclaw config set agents.defaults.skills '["consulta-desbravador","estilo-resposta","weather","marimar-pousada"]' --strict-json
```

Conferir com `openclaw skills list`: a `marimar-pousada` tem de aparecer
como `ready`.

## Por que a lista e de permissao, e nao de bloqueio

O agente vem com 63 habilidades, varias com poder real: e-mail, API da
Hostinger (DNS, faturamento), execucao de codigo, instalacao de novas
habilidades. Com o WhatsApp aberto ao publico, qualquer pessoa alcanca o que
estiver visivel.

Lista de bloqueio precisaria ser atualizada toda vez que algo novo
aparecesse — e o `clawhub` instala coisas novas. Lista de permissao nao tem
esse problema: o que nao esta nela nao entra, hoje nem depois.
