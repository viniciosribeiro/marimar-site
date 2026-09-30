import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { comSql } from "@/lib/db-conexao";
import { blobConfigurado } from "@/lib/blob";
import { lerBiblioteca } from "@/lib/biblioteca";
import { Pagina, Cabecalho, Aviso } from "@/components/admin/ui";
import { Biblioteca } from "./Biblioteca";

export const dynamic = "force-dynamic";

/**
 * Fotos e vídeos — a biblioteca de mídia central.
 *
 * Substitui a tela antiga de "Fotos", que exigia entender seções e ids e
 * não tinha vídeo. Aqui tudo é álbum: cada seção do site, cada suíte e a
 * pasta de orientação da Marina. Detalhes em docs/fluxo-midia.md.
 */
export default async function MidiasPage({ searchParams }: { searchParams: Promise<{ album?: string; secao?: string; quarto?: string }> }) {
  const s = await auth();
  if (!s?.user) redirect("/admin/login");
  const sp = await searchParams;
  /* Links antigos (?secao= / ?quarto=) continuam funcionando. */
  const album = sp.album ?? (sp.quarto ? `quarto:${sp.quarto}` : sp.secao && sp.secao !== "quarto" ? `secao:${sp.secao}` : "todas");

  const dados = await comSql(lerBiblioteca).catch(() => null);
  if (!dados) {
    return (
      <Pagina>
        <Cabecalho sobre="Conteúdo" titulo="Fotos e vídeos" />
        <Aviso tom="erro" titulo="Não consegui abrir o banco de dados agora.">Recarregue em alguns segundos.</Aviso>
      </Pagina>
    );
  }

  return (
    <Pagina larga>
      <Cabecalho sobre="Conteúdo" titulo="Fotos e vídeos"
        descricao="Tudo o que aparece no site e o que a Marina envia. Escolha um álbum, envie pelo celular ou pelo computador, arraste para ordenar e toque numa mídia para editar." />
      <Biblioteca midias={dados.midias} albuns={dados.albuns} albumInicial={album} blobOk={blobConfigurado()} />
    </Pagina>
  );
}
