"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, AlertCircle, AlertTriangle, ArrowUpRight, BarChart3, Bot, Check,
  CheckCircle2, ChevronRight, Clock3, Cloud, Database, ExternalLink,
  FileText, Globe2, HardDrive, HeartPulse, Layers, LockKeyhole, MapPin, Menu,
  MessageCircle, Mic2, Network, Pause, Play, Radio, RefreshCw, Search,
  Server, ShieldCheck, ShieldQuestion, Sparkles, X
} from "lucide-react";
import css from "./saude-v2.module.css";

type Estado = "online" | "atencao" | "offline" | "nao_verificado";
type Sonda = { estado:Estado; latencia_ms:number|null; descricao:string; metodo?:string };
type Dados = { consultado_em:string; servicos:Record<string,Sonda>; historico_disponivel:false; intervalo_segundos:number };
type Item = { id:string; nome:string; categoria:string; grupo:string; descricao:string; dependencias:string[]; marca?:string };
type Amostra = {em:number; resultados:Record<string,Estado>; latencias:Record<string,number>};
type Incidente = { id:string; inicio:number; fim?:number; rotulo:string };
type Visao = "geral" | "sondas" | "incidentes" | "dependencias";

const itens:Item[] = [
 {id:"site",nome:"Site institucional",categoria:"Web",grupo:"site",descricao:"Página inicial no domínio oficial",dependencias:["dns","ssl","neon"],marca:"🌐"},
 {id:"api",nome:"API de observabilidade",categoria:"Web",grupo:"site",descricao:"Endpoint de saúde do próprio site",dependencias:[],marca:"⌘"},
 {id:"neon",nome:"Neon PostgreSQL",categoria:"Banco",grupo:"infra",descricao:"Conexão e SELECT 1",dependencias:[],marca:"▤"},
 {id:"worker",nome:"Cloudflare Worker",categoria:"Reservas",grupo:"reserva",descricao:"Disponibilidade do serviço PousadaHub",dependencias:["desbravador"],marca:"☁"},
 {id:"desbravador",nome:"Motor Desbravador",categoria:"Reservas",grupo:"reserva",descricao:"Consulta real de quartos e tarifas, sem reserva",dependencias:["worker","neon"],marca:"▦"},
 {id:"openclaw",nome:"Gateway OpenClaw",categoria:"Inteligência",grupo:"marina",descricao:"Consulta autenticada do estado dos canais",dependencias:[],marca:"✳"},
 {id:"whatsapp",nome:"Marina no WhatsApp",categoria:"Mensagens",grupo:"marina",descricao:"Estado de conexão informado pelo OpenClaw",dependencias:["openclaw"],marca:"☎"},
 {id:"marina_site",nome:"Marina no site",categoria:"Chat",grupo:"marina",descricao:"Configuração de chat ativa no banco",dependencias:["neon","openclaw"],marca:"☺"},
 {id:"voz",nome:"ElevenLabs",categoria:"Voz",grupo:"marina",descricao:"Acesso autorizado à conta de voz",dependencias:[],marca:"♫"},
 {id:"blob",nome:"Vercel Blob",categoria:"Mídias",grupo:"infra",descricao:"Listagem somente leitura do armazenamento",dependencias:[],marca:"▣"},
 {id:"dns",nome:"DNS público",categoria:"Rede",grupo:"infra",descricao:"Resolução do domínio principal",dependencias:[],marca:"◉"},
 {id:"ssl",nome:"HTTPS / TLS",categoria:"Segurança",grupo:"infra",descricao:"Conexão HTTPS válida no site; não mede expiração",dependencias:["dns"],marca:"◇"},
 {id:"autenticacao",nome:"Entrada administrativa",categoria:"Acesso",grupo:"site",descricao:"Acessibilidade da página de login; não testa sessões",dependencias:["neon"],marca:"⚿"},
 {id:"mapas",nome:"Mapas OpenFreeMap",categoria:"Mapa",grupo:"site",descricao:"Leitura do estilo de mapa utilizado no site",dependencias:[],marca:"⌖"},
 {id:"regras",nome:"Regras de hospedagem",categoria:"Reservas",grupo:"reserva",descricao:"Leitura da tabela de regras de ocupação",dependencias:["neon"],marca:"≡"},
 {id:"fotos",nome:"Biblioteca de mídias",categoria:"Mídia",grupo:"site",descricao:"Leitura da tabela de fotos e vídeos",dependencias:["neon","blob"],marca:"▧"},
 {id:"marina_conhecimento",nome:"Base da Marina",categoria:"Inteligência",grupo:"marina",descricao:"Leitura da configuração de conhecimento",dependencias:["neon"],marca:"◈"},
 {id:"whatsapp_vigia",nome:"Vigia do WhatsApp",categoria:"Inteligência",grupo:"marina",descricao:"Recência registrada da última atividade do vigia",dependencias:["neon","openclaw"],marca:"◷"},
 {id:"avisos",nome:"Alertas externos",categoria:"Alertas",grupo:"infra",descricao:"Envio não testado para proteger os destinatários",dependencias:["openclaw"],marca:"✉"},
 {id:"webhooks",nome:"Webhooks e eventos",categoria:"Integrações",grupo:"infra",descricao:"Recebimento de eventos; envio de teste não realizado",dependencias:["api"],marca:"⌁"}
];
const servico = Object.fromEntries(itens.map(x=>[x.id,x])) as Record<string,Item>;
const visibleBoard = ["site","api","neon","worker","desbravador","openclaw","whatsapp","marina_site","voz","blob","dns","ssl"];
const grupoLabel:Record<string,string>={todos:"Tudo",site:"Site & apps",reserva:"Reservas",marina:"Marina & IA",infra:"Infraestrutura"};
const statusNome:Record<Estado,string>={online:"Respondendo",atencao:"Atenção",offline:"Fora do ar",nao_verificado:"Não verificado"};

