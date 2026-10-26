import http from 'node:http';
import crypto from 'node:crypto';

const json = (res, code, data, headers = {}) => {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options':'nosniff', ...headers });
  res.end(JSON.stringify(data));
};
const safeCompare = (a, b) => {
  const ah = crypto.createHash('sha256').update(String(a)).digest();
  const bh = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ah, bh) && String(a).length === String(b).length;
};
const asInt = (v, fallback, low, high) => {
  const n = Number(v ?? fallback);
  if (!Number.isInteger(n) || n < low || n > high) throw Error('Invalid K-Compute limit');
  return n;
};
export function loadConfig(env = process.env) {
  if ((env.K_COMPUTE_MODE || 'sandbox') !== 'sandbox') throw Error('Only sandbox mode is available in V1');
  if (env.K_COMPUTE_EXTERNAL_AI_ENABLED !== undefined && env.K_COMPUTE_EXTERNAL_AI_ENABLED !== 'false') {
    throw Error('External AI is disabled in V1');
  }
  if (env.K_COMPUTE_MONTHLY_PAID_BUDGET_USD !== undefined && Number(env.K_COMPUTE_MONTHLY_PAID_BUDGET_USD) !== 0) {
    throw Error('Paid budget must be zero in V1');
  }
  let tokens = {};
  if (env.K_COMPUTE_KEYS_JSON) {
    const obj = JSON.parse(env.K_COMPUTE_KEYS_JSON);
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw Error('Invalid key configuration');
    for (const [tenant, token] of Object.entries(obj)) {
      if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{1,63}$/.test(tenant) || typeof token !== 'string' || token.length < 32) throw Error('Invalid tenant credential');
      tokens[tenant] = token;
    }
    if (new Set(Object.values(tokens)).size !== Object.keys(tokens).length) throw Error('Duplicate credentials are forbidden');
  }
  return {
    mode: 'sandbox',
    tokens,
    maxJobsDay: asInt(env.K_COMPUTE_MAX_JOBS_DAY, 25, 1, 10000),
    maxRequestsMinute: asInt(env.K_COMPUTE_MAX_REQUESTS_MINUTE, 30, 1, 10000),
    maxQueue: asInt(env.K_COMPUTE_MAX_QUEUE, 50, 1, 1000),
    maxStoredJobs: asInt(env.K_COMPUTE_MAX_STORED_JOBS, 500, 1, 5000),
    maxTextChars: asInt(env.K_COMPUTE_MAX_TEXT_CHARS, 2000, 1, 4000)
  };
}
const readBody = (req) => new Promise((resolve, reject) => {
  let total = 0; const chunks = [];
  req.on('data', c => {
    total += c.length;
    if (total > 8192) { reject({ status: 413, error:'payload_too_large' }); req.destroy(); return; }
    chunks.push(c);
  });
  req.on('end', () => {
    try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
    catch { reject({ status:400, error:'invalid_json' }); }
  });
  req.on('error', () => reject({ status:400, error:'body_read_failed' }));
});
const dailyKey = (tenant) => `${tenant}:${new Date().toISOString().slice(0,10)}`;
const publicJob = j => ({ id:j.id, type:j.type, state:j.state, created_at:j.created_at, completed_at:j.completed_at, result:j.result ?? null, error:j.error ?? null, cost_usd:0, external_ai_calls:0 });

