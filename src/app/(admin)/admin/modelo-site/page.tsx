import { redirect } from "next/navigation";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { auth } from "@/lib/auth";
import { lerPousada } from "@/lib/pousada";
import { assinarPrevia, DURACAO_LINK_MS, hostPublico, lerConfigModelo } from "@/lib/modelo-site";
import { PAGINAS_SITE, todasProntas } from "@/lib/site-novo/paginas";
import { Pagina, Cabecalho, Cartao, Selo, Aviso, botao, quandoFoi } from "@/components/admin/ui";
import { BotaoConfirmar } from "@/components/admin/ui-cliente";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { trocarModeloSite, alternarCeuPorHora } from "./actions";

export const dynamic = "force-dynamic";

/** Link curto (15 min) para o site público ganhar a prévia neste aparelho. */
function linkDePrevia(proto: string, host: string): string | null {
  const token = assinarPrevia("entrar", Date.now() + DURACAO_LINK_MS);
  return token ? `${proto}://${host}/api/modelo-site/previa?t=${encodeURIComponent(token)}` : null;
}

/**
 * Site → Modelo do site (pedido do Vinicios em 04/11/2026): a chave que
 * troca o site inteiro entre o Clássico e o Novo, a prévia do Novo para quem
 * está no painel e o progresso das páginas. Regras em src/lib/modelo-site.ts.
 */
