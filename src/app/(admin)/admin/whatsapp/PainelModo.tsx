"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Aviso, Selo, botao, cn } from "@/components/admin/ui";
import { escolherModo, testarMeta } from "./actions";

/**
 * Qual das duas formas a Marina usa no WhatsApp. Trocar é um clique e
 * volta atrás do mesmo jeito: o QR fica guardado no servidor enquanto a
 * API oficial está em uso.
 */

const OPCOES = [
  { valor: "web", nome: "WhatsApp Web (QR)", ajuda: "A Marina entra como aparelho conectado do celular da pousada. Sem custo; pode cair se o aparelho for removido." },
  { valor: "oficial", nome: "API oficial da Meta", ajuda: "Conta oficial do WhatsApp para empresas. Não cai por aparelho; respostas livres até 24 h depois da última mensagem do cliente." },
] as const;

export function EscolhaModo({ modo, podeMexer, oficialPronta }: { modo: string; podeMexer: boolean; oficialPronta: boolean }) {
  const router = useRouter();
  const [trocando, setTrocando] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);

  async function trocar(para: string) {
    const nome = OPCOES.find((o) => o.valor === para)?.nome ?? para;
    if (!window.confirm(`Trocar a Marina para ${nome}? Ela passa a responder só por essa forma.`)) return;
    setTrocando(true);
    const r = await escolherModo(para);
    setTrocando(false);
    setAviso(r);
    if (r.ok) router.refresh();
  }

  return (
    <div className="space-y-3">
      {aviso && <Aviso tom={aviso.ok ? "sucesso" : "erro"}>{aviso.texto}</Aviso>}
      <div className="grid gap-3 sm:grid-cols-2">
        {OPCOES.map((o) => {
          const emUso = modo === o.valor;
          const bloqueada = o.valor === "oficial" && !oficialPronta;
          return (
            <div key={o.valor} className={cn("flex flex-col gap-3 rounded-2xl border p-4", emUso ? "border-marca bg-marca/5" : "border-linha/80 bg-white/60")}>
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-tinta">{o.nome}</p>
                {emUso ? <Selo tom="marca" ponto>Em uso</Selo> : bloqueada ? <Selo tom="neutro">Sem chaves</Selo> : null}
              </div>
              <p className="text-xs text-tinta-suave leading-relaxed">{o.ajuda}</p>
              {!emUso && podeMexer && (
                <button type="button" disabled={trocando || bloqueada} onClick={() => trocar(o.valor)} className={botao("secundario", "sm", "self-start")}>
                  {trocando ? "Trocando…" : `Usar ${o.valor === "web" ? "o WhatsApp Web" : "a API oficial"}`}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TesteMeta() {
  const [testando, setTestando] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  return (
    <div className="space-y-3">
      <button type="button" disabled={testando} className={botao("secundario", "sm")}
        onClick={async () => { setTestando(true); setAviso(await testarMeta()); setTestando(false); }}>
        {testando ? "Testando…" : "Testar a ligação com a Meta"}
      </button>
      {aviso && <Aviso tom={aviso.ok ? "sucesso" : "erro"}>{aviso.texto}</Aviso>}
    </div>
  );
}