export function createApp(cfg = loadConfig()) {
  const jobs = new Map();
  const idem = new Map();
  const rate = new Map();
  const daily = new Map();
  const usage = new Map();
  const queue = [];
  let running = false;

  function getUsage(tenant) {
    if (!usage.has(tenant)) usage.set(tenant, { submitted:0, completed:0, token_estimate:0, external_ai_calls:0, spent_usd:0 });
    return usage.get(tenant);
  }
  const drain = () => {
    if (running) return;
    running = true;
    setImmediate(() => {
      try {
        while (queue.length) {
          const job = queue.shift();
          job.state = 'running';
          if (job.type === 'echo.test') job.result = { text:job.input.text };
          else if (job.type === 'estimate.tokens') {
            const estimated = Math.ceil(job.input.text.length / 4);
            job.result = { estimated_tokens:estimated, disclaimer:'approximation; no provider called' };
            getUsage(job.tenant).token_estimate += estimated;
          } else { job.state = 'failed'; job.error = 'unsupported_task'; }
          if (job.state !== 'failed') { job.state = 'succeeded'; getUsage(job.tenant).completed++; }
          job.completed_at = new Date().toISOString();
        }
      } finally { running = false; }
    });
  };
  function auth(req, res) {
    if (!Object.keys(cfg.tokens).length) { json(res,503,{ error:'credentials_not_configured' }); return null; }
    const tenant = req.headers['x-kaizen-tenant'];
    const hdr = req.headers.authorization;
    if (typeof tenant !== 'string' || typeof hdr !== 'string' || !hdr.startsWith('Bearer ')
        || !cfg.tokens[tenant] || !safeCompare(hdr.slice(7),cfg.tokens[tenant])) {
      json(res,401,{error:'unauthorized'}); return null;
    }
    const now = Date.now();
    const windows = (rate.get(tenant) || []).filter(t => now - t < 60000);
    if (windows.length >= cfg.maxRequestsMinute) {
      rate.set(tenant,windows); json(res,429,{error:'rate_limited'}); return null;
    }
    windows.push(now); rate.set(tenant, windows);
    return tenant;
  }
  const handler = async (req,res) => {
    const pathname = new URL(req.url || '/', 'http://localhost').pathname;
    if (req.method === 'GET' && pathname === '/health') return json(res,200,{service:'k-compute',version:'1.0.0-sandbox.1',status:'ok',mode:'sandbox',persistence:'ephemeral'});
    if (req.method === 'GET' && pathname === '/ready') return json(res,Object.keys(cfg.tokens).length?200:503,{ready:!!Object.keys(cfg.tokens).length});
    if (req.method === 'GET' && pathname === '/') return json(res,200,{service:'k-compute',mode:'sandbox',docs:'see repository README',external_ai:false});
    if (!pathname.startsWith('/v1/')) return json(res,404,{error:'not_found'});
    const tenant = auth(req,res);
    if (!tenant) return;
    if (req.method === 'GET' && pathname === '/v1/capabilities') {
      return json(res,200,{mode:'sandbox',task_types:['echo.test','estimate.tokens'],external_ai:false,persistence:'ephemeral',paid_budget_usd:0});
    }
    if (req.method === 'GET' && pathname === '/v1/usage') {
      return json(res,200,{tenant,day:dailyKey(tenant).split(':')[1],daily_jobs:daily.get(dailyKey(tenant)) || 0,limit_daily_jobs:cfg.maxJobsDay,...getUsage(tenant)});
    }
    if (req.method === 'GET' && pathname.startsWith('/v1/jobs/')) {
      const id = pathname.slice('/v1/jobs/'.length);
      const j = jobs.get(id);
      return j && j.tenant === tenant ? json(res,200,publicJob(j)) : json(res,404,{error:'not_found'});
    }
    if (req.method === 'POST' && pathname === '/v1/jobs') {
      if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) return json(res,415,{error:'json_required'});
      const key = req.headers['idempotency-key'];
      if (typeof key !== 'string' || !/^[a-zA-Z0-9_-]{8,128}$/.test(key)) return json(res,400,{error:'idempotency_key_required'});
      let body;
      try { body = await readBody(req); }
      catch (e) { if (!res.writableEnded && !res.destroyed) return json(res,e.status||400,{error:e.error||'invalid_body'}); return; }
      if (!body || typeof body !== 'object' || Array.isArray(body) || !['echo.test','estimate.tokens'].includes(body.type)
          || !body.input || typeof body.input !== 'object' || Array.isArray(body.input) || typeof body.input.text !== 'string'
          || body.input.text.length > cfg.maxTextChars || body.input.text.length === 0) return json(res,422,{error:'invalid_job'});
      const signature = crypto.createHash('sha256').update(JSON.stringify({type:body.type,input:body.input})).digest('hex');
      const composite = `${tenant}:${key}`;
      const existing = idem.get(composite);
      if (existing) {
        if (existing.signature !== signature) return json(res,409,{error:'idempotency_conflict'});
        return json(res,200,publicJob(jobs.get(existing.id)));
      }
      const count = daily.get(dailyKey(tenant)) || 0;
      if (count >= cfg.maxJobsDay) return json(res,429,{error:'daily_quota_exceeded'});
      if (queue.length >= cfg.maxQueue || jobs.size >= cfg.maxStoredJobs) return json(res,503,{error:'sandbox_capacity_exceeded'});
      const job = {id:crypto.randomUUID(),tenant,type:body.type,input:{text:body.input.text},state:'queued',created_at:new Date().toISOString()};
      jobs.set(job.id,job);
      idem.set(composite,{id:job.id,signature});
      daily.set(dailyKey(tenant),count + 1);
      getUsage(tenant).submitted++;
      queue.push(job);
      drain();
      return json(res,202,publicJob(job),{'location':`/v1/jobs/${job.id}`});
    }
    return json(res,404,{error:'not_found'});
  };
  return http.createServer((req,res) => {handler(req,res).catch(() => { if (!res.headersSent && !res.destroyed) json(res,500,{error:'internal_error'}); });});
}
