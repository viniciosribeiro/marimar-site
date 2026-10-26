"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./saude.module.css";

type Estado = "online" | "atencao" | "offline" | "nao_verificado";
type Sonda = { estado: Estado; latencia_ms: number | null; descricao: string };
type Resposta = { consultado_em: string; servicos: Record<string, Sonda>; historico_disponivel: boolean };
type Servico = { id: string; nome: string; icone: string; area: string; desc: string; detalhe: string; dependencias: string[]; x?: number; y?: number };
type Evento = { id: number; servico: string; comeco: number; fim?: number; texto: string };
type Pedido = { id: number; servico: string; descricao: string; estado: "pendente" | "aprovada" | "rejeitada" };

const ITENS: Servico[] = [
  { id:"site",nome:"Site institucional",icone:"🌐",area:"site",desc:"Páginas e navegação",detalhe:"Next.js 16 servido pela Vercel. Verificação básica: resposta do endpoint público.",dependencias:["api","neon","dns"],x:15,y:27 },
  { id:"api",nome:"API pública",icone:"⌘",area:"site",desc:"Rotas do site",detalhe:"Resposta do endpoint /api/saude/status. Não garante que todas as APIs funcionem.",dependencias:["neon","worker"],x:36,y:19 },
  { id:"worker",nome:"Cloudflare Worker",icone:"☁️",area:"reserva",desc:"PousadaHub",detalhe:"Sonda leve no endereço inicial do Worker; a disponibilidade é testada separadamente.",dependencias:["desbravador"],x:26,y:52 },
  { id:"desbravador",nome:"Motor Desbravador",icone:"🗓️",area:"reserva",desc:"Consulta de tarifas",detalhe:"Consulta real de leitura em período futuro, usando a integração já existente. Sem efetuar reserva.",dependencias:["worker"],x:50,y:45 },
  { id:"neon",nome:"Neon PostgreSQL",icone:"🛢️",area:"infra",desc:"Banco de dados",detalhe:"SELECT 1 de leitura; não altera tabelas, configurações ou dados.",dependencias:[],x:60,y:18 },
  { id:"marina_site",nome:"Marina no site",icone:"💬",area:"marina",desc:"Chat da pousada",detalhe:"Dependente da API do chat e do gateway. Sonda real específica ainda não implantada.",dependencias:["openclaw","neon"],x:81,y:27 },
  { id:"openclaw",nome:"Gateway OpenClaw",icone:"✳",area:"marina",desc:"Motor conversacional",detalhe:"Integração existente na Hostinger. Status autenticado requer sonda separada, não pública.",dependencias:["neon"],x:75,y:53 },
  { id:"whatsapp",nome:"Marina no WhatsApp",icone:"☎",area:"marina",desc:"Canal de mensagens",detalhe:"Depende de estado do canal, sessão e Gateway. Requer telemetria interna para confirmação real.",dependencias:["openclaw"],x:87,y:77 },
  { id:"voz",nome:"Voz ElevenLabs",icone:"♪",area:"marina",desc:"Áudio da Marina",detalhe:"Chaves configuradas no projeto. Ter chave não confirma disponibilidade nem saldo.",dependencias:["openclaw"],x:63,y:77 },
  { id:"blob",nome:"Mídias e Blob",icone:"▧",area:"infra",desc:"Fotos e documentos",detalhe:"Vercel Blob usado pelas mídias; verificação específica de leitura ainda não habilitada.",dependencias:[],x:14,y:77 },
  { id:"ssl",nome:"Domínios e SSL",icone:"🔒",area:"infra",desc:"Acesso seguro",detalhe:"Domínios verificados na Vercel. Expiração de certificados requer sonda de validade.",dependencias:["dns"],x:39,y:76 },
  { id:"dns",nome:"DNS e roteamento",icone:"✧",area:"infra",desc:"Domínios oficiais",detalhe:"Domínios próprios com redirecionamentos; monitorar resolução DNS e cadeia TLS.",dependencias:[],x:39,y:5 },
  { id:"mapas",nome:"Mapas e rotas",icone:"⌁",area:"site",desc:"MapLibre e serviços",detalhe:"Recursos de mapa OpenFreeMap, OSRM, Photon; disponibilidade ainda não monitorada.",dependencias:[],x:10,y:5 },
  { id:"avisos",nome:"Alertas e avisos",icone:"✉",area:"infra",desc:"Notificações",detalhe:"O projeto possui fluxo de alertas; sondas autenticadas são necessárias.",dependencias:["openclaw"],x:89,y:5 },
  { id:"autenticacao",nome:"Login e administração",icone:"🛡",area:"site",desc:"Auth.js",detalhe:"Autenticação e sessões do painel. A página pública não consulta endpoints protegidos.",dependencias:["neon"] },
  { id:"fotos",nome:"Fotos e galeria",icone:"▣",area:"site",desc:"Upload e biblioteca",detalhe:"Disponibilidade depende do Blob e das consultas ao banco.",dependencias:["blob","neon"] },
  { id:"regras",nome:"Regras de hospedagem",icone:"▤",area:"reserva",desc:"Crianças e adicionais",detalhe:"Leitura das regras cadastradas; sua integridade precisará de monitoria específica.",dependencias:["neon"] },
  { id:"marina_conhecimento",nome:"Conhecimento da Marina",icone:"◈",area:"marina",desc:"Treinamento e API",detalhe:"Compartilhado entre chat do site e skill do WhatsApp.",dependencias:["neon","openclaw"] },
  { id:"whatsapp_vigia",nome:"Vigia do WhatsApp",icone:"◷",area:"marina",desc:"Estado e reconexão",detalhe:"Há lógica de vigia no código; a execução agendada precisa ser comprovada por telemetria.",dependencias:["openclaw","neon"] },
  { id:"webhooks",nome:"Integrações e webhooks",icone:"⤴",area:"infra",desc:"Eventos e APIs",detalhe:"O conjunto de eventos tem dependências externas ainda sem sondas isoladas.",dependencias:["api","openclaw"] }
];
const mapa = Object.fromEntries(ITENS.map(s => [s.id,s])) as Record<string,Servico>;
const AREAS: Record<string,string>={todos:"Todos os sistemas",site:"Sites e apps",reserva:"Reservas",marina:"Marina IA",infra:"Infraestrutura"};
const EXPLICACOES: Record<Estado,string>={online:"Respondendo",atencao:"Atenção",offline:"Offline",nao_verificado:"Sem sonda"};
const ACL: Record<string,string>={desbravador:"Conferir os logs do Worker e o acesso ao Desbravador. Não alterar tarifas nem criar reservas.",worker:"Conferir logs do Cloudflare e origem da falha. Não reiniciar automaticamente.",neon:"Validar conexões e disponibilidade do Neon. Não executar migrations automaticamente.",openclaw:"Verificar canal e gateway com acesso administrativo. Não mexer nas sessões sem confirmação.",whatsapp:"Conferir estado do canal e sessão sem desconectar o aparelho."};

