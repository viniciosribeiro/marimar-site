"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { FileText, Image as ImageIcon, RefreshCw, Trash2, UploadCloud, Power } from "lucide-react";
import { CATEGORIAS } from "@/lib/marina-base";
import { Aviso, botao, campo, cn, Selo, Vazio, quandoFoi } from "@/components/admin/ui";
import { avisar, Girando, useConfirmar } from "@/components/admin/ui-cliente";
import type { DocumentoPainel } from "./tipos";

const TIPOS_ACEITOS = ".pdf,.docx,.txt,.md,.csv,.jpg,.jpeg,.png,.webp";

const tamanho = (b: number) => (b > 1_000_000 ? `${(b / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1000))} KB`);

/**
 * Ensinar por arquivo.
 *
 * O arquivo vai direto do navegador para o armazenamento (uma função da
 * Vercel recusa corpo acima de ~4,5 MB). O servidor tira o texto, divide em
 * trechos para a busca e sugere o assunto. A Marina vê o começo de cada
 * documento em toda conversa e procura dentro deles quando a pergunta pede.
 */
export function AbaDocumentos({ documentos }: { documentos: DocumentoPainel[] }) {
  const router = useRouter();
  const [enviando, setEnviando] = useState<string | null>(null);
  const [assunto, setAssunto] = useState("");
  const [categoria, setCategoria] = useState("");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const { confirmar, dialogo } = useConfirmar();

  async function enviar(arquivo: File) {
    setEnviando(arquivo.name);
    try {
      const enviado = await upload(`marina/${arquivo.name}`, arquivo, { access: "public", handleUploadUrl: "/api/admin/upload" });
      const r = await fetch("/api/admin/marina/documento", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url: enviado.url, pathname: enviado.pathname, nome: arquivo.name, tipo: arquivo.type,
          bytes: arquivo.size, assunto: assunto.trim() || null, categoria: categoria || null,
        }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) avisar(d?.erro ?? "Não consegui ler este arquivo.", "erro");
      else avisar(`Pronto! ${d.caracteres.toLocaleString("pt-BR")} caracteres lidos, em ${d.trechos} trechos pesquisáveis.`);
      setAssunto("");
      router.refresh();
    } catch (e) {
      avisar((e as Error).message || "Falha ao enviar o arquivo.", "erro");
    } finally {
      setEnviando(null);
    }
  }

  async function chamar(metodo: "PUT" | "PATCH" | "DELETE", id: string, corpo?: object, msg?: string) {
    setOcupado(id);
    try {
      const r = await fetch(`/api/admin/marina/documento${metodo === "PATCH" ? "" : `?id=${id}`}`, {
        method: metodo, headers: { "content-type": "application/json" },
        body: corpo ? JSON.stringify({ id, ...corpo }) : undefined,
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) avisar(d?.erro ?? "Não deu certo.", "erro");
      else if (msg) avisar(msg);
      router.refresh();
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
      <section className="space-y-4">
        <div className="rounded-2xl border border-linha/80 bg-white p-5 shadow-sm">
          <p className="font-semibold text-tinta">Enviar documento</p>
          <p className="mt-1 text-xs leading-relaxed text-tinta-suave">
            PDF, Word, texto, planilha CSV ou foto (aviso, cardápio impresso). A Marina lê o conteúdo e passa a usar.
          </p>
          <div className="mt-4 space-y-3">
            <input value={assunto} onChange={(e) => setAssunto(e.target.value)} placeholder="Nome (opcional) — ex.: Regras da casa 2026" className={campo} />
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={campo} aria-label="Assunto">
              <option value="">Assunto: descobrir pelo conteúdo</option>
              {CATEGORIAS.map((c) => <option key={c.id} value={c.id}>{c.rotulo}</option>)}
            </select>
            <label
              onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
              onDragLeave={() => setArrastando(false)}
              onDrop={(e) => { e.preventDefault(); setArrastando(false); const f = e.dataTransfer.files?.[0]; if (f) enviar(f); }}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center text-sm transition-colors",
                enviando ? "border-linha text-tinta-suave" : arrastando ? "border-marca bg-marca-sutil text-marca" : "border-linha text-tinta-suave hover:border-marca hover:bg-marca-sutil",
              )}>
              <input type="file" accept={TIPOS_ACEITOS} className="sr-only" disabled={!!enviando}
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) enviar(f); }} />
              {enviando ? <><Girando className="h-6 w-6" /><span>Lendo “{enviando}”…</span></>
                : <><UploadCloud className="h-7 w-7" /><span><strong className="text-tinta">Escolha um arquivo</strong> ou arraste aqui</span></>}
            </label>
          </div>
        </div>
        <Aviso tom="info">
          A Marina vê o começo de cada documento em toda conversa e <strong>procura dentro deles</strong> quando a pergunta pede.
          Documento desligado fica guardado, mas ela não usa.
        </Aviso>
      </section>

      <section>
        {documentos.length === 0 ? (
          <Vazio icone="📄" titulo="Nenhum documento ainda">Regras da casa, contrato de hospedagem, cardápio: tudo que ela deve saber e já está escrito.</Vazio>
        ) : (
          <ul className="space-y-3">
            {documentos.map((d) => {
              const imagem = d.tipo.startsWith("image/");
              const Icone = imagem ? ImageIcon : FileText;
              const trabalhando = ocupado === d.id;
              return (
                <li key={d.id} className={cn("rounded-2xl border bg-white p-4 shadow-sm", d.status === "falhou" ? "border-red-200" : "border-linha/80", !d.ativo && "opacity-70")}>
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-areia text-tinta-suave"><Icone className="h-5 w-5" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate font-semibold text-tinta">{d.assunto ?? d.nome}</p>
                        {d.status === "pronto" && <Selo tom={d.ativo ? "sucesso" : "neutro"} ponto>{d.ativo ? "Em uso" : "Desligado"}</Selo>}
                        {d.status === "falhou" && <Selo tom="erro" ponto>Não consegui ler</Selo>}
                        {d.status === "lendo" && <Selo tom="info" ponto>Lendo…</Selo>}
                      </div>
                      <p className="mt-0.5 text-[11px] text-tinta-suave">
                        {d.nome} · {tamanho(d.bytes)} · enviado {quandoFoi(d.criado_em)}
                        {d.status === "pronto" && ` · ${d.caracteres.toLocaleString("pt-BR")} caracteres`}
                      </p>
                      {d.status === "falhou" && d.erro && <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-900">{d.erro}</p>}
                      {d.trecho && d.status === "pronto" && <p className="mt-2 line-clamp-2 text-xs text-tinta-suave">{d.trecho}</p>}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-linha/60 pt-3">
                    <select value={d.categoria} onChange={(e) => chamar("PATCH", d.id, { categoria: e.target.value }, "Assunto atualizado.")}
                      className={campo + " w-auto min-h-9 py-1.5 text-xs"} aria-label="Assunto" disabled={trabalhando}>
                      {CATEGORIAS.map((c) => <option key={c.id} value={c.id}>{c.rotulo}</option>)}
                    </select>
                    <div className="ml-auto flex flex-wrap gap-1">
                      <button onClick={() => chamar("PUT", d.id, undefined, "Documento lido de novo.")} disabled={trabalhando} className={botao("fantasma", "sm")}
                        title="Ler o arquivo de novo">
                        {trabalhando ? <Girando className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />} {d.status === "falhou" ? "Tentar de novo" : "Reprocessar"}
                      </button>
                      {d.status === "pronto" && (
                        <button onClick={() => chamar("PATCH", d.id, { ativo: !d.ativo }, d.ativo ? "Desligado. A Marina para de usar." : "Ligado. A Marina volta a usar.")}
                          disabled={trabalhando} className={botao("fantasma", "sm")}>
                          <Power className="h-3.5 w-3.5" /> {d.ativo ? "Desligar" : "Ligar"}
                        </button>
                      )}
                      <button disabled={trabalhando} className={botao("fantasma", "sm", "text-red-700 hover:bg-red-50")}
                        onClick={async () => {
                          if (await confirmar({ titulo: "Apagar este documento?", texto: "O arquivo e o texto lido são apagados. A Marina deixa de saber o que estava nele.", confirmar: "Apagar", perigo: true }))
                            chamar("DELETE", d.id, undefined, "Documento apagado.");
                        }}>
                        <Trash2 className="h-3.5 w-3.5" /> Apagar
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      {dialogo}
    </div>
  );
}
