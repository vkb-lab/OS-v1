import http from 'node:http';
import crypto from 'node:crypto';

const PORT = Number(process.env.PORT || 10000);
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPOSITORY = process.env.GITHUB_REPOSITORY || process.env.GITHUB_REPO || 'vkb-lab/OS-v1';
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://vkb-lab.github.io';
const MAX_BYTES = Number(process.env.MAX_PAYLOAD_BYTES || 120000);
const RATE_LIMIT_MS = Number(process.env.RATE_LIMIT_MS || 1500);
// Preferir CALITO_ADMIN_PASSWORD_HASH no Render. O fallback mantém compatibilidade com o acesso solicitado agora.
const ADMIN_PASSWORD_HASH = process.env.CALITO_ADMIN_PASSWORD_HASH || 'e8522fd87f748c388684c3eff07de12ac2f77d5c8f5f0222d50c7e819e26ca91';
const RESPONSE_DIR = 'calito-data/transicao/respostas';
const FINANCE_PATH = 'calito-data/transicao/financeiro.json';
const REQUIRED_FIELDS = ['nome_completo', 'cpf_cnpj', 'objeto_entendimento'];

if (!GITHUB_TOKEN) { console.error('Missing required GitHub token configuration.'); process.exit(1); }
if (REPOSITORY !== 'vkb-lab/OS-v1' || BRANCH !== 'main') { console.error('Repository or branch configuration is not allowed.'); process.exit(1); }

const rate = new Map();
const idempotencyCache = new Map();
const adminTokens = new Map();

