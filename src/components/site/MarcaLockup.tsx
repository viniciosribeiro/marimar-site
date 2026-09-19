/**
 * O conjunto logo + nome.
 *
 * Um componente só, usado no topo, no rodapé, na gaveta do celular e na
 * prévia do editor. Antes cada lugar montava o seu: a imagem tinha uma
 * altura aqui e outra ali, e o nome só existia "ao lado", sempre com a
 * mesma distância — que era grande demais para uma logo e pequena para
 * outra.
 *
 * Tudo que muda vem de variável CSS (`--marca-direcao`, `--marca-espaco`,
 * `--marca-nome-*`), definida pelo tema. Por isso a posição do nome não
 * mexe no HTML: a ordem continua imagem → texto, que é a ordem em que um
 * leitor de tela precisa ouvir, esteja o texto acima, abaixo ou dos lados.
 */
export function MarcaLockup({
  nome, logoUrl, mostrarNome, texto, subtexto,
  altura, escuro = false, className = "",
}: {
  /** Nome da pousada — usado como alternativo e quando não há texto próprio. */
  nome: string;
  logoUrl?: string | null;
  mostrarNome: boolean;
  /** Texto próprio; vazio cai no nome da pousada. */
  texto?: string | null;
  subtexto?: string | null;
  /** Altura da imagem. Uma variável CSS, para responder ao editor. */
  altura: string;
  /** Sobre fundo escuro (rodapé). */
  escuro?: boolean;
  className?: string;
}) {
  const rotulo = (texto || "").trim() || nome;
  const semImagem = !logoUrl;

  return (
    <span className={`flex min-w-0 ${className}`}
      style={{
        flexDirection: "var(--marca-direcao)" as any,
        alignItems: "var(--marca-alinhar)" as any,
        gap: "var(--marca-espaco)",
      }}>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" aria-hidden className="w-auto shrink-0 transition-marca"
          style={{ height: altura }} />
      ) : (
        <span className="text-2xl shrink-0" aria-hidden>🏝️</span>
      )}

      {/* Sem imagem o nome aparece de qualquer jeito: um cabeçalho sem marca
          nenhuma não é uma opção que valha a pena oferecer. */}
      {(mostrarNome || semImagem) && (
        <span className="min-w-0 leading-tight">
          <span
            className={`block font-titulo truncate ${escuro ? "text-white" : "text-tinta"}`}
            style={{
              fontSize: "var(--marca-nome-tam)",
              fontWeight: "var(--marca-nome-peso)" as any,
              letterSpacing: "var(--marca-nome-rastreio)",
              textTransform: "var(--marca-nome-caixa)" as any,
            }}
          >
            {rotulo}
          </span>
          {subtexto && (
            <span
              className={`block truncate ${escuro ? "text-white/70" : "text-tinta-suave"}`}
              style={{
                // Derivado do tamanho do nome, não um segundo controle: a
                // segunda linha é sempre menor e mais espaçada que a primeira,
                // e dois campos para isso só dariam chance de ficarem tortos.
                fontSize: "calc(var(--marca-nome-tam) * 0.52)",
                letterSpacing: "0.22em",
                fontWeight: 600,
              }}
            >
              {subtexto}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
