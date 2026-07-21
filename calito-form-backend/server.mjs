import http from 'node:http';
import crypto from 'node:crypto';

const PORT = Number(process.env.PORT || 10000);
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPOSITORY = process.env.GITHUB_REPOSITORY || process.env.GITHUB_REPO || 'vkb-lab/OS-v1';
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://vkb-lab.github.io';
const MAX_BYTES = Number(process.env.MAX_PAYLOAD_BYTES || 120000);
const RATE_LIMIT_MS = Number(process.env.RATE_LIMIT_MS || 8000);
const RESPONSE_DIR = 'calito-data/transicao/respostas';
const REQUIRED_FIELDS = ['nome_completo', 'cpf_cnpj', 'objeto_entendimento'];

if (!GITHUB_TOKEN) {
  console.error('Missing required GitHub token configuration.');
  process.exit(1);
}
if (REPOSITORY !== 'vkb-lab/OS-v1' || BRANCH !== 'main') {
  console.error('Repository or branch configuration is not allowed.');
  process.exit(1);
}

const rate = new Map();
const idempotencyCache = new Map();

function send(res, code, body, origin = ALLOWED_ORIGIN) {
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': origin,
    'access-control-allow-headers': 'content-type,x-idempotency-key',
    'access-control-allow-methods': 'POST,OPTIONS',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  });
  res.end(JSON.stringify(body));
}

function sanitizeText(value, max = 12000) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').slice(0, max).trim();
}
function newProtocol() {
  return `TR-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
}
function safeFileName(receivedAt, protocolo) {
  const stamp = receivedAt.replace(/[-:.]/g, '').replace('Z', '');
  const cleanProtocol = String(protocolo).replace(/[^A-Z0-9-]/gi, '').slice(0, 40);
  return `JOAO_${stamp}_${cleanProtocol}.json`;
}
function buildPacket(body, idempotencyKey) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('invalid_payload');
  if (!body.respostas || typeof body.respostas !== 'object' || Array.isArray(body.respostas)) throw new Error('invalid_payload');
  if (body.path || body.file || body.filename || body.repository || body.repo || body.branch) throw new Error('unsupported_client_control');
  const respostas = {};
  for (const [key, value] of Object.entries(body.respostas)) {
    if (!/^[a-z0-9_]{1,80}$/i.test(key)) continue;
    respostas[key] = sanitizeText(value);
  }
  for (const field of REQUIRED_FIELDS) if (!respostas[field]) throw new Error('required_fields');
  const recebidoEm = new Date().toISOString();
  return {
    meta: {
      tipo: 'questionario_alinhamento_transicao',
      versao: 1,
      recebido_em: recebidoEm,
      protocolo: newProtocol(),
      origem: 'Calito Casa da Limpeza',
      idempotency_key_hash: idempotencyKey ? crypto.createHash('sha256').update(idempotencyKey).digest('hex').slice(0, 16) : null
    },
    respostas
  };
}
async function github(path, init = {}) {
  const [owner, repo] = REPOSITORY.split('/');
  const url = `https://api.github.com/repos/${owner}/${repo}${path}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${GITHUB_TOKEN}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'calito-form-backend',
      ...(init.headers || {})
    }
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { message: text.slice(0, 160) }; }
  return { response, data };
}
async function createFile(packet) {
  const name = safeFileName(packet.meta.recebido_em, packet.meta.protocolo);
  if (name.includes('..') || name.includes('/') || name.includes('\\')) throw new Error('invalid_filename');
  const targetPath = `${RESPONSE_DIR}/${name}`;
  const content = Buffer.from(JSON.stringify(packet, null, 2), 'utf8').toString('base64');
  const encodedPath = encodeURIComponent(targetPath).replace(/%2F/g, '/');
  const { response, data } = await github(`/contents/${encodedPath}`, {
    method: 'PUT',
    body: JSON.stringify({
      message: 'data(transicao): registrar alinhamento do comprador [skip ci]',
      content,
      branch: BRANCH
    })
  });
  if (!response.ok) {
    console.error('GitHub write failed', response.status, data?.message || 'unknown');
    throw new Error('github_write_failed');
  }
  return { path: targetPath, commit: data?.commit?.sha || null };
}
async function readBody(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (Buffer.byteLength(raw, 'utf8') > MAX_BYTES) throw new Error('payload_too_large');
  }
  return raw;
}
function checkOrigin(req) {
  const origin = req.headers.origin || '';
  return origin === ALLOWED_ORIGIN || origin === `${ALLOWED_ORIGIN}/`;
}
function rateLimit(req) {
  const source = crypto.createHash('sha256').update(String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim()).digest('hex').slice(0, 16);
  const now = Date.now();
  const last = rate.get(source) || 0;
  if (now - last < RATE_LIMIT_MS) return false;
  rate.set(source, now);
  return true;
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') return send(res, 204, {});
    if (req.url === '/health' && req.method === 'GET') return send(res, 200, { ok: true, service: 'calito-form-backend' });
    if (req.url === '/api/alinhamento' && req.method !== 'POST') return send(res, 405, { ok: false, error: 'method_not_allowed' });
    if (req.url !== '/api/alinhamento') return send(res, 404, { ok: false, error: 'not_found' });
    if (!checkOrigin(req)) return send(res, 403, { ok: false, error: 'origin_not_allowed' });
    const idempotencyKey = sanitizeText(req.headers['x-idempotency-key'] || '', 160);
    if (idempotencyKey && idempotencyCache.has(idempotencyKey)) return send(res, 200, idempotencyCache.get(idempotencyKey));
    if (!rateLimit(req)) return send(res, 429, { ok: false, error: 'too_many_requests' });
    const raw = await readBody(req);
    let parsed;
    try { parsed = JSON.parse(raw || '{}'); } catch { throw new Error('invalid_json'); }
    const packet = buildPacket(parsed, idempotencyKey);
    const saved = await createFile(packet);
    const result = { ok: true, protocolo: packet.meta.protocolo, path: saved.path, commit: saved.commit ? saved.commit.slice(0, 12) : null };
    if (idempotencyKey) idempotencyCache.set(idempotencyKey, result);
    return send(res, 200, result);
  } catch (error) {
    const clientErrors = new Set(['payload_too_large', 'required_fields', 'invalid_payload', 'invalid_json', 'unsupported_client_control']);
    const code = error.message === 'payload_too_large' ? 413 : clientErrors.has(error.message) ? 400 : 500;
    const safe = clientErrors.has(error.message) || error.message === 'payload_too_large' ? error.message : 'save_failed';
    return send(res, code, { ok: false, error: safe });
  }
});

server.listen(PORT, () => console.log(`Calito form backend listening on ${PORT}`));