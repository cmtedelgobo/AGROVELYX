// AGROVELYX 2.3.1 — manejo autenticado, com isolamento por granja.
const OPERATIONS = new Set(['Cio','Cobertura','Gestação','Parto','Maternidade','Pré-creche','Creche','Desmame','Recria','AVA','Terminação','Vacinação','Tratamentos','Mortalidade','Lotes e movimentações']);
const PHASES = new Set(['Reprodução','Cio','Cobertura','Gestação','Parto','Maternidade','Pré-creche','Creche','Desmame','Recria','AVA','Terminação','Outra']);
const REPRO = new Set(['Cio','Cobertura','Gestação','Parto','Maternidade','Desmame']);
const ok = (obj, status=200)=>new Response(JSON.stringify(obj),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const deny=(message,status=400)=>ok({error:message},status);
const clean=(x,n=150)=>typeof x==='string'?x.trim().slice(0,n):'';
const uid=()=>crypto.randomUUID();
async function authorized(db,u,type){if(['OWNER','ADMIN'].includes(u.role))return true;const r=await db.prepare('SELECT up.allowed FROM user_permissions up JOIN access_permissions p ON p.id=up.permission_id WHERE up.user_id=? AND up.organization_id=? AND p.permission_code=?').bind(u.user_id,u.organization_id,`${type}:write`).first();return r?.allowed===1;}
function audit(db,u,kind,id,action){return db.prepare('INSERT INTO audit_logs (id,organization_id,farm_id,user_id,action_type,module_name,entity_type,entity_id,occurred_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(uid(),u.organization_id,u.farm_id,u.user_id,action,kind,'erp_records',id,new Date().toISOString());}
function sourceId(a){return String(a['Identificação interna']||a._id||'').trim();}
async function animalRecord(db,u,id){const row=await db.prepare("SELECT id,payload_json FROM erp_records WHERE id=? AND record_type='Animais e lotes' AND organization_id=? AND farm_id=?").bind(id,u.organization_id,u.farm_id).first();if(!row)return null;try{return {id:row.id,value:JSON.parse(row.payload_json)}}catch{return null}}
function animalOk(a){return !['Morto','Vendido','Descartado','Inativo'].includes(a.Situação||'Ativo')}
export async function handleV231(req,db,u,url){
 if(req.method!=='POST')return deny('Método não permitido.',405);
 let body;try{body=await req.json()}catch{return deny('JSON inválido')}
 if(!body||typeof body!=='object'||Array.isArray(body))return deny('Payload inválido');
 if(url.pathname==='/api/v231/movement'){
  if(!await authorized(db,u,'Animais e lotes'))return deny('Sem permissão para movimentar animais.',403);
  const id=clean(body.animalId,100),phase=clean(body.phase,40),lot=clean(body.lot,100),facility=clean(body.facility,120),reason=clean(body.reason,400),date=clean(body.date,30);
  if(!id||!PHASES.has(phase)||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!reason)return deny('Informe animal, fase, data e justificativa.');
  const found=await animalRecord(db,u,id);if(!found)return deny('Animal não encontrado nesta granja.',404);
  if(!animalOk(found.value))return deny('Animal inativo: movimentação bloqueada.',409);
  const old=found.value, changed={...old,'Fase atual':phase,'Lote atual':lot,'Baia / localização':facility,_id:id,_updated:new Date().toISOString()};
  const evId=uid(),ev={_id:evId,'Identificação interna':sourceId(old),'Animal ID':id,'ID animal / lote':sourceId(old),'Movimentação':'Mudança de fase','Fase anterior':old['Fase atual']||'Não informada','Fase atual':phase,'Lote anterior':old['Lote atual']||'','Lote atual':lot,'Instalação anterior':old['Baia / localização']||'','Destino / instalação':facility,'Data do manejo':date,'Justificativa':reason,'Responsável':u.display_name,'_updated':new Date().toISOString()};
  const statements=[db.prepare('UPDATE erp_records SET payload_json=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND organization_id=? AND farm_id=?').bind(JSON.stringify(changed),u.user_id,id,u.organization_id,u.farm_id),db.prepare('INSERT INTO erp_records (id,organization_id,farm_id,record_type,payload_json,created_by,updated_by) VALUES (?,?,?,?,?,?,?)').bind(evId,u.organization_id,u.farm_id,'Lotes e movimentações',JSON.stringify(ev),u.user_id,u.user_id),audit(db,u,'Animais e lotes',id,'MOVE'),audit(db,u,'Lotes e movimentações',evId,'CREATE')];
  await db.batch(statements);
  return ok({ok:true,animal:changed,event:ev});
 }
 if(url.pathname==='/api/v231/operational/batch'){
  const type=clean(body.type,80);if(!OPERATIONS.has(type))return deny('Operação inválida');if(!await authorized(db,u,type))return deny('Sem permissão para lançar neste módulo.',403);
  const entries=body.entries;if(!Array.isArray(entries)||!entries.length||entries.length>100)return deny('Selecione de 1 a 100 animais/lotes por lançamento.');
  const ids=new Set(),verified=[],now=new Date().toISOString();
  for(const item of entries){const animalId=clean(item.animalId,100),lotId=clean(item.lotId,100);if(Boolean(animalId)===Boolean(lotId))return deny('Selecione um animal ou lote por linha.');
   const key=animalId?'animal:'+animalId:'lot:'+lotId;if(ids.has(key))return deny('Animal/lote repetido no lançamento.');ids.add(key);
   if(animalId){const found=await animalRecord(db,u,animalId);if(!found)return deny('Um dos animais não existe nesta granja.',404);if(!animalOk(found.value))return deny('Um dos animais está inativo.',409);if(REPRO.has(type)&&String(found.value.Sexo||found.value['Sexo']||'').toLowerCase().includes('mach'))return deny('A operação reprodutiva exige matrizes fêmeas.',409);verified.push({animal:found.value,id:animalId,lot:''});}
   else {const matching=await db.prepare("SELECT id,payload_json FROM erp_records WHERE record_type='Lotes e movimentações' AND organization_id=? AND farm_id=? AND id=?").bind(u.organization_id,u.farm_id,lotId).first();if(!matching)return deny('Lote não encontrado nesta granja.',404);let lot;try{lot=JSON.parse(matching.payload_json)}catch{return deny('Lote inválido.',409)}verified.push({animal:null,id:'',lot:lotId,lotValue:lot});}
  }
  const records=[],stmts=[];
  for(let i=0;i<entries.length;i++){
   const raw=entries[i],target=verified[i];const values=raw.values;
   if(!values||typeof values!=='object'||Array.isArray(values))return deny('Preencha os dados de cada linha.');
   let copy={};for(const [k,v] of Object.entries(values)){if(typeof k!=='string'||k.length>100||typeof v==='object')return deny('Campo inválido.');copy[k]=typeof v==='string'?v.trim().slice(0,500):v;}
   const date=clean(copy['Data do manejo']||copy['Data do cio']||copy['Data da inseminação']||copy['Data do parto']||'',30);
   if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return deny('Informe a data de cada animal/lote.');
   const id=uid();const animal=target.animal;
   const record={...copy,_id:id,_created:now,_updated:now,'Animal ID':target.id,'Lote ID':target.lot,'ID animal / lote':animal?sourceId(animal):target.lotValue?.['Código do lote']||target.lot,'Identificação interna':animal?sourceId(animal):'','Brinco':animal?.Brinco||'','Tatuagem':animal?.Tatuagem||'','Mossa':animal?.Mossa||'','Lote atual':animal?.['Lote atual']||target.lotValue?.['Código do lote']||'','Responsável pelo lançamento':u.display_name};
   records.push(record);
   stmts.push(db.prepare('INSERT INTO erp_records(id,organization_id,farm_id,record_type,payload_json,created_by,updated_by) VALUES(?,?,?,?,?,?,?)').bind(id,u.organization_id,u.farm_id,type,JSON.stringify(record),u.user_id,u.user_id));
   stmts.push(audit(db,u,type,id,'CREATE'));
  }
  await db.batch(stmts);
  return ok({ok:true,records});
 }
 return deny('Rota não encontrada',404);
}