function send(res, code, body, origin = ALLOWED_ORIGIN) {
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': origin,
    'access-control-allow-headers': 'content-type,x-idempotency-key,authorization',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  });
  res.end(JSON.stringify(body));
}
function sanitizeText(value, max = 12000) { return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').slice(0, max).trim(); }
function newProtocol() { return `TR-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(6).toString('hex').toUpperCase()}`; }
function safeFileName(receivedAt, protocolo) { const stamp = receivedAt.replace(/[-:.]/g, '').replace('Z', ''); const cleanProtocol = String(protocolo).replace(/[^A-Z0-9-]/gi, '').slice(0, 40); return `JOAO_${stamp}_${cleanProtocol}.json`; }
function buildPacket(body, idempotencyKey) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('invalid_payload');
  if (!body.respostas || typeof body.respostas !== 'object' || Array.isArray(body.respostas)) throw new Error('invalid_payload');
  if (body.path || body.file || body.filename || body.repository || body.repo || body.branch) throw new Error('unsupported_client_control');
  const respostas = {};
  for (const [key, value] of Object.entries(body.respostas)) { if (/^[a-z0-9_]{1,80}$/i.test(key)) respostas[key] = sanitizeText(value); }
  for (const field of REQUIRED_FIELDS) if (!respostas[field]) throw new Error('required_fields');
  const recebidoEm = new Date().toISOString();
  return { meta: { tipo:'questionario_alinhamento_transicao', versao:1, recebido_em:recebidoEm, protocolo:newProtocol(), origem:'Calito Casa da Limpeza', idempotency_key_hash:idempotencyKey ? crypto.createHash('sha256').update(idempotencyKey).digest('hex').slice(0,16) : null }, respostas };
}
async function github(path, init = {}) {
  const [owner, repo] = REPOSITORY.split('/');
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}${path}`, { ...init, headers:{ authorization:`Bearer ${GITHUB_TOKEN}`, accept:'application/vnd.github+json', 'x-github-api-version':'2022-11-28', 'user-agent':'calito-form-backend', ...(init.headers||{}) } });
  const text = await response.text(); let data=null; try{data=text?JSON.parse(text):null}catch{data={message:text.slice(0,160)}} return {response,data};
}
async function createFile(packet) {
  const name=safeFileName(packet.meta.recebido_em,packet.meta.protocolo); if(name.includes('..')||name.includes('/')||name.includes('\\')) throw new Error('invalid_filename');
  const targetPath=`${RESPONSE_DIR}/${name}`; const content=Buffer.from(JSON.stringify(packet,null,2),'utf8').toString('base64'); const encodedPath=encodeURIComponent(targetPath).replace(/%2F/g,'/');
  const {response,data}=await github(`/contents/${encodedPath}`,{method:'PUT',body:JSON.stringify({message:'data(transicao): registrar alinhamento do comprador [skip ci]',content,branch:BRANCH})});
  if(!response.ok){console.error('GitHub write failed',response.status,data?.message||'unknown');throw new Error('github_write_failed')} return {path:targetPath,commit:data?.commit?.sha||null};
}
async function readFinance(){
  const encoded=encodeURIComponent(FINANCE_PATH).replace(/%2F/g,'/'); const {response,data}=await github(`/contents/${encoded}?ref=${encodeURIComponent(BRANCH)}`);
  if(!response.ok) throw new Error('finance_read_failed');
  const json=JSON.parse(Buffer.from(data.content,'base64').toString('utf8')); return {json,sha:data.sha};
}
async function saveFinance(finance,sha,autor){
  finance.atualizado_em=new Date().toISOString(); const content=Buffer.from(JSON.stringify(finance,null,2),'utf8').toString('base64'); const encoded=encodeURIComponent(FINANCE_PATH).replace(/%2F/g,'/');
  const {response,data}=await github(`/contents/${encoded}`,{method:'PUT',body:JSON.stringify({message:`data(transicao): registrar pagamento por ${autor} [skip ci]`,content,sha,branch:BRANCH})});
  if(!response.ok) throw new Error('finance_write_failed'); return data?.commit?.sha||null;
}
function financeSummary(finance){const total=Number(finance.valor_total||0);const pago=(finance.lancamentos||[]).reduce((s,l)=>s+Number(l.valor||0),0);return {valor_total:total,pago,saldo:Math.max(0,total-pago),atualizado_em:finance.atualizado_em,lancamentos:finance.lancamentos||[]};}
function adminAuthorized(req){const h=String(req.headers.authorization||'');if(!h.startsWith('Bearer '))return false;const token=h.slice(7);const exp=adminTokens.get(token);if(!exp)return false;if(exp<Date.now()){adminTokens.delete(token);return false}return true;}
async function readBody(req){let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw,'utf8')>MAX_BYTES)throw new Error('payload_too_large')}return raw;}
function checkOrigin(req){const origin=req.headers.origin||'';return origin===ALLOWED_ORIGIN||origin===`${ALLOWED_ORIGIN}/`;}
function rateLimit(req){const source=crypto.createHash('sha256').update(String(req.headers['x-forwarded-for']||req.socket.remoteAddress||'unknown').split(',')[0].trim()).digest('hex').slice(0,16);const now=Date.now(),last=rate.get(source)||0;if(now-last<RATE_LIMIT_MS)return false;rate.set(source,now);return true;}

const server=http.createServer(async(req,res)=>{
  try{
    if(req.method==='OPTIONS')return send(res,204,{});
    if(req.url==='/health'&&req.method==='GET')return send(res,200,{ok:true,service:'calito-form-backend'});
    if(!checkOrigin(req))return send(res,403,{ok:false,error:'origin_not_allowed'});

    if(req.url==='/api/admin-auth'&&req.method==='POST'){
      const raw=await readBody(req);let body={};try{body=JSON.parse(raw||'{}')}catch{throw new Error('invalid_json')}
      const suppliedHash=crypto.createHash('sha256').update(String(body.password||'')).digest('hex');
      const a=Buffer.from(suppliedHash),b=Buffer.from(ADMIN_PASSWORD_HASH);const ok=a.length===b.length&&crypto.timingSafeEqual(a,b);if(!ok)return send(res,401,{ok:false,error:'invalid_credentials'});
      const token=crypto.randomBytes(24).toString('base64url');adminTokens.set(token,Date.now()+8*60*60*1000);return send(res,200,{ok:true,token,editor:'Rogger'});
    }

    if(req.url==='/api/transicao-financeiro'&&req.method==='GET'){const {json}=await readFinance();return send(res,200,{ok:true,...financeSummary(json)});}
    if(req.url==='/api/transicao-financeiro'&&req.method==='POST'){
      if(!rateLimit(req))return send(res,429,{ok:false,error:'too_many_requests'});
      const raw=await readBody(req);let body={};try{body=JSON.parse(raw||'{}')}catch{throw new Error('invalid_json')}
      const valor=Number(body.valor),data=sanitizeText(body.data,10),descricao=sanitizeText(body.descricao,500);let autor='Ariane e João';
      if(!Number.isFinite(valor)||valor<=0||valor>200000||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(data)||!descricao)throw new Error('invalid_finance_entry');
      if(body.autor==='Rogger'){if(!adminAuthorized(req))return send(res,401,{ok:false,error:'admin_auth_required'});autor='Rogger';}
      const {json,sha}=await readFinance();json.lancamentos=json.lancamentos||[];json.lancamentos.push({id:crypto.randomUUID(),data,valor,descricao,tipo:sanitizeText(body.tipo||'pagamento',40),autor,registrado_em:new Date().toISOString()});
      const commit=await saveFinance(json,sha,autor);return send(res,200,{ok:true,...financeSummary(json),commit:commit?.slice(0,12)||null});
    }

    if(req.url==='/api/alinhamento'&&req.method!=='POST')return send(res,405,{ok:false,error:'method_not_allowed'});
    if(req.url!=='/api/alinhamento')return send(res,404,{ok:false,error:'not_found'});
    const idempotencyKey=sanitizeText(req.headers['x-idempotency-key']||'',160);if(idempotencyKey&&idempotencyCache.has(idempotencyKey))return send(res,200,idempotencyCache.get(idempotencyKey));if(!rateLimit(req))return send(res,429,{ok:false,error:'too_many_requests'});
    const raw=await readBody(req);let parsed;try{parsed=JSON.parse(raw||'{}')}catch{throw new Error('invalid_json')}const packet=buildPacket(parsed,idempotencyKey),saved=await createFile(packet);const result={ok:true,protocolo:packet.meta.protocolo,path:saved.path,commit:saved.commit?saved.commit.slice(0,12):null};if(idempotencyKey)idempotencyCache.set(idempotencyKey,result);return send(res,200,result);
  }catch(error){const clientErrors=new Set(['payload_too_large','required_fields','invalid_payload','invalid_json','unsupported_client_control','invalid_finance_entry']);const code=error.message==='payload_too_large'?413:clientErrors.has(error.message)?400:500;const safe=clientErrors.has(error.message)||error.message==='payload_too_large'?error.message:'save_failed';return send(res,code,{ok:false,error:safe});}
});
server.listen(PORT,()=>console.log(`Calito form backend listening on ${PORT}`));