function Robot({expressao,pequeno=false,andando=true}:{expressao:Estado;pequeno?:boolean;andando?:boolean}){
 const olhos=expressao==="atencao"||expressao==="offline"?"surpreso":expressao==="nao_verificado"?"curioso":"feliz";
 return <svg className={[css.marinaSvg,pequeno?css.marinaPequena:"",andando?css.marinaAndando:""].join(" ")} viewBox="0 0 150 184" role="img" aria-label={"Marina, robô assistente, expressão "+statusNome[expressao]}>
    <ellipse cx="77" cy="176" rx="36" ry="5" fill="#8d86d5" opacity=".18"/>
    <g className={css.marinaPernaEsq}><rect x="47" y="132" width="18" height="36" rx="9" fill="#f1f6ff" stroke="#b1bfe7" strokeWidth="2"/><ellipse cx="55" cy="166" rx="15" ry="7" fill="#a6a5ed"/></g>
    <g className={css.marinaPernaDir}><rect x="87" y="132" width="18" height="36" rx="9" fill="#edf5ff" stroke="#b1bfe7" strokeWidth="2"/><ellipse cx="95" cy="166" rx="15" ry="7" fill="#abaaf0"/></g>
    <rect x="48" y="94" width="62" height="58" rx="28" fill="#f4f8ff" stroke="#adbee9" strokeWidth="3"/>
    <path d="M53 115Q75 101 105 115" stroke="white" strokeWidth="7" opacity=".65" fill="none"/>
    <circle cx="79" cy="121" r="9" fill="#a28aea"/><path d="M76 121h6" stroke="#ffffff" strokeWidth="2" strokeLinecap="round"/>
    <g className={css.marinaBracoEsq}><path d="M49 106 Q31 116 27 132" stroke="#d3e2ff" strokeWidth="15" strokeLinecap="round" fill="none"/><circle cx="26" cy="135" r="9" fill="#eef6ff" stroke="#a3b6e4" strokeWidth="2"/></g>
    <g className={css.marinaBracoDir}><path d="M109 106 Q128 110 136 89" stroke="#d7e2fc" strokeWidth="15" strokeLinecap="round" fill="none"/><circle cx="138" cy="86" r="10" fill="#eef6ff" stroke="#a3b6e4" strokeWidth="2"/></g>
    <g className={css.marinaCabeca}>
      <rect x="68" y="9" width="16" height="18" rx="8" fill="#cdd7f0"/>
      <circle cx="76" cy="10" r="6" fill="#66dfe8"/>
      <rect x="7" y="25" width="137" height="85" rx="35" fill="#f5f8ff" stroke="#adbdeb" strokeWidth="3"/>
      <rect x="18" y="36" width="116" height="64" rx="25" fill="#1b2850"/>
      <rect x="1" y="52" width="17" height="29" rx="8" fill="#dce7ff"/><circle cx="9" cy="66" r="5" fill="#8b78e5"/>
      <rect x="134" y="52" width="16" height="29" rx="8" fill="#dce7ff"/><circle cx="143" cy="66" r="5" fill="#8b78e5"/>
      <path d="M29 45Q43 35 62 41" stroke="#e8f9ff" strokeWidth="5" strokeLinecap="round" opacity=".55" fill="none"/>
      {olhos==="feliz"?<g className={css.olhos}><path d="M41 71 Q51 57 61 71M89 71Q99 57 109 71" stroke="#5ee5f1" strokeWidth="6" strokeLinecap="round" fill="none"/><path d="M64 81Q77 94 90 81" stroke="#5ee5f1" strokeWidth="5" strokeLinecap="round" fill="none"/></g>:
       olhos==="surpreso"?<g className={css.olhos}><ellipse cx="52" cy="68" rx="8" ry="11" fill="#5fe6f1"/><ellipse cx="99" cy="68" rx="8" ry="11" fill="#5fe6f1"/><ellipse cx="76" cy="85" rx="6" ry="8" fill="#5fe6f1"/></g>:
       <g className={css.olhos}><circle cx="52" cy="68" r="7" fill="#5fe6f1"/><circle cx="99" cy="68" r="7" fill="#5fe6f1"/><path d="M71 84Q77 81 83 84" stroke="#5fe6f1" strokeWidth="5" strokeLinecap="round" fill="none"/></g>}
    </g>
  </svg>
}

