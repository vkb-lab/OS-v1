import http from 'node:http';
import crypto from 'node:crypto';

const PORT = Number(process.env.PORT || 10000);
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO = process.env.GITHUB_REPO || 'vkb-lab/OS-v1';
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://vkb-lab.github.io';
const SUBMIT_KEY = process.env.CALITO_FORM_SUBMIT_KEY;

if (!GITHUB_TOKEN || !SUBMIT_KEY) {
  console.error('Missing GITHUB_TOKEN or CALITO_FORM_SUBMIT_KEY');
  process.exit(1);
}

const rate = new Map();
const json = (res, code, body, origin) => {
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': origin,
    'access-control-allow-headers': 'content-type,x-calito-submit-key',
    'access-control-allow-methods': 'POST,OPTIONS',
    'cache-control': 'no-store'
  });
  res.end(JSON.stringify(body));
};

function sanitizeText(value, max = 12000) {
  return String(value ?? '').replace(/\u0000/g, '').slice(0, max).trim();
}

function safePacket(body) {
  if (!body || typeof body !== 'object' || !body.respostas || typeof body.respostas !== 'object') throw new Error('invalid_payload');
  const respostas = {};
  for (const [k,v] of Object.entries(body.respostas)) {
    if (!/^[a-z0-9_]{1,80}$/i.test(k)) continue;
    respostas[k] = sanitizeText(v);
  }
  if (!respostas.nome_completo || !respostas.cpf_cnpj || !respostas.objeto_entendimento) throw new Error('required_fields');
  return {
    meta: {
      tipo: 'questionario_alinhamento_transicao',
      recebido_em: new Date().toISOString(),
      origem: 'Calito — Casa da Limpeza',
      versao: Number(body.meta?.versao || 1),
      protocolo_cliente: sanitizeText(body.meta?.protocolo || '', 120)
    },
    respostas
  };
}

async function commitToGitHub(packet) {
  const stamp = new Date().toISOString().replace(/[:.]/g,'-');
  const slug = sanitizeText(packet.respostas.nome_completo,80).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'joao';
  const rand = crypto.randomBytes(4).toString('hex');
  const path = `calito-data/transicao/respostas/${stamp}_${slug}_${rand}.json`;
  const [owner, repo] = REPO.split('/');
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'authorization': `Bearer ${GITHUB_TOKEN}`,
      'accept': 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'calito-form-backend'
    },
    body: JSON.stringify({
      message: `data(transicao): registrar alinhamento de ${packet.respostas.nome_completo}`,
      content: Buffer.from(JSON.stringify(packet,null,2),'utf8').toString('base64'),
      branch: BRANCH
    })
  });
  if (!response.ok) {
    const text = await response.text();
    console.error('GitHub write failed', response.status, text.slice(0,500));
    throw new Error('github_write_failed');
  }
  const out = await response.json();
  return { path, commit: out.commit?.sha || null };
}

const server = http.createServer(async (req,res) => {
  const origin = req.headers.origin || '';
  if (req.method === 'OPTIONS') return json(res,204,{},ALLOWED_ORIGIN);
  if (req.url === '/health' && req.method === 'GET') return json(res,200,{ok:true},ALLOWED_ORIGIN);
  if (req.url !== '/api/alinhamento' || req.method !== 'POST') return json(res,404,{ok:false},ALLOWED_ORIGIN);
  if (origin !== ALLOWED_ORIGIN) return json(res,403,{ok:false,error:'origin_not_allowed'},ALLOWED_ORIGIN);
  const submittedKey = req.headers['x-calito-submit-key'];
  if (!submittedKey || !crypto.timingSafeEqual(Buffer.from(String(submittedKey)), Buffer.from(SUBMIT_KEY))) return json(res,401,{ok:false,error:'unauthorized'},ALLOWED_ORIGIN);

  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const now = Date.now(), last = rate.get(ip) || 0;
  if (now-last < 15000) return json(res,429,{ok:false,error:'too_many_requests'},ALLOWED_ORIGIN);
  rate.set(ip,now);

  let raw='';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 250000) return json(res,413,{ok:false,error:'payload_too_large'},ALLOWED_ORIGIN);
  }
  try {
    const packet = safePacket(JSON.parse(raw || '{}'));
    const saved = await commitToGitHub(packet);
    return json(res,200,{ok:true,protocolo:saved.commit?.slice(0,12)||'registrado',path:saved.path},ALLOWED_ORIGIN);
  } catch (e) {
    return json(res,400,{ok:false,error:e.message || 'save_failed'},ALLOWED_ORIGIN);
  }
});

server.listen(PORT,()=>console.log(`Calito form backend listening on ${PORT}`));