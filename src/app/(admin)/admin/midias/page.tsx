import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { comSql } from "@/lib/db-conexao";
import { blobConfigurado } from "@/lib/blob";
import { SECOES_FOTO, secaoValida, nomeSecao } from "@/lib/fotos";
import { tituloQuarto } from "@/lib/format";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { UploadMidias } from "@/components/admin/UploadMidias";
import {
  adicionarPorUrl, salvarDescricao, reclassificar, alternarDestaque, moverOrdem, excluir,
} from "./actions";

export const dynamic = "force-dynamic";

// Alvos de toque de 40px: a tela é usada no celular, na recepção.
const BTN = "rounded-lg px-3 min-h-10 text-xs font-semibold transition-colors disabled:opacity-40";
const BTN_ESCURO = `${BTN} bg-marca text-marca-texto hover:bg-gray-700`;
const BTN_CLARO = `${BTN} bg-areia/70 text-tinta hover:bg-areia`;
const BTN_BORDA = `${BTN} border border-linha/80 text-tinta hover:bg-areia/70`;

type Foto = {
  id: string; url: string; alt: string; secao: string; quarto_id: string | null;
  destaque: boolean; ordem: number; repeticoes: number;
};
type Quarto = { id: string; nome: string; ativo: boolean; fotos: number; capa: string | null };

/**
 * Fotos do site, organizadas por onde aparecem.
 *
 * Seções em abas; em "Suítes", uma suíte de cada vez — as fotos de uma
 * suíte nunca se misturam com as de outra. Cada foto pode ser movida de
 * lugar, e a tela avisa quando a MESMA imagem está em mais de um lugar
 * (era o que fazia suítes diferentes aparecerem com as mesmas fotos).
 */
