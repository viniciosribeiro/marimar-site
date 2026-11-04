import Link from "next/link";
import { headers } from "next/headers";
import { modeloDaVisita } from "@/lib/modelo-site";
import { NaoEncontradaNovo } from "@/components/site-novo/NaoEncontradaNovo";
export default async function NotFound() {
  /* Site → Modelo do site: no Novo, a página nova (o corpo abaixo é o Clássico, intocado). O painel fica sempre com esta. */
  const ehPainel = ((await headers()).get("x-pathname") ?? "").startsWith("/admin");
  if (!ehPainel && (await modeloDaVisita()).modelo === "novo") return <NaoEncontradaNovo />;
  return(<div className="min-h-screen flex items-center justify-center"><div className="text-center"><h1 className="text-6xl font-bold text-gray-300 mb-4">404</h1><p className="text-gray-500 mb-6">Pagina nao encontrada</p><Link href="/" className="text-teal-600 hover:underline">Voltar para Home</Link></div></div>);
}
