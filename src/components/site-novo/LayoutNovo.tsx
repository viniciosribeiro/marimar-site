import { Fraunces, Albert_Sans } from "next/font/google";
import { Abertura } from "@/components/site/Abertura";
import { ChatMarina } from "@/components/site/ChatMarina";
import { digitosWhatsApp } from "@/lib/pousada";
import { CONTATO, IDENTIDADE } from "@/lib/conteudo-pousada";
import type { Tema } from "@/lib/tema";
import type { Visita } from "@/lib/modelo-site";
import { TopoNovo } from "./TopoNovo";
import { RodapeNovo } from "./RodapeNovo";
import { BarraPrevia } from "./BarraPrevia";
import { PilulaWhatsApp } from "./PilulaWhatsApp";
import "./novo.css";

/* As duas letras do site novo, servidas pelo próprio site (next/font).
   `preload: false` enquanto o Clássico estiver no ar: este módulo é
   importado pelo layout de todas as páginas, e o pré-carregamento faria o
   visitante do Clássico baixar letras que não usa. Quando o Novo for para
   todos e o Clássico sair, trocar para `true` (docs/plano-site-novo.md). */
const fraunces = Fraunces({ subsets: ["latin"], axes: ["opsz", "SOFT"], display: "swap", preload: false, fallback: ["Georgia", "serif"] });
const albert = Albert_Sans({ subsets: ["latin"], display: "swap", preload: false, fallback: ["system-ui", "Segoe UI", "sans-serif"] });

/**
 * O casco do site novo: topo, rodapé, um só botão para falar com a pousada
 * e a faixa da prévia. Os componentes do Clássico reaproveitados aqui
 * (calendário, janela da suíte, galeria, chat) pegam as letras e cores do
 * Novo pelos mesmos tokens CSS, redefinidos abaixo.
 */
/** O que o casco usa da linha `pousada` (Dados da pousada e Integrações). */
type DadosPousada = {
  whatsapp?: string | null; logo_url?: string | null; telefone?: string | null;
  email?: string | null; endereco?: string | null; chat_ativo?: boolean | null;
};

export function LayoutNovo({ p, tema, visita, children }: {
  p: DadosPousada; tema: Tema; visita: Visita; children: React.ReactNode;
}) {
  const wa = digitosWhatsApp(p?.whatsapp) || CONTATO.whatsappDigitos;
  const nome = IDENTIDADE.nome;
  const tokens = `:root{--fonte-titulo:${fraunces.style.fontFamily};--fonte-corpo:${albert.style.fontFamily};` +
    "--fundo:#FBF8F3;--texto:#17324A;--tinta:#17324A;--tinta-suave:#4F6476;--areia:#F1E6D4;--areia-forte:#E7D7BD;" +
    "--fundo-suave:#F6EFE3;--linha:#E3D7C3;--peso-titulo:500;--rastreio-titulo:-0.012em}";
  const banner = tema.banner;

  return (
    <div className="sn flex min-h-screen flex-col">
      <style>{tokens}</style>
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[90] focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-sn-texto focus:shadow">
        Ir para o conteúdo
      </a>
      {visita.previa && <BarraPrevia modelo="novo" publico={visita.publico} />}
      {tema.animacoes && tema.movimento.abertura && (
        <Abertura estilo={tema.movimento.aberturaEstilo} logoUrl={p?.logo_url ?? null} texto={tema.movimento.aberturaTexto} />
      )}
      {banner.ativo && banner.texto && (
        <p className="bg-sn-areia px-4 py-2.5 text-center text-[0.9rem] text-sn-texto">
          {banner.texto}{banner.subtexto ? <span className="text-sn-texto-2"> {banner.subtexto}</span> : null}
        </p>
      )}
      <TopoNovo nome={nome} logoUrl={p?.logo_url ?? null} whatsappDigitos={wa} telefone={p?.telefone ?? null} />
      <main id="conteudo" className="flex-1">{children}</main>
      <RodapeNovo nome={nome} logoUrl={p?.logo_url ?? null} whatsapp={p?.whatsapp || CONTATO.whatsapp} whatsappDigitos={wa}
        telefone={p?.telefone ?? null} email={p?.email ?? null} endereco={p?.endereco ?? null} />
      {/* Uma só porta para falar com a pousada: o chat da Marina (que tem o
          WhatsApp lá dentro) ou, com o chat desligado no painel, o WhatsApp. */}
      {p?.chat_ativo ? (
        <ChatMarina whatsapp={wa} nome={nome} estilo="novo" />
      ) : (
        <PilulaWhatsApp digitos={wa} />
      )}
    </div>
  );
}