function Robot({ parado }:{ parado:boolean }) {
  return <svg aria-hidden="true" viewBox="0 0 130 170" className={styles.botSvg}>
    <ellipse cx="65" cy="157" rx="36" ry="6" fill="#53618b" opacity=".18"/>
    <g className={parado?undefined:styles.botWalk}>
      <path d="M51 122 L42 148" stroke="#ecf4ff" strokeWidth="13" strokeLinecap="round"/>
      <path d="M77 122 L88 148" stroke="#dce7fb" strokeWidth="13" strokeLinecap="round"/>
      <path d="M45 99 L26 119" stroke="#ebf4ff" strokeWidth="13" strokeLinecap="round"/>
      <path d="M85 98 L107 119" stroke="#e8f1ff" strokeWidth="13" strokeLinecap="round"/>
      <rect x="37" y="79" width="56" height="58" rx="27" fill="#f1f5ff" stroke="#a6b4d3" strokeWidth="2"/>
      <path d="M46 95Q64 89 83 95" stroke="#fff" strokeWidth="4" opacity=".7"/>
      <rect x="54" y="85" width="20" height="12" rx="6" fill="#71dedb"/>
      <rect x="55" y="8" width="20" height="17" rx="8" fill="#dae6fa"/>
      <circle cx="65" cy="8" r="6" fill="#44e3d4"/>
      <rect x="14" y="26" width="102" height="73" rx="30" fill="#f5f8ff" stroke="#a5b2d4" strokeWidth="3"/>
      <rect x="23" y="35" width="84" height="53" rx="23" fill="#182b54"/>
      <rect x="6" y="50" width="14" height="25" rx="7" fill="#d2dbef"/>
      <rect x="111" y="50" width="14" height="25" rx="7" fill="#cbd8f1"/>
      <path d="M40 65Q49 50 57 65M73 65Q81 50 90 65M59 74Q65 82 72 74" stroke="#55e4ed" strokeWidth="5" strokeLinecap="round" fill="none"/>
      <ellipse cx="46" cy="36" rx="21" ry="4" fill="#fff" opacity=".48"/>
    </g>
  </svg>;
}

