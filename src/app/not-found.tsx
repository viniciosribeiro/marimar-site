import Link from "next/link";
export default function NotFound() {
  return(<div className="min-h-screen flex items-center justify-center"><div className="text-center"><h1 className="text-6xl font-bold text-gray-300 mb-4">404</h1><p className="text-gray-500 mb-6">Pagina nao encontrada</p><Link href="/" className="text-teal-600 hover:underline">Voltar para Home</Link></div></div>);
}