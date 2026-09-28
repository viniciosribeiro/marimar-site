"use server";

import { redirect } from "next/navigation";
import { registrarLead } from "@/lib/leads";

export async function enviarContato(formData: FormData) {
  // Campo-armadilha: invisivel para pessoas, robos de spam preenchem tudo.
  // Finge sucesso para o robo nao tentar de novo com outra estrategia.
  if (formData.get("site_web")) redirect("/contato?ok=Mensagem+enviada");

  let gravou = false;
  try {
    gravou = await registrarLead({
      nome: formData.get("nome"),
      telefone: formData.get("telefone"),
      email: formData.get("email"),
      mensagem: formData.get("mensagem"),
    }, "site");
  } catch (e) {
    console.error("[contato] nao gravou:", (e as Error).message);
    redirect("/contato?erro=Nao+conseguimos+enviar+agora.+Tente+de+novo+ou+fale+pelo+WhatsApp.");
  }
  if (!gravou) redirect("/contato?erro=Informe+seu+nome.");

  redirect("/contato?ok=Mensagem+enviada");
}
