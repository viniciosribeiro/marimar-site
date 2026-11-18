/**
 * "Entrar no painel": o acesso da equipe, no rodapé dos dois modelos do site.
 *
 * Aponta para `/admin`, e não para `/admin/login`, de propósito: pelo domínio
 * público o middleware leva `/admin` ao endereço do painel (admin.…), e o
 * painel manda quem não entrou para o login LÁ. Já `/admin/login` no `www`
 * não é redirecionado — a pessoa entraria no `www` e teria de entrar de novo
 * no `admin.`. Quem já está logado cai direto no painel.
 *
 * `<a>` comum (não `Link`): é uma ida a outro endereço, sem pré-carregar nada.
 * `nofollow`: buscador não tem o que fazer no painel.
 */
export function EntrarPainel({ className }: { className: string }) {
  return (
    <a href="/admin" rel="nofollow" className={className}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="4" y="11" width="16" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </svg>
      Entrar no painel
    </a>
  );
}
