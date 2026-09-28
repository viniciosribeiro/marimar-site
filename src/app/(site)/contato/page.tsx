import { enviarContato } from "./actions";

export default async function ContatoPage({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  // Antes a pagina recebia ?ok= e ?erro= e nao mostrava nenhum dos dois:
  // quem enviava a mensagem nao tinha confirmacao de que ela tinha chegado.
  const { ok, erro } = await searchParams;
  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">Contato</h1>
      <p className="text-gray-500 mb-8">Entre em contato conosco</p>

      {ok && (
        <p role="status" className="mb-6 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          Mensagem enviada! A pousada responde em breve.
        </p>
      )}
      {erro && (
        <p role="alert" className="mb-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {erro}
        </p>
      )}

      <form action={enviarContato} className="bg-white rounded-marca shadow p-6 space-y-4">
        {/* Armadilha para robos de spam: fora da tela e fora do Tab. */}
        <div aria-hidden="true" style={{ position: "absolute", left: "-10000px" }}>
          <label>Não preencha<input name="site_web" tabIndex={-1} autoComplete="off" /></label>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Nome</label>
          <input name="nome" required maxLength={255} className="w-full border rounded p-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Telefone</label>
          <input name="telefone" type="tel" maxLength={20} className="w-full border rounded p-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input name="email" type="email" maxLength={255} className="w-full border rounded p-2" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Mensagem</label>
          <textarea name="mensagem" rows={4} maxLength={5000} className="w-full border rounded p-2" />
        </div>
        <button type="submit" className="w-full bg-marca text-marca-texto rounded p-2 hover:bg-marca-hover">Enviar</button>
      </form>
    </div>
  );
}