"use client";

import { usePathname } from "next/navigation";
import { paginaDoEndereco } from "@/lib/site-novo/paginas";

/**
 * Faixa no alto do site, só para o aparelho que abriu a prévia pelo painel
 * (Site → Modelo do site). Troca entre o Novo e o Clássico e sai da prévia.
 * Formulário comum: funciona até sem JavaScript.
 */
export function BarraPrevia({ modelo, publico }: { modelo: "novo" | "classico"; publico: "novo" | "classico" }) {
  const pathname = usePathname();
  const pagina = paginaDoEndereco(pathname);
  const emConstrucao = modelo === "novo" && pagina && !pagina.pronta;
  return (
    <form method="post" action="/api/modelo-site/ver"
      onSubmit={(e) => {
        const campo = e.currentTarget.elements.namedItem("voltar") as HTMLInputElement | null;
        if (campo) campo.value = window.location.pathname + window.location.search;
      }}
      className="relative z-[60] flex flex-wrap items-center gap-x-3 gap-y-1.5 bg-[#0E2A3E] px-4 py-2 text-[0.85rem] text-white"
      style={{ paddingLeft: "max(1rem, env(safe-area-inset-left, 0px))", paddingRight: "max(1rem, env(safe-area-inset-right, 0px))" }}
      aria-label="Prévia do site">
      <input type="hidden" name="voltar" defaultValue={pathname} />
      <span className="font-semibold">
        {modelo === "novo" ? "Prévia do site novo" : "Você está vendo o site clássico"}
      </span>
      <span className="text-white/75">
        {publico === "novo" ? "Os visitantes veem o Novo." : "Os visitantes veem o Clássico."}
        {emConstrucao ? ` Esta página ainda está no desenho clássico (fase ${pagina!.fase}).` : ""}
      </span>
      <span className="ml-auto flex items-center gap-2">
        <button type="submit" name="ver" value={modelo === "novo" ? "classico" : "novo"}
          className="min-h-9 rounded-full bg-white px-3.5 font-semibold text-[#0E2A3E] hover:bg-white/90">
          {modelo === "novo" ? "Ver o Clássico" : "Ver o Novo"}
        </button>
        <button type="submit" name="ver" value="sair" className="min-h-9 rounded-full px-3 text-white/85 underline-offset-4 hover:underline">
          Sair da prévia
        </button>
      </span>
    </form>
  );
}
