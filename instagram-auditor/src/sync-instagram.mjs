import fs from 'node:fs/promises';
import path from 'node:path';

const required = ['META_ACCESS_TOKEN', 'META_IG_USER_ID', 'META_GRAPH_VERSION'];
for (const name of required) {
  if (!process.env[name]) {
    console.error(`Configuração ausente: ${name}`);
    process.exit(2);
  }
}

const token = process.env.META_ACCESS_TOKEN;
const igUserId = process.env.META_IG_USER_ID;
const version = process.env.META_GRAPH_VERSION;
const mediaMetrics = (process.env.META_MEDIA_INSIGHT_METRICS || '')
  .split(',').map(v => v.trim()).filter(Boolean);
const baseUrl = `https://graph.instagram.com/${version}`;
const outputRoot = path.resolve('calito-data/instagram');
const configPath = path.resolve('instagram-auditor/config/casa-da-limpeza.json');
const config = JSON.parse(await fs.readFile(configPath, 'utf8'));

function assertAllowedAsset() {
  const allowed = new Set((config.allowed_assets || []).map(String));
  if (!allowed.has(String(igUserId))) {
    throw new Error(`META_IG_USER_ID recusado: ${igUserId}. O ativo não pertence à configuração exclusiva da Casa da Limpeza.`);
  }
}

function safeMetaError(body, status) {
  const message = body?.error?.message || `${status || ''}`.trim() || 'Erro da Meta API';
  return message.replace(/[A-Za-z0-9_-]{24,}/g, '***');
}

