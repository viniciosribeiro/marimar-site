import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { comSql } from "@/lib/db-conexao";
import { lerChamados, lerConfigEscalonamento } from "@/lib/escalonamento";
import { dentroDoHorario } from "@/lib/escalonamento-base";
import { gatewayConfigurado } from "@/lib/chat";
import { Pagina, Cabecalho, Aviso } from "@/components/admin/ui";
import { PainelEquipe, type ContatoPainel } from "./PainelEquipe";

export const dynamic = "force-dynamic";

/**
 * Equipe responsável: para quem a Marina pergunta quando não sabe, os
 * chamados em andamento e os prazos. Fluxo: docs/fluxo-escalonamento.md.
 */
export default async function EquipePage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const s = await auth();
  if (!s?.user) redirect("/admin/login");
  const sp = await searchParams;

  const dados = await comSql(async (sql) => {
    let contatos: ContatoPainel[] = [];
    let faltaMigration = false;
    try {
      const agora = new Date();
      contatos = (await sql<(Omit<ContatoPainel, "no_horario" | "ultimo_teste_em"> & { ultimo_teste_em: Date | null; setores: unknown; dias: unknown })[]>`
        SELECT id, nome, numero, setores, dias, hora_inicio, hora_fim, ordem, ativo, ultimo_teste_em, ultimo_teste_ok, ultimo_teste_erro
        FROM equipe_contatos ORDER BY ordem, nome`).map((c) => {
        const setores = Array.isArray(c.setores) ? (c.setores as string[]) : ["geral"];
        const dias = Array.isArray(c.dias) ? (c.dias as number[]) : [];
        return { ...c, setores, dias, ultimo_teste_em: c.ultimo_teste_em?.toISOString() ?? null, no_horario: dentroDoHorario({ dias, hora_inicio: c.hora_inicio, hora_fim: c.hora_fim }, agora) };
      });
    } catch {
      faltaMigration = true;
    }
    return { contatos, faltaMigration, config: await lerConfigEscalonamento(sql), chamados: await lerChamados(sql, 150) };
  }).catch(() => null);

  if (!dados) {
    return (
      <Pagina>
        <Cabecalho sobre="Atendimento" titulo="Equipe responsável" />
        <Aviso tom="erro" titulo="Não consegui abrir o banco de dados agora.">Recarregue em alguns segundos.</Aviso>
      </Pagina>
    );
  }

  return (
    <Pagina larga>
      <Cabecalho sobre="Atendimento" titulo="Equipe responsável"
        descricao="Quando a Marina não sabe a resposta, ela pergunta pelo WhatsApp a quem cuida do assunto e devolve a resposta ao cliente, no canal em que ele está." />
      {dados.faltaMigration && (
        <Aviso tom="aviso" className="mb-6" titulo="O banco ainda não tem as tabelas da equipe.">
          Rode <code className="font-mono">npm run db:migrate</code> (migration 0019) e recarregue.
        </Aviso>
      )}
      <PainelEquipe contatos={dados.contatos} config={dados.config} chamados={dados.chamados}
        gatewayOk={gatewayConfigurado()} abaInicial={sp.aba ?? "equipe"} />
    </Pagina>
  );
}
