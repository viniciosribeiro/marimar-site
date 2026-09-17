import { enviarContato } from "./actions";

export default function ContatoPage({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">Contato</h1>
      <p className="text-gray-500 mb-8">Entre em contato conosco</p>

      <form action={enviarContato} className="bg-white rounded-xl shadow p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Nome</label>
          <input name="nome" required className="w-full border rounded p-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Telefone</label>
          <input name="telefone" className="w-full border rounded p-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input name="email" type="email" className="w-full border rounded p-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Mensagem</label>
          <textarea name="mensagem" rows={4} className="w-full border rounded p-2" />
        </div>
        <button type="submit" className="w-full bg-teal-600 text-white rounded p-2 hover:bg-teal-700">Enviar</button>
      </form>
    </div>
  );
}