function Hora({data}:{data:string}){return <>{new Date(data).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}</>}

export default function SaudeV2(){
 const [dados,setDados]=useState<Dados|null>(null);
 const [erro,setErro]=useState(false);
 const [buscando,setBuscando]=useState(false);
 const [grupo,setGrupo]=useState("todos");
 const [busca,setBusca]=useState("");
 const [visao,setVisao]=useState<Visao>("geral");
 const [selecionado,setSelecionado]=useState("desbravador");
 const [detalhe,setDetalhe]=useState<string|null>(null);
 const [ronda,setRonda]=useState(true);
 const [amostras,setAmostras]=useState<Amostra[]>([]);
 const [incidentes,setIncidentes]=useState<Incidente[]>([]);
 const [hora,setHora]=useState(0);
 const [menuAberto,setMenuAberto]=useState(false);
 const carregar=useCallback(async()=>{
   setBuscando(true);
   try{
     const r=await fetch("/api/saude/status",{cache:"no-store"});
     if(!r.ok)throw Error("falha");
     const json=await r.json() as Dados;
     setDados(json);setErro(false);
     const novos=Object.fromEntries(Object.entries(json.servicos).map(([id,s])=>[id,s.estado])) as Record<string,Estado>;
     const lat=Object.fromEntries(Object.entries(json.servicos).filter(([,s])=>s.latencia_ms!==null).map(([id,s])=>[id,s.latencia_ms as number])) as Record<string,number>;
     setAmostras(a=>[...a.slice(-29),{em:Date.now(),resultados:novos,latencias:lat}]);
     setIncidentes(old=>{
       const updated=old.map(ev=>ev.fim?ev:(novos[ev.id]==="online"?{...ev,fim:Date.now()}:ev));
       const idsAbertos=new Set(updated.filter(ev=>!ev.fim).map(ev=>ev.id));
       for(const [id,v] of Object.entries(novos)){
         if((v==="atencao"||v==="offline")&&!idsAbertos.has(id))updated.unshift({id,inicio:Date.now(),rotulo:servico[id]?.nome??id});
       }
       return updated.slice(0,40);
     });
   }catch{setErro(true)}finally{setBuscando(false)}
 },[]);
 useEffect(()=>{void carregar();const id=setInterval(()=>void carregar(),300000);return()=>clearInterval(id)},[carregar]);
 useEffect(()=>{setHora(Date.now());const t=setInterval(()=>setHora(Date.now()),1000);return()=>clearInterval(t)},[]);
 useEffect(()=>{if(!ronda)return;const t=setInterval(()=>setSelecionado(x=>visibleBoard[(visibleBoard.indexOf(x)+1)%visibleBoard.length]),5500);return()=>clearInterval(t)},[ronda]);
 useEffect(()=>{const fn=(e:KeyboardEvent)=>{if(e.key==="Escape")setDetalhe(null)};window.addEventListener("keydown",fn);return()=>window.removeEventListener("keydown",fn)},[]);
 const estado=useCallback((id:string):Estado=>dados?.servicos[id]?.estado??"nao_verificado",[dados]);
 const total=itens.length;
 const contando=(s:Estado)=>itens.filter(x=>estado(x.id)===s).length;
 const online=contando("online"),atencao=contando("atencao"),offline=contando("offline"),nao=contando("nao_verificado");
 const lista=useMemo(()=>itens.filter(x=>(grupo==="todos"||x.grupo===grupo)&&(x.nome+" "+x.descricao+" "+x.categoria).toLocaleLowerCase("pt-BR").includes(busca.toLocaleLowerCase("pt-BR"))),[grupo,busca]);
 const foco=servico[selecionado]??itens[0];
 const perigo=offline>0||atencao>0;
 const mensagem=perigo?"Marina encontrou verificações que precisam de atenção.":"Marina está verificando os módulos disponíveis.";
 const mapaPos=visibleBoard.indexOf(selecionado);
 const pos=mapaPos<0?4:mapaPos;
 const cols=4;
 const roboX=(pos%cols)*25+12.5;
 const roboY=(Math.floor(pos/cols))*33.33+12;
 const mudarVisao=(v:Visao)=>{setVisao(v);setMenuAberto(false);document.getElementById("saude-conteudo")?.scrollIntoView({behavior:"smooth",block:"start"})};

 return <div className={css.aplicacao}>
  <aside className={[css.sidebar,menuAberto?css.sidebarAberta:""].join(" ")}>
   <a href="/" className={css.logo}><span className={css.logoIcon}>✿</span><span><b>Marimar</b><small>POUSADA • ENCANTADAS</small></span></a>
   <div className={css.sideLabel}>MONITORAMENTO</div>
   <nav aria-label="Seções do painel" className={css.navegacao}>
    {([
      ["geral",HeartPulse,"Visão geral"],["sondas",Radio,"Sondas e serviços"],
      ["incidentes",AlertTriangle,"Incidentes"],["dependencias",Network,"Dependências"]
    ] as const).map(([id,Icon,txt])=><button key={id} className={visao===id?css.navAtiva:""} onClick={()=>mudarVisao(id)}><Icon size={18}/><span>{txt}</span></button>)}
   </nav>
   <div className={css.sideLabel}>ACESSO RÁPIDO</div>
   <nav aria-label="Atalhos" className={css.navegacao}>
    {(["desbravador","neon","openclaw","whatsapp"] as const).map(id=><button key={id} onClick={()=>{setDetalhe(id);setSelecionado(id);setMenuAberto(false)}}><span className={css.navDot} data-state={estado(id)}></span><span>{servico[id].nome}</span></button>)}
   </nav>
   <div className={css.sidebarRodape}><div className={css.miniMarina}><Robot pequeno andando={false} expressao={perigo?"atencao":"online"}/><div><b>Marina</b><small>Ronda visual ativa</small></div></div><p>Diagnóstico apenas de leitura. Não executa reparos.</p><a href="/">← Voltar para a pousada</a></div>
  </aside>
  <main className={css.main}>
   <header className={css.topo}>
    <div className={css.topoTitulo}><button className={css.menuToggle} aria-label="Abrir menu" onClick={()=>setMenuAberto(v=>!v)}><Menu size={21}/></button><div><div className={css.subtitulo}>CENTRAL DE OBSERVABILIDADE · MARIMAR</div><h1>Saúde da Plataforma <span>✦</span></h1><p>Todos os serviços que sustentam o site, as reservas e a Marina.</p></div></div>
    <div className={css.topoAcoes}><span className={css.selo}><span className={css.dot} data-state={perigo?"atencao":online?"online":"nao_verificado"}/>{erro?"Telemetria indisponível":perigo?"Alguns serviços precisam de atenção":"Sondagem ativa"}</span><div className={css.atualizado}><b>{dados?<Hora data={dados.consultado_em}/>:"—"}</b><small>Última leitura</small></div><button className={css.botaoAtualizar} disabled={buscando} onClick={()=>void carregar()} aria-label="Atualizar sondas"><RefreshCw size={17} className={buscando?css.girando:""}/><span>Atualizar</span></button></div>
   </header>

   <section className={css.indicadores} aria-label="Resumo da saúde">
    {[[Layers,total,"Mapeados","violet"],[CheckCircle2,online,"Respondendo","green"],[Clock3,atencao,"Em atenção","yellow"],[AlertCircle,offline,"Fora do ar","red"],[ShieldQuestion,nao,"Sem verificação","blue"]] .map(([Icon,num,lab,color])=><div className={css.indicador} key={String(lab)}><span className={css.indicadorIcone} data-color={String(color)}>{typeof Icon==="function"?<Icon size={22}/>:null}</span><strong>{num as number}</strong><small>{lab as string}</small></div>)}
   </section>

   <section className={css.corpo} id="saude-conteudo">
    {(visao==="geral"||visao==="dependencias")&&<div className={css.painelMapa}>
     <div className={css.tituloCard}><div><span className={css.legendaMaior}>ESCRITÓRIO INTERATIVO</span><h2>{visao==="dependencias"?"Mapa de dependências":"O mapa dos serviços"}</h2><p>Clique nos módulos. A Marina caminha e apresenta os resultados da sondagem.</p></div><div className={css.mapaAcoes}><button onClick={()=>setRonda(x=>!x)}>{ronda?<Pause size={13}/>:<Play size={13}/>} {ronda?"Pausar ronda":"Retomar"}</button></div></div>
     <div className={css.mapaScroll}><div className={css.cenario}>
       <div className={css.ilhaFundo}><span>☀</span><i>ILHA DO MEL</i><div className={css.arvores}>♣　♣　　　　 ♣　♣</div></div>
       <div className={css.linhas}>
        <svg viewBox="0 0 1120 505" preserveAspectRatio="none" aria-hidden="true">
          <path d="M118 100L360 100L615 100L865 100M118 250L360 250L615 250L865 250M118 406L360 406L615 406L865 406M120 100L120 405M360 100L360 406M615 100L615 406M865 100L865 405" fill="none" stroke="#b8c6ef" strokeWidth="3" strokeDasharray="12 10" opacity=".7"/>
        </svg>
       </div>
       {visibleBoard.map((id,i)=>{const item=servico[id],s=estado(id);return <button key={id} className={css.modulo} data-state={s} data-focus={id===selecionado?"true":"false"} style={{left:`${(i%4)*25+12.5}%`,top:`${Math.floor(i/4)*33.33+9}%`}} onClick={()=>{setSelecionado(id);setRonda(false);setDetalhe(id)}}><div className={css.moduloBase}><span className={css.moduloIcone}>{item.marca}</span><b>{item.nome}</b><span className={css.moduloSub}><i className={css.dot} data-state={s}></i>{statusNome[s]}</span><span className={css.moduloMs}>{dados?.servicos[id]?.latencia_ms!=null?`${dados.servicos[id].latencia_ms} ms`:"Sem latência"}</span></div></button>})}
       <div className={css.roboNoMapa} style={{left:`${roboX}%`,top:`${roboY}%`}}><span className={css.balaoRobo}>{estado(selecionado)==="online"?"Tudo certo neste módulo!":estado(selecionado)==="nao_verificado"?"Vou precisar de uma sonda aqui.":"Encontrei algo para investigar!"}</span><Robot expressao={estado(selecionado)} andando={ronda}/></div>
       <span className={css.cenarioLegenda}>● PONTOS DE SONDA · SÓ LEITURA · 2.5D CSS</span>
      </div></div>
     <div className={css.rodapeMapa}><div><span className={css.dot} data-state="online"></span> Confirmado <span className={css.dot} data-state="atencao"></span> Atenção <span className={css.dot} data-state="nao_verificado"></span> Não verificado</div><span>Deslize o mapa no celular para explorar →</span></div>
    </div>}

    {(visao==="geral"||visao==="dependencias")&&<aside className={css.lateral}>
     <div className={css.cardMarina}><div className={css.cardMarinaTopo}><Robot pequeno expressao={estado(selecionado)} andando={false}/><div><span className={css.etiquetaRoxa}>✳ AGENTE VISUAL</span><h3>Marina</h3><small>{ronda?"Percorrendo os serviços":"Inspecionando um módulo"}</small></div></div><p>{mensagem}</p><div className={css.verificando}><span>AGORA ANALISANDO</span><b>{foco.nome}</b><small>{dados?.servicos[selecionado]?.descricao??"Ainda sem resultado de sondagem para este serviço."}</small></div><button onClick={()=>setDetalhe(selecionado)}>Ver relatório da Marina <ChevronRight size={15}/></button></div>
     <div className={css.cardSimples}><div className={css.cardCabecalho}><b>Verificações mais recentes</b><Radio size={16}/></div>{["desbravador","worker","neon","openclaw","whatsapp","voz"].map(id=><button key={id} className={css.ultimaSonda} onClick={()=>setDetalhe(id)}><span className={css.dot} data-state={estado(id)}></span><span>{servico[id].nome}</span><small>{dados?.servicos[id]?.latencia_ms!=null?`${dados.servicos[id].latencia_ms} ms`:"—"}</small><ChevronRight size={14}/></button>)}</div>
     <div className={css.cardAviso}><LockKeyhole size={19}/><p><b>Nenhuma ação automática</b><br/>A Marina apresenta o diagnóstico, mas não altera reservas, banco, WhatsApp nem configurações.</p></div>
    </aside>}

    {(visao==="geral"||visao==="sondas")&&<section className={css.gradePainel}>
      <div className={css.tituloCard}><div><span className={css.legendaMaior}>SONDAS REAIS</span><h2>O que está respondendo agora?</h2><p>Status obtido por consultas de leitura. Não confunda falta de sonda com falha do serviço.</p></div></div>
      <div className={css.gradeAtalhos}>{(["desbravador","worker","neon","openclaw","whatsapp","voz"] as const).map(id=><button onClick={()=>setDetalhe(id)} key={id} className={css.cardAtalho} data-state={estado(id)}><span className={css.atIcon}>{servico[id].marca}</span><div><strong>{servico[id].nome}</strong><small>{statusNome[estado(id)]}</small></div><ChevronRight size={16}/></button>)}</div>
    </section>}

    {(visao==="geral"||visao==="incidentes")&&<section className={css.gradePainel}>
      <div className={css.tituloCard}><div><span className={css.legendaMaior}>ACOMPANHAMENTO</span><h2>Incidentes detectados</h2><p>Histórico desta aba desde que você a abriu; ainda não existe armazenamento histórico no servidor.</p></div></div>
      <div className={css.timeline}>{incidentes.length===0?<div className={css.vazio}><CheckCircle2 size={22}/><div><b>Nenhum incidente observado nesta sessão</b><small>Se uma sonda falhar, um evento de início e recuperação será registrado aqui.</small></div></div>:incidentes.map((e,i)=><div className={css.evento} key={e.id+e.inicio}><span className={css.eventoIcone}>{e.fim?<Check size={15}/>:<AlertTriangle size={15}/>}</span><div><b>{e.rotulo}</b><small>Detectado às {new Date(e.inicio).toLocaleTimeString("pt-BR")} · {e.fim?"Resolvido":"Em observação"} · {Math.floor(((e.fim??hora)-e.inicio)/1000)} s observados</small></div></div>)}</div>
    </section>}

    {(visao==="geral")&&<section className={css.gradePainel}>
      <div className={css.tituloCard}><div><span className={css.legendaMaior}>TEMPO DE RESPOSTA</span><h2>Últimas leituras da página</h2><p>Latências medidas nesta sessão; atualizações ocorrem a cada 5 minutos.</p></div></div>
      <div className={css.grafico}>{amostras.length<=1?<div className={css.semGrafico}><BarChart3 size={28}/><b>Aguardando novas amostras reais</b><small>Não mostramos gráficos ou disponibilidade histórica inventados.</small></div>:<svg viewBox="0 0 600 155" role="img" aria-label="Gráfico com medidas reais de latência de Desbravador e banco Neon">{["desbravador","neon","openclaw"].map((id,j)=>{const points=amostras.map((a,i)=>{const v=a.latencias[id];if(v===undefined)return null;return `${35+(i/(Math.max(1,amostras.length-1)))*530},${140-Math.min(1,v/1800)*115}`}).filter(Boolean).join(" ");return points?<polyline key={id} fill="none" stroke={["#8771ee","#28c79f","#eeab4e"][j]} strokeWidth="3" points={points}/>:null})}{[0,1,2,3,4].map(i=><line key={i} x1="30" y1={20+i*30} x2="570" y2={20+i*30} stroke="#dedff0" strokeDasharray="5 6"/>)}</svg>}</div>
    </section>}

    {(visao==="sondas"||visao==="geral"||visao==="dependencias")&&<section className={css.catalogo}>
     <div className={css.tituloCard}><div><span className={css.legendaMaior}>CATÁLOGO COMPLETO</span><h2>Serviços e dependências</h2><p>20 componentes reais mapeados. Selecione para ver o que a sonda mede e o que ainda falta.</p></div><span className={css.totalServicos}>{total} serviços</span></div>
     <div className={css.buscaLinha}><div className={css.buscaCampo}><Search size={16}/><input aria-label="Buscar um serviço" placeholder="Pesquisar serviço, tecnologia ou categoria..." value={busca} onChange={e=>setBusca(e.target.value)}/></div><div className={css.abasCategorias}>{Object.entries(grupoLabel).map(([id,txt])=><button key={id} className={grupo===id?css.abaAtiva:""} onClick={()=>setGrupo(id)}>{txt}</button>)}</div></div>
     <div className={css.listaServicos}>{lista.map(item=><button key={item.id} onClick={()=>{setDetalhe(item.id);setSelecionado(item.id)}} className={css.linhaServico}><span className={css.listaIcone}>{item.marca}</span><span className={css.listaNome}><b>{item.nome}</b><small>{item.descricao}</small></span><span className={css.statusPill} data-state={estado(item.id)}><span className={css.dot} data-state={estado(item.id)}></span>{statusNome[estado(item.id)]}</span><span className={css.latencia}>{dados?.servicos[item.id]?.latencia_ms!=null?`${dados.servicos[item.id].latencia_ms} ms`:"—"}</span><ChevronRight size={16}/></button>)}</div>
     {lista.length===0&&<p className={css.nadaEncontrado}>Nenhum serviço com esse nome.</p>}
    </section>}
   </section>
   <footer className={css.rodape}><span>Marimar • Central de Saúde • leitura e diagnóstico sem alterações</span><span>Monitoramento periódico com cache de 5 min · <a href="/">Ir para o site</a></span></footer>
  </main>
  {detalhe&&<div className={css.sombraModal} role="presentation" onClick={()=>setDetalhe(null)}><section className={css.modal} role="dialog" aria-modal="true" aria-label={"Status de "+servico[detalhe].nome} onClick={e=>e.stopPropagation()}><div className={css.modalCabecalho}><div><span className={css.modalIcone}>{servico[detalhe].marca}</span><h2>{servico[detalhe].nome}</h2></div><button aria-label="Fechar detalhes" onClick={()=>setDetalhe(null)}><X size={19}/></button></div><div className={css.modalCorpo}><span className={css.statusPill} data-state={estado(detalhe)}><span className={css.dot} data-state={estado(detalhe)}></span>{statusNome[estado(detalhe)]}</span><h3>O que está sendo conferido</h3><p>{servico[detalhe].descricao}</p><div className={css.resultadoSonda}><b>{dados?.servicos[detalhe]?.metodo??"Sonda ainda indisponível"}</b><p>{dados?.servicos[detalhe]?.descricao??"Este componente foi mapeado, mas ainda não oferece um teste isolado e seguro."}</p><small>Última latência: {dados?.servicos[detalhe]?.latencia_ms!=null?`${dados.servicos[detalhe].latencia_ms} ms`:"não medida"}</small></div><h3>Dependências do componente</h3><div className={css.dependenciasLista}>{servico[detalhe].dependencias.length?servico[detalhe].dependencias.map(id=><button key={id} onClick={()=>{setDetalhe(id);setSelecionado(id)}}>{servico[id]?.nome??id} <ChevronRight size={13}/></button>):<p>Não há dependências diretas catalogadas.</p>}</div><p className={css.avisoModal}>O status indica apenas o alcance da sonda descrita. Ele não garante desempenho, envio de mensagens, disponibilidade de créditos ou funcionamento de todas as etapas do serviço.</p></div></section></div>}
 </div>;
}
