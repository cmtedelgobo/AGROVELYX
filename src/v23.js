/* Agrovelyx 2.3: operations guarded by authenticated session scope. */
const resp=(o,s=200)=>new Response(JSON.stringify(o),{status:s,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const error=(m,s=400)=>resp({error:m},s);
const uuid=()=>crypto.randomUUID();
const amount=(v)=>Number(v);
const normalized=(s)=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase().replace(/\s+/g,' ');
const getRecord=async(db,u,id,type)=>{const x=await db.prepare('SELECT id,record_type,payload_json FROM erp_records WHERE id=? AND farm_id=? AND organization_id=?').bind(id,u.farm_id,u.organization_id).first();return x&&(!type||x.record_type===type)?{...JSON.parse(x.payload_json),_id:id}:null;};
const audit=(db,u,action,id,details)=>db.prepare('INSERT INTO agv23_operation_audit(id,organization_id,farm_id,actor_id,event,entity_id,details) VALUES (?,?,?,?,?,?,?)').bind(uuid(),u.organization_id,u.farm_id,u.user_id,action,id,JSON.stringify(details));
const allowed=async(db,u,module)=>{if(['OWNER','ADMIN'].includes(u.role))return true;const p=await db.prepare(`SELECT up.allowed FROM user_permissions up JOIN access_permissions ap ON ap.id=up.permission_id WHERE up.organization_id=? AND up.user_id=? AND ap.permission_code=?`).bind(u.organization_id,u.user_id,`${module}:write`).first();return p?.allowed===1;};
const json=async(req)=>{const b=await req.json();if(!b||typeof b!=='object'||Array.isArray(b))throw Error('JSON inválido');return b;};
const validId=s=>typeof s==='string'&&s.length>0&&s.length<=100;
const stockView=async(db,u)=>{const rows=await db.prepare(`SELECT ingredient_name,SUM(remaining_kg) AS kg,COUNT(DISTINCT supplier_id) AS suppliers FROM agv23_ingredient_lots WHERE farm_id=? AND organization_id=? GROUP BY ingredient_name ORDER BY ingredient_name`).bind(u.farm_id,u.organization_id).all();return resp({ingredients:rows.results});};
async function createPurchase(req,db,u){
 if(!await allowed(db,u,'Compra de ingredientes'))return error('Sem permissão.',403);
 const b=await json(req),supplier=await getRecord(db,u,b.supplierId,'Fornecedores da fábrica'),ingredient=await getRecord(db,u,b.ingredientId,'Ingredientes por fornecedor');
 if(!supplier||!ingredient||ingredient['Fornecedor ID']!==supplier._id)return error('Fornecedor e ingrediente incompatíveis.',409);
 const qty=amount(b.kg),cost=amount(b.unitCost||0);if(!(qty>0)||!Number.isFinite(qty)||!(cost>=0)||!Number.isFinite(cost))return error('Quantidade ou preço inválidos.');
 const date=new Date().toLocaleDateString('en-GB',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'2-digit'}).replaceAll('/','');
 const seq=await db.prepare(`INSERT INTO agv23_daily_sequences(farm_id,kind,date_key,last_number) VALUES(?,'PURCHASE',?,1) ON CONFLICT(farm_id,kind,date_key) DO UPDATE SET last_number=last_number+1 RETURNING last_number`).bind(u.farm_id,date).first();
 const number=`${date}${String(seq.last_number).padStart(3,'0')}`,id=uuid();
 const record={_id:id,'Número da compra':number,'Fornecedor ID':supplier._id,'Fornecedor':supplier.Nome,'Ingrediente ID':ingredient._id,'Ingrediente':ingredient['Nome do ingrediente'],'Quantidade (kg)':qty,'Preço unitário (R$/kg)':cost,'Data de compra':String(b.date||''),'NF-e':String(b.invoice||''),'Situação':'PENDENTE','Gerado por':u.username,'_created':new Date().toISOString()};
 await db.batch([
  db.prepare(`INSERT INTO erp_records(id,organization_id,farm_id,record_type,payload_json,created_by,updated_by) VALUES(?,?,?,'Compra de ingredientes',?,?,?)`).bind(id,u.organization_id,u.farm_id,JSON.stringify(record),u.user_id,u.user_id),
  db.prepare(`INSERT INTO agv23_purchase_states(farm_id,record_id,status,changed_by) VALUES(?,?,'PENDENTE',?)`).bind(u.farm_id,id,u.user_id),
  audit(db,u,'PURCHASE_CREATED',id,{number,ingredient:record.Ingrediente,qty})
 ]);return resp({ok:true,record,number,id},201);
}
async function purchaseStatus(req,db,u){
 if(!await allowed(db,u,'Compra de ingredientes'))return error('Sem permissão.',403);
 const b=await json(req);if(!validId(b.id)||!['PENDENTE','RECEBIDO','CANCELADA'].includes(b.status))return error('Solicitação inválida.');
 const record=await getRecord(db,u,b.id,'Compra de ingredientes');if(!record)return error('Compra não encontrada nesta granja.',404);
 const existing=await db.prepare('SELECT status FROM agv23_purchase_states WHERE farm_id=? AND record_id=?').bind(u.farm_id,b.id).first();
 const current=existing?.status||'PENDENTE';if(current==='RECEBIDO'&&b.status!=='RECEBIDO')return error('Compra recebida não pode ser revertida por edição. Use devolução auditada.',409);
 if(current==='CANCELADA'&&b.status!=='CANCELADA')return error('Compra cancelada não pode ser reaberta.',409);
 if(b.status==='RECEBIDO'&&current!=='RECEBIDO'){
  const qty=amount(record['Quantidade (kg)']);if(!(qty>0)||!Number.isFinite(qty))return error('Quantidade da compra inválida.');
  const ing=normalized(record.Ingrediente);if(!ing)return error('Ingrediente não informado.');const supplier=await getRecord(db,u,record['Fornecedor ID'],'Fornecedores da fábrica');const ingredient=await getRecord(db,u,record['Ingrediente ID'],'Ingredientes por fornecedor');if(!supplier||!ingredient||ingredient['Fornecedor ID']!==supplier._id||normalized(ingredient['Nome do ingrediente'])!==ing)return error('Fornecedor ou ingrediente não pertencem à compra nesta granja.',409);
  const cost=amount(record['Preço unitário (R$/kg)']||0);if(!Number.isFinite(cost)||cost<0)return error('Custo inválido.');
  const lotId=uuid();const next={...record,Situação:'Recebido','Recebido em':new Date().toISOString(),'Recebido por usuário':u.username};
  const ops=[
   db.prepare('INSERT INTO agv23_ingredient_lots(id,organization_id,farm_id,purchase_id,ingredient_name,supplier_id,received_kg,remaining_kg,unit_cost) VALUES(?,?,?,?,?,?,?,?,?)').bind(lotId,u.organization_id,u.farm_id,b.id,ing,record['Fornecedor ID']||null,qty,qty,cost),
   db.prepare('INSERT INTO agv23_stock_ledger(id,organization_id,farm_id,ingredient_name,ingredient_lot_id,source_type,source_id,delta_kg,actor_user_id) VALUES(?,?,?,?,?,?,?,?,?)').bind(uuid(),u.organization_id,u.farm_id,ing,lotId,'RECEBIMENTO',b.id,qty,u.user_id),
   db.prepare(`INSERT INTO agv23_purchase_states(farm_id,record_id,status,changed_by) VALUES(?,?,?,?) ON CONFLICT(farm_id,record_id) DO UPDATE SET status=excluded.status,changed_by=excluded.changed_by,changed_at=CURRENT_TIMESTAMP`).bind(u.farm_id,b.id,'RECEBIDO',u.user_id),
   db.prepare('UPDATE erp_records SET payload_json=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND farm_id=? AND organization_id=?').bind(JSON.stringify(next),u.user_id,b.id,u.farm_id,u.organization_id),
   audit(db,u,'PURCHASE_RECEIVED',b.id,{ingredient:ing,kg:qty,lotId})
  ];await db.batch(ops);return resp({ok:true,status:'RECEBIDO',record:next});
 }
 if(b.status!==current){
  const next={...record,Situação:b.status==='CANCELADA'?'Cancelado':'Pedido'};
  await db.batch([
   db.prepare(`INSERT INTO agv23_purchase_states(farm_id,record_id,status,changed_by) VALUES(?,?,?,?) ON CONFLICT(farm_id,record_id) DO UPDATE SET status=excluded.status,changed_by=excluded.changed_by,changed_at=CURRENT_TIMESTAMP`).bind(u.farm_id,b.id,b.status,u.user_id),
   db.prepare('UPDATE erp_records SET payload_json=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND farm_id=? AND organization_id=?').bind(JSON.stringify(next),u.user_id,b.id,u.farm_id,u.organization_id),
   audit(db,u,'PURCHASE_STATUS',b.id,{from:current,to:b.status})
  ]);return resp({ok:true,status:b.status,record:next});
 }
 return resp({ok:true,status:current});
}
async function createOrder(req,db,u){
 if(!await allowed(db,u,'Ordens de produção'))return error('Sem permissão.',403);
 const b=await json(req);const formulaId=String(b.formulaId||'');const formula=await getRecord(db,u,formulaId,'Formulações');
 if(!formula)return error('Fórmula não encontrada nesta granja.',404);
 const kg=amount(b.kg),lot=String(b.destinationLot||'').trim();if(!Number.isFinite(kg)||kg<=0||!lot||lot.length>160)return error('Informe produção positiva e lote de destino.');
 const lines=Array.isArray(formula.Itens)?formula.Itens:[];if(!lines.length)return error('Fórmula sem ingredientes.',409);
 const weight=amount(formula['Peso da fórmula (kg)']);if(!(weight>0))return error('Peso base da fórmula inválido.',409);
 const sum=lines.reduce((n,l)=>n+(l.mode==='percent'?amount(l.qty)*weight/100:amount(l.qty)),0);if(!Number.isFinite(sum)||Math.abs(sum-weight)>0.01)return error('Formulação não fecha 100%.',409);
 const snapshotLines=[];for(const l of lines){if(!validId(l.id)||!(amount(l.qty)>0))return error('Ingredientes inválidos na fórmula.',409);const ingredient=await getRecord(db,u,l.id,'Ingredientes por fornecedor');if(!ingredient)return error('Ingrediente de fórmula não encontrado nesta granja.',409);snapshotLines.push({name:normalized(ingredient['Nome do ingrediente']),baseKg:l.mode==='percent'?amount(l.qty)*weight/100:amount(l.qty),ingredientId:l.id});}const snapshot=JSON.stringify({weight,lines:snapshotLines,formulaName:formula['Nome da ração'],phase:formula['Fase de utilização']});
 const date=new Date().toLocaleDateString('en-GB',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'2-digit'}).replaceAll('/','');
 // The UPDATE/RETURNING is atomic; unique(farm,kind,date) ensures one sequence per day.
 const seq=await db.prepare(`INSERT INTO agv23_daily_sequences(farm_id,kind,date_key,last_number) VALUES(?,'PRODUCTION',?,1) ON CONFLICT(farm_id,kind,date_key) DO UPDATE SET last_number=last_number+1 RETURNING last_number`).bind(u.farm_id,date).first();
 const number=`${date}${String(seq.last_number).padStart(3,'0')}`;const id=uuid(),now=new Date().toISOString();
 const record={_id:id,'Número da ordem':number,'Fórmula ID':formulaId,'Fórmula utilizada':formula['Nome da ração'],'Fase de utilização':formula['Fase de utilização'],'Destino lote':lot,'Produção (kg)':kg,'Silo destino':String(b.silo||''),'Situação':'Planejada','Data da produção':String(b.date||''),_created:now,_updated:now};
 await db.batch([
  db.prepare(`INSERT INTO agv23_production_orders(id,organization_id,farm_id,number,formula_record_id,formula_snapshot,destination_lot,phase,planned_kg,created_by) VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(id,u.organization_id,u.farm_id,number,formulaId,snapshot,lot,formula['Fase de utilização']||'',kg,u.user_id),
  db.prepare(`INSERT INTO erp_records(id,organization_id,farm_id,record_type,payload_json,created_by,updated_by) VALUES(?,?,?,'Ordens de produção',?,?,?)`).bind(id,u.organization_id,u.farm_id,JSON.stringify(record),u.user_id,u.user_id),
  audit(db,u,'ORDER_CREATED',id,{number,formulaId,lot,kg})
 ]);
 return resp({ok:true,id,number,record},201);
}
async function confirmOrder(req,db,u){
 if(!await allowed(db,u,'Ordens de produção'))return error('Sem permissão.',403);
 const b=await json(req);if(!validId(b.id))return error('Ordem inválida.');
 const order=await db.prepare(`SELECT * FROM agv23_production_orders WHERE id=? AND farm_id=? AND organization_id=?`).bind(b.id,u.farm_id,u.organization_id).first();if(!order)return error('Ordem não encontrada.',404);
 if(order.status!=='PLANEJADA')return error('Ordem já concluída ou cancelada.',409);
 const frozen=JSON.parse(order.formula_snapshot);const needs=new Map();
 for(const item of frozen.lines){const name=normalized(item.name),mass=amount(item.baseKg)*order.planned_kg/amount(frozen.weight);if(!(mass>0)||!Number.isFinite(mass))return error('Quantidade da fórmula inválida.',409);needs.set(name,(needs.get(name)||0)+mass);}
 const ops=[];const auditItems=[];let spent=0;
 for(const [name,qty] of needs){
  const lots=(await db.prepare(`SELECT id,purchase_id,supplier_id,remaining_kg,unit_cost FROM agv23_ingredient_lots WHERE farm_id=? AND organization_id=? AND ingredient_name=? AND remaining_kg>0 ORDER BY received_at,id`).bind(u.farm_id,u.organization_id,name).all()).results;
  let left=qty;
  for(const lot of lots){if(left<0.000001)break;const taken=Math.min(left,lot.remaining_kg);if(taken<=0)continue;left-=taken;spent+=taken*lot.unit_cost;
   ops.push(db.prepare('UPDATE agv23_ingredient_lots SET remaining_kg=remaining_kg-? WHERE id=? AND farm_id=?').bind(taken,lot.id,u.farm_id));
   ops.push(db.prepare('INSERT INTO agv23_stock_ledger(id,organization_id,farm_id,ingredient_name,ingredient_lot_id,source_type,source_id,delta_kg,actor_user_id) VALUES(?,?,?,?,?,?,?,?,?)').bind(uuid(),u.organization_id,u.farm_id,name,lot.id,'PRODUCAO',b.id,-taken,u.user_id));
   ops.push(db.prepare('INSERT INTO agv23_production_ingredients(id,order_id,ingredient_lot_id,ingredient_name,supplier_id,purchase_id,quantity_kg,unit_cost) VALUES(?,?,?,?,?,?,?,?)').bind(uuid(),b.id,lot.id,name,lot.supplier_id,lot.purchase_id,taken,lot.unit_cost));
   auditItems.push({ingredient:name,lotId:lot.id,fromPurchase:lot.purchase_id,quantityKg:taken});
  }
  if(left>0.000001)return error(`Estoque insuficiente: ${name}. Faltam ${left.toFixed(3)} kg.`,409);
 }
 const existing=await getRecord(db,u,b.id,'Ordens de produção');if(!existing)return error('Registro da ordem não encontrado.',409);
 const next={...existing,Situação:'Concluída','Confirmada em':new Date().toISOString(),'Confirmada por':u.username,'Custo real (R$)':spent,'Ingredientes consumidos':auditItems};
 ops.push(db.prepare(`UPDATE agv23_production_orders SET status='CONCLUIDA',completed_by=?,completed_at=CURRENT_TIMESTAMP WHERE id=? AND farm_id=? AND status='PLANEJADA'`).bind(u.user_id,b.id,u.farm_id));
 ops.push(db.prepare(`UPDATE erp_records SET payload_json=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND farm_id=? AND organization_id=?`).bind(JSON.stringify(next),u.user_id,b.id,u.farm_id,u.organization_id));
 ops.push(audit(db,u,'PRODUCTION_CONFIRMED',b.id,{spent,ingredients:auditItems}));
 // D1 batch is one SQLite transaction. The source unique index makes replays fail without double debit.
 try{await db.batch(ops);}catch(e){return error('Ordem não confirmada. Recarregue o estoque e tente novamente; nenhuma baixa parcial deve ser aplicada.',409);}
 return resp({ok:true,order:next,consumed:auditItems,cost:spent});
}
async function trace(req,db,u,url){const id=url.searchParams.get('id');if(!validId(id))return error('ID obrigatório.');const order=await db.prepare('SELECT id,number,destination_lot,phase,planned_kg,status,completed_at FROM agv23_production_orders WHERE id=? AND farm_id=? AND organization_id=?').bind(id,u.farm_id,u.organization_id).first();if(!order)return error('Ordem não encontrada.',404);const rows=await db.prepare(`SELECT p.ingredient_name,p.quantity_kg,p.purchase_id,p.supplier_id,p.unit_cost FROM agv23_production_ingredients p WHERE p.order_id=?`).bind(id).all();return resp({order,ingredients:rows.results});}
async function recordConsumption(req,db,u){
 if(!await allowed(db,u,'Consumo por lote'))return error('Sem permissão.',403);
 const b=await json(req);const order=await db.prepare('SELECT * FROM agv23_production_orders WHERE id=? AND farm_id=? AND organization_id=?').bind(b.orderId||'',u.farm_id,u.organization_id).first();
 if(!order||order.status!=='CONCLUIDA')return error('Fabricação ainda não concluída nesta granja.',409);
 const kg=amount(b.kg),start=String(b.start||''),end=String(b.end||'');if(!(kg>0)||!Number.isFinite(kg)||!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||end<start)return error('Informe quantidade e período válidos.');
 try{await db.batch([db.prepare('INSERT INTO agv23_feed_consumptions(id,organization_id,farm_id,order_id,destination_lot,period_start,period_end,quantity_kg,recorded_by) VALUES(?,?,?,?,?,?,?,?,?)').bind(uuid(),u.organization_id,u.farm_id,order.id,order.destination_lot,start,end,kg,u.user_id),audit(db,u,'FEED_CONSUMPTION',order.id,{lot:order.destination_lot,kg,start,end})]);}catch(e){return error('Consumo excede a produção disponível ou não pôde ser registrado.',409);}
 return resp({ok:true});
}
async function feedTrace(req,db,u,url){
 const lot=String(url.searchParams.get('lot')||'');if(!lot||lot.length>160)return error('Lote obrigatório.');
 const rows=await db.prepare(`SELECT c.period_start,c.period_end,c.quantity_kg,o.number,o.id AS order_id,o.completed_at,o.phase,o.formula_snapshot FROM agv23_feed_consumptions c JOIN agv23_production_orders o ON o.id=c.order_id WHERE c.farm_id=? AND c.organization_id=? AND c.destination_lot=? ORDER BY c.period_start DESC LIMIT 150`).bind(u.farm_id,u.organization_id,lot).all();
 return resp({lot,consumptions:rows.results.map(r=>({...r,formula_snapshot:JSON.parse(r.formula_snapshot)}))});
}
async function importAnimals(req,db,u){
 if(!await allowed(db,u,'Animais e lotes'))return error('Sem permissão.',403);
 const b=await json(req),animals=b.animals;
 if(!Array.isArray(animals)||animals.length<1||animals.length>100)return error('Envie entre 1 e 100 animais.',400);
 const cur=(await db.prepare(`SELECT payload_json FROM erp_records WHERE farm_id=? AND organization_id=? AND record_type='Animais e lotes'`).bind(u.farm_id,u.organization_id).all()).results.map(x=>JSON.parse(x.payload_json));
 const attributes=['Identificação interna','Brinco','Mossa','Tatuagem'];const checks=new Map(attributes.map(k=>[k,new Set(cur.map(x=>String(x[k]||'').trim()).filter(Boolean))]));
 const prepared=[];
 for(const x of animals){if(!x||typeof x!=='object')return error('Animal inválido.');const record={};for(const key of attributes)record[key]=String(x[key]||'').trim().slice(0,120);if(!record['Identificação interna'])return error('Identificação interna obrigatória.');for(const key of attributes){const val=record[key];if(val&&checks.get(key).has(val))return error(`${key} duplicado: ${val}`,409);if(val)checks.get(key).add(val);}record['Fase atual']=String(x['Fase atual']||'').slice(0,90);record['Lote atual']=String(x['Lote atual']||'').slice(0,100);record._id=uuid();prepared.push(record);}
 const ops=[];for(const record of prepared){ops.push(db.prepare(`INSERT INTO erp_records(id,organization_id,farm_id,record_type,payload_json,created_by,updated_by) VALUES(?,?,?,'Animais e lotes',?,?,?)`).bind(record._id,u.organization_id,u.farm_id,JSON.stringify(record),u.user_id,u.user_id));}
 ops.push(audit(db,u,'ANIMAL_IMPORT',prepared[0]._id,{count:prepared.length}));await db.batch(ops);return resp({ok:true,records:prepared});
}
async function uploadDocument(req,db,u){
 if(!await allowed(db,u,'Logística'))return error('Sem permissão.',403);
 const b=await json(req),entityId=String(b.entityId||''),docType=String(b.docType||'');
 if(!validId(entityId)||!['NFE','CTE','GTA','OUTRO'].includes(docType))return error('Documento inválido.');
 const record=await getRecord(db,u,entityId,'Logística');if(!record)return error('Carga não encontrada.',404);
 const mime=String(b.mimeType||'');if(!['application/pdf','application/xml','text/xml','image/png','image/jpeg'].includes(mime))return error('Envie PDF, XML, PNG ou JPEG.',415);
 const name=String(b.fileName||'documento').replace(/[^a-zA-Z0-9_\-. áàâãéêíóôõúç]/gi,'_').slice(0,120);
 const base64=String(b.base64||'');if(!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)||base64.length>340000)return error('Documento excede o limite de 250 KB.',413);
 const decoded=atob(base64),bytes=decoded.length;if(bytes<1||bytes>250000)return error('Arquivo inválido ou maior que 250 KB.',413);
 const id=uuid();await db.batch([db.prepare(`INSERT INTO agv23_document_attachments(id,organization_id,farm_id,entity_type,entity_id,doc_type,file_name,mime_type,size_bytes,content_base64,uploaded_by) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).bind(id,u.organization_id,u.farm_id,'Logística',entityId,docType,name,mime,bytes,base64,u.user_id),audit(db,u,'DOCUMENT_ATTACHED',entityId,{docType,name,bytes})]);
 return resp({ok:true,id,name});
}
async function listDocuments(db,u,url){const entityId=url.searchParams.get('entityId');if(!validId(entityId)||!await getRecord(db,u,entityId,'Logística'))return error('Carga não encontrada.',404);
 const rows=await db.prepare(`SELECT id,doc_type,file_name,mime_type,size_bytes,uploaded_at FROM agv23_document_attachments WHERE entity_type='Logística' AND entity_id=? AND farm_id=? AND organization_id=? ORDER BY uploaded_at DESC`).bind(entityId,u.farm_id,u.organization_id).all();return resp({documents:rows.results});}
