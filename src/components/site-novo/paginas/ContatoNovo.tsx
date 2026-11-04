import Link from "next/link";
import { lerContato } from "@/lib/pousada";
import { ENDERECO, IDENTIDADE } from "@/lib/conteudo-pousada";
import { enviarContato } from "@/app/(site)/contato/actions";
import { CabecalhoPagina } from "./Partes";
import { BotaoCopiar } from "./BotaoCopiar";
import { Migalhas } from "../DadosEstruturados";

/**
 * /contato no site novo: os canais da pousada (com copiar) e o MESMO
 * formulário do Clássico (Server Action enviarContato, campo-armadilha para
 * robôs, ?ok= e ?erro= na volta).
 */
export async function ContatoNovo({ ok, erro }: { ok?: string; erro?: string }) {
  const c = await lerContato();
  const linhas: { rotulo: string; valor: string; href?: string; acao?: string; copiar?: string }[] = [];
  if (c.whatsappDigitos) linhas.push({ rotulo: "WhatsApp", valor: c.whatsapp, href: `https://wa.me/${c.whatsappDigitos}`, acao: "Abrir conversa", copiar: c.whatsapp });
  if (c.telefone) linhas.push({ rotulo: "Telefone", valor: c.telefone, href: `tel:+${c.telefone.replace(/\D/g, "").replace(/^(?!55)/, "55")}`, acao: "Ligar", copiar: c.telefone });
  if (c.email) linhas.push({ rotulo: "E-mail", valor: c.email, href: `mailto:${c.email}`, acao: "Escrever", copiar: c.email });
  if (IDENTIDADE.instagram) linhas.push({ rotulo: "Instagram", valor: IDENTIDADE.instagramUser, href: IDENTIDADE.instagram, acao: "Abrir perfil" });
  linhas.push({ rotulo: "Endereço", valor: ENDERECO.completo });
  if (c.horarioRecepcao) linhas.push({ rotulo: "Recepção", valor: c.horarioRecepcao });

  const campo = "mt-1.5 w-full rounded-xl border border-sn-linha bg-white px-3.5 text-[1rem] outline-none focus-visible:ring-2 focus-visible:ring-sn-mare-forte";
  return (
    <div className="pb-16 lg:pb-24">
      <Migalhas trilha={[["Contato", "/contato"]]} />
      <CabecalhoPagina titulo="Contato">
        <p>Fale direto com a pousada pelo WhatsApp, pelo telefone, por e-mail ou pelo formulário.</p>
      </CabecalhoPagina>

      <div className="sn-margem mx-auto mt-10 grid max-w-[1240px] gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-20">
        <section aria-labelledby="sn-canais" className="min-w-0">
          <h2 id="sn-canais" className="sn-h3">Canais da pousada</h2>
          <ul className="mt-4 divide-y divide-sn-linha border-y border-sn-linha">
            {linhas.map((l) => (
              <li key={l.rotulo} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-4">
                <p className="min-w-0">
                  <span className="block text-[0.9rem] text-sn-texto-2">{l.rotulo}</span>
                  <span className="mt-0.5 block break-words font-medium">{l.valor}</span>
                </p>
                {(l.href || l.copiar) && (
                  <span className="flex shrink-0 flex-wrap gap-2">
                    {l.href && (
                      <a href={l.href} {...(l.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                        className="inline-flex min-h-11 items-center rounded-full bg-sn-mar px-4 text-[0.9rem] font-semibold text-white hover:bg-sn-mar-2">{l.acao}</a>
                    )}
                    {l.copiar && <BotaoCopiar texto={l.copiar} rotulo={l.rotulo} />}
                  </span>
                )}
              </li>
            ))}
          </ul>
          <Link href="/como-chegar" className="sn-link mt-4 inline-flex min-h-11 items-center">Como chegar à pousada</Link>
        </section>

        <section aria-labelledby="sn-formulario" className="min-w-0">
          <h2 id="sn-formulario" className="sn-h3">Mandar uma mensagem</h2>
          {ok && <p role="status" className="mt-4 rounded-xl bg-sn-mata/10 px-4 py-3 text-sn-mata">Mensagem enviada! A pousada responde em breve.</p>}
          {erro && <p role="alert" className="mt-4 rounded-xl bg-sn-areia px-4 py-3">{erro}</p>}
          <form action={enviarContato} data-sem-flutuante className="mt-4 grid gap-4">
            {/* Armadilha para robôs de spam: fora da tela e fora do Tab. */}
            <div aria-hidden="true" style={{ position: "absolute", left: "-10000px" }}>
              <label>Não preencha<input name="site_web" tabIndex={-1} autoComplete="off" /></label>
            </div>
            <label className="block text-[0.95rem] font-medium">Nome
              <input name="nome" required maxLength={255} autoComplete="name" className={`${campo} h-12`} />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-[0.95rem] font-medium">Telefone ou WhatsApp
                <input name="telefone" type="tel" maxLength={20} autoComplete="tel" inputMode="tel" className={`${campo} h-12`} />
              </label>
              <label className="block text-[0.95rem] font-medium">E-mail
                <input name="email" type="email" maxLength={255} autoComplete="email" className={`${campo} h-12`} />
              </label>
            </div>
            <label className="block text-[0.95rem] font-medium">Mensagem
              <textarea name="mensagem" rows={5} maxLength={5000} className={`${campo} py-3`} />
            </label>
            <button type="submit" className="sn-botao w-full rounded-xl sm:w-auto sm:justify-self-start">Enviar mensagem</button>
          </form>
        </section>
      </div>
    </div>
  );
}
