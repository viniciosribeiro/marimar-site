import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import postgres from "postgres";
import { alternarBloco, moverBloco, salvarBloco } from "./actions";
import { SubmitButton } from "@/components/admin/SubmitButton";

export const dynamic = "force-dynamic";

/** Explica o que cada tipo de seção mostra, em linguagem de operação. */
const DESCRICAO: Record<string, { nome: string; texto: string; icone: string }> = {
  hero:         { nome: "Topo do site",       icone: "🖼", texto: "Foto grande, nome da pousada e a busca de disponibilidade." },
  complexo:     { nome: "Restaurante e pousada", icone: "🏖", texto: "Explica que o restaurante fica na frente e a pousada aos fundos." },
  diferenciais: { nome: "O que está incluso", icone: "✨", texto: "Café da manhã, Wi-Fi, ar-condicionado, proximidade do trapiche." },
  quartos:      { nome: "Nossas suítes",      icone: "🛏", texto: "Mostra até 6 quartos ativos, com foto de capa." },
  restaurante:  { nome: "Restaurante e café", icone: "🍤", texto: "Marimar Café Bistrô Bar e o café da manhã incluso." },
  avaliacoes:   { nome: "Avaliações",         icone: "⭐", texto: "Notas reais do Google, Booking, Expedia, KAYAK e TripAdvisor." },
  mapa:         { nome: "Localização",        icone: "📍", texto: "Endereço, travessia e atrações próximas." },
  cta:          { nome: "Chamada final",      icone: "📣", texto: "Convite para consultar disponibilidade ou chamar no WhatsApp." },
  faq:          { nome: "Perguntas frequentes", icone: "❓", texto: "Até 6 perguntas cadastradas em Perguntas frequentes." },
  sobre:        { nome: "Sobre a pousada",    icone: "📖", texto: "Texto curto de apresentação com link para A Pousada." },
  galeria:      { nome: "Galeria",            icone: "📷", texto: "Chamada para a página de fotos." },
  pacotes:      { nome: "Pacotes",            icone: "🎁", texto: "Chamada para a página de pacotes." },
  passeios:     { nome: "Passeios",           icone: "🧭", texto: "Chamada para a página da Ilha do Mel." },
  depoimentos:  { nome: "Depoimentos",        icone: "💬", texto: "Não é exibido: depoimento sem identificar a plataforma de origem não vai ao ar. Use Avaliações." },
};

