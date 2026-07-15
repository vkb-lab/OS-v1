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
const baseUrl = `https://graph.facebook.com/${version}`;
const outputRoot = path.resolve('calito-data/instagram');

async function graph(endpoint, params = {}) {
  const url = new URL(`${baseUrl}/${endpoint}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }
  url.searchParams.set('access_token', token);
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.error) {
    const message = body?.error?.message || `${response.status} ${response.statusText}`;
    throw new Error(`Meta API: ${message}`);
  }
  return body;
}

async function paged(endpoint, params) {
  const items = [];
  let data = await graph(endpoint, params);
  while (true) {
    items.push(...(data.data || []));
    const next = data?.paging?.next;
    if (!next) break;
    const response = await fetch(next, { headers: { accept: 'application/json' } });
    data = await response.json();
    if (!response.ok || data.error) throw new Error(data?.error?.message || 'Falha na paginação da Meta API.');
  }
  return items;
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

const fields = [
  'id','caption','media_type','media_product_type','media_url','thumbnail_url',
  'permalink','timestamp','username','like_count','comments_count','children{id,media_type,media_url,thumbnail_url}'
].join(',');

const media = await paged(`${igUserId}/media`, { fields, limit: 100 });
const normalized = [];
for (const item of media) {
  normalized.push({
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
  conta_id: igUserId,
  atualizado_em: new Date().toISOString(),
  total_publicacoes: normalized.length,
  meses: index
}, null, 2));

console.log(`Sincronização concluída: ${normalized.length} publicações em ${index.length} meses.`);
