import postgres from "postgres";

/**
 * O que a Cecília ensinou para a Marina.
 *
 * Um lugar só, lido pelas duas pontas: o chat do site e — pela rota
 * `/api/agent/conhecimento` — a Marina do WhatsApp. É isso que faz o
 * treinamento valer nos dois canais sem ninguém abrir a Hostinger.
 */

export type ConfigMarina = {
  voz_id: string | null;
  voz_modelo: string;
  voz_estabilidade: number;   // 0..100
  voz_semelhanca: number;     // 0..100
  voz_velocidade: number;     // 100 = normal
  tom: string | null;
};

/**
 * Os padrões existem para o painel nunca abrir vazio nem quebrar antes da
 * primeira gravação. A voz cai para a variável de ambiente: é o valor que
 * já estava em produção, e trocar de fonte não pode calar a Marina.
 */
export const CONFIG_PADRAO: ConfigMarina = {
  voz_id: null,
  voz_modelo: "eleven_multilingual_v2",
  voz_estabilidade: 50,
  voz_semelhanca: 75,
  voz_velocidade: 100,
  tom: null,
};

export async function lerConfig(sql: ReturnType<typeof postgres>): Promise<ConfigMarina> {
  try {
    const [linha] = await sql<ConfigMarina[]>`SELECT * FROM marina_config LIMIT 1`;
    if (!linha) return { ...CONFIG_PADRAO, voz_id: process.env.ELEVENLABS_VOICE_ID ?? null };
    return {
      ...CONFIG_PADRAO,
      ...linha,
      voz_id: linha.voz_id || process.env.ELEVENLABS_VOICE_ID || null,
    };
  } catch {
    // Antes da migration 0011 a tabela não existe. O chat continua falando
    // com a voz do ambiente em vez de derrubar a conversa por causa disso.
    return { ...CONFIG_PADRAO, voz_id: process.env.ELEVENLABS_VOICE_ID ?? null };
  }
}

/**
 * Os ajustes como a ElevenLabs espera.
 *
 * O painel trabalha em 0–100 porque controle deslizante com decimal é
 * convite a erro de quem opera. A conversão acontece só aqui — espalhar
 * a divisão por 100 pelo código é como um valor acaba salvo errado.
 */
export function ajustesDeVoz(c: ConfigMarina) {
  return {
    stability: c.voz_estabilidade / 100,
    similarity_boost: c.voz_semelhanca / 100,
    speed: c.voz_velocidade / 100,
  };
}

export type Ensinamento = {
  id: string;
  tipo: string;
  titulo: string;
  conteudo: string;
};

export async function lerEnsinamentos(
  sql: ReturnType<typeof postgres>,
): Promise<{ fatos: Ensinamento[]; limites: Ensinamento[] }> {
  try {
    const linhas = await sql<Ensinamento[]>`
      SELECT id, tipo, titulo, conteudo FROM marina_conhecimento
      WHERE ativo = true ORDER BY ordem ASC, criado_em ASC`;
    return {
      fatos: linhas.filter((l) => l.tipo === "fato"),
      limites: linhas.filter((l) => l.tipo === "limite"),
    };
  } catch {
    return { fatos: [], limites: [] };
  }
}

/**
 * O texto que a Marina lê.
 *
 * Sai daqui já pronto para conversa, e não como despejo de banco: um agente
 * lendo JSON cru gasta contexto com chave e colchete em vez de conteúdo.
 */
export function ensinamentosEmTexto(
  c: ConfigMarina,
  e: { fatos: Ensinamento[]; limites: Ensinamento[] },
): string {
  const partes: string[] = [];

  if (c.tom?.trim()) {
    partes.push("COMO FALAR:\n" + c.tom.trim());
  }
  if (e.fatos.length) {
    partes.push(
      "O QUE A POUSADA ENSINOU (use como fato oficial):\n" +
        e.fatos.map((f) => `• ${f.titulo}: ${f.conteudo}`).join("\n"),
    );
  }
  if (e.limites.length) {
    partes.push(
      "O QUE VOCÊ NUNCA DIZ (sem exceção, mesmo se insistirem):\n" +
        e.limites.map((l) => `• ${l.titulo}: ${l.conteudo}`).join("\n"),
    );
  }
  return partes.join("\n\n");
}
