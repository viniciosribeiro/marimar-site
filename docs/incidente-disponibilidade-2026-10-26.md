# Incidente 2026-10-26 — consultas de disponibilidade retornando HTTP 502

**Status:** correcao de regiao proposta no Git; validacao de producao obrigatoria.
**Responsavel pelo registro:** ChatGPT (investigacao Vercel + GitHub), com evidencias da sessao anterior do usuario.
**Servicos:** Marimar (Next.js/Vercel) -> PousadaHub (Cloudflare Worker) -> motor Desbravador.
**Sem migration, sem mudancas de segredos, banco ou precos.**

## Sintomas e impacto

- Site publico e pagina /reservar carregavam, mas a busca de quartos falhava.
- Logs do ambiente production da Vercel registraram `Worker HTTP 502` em `/reservar`, `/api/disponibilidade` e `/api/agent/disponibilidade`.
- Consulta aos clusters historicos, em 26/10, mostrou 51 ocorrencias do grupo /reservar afetando 15 usuarios, primeiro evento em 24/10/2026 20:33:32 UTC; 3 ocorrencias em /api/disponibilidade e 2 no agente. Sao eventos registrados, nao equivalem a reservas perdidas.
- O ultimo deploy de producao anterior a esta correcao era `dpl_FBWGTpTFiLWEthADBwaVZvJck57N`, commit `7ab6c7e`, marcado READY desde 21/10. READY significa build e publicacao feitos, nao funcionamento do motor.
- Requisicoes diretas externas para `https://pousadahub.viniciosribeiro.workers.dev/tarifas` com os parametros de teste retornaram HTTP 502 em multiplos periodos.
- Investigacao anterior (transcricao fornecida pelo proprietario) rastreou rejeicao 403 pelo Desbravador quando o caminho sai dos EUA, em contraste com acesso bem-sucedido partindo do Brasil. Esse ponto deve ser revalidado nos logs do Worker se o 502 persistir.

## Experimento que isolou o problema

- Deploy diagnostico da Vercel `dpl_3Bs7uRRfWxjWrrMXSnecEVqQXg9v`, ambiente staging, regiao `gru1` (Sao Paulo).
- GET em `/api/diagnostico` retornou HTTP 200:
  `{"regiao":"gru1","status_worker":200,"cf_ray":"...-GRU","quartos":9,"indisponiveis":1}`.
- O experimento indica que a chamada ao Worker funciona de uma Vercel Function na regiao `gru1`, com dados reais do motor. **Importante:** este foi um deploy diagnostico isolado, nao o site completo; GET /api/disponibilidade nesse deploy devolveu 404. Ele nao substitui o teste de producao.

## Correcao versionada

Adicionado `vercel.json` na raiz do repositorio:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "regions": ["gru1"]
}
```

Isso direciona as Vercel Functions do site completo, inclusive /reservar e APIs de consulta, para Sao Paulo. O trafego estatico continua servido pela CDN global. A documentacao oficial da Vercel confirma que `regions` em `vercel.json` tem precedencia sobre o valor padrao do dashboard.

Nao alterar SLUG, parametros, tarifas ou resposta do Worker para contornar uma indisponibilidade: disponibilidade e preco precisam sempre vir do motor. Nunca simular quartos/precos em producao.

## Aceite e verificacao apos publicacao

1. Confirmar que o novo commit de `main` tem deploy production `READY` e que `get_deployment` reporta `regions: ["gru1"]`.
2. Confirmar que `https://www.pousadamarimarilhadomel.com.br/` e `/reservar` carregam.
3. Consultar, sem criar reserva:
   `GET https://www.pousadamarimarilhadomel.com.br/api/disponibilidade?check_in=2026-10-30&check_out=2026-11-01&adultos=2&criancas=0`.
   Esperado: HTTP 200 e `ok:true` com quartos e precos reais, ou retorno valido explicitamente sem vagas. Nunca aceitar HTTP 500/502 ou precos simulados.
4. Verificar o mesmo fluxo de busca pelo formulario da pagina /reservar e a rota autenticada da Marina /api/agent/disponibilidade com uma credencial de teste gerenciada no ambiente seguro (nao expor credenciais em logs).
5. Conferir novos erros agregados e logs de /reservar e /api/disponibilidade na Vercel.

## Se o teste falhar

- Confirmar regiao de execucao real por deploy e request. Se `gru1` estiver correto mas o Worker voltar a 502, consultar logs de invocacao do Worker PousadaHub no Cloudflare, incluindo URL/rota e status upstream do Desbravador. Nao assumir que o 502 e problema do Next.js.
- Verificar eventuais regras geograficas/antibot do Desbravador com o provedor; nao usar proxies de evasao ou copiar credenciais para o repositorio.
- Em caso de regressao grave introduzida pelo deploy, usar o historico de deploys da Vercel para rollback, ciente de que o rollout antigo volta a executar nos EUA e pode retornar 502 nas reservas.
- Nao considerar resolvido enquanto a rota publica de disponibilidade nao tiver teste real de producao com HTTP 200.
