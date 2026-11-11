/* Agrovelyx 2.3 — melhorias integradas aos módulos da versão 2.2.
   Operações de estoque e numeração são realizadas APENAS pelo Worker autenticado. */
'use strict';
const v23OldSpecialRows=specialRows;
specialRows=function(type,old={}){
 if(type==='Logística')return v23OldSpecialRows(type,old)+`<div class="v23-docs-field"><label class="field"><span>Tipo dos documentos anexados</span><select id="v23-doc-type"><option value="NFE">NF-e</option><option value="CTE">CT-e</option><option value="GTA">GTA</option><option value="OUTRO">Outros</option></select></label><label class="field"><span>Anexos (PDF, XML, PNG ou JPEG, até 250 KB cada)</span><input type="file" id="v23-doc-files" accept=".pdf,.xml,.png,.jpg,.jpeg" multiple></label></div>`;
 if(type==='Ordens de produção')return `<div class="field"><span>Número da ordem</span><input disabled value="Gerado automaticamente ao salvar"></div>`+
  sSelect('Fórmula utilizada',listNames('Formulações','Nome da ração'),old['Fórmula ID']||'',true)+
  `<div><button type="button" class="secondary-button" data-spec="inlineFormula">+ Cadastrar nova fórmula</button></div>`+
  sNum('Produção (kg)',old['Produção (kg)']||'',true)+
  `<label class="field"><span>Lote de destino *</span><input name="Destino lote" value="${esc(old['Destino lote']||'')}" list="v23-lotes" required placeholder="Código do lote de animais"><datalist id="v23-lotes">${[...new Set([...lookup('Lotes e movimentações').map(x=>x['Código do lote']||x.Lote),...lookup('Animais e lotes').map(x=>x['Lote atual'])].filter(Boolean))].map(x=>`<option value="${esc(x)}"></option>`).join('')}</datalist></label>`+
  sTxt('Silo destino',old['Silo destino']||'')+sDate('Data da produção',old['Data da produção']||'')+
  `<p class="v23-notice">A numeração é gerada pelo servidor. O estoque será debitado apenas quando a fabricação for confirmada.</p>`;
 return v23OldSpecialRows(type,old);
};
const v23OldSave=saveSpecial;
saveSpecial=async function(){
 if(v22Edit?.type==='Logística'){
  const ed=v22Edit,files=[...(document.getElementById('v23-doc-files')?.files||[])],docType=document.getElementById('v23-doc-type')?.value||'OUTRO';
  const before=new Set(lookup('Logística').map(x=>x._id));await v23OldSave();if(v22Edit===ed)return;
  const entityId=ed.id||lookup('Logística').find(x=>!before.has(x._id))?._id;if(!entityId||!files.length)return;
  let uploaded=0;for(const file of files){try{if(file.size>250000)throw Error('Arquivo maior que 250 KB');const uri=await new Promise((res,rej)=>{const reader=new FileReader();reader.onload=()=>res(reader.result);reader.onerror=rej;reader.readAsDataURL(file)});await api('/api/v23/documents',{method:'POST',body:JSON.stringify({entityId,docType,fileName:file.name,mimeType:file.type||'application/pdf',base64:String(uri).split(',')[1]})});uploaded++;}catch(e){notify('Não foi possível anexar '+file.name+': '+e.message,true);}}if(uploaded)notify(`${uploaded} documento(s) vinculado(s) à carga.`);return;
 }
 if(v22Edit?.type==='Compra de ingredientes'&&!v22Edit.id){
  const form=document.getElementById('v22-form');if(!form?.reportValidity())return;const v=Object.fromEntries(new FormData(form));
  try{const r=await api('/api/v23/purchases',{method:'POST',body:JSON.stringify({supplierId:v.Fornecedor,ingredientId:v['Ingrediente ID'],kg:v['Quantidade (kg)'],unitCost:v['Preço unitário (R$/kg)'],date:v['Data de compra'],invoice:v['NF-e']})});
   if(!data.records['Compra de ingredientes'])data.records['Compra de ingredientes']=[];data.records['Compra de ingredientes'].unshift(r.record);closeSpecial();render();notify(`Ordem de compra ${r.number} gerada como PENDENTE.`);
  }catch(e){notify('Compra não emitida: '+e.message,true)}return;
 }
 if(v22Edit?.type==='Ordens de produção'){
  const form=document.getElementById('v22-form');if(!form?.reportValidity())return;
  const values=Object.fromEntries(new FormData(form));const formulaId=values['Fórmula utilizada'];
  if(v22Edit.id)return notify('A ordem já emitida não pode ser alterada pelo formulário. Utilize as ações de produção.',true);
  try{const r=await api('/api/v23/orders',{method:'POST',body:JSON.stringify({formulaId,kg:values['Produção (kg)'],destinationLot:values['Destino lote'],silo:values['Silo destino'],date:values['Data da produção']})});
   if(!data.records['Ordens de produção'])data.records['Ordens de produção']=[];data.records['Ordens de produção'].unshift(r.record);
   closeSpecial();render();notify(`Ordem ${r.number} emitida. Aguarda fabricação.`);
  }catch(err){notify('Ordem não emitida: '+err.message,true)}return;
 }
 return v23OldSave();
};
const v23OldDraw=drawSpecial;
drawSpecial=function(type){
 v23OldDraw(type);
 const toolbar=content.querySelector('.v22-toolbar button[data-spec="new"]');
 if(toolbar){const label={'Compra de ingredientes':'Nova compra','Fornecedores da fábrica':'Novo fornecedor','Ordens de produção':'Nova ordem de produção','Formulações':'Nova formulação','Colaboradores':'Novo colaborador','Escalas':'Nova escala','Logística':'Nova carga','Animais e lotes':'Novo animal ou lote'}[type];if(label)toolbar.innerHTML=`${icon('plus')} ${label}`;}
 // Botões individuais por registro, preservando o acesso ao histórico.
 const rows=content.querySelectorAll('.data-table tbody tr');
 rows.forEach((tr,i)=>{
  const record=lookup(type)[i];if(!record||!record._id)return;
  const actions=tr.lastElementChild?.querySelector('.v22-actions');if(!actions)return;
  if(!['Ordens de produção','Compra de ingredientes'].includes(type)){
   if(!actions.querySelector('[data-spec="view"]'))actions.insertAdjacentHTML('afterbegin',`<button class="table-action" data-v23="view" data-id="${esc(record._id)}">Ver</button> `);
   actions.insertAdjacentHTML('beforeend',` <button class="table-action" data-v23="deactivate" data-id="${esc(record._id)}">${['Fornecedores da fábrica','Ingredientes por fornecedor','Colaboradores'].includes(type)?'Inativar':'Excluir/Inativar'}</button>`);
  }
  if(type==='Logística')actions.insertAdjacentHTML('beforeend',` <button class="table-action" data-v23="docs" data-id="${esc(record._id)}">Anexos</button>`);
  if(type==='Compra de ingredientes'){
   actions.insertAdjacentHTML('beforeend',` <button class="table-action" data-v23="purchasePdf" data-id="${esc(record._id)}">Ordem / PDF</button>`);
   const status=String(record.Situação||'PENDENTE');
   actions.insertAdjacentHTML('beforeend',` <button class="table-action" data-v23="purchase" data-id="${esc(record._id)}">Atualizar status</button>`);
   if(status==='Recebido'||status==='Cancelado'){actions.querySelector('[data-spec="edit"]')?.remove();}
  }
  if(type==='Ordens de produção'){
   actions.querySelector('[data-spec="edit"]')?.remove();
   actions.insertAdjacentHTML('beforeend',` <button class="table-action" data-v23="trace" data-id="${esc(record._id)}">Rastreabilidade</button>`);
   if(record.Situação==='Concluída')actions.insertAdjacentHTML('beforeend',` <button class="table-action" data-v23="feed" data-id="${esc(record._id)}">Registrar consumo no lote</button>`);
   if(record.Situação==='Planejada')actions.insertAdjacentHTML('beforeend',` <button class="table-action" data-v23="confirm" data-id="${esc(record._id)}">Confirmar fabricação</button>`);
  }
 });
 if(type==='Estoque de ingredientes')refreshRealStock();
};
async function refreshRealStock(){
 const section=content.querySelector('.panel');if(!section)return;
 try{const r=await api('/api/v23/stock');if(page!=='Estoque de ingredientes')return;
  const lines=r.ingredients.map(x=>`<tr><td>${esc(x.ingredient_name)}</td><td>${Number(x.kg).toLocaleString('pt-BR',{maximumFractionDigits:3})}</td><td>${esc(x.suppliers)} fornecedor(es)</td></tr>`).join('');
  section.innerHTML=`<h3>Estoque conciliado — entradas e baixas confirmadas</h3><p class="v23-notice">Saldo calculado diretamente dos lotes recebidos e das ordens de fabricação confirmadas no D1.</p><div class="table-scroll"><table class="data-table"><thead><tr><th>Ingrediente</th><th>Saldo (kg)</th><th>Fornecedores</th></tr></thead><tbody>${lines||'<tr><td colspan="3">Sem recebimentos confirmados</td></tr>'}</tbody></table></div>`;
 }catch(e){section.insertAdjacentHTML('beforeend',`<p class="v23-error">Estoque transacional indisponível. Execute a migração 016. ${esc(e.message)}</p>`);}
}
function updateLocalRecord(type,record){const list=lookup(type),i=list.findIndex(x=>x._id===record._id);if(i>=0)list[i]=record;else list.unshift(record);}
async function purchaseAction(id){const r=lookup('Compra de ingredientes').find(x=>x._id===id);if(!r)return;
 const value=prompt('Novo status da compra: PENDENTE, RECEBIDO ou CANCELADA',r.Situação==='Recebido'?'RECEBIDO':r.Situação==='Cancelado'?'CANCELADA':'PENDENTE');if(value===null)return;
 const status=value.trim().toUpperCase();if(!['PENDENTE','RECEBIDO','CANCELADA'].includes(status))return notify('Situação inválida.',true);
 if(status==='RECEBIDO'&&!confirm('Confirmar recebimento e entrada dos ingredientes no estoque? Esta operação não pode ser revertida por edição.'))return;
 try{const result=await api('/api/v23/purchase/status',{method:'POST',body:JSON.stringify({id,status})});if(result.record)updateLocalRecord('Compra de ingredientes',result.record);render();notify('Status atualizado: '+result.status);}catch(e){notify('Não foi possível alterar: '+e.message,true)}
}
async function confirmProduction(id){const r=lookup('Ordens de produção').find(x=>x._id===id);if(!r)return;
 if(!confirm(`Confirmar a fabricação da ordem ${r['Número da ordem']}? A quantidade da fórmula será baixada do estoque por lote de origem.`))return;
 try{const result=await api('/api/v23/production/confirm',{method:'POST',body:JSON.stringify({id})});updateLocalRecord('Ordens de produção',result.order);render();notify('Fabricação concluída; ingredientes baixados com rastreabilidade.');}catch(e){notify(e.message,true)}
}
async function traceProduction(id){try{const r=await api('/api/v23/production/trace?id='+encodeURIComponent(id));
 const rows=r.ingredients.map(x=>`<tr><td>${esc(x.ingredient_name)}</td><td>${Number(x.quantity_kg).toFixed(3)} kg</td><td>${esc(x.purchase_id)}</td><td>${esc(x.supplier_id||'—')}</td></tr>`).join('');
 document.body.insertAdjacentHTML('beforeend',`<div class="modal-overlay" id="v23-trace"><section class="editor-modal"><div class="modal-head"><h2>Rastreabilidade — ${esc(r.order.number)}</h2><button type="button" data-v23="closeTrace">×</button></div><div class="v23-modal-body"><p>Destino: <b>${esc(r.order.destination_lot)}</b> · Fase: ${esc(r.order.phase||'—')} · Produção: ${Number(r.order.planned_kg)} kg</p><table class="data-table"><thead><tr><th>Ingrediente</th><th>Consumo</th><th>Compra de origem</th><th>Fornecedor ID</th></tr></thead><tbody>${rows||'<tr><td colspan="4">A produção não foi confirmada.</td></tr>'}</tbody></table></div><div class="modal-footer"><button type="button" class="secondary-button" data-v23="closeTrace">Fechar</button></div></section></div>`);
 }catch(e){notify(e.message,true)}
}
async function deactivateRecord(type,id){const reason=prompt(`Justificativa obrigatória para inativar o registro de ${type}:`);if(!reason?.trim())return;if(!confirm('Confirmar inativação? O histórico continuará disponível e auditado.'))return;
 try{const r=await api('/api/v23/records/deactivate',{method:'POST',body:JSON.stringify({id,type,reason})});if(r.record)updateLocalRecord(type,r.record);render();notify('Registro inativado, histórico preservado.');}catch(e){notify(e.message,true)}
}
function showProfile(){if(!sessionUser)return;const u=sessionUser;
 document.body.insertAdjacentHTML('beforeend',`<div class="modal-overlay" id="v23-profile"><section class="editor-modal"><div class="modal-head"><h2>Meu perfil</h2><button data-v23="closeProfile" type="button">×</button></div><div class="v23-modal-body"><div class="info-grid"><div class="info-cell"><small>Nome</small><strong>${esc(u.name)}</strong></div><div class="info-cell"><small>Login</small><strong>${esc(u.username)}</strong></div><div class="info-cell"><small>Granja</small><strong>${esc(u.farmName)}</strong></div><div class="info-cell"><small>Perfil</small><strong>${esc(u.role)}</strong></div></div><h3>Alterar senha</h3><form id="v23-password"><label class="field">Senha atual<input type="password" name="oldPassword" required autocomplete="current-password"></label><label class="field">Nova senha (mínimo 12 caracteres)<input type="password" name="newPassword" minlength="12" required autocomplete="new-password"></label><label class="field">Confirmação<input type="password" name="confirmation" minlength="12" required autocomplete="new-password"></label><button type="submit" class="primary-button">Alterar senha</button></form></div><div class="modal-footer"><button class="secondary-button" type="button" data-v23="closeProfile">Fechar</button></div></section></div>`);
 document.getElementById('v23-password').onsubmit=async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target));if(v.newPassword!==v.confirmation)return notify('As senhas não coincidem.',true);try{await api('/api/change-password',{method:'POST',body:JSON.stringify({oldPassword:v.oldPassword,newPassword:v.newPassword})});notify('Senha alterada com sucesso.');document.getElementById('v23-profile')?.remove();}catch(err){notify(err.message,true)}};
}
// Captura apenas nossas ações; não desativa as ações da interface anterior.
document.addEventListener('click',async e=>{const t=e.target.closest('[data-v23],#open-profile');if(!t)return;e.stopImmediatePropagation();if(t.id==='open-profile'){showProfile();return;}
 const a=t.dataset.v23,id=t.dataset.id||'';
 try{switch(a){case 'purchase':await purchaseAction(id);break;case 'purchasePdf':pdfView('Compra de ingredientes',id);break;case 'docs':await showDocuments(id);break;case 'downloadDocument':await downloadDocument(id);break;case 'closeDocuments':document.getElementById('v23-documents')?.remove();break;case 'confirm':await confirmProduction(id);break;case 'trace':await traceProduction(id);break;case 'feed':await registerFeed(id);break;case 'deactivate':await deactivateRecord(page,id);break;case 'view':showDetails(page,id);break;case 'closeTrace':document.getElementById('v23-trace')?.remove();break;case 'closeProfile':document.getElementById('v23-profile')?.remove();break;}}catch(err){notify(err.message,true)}
},true);

