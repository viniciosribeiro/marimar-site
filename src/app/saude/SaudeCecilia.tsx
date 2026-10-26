"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, AlertCircle, AlertTriangle, ArrowLeft, ArrowRight, BookOpen,
  CheckCircle2, ChevronDown, ChevronRight, Clock3, Cloud, Database, ExternalLink,
  Globe2, Heart, Info, LockKeyhole, MessageCircle, Pause, Play,
  RefreshCw, Search, Settings2, ShieldCheck, Sparkles, Volume2, Wifi, X
} from "lucide-react";
import css from "./saude-cecilia.module.css";

type Estado = "online" | "atencao" | "offline" | "nao_verificado";
type Sonda = { estado: Estado; latencia_ms: number | null; descricao: string; metodo?: string };
type Dados = { consultado_em: string; servicos: Record<string,Sonda>; historico_disponivel: false; intervalo_segundos: number };
type Grupo = "site" | "reservas" | "whatsapp" | "marina";
type Registro = { id: string; inicio: number; fim?: number; estado: Estado };

const SERVICOS = [
  { id:"site", nome:"Site da pousada", simples:"Confere se a página da pousada abre para os visitantes.", area:"site" },
  { id:"api", nome:"Central de verificações", simples:"Permite que a Marina receba os resultados das verificações.", area:"site" },
  { id:"neon", nome:"Banco de informações", simples:"Confere se é possível acessar o lugar onde ficam os dados do sistema.", area:"estrutura" },
  { id:"worker", nome:"Serviço auxiliar das reservas", simples:"Confere se o serviço que apoia a consulta de reservas responde.", area:"reservas" },
  { id:"desbravador", nome:"Consulta de quartos e preços", simples:"Faz uma consulta real de disponibilidade e tarifas, sem reservar nada.", area:"reservas" },
  { id:"openclaw", nome:"Conexão do atendimento", simples:"Confere se a ferramenta que conecta os canais de atendimento responde.", area:"atendimento" },
  { id:"whatsapp", nome:"Conexão do WhatsApp", simples:"Confere se o WhatsApp aparece como conectado. Não testa uma conversa completa.", area:"atendimento" },
  { id:"marina_site", nome:"Marina no site", simples:"Confere se a função de chat está ativada na configuração da pousada.", area:"atendimento" },
  { id:"voz", nome:"Voz da Marina", simples:"Confere se o serviço de voz aceita a conexão. Não reproduz áudio.", area:"atendimento" },
  { id:"blob", nome:"Armazenamento de arquivos", simples:"Confere se o espaço onde ficam arquivos responde à consulta.", area:"estrutura" },
  { id:"dns", nome:"Endereço do site", simples:"Confere se o endereço da pousada é encontrado na internet.", area:"site" },
  { id:"ssl", nome:"Acesso seguro", simples:"Confere se o site aceita uma conexão HTTPS. Não verifica a data de expiração.", area:"site" },
  { id:"autenticacao", nome:"Entrada do painel administrativo", simples:"Confere se a página de login abre. Não faz login.", area:"site" },
  { id:"mapas", nome:"Mapa do site", simples:"Confere se o serviço usado para carregar mapas responde.", area:"site" },
  { id:"regras", nome:"Regras da hospedagem", simples:"Confere se a tabela de regras de ocupação pode ser consultada.", area:"reservas" },
  { id:"fotos", nome:"Fotos da pousada", simples:"Confere se a lista de fotos e vídeos pode ser consultada.", area:"site" },
  { id:"marina_conhecimento", nome:"Conhecimentos da Marina", simples:"Confere se as configurações de conhecimento estão acessíveis.", area:"atendimento" },
  { id:"whatsapp_vigia", nome:"Registro de acompanhamento do WhatsApp", simples:"Confere se existe atividade recente registrada pelo vigia.", area:"atendimento" },
  { id:"avisos", nome:"Avisos externos", simples:"Ainda não faz teste de envio, para não mandar mensagens indevidas.", area:"estrutura" },
  { id:"webhooks", nome:"Avisos entre sistemas", simples:"O recebimento de eventos não é testado por envio nesta página.", area:"estrutura" },
] as const;

