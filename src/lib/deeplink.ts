export function buildDeepLink(params: {
  checkIn: string; checkOut: string; adultos: number; criancas?: number;
}): string {
  const base = "https://reservas.desbravador.com.br/hotel-app/pousada-ilha-do-mel-marimar";
  const fmt = (iso: string) => { const [y,m,d] = iso.split("-"); return `${d}/${m}/${y}`; };
  const qs = new URLSearchParams({
    checkin: fmt(params.checkIn),
    checkout: fmt(params.checkOut),
    adultos: String(params.adultos),
    criancas: String(params.criancas ?? 0),
  });
  return `${base}?${qs.toString()}`;
}