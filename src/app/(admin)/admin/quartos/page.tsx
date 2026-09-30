import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import postgres from "postgres";
import { criarQuarto, editarQuarto, excluirQuarto, alternarAtivoQuarto } from "./actions";
import { CrudForm } from "@/components/admin/CrudForm";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { urlTarifas } from "@/lib/worker";
import { datasExemplo, tituloQuarto } from "@/lib/format";
import { Pagina, Cabecalho, Cartao, Aviso, Lista, Selo, Vazio, BotaoLink, botao } from "@/components/admin/ui";
import { JanelaRota } from "@/components/admin/ui-cliente";
import { Plus, Pencil, Images, Film } from "lucide-react";
import { blobConfigurado } from "@/lib/blob";
import { VideosSuite, type VideoSuite } from "./VideosSuite";

export const dynamic = "force-dynamic";

async function buscarQuartosMotor(): Promise<any[]> {
  try {
    const { checkIn, checkOut } = datasExemplo();
    const res = await fetch(urlTarifas(checkIn, checkOut, 2), { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const data = await res.json();
    return [...(data.quartos || []), ...(data.indisponiveis || [])];
  } catch { return []; }
}

export default async function QuartosPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; ok?: string; editar?: string; motor?: string; novo?: string }>;
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
  // Comodidades de suíte e quais esta suíte tem: a Marina responde "tem ar?"
  // com isto, e antes não havia tela para marcar.
  const comodidades = await sql`SELECT id, nome FROM comodidades WHERE ativo = true AND escopo = 'quarto' ORDER BY ordem, nome`;
  const marcadas = new Set(
    editando ? (await sql`SELECT comodidade_id FROM quarto_comodidades WHERE quarto_id = ${editando.id}`).map((r: any) => r.comodidade_id) : []
  );
  const vinculados = new Set(lista.map((q: any) => q.desbravador_room_id).filter(Boolean));
  /* Quantas fotos e vídeos cada suíte tem — a lista mostra, e a janela de
     edição traz os vídeos para ordenar e nomear. */
  const contagem = new Map<string, { fotos: number; videos: number }>();
  for (const r of await sql`SELECT quarto_id, tipo, count(*)::int AS n FROM midias WHERE quarto_id IS NOT NULL GROUP BY 1, 2`) {
    const c = contagem.get(r.quarto_id) ?? { fotos: 0, videos: 0 };
    if (r.tipo === "video") c.videos = r.n; else c.fotos = r.n;
    contagem.set(r.quarto_id, c);
  }
  const videos: VideoSuite[] = editando
    ? (await sql<VideoSuite[]>`SELECT id, titulo, descricao, alt, thumb_url, duracao_seg, visivel_marina FROM midias
        WHERE quarto_id = ${editando.id} AND tipo = 'video' ORDER BY ordem, criado_em`.catch(() => [] as VideoSuite[]))
        .map((v) => ({ ...v, duracao_seg: v.duracao_seg === null ? null : Number(v.duracao_seg) }))
    : [];
  await sql.end();

  const fields = editando
    ? [
        { name: "id", type: "hidden" as const, defaultValue: editando.id },
        { name: "nome", label: "Nome", required: true, defaultValue: editando.nome },
        { name: "slug", label: "Slug", required: true, defaultValue: editando.slug },
        { name: "categoria_id", label: "Categoria", type: "select" as const, defaultValue: editando.categoria_id ?? "", options: [{ value: "", label: "—" }, ...categorias.map((c: any) => ({ value: c.id, label: c.nome }))] },
        { name: "desbravador_room_id", label: "Motor ID", defaultValue: editando.desbravador_room_id ?? "" },
        { name: "ocupacao_max", label: "Ocup. Max", type: "number" as const, defaultValue: editando.ocupacao_max },
        { name: "ordem", label: "Ordem", type: "number" as const, defaultValue: editando.ordem },
        { name: "cama", label: "Cama(s)", defaultValue: editando.cama ?? "" },
        { name: "metragem", label: "Metragem (m²)", type: "number" as const, defaultValue: editando.metragem ?? "" },
        { name: "vista", label: "Vista", defaultValue: editando.vista ?? "" },
        { name: "descricao", label: "Descrição", type: "textarea" as const, defaultValue: editando.descricao ?? "" },
        { name: "ativo", label: "Ativo", type: "checkbox" as const, defaultValue: editando.ativo ? 1 : 0 },
      ]
    : [
        { name: "nome", label: "Nome", required: true },
        { name: "slug", label: "Slug", required: true },
        { name: "categoria_id", label: "Categoria", type: "select" as const, options: [{ value: "", label: "—" }, ...categorias.map((c: any) => ({ value: c.id, label: c.nome }))] },
        { name: "desbravador_room_id", label: "Motor ID" },
        { name: "ocupacao_max", label: "Ocup. Max", type: "number" as const, defaultValue: 2 },
        { name: "ordem", label: "Ordem", type: "number" as const, defaultValue: 0 },
        { name: "cama", label: "Cama(s)" },
        { name: "metragem", label: "Metragem (m²)", type: "number" as const },
        { name: "vista", label: "Vista" },
        { name: "descricao", label: "Descrição", type: "textarea" as const },
        // Sem este campo a action lia "desligado" e toda suíte nascia inativa.
        { name: "ativo", label: "Ativo", type: "checkbox" as const, defaultValue: 1 },
      ];

  const listaComodidades = comodidades.length > 0 && (
    <fieldset className="mt-4 rounded-xl border border-linha/80 p-4">
      <legend className="px-1 text-sm font-medium text-tinta">Comodidades desta suíte</legend>
      <p className="text-xs text-tinta-suave">A Marina responde “o quarto tem ar?” com esta lista.</p>
      <div className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
        {comodidades.map((c: any) => (
          <label key={c.id} className="flex min-h-10 items-center gap-3 text-sm text-tinta">
            <input type="checkbox" name="comodidades" value={c.id} defaultChecked={marcadas.has(c.id)} className="h-5 w-5 accent-[var(--marca)]" />
            {c.nome}
          </label>
        ))}
      </div>
    </fieldset>
  );
  const janela = Boolean(editando || sp.novo === "1");

  return (
    <Pagina larga>
      <Cabecalho sobre="Acomodações" titulo="Quartos"
        descricao="As suítes que aparecem no site. Cada uma se liga a um tipo de quarto do motor Desbravador — é de lá que vêm preço e vaga."
        acoes={<>
          <BotaoLink href={`/admin/quartos?motor=${showMotor ? "0" : "1"}`} variante="secundario">{showMotor ? "Esconder o motor" : "Ver quartos do motor"}</BotaoLink>
          <BotaoLink href="/admin/quartos?novo=1"><Plus className="h-4 w-4" /> Novo quarto</BotaoLink>
        </>} />

      {janela && (
        <JanelaRota titulo={editando ? `Editar ${editando.nome}` : "Novo quarto"} voltar="/admin/quartos">
          <CrudForm
            action={editando ? editarQuarto : criarQuarto}
            fields={fields}
            submitLabel={editando ? "Salvar alterações" : "Criar quarto"}
            extra={<>
              {listaComodidades}
            </>}
          />
          {editando && (
            <VideosSuite quartoId={editando.id} videos={videos} blobOk={blobConfigurado()}
              totalFotos={contagem.get(editando.id)?.fotos ?? 0} />
          )}
        </JanelaRota>
      )}

      {showMotor && (
        <Cartao className="mb-6" titulo="Quartos do motor" descricao="Consulta de exemplo, daqui a uma semana. Em verde, os já ligados a um quarto do site.">
          {motorRooms.length === 0 ? <Aviso tom="aviso">O motor não respondeu agora.</Aviso> : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {motorRooms.map((r: any) => (
                <div key={r.id} className={`rounded-xl border p-3 text-xs ${vinculados.has(r.id) ? "border-emerald-200 bg-emerald-50" : "border-linha/80 bg-fundo-suave"}`}>
                  <p><span className="font-mono font-bold">{r.id}</span> — {r.nome}</p>
                  <p className="mt-1 text-tinta-suave">Diária {Number(r.diaria).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} · até {r.ocupacao_max} pessoas · {r.disponivel ? "com vaga" : "sem vaga"}</p>
                  {vinculados.has(r.id) && <p className="mt-1 font-semibold text-emerald-700">ligado a um quarto do site</p>}
                </div>
              ))}
            </div>
          )}
        </Cartao>
      )}

      <Lista
        cartoesAte="xl"
        itens={[...lista] as any[]}
        chave={(q: any) => q.id}
        vazio={<Vazio icone="🛏️" titulo="Nenhum quarto cadastrado" acao={<BotaoLink href="/admin/quartos?novo=1"><Plus className="h-4 w-4" /> Cadastrar o primeiro</BotaoLink>} />}
        colunas={[
          { titulo: "Quarto", celula: (q: any) => <span className="font-medium">{tituloQuarto(q.nome)}</span> },
          { titulo: "Categoria", celula: (q: any) => q.categoria_nome || "—" },
          { titulo: "Até", celula: (q: any) => <span className="whitespace-nowrap">{q.ocupacao_max} {q.ocupacao_max === 1 ? "pessoa" : "pessoas"}</span> },
          { titulo: "Motor", celula: (q: any) => q.desbravador_room_id ? <span className="font-mono text-xs">{q.desbravador_room_id}</span> : <Selo tom="aviso">sem vínculo</Selo> },
          { titulo: "Mídia", celula: (q: any) => {
            const c = contagem.get(q.id);
            return c ? (
              <span className="inline-flex items-center gap-2.5 whitespace-nowrap text-xs text-tinta-suave" title={`${c.fotos} ${c.fotos === 1 ? "foto" : "fotos"} e ${c.videos} ${c.videos === 1 ? "vídeo" : "vídeos"}`}>
                <span className="inline-flex items-center gap-1"><Images className="h-3.5 w-3.5" />{c.fotos}</span>
                <span className="inline-flex items-center gap-1"><Film className="h-3.5 w-3.5" />{c.videos}</span>
              </span>
            ) : <Selo tom="aviso">sem fotos</Selo>;
          } },
          { titulo: "Situação", celula: (q: any) => <Selo tom={q.ativo ? "sucesso" : "neutro"} ponto>{q.ativo ? "No site" : "Escondido"}</Selo> },
        ]}
        acoes={(q: any) => <>
          <BotaoLink href={`/admin/quartos?editar=${q.id}`} variante="secundario" tamanho="sm"><Pencil className="h-3.5 w-3.5" /> Editar</BotaoLink>
          <BotaoLink href={`/admin/midias?album=quarto:${q.id}`} variante="secundario" tamanho="sm"><Images className="h-3.5 w-3.5" /> Mídia</BotaoLink>
          <form action={alternarAtivoQuarto}>
            <input type="hidden" name="id" value={q.id} />
            <SubmitButton className={botao("fantasma", "sm")}>{q.ativo ? "Esconder" : "Mostrar no site"}</SubmitButton>
          </form>
          <DeleteButton action={excluirQuarto} id={q.id} texto="O quarto sai do site e as fotos dele ficam sem suíte. Não dá para desfazer." />
        </>}
      />
      <p className="mt-3 px-1 text-xs text-tinta-suave">{lista.length} {lista.length === 1 ? "quarto" : "quartos"}</p>
    </Pagina>
  );
}