async function registerFeed(id){const order=lookup('Ordens de produção').find(x=>x._id===id);if(!order)return;
 const kg=prompt(`Quantidade de ração efetivamente consumida pelo lote ${order['Destino lote']} (kg):`);if(kg===null)return;
 const start=prompt('Início do período de consumo (AAAA-MM-DD):',new Date().toISOString().slice(0,10));if(!start)return;
 const end=prompt('Fim do período de consumo (AAAA-MM-DD):',start);if(!end)return;
 if(!confirm(`Registrar ${kg} kg consumidos pelo lote ${order['Destino lote']} no período ${start} a ${end}?`))return;
 try{await api('/api/v23/feed/consume',{method:'POST',body:JSON.stringify({orderId:id,kg,start,end})});notify('Consumo registrado no histórico do lote.');}catch(e){notify(e.message,true)}
}
const v23BasePIA=renderPIA;
renderPIA=function(){v23BasePIA();const animal=lookup('Animais e lotes').find(x=>x._id===data.meta.piaId);const lot=animal?.['Lote atual'];if(!lot)return;
 const p=document.createElement('section');p.className='panel';p.id='v23-feed-pia';p.innerHTML=`<h3>Alimentação e rastreabilidade do lote ${esc(lot)}</h3><p>Consultando consumos confirmados para o período...</p>`;content.append(p);
 api('/api/v23/feed/trace?lot='+encodeURIComponent(lot)).then(r=>{if(!p.isConnected)return;
  const records=r.consumptions||[];p.innerHTML=`<h3>Ração consumida pelo lote ${esc(lot)}</h3><p class="v23-notice">O consumo é atribuído ao lote no período. A distribuição individual é estimativa e não equivale a medição direta por animal.</p>`+
  (records.length?`<div class="table-scroll"><table class="data-table"><thead><tr><th>Período</th><th>Ração</th><th>Consumo do lote</th><th>Ordem</th><th>Fabricação</th></tr></thead><tbody>${records.map(x=>`<tr><td>${esc(x.period_start)} a ${esc(x.period_end)}</td><td>${esc(x.formula_snapshot?.formulaName||'')}</td><td>${Number(x.quantity_kg).toLocaleString('pt-BR')} kg</td><td>${esc(x.number)}</td><td>${esc(x.completed_at||'—')}</td></tr>`).join('')}</tbody></table></div>`:'<p>Nenhum consumo confirmado neste lote ainda.</p>');
 }).catch(e=>{if(p.isConnected)p.innerHTML='<h3>Alimentação e rastreabilidade</h3><p>'+esc(e.message)+'</p>'});
};

