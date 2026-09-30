"use client";

/* Usado no chat do site e na área de teste do painel: a Cecília vê a
   resposta exatamente como o hóspede veria, com foto e vídeo. */

const ehVideoNosso = (url: string) =>
  /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/\S+\.(mp4|webm|mov|m4v)(\?\S*)?$/i.test(url);

/* ── o pouco de markdown que a Marina usa ───────────────────────────
   Ela escreve **negrito**, links e imagens. Sem isto a pessoa lê
   "**Suite Lua de Mel**" com os asteriscos e o endereco aparece como
   texto solto, que ninguem clica.

   E um analisador minusculo de proposito: uma biblioteca de markdown
   inteira num widget de chat traz tabela, HTML embutido e um vetor de
   injecao que nao precisamos. Aqui nada vira HTML — tudo vira elemento
   React, e so `https://` passa. */
export function Marcacao({ texto }: { texto: string }) {
  return (
    <>
      {texto.split("\n").map((linha, i) => {
        const imagem = linha.trim().match(/^!\[([^\]]*)\]\((https:\/\/[^\s)]+)\)$/);
        /* Vídeo: a mesma sintaxe de imagem, com arquivo .mp4/.webm/.mov —
           ou o endereço sozinho na linha. Só do nosso armazenamento: um
           player aberto para qualquer site seria convite a abuso. */
        const video = (imagem && ehVideoNosso(imagem[2]) && { alt: imagem[1], url: imagem[2] })
          || (ehVideoNosso(linha.trim()) && { alt: "", url: linha.trim() });
        if (video) {
          return (
            <video key={i} src={video.url} controls playsInline preload="metadata" aria-label={video.alt || "Vídeo da pousada"}
              className="block w-full max-w-[18rem] rounded-marca my-1.5 border border-linha bg-black" />
          );
        }
        if (imagem) {
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={imagem[2]}
              alt={imagem[1] || "Foto da pousada"}
              loading="lazy"
              className="block w-full max-w-[16rem] rounded-marca my-1.5 border border-linha"
            />
          );
        }
        return (
          <span key={i} className="block min-h-[1px]">{pedacos(linha)}</span>
        );
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
    } else {
      const texto = m[2] ?? m[4];
      const href = m[3] ?? m[4];
      saida.push(
        <a key={n++} href={href} target="_blank" rel="noopener noreferrer"
          className="underline decoration-current/40 underline-offset-2 break-all hover:decoration-current">
          {texto}
        </a>,
      );
    }
    ultimo = m.index + m[0].length;
  }
  if (ultimo < linha.length) saida.push(linha.slice(ultimo));
  return saida;
}
