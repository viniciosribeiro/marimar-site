"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, AlertCircle, ArrowLeft, Check, ChevronDown, ChevronRight, CircleHelp, Clock3, Globe2, Heart, Info, MessageCircle, Move, Pause, Play, RefreshCw, ShieldCheck, Sparkles, X } from "lucide-react";
import styles from "./saude-simples.module.css";

type Estado = "online" | "atencao" | "offline" | "nao_verificado";
type Sonda = { estado: Estado; latencia_ms: number | null; descricao: string; metodo?: string };
type Dados = { consultado_em: string; servicos: Record<string, Sonda>; intervalo_segundos: number };
type Grupo = "site" | "reservas" | "whatsapp";
type Animacao = "parada" | "andar" | "pular";

const grupos: { id: Grupo; titulo: string; pergunta: string; ids: string[]; detalhe: string; legenda: string }[] = [
  { id: "site", titulo: "Site", pergunta: "As pessoas conseguem acessar a pousada?", ids: ["site", "dns", "ssl"], detalhe: "Confiro se a página da pousada abre, se o endereço é encontrado e se o acesso HTTPS responde.", legenda: "Abertura, endereço e conexão segura" },
  { id: "reservas", titulo: "Reservas", pergunta: "Conseguimos consultar quartos e preços?", ids: ["desbravador", "worker", "regras"], detalhe: "Faço uma consulta real de quartos e tarifas sem criar nenhuma reserva. Isso não testa todas as datas.", legenda: "Consulta de tarifas sem criar reservas" },
  { id: "whatsapp", titulo: "WhatsApp", pergunta: "A conexão do atendimento está respondendo?", ids: ["whatsapp", "openclaw", "whatsapp_vigia"], detalhe: "Confiro a conexão registrada pelo sistema de atendimento e o registro do vigia. Não envio mensagem e não consigo garantir que a Marina respondeu um hóspede ou informou preços.", legenda: "Conexão e atividade, sem enviar mensagens" },
];
const nomes: Record<string, string> = {
  site: "Acesso ao site", api: "Central de verificações", neon: "Banco de informações", worker: "Servidor de reservas",
  desbravador: "Consulta de tarifas", openclaw: "Conexão da Marina", whatsapp: "WhatsApp", marina_site: "Marina no site",
  voz: "Voz da Marina", blob: "Arquivos e imagens", dns: "Endereço do site", ssl: "Conexão segura",
  autenticacao: "Entrada administrativa", mapas: "Mapas", regras: "Regras de hospedagem", fotos: "Fotos",
  marina_conhecimento: "Conhecimentos da Marina", whatsapp_vigia: "Acompanhamento do WhatsApp",
  avisos: "Avisos externos", webhooks: "Comunicação entre serviços",
};
const statusNome: Record<Estado, string> = {
  online: "OK na verificação", atencao: "Precisa de atenção", offline: "Com problema", nao_verificado: "Não verificado",
};
const estadoIds = (dados: Dados | null, ids: string[]): Estado => {
  if (!dados) return "nao_verificado";
  const estados = ids.map(id => dados.servicos[id]?.estado ?? "nao_verificado");
  if (estados.includes("offline")) return "offline";
  if (estados.includes("atencao")) return "atencao";
  if (estados.includes("nao_verificado")) return "nao_verificado";
  return "online";
};
const limitar = (n: number, min: number, max: number) => Math.min(Math.max(n, min), Math.max(min, max));

