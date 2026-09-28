"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { exigirSessao } from "@/lib/admin-sessao";
import { comSql, type Sql } from "@/lib/db-conexao";
import { lerConteudo, hojeBR, type Chave } from "@/lib/conteudo-editavel";

const txt = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const linhas = (f: FormData, k: string) => txt(f, k).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
/** "26,90", "26.9" ou "R$ 26,90" → 26.9. Vazio ou inválido → o valor atual. */
const preco = (f: FormData, k: string, atual: number) => {
  const limpo = txt(f, k).replace(/[^\d,.]/g, "").replace(",", ".");
  const v = parseFloat(limpo);
  return Number.isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : atual;
};

async function gravar(sql: Sql, chave: Chave, dados: Record<string, unknown>) {
  await sql`
    INSERT INTO conteudo_editavel (chave, dados, atualizado_em)
    VALUES (${chave}, ${sql.json(dados as never)}, now())
    ON CONFLICT (chave) DO UPDATE SET dados = EXCLUDED.dados, atualizado_em = now()`;
}

function voltar(msg: string, paginas: string[]) {
  for (const p of paginas) revalidatePath(p);
  revalidatePath("/admin/conteudo");
  redirect("/admin/conteudo?ok=" + encodeURIComponent(msg));
}

/** Travessia e as três etapas da chegada. */
export async function salvarChegar(f: FormData) {
  await exigirSessao();
  await comSql(async (sql) => {
    const atual = await lerConteudo(sql);
    const p = atual.TRAVESSIA.precos;
    const precos = {
      ida: preco(f, "ida", p.ida),
      volta: preco(f, "volta", p.volta),
      idaEVolta: preco(f, "idaEVolta", p.idaEVolta),
      gratuidade: txt(f, "gratuidade") || p.gratuidade,
      consultadoEm: p.consultadoEm,
    };
    // A Marina cita "consultado em": a data muda sozinha quando um preço muda.
    if (precos.ida !== p.ida || precos.volta !== p.volta || precos.idaEVolta !== p.idaEVolta) {
      precos.consultadoEm = hojeBR();
    }
    const etapas = [1, 2, 3].map((n, i) => ({
      n,
      titulo: txt(f, `etapa${n}_titulo`) || atual.CHEGADA_ETAPAS[i]?.titulo || "",
      texto: txt(f, `etapa${n}_texto`) || atual.CHEGADA_ETAPAS[i]?.texto || "",
    }));
    await gravar(sql, "chegar", {
      TRAVESSIA: {
        operadora: txt(f, "operadora") || atual.TRAVESSIA.operadora,
        site: txt(f, "site") || atual.TRAVESSIA.site,
        duracao: txt(f, "duracao") || atual.TRAVESSIA.duracao,
        avisoDestino: txt(f, "avisoDestino") || atual.TRAVESSIA.avisoDestino,
        estacionamento: txt(f, "estacionamento") || atual.TRAVESSIA.estacionamento,
        precos,
      },
      CHEGADA_ETAPAS: etapas,
    });
  });
  voltar("Chegada e travessia salvas. Já valem no site e para a Marina.", ["/como-chegar", "/ilha-do-mel"]);
}

/** Como a ilha funciona e os cuidados ambientais. */
export async function salvarIlha(f: FormData) {
  await exigirSessao();
  await comSql(async (sql) => {
    const atual = await lerConteudo(sql);
    const [linha] = await sql<{ dados: Record<string, unknown> }[]>`SELECT dados FROM conteudo_editavel WHERE chave = 'ilha'`;
    await gravar(sql, "ilha", {
      ...(linha?.dados ?? {}),
      SOBRE_A_ILHA: {
        acesso: txt(f, "acesso") || atual.SOBRE_A_ILHA.acesso,
        bagagem: txt(f, "bagagem") || atual.SOBRE_A_ILHA.bagagem,
      },
      CUIDADOS_AMBIENTAIS: linhas(f, "cuidados").length ? linhas(f, "cuidados") : atual.CUIDADOS_AMBIENTAIS,
      AVISO_DISTANCIAS: txt(f, "avisoDistancias") || atual.AVISO_DISTANCIAS,
    });
  });
  voltar("Textos da ilha salvos.", ["/ilha-do-mel", "/como-chegar"]);
}

/** Eventos: o que a pousada recebe e, quando definida, a capacidade. */
export async function salvarEventos(f: FormData) {
  await exigirSessao();
  await comSql(async (sql) => {
    const atual = await lerConteudo(sql);
    await gravar(sql, "eventos", {
      EVENTOS: {
        tipos: linhas(f, "tipos").length ? linhas(f, "tipos") : atual.EVENTOS.tipos,
        espacos: linhas(f, "espacos").length ? linhas(f, "espacos") : atual.EVENTOS.espacos,
        // Capacidade em branco = "sob consulta": a Marina não informa número.
        capacidade: txt(f, "capacidade") || null,
        avisoPendente: txt(f, "avisoPendente"),
      },
    });
  });
  voltar("Eventos salvos.", ["/eventos"]);
}