export default async function BlocosHomePage({ searchParams }: { searchParams: Promise<{ erro?: string; ok?: string; editar?: string }> }) {
  const s = await auth();
  if (!s?.user) redirect("/admin/login");
  const sp = await searchParams;

  let lista: any[] = [];
  try {
    const sql = postgres(process.env.DATABASE_URL!, { max: 1, connect_timeout: 5 });
    lista = await sql`SELECT * FROM blocos_home ORDER BY ordem, criado_em`;
    await sql.end();
  } catch (e) {
    console.error("[BlocosHome]", (e as Error).message);
  }

  const editando = sp.editar ? lista.find((b: any) => b.id === sp.editar) : null;
  const ativos = lista.filter((b: any) => b.ativo).length;

  return (
    <div className="p-5 sm:p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Seções da página inicial</h1>
        <p className="text-sm text-gray-500 mt-1">
          Escolha o que aparece na home, em que ordem, e troque os títulos.
          {" "}<strong>{ativos} de {lista.length}</strong> seções ativas.
        </p>
      </div>

      {sp.ok && <p className="text-sm text-green-700 bg-green-50 border border-green-200 p-3 rounded-xl mb-5">✅ {sp.ok}</p>}
      {sp.erro && <p className="text-sm text-red-700 bg-red-50 border border-red-200 p-3 rounded-xl mb-5">⚠️ {sp.erro}</p>}

      {lista.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-900">
          Nenhuma seção cadastrada. O site está usando a ordem padrão.
          Rode <code className="bg-amber-100 px-1 rounded">npm run db:seed</code> para criar as seções editáveis.
        </div>
      )}

      <div className="space-y-2">
        {lista.map((b: any, i: number) => {
          const d = DESCRICAO[b.tipo] ?? { nome: b.tipo, icone: "▫️", texto: "" };
          const emEdicao = editando?.id === b.id;

          return (
            <div key={b.id} className={`bg-white rounded-xl border transition-colors ${b.ativo ? "border-gray-200" : "border-gray-100 bg-gray-50/60"}`}>
              <div className="flex items-center gap-3 p-4">
                {/* Ordem */}
                <div className="flex flex-col gap-0.5 shrink-0">
                  <form action={moverBloco}>
                    <input type="hidden" name="id" value={b.id} />
                    <input type="hidden" name="direcao" value="cima" />
                    <SubmitButton className="w-6 h-5 flex items-center justify-center text-gray-300 hover:text-gray-700 disabled:opacity-30 bg-transparent p-0 text-xs">▲</SubmitButton>
                  </form>
                  <form action={moverBloco}>
                    <input type="hidden" name="id" value={b.id} />
                    <input type="hidden" name="direcao" value="baixo" />
                    <SubmitButton className="w-6 h-5 flex items-center justify-center text-gray-300 hover:text-gray-700 disabled:opacity-30 bg-transparent p-0 text-xs">▼</SubmitButton>
                  </form>
                </div>

                <span className="text-lg w-6 text-center shrink-0">{d.icone}</span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-medium text-sm ${b.ativo ? "text-gray-900" : "text-gray-400"}`}>{d.nome}</span>
                    <span className="text-[10px] text-gray-400 font-mono bg-gray-100 px-1.5 py-0.5 rounded">{i + 1}º</span>
                    {!b.ativo && <span className="text-[10px] text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">oculta</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{b.titulo || d.texto}</p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Link href={emEdicao ? "/admin/blocos-home" : `/admin/blocos-home?editar=${b.id}`}
                    className="text-xs text-gray-500 hover:text-gray-900 px-2.5 py-1.5 rounded-lg hover:bg-gray-100">
                    {emEdicao ? "Fechar" : "Editar"}
                  </Link>
                  <form action={alternarBloco}>
                    <input type="hidden" name="id" value={b.id} />
                    <SubmitButton className={`text-xs px-3 py-1.5 rounded-lg font-medium ${b.ativo ? "text-gray-600 bg-gray-100 hover:bg-gray-200" : "text-white bg-gray-900 hover:bg-gray-800"}`}>
                      {b.ativo ? "Ocultar" : "Exibir"}
                    </SubmitButton>
                  </form>
                </div>
              </div>

              {emEdicao && (
                <form action={salvarBloco} className="border-t border-gray-100 p-4 bg-gray-50/70 space-y-3">
                  <input type="hidden" name="id" value={b.id} />
                  <p className="text-xs text-gray-500 leading-relaxed">{d.texto}</p>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Título da seção</label>
                    <input name="titulo" defaultValue={b.titulo ?? ""} placeholder="Deixe vazio para usar o texto padrão"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Texto de apoio</label>
                    <textarea name="subtitulo" defaultValue={b.subtitulo ?? ""} rows={2} placeholder="Opcional"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  {b.tipo === "hero" && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Foto do topo (endereço da imagem)</label>
                      <input name="imagem_url" defaultValue={b.imagem_url ?? ""} placeholder="Vazio = usa a foto em destaque cadastrada em Fotos"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                    </div>
                  )}
                  <div className="flex gap-2 pt-1">
                    <SubmitButton className="bg-gray-900 hover:bg-gray-800 text-white text-sm px-4 py-2 rounded-lg font-medium">Salvar</SubmitButton>
                    <Link href="/admin/blocos-home" className="text-sm text-gray-500 px-4 py-2 hover:text-gray-900">Cancelar</Link>
                  </div>
                </form>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm text-gray-600">Veja como ficou no site.</p>
        <Link href="/" target="_blank" className="text-sm font-medium text-gray-900 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50">
          Abrir a home ↗
        </Link>
      </div>
    </div>
  );
}
