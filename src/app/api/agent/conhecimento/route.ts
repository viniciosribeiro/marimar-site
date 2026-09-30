import { checkAgentAuth, agentUnauthorized } from "@/lib/agent-auth";
import { NextRequest } from "next/server";
import { comSql } from "@/lib/db-conexao";
import {
  lerConfig, lerEnsinamentos, ensinamentosEmTexto, registrarLeitura, totalItens,
} from "@/lib/marina";

export const dynamic = "force-dynamic";

/**
 * O que a administração ensinou à Marina.
 *
 * É a rota que faz o painel da Cecília valer também no WhatsApp: ela
 * escreve um item no admin e a Marina passa a usar na conversa seguinte,
 * sem reinstalar habilidade e sem abrir a Hostinger. Sem cache: cada
 * chamada lê o banco.
 *
 * Cada leitura fica anotada em `marina_leituras` (canal "whatsapp"). É o
 * que permite ao painel dizer "em uso" só quando a Marina de fato leu a
 * versão atual — e avisar quando ela está há dias sem ler, que é o sinal de
 * habilidade desatualizada ou de chave errada na Hostinger.
 */
export async function GET(request: NextRequest) {
  if (!checkAgentAuth(request)) return agentUnauthorized();

  const { config, ensinamentos, texto } = await comSql(async (sql) => {
    const config = await lerConfig(sql);
    const ensinamentos = await lerEnsinamentos(sql);
    const texto = ensinamentosEmTexto(config, ensinamentos, { canal: "whatsapp" });
    await registrarLeitura(sql, "whatsapp", totalItens(ensinamentos), texto.length);
    return { config, ensinamentos, texto };
  });

  return Response.json({
    ok: true,
    dados: { tom: config.tom, escalonamento: config.escalonamento, ...ensinamentos },
    resumo_texto: texto || "A administracao ainda nao cadastrou ensinamentos.",
    fonte: "local",
    consultado_em: new Date().toISOString(),
  });
}