function MarinaSvg({ estado, animacao }: { estado: Estado; animacao: Animacao }) {
  const atencao = estado === "offline" || estado === "atencao";
  return <svg className={[styles.roboSvg, animacao === "andar" ? styles.andando : "", animacao === "pular" ? styles.pulando : ""].join(" ")} viewBox="0 0 200 260" role="img" aria-label="Marina, robozinha com logo da Marimar no peito">
    <defs>
      <linearGradient id="marina-corpo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff"/><stop offset=".5" stopColor="#edf5ff"/><stop offset="1" stopColor="#b7c9eb"/></linearGradient>
      <linearGradient id="marina-visao" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#213f73"/><stop offset="1" stopColor="#101e46"/></linearGradient>
      <linearGradient id="marina-roupa" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff"/><stop offset="1" stopColor="#cbdef4"/></linearGradient>
    </defs>
    <ellipse cx="100" cy="246" rx="59" ry="7" fill="#263a57" opacity=".14"/>
    <g className={styles.pernaEsq}><rect x="62" y="186" width="27" height="42" rx="12" fill="url(#marina-corpo)" stroke="#9bb7d7" strokeWidth="2.5"/><ellipse cx="72" cy="225" rx="25" ry="10" fill="#8db2d7"/></g>
    <g className={styles.pernaDir}><rect x="110" y="186" width="27" height="42" rx="12" fill="url(#marina-corpo)" stroke="#9bb7d7" strokeWidth="2.5"/><ellipse cx="124" cy="225" rx="25" ry="10" fill="#8db2d7"/></g>
    <g className={styles.bracoEsq}><path d="M53 143 Q33 149 24 175" stroke="#d7e9ff" strokeWidth="21" strokeLinecap="round" fill="none"/><circle cx="24" cy="179" r="14" fill="url(#marina-corpo)" stroke="#b5cce8" strokeWidth="2"/></g>
    <g className={styles.bracoDir}><path d="M149 143 Q174 153 176 174" stroke="#d7e9ff" strokeWidth="21" strokeLinecap="round" fill="none"/><circle cx="176" cy="179" r="14" fill="url(#marina-corpo)" stroke="#b5cce8" strokeWidth="2"/></g>
    <rect x="52" y="124" width="97" height="82" rx="37" fill="url(#marina-roupa)" stroke="#abc3df" strokeWidth="3"/>
    <path d="M64 145 Q104 133 139 145" fill="none" stroke="#fff" strokeWidth="7" opacity=".85"/>
    <rect x="75" y="149" width="52" height="38" rx="12" fill="#fff" stroke="#b7d4e4" strokeWidth="1.5"/>
    <image href="/marimar-chest-logo.webp" x="79" y="151" width="44" height="25" preserveAspectRatio="xMidYMid meet"/>
    <text x="101" y="182" textAnchor="middle" fontFamily="Georgia,serif" fontSize="7.9" fontWeight="bold" fill="#11275c">Marimar</text>
    <g className={styles.cabeca}><rect x="90" y="13" width="20" height="23" rx="9" fill="#d7e8fc"/><circle cx="100" cy="12" r="9" fill="#58ddd2"/>
      <rect x="10" y="35" width="180" height="113" rx="50" fill="url(#marina-corpo)" stroke="#a6bfdf" strokeWidth="4"/>
      <rect x="24" y="49" width="152" height="84" rx="38" fill="url(#marina-visao)"/>
      <rect x="0" y="72" width="25" height="40" rx="12" fill="#d7e8fc"/><circle cx="12" cy="92" r="6" fill="#5acfc3"/>
      <rect x="175" y="72" width="25" height="40" rx="12" fill="#d7e8fc"/><circle cx="187" cy="92" r="6" fill="#5acfc3"/>
      <path d="M42 61 Q61 52 81 57" stroke="#a9d8f8" strokeWidth="7" strokeLinecap="round" opacity=".42" fill="none"/>
      <g className={styles.olhos}>{atencao ?
        <><ellipse cx="69" cy="91" rx="10" ry="14" fill="#68f4e7"/><ellipse cx="131" cy="91" rx="10" ry="14" fill="#68f4e7"/><ellipse cx="100" cy="119" rx="7" ry="9" fill="#68f4e7"/></> :
        estado === "nao_verificado" ? <><ellipse cx="69" cy="92" rx="10" ry="12" fill="#68f4e7"/><ellipse cx="131" cy="92" rx="10" ry="12" fill="#68f4e7"/><path d="M91 116Q100 112 108 116" stroke="#68f4e7" strokeWidth="5" strokeLinecap="round" fill="none"/></> :
        <><path d="M56 97Q69 77 82 97M118 97Q131 77 144 97" stroke="#68f4e7" strokeWidth="8" strokeLinecap="round" fill="none"/><path d="M87 112Q100 126 113 112" stroke="#68f4e7" strokeWidth="5" strokeLinecap="round" fill="none"/></>}
      </g>
    </g>
  </svg>;
}

