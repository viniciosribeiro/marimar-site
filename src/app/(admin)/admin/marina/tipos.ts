import type { ConfigMarina, ItemTreino, Leitura } from "@/lib/marina";
import type { Cobertura } from "@/lib/agent-mapa";
import type { Regras, Adicional } from "@/lib/regras-hospedagem-base";
import type { Roteiro } from "@/lib/roteiros";
import type { Aprendido } from "@/lib/aprendizado";

/** O que a página entrega para a tela do módulo Marina. */

export type DocumentoPainel = {
  id: string; nome: string; assunto: string | null; tipo: string; url: string; bytes: number;
  trecho: string | null; caracteres: number; status: string; erro: string | null; ativo: boolean;
  categoria: string; criado_em: string; processado_em: string | null; tentativas: number;
};

export type Troca = {
  id: string; papel: string; conteudo: string; marcada: boolean; correcao: string | null;
  sem_resposta: boolean; quando: string;
};

export type Conversa = { sessao: string; inicio: string; fim: string; trocas: Troca[] };

export type Lacuna = {
  id: string; pergunta: string; resposta: string | null; canal: string; status: string; criado_em: string;
};

export type EntradaHistorico = {
  id: string; conhecimento_id: string; acao: string;
  antes: Record<string, unknown> | null; depois: Record<string, unknown> | null;
  autor: string | null; criado_em: string;
};

export type Saude = {
  ativos: number; desligados: number; lixeira: number; aguardando: number; revisar: number;
  verificados: number; nuncaTestados: number; lacunas: number; docsFalhos: number;
  categoriasVazias: string[]; diasSemWhatsapp: number | null; tamanhoTreino: number;
  semTom: boolean; semEscalonamento: boolean; gateway: boolean; vozApi: boolean;
};

export type DadosMarina = {
  config: ConfigMarina;
  itens: ItemTreino[];
  leituras: Record<string, Leitura>;
  documentos: DocumentoPainel[];
  conversas: Conversa[];
  lacunas: Lacuna[];
  historico: EntradaHistorico[];
  cobertura: Cobertura[];
  saude: Saude;
  regras: Regras;
  adicionais: Adicional[];
  roteiros: Roteiro[];
  midiasEscolha: MidiaEscolha[];
  blobOk: boolean;
  aprendizado: Aprendido[];
  aprendizadoModo: string;
  /** Itens manuais parecidos com algum aprendido: id → título. */
  conflitos: Record<string, string>;
};

/** Uma mídia da biblioteca para escolher numa etapa de roteiro. */
export type MidiaEscolha = {
  id: string; tipo: "foto" | "video"; titulo: string | null; alt: string; capa: string | null;
  duracao_seg: number | null; secao: string; album: string;
};

/** O que abre o formulário de item já preenchido (vindo de conversa ou lacuna). */
export type Rascunho = {
  id?: string; tipo?: string; categoria?: string; titulo?: string; conteudo?: string;
  variacoes?: string[]; lacuna_id?: string; ativo?: boolean;
};
