"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Aviso, botao, campo } from "@/components/admin/ui";
import type { EstadoConexao } from "@/lib/whatsapp-saude";
import { pedirQr, aguardarLeitura, desconectar, conferirConexao, destravarConexao } from "./actions";

/**
 * Conectar pelo QR, destravar e desconectar.
 *
 * O QR do WhatsApp troca a cada ~20 s e a sessão de login vale 3 min
 * (login-qr.ts do OpenClaw): a tela pergunta em laço ao servidor.
 *
 * Ler o QR NÃO basta: em 21/10 o celular leu, a tela disse "Conectada" e o
 * canal ficou travado no servidor até um reinício. Por isso, depois da
 * leitura a tela confere a conexão de verdade; se não abrir, destrava
 * (para e liga o canal) e confere de novo. Só então diz "Conectada".
 */

type Estado =
  | { tipo: "parado" }
  | { tipo: "gerando" }
  | { tipo: "qr"; qr: string; sessao: string | null }
  | { tipo: "conferindo"; texto: string }
  | { tipo: "conectado"; numero: string | null }
  | { tipo: "erro"; texto: string };

const VALIDADE_MS = 3 * 60_000;
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function ConexaoWhatsapp({ conectado, estadoAtual }: { conectado: boolean | null; estadoAtual: EstadoConexao | null }) {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>({ tipo: "parado" });
  const [confirmacao, setConfirmacao] = useState("");
  const [desligando, setDesligando] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  /* Cancela os laços ao sair da tela ou ao apertar Cancelar. */
  const vez = useRef(0);
  useEffect(() => () => { vez.current++; }, []);

  /** Pergunta ao servidor até a conexão abrir ou o prazo acabar. */
  async function aguardarConexao(minha: number, prazoMs: number): Promise<string | null | false> {
    const fim = Date.now() + prazoMs;
    while (minha === vez.current && Date.now() < fim) {
      const c = await conferirConexao();
      if (c.estado === "conectado") return c.numero;
      await esperar(3000);
    }
    return false;
  }

  /** Depois do QR (ou do botão Destravar): confere, destrava se preciso, confere de novo. */
  async function garantirConexao(minha: number, jaDestravou = false) {
    setEstado({ tipo: "conferindo", texto: "O celular leu o QR. Conferindo se a Marina abriu a conexão no servidor…" });
    if (!jaDestravou) {
      const numero = await aguardarConexao(minha, 45_000);
      if (minha !== vez.current) return;
      if (numero !== false) { setEstado({ tipo: "conectado", numero }); router.refresh(); return; }
      setEstado({ tipo: "conferindo", texto: "A conexão travou no servidor (como em 21/10). Destravando sozinha…" });
      const d = await destravarConexao();
      if (minha !== vez.current) return;
      if (!d.ok) { setEstado({ tipo: "erro", texto: d.texto }); return; }
    }
    setEstado({ tipo: "conferindo", texto: "Destravado. Esperando a conexão abrir (até 1 minuto e meio)…" });
    const numero = await aguardarConexao(minha, 90_000);
    if (minha !== vez.current) return;
    if (numero !== false) { setEstado({ tipo: "conectado", numero }); router.refresh(); return; }
    setEstado({
      tipo: "erro",
      texto: "O celular está ligado à Marina, mas o servidor não abriu a conexão. No terminal da Hostinger rode “openclaw gateway restart”, espere 2 minutos e recarregue esta tela. O QR já lido continua valendo.",
    });
  }

  async function conectar() {
    const minha = ++vez.current;
    setAviso(null);
    setEstado({ tipo: "gerando" });
    const r = await pedirQr();
    if (minha !== vez.current) return;
    if (r.fase === "conectado") { await garantirConexao(minha); return; }
    if (r.fase !== "qr" || !r.qr) { setEstado({ tipo: "erro", texto: r.texto }); return; }

    let qr = r.qr, sessao = r.sessao ?? null;
    setEstado({ tipo: "qr", qr, sessao });
    const fim = Date.now() + VALIDADE_MS;
    while (minha === vez.current && Date.now() < fim) {
      const w = await aguardarLeitura(sessao, qr);
      if (minha !== vez.current) return;
      if (w.fase === "conectado") { await garantirConexao(minha); return; }
      if (w.fase === "qr" && w.qr) { qr = w.qr; sessao = w.sessao ?? sessao; setEstado({ tipo: "qr", qr, sessao }); continue; }
      if (w.fase === "esperando") continue;
      setEstado({ tipo: "erro", texto: w.texto });
      return;
    }
    if (minha === vez.current) setEstado({ tipo: "erro", texto: "O QR venceu. Gere outro." });
  }

  async function destravar() {
    const minha = ++vez.current;
    setAviso(null);
    setEstado({ tipo: "conferindo", texto: "Destravando a conexão no servidor…" });
    const d = await destravarConexao();
    if (minha !== vez.current) return;
    if (!d.ok) { setEstado({ tipo: "erro", texto: d.texto }); return; }
    await garantirConexao(minha, true);
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
    return (
      <Aviso tom="sucesso" titulo="Conectada! A Marina já está atendendo no WhatsApp.">
        {estado.numero ? `Número ligado: +${estado.numero}. ` : ""}Mande um “oi” de outro celular para esse número: ela deve responder em até 1 minuto.
      </Aviso>
    );
  }

  if (estado.tipo === "conferindo") {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900" role="status" aria-live="polite">
        <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-sky-300 border-t-sky-700" aria-hidden />
        {estado.texto}
      </div>
    );
  }

  const ligadoSemConexao = estadoAtual === "travado" || estadoAtual === "parado" || estadoAtual === "reconectando";

  return (
    <div className="space-y-5">
      {aviso && <Aviso tom={aviso.ok ? "sucesso" : "erro"}>{aviso.texto}</Aviso>}

      {conectado !== true && ligadoSemConexao && estado.tipo !== "qr" && (
        <div className="space-y-3">
          {estado.tipo === "erro" && <Aviso tom="erro">{estado.texto}</Aviso>}
          <p className="text-sm text-tinta leading-relaxed">
            O celular continua ligado à Marina; só a conexão no servidor travou. <strong>Não precisa de QR novo</strong>: destravar resolve na maioria das vezes.
          </p>
          <button type="button" onClick={destravar} className={botao("primario", "lg")}>Destravar a conexão</button>
        </div>
      )}

      {conectado !== true && !ligadoSemConexao && (
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
                  <li>Pegue o <strong>celular que vai ser a Marina</strong>.</li>
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

      {(conectado === true || ligadoSemConexao) && (
        <details className="rounded-2xl border border-red-200 bg-red-50/60 px-4 py-3">
          <summary className="cursor-pointer text-sm font-semibold text-red-900 min-h-8 flex items-center">Desconectar a Marina do WhatsApp (trocar de celular ou de número)</summary>
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