export default function SaudePainel(){
  const [dados,setDados]=useState<Resposta|null>(null);
  const [erroLeitura,setErroLeitura]=useState(false);
  const [ativo,setAtivo]=useState("site");
  const [area,setArea]=useState("todos");
  const [pagina,setPagina]=useState("escritorio");
  const [ronda,setRonda]=useState(true);
  const [simular,setSimular]=useState<string|null>(null);
  const [eventos,setEventos]=useState<Evento[]>([]);
  const [pedidos,setPedidos]=useState<Pedido[]>([]);
  const [detalhe,setDetalhe]=useState<string|null>(null);
  const [agora,setAgora]=useState(0);
  const [filtro,setFiltro]=useState("");

  const ler = useCallback(async()=>{
    try{
      const resp=await fetch("/api/saude/status",{cache:"no-store"});
      if(!resp.ok) throw new Error("HTTP");
      const body=await resp.json() as Resposta;
      setDados(body);setErroLeitura(false);
    }catch{setErroLeitura(true)}
  },[]);

  useEffect(()=>{void ler();const handle=window.setInterval(()=>void ler(),300000);return ()=>window.clearInterval(handle)},[ler]);
  useEffect(()=>{const handle=window.setInterval(()=>setAgora(Date.now()),1000);setAgora(Date.now());return ()=>window.clearInterval(handle)},[]);
  useEffect(()=>{if(!ronda)return;const tour=ITENS.filter(s=>s.x!==undefined);const handle=window.setInterval(()=>setAtivo(a=>tour[(Math.max(0,tour.findIndex(s=>s.id===a))+1)%tour.length].id),4500);return ()=>window.clearInterval(handle)},[ronda]);
  useEffect(()=>{const evento=(ev:KeyboardEvent)=>{if(ev.key==="Escape")setDetalhe(null)};window.addEventListener("keydown",evento);return ()=>window.removeEventListener("keydown",evento)},[]);

  const estado = useCallback((id:string):Estado=>{
    if(simular===id)return "offline";
    return dados?.servicos?.[id]?.estado??"nao_verificado";
  },[simular,dados]);
  const verificados=ITENS.filter(s=>estado(s.id)!=="nao_verificado");
  const afetados=ITENS.filter(s=>estado(s.id)==="atencao"||estado(s.id)==="offline");
  const semSonda=ITENS.length-verificados.length;
  const alvo=mapa[ativo]??ITENS[0];
  const historico=eventos.map(e=>({...e,duracao:Math.floor(((e.fim??agora)-e.comeco)/1000)}));

  const iniciarFalha=(id:string)=>{
    if(simular) encerrarFalha();
    const s=mapa[id];if(!s)return;
    const instante=Date.now();setSimular(id);setAtivo(id);setRonda(false);
    setEventos(prev=>[{id:instante,servico:id,comeco:instante,texto:"Falha simulada em "+s.nome},...prev]);
    setPedidos(prev=>[{id:instante,servico:id,estado:"pendente",descricao:ACL[id]??"Investigar evidências antes de qualquer intervenção."},...prev]);
  };
  const encerrarFalha=()=>{const id=simular;setSimular(null);if(id)setEventos(prev=>prev.map(e=>e.servico===id&&!e.fim?{...e,fim:Date.now()}:e))};
  const decidir=(id:number,resultado:"aprovada"|"rejeitada")=>setPedidos(prev=>prev.map(p=>p.id===id?{...p,estado:resultado}:p));
  const visiveis=ITENS.filter(s=>(area==="todos"||s.area===area)&&s.nome.toLowerCase().includes(filtro.toLowerCase()));
  const textoStatus=afetados.length?"Atenção: existem sinais que precisam ser conferidos":verificados.length?"Sondas disponíveis responderam; outros serviços aguardam monitoramento":"Aguardando primeiras verificações";
  const dataCheck=dados?.consultado_em?new Date(dados.consultado_em).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}):"—";

  const navegar = (paginaNova: string) => {
    setPagina(paginaNova);
    const destino: Record<string, string> = { escritorio: "saude-escritorio", servicos: "saude-servicos", incidentes: "saude-incidentes", marina: "saude-marina", publico: "saude-publico" };
    window.setTimeout(() => document.getElementById(destino[paginaNova])?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };

  return <div className={styles.shell}>
    <aside className={styles.sidebar}>
      <a className={styles.brand} href="/" title="Voltar à pousada"><span className={styles.brandSymbol}>✿</span><span><b>Marimar</b><small>MARINA OS • STATUS</small></span></a>
      <div className={styles.navTitle}>CENTRAL DE SAÚDE</div>
      <nav className={styles.menu} aria-label="Navegação da central">
        {[["escritorio","▦","Escritório 2.5D"],["servicos","◈","Todos os serviços"],["incidentes","◷","Incidentes"],["marina","✳","Agente Marina"],["publico","◎","Dados de acesso"]].map(([id,ico,nome])=><button key={id} onClick={()=>navegar(id)} className={pagina===id?styles.menuActive:styles.menuButton}><span>{ico}</span>{nome}</button>)}
      </nav>
      <div className={styles.sidebarNote}><b>✧ Laboratório visual</b><p>Somente as sondas identificadas como reais consultam a produção. Os testes de queda são locais.</p><button onClick={()=>iniciarFalha("desbravador")}>⚡ Simular queda de reservas</button>{simular&&<button onClick={encerrarFalha} className={styles.secondaryButton}>↺ Encerrar simulação</button>}</div>
      <a className={styles.backHome} href="/">← Voltar ao site oficial</a>
    </aside>

    <main className={styles.main}>
      <header className={styles.header}>
        <div><div className={styles.eyebrow}>POUSADA MARIMAR <span>›</span> INTELIGÊNCIA OPERACIONAL</div><h1>O escritório da <em>Marina</em> <span>✦</span></h1><p>O pequeno robô que acompanha a saúde da sua plataforma.</p></div>
        <div className={styles.headerEnd}><div className={styles.headerBadge}>● {erroLeitura?"Telemetria temporariamente indisponível":"Monitoramento de leitura"}</div><span>Atualizado às {dataCheck}</span><button onClick={()=>void ler()}>↻ Atualizar</button></div>
      </header>

      <div className={styles.statusBanner} data-warning={afetados.length>0?"true":"false"}><span className={styles.statusIcon}>{afetados.length?"!":"✓"}</span><div><strong>{textoStatus}</strong><small>{simular?"Cenário fictício ativado neste navegador. Nada será alterado em produção.":"Status parcial de serviços com sondas reais. Os demais aparecem como não verificados."}</small></div><button onClick={()=>navegar("servicos")}>Ver serviços →</button></div>

      <div className={styles.metrics}>
        {[["▦",ITENS.length,"Serviços mapeados","lilas"],["✓",verificados.filter(s=>estado(s.id)==="online").length,"Respondendo","verde"],["!",afetados.length,"Em atenção","rosa"],["◌",semSonda,"Sem sonda real","amarelo"],["✳",pedidos.filter(p=>p.estado==="pendente").length,"Aprovações demo","azul"]].map(([ico,num,desc,tom])=><div key={String(desc)} className={styles.metric}><div className={styles.metricIcon} data-tone={tom}>{ico}</div><div><strong>{num}</strong><small>{desc}</small></div></div>)}
      </div>

      <div id="saude-escritorio" className={styles.layout}>
        <section className={styles.officePanel}>
          <div className={styles.windowBar}><span><i></i><i></i><i></i></span><b>✿ MARINA.EXE — CENTRAL VISUAL 2.5D</b><span>▣ ◻ ×</span></div>
          <div className={styles.officeTop}><span className={styles.patrol}><span className={styles.liveDot}></span> RONDA {ronda?"ATIVA":"PAUSADA"}</span><div className={styles.filters}>{["todos","reserva","marina","infra"].map(id=><button key={id} className={area===id?styles.filterActive:""} onClick={()=>setArea(id)}>{id==="todos"?"Todos":id==="reserva"?"Reservas":id==="marina"?"Marina":"Infra"}</button>)}</div></div>
          <div className={styles.boardScroll}>
            <div className={styles.board}>
              <div className={styles.backWindow}><span>☀️</span><span>ILHA DO MEL • ENCANTADAS</span></div>
              <svg className={styles.connections} viewBox="0 0 1200 660" preserveAspectRatio="none" aria-hidden="true">
                {ITENS.filter(s=>s.x!==undefined&&s.y!==undefined).map(s=><line key={s.id} x1="600" y1="340" x2={Number(s.x)*12} y2={Number(s.y)*6.6} stroke="#94aee8" strokeOpacity=".48" strokeWidth="2" strokeDasharray="7 9"/>)}
              </svg>
              <div className={styles.centralHub}><span>✿</span><b>MARIMAR</b><small>ECOSSISTEMA</small></div>
              {ITENS.filter(s=>s.x!==undefined&&s.y!==undefined).map(s=><button key={s.id} className={styles.tile} data-state={estado(s.id)} data-dim={area!=="todos"&&s.area!==area?"true":"false"} style={{left:s.x+"%",top:s.y+"%"}} onClick={()=>{setAtivo(s.id);setRonda(false);setDetalhe(s.id)}}>
                <div className={styles.tilePlane}><span>{s.icone}</span><b>{s.nome}</b><small>{EXPLICACOES[estado(s.id)]}</small><i></i></div>
              </button>)}
              <div className={styles.marinaRobot} style={{left:(alvo.x??50)+"%",top:Math.max(2,(alvo.y??50)-12)+"%"}}><div className={styles.botSpeech}>{simular&&simular===ativo?"Ops! Encontrei um problema.":"Inspecionando "+alvo.nome+"..."}</div><Robot parado={!ronda}/><span className={styles.botTag}>✳ Marina</span></div>
              <div className={styles.boardSeal}>✓ VISUALIZAÇÃO INTERATIVA · SEM AÇÕES AUTÔNOMAS</div>
            </div>
          </div>
          <div className={styles.officeFooter}><span><b>●</b> Atualização de sondas: 5 minutos</span><span>↔ Deslize para explorar</span><button onClick={()=>setRonda(v=>!v)}>{ronda?"Ⅱ Pausar Marina":"▶ Retomar ronda"}</button></div>
        </section>

        <aside id="saude-marina" className={styles.sideWidgets}>
          <section className={styles.widget}><div className={styles.widgetHead}><span className={styles.widgetIcon}>✳</span><div><b>Marina está trabalhando</b><small>Inspeção visual dos serviços</small></div><span className={styles.chip}>VISUAL</span></div><div className={styles.agentTask}><small>ATIVIDADE ATUAL</small><strong>{simular?"Investigando alerta de "+mapa[simular].nome:"Analisando "+alvo.nome}</strong><p>{simular?"O diagnóstico e as ações são apenas exemplos.":"Clique nos módulos para ver as dependências e as sondas reais."}</p><div className={styles.taskProgress}><i></i></div></div><div className={styles.agentMsg}>🤖 <span>Não vou alterar nada sozinha. Toda futura correção dependerá da sua autorização e de um canal administrativo seguro.</span></div><button className={styles.linkButton} onClick={()=>navegar("marina")}>Central de decisões →</button></section>
          <section className={styles.widget}><div className={styles.widgetHead}><span className={styles.widgetIcon}>⚙</span><div><b>Suas aprovações</b><small>Somente simulação local</small></div><span className={styles.chip}>{pedidos.filter(p=>p.estado==="pendente").length}</span></div>{pedidos.length?pedidos.slice(0,2).map(p=><div key={p.id} className={styles.approval}><b>{mapa[p.servico]?.nome}</b><p>{p.descricao}</p><small>{p.estado==="pendente"?"Aguardando decisão":p.estado==="aprovada"?"Aprovada na simulação":"Rejeitada na simulação"}</small>{p.estado==="pendente"&&<div className={styles.approvalBtns}><button onClick={()=>decidir(p.id,"rejeitada")}>Rejeitar</button><button onClick={()=>decidir(p.id,"aprovada")}>Aprovar (demo)</button></div>}</div>):<p className={styles.emptyState}>Nenhuma decisão pendente. Simule uma falha para testar.</p>}</section>
          <section className={styles.widget}><div className={styles.widgetHead}><span className={styles.widgetIcon}>◷</span><div><b>Últimas verificações</b><small>Coleta parcial, sem histórico persistente</small></div></div><div className={styles.probeList}>{["site","api","worker","desbravador","neon"].map(id=><button onClick={()=>setDetalhe(id)} key={id}><span className={styles.probeDot} data-state={estado(id)}></span><b>{mapa[id].nome}</b><span>{EXPLICACOES[estado(id)]}</span></button>)}</div></section>
        </aside>
      </div>

      <div id="saude-relatorios" className={styles.bottomGrid}>
        <section className={styles.widget}><div className={styles.widgetHead}><span className={styles.widgetIcon}>⌁</span><div><b>Fluxo de estabilidade</b><small>Visualização demonstrativa; sem dados históricos de produção</small></div></div><svg className={styles.chart} viewBox="0 0 500 170" preserveAspectRatio="none" role="img" aria-label="Gráfico ilustrativo de latência">
          {Array.from({length:5},(_,i)=><line key={i} x1="15" y1={24+i*30} x2="490" y2={24+i*30} stroke="#e6e4f4" strokeDasharray="5 5"/>)}
          <path d={"M15 110 "+Array.from({length:42},(_,i)=>"L"+(15+i*11.3)+" "+(103-Math.sin(i*1.4)*14-(i%13===0?40:0))).join(" ")} fill="none" stroke="#9a7eeb" strokeWidth="3" strokeLinecap="round"/>
          <path d={"M15 130 "+Array.from({length:42},(_,i)=>"L"+(15+i*11.3)+" "+(129-Math.sin(i*.7)*6)).join(" ")} fill="none" stroke="#45cdb0" strokeWidth="3" strokeLinecap="round"/>
        </svg><div className={styles.chartLegend}><span>● Tráfego ilustrativo</span><span>● Latência ilustrativa</span></div></section>
        <section className={styles.widget}><div className={styles.widgetHead}><span className={styles.widgetIcon}>◎</span><div><b>Origem dos visitantes</b><small>Ainda sem integração de analytics nesta tela</small></div></div><div id="saude-publico" className={styles.geoPlaceholder}><span>🌎</span><div><b>Privacidade desde o início</b><p>A localização aproximada poderá vir de analytics agregados. Idade e gênero só com dados legitimamente declarados ou agregados — nunca por inferência de IP.</p></div></div></section>
        <section className={styles.widget}><div className={styles.widgetHead}><span className={styles.widgetIcon}>◷</span><div><b>Histórico de incidentes</b><small>Somente ocorrências simuladas nesta sessão</small></div></div><div id="saude-incidentes" className={styles.eventList}>{historico.length?historico.slice(0,4).map(e=><div key={e.id}><span className={styles.eventBullet}></span><div><b>{mapa[e.servico].nome}</b><small>{new Date(e.comeco).toLocaleTimeString("pt-BR")} · {e.fim?"Encerrado":"Em andamento"} · {e.duracao}s</small></div></div>):<p>Sem incidentes simulados. Para histórico real serão necessários armazenamento e monitoramento agendado.</p>}</div></section>
      </div>

      <section id="saude-servicos" className={styles.inventory}><div className={styles.inventoryHeader}><div><small>CATÁLOGO DE DEPENDÊNCIAS</small><h2>Todos os serviços da plataforma</h2><p>20 componentes identificados no projeto Marimar. “Sem sonda” não significa fora do ar.</p></div><input aria-label="Pesquisar serviços" placeholder="⌕ Pesquisar serviço..." value={filtro} onChange={e=>setFiltro(e.target.value)}/></div><div className={styles.inventoryTabs}>{Object.entries(AREAS).map(([id,nome])=><button key={id} className={area===id?styles.filterActive:""} onClick={()=>setArea(id)}>{nome}</button>)}</div><div className={styles.inventoryCards}>{visiveis.map(s=><button key={s.id} onClick={()=>setDetalhe(s.id)}><span className={styles.inventoryIcon}>{s.icone}</span><strong>{s.nome}</strong><small>{s.desc}</small><span className={styles.inventoryStatus} data-state={estado(s.id)}>● {EXPLICACOES[estado(s.id)]}</span></button>)}</div></section>
      <footer className={styles.footer}><span>Marimar • Saúde da Plataforma · monitoramento parcial, somente leitura</span><span>Sem reparos automáticos · sem dados pessoais · <a href="/">Voltar ao site</a></span></footer>
    </main>
    {detalhe&&<div className={styles.modalShade} onClick={()=>setDetalhe(null)} role="presentation"><section className={styles.modal} onClick={e=>e.stopPropagation()} role="dialog" aria-modal="true" aria-label={"Detalhes de "+mapa[detalhe].nome}><div className={styles.modalTitle}><strong>{mapa[detalhe].icone} {mapa[detalhe].nome}</strong><button onClick={()=>setDetalhe(null)} aria-label="Fechar">×</button></div><div className={styles.modalInner}><div className={styles.modalState} data-state={estado(detalhe)}>● {EXPLICACOES[estado(detalhe)]}{simular===detalhe?" · SIMULADO":""}</div><p>{mapa[detalhe].detalhe}</p><h3>Dependências mapeadas</h3><p>{mapa[detalhe].dependencias.map(id=>mapa[id]?.nome).join(" · ")||"Sem dependências diretas identificadas."}</p><h3>Última sonda de produção</h3><p>{dados?.servicos?.[detalhe]?.descricao??"Este módulo ainda não tem verificação automática."}</p><p>Tempo de resposta: {dados?.servicos?.[detalhe]?.latencia_ms??"—"}{dados?.servicos?.[detalhe]?.latencia_ms!==undefined&&dados?.servicos?.[detalhe]?.latencia_ms!==null?" ms":""}</p><div className={styles.modalNotice}>Este painel não executa reinícios, edições de configuração, reservas ou alterações. Ações simuladas não têm efeito externo.</div><div className={styles.modalActions}><button onClick={()=>{setAtivo(detalhe);setRonda(false);setDetalhe(null)}}>Levar Marina até aqui</button><button onClick={()=>setDetalhe(null)}>Fechar</button></div></div></section></div>}
  </div>;
}