export default function SaudeSimples() {
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [agora, setAgora] = useState(Date.now());
  const [explicando, setExplicando] = useState<Grupo | null>(null);
  const [fala, setFala] = useState<string | null>(null);
  const [passeando, setPasseando] = useState(true);
  const [animacao, setAnimacao] = useState<Animacao>("parada");
  const [posicao, setPosicao] = useState({x: 0, y: 0});
  const [localizado, setLocalizado] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const [aberto, setAberto] = useState(false);
  const roboRef = useRef<HTMLDivElement>(null);
  const movimentoRef = useRef<{pointer: number; inicioX: number; inicioY: number; x: number; y: number; arrastou: boolean} | null>(null);
  const tapRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roboWidth = () => roboRef.current?.getBoundingClientRect().width ?? 150;
  const limites = useCallback((x:number,y:number)=>{
    const largura=roboWidth();
    const altura=roboRef.current?.getBoundingClientRect().height ?? 190;
    return {x:limitar(x,10,window.innerWidth-largura-10),y:limitar(y,85,window.innerHeight-altura-12)};
  },[]);
  const buscar = useCallback(async()=>{
    setCarregando(true);
    try{
      const response=await fetch("/api/saude/status",{cache:"no-store"});
      if (!response.ok) throw Error("falha");
      const json=await response.json() as Dados;
      if(!json.servicos || !json.consultado_em)throw Error("incompleto");
      setDados(json);setErro(false);
    }catch{setErro(true)}finally{setCarregando(false)}
  },[]);
  useEffect(()=>{void buscar();const timer=setInterval(()=>void buscar(),300000);return()=>clearInterval(timer)},[buscar]);
  useEffect(()=>{const timer=setInterval(()=>setAgora(Date.now()),15000);return()=>clearInterval(timer)},[]);
  useEffect(()=>{
    const colocar=()=>{
      if(!localizado){setPosicao(limites(window.innerWidth-(window.innerWidth<600?144:255),window.innerHeight-(window.innerWidth<600?260:310)));setLocalizado(true)}
      else setPosicao(p=>limites(p.x,p.y));
    };
    colocar();window.addEventListener("resize",colocar);return()=>window.removeEventListener("resize",colocar);
  },[limites,localizado]);
  useEffect(()=>()=>{if(timeoutRef.current)clearTimeout(timeoutRef.current)},[]);
  const valido=!erro&&dados&&Number.isFinite(Date.parse(dados.consultado_em))&&agora-Date.parse(dados.consultado_em)<11*60*1000;
  const atuais=valido?dados:null;
  const resumo=useMemo(()=>grupos.map(g=>({...g,estado:estadoIds(atuais,g.ids)})),[atuais]);
  const alertas=atuais?Object.entries(atuais.servicos).filter(([,v])=>v.estado==="offline"||v.estado==="atencao"):[] as [string,Sonda][];
  const todasOk=atuais&&Object.values(atuais.servicos).every(s=>s.estado==="online");
  const estadoRobo:Estado=alertas.some(([,s])=>s.estado==="offline")?"offline":alertas.length?"atencao":todasOk?"online":"nao_verificado";
  const resumoFala=carregando&&!dados?"Olá, Cecília! Estou conferindo os serviços da pousada."
    :erro?"Não consegui consultar meus testes agora. Isso não significa que a pousada esteja fora do ar."
    :!valido?"Minha última leitura ficou antiga. Vou conferir novamente."
    :alertas.length?"Cecília, encontrei "+alertas.length+" "+(alertas.length===1?"verificação que precisa":"verificações que precisam")+" de atenção. Toque em um assunto abaixo."
    :"Os testes que responderam não mostraram problemas. Alguns serviços podem não estar verificados.";
  const mensagem=fala??resumoFala;
  const animar=(tipo:Animacao,duracao=800)=>{if(timeoutRef.current)clearTimeout(timeoutRef.current);setAnimacao(tipo);timeoutRef.current=setTimeout(()=>setAnimacao("parada"),duracao)};
  const pular=()=>{animar("pular",950);setFala("Oba! Dei um pulinho! 💙")};
  const tocar=()=>{
    const instante=Date.now();
    if(instante-tapRef.current<350){tapRef.current=0;pular();return}
    tapRef.current=instante;
    setFala(f=>(f==="Você pode me arrastar pela tela. Dois toques e eu pulo!")?resumoFala:"Você pode me arrastar pela tela. Dois toques e eu pulo!");
  };
  const aoApertar=(e:React.PointerEvent<HTMLDivElement>)=>{
    if(e.button!==0 || e.currentTarget!==e.target && (e.target as HTMLElement).closest("button"))return;
    movimentoRef.current={pointer:e.pointerId,inicioX:e.clientX,inicioY:e.clientY,x:posicao.x,y:posicao.y,arrastou:false};
    e.currentTarget.setPointerCapture(e.pointerId);setPasseando(false);setArrastando(true);
  };
  const aoMover=(e:React.PointerEvent<HTMLDivElement>)=>{
    const origem=movimentoRef.current;
    if(!origem || origem.pointer!==e.pointerId)return;
    const dx=e.clientX-origem.inicioX,dy=e.clientY-origem.inicioY;
    if(Math.hypot(dx,dy)>7)origem.arrastou=true;
    if(origem.arrastou)setPosicao(limites(origem.x+dx,origem.y+dy));
  };
  const aoSoltar=(e:React.PointerEvent<HTMLDivElement>)=>{
    const origem=movimentoRef.current;
    if(!origem || origem.pointer!==e.pointerId)return;
    movimentoRef.current=null;setArrastando(false);
    if(origem.arrastou){setFala("Prontinho! Pode me deixar aqui. 😊");animar("andar",450)}
    else tocar();
    if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
  };
  useEffect(()=>{
    if(!passeando || !localizado || arrastando)return;
    const id=setInterval(()=>{
      setPosicao(p=>limites(p.x+(Math.random()-.5)*100,p.y+(Math.random()-.5)*70));
      if(timeoutRef.current)clearTimeout(timeoutRef.current);
      setAnimacao("andar");timeoutRef.current=setTimeout(()=>setAnimacao("parada"),1800);
    },12000);
    return()=>clearInterval(id);
  },[passeando,localizado,arrastando,limites]);
  const mostrar=(id:Grupo)=>{
    setExplicando(id);setFala(null);
    const g=grupos.find(x=>x.id===id)!;
    const e=estadoIds(atuais,g.ids);
    setFala(g.titulo+": "+(e==="online"?"Os testes disponíveis responderam bem.":e==="nao_verificado"?"Não tenho como confirmar todas as verificações ainda.":"Uma das verificações precisa de atenção.")+" "+g.detalhe);
    const card=document.getElementById("marina-card-"+id);
    if(card){
      const box=card.getBoundingClientRect();
      setPosicao(limites(box.left+box.width-(window.innerWidth<600?135:175),box.top-155));
      animar("andar",1200);
    }
  };
  const t=atuais?.consultado_em?new Date(atuais.consultado_em).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}):"—";
  return <div className={styles.pagina}>
    <header className={styles.cabecalho}><a href="/" className={styles.marca}><img src="/marimar-chest-logo.webp" alt="" width="52" height="30"/><span><strong>Marimar</strong><small>Pousada · Ilha do Mel</small></span></a><button onClick={()=>void buscar()} disabled={carregando} className={styles.atualizar}><RefreshCw size={17} className={carregando?styles.girando:""}/> Atualizar</button></header>
    <main className={styles.corpo}>
      <section className={styles.abertura}>
        <div className={styles.intro}><span className={styles.selo}><Heart size={14}/> A Marina cuida da pousada</span><h1>Oi, Cecília! <span>Sou a Marina.</span></h1><p>Estou de olho no site, nas reservas e no WhatsApp. Vou explicar tudo de um jeito simples.</p><div className={styles.fala} role="status" aria-live="polite"><span className={styles.iconeFala}><MessageCircle size={19}/></span><p>{mensagem}</p></div><div className={styles.dicas}><span><Clock3 size={14}/> Última leitura: {t}</span><span><ShieldCheck size={14}/> Não altero nada</span></div></div>
        <div className={styles.palco}><div className={styles.sol}></div><div className={styles.onda}></div><p>Essa sou eu! <strong>Me toque ou me arraste.</strong></p><div className={styles.desenho}></div></div>
      </section>
      <section className={styles.statusArea}><div className={styles.secaoTitulo}><div><h2>Como está a pousada?</h2><p>Toque em um assunto para a Marina explicar.</p></div><span className={styles.atualizacao}>Atualização a cada 5 minutos</span></div><div className={styles.cartoes}>{resumo.map(g=>{
        const Icon=g.id==="site"?Globe2:g.id==="whatsapp"?MessageCircle:Activity;
        return <button key={g.id} id={"marina-card-"+g.id} className={styles.cartao} onClick={()=>mostrar(g.id)}><span className={styles.linhaIcone}><Icon size={22}/><span className={styles.estado} data-estado={g.estado}><i/>{statusNome[g.estado]}</span></span><strong>{g.titulo}</strong><small>{g.pergunta}</small><span className={styles.verMais}>Marina, me explica <ChevronRight size={17}/></span></button>;
      })}</div><p className={styles.aviso}><Info size={16}/> Um teste OK não significa que todas as funções foram testadas. A conexão do WhatsApp não comprova o envio de mensagens ou preços.</p></section>
      <section className={styles.ajuda}><div><h2>Preciso fazer alguma coisa?</h2><p>{erro||!valido?"A Marina ainda não conseguiu confirmar os resultados atuais. Isso não significa que algum serviço parou.":alertas.length?"Encontrei "+alertas.length+" verificações que merecem atenção. Veja a explicação abaixo.":"Nenhuma falha detectada nos testes concluídos. O que não foi verificado continua sem confirmação."}</p>{alertas.length>0&&<div className={styles.alertaLista}>{alertas.slice(0,4).map(([id,s])=><div key={id}><AlertCircle size={17}/><span><b>{nomes[id]??id}</b><small>{s.descricao}</small></span></div>)}</div>}</div><div className={styles.controles}><button onClick={()=>{setPasseando(x=>!x);setFala(passeando?"Fiquei quietinha. Você pode me arrastar!":"Vou passear mais um pouquinho pela tela!")}}>{passeando?<Pause size={16}/>:<Play size={16}/>} {passeando?"Pausar passeio":"Deixar passear"}</button><button onClick={pular}><Sparkles size={16}/> Marina, pula!</button></div></section>
      <details className={styles.tecnicos} open={aberto} onToggle={e=>setAberto((e.currentTarget as HTMLDetailsElement).open)}><summary><span><CircleHelp size={19}/> Detalhes para o técnico <small>Ferramentas e verificações reais</small></span><ChevronDown size={19}/></summary><div className={styles.tecnicosCorpo}><p>Somente leitura. Esta página não envia mensagens, não cria reservas nem altera dados. Cada resultado vale apenas para o teste indicado.</p><div className={styles.listaServicos}>{Object.entries(dados?.servicos??{}).map(([id,s])=><div className={styles.servico} key={id}><div><strong>{nomes[id]??id}</strong><small>{s.descricao}</small><small>{s.metodo??"Teste não informado"} · {s.latencia_ms==null?"tempo não medido":s.latencia_ms+" ms"}</small></div><span className={styles.estado} data-estado={valido?s.estado:"nao_verificado"}>{statusNome[valido?s.estado:"nao_verificado"]}</span></div>)}</div></div></details>
      <footer className={styles.rodape}>Marimar · Encantadas, Ilha do Mel · Monitoramento de leitura</footer>
    </main>
    <div className={styles.marinaFlutuante} ref={roboRef} data-arrastando={arrastando} style={{left:localizado?posicao.x:undefined,top:localizado?posicao.y:undefined}} onPointerDown={aoApertar} onPointerMove={aoMover} onPointerUp={aoSoltar} onPointerCancel={()=>{movimentoRef.current=null;setArrastando(false)}} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();tocar()}if(e.key===" "){e.preventDefault();pular()}}} role="button" tabIndex={0} aria-label="Marina interativa. Toque para conversar, arraste para mover ou pressione espaço para pular." title="Toque, arraste ou dê dois toques para pular"><MarinaSvg estado={estadoRobo} animacao={animacao}/></div>
      {explicando&&<div className={styles.modalFundo} onPointerDown={()=>setExplicando(null)}><section role="dialog" aria-modal="true" aria-label={"Marina explica "+explicando} className={styles.modal} onPointerDown={e=>e.stopPropagation()}><button className={styles.fechar} onClick={()=>setExplicando(null)} aria-label="Fechar"><X size={20}/></button><span className={styles.selo}><Heart size={14}/> Marina explica</span><h2>{grupos.find(g=>g.id===explicando)?.titulo}</h2><p>{grupos.find(g=>g.id===explicando)?.detalhe}</p><div className={styles.modalServicos}>{grupos.find(g=>g.id===explicando)?.ids.map(id=><div key={id}><span>{nomes[id]??id}</span><span className={styles.estado} data-estado={atuais?.servicos[id]?.estado??"nao_verificado"}>{statusNome[atuais?.servicos[id]?.estado??"nao_verificado"]}</span></div>)}</div><p className={styles.modalAviso}>Os resultados vêm de verificações reais. Um teste de conexão não confirma todas as funções.</p><button className={styles.entendi} onClick={()=>setExplicando(null)}>Entendi, Marina! <Check size={17}/></button></section></div>}
  </div>;
}