const v23TitleFor=titleFor;titleFor=function(type,record){if(type==='Compra de ingredientes')return 'ORDEM DE COMPRA — '+(record['Número da compra']||'');return v23TitleFor(type,record);};
// Prévia segura e importação atômica de até 100 animais por lote.
importAnimals=function(){const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.onchange=async()=>{
 if(!input.files?.length)return;try{const obj=JSON.parse(await input.files[0].text());const arr=Array.isArray(obj)?obj:Array.isArray(obj.animais)?obj.animais:null;if(!arr||!arr.length||arr.length>100)throw Error('Use um JSON de 1 a 100 animais por importação.');
 const animals=arr.map(x=>({'Identificação interna':String(x['Identificação interna']||x.id||'').trim(),Brinco:String(x.Brinco||x.brinco||'').trim(),Mossa:String(x.Mossa||x.mossa||'').trim(),Tatuagem:String(x.Tatuagem||x.tatuagem||'').trim(),'Fase atual':String(x['Fase atual']||x.fase||''),'Lote atual':String(x['Lote atual']||x.lote||'')}));
 const preview=animals.slice(0,8).map(x=>`${x['Identificação interna']} · Brinco: ${x.Brinco||'—'} · Mossa: ${x.Mossa||'—'}`).join('\n');if(!confirm(`IMPORTAÇÃO — ${sessionUser.farmName}\n\n${animals.length} animais. Prévia:\n${preview}\n\nConfirmar?`))return;
 const r=await api('/api/v23/animals/import',{method:'POST',body:JSON.stringify({animals})});if(!data.records['Animais e lotes'])data.records['Animais e lotes']=[];data.records['Animais e lotes'].unshift(...r.records);render();notify(`${r.records.length} animais importados de maneira transacional.`);
 }catch(e){notify('Importação recusada: '+e.message,true)}};input.click();};

