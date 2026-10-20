"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Aviso, botao, campo } from "@/components/admin/ui";
import { pedirQr, aguardarLeitura, desconectar } from "./actions";

/**
 * Conectar pelo QR e desconectar. O QR do WhatsApp troca a cada ~20 s e a
 * sessão de login vale 3 min (login-qr.ts do OpenClaw): a tela pergunta em
 * laço ao servidor, que responde quando o QR muda, quando o celular leu ou
 * depois de 20 s sem novidade.
 */

type Estado =
  | { tipo: "parado" }
  | { tipo: "gerando" }
  | { tipo: "qr"; qr: string; sessao: string | null }
  | { tipo: "conectado"; texto: string }
  | { tipo: "erro"; texto: string };

const VALIDADE_MS = 3 * 60_000;

export function ConexaoWhatsapp({ conectado }: { conectado: boolean | null }) {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>({ tipo: "parado" });
  const [confirmacao, setConfirmacao] = useState("");
  const [desligando, setDesligando] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  /* Cancela o laço ao sair da tela ou ao apertar Cancelar. */
  const vez = useRef(0);
  useEffect(() => () => { vez.current++; }, []);

  async function conectar() {
    const minha = ++vez.current;
    setAviso(null);
    setEstado({ tipo: "gerando" });
    const r = await pedirQr();
    if (minha !== vez.current) return;
    if (r.fase === "conectado") { setEstado({ tipo: "conectado", texto: r.texto }); router.refresh(); return; }
    if (r.fase !== "qr" || !r.qr) { setEstado({ tipo: "erro", texto: r.texto }); return; }

    let qr = r.qr, sessao = r.sessao ?? null;
    setEstado({ tipo: "qr", qr, sessao });
    const fim = Date.now() + VALIDADE_MS;
    while (minha === vez.current && Date.now() < fim) {
      const w = await aguardarLeitura(sessao, qr);
      if (minha !== vez.current) return;
      if (w.fase === "conectado") { setEstado({ tipo: "conectado", texto: w.texto }); router.refresh(); return; }
      if (w.fase === "qr" && w.qr) { qr = w.qr; sessao = w.sessao ?? sessao; setEstado({ tipo: "qr", qr, sessao }); continue; }
      if (w.fase === "esperando") continue;
      setEstado({ tipo: "erro", texto: w.texto });
      return;
    }
    if (minha === vez.current) setEstado({ tipo: "erro", texto: "O QR venceu. Gere outro." });
  }

  function cancelar() {
    vez.current++;
    setEstado({ tipo: "parado" });
  }

  async function confirmarDesconexao() {
    setDesligando(true);
    const r = await desconectar(confirmacao);
    setDesligando(false);
    setAviso(r);
    if (r.ok) { setConfirmacao(""); router.refresh(); }
  }

  if (estado.tipo === "conectado") {
    return <Aviso tom="sucesso" titulo={estado.texto}>Mande um “oi” de outro celular para o número da pousada: ela deve responder em até 1 minuto.</Aviso>;
  }

  return (
    <div className="space-y-5">
      {aviso && <Aviso tom={aviso.ok ? "sucesso" : "erro"}>{aviso.texto}</Aviso>}

      {conectado !== true && (
        <div className="space-y-4">
          <Aviso tom="info" className="sm:hidden" titulo="Abra esta tela no computador">
            O celular da pousada precisa ler o QR, e um celular não lê o QR da própria tela.
          </Aviso>

          {estado.tipo === "qr" ? (
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              {/* eslint-disable-next-line @next/next/no-img-element -- QR em data URL, gerado na hora pelo servidor da Marina */}
              <img src={estado.qr} alt="QR para conectar a Marina ao WhatsApp da pousada"
                className="h-64 w-64 shrink-0 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5" />
              <div className="min-w-0 space-y-3 text-sm text-tinta leading-relaxed">
                <ol className="list-decimal pl-5 space-y-1.5">
                  <li>Pegue o <strong>celular da pousada</strong>.</li>
                  <li>Abra o WhatsApp → <strong>Configurações</strong> (ou ⋮) → <strong>Aparelhos conectados</strong>.</li>
                  <li>Toque em <strong>Conectar um aparelho</strong> e aponte a câmera para este QR.</li>
                </ol>
                <p className="text-xs text-tinta-suave" aria-live="polite">O QR se atualiza sozinho. Esperando a leitura…</p>
                <button type="button" onClick={cancelar} className={botao("fantasma", "sm")}>Cancelar</button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {estado.tipo === "erro" && <Aviso tom="erro">{estado.texto}</Aviso>}
              <button type="button" onClick={conectar} disabled={estado.tipo === "gerando"} className={botao("primario", "lg")}>
                {estado.tipo === "gerando" ? "Gerando o QR…" : estado.tipo === "erro" ? "Gerar outro QR" : "Conectar a Marina"}
              </button>
              <p className="text-xs text-tinta-suave">Leva uns 10 segundos para o QR aparecer.</p>
            </div>
          )}
        </div>
      )}

      {conectado === true && (
        <details className="rounded-2xl border border-red-200 bg-red-50/60 px-4 py-3">
          <summary className="cursor-pointer text-sm font-semibold text-red-900 min-h-8 flex items-center">Desconectar a Marina do WhatsApp</summary>
          <div className="mt-3 space-y-3 text-sm text-red-950">
            <p>Os clientes deixam de receber resposta automática até alguém conectar de novo. Use só para trocar de celular ou de número.</p>
            <label className="block">
              <span className="block text-xs font-medium">Escreva DESCONECTAR para confirmar</span>
              <input value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} className={campo + " mt-1.5 max-w-xs"} autoComplete="off" />
            </label>
            <button type="button" onClick={confirmarDesconexao} disabled={desligando || confirmacao.trim().toUpperCase() !== "DESCONECTAR"} className={botao("perigo", "md")}>
              {desligando ? "Desconectando…" : "Desconectar"}
            </button>
          </div>
        </details>
      )}
    </div>
  );
}
