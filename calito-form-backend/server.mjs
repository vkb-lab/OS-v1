import http from 'node:http';
import crypto from 'node:crypto';

const PORT = Number(process.env.PORT || 10000);
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPOSITORY = process.env.GITHUB_REPOSITORY || process.env.GITHUB_REPO || 'vkb-lab/OS-v1';
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://vkb-lab.github.io';
const MAX_BYTES = Number(process.env.MAX_PAYLOAD_BYTES || 120000);
const RATE_LIMIT_MS = Number(process.env.RATE_LIMIT_MS || 1200);
const FINANCE_PATH = 'calito-data/transicao/financeiro.json';

if (!GITHUB_TOKEN) { console.error('Missing required GitHub token configuration.'); process.exit(1); }
if (REPOSITORY !== 'vkb-lab/OS-v1' || BRANCH !== 'main') { console.error('Repository or branch configuration is not allowed.'); process.exit(1); }

const rate = new Map();
function send(res, code, body, origin = ALLOWED_ORIGIN) {
  res.writeHead(code, {
    'content-type':'application/json; charset=utf-8',
    'access-control-allow-origin':origin,
    'access-control-allow-headers':'content-type,x-idempotency-key',
    'access-control-allow-methods':'GET,POST,OPTIONS',
    'cache-control':'no-store','x-content-type-options':'nosniff'
  });
  res.end(JSON.stringify(body));
}
function sanitizeText(value,max=500){return String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').slice(0,max).trim();}
async function github(path,init={}){
  const [owner,repo]=REPOSITORY.split('/');
  const response=await fetch(`https://api.github.com/repos/${owner}/${repo}${path}`,{...init,headers:{authorization:`Bearer ${GITHUB_TOKEN}`,accept:'application/vnd.github+json','x-github-api-version':'2022-11-28','user-agent':'calito-finance-backend',...(init.headers||{})}});
  const text=await response.text();let data=null;try{data=text?JSON.parse(text):null}catch{data={message:text.slice(0,160)}}return{response,data};
}
async function readFinance(){
  const encoded=encodeURIComponent(FINANCE_PATH).replace(/%2F/g,'/');
  const {response,data}=await github(`/contents/${encoded}?ref=${encodeURIComponent(BRANCH)}`);
  if(!response.ok)throw new Error('finance_read_failed');
  return {json:JSON.parse(Buffer.from(data.content,'base64').toString('utf8')),sha:data.sha};
}
async function saveFinance(finance,sha,autor,natureza){
  finance.atualizado_em=new Date().toISOString();
  const encoded=encodeURIComponent(FINANCE_PATH).replace(/%2F/g,'/');
  const content=Buffer.from(JSON.stringify(finance,null,2),'utf8').toString('base64');
  const label=natureza==='acrescimo'?'acrescimo':'abatimento';
  const {response,data}=await github(`/contents/${encoded}`,{method:'PUT',body:JSON.stringify({message:`data(transicao): registrar ${label} por ${autor} [skip ci]`,content,sha,branch:BRANCH})});
  if(!response.ok)throw new Error('finance_write_failed');
  return data?.commit?.sha||null;
}
function normalizeNatureza(l){return l?.natureza==='acrescimo'||l?.tipo==='acrescimo'?'acrescimo':'abatimento';}
function financeSummary(finance){
  const valorBase=Number(finance.valor_total||0);
  const lancamentos=finance.lancamentos||[];
  const acrescimos=lancamentos.filter(l=>normalizeNatureza(l)==='acrescimo').reduce((s,l)=>s+Number(l.valor||0),0);
  const abatimentos=lancamentos.filter(l=>normalizeNatureza(l)==='abatimento').reduce((s,l)=>s+Number(l.valor||0),0);
  const totalDevido=valorBase+acrescimos;
  const saldo=Math.max(0,totalDevido-abatimentos);
  return {valor_total:valorBase,valor_base:valorBase,acrescimos,total_devido:totalDevido,pago:abatimentos,abatimentos,saldo,quitacao:totalDevido?Math.min(100,abatimentos/totalDevido*100):0,atualizado_em:finance.atualizado_em,lancamentos};
}
async function readBody(req){let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw,'utf8')>MAX_BYTES)throw new Error('payload_too_large')}return raw;}
function checkOrigin(req){const origin=req.headers.origin||'';return origin===ALLOWED_ORIGIN||origin===`${ALLOWED_ORIGIN}/`;}
function rateLimit(req){const source=crypto.createHash('sha256').update(String(req.headers['x-forwarded-for']||req.socket.remoteAddress||'unknown').split(',')[0].trim()).digest('hex').slice(0,16);const now=Date.now(),last=rate.get(source)||0;if(now-last<RATE_LIMIT_MS)return false;rate.set(source,now);return true;}

const server=http.createServer(async(req,res)=>{
  try{
    if(req.method==='OPTIONS')return send(res,204,{});
    if(req.url==='/health'&&req.method==='GET')return send(res,200,{ok:true,service:'calito-form-backend',finance:true,version:3});
    if(!checkOrigin(req))return send(res,403,{ok:false,error:'origin_not_allowed'});
    if(req.url==='/api/transicao-financeiro'&&req.method==='GET'){
      const {json}=await readFinance();return send(res,200,{ok:true,...financeSummary(json)});
    }
    if(req.url==='/api/transicao-financeiro'&&req.method==='POST'){
      if(!rateLimit(req))return send(res,429,{ok:false,error:'too_many_requests'});
      const raw=await readBody(req);let body={};try{body=JSON.parse(raw||'{}')}catch{throw new Error('invalid_json')}
      const valor=Number(body.valor),data=sanitizeText(body.data,10),descricao=sanitizeText(body.descricao,500),autor=body.autor==='Ariane e João'?'Ariane e João':'Rogger';
      const natureza=body.natureza==='acrescimo'?'acrescimo':'abatimento';
      if(!Number.isFinite(valor)||valor<=0||valor>500000||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(data)||!descricao)throw new Error('invalid_finance_entry');
      const clientId=sanitizeText(body.id||req.headers['x-idempotency-key']||'',120).replace(/[^a-zA-Z0-9:_-]/g,'');
      const {json,sha}=await readFinance();json.lancamentos=json.lancamentos||[];
      if(clientId&&json.lancamentos.some(x=>x.id===clientId))return send(res,200,{ok:true,...financeSummary(json),duplicate:true});
      json.lancamentos.push({id:clientId||crypto.randomUUID(),data,valor,descricao,natureza,tipo:natureza,autor,registrado_em:new Date().toISOString()});
      const commit=await saveFinance(json,sha,autor,natureza);return send(res,200,{ok:true,...financeSummary(json),commit:commit?.slice(0,12)||null});
    }
    return send(res,404,{ok:false,error:'not_found'});
  }catch(error){const client=new Set(['payload_too_large','invalid_json','invalid_finance_entry']);const code=error.message==='payload_too_large'?413:client.has(error.message)?400:500;return send(res,code,{ok:false,error:client.has(error.message)?error.message:'save_failed'});}
});
server.listen(PORT,()=>console.log(`Calito finance backend listening on ${PORT}`));
