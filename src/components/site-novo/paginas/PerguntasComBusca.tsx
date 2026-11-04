"use client";

import { useId, useMemo, useState } from "react";

export type GrupoPerguntas = { titulo: string; itens: { p: string; r: string }[] };

const normal = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** As perguntas frequentes com uma busca simples (pergunta e resposta), sem sair da página. */
export function PerguntasComBusca({ grupos, whatsapp }: { grupos: GrupoPerguntas[]; whatsapp: string | null }) {
  const id = useId();
  const [termo, setTermo] = useState("");
  const filtrados = useMemo(() => {
    const t = normal(termo.trim());
    if (!t) return grupos;
    return grupos
      .map((g) => ({ ...g, itens: g.itens.filter((i) => normal(i.p).includes(t) || normal(i.r).includes(t)) }))
      .filter((g) => g.itens.length > 0);
  }, [grupos, termo]);
  const total = filtrados.reduce((s, g) => s + g.itens.length, 0);

  return (
    <div>
      <label htmlFor={`${id}-busca`} className="block text-[0.95rem] font-medium">Procurar uma dúvida</label>
      <input id={`${id}-busca`} type="search" value={termo} onChange={(e) => setTermo(e.target.value)} autoComplete="off"
        placeholder="Ex.: pet, check-in, barco" aria-describedby={`${id}-total`}
        className="mt-2 h-12 w-full max-w-[34rem] rounded-xl border border-sn-linha bg-white px-4 text-[1rem] outline-none focus-visible:ring-2 focus-visible:ring-sn-mare-forte" />
      <p id={`${id}-total`} aria-live="polite" className="mt-2 text-[0.9rem] text-sn-texto-2">
        {termo.trim() ? (total ? `${total} ${total === 1 ? "pergunta encontrada" : "perguntas encontradas"}` : "") : ""}
      </p>

      {total === 0 ? (
        <div className="mt-6 rounded-[16px] bg-sn-areia/70 px-5 py-4">
          <p>Nenhuma pergunta fala de “{termo.trim()}”.</p>
          {whatsapp && <a href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(`Olá! Tenho uma dúvida: ${termo.trim()}`)}`} target="_blank" rel="noopener noreferrer" className="sn-link mt-1 inline-flex min-h-11 items-center">Perguntar no WhatsApp</a>}
        </div>
      ) : (
        <div className="mt-6 space-y-12">
          {filtrados.map((g) => (
            <section key={g.titulo} aria-label={g.titulo}>
              <h2 className="sn-h3">{g.titulo}</h2>
              <div className="mt-4 divide-y divide-sn-linha border-y border-sn-linha">
                {g.itens.map((i) => (
                  <details key={i.p} className="group" open={!!termo.trim() && total <= 3}>
                    <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3.5 text-[1.02rem] font-medium [&::-webkit-details-marker]:hidden">
                      {i.p}
                      <span aria-hidden className="sn-mais inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[1.2rem] leading-none ring-1 ring-sn-linha transition-transform group-open:rotate-45">+</span>
                    </summary>
                    <p className="max-w-[44rem] pb-5 leading-relaxed text-sn-texto-2">{i.r}</p>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
