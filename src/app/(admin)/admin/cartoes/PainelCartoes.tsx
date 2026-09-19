"use client";

import { useState } from "react";
import { UploadImagem } from "@/components/admin/UploadImagem";
import { IconeCirculo, ICONES, CORES } from "@/components/site/Icone";
import { salvarCartao, alternarCartao, moverCartao, excluirCartao } from "./actions";

export type Cartao = {
  id: string;
  bloco_id: string;
  icone: string | null;
  cor: string;
  titulo: string;
  texto: string | null;
  imagem_url: string | null;
  imagem_pathname: string | null;
  href: string | null;
  cta_texto: string | null;
  ordem: number;
  ativo: boolean;
};

export type Secao = { id: string; tipo: string; nome: string; formato: string };

export function PainelCartoes({ secoes, cartoes, blobOk }: {
  secoes: Secao[]; cartoes: Cartao[]; blobOk: boolean;
}) {
  const [editando, setEditando] = useState<{ cartao: Cartao | null; secao: Secao } | null>(null);

  if (editando) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-5 sm:p-6">
        <h2 className="font-semibold text-gray-900">
          {editando.cartao ? "Editar cartão" : "Novo cartão"}
        </h2>
        <p className="text-xs text-gray-400 mb-5">em {editando.secao.nome}</p>
        <FormCartao cartao={editando.cartao} secao={editando.secao} blobOk={blobOk}
          aoFechar={() => setEditando(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {secoes.map((secao) => {
        const doBloco = cartoes.filter((c) => c.bloco_id === secao.id);
        return (
          <section key={secao.id}>
            <div className="flex flex-wrap items-baseline justify-between gap-3 mb-1">
              <h2 className="font-semibold text-gray-900">{secao.nome}</h2>
              <button onClick={() => setEditando({ cartao: null, secao })}
                className="text-sm font-medium text-gray-900 border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50">
                Novo cartão
              </button>
            </div>
            <p className="text-[11px] text-gray-400 mb-3 leading-relaxed max-w-2xl">{secao.formato}</p>

            {doBloco.length === 0 ? (
              <p className="text-sm text-gray-500 border border-dashed border-gray-300 rounded-xl p-5">
                Nenhum cartão cadastrado — a seção mostra o conteúdo padrão do
                site. O primeiro cartão criado <strong>substitui</strong> todos os
                padrões desta seção.
              </p>
            ) : (
              <ul className="space-y-2">
                {doBloco.map((c, i) => (
                  <li key={c.id}
                    className="bg-white border border-gray-200 rounded-xl p-3 flex flex-col sm:flex-row gap-3 sm:items-center">
                    {c.imagem_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.imagem_url} alt="" className="w-full sm:w-24 h-20 sm:h-16 object-cover rounded-lg shrink-0" />
                    ) : (
                      <span className="shrink-0"><IconeCirculo nome={c.icone || "check"} cor={c.cor} tamanho={44} /></span>
                    )}

                    <div className="flex-1 min-w-0">
                      <p className={`font-medium truncate ${c.ativo ? "text-gray-900" : "text-gray-400 line-through"}`}>
                        {c.titulo}
                      </p>
                      {c.texto && <p className="text-xs text-gray-500 line-clamp-2 leading-snug">{c.texto}</p>}
                      {c.href && <p className="text-[11px] text-gray-400 mt-0.5 truncate">→ {c.href}</p>}
                    </div>

                    <div className="flex gap-1.5 shrink-0">
                      <Acao acao={moverCartao} id={c.id} extra={{ direcao: "cima" }} desabilitado={i === 0}>↑</Acao>
                      <Acao acao={moverCartao} id={c.id} extra={{ direcao: "baixo" }} desabilitado={i === doBloco.length - 1}>↓</Acao>
                      <Acao acao={alternarCartao} id={c.id}>{c.ativo ? "Desligar" : "Ligar"}</Acao>
                      <button onClick={() => setEditando({ cartao: c, secao })}
                        className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
                        Editar
                      </button>
                      <Acao acao={excluirCartao} id={c.id} perigo confirmar="Excluir este cartão?">Excluir</Acao>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

function FormCartao({ cartao, secao, blobOk, aoFechar }: {
  cartao: Cartao | null; secao: Secao; blobOk: boolean; aoFechar: () => void;
}) {
  const [icone, setIcone] = useState(cartao?.icone ?? "check");
  const [cor, setCor] = useState(cartao?.cor ?? "marca");
  const [imagem, setImagem] = useState(cartao?.imagem_url ?? "");
  const [pathname, setPathname] = useState(cartao?.imagem_pathname ?? "");

  // Só "complexo" desenha foto e link; oferecer isso em "diferenciais"
  // seria prometer uma edição que o site ignora.
  const temFoto = secao.tipo === "complexo";

  return (
    <form action={salvarCartao} className="space-y-5">
      {cartao && <input type="hidden" name="id" value={cartao.id} />}
      <input type="hidden" name="bloco_id" value={secao.id} />
      <input type="hidden" name="icone" value={icone} />
      <input type="hidden" name="cor" value={cor} />
      <input type="hidden" name="imagem_url" value={imagem} />
      <input type="hidden" name="imagem_pathname" value={pathname} />

      <div className="flex items-center gap-4 bg-gray-50 border border-gray-200 rounded-lg p-3">
        <IconeCirculo nome={icone} cor={cor} tamanho={52} />
        <p className="text-xs text-gray-500 leading-relaxed">
          É assim que o ícone aparece no site. Escolha abaixo o desenho e a cor.
        </p>
      </div>

      <div>
        <p className="text-xs font-medium text-gray-600 mb-2">Ícone</p>
        <div className="grid grid-cols-7 sm:grid-cols-10 gap-1.5">
          {ICONES.map((n) => (
            <button key={n} type="button" onClick={() => setIcone(n)} title={n} aria-label={n}
              className={`flex items-center justify-center p-1.5 rounded-lg border-2 transition-all ${
                icone === n ? "border-gray-900 bg-gray-50" : "border-transparent hover:border-gray-200"
              }`}>
              <IconeCirculo nome={n} cor={cor} tamanho={30} />
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-gray-600 mb-2">Cor</p>
        <div className="flex flex-wrap gap-1.5">
          {CORES.map((c) => (
            <button key={c} type="button" onClick={() => setCor(c)} title={c} aria-label={c}
              className={`p-1 rounded-lg border-2 transition-all ${
                cor === c ? "border-gray-900" : "border-transparent hover:border-gray-200"
              }`}>
              <IconeCirculo nome={icone} cor={c} tamanho={32} />
            </button>
          ))}
        </div>
      </div>

      <Campo rotulo="Título" nome="titulo" padrao={cartao?.titulo ?? ""} placeholder="Ex.: Café da manhã incluso" />
      <Campo rotulo="Texto" nome="texto" padrao={cartao?.texto ?? ""} textarea
        placeholder="Uma ou duas linhas explicando" />

      {temFoto && (
        <>
          <UploadImagem rotulo="Foto do cartão" valor={imagem} pasta="galeria" configurado={blobOk}
            previewClasse="h-28"
            ajuda="Opcional. Com foto, o ícone monta na junção entre a imagem e o texto."
            aoEnviar={(url, path) => { setImagem(url); if (path) setPathname(path); }} />
          <div className="grid sm:grid-cols-2 gap-4">
            <Campo rotulo="Texto do link" nome="cta_texto" padrao={cartao?.cta_texto ?? ""}
              placeholder="Conheça o restaurante" />
            <Campo rotulo="Link" nome="href" padrao={cartao?.href ?? ""} placeholder="/restaurante" />
          </div>
        </>
      )}

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" name="ativo" defaultChecked={cartao?.ativo ?? true} className="w-4 h-4 accent-gray-900" />
        Ativo
      </label>

      <div className="flex gap-2">
        <button type="submit" className="bg-gray-900 text-white px-5 py-2.5 rounded-lg text-sm font-medium">
          {cartao ? "Salvar alterações" : "Criar cartão"}
        </button>
        <button type="button" onClick={aoFechar}
          className="px-5 py-2.5 rounded-lg text-sm text-gray-600 border border-gray-200">
          Cancelar
        </button>
      </div>
    </form>
  );
}

function Campo({ rotulo, nome, padrao, placeholder, textarea }: {
  rotulo: string; nome: string; padrao: string; placeholder?: string; textarea?: boolean;
}) {
  const Tag: any = textarea ? "textarea" : "input";
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1.5">{rotulo}</label>
      <Tag name={nome} defaultValue={padrao} placeholder={placeholder} rows={textarea ? 2 : undefined}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400" />
    </div>
  );
}

function Acao({ acao, id, extra, children, perigo, confirmar, desabilitado }: {
  acao: (fd: FormData) => Promise<void>;
  id: string; extra?: Record<string, string>; children: React.ReactNode;
  perigo?: boolean; confirmar?: string; desabilitado?: boolean;
}) {
  return (
    <form action={acao} onSubmit={(e) => { if (confirmar && !confirm(confirmar)) e.preventDefault(); }}>
      <input type="hidden" name="id" value={id} />
      {extra && Object.entries(extra).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <button type="submit" disabled={desabilitado}
        className={`px-2.5 py-1.5 text-xs border rounded-lg disabled:opacity-30 ${
          perigo ? "border-red-200 text-red-600 hover:bg-red-50" : "border-gray-200 text-gray-600 hover:bg-gray-50"
        }`}>
        {children}
      </button>
    </form>
  );
}
