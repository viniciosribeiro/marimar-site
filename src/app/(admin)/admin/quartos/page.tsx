import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import postgres from "postgres";
import { criarQuarto, editarQuarto, excluirQuarto, alternarAtivoQuarto } from "./actions";
import { CrudForm } from "@/components/admin/CrudForm";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { SubmitButton } from "@/components/admin/SubmitButton";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function buscarQuartosMotor(): Promise<any[]> {
  try {
    const res = await fetch(
      `https://pousadahub.viniciosribeiro.workers.dev/tarifas?slug=pousada-ilha-do-mel-marimar&check_in=2026-10-15&check_out=2026-10-17&adultos=2`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return [...(data.quartos || []), ...(data.indisponiveis || [])];
  } catch { return []; }
}

export default async function QuartosPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; ok?: string; editar?: string; motor?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");

  const sp = await searchParams;
  const showMotor = sp.motor === "1";
  const editId = sp.editar;

  const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
  const lista = await sql`SELECT q.*, c.nome as categoria_nome FROM quartos q LEFT JOIN categorias c ON q.categoria_id = c.id ORDER BY q.ordem`;
  const categorias = await sql`SELECT * FROM categorias WHERE ativo = true ORDER BY ordem`;
  const editando = editId ? lista.find((q: any) => q.id === editId) : null;
  const motorRooms = showMotor ? await buscarQuartosMotor() : [];
  const vinculados = new Set(lista.map((q: any) => q.desbravador_room_id).filter(Boolean));
  await sql.end();

  const fields = editando
    ? [
        { name: "id", type: "hidden" as const, defaultValue: editando.id },
        { name: "nome", label: "Nome", required: true, defaultValue: editando.nome },
        { name: "slug", label: "Slug", required: true, defaultValue: editando.slug },
        { name: "categoria_id", label: "Categoria", type: "select" as const, defaultValue: editando.categoria_id ?? "", options: [{ value: "", label: "—" }, ...categorias.map((c: any) => ({ value: c.id, label: c.nome }))], className: "w-40" },
        { name: "desbravador_room_id", label: "Motor ID", defaultValue: editando.desbravador_room_id ?? "", className: "w-32" },
        { name: "ocupacao_max", label: "Ocup. Max", type: "number" as const, defaultValue: editando.ocupacao_max, className: "w-20" },
        { name: "ordem", label: "Ordem", type: "number" as const, defaultValue: editando.ordem, className: "w-20" },
        { name: "descricao", label: "Descricao", defaultValue: editando.descricao ?? "" },
        { name: "ativo", label: "Ativo", type: "checkbox" as const, defaultValue: editando.ativo ? 1 : 0 },
      ]
    : [
        { name: "nome", label: "Nome", required: true },
        { name: "slug", label: "Slug", required: true },
        { name: "categoria_id", label: "Categoria", type: "select" as const, options: [{ value: "", label: "—" }, ...categorias.map((c: any) => ({ value: c.id, label: c.nome }))], className: "w-40" },
        { name: "desbravador_room_id", label: "Motor ID", className: "w-32" },
        { name: "ocupacao_max", label: "Ocup. Max", type: "number" as const, defaultValue: 2, className: "w-20" },
        { name: "ordem", label: "Ordem", type: "number" as const, defaultValue: 0, className: "w-20" },
        { name: "descricao", label: "Descricao" },
      ];

  return (
    <div className="p-5 sm:p-8">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold">Quartos</h1>
        <a href={`/admin/quartos?motor=${showMotor ? "0" : "1"}`} className="text-sm text-teal-600 hover:underline">
          {showMotor ? "Ocultar motor" : "Carregar quartos do motor"}
        </a>
      </div>
      <p className="text-sm text-gray-500 mb-4">Vincule cada quarto ao ID do motor Desbravador</p>

      <CrudForm
        action={editando ? editarQuarto : criarQuarto}
        fields={fields}
        submitLabel={editando ? "Salvar" : "Criar"}
        error={sp.erro}
        ok={sp.ok}
        extra={editando ? <Link href="/admin/quartos" className="text-sm text-gray-500 py-2">Cancelar</Link> : undefined}
      />

      {showMotor && (
        <div className="bg-white rounded-lg shadow p-4 mt-6">
          <h2 className="font-semibold text-sm mb-3">Quartos do motor (15-17/Out/2026)</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {motorRooms.map((r: any) => (
              <div key={r.id} className={`border rounded p-2 text-xs ${vinculados.has(r.id) ? "bg-green-50 border-green-300" : "bg-gray-50"}`}>
                <span className="font-mono font-bold">{r.id}</span> — {r.nome}
                <br />R$ {r.diaria} | Ocup: {r.ocupacao_max} | {r.disponivel ? "✅" : "❌"}
                {vinculados.has(r.id) && <span className="text-green-600 ml-1">(vinculado)</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto mt-6">
        <table className="w-full text-sm min-w-[40rem]">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3">Nome</th>
              <th className="text-left p-3">Categoria</th>
              <th className="text-left p-3">Ocup.</th>
              <th className="text-left p-3">Motor ID</th>
              <th className="text-left p-3">Ativo</th>
              <th className="text-right p-3">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((q: any) => (
              <tr key={q.id} className="border-b hover:bg-gray-50">
                <td className="p-3 font-medium">{q.nome}</td>
                <td className="p-3 text-gray-500">{q.categoria_nome || "—"}</td>
                <td className="p-3">{q.ocupacao_max}</td>
                <td className="p-3 font-mono text-xs">{q.desbravador_room_id || "—"}</td>
                <td className="p-3">{q.ativo ? "✅" : "—"}</td>
                <td className="p-3 text-right space-x-2">
                  <Link href={`/admin/quartos?editar=${q.id}`} className="text-teal-600 hover:underline text-xs">Editar</Link>
                  <form action={alternarAtivoQuarto} className="inline">
                    <input type="hidden" name="id" value={q.id} />
                    <SubmitButton className="text-amber-600 hover:underline text-xs bg-transparent p-0">{q.ativo ? "Desativar" : "Ativar"}</SubmitButton>
                  </form>
                  <DeleteButton action={excluirQuarto} id={q.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400 mt-2">{lista.length} quartos</p>
    </div>
  );
}