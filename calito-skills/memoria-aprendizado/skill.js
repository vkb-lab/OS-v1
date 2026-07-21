(()=>{
  const KEY='calito:memoria-aprendizado:v1';
  const SESSION='calito:memoria-aprendizado:session:v1';
  const clean=s=>String(s||'').trim();
  const load=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{"facts":[],"decisions":[],"interactions":[]}')}catch{return {facts:[],decisions:[],interactions:[]}}};
  const save=db=>localStorage.setItem(KEY,JSON.stringify(db));
  const now=()=>new Date().toISOString();
  const classify=(text)=>{const t=text.toLowerCase();if(/estoque|unidades? (em )?estoque/.test(t))return {type:'estoque',ttlHours:24};if(/transito|trânsito|chegando|pedido feito/.test(t))return {type:'transito',ttlHours:72};if(/prazo|dias.*fornecedor|fornecedor.*dias/.test(t))return {type:'prazo_fornecedor',ttlHours:720};if(/pedido minimo|pedido mínimo|caixa fechada|fardo/.test(t))return {type:'pedido_minimo',ttlHours:2160};if(/custo atual|preco de custo|preço de custo/.test(t))return {type:'custo_atual',ttlHours:168};if(/preco de venda|preço de venda/.test(t))return {type:'preco_venda',ttlHours:168};return {type:'observacao',ttlHours:null}};
  function rememberFact(subject,value,source='usuario',confidence='informado'){const db=load(),c=classify(subject+' '+value);db.facts.push({id:crypto.randomUUID?.()||String(Date.now()),subject:clean(subject),value:clean(value),type:c.type,source,confidence,created_at:now(),expires_at:c.ttlHours?new Date(Date.now()+c.ttlHours*3600000).toISOString():null,status:'ativo'});save(db);return db.facts.at(-1)}
  function rememberInteraction(question,answer,topic='geral'){const db=load();db.interactions.push({at:now(),question:clean(question),answer:clean(answer),topic});if(db.interactions.length>500)db.interactions=db.interactions.slice(-500);save(db)}
  function rememberDecision(data){const db=load();db.decisions.push({id:crypto.randomUUID?.()||String(Date.now()),created_at:now(),status:'aberta',...data});save(db);return db.decisions.at(-1)}
  function closeDecision(id,outcome){const db=load(),d=db.decisions.find(x=>x.id===id);if(!d)return null;d.status='avaliada';d.outcome={...outcome,evaluated_at:now()};save(db);return d}
  function activeFacts(subject){const q=String(subject||'').toLowerCase(),t=Date.now();return load().facts.filter(f=>f.status==='ativo'&&(!f.expires_at||new Date(f.expires_at).getTime()>t)&&(!q||f.subject.toLowerCase().includes(q)||f.value.toLowerCase().includes(q)))}
  function staleFacts(){const t=Date.now();return load().facts.filter(f=>f.expires_at&&new Date(f.expires_at).getTime()<=t)}
  function setSession(v){sessionStorage.setItem(SESSION,JSON.stringify(v))}function getSession(){try{return JSON.parse(sessionStorage.getItem(SESSION)||'null')}catch{return null}}
  window.CalitoMemory={rememberFact,rememberInteraction,rememberDecision,closeDecision,activeFacts,staleFacts,load,setSession,getSession,policy:{principles:['Registrar origem e data','Separar fato informado de inferência','Dados voláteis expiram','Não transformar opinião em verdade','Decisões podem ser avaliadas depois','Aprendizado operacional é privado deste navegador até existir backend sincronizado']}};
})();