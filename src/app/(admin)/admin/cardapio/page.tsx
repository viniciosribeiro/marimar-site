import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import postgres from "postgres";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { LISTA_MARCADORES, marcador } from "@/lib/cardapio";
import { UploadFotos } from "@/components/admin/UploadFotos";
import { GaleriaItem } from "@/components/admin/GaleriaItem";
import { blobConfigurado } from "@/lib/blob";
import { brl } from "@/lib/format";
import {
  salvarCategoria, alternarCategoria, excluirCategoria, moverCategoria,
  salvarItem, alternarDisponivel, excluirItem,
} from "./actions";

export const dynamic = "force-dynamic";

type SP = { ok?: string; erro?: string; cat?: string; item?: string; novoItem?: string; novaCat?: string };

export default async function CardapioAdminPage({ searchParams }: { searchParams: Promise<SP> }) {
  const s = await auth();
  if (!s?.user) redirect("/admin/login");
  const sp = await searchParams;

  let categorias: any[] = [];
  let itens: any[] = [];
  let fotos: any[] = [];
  let semTabela = false;

  try {
    const sql = postgres(process.env.DATABASE_URL!, { max: 1, connect_timeout: 5, prepare: false });
    categorias = await sql`SELECT * FROM cardapio_categorias ORDER BY ordem, nome`;
    itens = await sql`SELECT * FROM cardapio_itens ORDER BY destaque DESC, ordem, nome`;
    fotos = await sql`SELECT * FROM cardapio_fotos ORDER BY capa DESC, ordem, criado_em`;
    await sql.end();
  } catch (e) {
    semTabela = String((e as Error).message).includes("cardapio");
    console.error("[CardapioAdmin]", (e as Error).message);
  }

  if (semTabela) {
    return (
      <div className="p-5 sm:p-8 max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Cardápio</h1>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-900">
          As tabelas do cardápio ainda não existem no banco.
          Rode <code className="bg-amber-100 px-1.5 py-0.5 rounded">npm run db:migrate</code> para criá-las.
        </div>
      </div>
    );
  }

  const catEditando = sp.cat ? categorias.find((c) => c.id === sp.cat) : null;
  const itemEditando = sp.item ? itens.find((i) => i.id === sp.item) : null;
  const criandoItem = sp.novoItem ?? null;
  const porCategoria = (id: string) => itens.filter((i) => i.categoria_id === id);
  const totalAtivos = itens.filter((i) => i.ativo).length;
  const fotosDe = (itemId: string) => fotos.filter((f) => f.item_id === itemId);
  const temBlob = blobConfigurado();

  return (
    <div className="p-5 sm:p-8 max-w-5xl">
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cardápio</h1>
          <p className="text-sm text-gray-500 mt-1">
            {categorias.length} seç{categorias.length === 1 ? "ão" : "ões"} · {totalAtivos} itens
          </p>
        </div>
        <Link href="/cardapio" target="_blank"
          className="text-sm font-medium text-gray-900 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50">
          Ver no site ↗
        </Link>
      </div>

      {sp.ok && <p className="text-sm text-green-700 bg-green-50 border border-green-200 p-3 rounded-xl mb-5">✅ {sp.ok}</p>}
      {sp.erro && <p className="text-sm text-red-700 bg-red-50 border border-red-200 p-3 rounded-xl mb-5">⚠️ {sp.erro}</p>}

      {/* ─── Nova seção ─── */}
      {sp.novaCat !== undefined || categorias.length === 0 ? (
        <form action={salvarCategoria} className="bg-white rounded-xl border border-gray-200 p-5 mb-6 space-y-3">
          <h2 className="font-semibold text-gray-900">Nova seção do cardápio</h2>
          <p className="text-xs text-gray-500">Ex.: Entradas, Peixes e frutos do mar, Drinks, Sobremesas.</p>
          <div className="grid sm:grid-cols-[3rem_1fr] gap-3">
            <input name="icone" placeholder="🍤" maxLength={4} className="border border-gray-200 rounded-lg px-3 py-2 text-center text-lg" />
            <input name="nome" required placeholder="Nome da seção" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <input name="descricao" placeholder="Descrição curta (opcional)" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          <input name="horario" placeholder="Horário — ex.: 12h às 16h (opcional)" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          <div className="flex gap-2">
            <SubmitButton className="bg-gray-900 hover:bg-gray-800 text-white text-sm px-4 py-2 rounded-lg font-medium">Criar seção</SubmitButton>
            {categorias.length > 0 && <Link href="/admin/cardapio" className="text-sm text-gray-500 px-4 py-2">Cancelar</Link>}
          </div>
        </form>
      ) : (
        <Link href="/admin/cardapio?novaCat" className="inline-block mb-6 text-sm font-medium text-gray-900 border border-dashed border-gray-300 px-4 py-2.5 rounded-lg hover:bg-gray-50">
          + Nova seção
        </Link>
      )}

      {/* ─── Seções ─── */}
      <div className="space-y-4">
        {categorias.map((c, idx) => {
          const meus = porCategoria(c.id);
          const editandoEsta = catEditando?.id === c.id;

          return (
            <div key={c.id} className={`bg-white rounded-xl border ${c.ativo ? "border-gray-200" : "border-gray-100 bg-gray-50/60"}`}>
              {/* Cabeçalho da seção */}
              <div className="flex items-center gap-3 p-4 border-b border-gray-100">
                <div className="flex flex-col gap-0.5 shrink-0">
                  <form action={moverCategoria}>
                    <input type="hidden" name="id" value={c.id} /><input type="hidden" name="direcao" value="cima" />
                    <SubmitButton className="w-6 h-5 flex items-center justify-center text-gray-300 hover:text-gray-700 bg-transparent p-0 text-xs">▲</SubmitButton>
                  </form>
                  <form action={moverCategoria}>
                    <input type="hidden" name="id" value={c.id} /><input type="hidden" name="direcao" value="baixo" />
                    <SubmitButton className="w-6 h-5 flex items-center justify-center text-gray-300 hover:text-gray-700 bg-transparent p-0 text-xs">▼</SubmitButton>
                  </form>
                </div>

                <span className="text-xl w-7 text-center shrink-0">{c.icone || "🍽"}</span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-semibold text-sm ${c.ativo ? "text-gray-900" : "text-gray-400"}`}>{c.nome}</span>
                    <span className="text-[10px] text-gray-400 font-mono bg-gray-100 px-1.5 py-0.5 rounded">{idx + 1}º</span>
                    {!c.ativo && <span className="text-[10px] text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">oculta</span>}
                    {c.horario && <span className="text-[10px] text-gray-500">🕐 {c.horario}</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {meus.length === 0 ? "sem itens ainda" : `${meus.length} ${meus.length === 1 ? "item" : "itens"}`}
                    {c.descricao ? ` · ${c.descricao}` : ""}
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Link href={editandoEsta ? "/admin/cardapio" : `/admin/cardapio?cat=${c.id}`}
                    className="text-xs text-gray-500 hover:text-gray-900 px-2.5 py-1.5 rounded-lg hover:bg-gray-100">
                    {editandoEsta ? "Fechar" : "Editar"}
                  </Link>
                  <form action={alternarCategoria}>
                    <input type="hidden" name="id" value={c.id} />
                    <SubmitButton className={`text-xs px-3 py-1.5 rounded-lg font-medium ${c.ativo ? "text-gray-600 bg-gray-100 hover:bg-gray-200" : "text-white bg-gray-900"}`}>
                      {c.ativo ? "Ocultar" : "Publicar"}
                    </SubmitButton>
                  </form>
                </div>
              </div>

              {/* Editar seção */}
              {editandoEsta && (
                <form action={salvarCategoria} className="p-4 bg-gray-50/70 border-b border-gray-100 space-y-3">
                  <input type="hidden" name="id" value={c.id} />
                  <div className="grid sm:grid-cols-[3rem_1fr] gap-3">
                    <input name="icone" defaultValue={c.icone ?? ""} maxLength={4} className="border border-gray-200 rounded-lg px-3 py-2 text-center text-lg" />
                    <input name="nome" required defaultValue={c.nome} className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <input name="descricao" defaultValue={c.descricao ?? ""} placeholder="Descrição curta" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  <input name="horario" defaultValue={c.horario ?? ""} placeholder="Horário" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex gap-2">
                      <SubmitButton className="bg-gray-900 hover:bg-gray-800 text-white text-sm px-4 py-2 rounded-lg font-medium">Salvar</SubmitButton>
                      <Link href="/admin/cardapio" className="text-sm text-gray-500 px-4 py-2">Cancelar</Link>
                    </div>
                  </div>
                </form>
              )}

              {editandoEsta && (
                <form action={excluirCategoria} className="px-4 py-3 bg-red-50/60 border-b border-red-100">
                  <input type="hidden" name="id" value={c.id} />
                  <p className="text-xs text-red-800 mb-2">
                    Excluir a seção <strong>{c.nome}</strong> apaga também os {meus.length} itens dela. Não tem como desfazer.
                  </p>
                  <SubmitButton className="text-xs text-red-700 border border-red-300 bg-white hover:bg-red-100 px-3 py-1.5 rounded-lg font-medium">
                    Excluir seção e itens
                  </SubmitButton>
                </form>
              )}

              {/* Itens */}
              <div className="divide-y divide-gray-50">
                {meus.map((i) => (
                  <ItemLinha key={i.id} item={i} editando={itemEditando?.id === i.id} categorias={categorias}
                    fotos={fotosDe(i.id)} temBlob={temBlob} />
                ))}
              </div>

              {/* Novo item */}
              <div className="p-4 border-t border-gray-100">
                {criandoItem === c.id ? (
                  <FormItem categorias={categorias} categoriaPadrao={c.id} />
                ) : (
                  <Link href={`/admin/cardapio?novoItem=${c.id}`}
                    className="inline-block text-sm text-gray-600 hover:text-gray-900 border border-dashed border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50">
                    + Adicionar item em {c.nome}
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ItemLinha({ item, editando, categorias, fotos, temBlob }: { item: any; editando: boolean; categorias: any[]; fotos: any[]; temBlob: boolean }) {
  const promo = item.preco_promocional && Number(item.preco_promocional) > 0;
  return (
    <div>
      <div className={`flex items-center gap-3 px-4 py-3 ${!item.disponivel ? "opacity-60" : ""}`}>
        {item.foto_url
          ? <img src={item.foto_url} alt="" className="w-11 h-11 rounded-lg object-cover shrink-0 bg-gray-100" />
          : <span className="w-11 h-11 rounded-lg bg-gray-100 flex items-center justify-center text-gray-300 shrink-0">🍽</span>}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-900">{item.nome}</span>
            {item.destaque && <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">★ destaque</span>}
            {!item.disponivel && <span className="text-[10px] bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">esgotado hoje</span>}
            {fotos.length > 0 && <span className="text-[10px] text-gray-400">📷 {fotos.length}</span>}
            {(item.marcadores ?? []).map((m: string) => {
              const info = marcador(m);
              return info ? <span key={m} className="text-[11px]" title={info.rotulo}>{info.icone}</span> : null;
            })}
          </div>
          {item.descricao && <p className="text-xs text-gray-500 truncate mt-0.5">{item.descricao}</p>}
        </div>

        <div className="text-right shrink-0">
          {item.preco ? (
            <>
              {promo && <span className="block text-[11px] text-gray-400 line-through">{brl(Number(item.preco))}</span>}
              <span className="text-sm font-semibold text-gray-900">{brl(Number(promo ? item.preco_promocional : item.preco))}</span>
            </>
          ) : <span className="text-xs text-gray-400">sem preço</span>}
          {item.porcao && <p className="text-[11px] text-gray-400">{item.porcao}</p>}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <form action={alternarDisponivel}>
            <input type="hidden" name="id" value={item.id} />
            <SubmitButton className="text-xs text-gray-500 hover:text-gray-900 px-2 py-1.5 rounded-lg hover:bg-gray-100 bg-transparent">
              {item.disponivel ? "Esgotou" : "Repor"}
            </SubmitButton>
          </form>
          <Link href={editando ? "/admin/cardapio" : `/admin/cardapio?item=${item.id}`}
            className="text-xs text-gray-500 hover:text-gray-900 px-2 py-1.5 rounded-lg hover:bg-gray-100">
            {editando ? "Fechar" : "Editar"}
          </Link>
        </div>
      </div>

      {editando && (
        <div className="px-4 pb-4 bg-gray-50/70">
          <div className="pt-4">
            <p className="text-xs font-medium text-gray-600 mb-2">
              Fotos deste item {fotos.length > 0 && <span className="text-gray-400">· a capa aparece na listagem</span>}
            </p>
            <GaleriaItem fotos={fotos} itemId={item.id} />
            <UploadFotos itemId={item.id} nomeItem={item.nome} configurado={temBlob} />
          </div>
          <FormItem categorias={categorias} item={item} />
          <form action={excluirItem} className="mt-2">
            <input type="hidden" name="id" value={item.id} />
            <SubmitButton className="text-xs text-red-700 hover:underline bg-transparent p-0">Excluir este item</SubmitButton>
          </form>
        </div>
      )}
    </div>
  );
}

function FormItem({ categorias, item, categoriaPadrao }: { categorias: any[]; item?: any; categoriaPadrao?: string }) {
  const m: string[] = item?.marcadores ?? [];
  return (
    <form action={salvarItem} className="space-y-3 pt-3">
      {item && <input type="hidden" name="id" value={item.id} />}

      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-xs font-medium text-gray-600 mb-1">Nome do item</span>
          <input name="nome" required defaultValue={item?.nome ?? ""} placeholder="Ex.: Camarão na moranga"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-gray-600 mb-1">Seção</span>
          <select name="categoria_id" defaultValue={item?.categoria_id ?? categoriaPadrao} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="block text-xs font-medium text-gray-600 mb-1">Descrição</span>
        <textarea name="descricao" rows={2} defaultValue={item?.descricao ?? ""}
          placeholder="Ingredientes e modo de preparo, em uma frase"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
      </label>

      <div className="grid sm:grid-cols-3 gap-3">
        <label className="block">
          <span className="block text-xs font-medium text-gray-600 mb-1">Preço (R$)</span>
          <input name="preco" inputMode="decimal" defaultValue={item?.preco ?? ""} placeholder="89,90"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-gray-600 mb-1">Promocional</span>
          <input name="preco_promocional" inputMode="decimal" defaultValue={item?.preco_promocional ?? ""} placeholder="opcional"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-gray-600 mb-1">Porção</span>
          <input name="porcao" defaultValue={item?.porcao ?? ""} placeholder="Serve 2 · 350ml"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </label>
      </div>

      <fieldset>
        <legend className="text-xs font-medium text-gray-600 mb-2">Marcadores</legend>
        <div className="flex flex-wrap gap-2">
          {LISTA_MARCADORES.map((mk) => (
            <label key={mk.chave} className="inline-flex items-center gap-1.5 text-xs border border-gray-200 bg-white rounded-full px-3 py-1.5 cursor-pointer hover:bg-gray-50 has-checked:bg-gray-900 has-checked:text-white has-checked:border-gray-900">
              <input type="checkbox" name="marcadores" value={mk.chave} defaultChecked={m.includes(mk.chave)} className="sr-only" />
              <span aria-hidden>{mk.icone}</span> {mk.rotulo}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
        <input type="checkbox" name="destaque" defaultChecked={item?.destaque ?? false} className="rounded border-gray-300" />
        Destacar no topo da seção
      </label>

      {!item && (
        <p className="text-xs text-gray-500 bg-white border border-gray-200 rounded-lg px-3 py-2">
          Salve o item primeiro. Depois clique em <strong>Editar</strong> nele para enviar as fotos.
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <SubmitButton className="bg-gray-900 hover:bg-gray-800 text-white text-sm px-4 py-2 rounded-lg font-medium">
          {item ? "Salvar item" : "Adicionar item"}
        </SubmitButton>
        <Link href="/admin/cardapio" className="text-sm text-gray-500 px-4 py-2">Cancelar</Link>
      </div>
    </form>
  );
}