export default async function FotosPage({
  searchParams,
}: {
  searchParams: Promise<{ secao?: string; quarto?: string; ok?: string; erro?: string }>;
}) {
  const s = await auth();
  if (!s?.user) redirect("/admin/login");
  const sp = await searchParams;
  const secao = secaoValida(sp.secao ?? (sp.quarto ? "quarto" : "pousada"));

  const { contagem, quartos, fotos } = await comSql(async (sql) => {
    const contagem = await sql<{ secao: string; n: number }[]>`
      SELECT secao, count(*)::int AS n FROM midias GROUP BY secao`;
    const quartos = await sql<Quarto[]>`
      SELECT q.id, q.nome, q.ativo,
        (SELECT count(*)::int FROM midias m WHERE m.quarto_id = q.id) AS fotos,
        (SELECT m.url FROM midias m WHERE m.quarto_id = q.id ORDER BY m.destaque DESC, m.ordem LIMIT 1) AS capa
      FROM quartos q ORDER BY q.ativo DESC, q.ordem, q.nome`;
    const quartoId = secao === "quarto" ? sp.quarto ?? null : null;
    const fotos = secao !== "quarto"
      ? await sql<Foto[]>`
          SELECT m.id, m.url, m.alt, m.secao, m.quarto_id, m.destaque, m.ordem,
            (SELECT count(*)::int FROM midias o WHERE o.url = m.url) AS repeticoes
          FROM midias m WHERE m.secao = ${secao} AND m.quarto_id IS NULL
          ORDER BY m.ordem, m.criado_em`
      : quartoId
      ? await sql<Foto[]>`
          SELECT m.id, m.url, m.alt, m.secao, m.quarto_id, m.destaque, m.ordem,
            (SELECT count(*)::int FROM midias o WHERE o.url = m.url) AS repeticoes
          FROM midias m WHERE m.quarto_id = ${quartoId}
          ORDER BY m.ordem, m.criado_em`
      : [];
    return { contagem, quartos, fotos };
  });

  const total = new Map(contagem.map((c) => [c.secao, c.n]));
  const quarto = secao === "quarto" && sp.quarto ? quartos.find((q) => q.id === sp.quarto) ?? null : null;
  const semFoto = quartos.filter((q) => q.ativo && q.fotos === 0);
  const rotulo = quarto ? tituloQuarto(quarto.nome) : nomeSecao(secao);
  const voltarCampos = { voltar_secao: secao, voltar_quarto: quarto?.id ?? "" };

  /* Destinos para "mover": as seções e cada suíte. */
  const destinos = [
    ...SECOES_FOTO.filter((x) => x.chave !== "quarto").map((x) => ({ valor: `secao:${x.chave}`, nome: x.nome })),
    ...quartos.map((q) => ({ valor: `quarto:${q.id}`, nome: `Suíte: ${tituloQuarto(q.nome)}` })),
  ];

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8 mx-auto w-full max-w-7xl">
      <h1 className="font-titulo text-2xl sm:text-[1.75rem] font-bold tracking-tight text-tinta">Fotos do site</h1>
      <p className="text-sm text-tinta-suave mt-1 max-w-2xl">
        Cada foto pertence a uma parte do site. As das suítes ficam separadas por suíte — são
        também as que a Marina manda quando alguém pede para ver um quarto.
      </p>

      {/* ── abas das seções ── */}
      <nav className="mt-6 -mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto" aria-label="Seções">
        <ul className="flex gap-2 min-w-max">
          {SECOES_FOTO.map((x) => {
            const ativa = x.chave === secao;
            return (
              <li key={x.chave}>
                <Link
                  href={`/admin/midias?secao=${x.chave}`}
                  aria-current={ativa ? "page" : undefined}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium border transition-colors ${
                    ativa ? "bg-marca text-marca-texto border-gray-900" : "bg-white text-tinta border-linha/80 hover:border-gray-400"
                  }`}
                >
                  {x.nome}
                  <span className={`text-xs rounded-full px-1.5 ${ativa ? "bg-white/20" : "bg-areia/70 text-tinta-suave"}`}>
                    {total.get(x.chave) ?? 0}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ── suítes: escolher qual ── */}
      {secao === "quarto" && (
        <section className="mt-6">
          {semFoto.length > 0 && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl p-3 mb-4">
              {semFoto.length === 1 ? "1 suíte ativa está" : `${semFoto.length} suítes ativas estão`} sem nenhuma foto:{" "}
              {semFoto.map((q) => tituloQuarto(q.nome)).join(", ")}.
            </p>
          )}
          <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {quartos.map((q) => (
              <li key={q.id}>
                <Link
                  href={`/admin/midias?secao=quarto&quarto=${q.id}`}
                  aria-current={quarto?.id === q.id ? "page" : undefined}
                  className={`block rounded-xl overflow-hidden border bg-white transition-shadow hover:shadow-md ${
                    quarto?.id === q.id ? "ring-2 ring-gray-900 border-gray-900" : "border-linha/80"
                  } ${q.ativo ? "" : "opacity-60"}`}
                >
                  <div className="relative aspect-[4/3] bg-areia/70">
                    {q.capa ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={q.capa} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <span className="absolute inset-0 flex items-center justify-center text-2xl text-gray-300">🛏</span>
                    )}
                  </div>
                  <div className="px-3 py-2">
                    <p className="text-sm font-medium text-tinta truncate">{tituloQuarto(q.nome)}</p>
                    <p className={`text-xs ${q.fotos ? "text-tinta-suave" : "text-amber-700"}`}>
                      {q.fotos === 1 ? "1 foto" : `${q.fotos} fotos`}{q.ativo ? "" : " · inativa"}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          {!quarto && <p className="text-sm text-tinta-suave mt-4">Escolha uma suíte para ver e enviar as fotos dela.</p>}
        </section>
      )}

      {(secao !== "quarto" || quarto) && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-tinta mb-1">{rotulo}</h2>
          <p className="text-xs text-tinta-suave mb-4">
            {quarto
              ? "A foto marcada como capa abre a galeria da suíte e aparece na lista de acomodações."
              : secao === "pousada"
              ? "A foto marcada como destaque vai para o topo do site quando não há banner cadastrado."
              : SECOES_FOTO.find((x) => x.chave === secao)?.descricao}
          </p>

          <UploadMidias secao={secao} quartoId={quarto?.id ?? null} rotulo={rotulo} configurado={blobConfigurado()} />

          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-tinta-suave hover:text-tinta">Adicionar por endereço (link de uma imagem)</summary>
            <form action={adicionarPorUrl} className="mt-3 grid gap-2 sm:grid-cols-[2fr_2fr_auto]">
              <input type="hidden" name="secao" value={secao} />
              <input type="hidden" name="quarto_id" value={quarto?.id ?? ""} />
              {Object.entries(voltarCampos).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
              <input name="url" type="url" required placeholder="https://…" className="border rounded-lg px-3 py-2 text-sm" />
              <input name="alt" required placeholder="O que a foto mostra" className="border rounded-lg px-3 py-2 text-sm" />
              <SubmitButton className={BTN_ESCURO}>Adicionar</SubmitButton>
            </form>
          </details>

          {fotos.length === 0 ? (
            <p className="mt-6 text-sm text-tinta-suave/80">Nenhuma foto aqui ainda.</p>
          ) : (
            <ul className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {fotos.map((f, i) => (
                <li key={f.id} className={`rounded-2xl overflow-hidden border bg-white ${f.destaque ? "border-gray-900 ring-1 ring-gray-900" : "border-linha/80"}`}>
                  <div className="relative aspect-[4/3] bg-areia/70">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.url} alt={f.alt} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                    <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                      {f.destaque && (
                        <span className="text-[11px] font-semibold bg-marca text-marca-texto px-2 py-0.5 rounded-full">
                          {quarto ? "Capa" : secao === "pousada" ? "Topo do site" : "Destaque"}
                        </span>
                      )}
                      {f.repeticoes > 1 && (
                        <span className="text-[11px] font-semibold bg-amber-500 text-white px-2 py-0.5 rounded-full" title="A mesma imagem está cadastrada em outro lugar">
                          Repetida {f.repeticoes}×
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-3 space-y-2.5">
                    <form action={salvarDescricao} className="flex gap-1.5">
                      <input type="hidden" name="id" value={f.id} />
                      {Object.entries(voltarCampos).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
                      <input name="alt" defaultValue={f.alt} aria-label="Descrição da foto"
                        className="flex-1 min-w-0 border border-linha/80 rounded-lg px-2.5 py-2 text-sm" />
                      <SubmitButton className={BTN_ESCURO}>Salvar</SubmitButton>
                    </form>

                    <form action={reclassificar} className="flex gap-1.5">
                      <input type="hidden" name="id" value={f.id} />
                      {Object.entries(voltarCampos).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
                      <select name="destino" defaultValue={f.quarto_id ? `quarto:${f.quarto_id}` : `secao:${f.secao}`}
                        aria-label="Mover para" className="flex-1 min-w-0 border border-linha/80 rounded-lg px-2 py-2 text-sm bg-white">
                        {destinos.map((d) => <option key={d.valor} value={d.valor}>{d.nome}</option>)}
                      </select>
                      <SubmitButton className={BTN_CLARO}>Mover</SubmitButton>
                    </form>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <div className="flex gap-1">
                        {(["antes", "depois"] as const).map((dir) => (
                          <form key={dir} action={moverOrdem}>
                            <input type="hidden" name="id" value={f.id} />
                            <input type="hidden" name="direcao" value={dir} />
                            {Object.entries(voltarCampos).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
                            <SubmitButton
                              disabled={dir === "antes" ? i === 0 : i === fotos.length - 1}
                              className="w-10 h-10 rounded-lg text-sm bg-areia/70 text-tinta hover:bg-areia disabled:opacity-30"
                            >
                              {dir === "antes" ? "←" : "→"}
                            </SubmitButton>
                          </form>
                        ))}
                      </div>
                      <div className="flex items-center gap-3">
                        <form action={alternarDestaque}>
                          <input type="hidden" name="id" value={f.id} />
                          {Object.entries(voltarCampos).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
                          <SubmitButton className={BTN_BORDA}>
                            {f.destaque ? "Tirar destaque" : quarto ? "Tornar capa" : secao === "pousada" ? "Usar no topo" : "Destacar"}
                          </SubmitButton>
                        </form>
                        <DeleteButton action={excluir} id={f.id} extras={voltarCampos} />
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