const GRUPOS: Record<Grupo,{titulo:string;subtitulo:string;descricao:string;ids:string[];icon:typeof Globe2;explicacao:string}> = {
  site: { titulo:"Site da pousada", subtitulo:"Os hóspedes conseguem abrir o site?", descricao:"Cuido do acesso e da segurança básica da página.", ids:["site","dns","ssl"], icon:Globe2, explicacao:"A Marina confere se o site abre, se o endereço funciona e se a conexão é segura. Não significa que todos os botões ou páginas foram testados." },
  reservas: { titulo:"Reservas e valores", subtitulo:"É possível consultar quartos e preços?", descricao:"Acompanho as consultas sem criar reservas.", ids:["desbravador","worker","regras"], icon:BookOpen, explicacao:"A Marina verifica o serviço das reservas e realiza uma consulta real de tarifas. Isso não faz uma reserva nem garante que todas as datas estejam disponíveis." },
  whatsapp: { titulo:"WhatsApp", subtitulo:"O atendimento está conectado?", descricao:"Confiro a conexão do WhatsApp da Marina.", ids:["whatsapp","openclaw","whatsapp_vigia"], icon:MessageCircle, explicacao:"A Marina confere a conexão informada pelo gateway e o registro do vigia. Mesmo conectado, isso NÃO confirma que o WhatsApp consegue responder preços, fotos ou mensagens completas." },
  marina: { titulo:"Assistente Marina", subtitulo:"As ferramentas da Marina respondem?", descricao:"Acompanho o chat, os conhecimentos e a voz.", ids:["marina_site","marina_conhecimento","voz"], icon:Sparkles, explicacao:"A Marina consulta as configurações do chat, o acesso à sua base e o serviço de voz. Estas verificações não constituem um teste de uma conversa completa com hóspedes." },
};

const AREAS = [
  {id:"site", nome:"Site, páginas e imagens", icon:Globe2},
  {id:"reservas", nome:"Reservas e hospedagem", icon:BookOpen},
  {id:"atendimento", nome:"Atendimento e inteligência", icon:MessageCircle},
  {id:"estrutura", nome:"Serviços que ficam nos bastidores", icon:Database},
] as const;

const ROTULOS:Record<Estado,string> = {
  online:"Verificação OK",
  atencao:"Precisa de atenção",
  offline:"Com problema",
  nao_verificado:"Ainda não verificado",
};

