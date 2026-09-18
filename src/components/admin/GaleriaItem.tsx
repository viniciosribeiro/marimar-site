import { SubmitButton } from "@/components/admin/SubmitButton";
import { definirCapa, moverFoto, excluirFoto, salvarLegenda } from "@/app/(admin)/admin/cardapio/actions";

/**
 * Grade de fotos de um item do cardapio.
 *
 * Server component de proposito: cada acao e um form com server action, o
 * que mantem tudo funcionando sem JavaScript e sem estado duplicado entre
 * cliente e banco. O unico pedaco que precisa de cliente e o envio, que
 * vive em <UploadFotos>.
 */
export function GaleriaItem({ fotos, itemId }: { fotos: any[]; itemId: string }) {
  if (fotos.length === 0) {
    return <p className="text-xs text-gray-400 mb-3">Nenhuma foto ainda. A primeira enviada vira a capa.</p>;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
      {fotos.map((f, i) => (
        <figure key={f.id} className={`relative rounded-xl overflow-hidden border bg-white ${
          f.capa ? "border-gray-900 ring-1 ring-gray-900" : "border-gray-200"
        }`}>
          <div className="relative aspect-[4/3] bg-gray-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f.url} alt={f.alt ?? ""} className="w-full h-full object-cover" loading="lazy" />
            {f.capa && (
              <span className="absolute top-2 left-2 text-[10px] font-semibold bg-gray-900 text-white px-2 py-0.5 rounded-full">
                capa
              </span>
            )}
          </div>

          <figcaption className="p-2 space-y-2">
            <form action={salvarLegenda} className="flex gap-1">
              <input type="hidden" name="id" value={f.id} />
              <input
                name="alt"
                defaultValue={f.alt ?? ""}
                placeholder="Descrição da foto"
                className="flex-1 min-w-0 border border-gray-200 rounded-lg px-2 py-1 text-[11px]"
              />
              <SubmitButton className="text-[11px] text-gray-500 hover:text-gray-900 px-1.5 bg-transparent">
                ok
              </SubmitButton>
            </form>

            <div className="flex items-center justify-between gap-1">
              <div className="flex gap-0.5">
                <form action={moverFoto}>
                  <input type="hidden" name="id" value={f.id} />
                  <input type="hidden" name="item_id" value={itemId} />
                  <input type="hidden" name="direcao" value="esquerda" />
                  <SubmitButton className="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-gray-700 bg-transparent p-0 text-xs disabled:opacity-30">
                    ◀
                  </SubmitButton>
                </form>
                <form action={moverFoto}>
                  <input type="hidden" name="id" value={f.id} />
                  <input type="hidden" name="item_id" value={itemId} />
                  <input type="hidden" name="direcao" value="direita" />
                  <SubmitButton className="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-gray-700 bg-transparent p-0 text-xs disabled:opacity-30">
                    ▶
                  </SubmitButton>
                </form>
              </div>

              <div className="flex gap-1">
                {!f.capa && (
                  <form action={definirCapa}>
                    <input type="hidden" name="id" value={f.id} />
                    <input type="hidden" name="item_id" value={itemId} />
                    <SubmitButton className="text-[11px] text-gray-600 hover:text-gray-900 px-1.5 py-1 rounded hover:bg-gray-100 bg-transparent">
                      capa
                    </SubmitButton>
                  </form>
                )}
                <form action={excluirFoto}>
                  <input type="hidden" name="id" value={f.id} />
                  <input type="hidden" name="item_id" value={itemId} />
                  <SubmitButton className="text-[11px] text-red-600 hover:text-red-800 px-1.5 py-1 rounded hover:bg-red-50 bg-transparent">
                    excluir
                  </SubmitButton>
                </form>
              </div>
            </div>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
