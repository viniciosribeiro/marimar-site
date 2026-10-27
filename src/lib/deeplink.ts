/**
 * Link do botão "Reservar no site oficial": abre o motor do Desbravador já
 * com as datas e os hóspedes da busca. Quando a suíte é conhecida, inclui
 * roomCode e rateCode vazio. O proprietário validou QUEEN no iPhone em 27/10.
 * Sem suíte escolhida, preserva o link genérico.
 *
 * Formato do motor novo (hotel-app), o mesmo que a Marina manda no WhatsApp
 * (agente/skills/consulta-desbravador/scripts/consultar-api.mjs):
 *   /hotel-app/<slug>/reservation?checkin=AAAA-MM-DD&checkout=AAAA-MM-DD&adults=N&child1=N
 * Até 19/10/2026 o site usava o formato antigo (?checkin=DD/MM/AAAA&adultos=…),
 * que o motor passou a ignorar: o hóspede caía na página inicial do
 * Desbravador e tinha de refazer a busca.
 */
const MOTOR = "https://reservas.desbravador.com.br/hotel-app/pousada-ilha-do-mel-marimar";

export function buildDeepLink(params: {
  checkIn: string; checkOut: string; adultos: number; criancas?: number;
  quartoId?: string | null;
}): string {
  const qs = new URLSearchParams({
    checkin: params.checkIn,
    checkout: params.checkOut,
    adults: String(Math.max(1, params.adultos)),
    child1: String(Math.max(0, params.criancas ?? 0)),
  });
  const codigo = params.quartoId?.trim();
  if (codigo) {
    qs.set("roomCode", codigo);
    qs.set("rateCode", "");
  }
  return `${MOTOR}/reservation?${qs.toString()}`;
}
