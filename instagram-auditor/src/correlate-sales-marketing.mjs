import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const campaignsPath = path.join(repoRoot, 'calito-data/instagram/campaigns.json');
const salesPath = path.join(repoRoot, 'CALITO_BASE_CONSOLIDADA_COMPLETA.json');
const outputPath = path.join(repoRoot, 'calito-data/instagram/correlations.json');

const campaigns = JSON.parse(await fs.readFile(campaignsPath, 'utf8'));
const sales = JSON.parse(await fs.readFile(salesPath, 'utf8'));
const salesByMonth = new Map((sales.resumo_mensal || []).map(row => [row.periodo, row]));
const productsByMonth = new Map();
for (const row of sales.produto_mes || []) {
  if (!productsByMonth.has(row.periodo)) productsByMonth.set(row.periodo, []);
  productsByMonth.get(row.periodo).push(row);
}
const marketingByMonth = new Map((campaigns.meses || []).map(row => [row.periodo, row]));

function pct(current, previous) {
  if (previous == null || Number(previous) === 0 || current == null) return null;
  return Number((((Number(current) - Number(previous)) / Number(previous)) * 100).toFixed(2));
}
function topObject(obj, limit = 8) {
  return Object.entries(obj || {}).sort((a,b) => b[1] - a[1]).slice(0, limit).map(([nome, total]) => ({ nome, total }));
}
function previousMonth(periodo) {
  const [y, m] = periodo.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
function previousYear(periodo) {
  const [y, m] = periodo.split('-').map(Number);
  return `${y - 1}-${String(m).padStart(2, '0')}`;
}
function aggregateMetrics(posts) {
  return posts.reduce((acc, post) => {
    acc.alcance += Number(post.metricas?.alcance || 0);
    acc.interacoes += Number(post.metricas?.interacoes || 0) || Number(post.metricas?.curtidas || 0) + Number(post.metricas?.comentarios || 0);
    acc.curtidas += Number(post.metricas?.curtidas || 0);
    acc.comentarios += Number(post.metricas?.comentarios || 0);
    return acc;
  }, { alcance: 0, interacoes: 0, curtidas: 0, comentarios: 0 });
}

const allMonths = [...new Set([...salesByMonth.keys(), ...marketingByMonth.keys()])].sort();
const byPeriodPosts = new Map();
for (const post of campaigns.publicacoes || []) {
  if (!byPeriodPosts.has(post.periodo)) byPeriodPosts.set(post.periodo, []);
  byPeriodPosts.get(post.periodo).push(post);
}

const meses = allMonths.map(periodo => {
  const marketing = marketingByMonth.get(periodo) || null;
  const posts = byPeriodPosts.get(periodo) || [];
  const venda = salesByMonth.get(periodo) || null;
  const prev = salesByMonth.get(previousMonth(periodo)) || null;
  const yoy = salesByMonth.get(previousYear(periodo)) || null;
  const topProdutosVenda = (productsByMonth.get(periodo) || []).sort((a,b) => Number(b.faturamento || 0) - Number(a.faturamento || 0)).slice(0, 15);
  const metrics = aggregateMetrics(posts);
  return {
    periodo,
    marketing: marketing ? {
      total_publicacoes: marketing.total_publicacoes,
      total_reels: marketing.reels,
      formatos: posts.reduce((acc, p) => { acc[p.formato] = (acc[p.formato] || 0) + 1; return acc; }, {}),
      campanhas: topObject(marketing.campanhas, 12),
      categorias_divulgadas: topObject(marketing.categorias, 12),
      produtos_mencionados: topObject(marketing.produtos, 12),
      alcance: metrics.alcance || null,
      interacoes: metrics.interacoes || null,
      links_analisados: posts.map(p => p.permalink).filter(Boolean)
    } : { total_publicacoes: 0, total_reels: 0, campanhas: [], categorias_divulgadas: [], produtos_mencionados: [], alcance: null, interacoes: null, links_analisados: [] },
    vendas: venda ? {
      quantidade: venda.quantidade_total,
      faturamento: venda.faturamento,
      custo: venda.custo,
      lucro_bruto: venda.lucro_bruto,
      margem: venda.margem_bruta_pct,
      produtos_top_faturamento: topProdutosVenda.map(p => ({ produto: p.produto, categoria: p.categoria, quantidade: p.quantidade, faturamento: p.faturamento }))
    } : null,
    comparacao_mes_anterior: venda && prev ? {
      periodo_base: prev.periodo,
      faturamento_pct: pct(venda.faturamento, prev.faturamento),
      quantidade_pct: pct(venda.quantidade_total, prev.quantidade_total),
      lucro_bruto_pct: pct(venda.lucro_bruto, prev.lucro_bruto),
      margem_pontos: Number((Number(venda.margem_bruta_pct || 0) - Number(prev.margem_bruta_pct || 0)).toFixed(2))
    } : null,
    comparacao_ano_anterior: venda && yoy ? {
      periodo_base: yoy.periodo,
      faturamento_pct: pct(venda.faturamento, yoy.faturamento),
      quantidade_pct: pct(venda.quantidade_total, yoy.quantidade_total),
      lucro_bruto_pct: pct(venda.lucro_bruto, yoy.lucro_bruto),
      margem_pontos: Number((Number(venda.margem_bruta_pct || 0) - Number(yoy.margem_bruta_pct || 0)).toFixed(2))
    } : null,
    leitura: marketing?.total_publicacoes
      ? 'Há associação temporal entre as publicações/campanhas do mês e os dados de venda do mesmo período. Os dados não comprovam causalidade; é uma hipótese a investigar.'
      : 'Os dados de vendas estão disponíveis, mas a auditoria do Instagram não possui publicações sincronizadas para esse período.'
  };
});

await fs.writeFile(outputPath, JSON.stringify({
  gerado_em: new Date().toISOString(),
  metodologia: 'Cruzamento mensal entre publicações reais do Instagram e resumo mensal de vendas. Nunca afirma causalidade.',
  linguagem_permitida: ['associação temporal','coincidência','possível influência','hipótese a investigar','os dados não comprovam causalidade'],
  meses
}, null, 2));
console.log(`Correlação concluída: ${meses.length} meses.`);