async function showDocuments(entityId){try{const r=await api('/api/v23/documents?entityId='+encodeURIComponent(entityId));const list=r.documents.map(d=>`<tr><td>${esc(d.doc_type)}</td><td>${esc(d.file_name)}</td><td>${Math.ceil(d.size_bytes/1024)} KB</td><td><button type="button" data-v23="downloadDocument" data-id="${esc(d.id)}" class="table-action">Abrir/baixar</button></td></tr>`).join('');
 document.body.insertAdjacentHTML('beforeend',`<div class="modal-overlay" id="v23-documents"><section class="editor-modal"><div class="modal-head"><h2>Documentos vinculados à carga</h2><button type="button" data-v23="closeDocuments">×</button></div><div class="v23-modal-body"><p>Documentos identificados e isolados pela granja autenticada.</p><table class="data-table"><thead><tr><th>Tipo</th><th>Arquivo</th><th>Tamanho</th><th>Ação</th></tr></thead><tbody>${list||'<tr><td colspan="4">Nenhum documento anexado.</td></tr>'}</tbody></table></div><div class="modal-footer"><button type="button" data-v23="closeDocuments" class="secondary-button">Fechar</button></div></section></div>`);
 }catch(e){notify(e.message,true)}}
async function downloadDocument(id){const res=await fetch('/api/v23/documents/file?id='+encodeURIComponent(id),{credentials:'same-origin'});if(!res.ok)throw Error('Não foi possível baixar o arquivo');const blob=await res.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='anexo-'+id;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);}
