"use client";

import { blocosDaLinha, semPontuacaoFinal } from "@/lib/marcacao-chat";

/* Usado no chat do site e na área de teste do painel: a Cecília vê a
   resposta exatamente como o hóspede veria, com foto e vídeo. */

/* ── o pouco de markdown que a Marina usa ───────────────────────────
   Ela escreve **negrito**, links e imagens. Sem isto a pessoa lê
   "**Suite Lua de Mel**" com os asteriscos e o endereco aparece como
   texto solto, que ninguem clica.

   E um analisador minusculo de proposito: uma biblioteca de markdown
   inteira num widget de chat traz tabela, HTML embutido e um vetor de
   injecao que nao precisamos. Aqui nada vira HTML — tudo vira elemento
   React, e so `https://` passa.

   O que é foto, vídeo ou texto em cada linha é decidido em
   `src/lib/marcacao-chat.ts` (com teste): a foto aparece mesmo quando a
   Marina põe marcador de lista, legenda na mesma linha ou o endereço solto,
   e o endereço técnico da Vercel vira o oficial antes de ir para a tela. */
export function Marcacao({ texto }: { texto: string }) {
  return (
    <>
      {texto.split("\n").map((linha, i) => {
        const blocos = blocosDaLinha(linha);
        return blocos.map((b, j) => {
          const chave = `${i}-${j}`;
          if (b.tipo === "video") {
            /* Só do nosso armazenamento: um player aberto para qualquer site
               seria convite a abuso (quem decide é `ehVideoNosso`). */
            return (
              <video key={chave} src={b.url} controls playsInline preload="metadata" aria-label={b.alt || "Vídeo da pousada"}
                className="block w-full max-w-[18rem] rounded-marca my-1.5 border border-linha bg-black" />
            );
          }
          if (b.tipo === "imagem") {
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={chave}
                src={b.url}
                alt={b.alt || "Foto da pousada"}
                loading="lazy"
                className="block w-full max-w-[16rem] rounded-marca my-1.5 border border-linha"
              />
            );
          }
          /* "### Título" vira negrito: os jogos-da-velha não dizem nada ao hóspede. */
          const titulo = b.texto.match(/^\s{0,3}#{1,6}\s+(.+)$/);
          if (titulo) {
            return <strong key={chave} className="block font-semibold">{pedacos(titulo[1].replace(/\*\*/g, ""))}</strong>;
          }
          return (
            <span key={chave} className="block min-h-[1px]">{pedacos(b.texto)}</span>
          );
        });
      })}
    </>
  );
}

/** Quebra uma linha em negrito, links e texto comum. */
function pedacos(linha: string): React.ReactNode[] {
  const saida: React.ReactNode[] = [];
  const padrao = /\*\*([^*]+)\*\*|\[([^\]]+)\]\((https:\/\/[^\s)]+)\)|(https:\/\/[^\s<>"]+)/g;
  let ultimo = 0;
  let m: RegExpExecArray | null;
  let n = 0;

  while ((m = padrao.exec(linha)) !== null) {
    if (m.index > ultimo) saida.push(linha.slice(ultimo, m.index));
    if (m[1] !== undefined) {
      saida.push(<strong key={n++} className="font-semibold">{m[1]}</strong>);
      ultimo = m.index + m[0].length;
      continue;
    }
    /* Endereço solto: o ponto final da frase não faz parte do link
       ("…/quartos/suite-queen." abria uma página que não existe). */
    const solto = m[4] !== undefined ? semPontuacaoFinal(m[4]) : null;
    const texto = m[2] ?? solto!.url;
    const href = m[3] ?? solto!.url;
    saida.push(
      <a key={n++} href={href} target="_blank" rel="noopener noreferrer"
        className="underline decoration-current/40 underline-offset-2 break-all hover:decoration-current">
        {texto}
      </a>,
    );
    if (solto?.resto) saida.push(solto.resto);
    ultimo = m.index + m[0].length;
  }
  if (ultimo < linha.length) saida.push(linha.slice(ultimo));
  return saida;
}