async function graph(endpoint, params = {}) {
  const cleanEndpoint = String(endpoint).replace(/^\/+/, '');
  const url = new URL(`${baseUrl}/${cleanEndpoint}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }
  url.searchParams.set('access_token', token);
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.error) {
    throw new Error(`Meta API: ${safeMetaError(body, `${response.status} ${response.statusText}`)}`);
  }
  return body;
}

async function fetchNext(next) {
  const response = await fetch(next, { headers: { accept: 'application/json' } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.error) throw new Error(`Meta API paginação: ${safeMetaError(body, `${response.status} ${response.statusText}`)}`);
  return body;
}

async function paged(endpoint, params) {
  const items = [];
  let data = await graph(endpoint, params);
  while (true) {
    items.push(...(data.data || []));
    const next = data?.paging?.next;
    if (!next) break;
    data = await fetchNext(next);
  }
  return items;
}

function assertBlockedNames(username) {
  for (const blocked of config.blocked_names || []) {
    if (username.includes(String(blocked).toLowerCase().replace(/\s+/g, ''))) {
      throw new Error(`Ativo bloqueado detectado: ${blocked}`);
    }
  }
}

async function validateRemoteAccount() {
  const account = await graph('me', { fields: 'id,user_id,username,account_type,media_count' });
  const username = String(account.username || '').toLowerCase();
  const expected = String(config.instagram_username || '').toLowerCase();
  const returnedIds = [account.user_id, account.id].filter(Boolean).map(String);
  if (!returnedIds.includes(String(config.instagram_user_id)) || username !== expected) {
    throw new Error(`Conta recusada. Esperado @${expected} (${config.instagram_user_id}); recebido @${username || 'desconhecido'} (${returnedIds.join('/') || 'sem id'}).`);
  }
  assertBlockedNames(username);
  console.log(`Conta validada via Instagram Login: @${username} (${config.instagram_user_id}).`);
  return account;
}

async function getInsights(mediaId) {
  if (!mediaMetrics.length) return {};
  try {
    const result = await graph(`${mediaId}/insights`, { metric: mediaMetrics.join(',') });
    return Object.fromEntries((result.data || []).map(item => [item.name, item.values?.[0]?.value ?? item.value ?? null]));
  } catch (error) {
    console.warn(`Insights indisponíveis para ${mediaId}: ${error.message}`);
    return {};
  }
}

function monthKey(timestamp) {
  const d = new Date(timestamp);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function groupBy(items, keyFn) {
  const result = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!result.has(key)) result.set(key, []);
    result.get(key).push(item);
  }
  return result;
}

async function readExistingMonthly() {
  const byId = new Map();
  try {
    const years = await fs.readdir(outputRoot, { withFileTypes: true });
    for (const year of years.filter(d => d.isDirectory())) {
      const dir = path.join(outputRoot, year.name);
      const files = await fs.readdir(dir, { withFileTypes: true });
      for (const file of files.filter(d => d.isFile() && d.name.endsWith('.json'))) {
        const data = JSON.parse(await fs.readFile(path.join(dir, file.name), 'utf8'));
        for (const post of data.publicacoes || []) byId.set(String(post.id), post);
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  return byId;
}

assertAllowedAsset();
const account = await validateRemoteAccount();

const fields = [
  'id','caption','media_type','media_product_type','media_url','thumbnail_url',
  'permalink','timestamp','username','like_count','comments_count','children{id,media_type,media_url,thumbnail_url}'
].join(',');

let media;
try {
  media = await paged('me/media', { fields, limit: 100 });
} catch (error) {
  console.warn(`Campos completos indisponíveis, tentando coleta básica: ${error.message}`);
  media = await paged('me/media', {
    fields: 'id,caption,media_type,media_product_type,permalink,timestamp,username,like_count,comments_count',
    limit: 100
  });
}

const existing = await readExistingMonthly();
const normalizedById = new Map(existing);
for (const item of media) {
  normalizedById.set(String(item.id), {
    ...(existing.get(String(item.id)) || {}),
    id: item.id,
    timestamp: item.timestamp,
    periodo: monthKey(item.timestamp),
    media_type: item.media_type || null,
    media_product_type: item.media_product_type || null,
    caption: item.caption || '',
    permalink: item.permalink || null,
    media_url: item.media_url || null,
    thumbnail_url: item.thumbnail_url || null,
    like_count: item.like_count ?? null,
    comments_count: item.comments_count ?? null,
    children: item.children?.data || [],
    insights: await getInsights(item.id),
    coletado_em: new Date().toISOString()
  });
}

const normalized = [...normalizedById.values()]
  .filter(item => item.id && item.timestamp)
  .sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));

const grouped = groupBy(normalized, item => item.periodo);
await fs.mkdir(outputRoot, { recursive: true });
const index = [];
for (const [periodo, posts] of [...grouped.entries()].sort(([a],[b]) => a.localeCompare(b))) {
  const [year, month] = periodo.split('-');
  const dir = path.join(outputRoot, year);
  await fs.mkdir(dir, { recursive: true });
  posts.sort((a,b) => a.timestamp.localeCompare(b.timestamp));
  await fs.writeFile(path.join(dir, `${month}.json`), JSON.stringify({ periodo, total_publicacoes: posts.length, publicacoes: posts }, null, 2));
  const formats = groupBy(posts, p => p.media_product_type || p.media_type || 'OUTRO');
  index.push({
    periodo,
    total_publicacoes: posts.length,
    curtidas: posts.reduce((n,p) => n + Number(p.like_count || 0), 0),
    comentarios: posts.reduce((n,p) => n + Number(p.comments_count || 0), 0),
    formatos: Object.fromEntries([...formats.entries()].map(([k,v]) => [k, v.length]))
  });
}

await fs.writeFile(path.join(outputRoot, 'index.json'), JSON.stringify({
  fluxo: 'Instagram Login',
  endpoint_base: 'https://graph.instagram.com',
  conta_id: igUserId,
  instagram_login_id: account.id || null,
  username: config.instagram_username,
  portfolio: config.portfolio_name,
  business_id: config.meta_business_id,
  atualizado_em: new Date().toISOString(),
  total_publicacoes: normalized.length,
  meses: index
}, null, 2));

console.log(`Sincronização concluída: ${normalized.length} publicações em ${index.length} meses.`);