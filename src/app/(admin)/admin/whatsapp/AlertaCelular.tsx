"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Aviso, botao } from "@/components/admin/ui";
import { ligarAlerta, testarAlerta, desligarAlerta, type RespostaAlerta } from "./actions";

/**
 * "Aviso no seu celular": liga o alerta do vigia sem mexer na Vercel. O
 * painel cria um tópico no ntfy; a pessoa só instala o app e assina o
 * tópico (docs/blindagem-whatsapp.md).
 */
export function AlertaCelular({ origem, topico }: { origem: "vercel" | "painel" | null; topico: string | null }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState<"" | "ligar" | "testar" | "desligar">("");
  const [aviso, setAviso] = useState<RespostaAlerta | null>(null);
  const [copiado, setCopiado] = useState(false);

  async function rodar(qual: "ligar" | "testar" | "desligar", acao: () => Promise<RespostaAlerta>) {
    setOcupado(qual); setAviso(null);
    const r = await acao();
    setOcupado(""); setAviso(r);
    if (qual !== "testar" && r.ok) router.refresh();
  }

  async function copiar(t: string) {
    try { await navigator.clipboard.writeText(t); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { /* sem permissão: a pessoa copia à mão */ }
  }

  const resultado = aviso && <Aviso tom={aviso.ok ? "sucesso" : "erro"}>{aviso.texto}</Aviso>;
  const testar = (
    <button type="button" disabled={ocupado !== ""} onClick={() => rodar("testar", testarAlerta)} className={botao("secundario", "sm")}>
      {ocupado === "testar" ? "Mandando…" : "Mandar alerta de teste"}
    </button>
  );

  if (!origem) {
    return (
      <div className="space-y-3 text-sm text-tinta leading-relaxed">
        <p>Se a Marina sair do WhatsApp e o site não conseguir trazer ela de volta sozinho, chega um aviso no seu celular na hora, pelo app gratuito <strong>ntfy</strong>.</p>
        <button type="button" disabled={ocupado !== ""} onClick={() => rodar("ligar", ligarAlerta)} className={botao("primario", "md")}>
          {ocupado === "ligar" ? "Ligando…" : "Ligar o aviso no meu celular"}
        </button>
        {resultado}
      </div>
    );
  }

  if (origem === "vercel") {
    return (
      <div className="space-y-3 text-sm text-tinta leading-relaxed">
        <p>Ligado pela Vercel (<code className="font-mono text-xs">ALERTA_WHATSAPP_URL</code>){topico ? <>, tópico <strong className="font-mono">{topico}</strong></> : null}.</p>
        {testar}
        {resultado}
      </div>
    );
  }

  return (
    <div className="space-y-4 text-sm text-tinta leading-relaxed">
      <ol className="list-decimal space-y-2 pl-5">
        <li>No celular, instale o app <strong>ntfy</strong> (procure “ntfy” na Play Store ou na App Store; é gratuito).</li>
        <li>
          Abra o app, toque em <strong>+</strong> e digite este nome de tópico, exatamente assim:
          <span className="mt-1.5 flex flex-wrap items-center gap-2">
            <code className="rounded-xl bg-white/70 px-3 py-1.5 font-mono text-base font-semibold tracking-wide ring-1 ring-black/5">{topico}</code>
            {topico && (
              <button type="button" onClick={() => copiar(topico)} className={botao("fantasma", "sm")}>{copiado ? "Copiado" : "Copiar"}</button>
            )}
          </span>
          <span className="mt-1 block text-xs text-tinta-suave">Deixe desligado “Use another server” (usar outro servidor). Depois toque em <strong>Subscribe</strong> (Assinar).</span>
        </li>
        <li>Volte aqui e toque em <strong>Mandar alerta de teste</strong>. Deve chegar no celular em alguns segundos.</li>
      </ol>
      <p className="text-xs text-tinta-suave">Quem souber o nome do tópico também recebe os avisos: não publique esse nome. O aviso nunca leva dado de cliente.</p>
      <div className="flex flex-wrap gap-2">
        {testar}
        <button type="button" disabled={ocupado !== ""} onClick={() => rodar("desligar", desligarAlerta)} className={botao("fantasma", "sm")}>
          {ocupado === "desligar" ? "Desligando…" : "Desligar o aviso"}
        </button>
      </div>
      {resultado}
    </div>
  );
}