export default async function ModeloSitePage() {
  const s = await auth();
  if (!s?.user) redirect("/admin/login");
  const administracao = (s.user as { role?: string }).role === "master";

  const config = lerConfigModelo(await lerPousada());
  const prontas = PAGINAS_SITE.filter((p) => p.pronta).length;
  const total = PAGINAS_SITE.length;
  const completo = todasProntas();

  /* O link de prévia aponta para o site público (www.), não para o painel. */
  const h = await headers();
  const host = hostPublico(h.get("x-forwarded-host") || h.get("host") || "localhost:3000");
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const linkPrevia = linkDePrevia(proto, host);
  const qr = linkPrevia ? await QRCode.toString(linkPrevia, { type: "svg", margin: 1, width: 176, color: { dark: "#17324A", light: "#FFFFFF" } }) : null;

  const noAr = config.modelo === "novo" ? "Novo" : "Clássico";

  return (
    <Pagina>
      <Cabecalho
        titulo="Modelo do site"
        descricao="Escolha qual site os visitantes veem: o Clássico, que está no ar hoje, ou o Novo, o redesenho aprovado em novembro. A troca vale na hora e dá para voltar quando quiser."
      />

      <div className="grid gap-5">
        <Cartao titulo="O que os visitantes veem agora">
          <div className="flex flex-wrap items-center gap-3">
            <Selo tom={config.modelo === "novo" ? "marca" : "neutro"} ponto>{noAr}</Selo>
            <p className="text-sm text-tinta-suave">
              {config.alteradoEm
                ? <>Trocado {quandoFoi(config.alteradoEm)}{config.alteradoPor ? <> por {config.alteradoPor}</> : null}.</>
                : "Nunca foi trocado: o site está no modelo Clássico desde o começo."}
            </p>
          </div>
        </Cartao>

        <div className="grid gap-5 md:grid-cols-2">
          <Cartao titulo="Clássico" descricao="O site de hoje, com as correções de 04/11.">
            {config.modelo === "classico" ? (
              <Selo tom="sucesso" ponto>No ar para os visitantes</Selo>
            ) : administracao ? (
              <form action={trocarModeloSite}>
                <input type="hidden" name="modelo" value="classico" />
                <BotaoConfirmar titulo="Voltar para o site clássico?" perigo={false} variante="secundario"
                  texto="Os visitantes passam a ver o site clássico na hora. O site novo continua guardado e pode voltar quando você quiser."
                  confirmar="Voltar para o Clássico">
                  Voltar para o Clássico
                </BotaoConfirmar>
              </form>
            ) : (
              <p className="text-sm text-tinta-suave">Só o perfil Administração troca o site dos visitantes.</p>
            )}
          </Cartao>

          <Cartao titulo="Novo" descricao="O redesenho “Chegando pelo mar”: fotos grandes, busca em dois toques e uma só porta para falar com a pousada.">
            <div className="space-y-3">
              <div>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium text-tinta">{prontas} de {total} páginas prontas</span>
                  <span className="text-tinta-suave tabular-nums">{Math.round((prontas / total) * 100)}%</span>
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-black/5 overflow-hidden" aria-hidden>
                  <div className="h-full rounded-full bg-marca" style={{ width: `${(prontas / total) * 100}%` }} />
                </div>
              </div>
              {config.modelo === "novo" ? (
                <Selo tom="sucesso" ponto>No ar para os visitantes</Selo>
              ) : !completo ? (
                <p className="text-sm text-tinta-suave">
                  O botão para ligar o Novo para todos aparece quando as {total} páginas estiverem prontas. Até lá, só quem tem a prévia vê o site novo.
                </p>
              ) : administracao ? (
                <form action={trocarModeloSite}>
                  <input type="hidden" name="modelo" value="novo" />
                  <BotaoConfirmar titulo="Ligar o site novo para todos?" perigo={false} variante="primario"
                    texto="Os visitantes passam a ver o site novo na hora, em todos os endereços. O clássico fica guardado: um clique aqui e ele volta."
                    confirmar="Ligar o Novo para todos">
                    Ligar o Novo para todos
                  </BotaoConfirmar>
                </form>
              ) : (
                <p className="text-sm text-tinta-suave">Só o perfil Administração troca o site dos visitantes.</p>
              )}
            </div>
          </Cartao>
        </div>

        <Cartao titulo="Ver o Novo antes de ligar"
          descricao="A prévia vale só para o aparelho que abrir o link, por 30 dias. Os visitantes continuam no modelo que estiver no ar. A foto do topo do site novo é a capa do álbum Praia e ilha (ou, sem ela, a do álbum A pousada), em Fotos e vídeos.">
          {linkPrevia ? (
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="space-y-3 min-w-0">
                <a href={linkPrevia} target="_blank" rel="noopener" className={botao("primario")}>Ver o site novo neste aparelho</a>
                <p className="text-sm text-tinta-suave leading-relaxed">
                  No celular, aponte a câmera para o código. O link vence em 15 minutos; se vencer, é só recarregar esta tela.
                  No site, uma barrinha no canto troca entre o Novo e o Clássico e tem “Sair da prévia”.
                </p>
              </div>
              {qr && (
                <div className="shrink-0 self-start rounded-2xl bg-white p-2 ring-1 ring-black/5" aria-label="Código QR com o link da prévia"
                  dangerouslySetInnerHTML={{ __html: qr }} />
              )}
            </div>
          ) : (
            <Aviso tom="aviso" titulo="Prévia indisponível">A chave de segurança do site (AUTH_SECRET) não está configurada neste ambiente.</Aviso>
          )}
        </Cartao>

        <Cartao titulo="Páginas do site novo" descricao="Cada página entra no Novo quando fica pronta. A ordem segue o que mais vende primeiro.">
          <ul className="divide-y divide-black/5">
            {PAGINAS_SITE.map((p) => (
              <li key={p.caminho} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="text-tinta">{p.nome}</span>
                  <span className="ml-2 text-xs text-tinta-suave">{p.caminho.replace("[slug]", "…")}</span>
                </span>
                {p.pronta ? <Selo tom="sucesso">Pronta</Selo> : <Selo tom="neutro">Fase {p.fase}</Selo>}
              </li>
            ))}
          </ul>
        </Cartao>

        <Cartao titulo="Céu que acompanha a hora" descricao="No site novo, o tom do céu da foto do topo muda com a hora em Encantadas: amanhecer, dia, fim de tarde e noite.">
          <form action={alternarCeuPorHora} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="ligar" value={config.ceuPorHora ? "0" : "1"} />
            <Selo tom={config.ceuPorHora ? "sucesso" : "neutro"} ponto>{config.ceuPorHora ? "Ligado" : "Desligado"}</Selo>
            <SubmitButton className={botao("secundario", "sm")}>{config.ceuPorHora ? "Desligar" : "Ligar"}</SubmitButton>
          </form>
        </Cartao>
      </div>
    </Pagina>
  );
}