function statusDasSondas(dados:Dados|null, ids:string[]):Estado {
  if (!dados) return "nao_verificado";
  const estados = ids.map(id=>dados.servicos[id]?.estado ?? "nao_verificado");
  if(estados.includes("offline"))return "offline";
  if(estados.includes("atencao"))return "atencao";
  if(estados.includes("nao_verificado"))return "nao_verificado";
  return "online";
}
function hora(data:string|null) {
  if(!data || Number.isNaN(new Date(data).getTime()))return "—";
  return new Date(data).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
}
function Robot({estado,movendo}:{estado:Estado;movendo:boolean}) {
  const alerta=estado==="offline"||estado==="atencao";
  return <svg viewBox="0 0 180 230" aria-label="Marina, robozinha animada com rosto, braços e pernas" role="img" className={[css.robotSvg,movendo?css.robotMove:""].join(" ")}>
    <defs>
      <linearGradient id="marinaCasco" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff"/><stop offset=".6" stopColor="#e9eeff"/><stop offset="1" stopColor="#bdc7f7"/></linearGradient>
      <linearGradient id="marinaFace" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#283e82"/><stop offset="1" stopColor="#101b46"/></linearGradient>
      <linearGradient id="marinaVeste" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fdfdff"/><stop offset="1" stopColor="#c2d5ff"/></linearGradient>
    </defs>
    <ellipse cx="90" cy="220" rx="52" ry="7" fill="#272154" opacity=".15"/>
    <g className={css.pernaEsquerda}><rect x="54" y="163" width="23" height="43" rx="12" fill="url(#marinaCasco)" stroke="#b5bce9" strokeWidth="3"/><ellipse cx="62" cy="205" rx="21" ry="10" fill="#aca5ed"/></g>
    <g className={css.pernaDireita}><rect x="105" y="163" width="23" height="43" rx="12" fill="url(#marinaCasco)" stroke="#b5bce9" strokeWidth="3"/><ellipse cx="116" cy="205" rx="21" ry="10" fill="#aaa4ea"/></g>
    <g className={css.bracoEsquerdo}><path d="M53 145 Q31 149 23 171" stroke="#d5ddff" strokeWidth="19" strokeLinecap="round" fill="none"/><circle cx="23" cy="173" r="13" fill="url(#marinaCasco)" stroke="#b7bef0" strokeWidth="3"/></g>
    <g className={css.bracoDireito}><path d="M132 145 Q156 135 163 116" stroke="#d5ddff" strokeWidth="19" strokeLinecap="round" fill="none"/><circle cx="163" cy="113" r="13" fill="url(#marinaCasco)" stroke="#b7bef0" strokeWidth="3"/></g>
    <rect x="49" y="122" width="86" height="65" rx="32" fill="url(#marinaVeste)" stroke="#b5bce9" strokeWidth="3"/>
    <path d="M59 142 Q93 131 124 142" fill="none" stroke="#fff" opacity=".9" strokeWidth="6"/>
    <circle cx="92" cy="153" r="12" fill="#9b89ed"/><path d="M86 153h12M92 147v12" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
    <g className={css.robotHead}>
      <rect x="83" y="10" width="17" height="20" rx="8" fill="#d3ddff"/><circle cx="91" cy="9" r="8" fill="#6ee8ed"/>
      <rect x="9" y="30" width="162" height="109" rx="48" fill="url(#marinaCasco)" stroke="#b0b9eb" strokeWidth="4"/>
      <rect x="22" y="43" width="136" height="84" rx="36" fill="url(#marinaFace)"/>
      <rect x="1" y="66" width="22" height="38" rx="10" fill="#d2e1ff"/><circle cx="12" cy="85" r="6" fill="#9384e7"/>
      <rect x="158" y="66" width="21" height="38" rx="10" fill="#d2e1ff"/><circle cx="168" cy="85" r="6" fill="#9384e7"/>
      <path d="M38 55 Q63 44 83 51" fill="none" stroke="#a6cfff" strokeWidth="6" opacity=".48" strokeLinecap="round"/>
      <g className={css.robotEyes}>{alerta?<><ellipse cx="62" cy="84" rx="9" ry="13" fill="#70f4f2"/><ellipse cx="119" cy="84" rx="9" ry="13" fill="#70f4f2"/><ellipse cx="91" cy="109" rx="7" ry="9" fill="#70f4f2"/></>:estado==="nao_verificado"?<><circle cx="62" cy="85" r="10" fill="#70f4f2"/><circle cx="119" cy="85" r="10" fill="#70f4f2"/><path d="M83 109 Q91 104 99 109" stroke="#70f4f2" strokeWidth="5" strokeLinecap="round" fill="none"/></>:<><path d="M48 89 Q62 68 76 89M105 89Q119 68 133 89" fill="none" stroke="#70f4f2" strokeWidth="8" strokeLinecap="round"/><path d="M77 105Q91 118 105 105" fill="none" stroke="#70f4f2" strokeWidth="6" strokeLinecap="round"/></>}</g>
    </g>
  </svg>;
}

