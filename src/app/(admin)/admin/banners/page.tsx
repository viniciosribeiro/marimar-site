import postgres from "postgres";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { blobConfigurado } from "@/lib/blob";
import { PainelBanners } from "./PainelBanners";
import type { Banner } from "./FormBanner";

export const dynamic = "force-dynamic";

export const metadata = { title: "Banners do topo — Marimar Admin" };

export default async function BannersPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  /* Cada pagina do admin faz a propria checagem — o layout desenha a
     moldura, mas nao protege nada. Sem esta linha a lista de banners
     aparecia para quem nao estava logado: as actions barravam a escrita,
     mas a leitura passava. */
  const sessao = await auth();
  if (!sessao?.user) redirect("/admin/login");

  const { ok, erro } = await searchParams;

  let banners: Banner[] = [];
  let falha: string | null = null;
  try {
    const sql = postgres(process.env.DATABASE_URL!, { max: 1, connect_timeout: 5, prepare: false });
    banners = (await sql`
      SELECT id, titulo, subtitulo, imagem_url, imagem_pathname, alt,
             cta_texto, cta_href, ordem, ativo,
             to_char(inicia_em,  'YYYY-MM-DD HH24:MI') AS inicia_em,
             to_char(termina_em, 'YYYY-MM-DD HH24:MI') AS termina_em
      FROM banners ORDER BY ordem, criado_em
    `) as unknown as Banner[];
    await sql.end();
  } catch (e) {
    falha = (e as Error).message;
    console.error("[admin/banners] banco indisponivel:", falha);
  }

  return (
    <div className="p-5 sm:p-8 max-w-5xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Banners do topo</h1>
        <p className="text-sm text-gray-500 mt-1 leading-relaxed">
          As imagens grandes do topo da home. Com mais de um ativo, eles se
          alternam sozinhos.
        </p>
      </header>

      {ok && <Aviso tom="ok">{ok}</Aviso>}
      {erro && <Aviso tom="erro">{erro}</Aviso>}
      {falha && <Aviso tom="erro">Banco indisponível: {falha}</Aviso>}

      <PainelBanners banners={banners} blobOk={blobConfigurado()} />
    </div>
  );
}

function Aviso({ tom, children }: { tom: "ok" | "erro"; children: React.ReactNode }) {
  return (
    <div className={`mb-5 px-4 py-3 rounded-lg text-sm border ${
      tom === "ok"
        ? "bg-emerald-50 border-emerald-200 text-emerald-800"
        : "bg-red-50 border-red-200 text-red-800"
    }`}>
      {children}
    </div>
  );
}
