import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { comSql } from "@/lib/db-conexao";
import { lerRota } from "@/lib/rota";
import { Pagina, Cabecalho, BotaoLink } from "@/components/admin/ui";
import { EditorRota } from "./EditorRota";

export const dynamic = "force-dynamic";

export default async function RotaAdminPage() {
  const s = await auth();
  if (!s?.user) redirect("/admin/login");
  const rota = await comSql(lerRota);
  return (
    <Pagina larga>
      <Cabecalho sobre="Conteúdo do site" titulo="Rota e mapa"
        descricao="O mapa de Como chegar: onde fica a pousada, o trapiche e os terminais de barco, o visual do mapa e os textos. Arraste os pontos no mapa para acertar a posição."
        acoes={<BotaoLink href="/como-chegar#rota" variante="secundario" externo>Ver no site</BotaoLink>} />
      <EditorRota inicial={rota} />
    </Pagina>
  );
}