export default function SaudeCecilia(){
  const [dados,setDados]=useState<Dados|null>(null);
  const [erro,setErro]=useState(false);
  const [buscando,setBuscando]=useState(false);
  const [selecionado,setSelecionado]=useState<string|null>(null);
  const [tecnico,setTecnico]=useState(false);
  const [busca,setBusca]=useState("");
  const [movimento,setMovimento]=useState(true);
  const [passo,setPasso]=useState(0);
  const [pos,setPos]=useState({x:86,y:40});
  const [registros,setRegistros]=useState<Registro[]>([]);
  const [amostras,setAmostras]=useState<{em:number;latencias:Record<string,number>}[]>([]);
  const [agora,setAgora]=useState(0);

  const carregar=useCallback(async()=>{
    setBuscando(true);
    try{
      const response=await fetch("/api/saude/status",{cache:"no-store"});
      if(!response.ok) throw new Error("Falha de consulta");
      const json=await response.json() as Dados;
      if(!json || !json.servicos || typeof json.consultado_em!=="string")throw new Error("Dados inesperados");
      setDados(json);setErro(false);
      const timestamp=Date.now();
      const latencias=Object.fromEntries(Object.entries(json.servicos).filter(([,s])=>typeof s.latencia_ms==="number").map(([id,s])=>[id,s.latencia_ms as number]));
      setAmostras(a=>[...a.slice(-23),{em:timestamp,latencias}]);
      setRegistros(old=>{
        const atualizados=old.map(e=>e.fim?e:(json.servicos[e.id]?.estado==="online"?{...e,fim:timestamp}:e));
        const abertos=new Set(atualizados.filter(e=>!e.fim).map(e=>e.id));
        for(const [id,s] of Object.entries(json.servicos)){
          if((s.estado==="atencao"||s.estado==="offline")&&!abertos.has(id))
            atualizados.unshift({id,estado:s.estado,inicio:timestamp});
        }
        return atualizados.slice(0,40);
      });
    }catch{setErro(true)}finally{setBuscando(false)}
  },[]);
  useEffect(()=>{void carregar();const timer=window.setInterval(()=>void carregar(),300000);return()=>clearInterval(timer)},[carregar]);
  useEffect(()=>{setAgora(Date.now());const timer=window.setInterval(()=>setAgora(Date.now()),15000);return()=>clearInterval(timer)},[]);
  useEffect(()=>{
    if(!movimento)return;
    const timer=window.setInterval(()=>setPasso(p=>(p+1)%5),7400);
    return()=>clearInterval(timer);
  },[movimento]);
  useEffect(()=>{
    if(!movimento)return;
    const destinos=["intro-marina","cartao-site","cartao-reservas","cartao-whatsapp","cartao-marina"];
    const node=document.getElementById(destinos[passo]);
    if(!node)return;
    const r=node.getBoundingClientRect();
    setPos({x:Math.min(window.innerWidth-90,Math.max(85,r.left+r.width*.85)),y:Math.max(140,Math.min(window.innerHeight-125,r.top+r.height*.45))});
  },[passo,movimento]);
  useEffect(()=>{
    if(!selecionado)return;
    const onKey=(ev:KeyboardEvent)=>{if(ev.key==="Escape")setSelecionado(null)};
    window.addEventListener("keydown",onKey);
    return()=>window.removeEventListener("keydown",onKey);
  },[selecionado]);
  const stale=!!dados && (Number.isNaN(Date.parse(dados.consultado_em)) || (agora>0 && agora-Date.parse(dados.consultado_em)>11*60*1000));
  const atual=erro||stale?null:dados;
  const estado=(id:string):Estado=>atual?.servicos[id]?.estado??"nao_verificado";
  const grupos=(Object.keys(GRUPOS) as Grupo[]).map(id=>({id,...GRUPOS[id],estado:statusDasSondas(atual,GRUPOS[id].ids)}));
  const problemas=SERVICOS.filter(s=>estado(s.id)==="atencao"||estado(s.id)==="offline");
  const semTeste=SERVICOS.filter(s=>estado(s.id)==="nao_verificado");
  const situacao:Estado=problemas.some(s=>estado(s.id)==="offline")?"offline":problemas.length?"atencao":semTeste.length?"nao_verificado":"online";
  const resumo=erro?"Não consegui consultar o painel agora. Isso não significa que o site esteja fora do ar."
    :stale?"A última verificação está antiga. Vou precisar de uma nova leitura para confirmar a situação."
    :!dados?"Estou buscando as primeiras informações da pousada."
    :problemas.length?"Encontrei "+problemas.length+" "+(problemas.length===1?"verificação que precisa":"verificações que precisam")+" de atenção. Vou mostrar quais são."
    :semTeste.length?"As verificações concluídas não apontaram falhas, mas ainda existem ferramentas sem teste."
    :"As verificações disponíveis responderam bem. Continuo acompanhando!";
  const infoAtual=selecionado ? SERVICOS.find(s=>s.id===selecionado) : undefined;
  const grupoAtual=selecionado && selecionado in GRUPOS?GRUPOS[selecionado as Grupo]:undefined;
  const estadoAtual=grupoAtual?statusDasSondas(atual,grupoAtual.ids):selecionado?estado(selecionado):"nao_verificado";
  const tecnologia:Record<string,string>={
    site:"Página principal via HTTPS",api:"GET /api/saude/status",neon:"Neon PostgreSQL",worker:"Cloudflare Worker / PousadaHub",desbravador:"Motor Desbravador",
    openclaw:"OpenClaw / RPC channels.status",whatsapp:"Canal WhatsApp no OpenClaw",marina_site:"Configuração do chat no banco",
    voz:"ElevenLabs",blob:"Vercel Blob",dns:"DNS público",ssl:"HTTPS / TLS",autenticacao:"Página administrativa",
    mapas:"OpenFreeMap",regras:"Tabela regras_hospedagem",fotos:"Tabela midias",marina_conhecimento:"Tabela marina_config",
    whatsapp_vigia:"Registro de vigia",avisos:"Alertas externos",webhooks:"Webhooks e eventos"
  };
  const ferramentaSelecionada=atual?.servicos[selecionado??""];
  const exibir=useMemo(()=>SERVICOS.filter(s=>(s.nome+" "+s.simples+" "+tecnologia[s.id]).toLocaleLowerCase("pt-BR").includes(busca.toLocaleLowerCase("pt-BR"))),[busca]);
  const posicao=pos;

  return <div className={css.pagina}>
    <header className={css.topo}>
      <a href="/" className={css.marca} aria-label="Voltar ao site Marimar"><span className={css.flor}>✿</span><span><strong>marimar<span className={css.ponto}>.</span></strong><small>POUSADA • ILHA DO MEL</small></span></a>
      <div className={css.topoDireita}><span className={css.seguranca}><ShieldCheck size={15}/> Só acompanhamento</span><button className={css.atualizar} onClick={()=>void carregar()} disabled={buscando}><RefreshCw size={16} className={buscando?css.girando:""}/><span>Atualizar</span></button><a href="/" className={css.sair}><ArrowLeft size={15}/> Voltar ao site</a></div>
    </header>
    <main className={css.conteudo}>
      <section className={css.hero} id="intro-marina">
        <div className={css.heroGlowA}/><div className={css.heroGlowB}/><span className={css.seloHero}><span className={css.pulsinho}/> SUA CENTRAL DE CUIDADOS</span>
        <div className={css.heroTexto}><p className={css.boas}>Olá, Cecília! <span>✦</span></p><h1>A Marina está de olho <em>em tudo!</em></h1><p className={css.heroSub}>Sem palavras difíceis. Eu explico como estão os serviços que ajudam a cuidar da pousada.</p><div className={css.fala} role="status" aria-live="polite"><span className={css.falaIcon}><Heart size={18}/></span><p><strong>Marina conta:</strong> {resumo}</p></div><div className={css.heroMetadados}><span><Clock3 size={14}/> Última leitura: {atual?hora(atual.consultado_em):dados?hora(dados.consultado_em):"aguardando"}</span><span><LockKeyhole size={14}/> Não mexo em reservas ou mensagens</span></div></div>
        <div className={css.heroDeco}><div className={css.anel1}/><div className={css.anel2}/><Sparkles size={38}/><div className={css.pedestal}>MARINA <span>•</span> ACOMPANHANDO</div></div>
      </section>

      <section className={css.secao}>
        <div className={css.tituloSecao}><div><span className={css.sobrancelha}>RESUMO DA POUSADA</span><h2>Como estão as coisas?</h2><p>Escolha um assunto e eu explico o que consegui conferir.</p></div><span className={css.tempo}><span className={css.pulsinho}/> Atualização automática a cada 5 min</span></div>
        <div className={css.gradeQuatro}>{grupos.map(g=>{
          const Icon=g.icon;
          return <button id={"cartao-"+g.id} key={g.id} className={css.cartao} data-state={g.estado} onClick={()=>{setSelecionado(g.id);setMovimento(false)}} aria-label={g.titulo+", "+ROTULOS[g.estado]+". Abrir explicação"}>
            <div className={css.cartaoTopo}><span className={css.iconeGrupo}><Icon size={25}/></span><span className={css.status} data-state={g.estado}><span className={css.bolinha}/>{ROTULOS[g.estado]}</span></div>
            <h3>{g.titulo}</h3><p className={css.pergunta}>{g.subtitulo}</p><p className={css.descricao}>{g.descricao}</p>
            <span className={css.saiba}>Marina, me explica <ArrowRight size={16}/></span>
          </button>
        })}</div>
        <div className={css.avisoClareza}><Info size={18}/><span><b>Importante:</b> “Verificação OK” quer dizer que o teste indicado respondeu bem. Não é garantia de que todas as funções foram testadas. No WhatsApp, a consulta de preços por mensagem ainda não é comprovada por este painel.</span></div>
      </section>

      <section className={css.doisPaineis}>
        <div className={css.atencao}>
          <div className={css.painelCabecalho}><span className={css.iconeAtencao}><AlertTriangle size={21}/></span><div><span className={css.sobrancelha}>MARINA AVISA</span><h2>Precisa da sua atenção?</h2></div></div>
          {erro||stale?<div className={css.alertaLinha}><AlertCircle size={17}/><div><strong>Não foi possível confirmar os dados atuais</strong><p>Isso é uma falha de consulta do painel, não uma confirmação de que os serviços pararam.</p></div></div>
          :problemas.length? <div className={css.alertaLista}>{problemas.slice(0,4).map(s=><button key={s.id} className={css.alertaLinha} onClick={()=>setSelecionado(s.id)}><AlertCircle size={18}/><span><strong>{s.nome}</strong><small>{atual?.servicos[s.id]?.descricao??"A verificação não concluiu."}</small></span><ChevronRight size={16}/></button>)}{problemas.length>4&&<button className={css.verTodos} onClick={()=>setTecnico(true)}>Ver mais {problemas.length-4} alertas</button>}</div>
          :<div className={css.neutro}><CheckCircle2 size={27}/><div><strong>Nenhuma falha detectada nas verificações concluídas</strong><p>{semTeste.length?"Algumas ferramentas continuam sem teste; isso não significa que estejam funcionando ou com defeito.":"Os testes disponíveis responderam. A Marina continua acompanhando."}</p></div></div>}
        </div>
        <div className={css.comoTrabalha}>
          <div className={css.painelCabecalho}><span className={css.iconeExplica}><Sparkles size={21}/></span><div><span className={css.sobrancelha}>COMO EU TRABALHO</span><h2>O que a Marina faz?</h2></div></div>
          <div className={css.etapas}><div><span>1</span><p><b>Confiro os serviços</b><small>Peço informações reais, sem alterar os sistemas.</small></p></div><div><span>2</span><p><b>Entendo os resultados</b><small>Se algum teste falhar, marco para verificar.</small></p></div><div><span>3</span><p><b>Explico para você</b><small>Mostro o que aconteceu em palavras simples.</small></p></div></div>
          <div className={css.controleRobo}><button onClick={()=>setMovimento(v=>!v)}>{movimento?<Pause size={16}/>:<Play size={16}/>} {movimento?"Pausar passeio da Marina":"Marina, pode passear!"}</button><small>O passeio é visual. As verificações são feitas pelo servidor.</small></div>
        </div>
      </section>

      <section className={css.ferramentas}>
        <div className={css.painelCabecalho}><span className={css.iconeExplica}><Settings2 size={21}/></span><div><span className={css.sobrancelha}>BASTIDORES DA POUSADA</span><h2>Quais ferramentas a Marina acompanha?</h2><p>Você não precisa decorar os nomes. Toque para saber para que servem.</p></div></div>
        <div className={css.ferramentasGrid}>{AREAS.map(a=>{
          const Icon=a.icon;
          const itens=SERVICOS.filter(s=>s.area===a.id);
          const falhas=itens.filter(s=>estado(s.id)==="atencao"||estado(s.id)==="offline").length;
          return <details className={css.areaFerramenta} key={a.id}><summary><span className={css.areaIcon}><Icon size={20}/></span><span><strong>{a.nome}</strong><small>{itens.length} ferramentas acompanhadas{falhas?" • "+falhas+" pedem atenção":""}</small></span><ChevronDown size={18} className={css.setaResumo}/></summary><div className={css.areaLista}>{itens.map(s=><button key={s.id} onClick={()=>setSelecionado(s.id)}><span className={css.bolinha} data-state={estado(s.id)}/><span><b>{s.nome}</b><small>{s.simples}</small></span><ChevronRight size={16}/></button>)}</div></details>;
        })}</div>
      </section>

      <section className={css.tecnico}>
        <button className={css.tecnicoToggle} aria-expanded={tecnico} onClick={()=>setTecnico(v=>!v)}><span><Settings2 size={19}/><strong>Informações para o técnico</strong><small>Todos os 20 serviços, sondagens, tempos e incidentes</small></span><ChevronDown size={20} className={tecnico?css.girarSeta:""}/></button>
        {tecnico&&<div className={css.tecnicoCorpo}>
          <div className={css.estatisticas}>{(["online","atencao","offline","nao_verificado"] as Estado[]).map(s=><div key={s} data-state={s}><strong>{SERVICOS.filter(i=>estado(i.id)===s).length}</strong><small>{ROTULOS[s]}</small></div>)}</div>
          <label className={css.busca}><Search size={17}/><input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Pesquisar serviço ou tecnologia" aria-label="Pesquisar serviços técnicos"/></label>
          <div className={css.tabela} role="table" aria-label="Resultados das sondagens"><div role="row" className={css.tabelaCabecalho}><span>Ferramenta</span><span>Resultado</span><span>Tempo</span></div>{exibir.map(s=><button role="row" key={s.id} onClick={()=>setSelecionado(s.id)}><span><b>{tecnologia[s.id]}</b><small>{s.nome}</small></span><span data-state={estado(s.id)}>{ROTULOS[estado(s.id)]}</span><span>{atual?.servicos[s.id]?.latencia_ms!=null?atual.servicos[s.id].latencia_ms+" ms":"—"}</span></button>)}</div>
          <div className={css.tecnicoBlocos}><section><h3><Activity size={18}/> Tempo de resposta</h3>{amostras.length>1?<svg viewBox="0 0 500 140" role="img" aria-label="Latências verificadas nesta sessão" className={css.grafico}>{[0,1,2,3].map(i=><line key={i} x1="12" y1={20+i*32} x2="485" y2={20+i*32} stroke="#e4e6ef" strokeDasharray="4 6"/>)}{["desbravador","neon","openclaw"].map((id,j)=>{const pontos=amostras.map((a,i)=>a.latencias[id]!=null?{x:15+i*465/Math.max(1,amostras.length-1),y:125-Math.min(a.latencias[id]/2000,1)*100}:null);const gruposValidos:string[][]=[];let atualGrupo:string[]=[];for(const p of pontos){if(!p){if(atualGrupo.length)gruposValidos.push(atualGrupo);atualGrupo=[]}else atualGrupo.push(p.x+","+p.y)}if(atualGrupo.length)gruposValidos.push(atualGrupo);return gruposValidos.map((g,k)=>g.length>1?<polyline key={id+k} fill="none" stroke={["#8068d8","#1da68a","#e6a641"][j]} strokeWidth="3" points={g.join(" ")}/>:null)})}</svg>:<p>Aguardando mais leituras reais para formar o gráfico.</p>}<small>Somente medidas desta aba. Sem histórico salvo no servidor.</small></section><section><h3><Clock3 size={18}/> Incidentes desta sessão</h3>{registros.length?registros.slice(0,12).map((r,i)=><div className={css.incidente} key={r.id+"-"+r.inicio}><b>{SERVICOS.find(s=>s.id===r.id)?.nome??r.id}</b><small>{new Date(r.inicio).toLocaleTimeString("pt-BR")} • {r.fim?"Recuperou":"Em observação"}</small></div>):<p>Sem incidentes observados nesta aba. Isso não representa um histórico anterior.</p>}</section></div>
          <p className={css.notaTecnica}>As leituras vêm de <code>/api/saude/status</code> e podem ser armazenadas em cache por até cinco minutos. A Marina não envia mensagens, não cria reservas e não modifica o banco de dados por este painel.</p>
        </div>}
      </section>
    </main>
    <footer className={css.rodape}><span>✿ Pousada Marimar • Encantadas, Ilha do Mel</span><span>Marina acompanha e explica. Não executa correções.</span></footer>

    <div className={css.marinaPasseio} style={{left:posicao.x,top:posicao.y}} aria-hidden="true"><Robot estado={situacao} movendo={movimento}/><span className={css.marinaSombra}/></div>

    {selecionado&&<div className={css.fundoModal} onMouseDown={()=>setSelecionado(null)}><section className={css.modal} role="dialog" aria-modal="true" aria-label="Explicação da Marina" onMouseDown={e=>e.stopPropagation()}><button className={css.fechar} onClick={()=>setSelecionado(null)} aria-label="Fechar explicação"><X size={21}/></button><div className={css.modalTitulo}><span className={css.modalRobot}><Robot estado={estadoAtual} movendo={false}/></span><div><span className={css.sobrancelha}>MARINA EXPLICA</span><h2>{grupoAtual?grupoAtual.titulo:infoAtual?.nome??"Ferramenta"}</h2><span className={css.status} data-state={estadoAtual}><span className={css.bolinha}/>{ROTULOS[estadoAtual]}</span></div></div><p className={css.modalTexto}>{grupoAtual?grupoAtual.explicacao:infoAtual?.simples}</p>
       {grupoAtual?<div className={css.modalLeituras}><h3>O que consegui conferir?</h3>{grupoAtual.ids.map(id=><button onClick={()=>setSelecionado(id)} key={id}><span className={css.bolinha} data-state={estado(id)}/><span>{SERVICOS.find(s=>s.id===id)?.nome??id}</span><b>{ROTULOS[estado(id)]}</b><ChevronRight size={15}/></button>)}</div>:<div className={css.resultado}><h3>Resultado real da verificação</h3><p>{atual?.servicos[selecionado]?.descricao??"Não há resultado confirmado desta ferramenta nesta leitura."}</p><div><b>Como foi conferido:</b> {ferramentaSelecionada?.metodo??"Sem teste disponível"}.</div><div><b>Tempo do teste:</b> {ferramentaSelecionada?.latencia_ms!=null?ferramentaSelecionada.latencia_ms+" ms":"Não medido"}.</div><div><b>Nome técnico:</b> {tecnologia[selecionado]}.</div></div>}
       <p className={css.modalNota}><Info size={16}/> Os resultados são apenas dos testes descritos; a Marina não altera nada pelo painel.</p><button className={css.entendi} onClick={()=>setSelecionado(null)}>Entendi, Marina! <Heart size={16}/></button></section></div>}
  </div>;
}