async function fetchDocument(db,u,url){const id=url.searchParams.get('id');if(!validId(id))return error('Documento inválido.');
 const row=await db.prepare(`SELECT file_name,mime_type,content_base64 FROM agv23_document_attachments WHERE id=? AND farm_id=? AND organization_id=?`).bind(id,u.farm_id,u.organization_id).first();if(!row)return error('Documento não encontrado.',404);
 const str=atob(row.content_base64),bytes=Uint8Array.from(str,c=>c.charCodeAt(0));
 return new Response(bytes,{headers:{'content-type':row.mime_type,'content-disposition':`attachment; filename="${row.file_name.replace(/"/g,'')}"`,'cache-control':'no-store','x-content-type-options':'nosniff'}});
}
async function deleteRecord(req,db,u){const b=await json(req);if(!validId(b.id)||!String(b.reason||'').trim())return error('ID e justificativa obrigatórios.');const record=await getRecord(db,u,b.id);if(!record)return error('Registro não encontrado.',404);const type=String(b.type||'');if(!await allowed(db,u,type))return error('Sem permissão.',403);if(type==='Compra de ingredientes'){const st=await db.prepare('SELECT status FROM agv23_purchase_states WHERE farm_id=? AND record_id=?').bind(u.farm_id,b.id).first();if(st?.status==='RECEBIDO')return error('Compra recebida não pode ser inativada.',409);}if(type==='Ordens de produção'){const st=await db.prepare('SELECT status FROM agv23_production_orders WHERE farm_id=? AND id=?').bind(u.farm_id,b.id).first();if(st?.status==='CONCLUIDA')return error('Ordem concluída não pode ser inativada.',409);}
 const x=await db.prepare('SELECT record_type FROM erp_records WHERE id=? AND farm_id=? AND organization_id=?').bind(b.id,u.farm_id,u.organization_id).first();if(x?.record_type!==type)return error('Tipo inválido.',409);
 // Never hard-delete anything with audit or operational downstream dependencies.
 if(['Compra de ingredientes','Ordens de produção','Formulações','Ingredientes por fornecedor','Fornecedores da fábrica','Animais e lotes','Logística','Treinamentos','Colaboradores'].includes(type)){
  const status=type==='Colaboradores'?'Situação':'_status';const val=status==='Situação'?'Inativo':'INATIVO';const next={...record,[status]:val,'Inativado por':u.username,'Justificativa de inativação':String(b.reason).slice(0,500)};
  await db.batch([db.prepare('UPDATE erp_records SET payload_json=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND farm_id=? AND organization_id=?').bind(JSON.stringify(next),u.user_id,b.id,u.farm_id,u.organization_id),audit(db,u,'RECORD_DEACTIVATED',b.id,{type,reason:b.reason})]);return resp({ok:true,mode:'inactivated',record:next});
 }
 return error('Exclusão não habilitada para este tipo; solicite inativação auditada.',409);
}
export async function handleV23(req,db,u,url){try{
 const path=url.pathname,method=req.method;
 if(path==='/api/v23/stock'&&method==='GET')return stockView(db,u);
 if(path==='/api/v23/documents'&&method==='POST')return uploadDocument(req,db,u);
 if(path==='/api/v23/documents'&&method==='GET')return listDocuments(db,u,url);
 if(path==='/api/v23/documents/file'&&method==='GET')return fetchDocument(db,u,url);
 if(path==='/api/v23/animals/import'&&method==='POST')return importAnimals(req,db,u);
 if(path==='/api/v23/feed/consume'&&method==='POST')return recordConsumption(req,db,u);
 if(path==='/api/v23/feed/trace'&&method==='GET')return feedTrace(req,db,u,url);
 if(path==='/api/v23/purchases'&&method==='POST')return createPurchase(req,db,u);
 if(path==='/api/v23/purchase/status'&&method==='POST')return purchaseStatus(req,db,u);
 if(path==='/api/v23/orders'&&method==='POST')return createOrder(req,db,u);
 if(path==='/api/v23/production/confirm'&&method==='POST')return confirmOrder(req,db,u);
 if(path==='/api/v23/production/trace'&&method==='GET')return trace(req,db,u,url);
 if(path==='/api/v23/records/deactivate'&&method==='POST')return deleteRecord(req,db,u);
 return error('Rota inexistente.',404);
 }catch(e){console.error('AGV23',e?.message);return error('Operação não concluída. Confira os dados ou a migração 016.',500);}}
