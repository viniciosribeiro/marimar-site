#!/usr/bin/env node
/**
 * Reparacao cuidadosa da memoria da Marina (OpenClaw/Hostinger).
 * Uso no terminal da Hostinger:
 *   cd ~/marimar-site && git pull --ff-only && node agente/scripts/corrigir-memoria-marina.mjs
 *
 * - salva copia privada do arquivo antes de qualquer alteracao;
 * - nao imprime chaves, tokens, historico nem conversa de hospede;
 * - ativa memoria de sessoes SOMENTE na sessao visivel para o agente;
 * - isola contatos do WhatsApp por canal e remetente;
 * - preserva configuracoes preexistentes e NAO reinicia manualmente o servidor;
 * - usa o RPC de configuracao do gateway ativo, sem sobrescrever o JSON todo.
 */
import { execFileSync } from "node:child_process";
import { existsSync, copyFileSync, mkdirSync, chmodSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

const checkOnly = process.argv.includes("--verificar");
function cmd(args, timeout=25000) {
  return execFileSync("openclaw", args, {
    encoding: "utf8", timeout, maxBuffer: 2 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}
function jsonCmd(args, timeout) {
  const txt = cmd(args, timeout);
  try { return JSON.parse(txt); } catch { throw Error("A CLI nao retornou JSON valido para esta consulta."); }
}
function getter(path) {
  try { return jsonCmd(["config", "get", path, "--json"]); }
  catch { return undefined; }
}
function nestedHash(result) {
  if (result && typeof result === "object") {
    if (typeof result.hash === "string" && result.hash.length >= 8) return result.hash;
    for (const key of ["payload","result","data"]) {
      const hash = nestedHash(result[key]);
      if (hash) return hash;
    }
  }
  return null;
}
function report(name, success, detail = "") {
  console.log((success ? "OK " : "AVISO ") + name + (detail ? ": " + detail : ""));
}

try {
  const version = cmd(["--version"]);
  console.log("Marina - verificacao de memoria / OpenClaw " + version);
  const currentScope = getter("session.dmScope");
  const visibility = getter("tools.sessions.visibility");
  const existingSources = getter("memory.search.sources");
  const backend = getter("memory.backend");

  report("Escopo de atendimento", currentScope === "per-channel-peer" || currentScope === "per-account-channel-peer",
    typeof currentScope === "string" ? currentScope : "padrao compartilhado / nao informado");
  report("Visibilidade de sessoes", visibility === "self",
    typeof visibility === "string" ? visibility : "nao definida");
  if (backend === "qmd") {
    throw Error("Backend QMD detectado. Nao ativar esta migracao generica: requer configuracao propria e validacao isolada.");
  }
  const sources = Array.isArray(existingSources)
    ? [...new Set([...existingSources.filter(v => typeof v === "string"), "memory", "sessions"])]
    : ["memory", "sessions"];

  // A memoria de sessoes sem isolamento pode recuperar trechos de outro hospede.
  // Por isso TODAS estas salvaguardas sao aplicadas no mesmo patch atomico.
  const patch = {
    session: { dmScope: currentScope === "per-account-channel-peer" ? currentScope : "per-channel-peer" },
    tools: { sessions: { visibility: "self" } },
    memory: { search: {
      experimental: { sessionMemory: true },
      sources,
      rememberAcrossConversations: false,
    } },
  };

  if (checkOnly) {
    report("Modo de verificacao", true, "nenhuma configuracao foi alterada");
    console.log("Ajustes previstos: isolamento por hospede, busca limitada a sessao corrente e indexacao de memoria.");
    process.exit(0);
  }

  const fileResult = jsonCmd(["config", "file", "--json"]);
  const configPath = fileResult?.path;
  if (typeof configPath !== "string" || !configPath.startsWith("/") || !existsSync(configPath) || !statSync(configPath).isFile()) {
    throw Error("Arquivo de configuracao do OpenClaw nao encontrado; alteracao cancelada.");
  }
  // Arquivo inclui segredos. Copia fica privada no MESMO servidor e nao vai ao GitHub.
  const backupDir = join(dirname(configPath), "backups-marina");
  mkdirSync(backupDir, { recursive:true, mode:0o700 });
  chmodSync(backupDir, 0o700);
  const backupFile = join(backupDir, "openclaw-" + new Date().toISOString().replace(/[:.]/g,"-") + ".json");
  copyFileSync(configPath, backupFile);
  chmodSync(backupFile, 0o600);
  report("Backup seguro", true, backupFile);

  // A interface ativa da Hostinger executa o Gateway. config set offline pode falhar
  // ou alterar arquivo inativo; patch RPC e o caminho correto para esse ambiente.
  const config = jsonCmd(["gateway","call","config.get","--params","{}","--json"], 35000);
  const hash = nestedHash(config);
  if (!hash) throw Error("Nao foi possivel obter hash da configuracao do Gateway; nada foi alterado.");
  const payload = { raw: JSON.stringify(patch), baseHash: hash, note: "Marina: reparar memoria e isolar atendimentos WhatsApp" };
  let avisoRpc = false;
  try {
    cmd(["gateway", "call", "config.patch", "--params", JSON.stringify(payload), "--json"], 45000);
  } catch {
    // Alguns servidores reabrem o Gateway ao publicar configuracao e cortam
    // a conexao do CLI. Verificar a configuracao salva antes de declarar erro.
    avisoRpc = true;
  }

  const scopeAfter = getter("session.dmScope");
  const viewAfter = getter("tools.sessions.visibility");
  const sessionsAfter = getter("memory.search.experimental.sessionMemory");
  const sourcesAfter = getter("memory.search.sources");
  const recallAfter = getter("memory.search.rememberAcrossConversations");
  if ((scopeAfter !== "per-channel-peer" && scopeAfter !== "per-account-channel-peer") ||
      viewAfter !== "self" || sessionsAfter !== true || recallAfter !== false ||
      !Array.isArray(sourcesAfter) || !sourcesAfter.includes("sessions")) {
    throw Error("A configuracao salva nao passou na verificacao. Consulte suporte antes de tentar novamente.");
  }
  report("Configuracao atualizada", true, avisoRpc ? "Gateway reconectou; valores confirmados" : "patch validado e valores confirmados");
  report("Privacidade por hospede", true);
  report("Memoria de sessoes", true, "ativa; visibilidade de busca limitada a sessao atual");
  report("Relembrar clientes diferentes", true, "desabilitado");

  try {
    const validation = cmd(["config","validate"], 25000);
    report("Validacao do OpenClaw", true, validation.split("\n").slice(-1)[0].slice(0,120));
  } catch { report("Validacao", false, "exige revisao; backup disponivel"); }

  // Indexacao incremental e optativa: index nao e fonte de dados nem altera reservas.
  // Nao forcar reindexacao completa de todo o historico sem medir custo.
  try {
    cmd(["memory", "index", "--agent", "main"], 120000);
    report("Indice de memoria", true, "sincronizacao incremental concluida");
  } catch { report("Indice de memoria", false, "indexacao indisponivel; verificar provedor sem apagar bancos"); }

  console.log("Concluido. Teste no WhatsApp a continuacao de uma conversa sobre uma suite.");
  console.log("Se aparecer erro, envie somente a mensagem de erro sem tokens ou conversas de hospedes.");
} catch (err) {
  console.error("NAO CONCLUIDO: " + (err instanceof Error ? err.message : String(err)));
  console.error("Nao apague arquivos .sqlite, .db, -wal, -shm nem transcricoes.");
  process.exitCode = 1;
}
