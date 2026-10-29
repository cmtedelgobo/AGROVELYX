const menu = [
 {name:'Operacional',icon:'🐷',items:['Cio','Cobertura','Gestação','Parto','Maternidade','Creche','Desmame','AVA','Terminação']},
 {name:'Fábrica de Ração',icon:'🏭',items:['Compra de ingredientes','Matérias-primas','Formulações','Ordens de produção','Consumo por lote','Custos e rastreabilidade']},
 {name:'Financeiro',icon:'💳',items:['Contas a pagar','Contas a receber','Fluxo de caixa','Centro de custos','DRE','Planejamento']},
 {name:'Comercial',icon:'🤝',items:['Clientes','Fornecedores','Vendas de animais','Pedidos','Contratos']},
 {name:'RH',icon:'👥',items:['Colaboradores','Cargos e setores','Escalas','Férias e ausências','Treinamentos']},
 {name:'Gestão',icon:'📊',items:['Indicadores zootécnicos','Custos por lote','Conversão alimentar','Metas e relatórios']},
 {name:'Sanidade e Biossegurança',icon:'🛡️',items:['Vacinação','Medicamentos','Tratamentos','Mortalidade','Protocolos']},
 {name:'Estoque e Patrimônio',icon:'📦',items:['Almoxarifado','Inventários','Equipamentos','Manutenção']},
 {name:'Cadastros e Administração',icon:'⚙️',items:['Granjas e unidades','Galpões e baias','Animais e lotes','Usuários e permissões','Auditoria']}
];
const descriptions = {
 'Operacional':'Ciclo produtivo completo: reprodução, maternidade, creche e terminação.',
 'Fábrica de Ração':'Insumos, formulações, fabricação e consumo integrado aos lotes.',
 'Financeiro':'Fluxo de caixa, contas, custos produtivos e demonstrativos.',
 'Comercial':'Clientes, fornecedores, contratos e movimentações comerciais.',
 'RH':'Gestão das equipes, escalas, colaboradores e treinamentos.',
 'Gestão':'Indicadores, metas, custos, relatórios e visão gerencial.',
 'Sanidade e Biossegurança':'Vacinação, protocolos, ocorrências e acompanhamento sanitário.',
 'Estoque e Patrimônio':'Controle de materiais, equipamentos, inventários e manutenção.',
 'Cadastros e Administração':'Estrutura das unidades, usuários, permissões e auditoria.'
};
const nav=document.getElementById('nav'); const content=document.getElementById('content');const title=document.getElementById('current-title');let opened='Operacional';
const shortcutKey='agrovelyx-beta-shortcuts-v1';
const defaultShortcuts=['Cobertura','Gestação','Parto','Maternidade','Desmame','Terminação'];
let shortcuts=loadShortcuts();
function allEntries(){return menu.flatMap(g=>g.items.map(i=>({group:g.name,item:i,icon:g.icon})));}
function loadShortcuts(){try{const v=JSON.parse(localStorage.getItem(shortcutKey));if(Array.isArray(v))return [...new Set(v.filter(x=>typeof x==='string'))];}catch(e){}return [...defaultShortcuts];}
function saveShortcuts(){try{localStorage.setItem(shortcutKey,JSON.stringify(shortcuts));}catch(e){}}
function shortcutEntry(name){return allEntries().find(e=>e.item===name);}
function shortcutHeading(){const row=el('div','section-heading');row.append(el('h2','','Meus atalhos'),button('⚙ Personalizar atalhos','secondary-button',openShortcutEditor));return row;}
function drawShortcuts(){const prev=document.getElementById('shortcut-area');if(prev)prev.remove();const region=el('section','shortcuts-section');region.id='shortcut-area';region.append(shortcutHeading());const grid=el('div','shortcut-grid');shortcuts.forEach((name,index)=>{const entry=shortcutEntry(name);if(!entry)return;const tile=el('div','shortcut-tile');const jump=button(entry.icon+'  '+entry.item,'shortcut-jump',()=>{opened=entry.group;setPage(entry.group,entry.item)});const controls=el('div','shortcut-controls');controls.append(button('←','shortcut-mini',()=>moveShortcut(index,-1)),button('→','shortcut-mini',()=>moveShortcut(index,1)),button('×','shortcut-mini remove-shortcut',()=>removeShortcut(name)));controls.querySelectorAll('button').forEach((b,i)=>b.setAttribute('aria-label',['Mover à esquerda','Mover à direita','Remover atalho'][i]+' '+name));tile.append(jump,controls);grid.append(tile)});grid.append(button('+ Adicionar atalho','shortcut-add',openShortcutEditor));region.append(grid);const first=document.querySelector('.section-heading');if(first)first.before(region);else content.append(region);}
function moveShortcut(index,shift){const next=index+shift;if(next<0||next>=shortcuts.length)return;[shortcuts[index],shortcuts[next]]=[shortcuts[next],shortcuts[index]];saveShortcuts();drawShortcuts()}
function removeShortcut(name){shortcuts=shortcuts.filter(x=>x!==name);saveShortcuts();drawShortcuts()}
function openShortcutEditor(){const overlay=el('div','modal-overlay');overlay.setAttribute('role','presentation');const modal=el('section','shortcut-modal');modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label','Personalizar atalhos');const head=el('div','modal-head');head.append(el('h2','','Personalizar atalhos'),button('✕','modal-close',()=>overlay.remove()));modal.append(head,el('p','modal-subtitle','Marque os módulos que quer ver na página inicial. Seus atalhos ficam salvos neste navegador.'));const options=el('div','shortcut-options');allEntries().forEach(entry=>{const lab=el('label','shortcut-option'),check=document.createElement('input');check.type='checkbox';check.value=entry.item;check.checked=shortcuts.includes(entry.item);lab.append(check,el('span','',entry.icon+' '+entry.item));options.append(lab)});modal.append(options);const foot=el('div','action-row modal-actions');foot.append(button('Cancelar','secondary-button',()=>overlay.remove()),button('Salvar atalhos','primary-button',()=>{shortcuts=Array.from(options.querySelectorAll('input:checked')).map(i=>i.value);saveShortcuts();overlay.remove();drawShortcuts()}));modal.append(foot);overlay.append(modal);overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove()});document.addEventListener('keydown',function close(e){if(e.key==='Escape'){overlay.remove();document.removeEventListener('keydown',close)}});document.body.append(overlay);modal.querySelector('input')?.focus()}

function el(tag,cls,text){const x=document.createElement(tag);if(cls)x.className=cls;if(text!==undefined)x.textContent=text;return x}
function button(label,cls,action){const b=el('button',cls,label);b.type='button';b.addEventListener('click',action);return b}
function setPage(group,item){document.getElementById('sidebar').classList.remove('open');title.textContent=item||group;content.replaceChildren(); if(group==='Dashboard Geral'){showDashboard();return}
 const crumb=el('div','breadcrumb',group+' / '+item);const hero=el('section','hero');hero.append(el('p','eyebrow','AGROVELYX · '+group),el('h1','',item));hero.append(el('p','','Módulo em preparação para integração com Cloudflare D1.'));content.append(crumb,hero);
 const sec=el('div','section-heading');sec.append(el('h2','','Visão geral do módulo'),el('span','chip','Estrutura Beta'));content.append(sec);
 const panel=el('section','panel');panel.append(el('h3','','Área de trabalho — '+item),el('p','','Aqui ficarão os cadastros, lançamentos, consultas, indicadores e relatórios deste processo.'));const features=el('div','feature-list');['Cadastrar e consultar registros','Filtrar por granja, lote e período','Histórico de movimentações','Relatórios e indicadores'].forEach(s=>features.append(el('div','feature','✓ '+s)));panel.append(features,el('div','notice','Esta versão é uma demonstração de navegação. Nenhum dado real é armazenado ou transmitido.'));const actions=el('div','action-row');actions.append(button('← Voltar ao dashboard','secondary-button',()=>setPage('Dashboard Geral')));panel.append(actions);content.append(panel);drawNav(group,item)
}
function showDashboard(){title.textContent='Dashboard Geral';const hero=el('section','hero');hero.append(el('p','eyebrow','Stratéchne · Tecnologia para o agronegócio'),el('h1','','Bem-vinda ao AGROVELYX Suíno'),el('p','','Gestão inteligente de granjas — da reprodução à terminação, do insumo ao resultado.'));content.append(hero);
 const head=el('div','section-heading');head.append(el('h2','','Painel de Gestão'),el('span','chip','Ambiente Beta'));content.append(head);
 const grid=el('div','grid');[['Matrizes ativas','—','Aguardando integração'],['Animais em produção','—','Aguardando integração'],['Ração consumida','—','Aguardando integração'],['Custo por animal','—','Aguardando integração']].forEach(data=>{const s=el('div','stat');s.append(el('small','',data[0]),el('strong','',data[1]),el('em','',data[2]));grid.append(s)});content.append(grid);drawShortcuts();
 const head2=el('div','section-heading');head2.append(el('h2','','Módulos do Sistema'),el('span','chip','9 áreas integradas'));content.append(head2);const m=el('div','grid modules');menu.forEach(g=>{const card=el('div','module-card'),h=el('div','module-head');h.append(el('span','symbol',g.icon),el('strong','',g.name));card.append(h,el('p','',descriptions[g.name]),button('Acessar módulo →','go-button',()=>{opened=g.name;setPage(g.name,g.items[0])}));m.append(card)});content.append(m);drawNav('Dashboard Geral')}
function drawNav(group,item){nav.replaceChildren();nav.append(button('⌂  Dashboard Geral','nav-main'+(group==='Dashboard Geral'?' active':''),()=>setPage('Dashboard Geral')));nav.append(el('div','nav-heading','Módulos'));menu.forEach(g=>{const row=button(g.icon+'  '+g.name+'   '+(opened===g.name?'⌄':'›'),'nav-group',()=>{opened=opened===g.name?'':g.name;drawNav(group,item)});nav.append(row);const sub=el('div','nav-sub'+(opened===g.name?' open':''));g.items.forEach(i=>sub.append(button('›  '+i,(group===g.name&&item===i)?'active':'',()=>{opened=g.name;setPage(g.name,i)})));nav.append(sub)})}
document.getElementById('menu-toggle').addEventListener('click',()=>document.getElementById('sidebar').classList.toggle('open'));setPage('Dashboard Geral');
