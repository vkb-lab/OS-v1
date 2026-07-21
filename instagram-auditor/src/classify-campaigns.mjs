import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const instagramRoot = path.join(repoRoot, 'calito-data/instagram');
const outputPath = path.join(instagramRoot, 'campaigns.json');

const taxonomy = [
  ['piscina', ['piscina','cloro','genco','algicida','limpa borda','barrilha','ph','decantador','flutuador']],
  ['limpeza pesada', ['limpeza pesada','desengordurante','removedor','clorado','limpa pedra','multiuso concentrado','limpeza profunda']],
  ['lavanderia', ['lavanderia','lava roupas','amaciante','sabão','sabao','tira manchas','roupas']],
  ['higiene institucional', ['institucional','papel toalha','sabonete','álcool gel','alcool gel','dispenser','higiene']],
  ['utilidades', ['utilidades','mop','vassoura','rodo','balde','pano','escova','organizador']],
  ['aromas', ['aroma','aromas','odorizador','desinfetante perfumado','essência','essencia','cheirinho']],
  ['automotivo', ['automotivo','carro','pneu','pretinho','lava auto','cera automotiva']],
  ['promoção', ['promoção','promocao','promo','desconto','oferta especial']],
  ['feirão', ['feirão','feirao','feiraço','feiraco']],
  ['inverno', ['inverno','frio','mofo','umidade']],
  ['verão', ['verão','verao','calor','temporada']],
  ['aniversário', ['aniversário','aniversario','anos','parabéns','parabens']],
  ['demonstração', ['demonstração','demonstracao','teste','na prática','na pratica','como usar']],
  ['conteúdo educativo', ['dica','dicas','aprenda','saiba como','passo a passo','você sabia','voce sabia']],
  ['oferta', ['oferta','leve','por apenas','preço','preco','imperdível','imperdivel']],
  ['institucional', ['casa da limpeza','equipe','colaborador','atendimento','loja','antonio carlos','antônio carlos']],
  ['evento local', ['evento','arraiá','arraia','festa','comunidade','local','antonio carlos','antônio carlos']]
];

const stop = new Set(['para','com','uma','das','dos','que','por','mais','seu','sua','casa','limpeza','voce','você','nosso','nossa','tem','hoje','aqui','todos','todo','toda']);
const normalize = (text) => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

async function readPosts() {
  const posts = [];
  const years = await fs.readdir(instagramRoot, { withFileTypes: true });
  for (const year of years.filter(d => d.isDirectory())) {
    const dir = path.join(instagramRoot, year.name);
    const files = await fs.readdir(dir, { withFileTypes: true });
    for (const file of files.filter(d => d.isFile() && /^\d{2}\.json$/.test(d.name))) {
      const data = JSON.parse(await fs.readFile(path.join(dir, file.name), 'utf8'));
      posts.push(...(data.publicacoes || []));
    }
  }
  return posts;
}

function classify(post) {
  const caption = post.caption || '';
  const text = normalize(caption);
  const categorias = [];
  const keywords = [];
  for (const [category, terms] of taxonomy) {
    const matched = terms.filter(term => text.includes(normalize(term)));
    if (matched.length) {
      categorias.push(category);
      keywords.push(...matched);
    }
  }
  const words = [...new Set(normalize(caption).replace(/https?:\/\/\S+/g, ' ').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 3 && !stop.has(w)))];
  const produtos = words.filter(w => /cloro|genco|mop|rodo|vassoura|amaciante|sabao|alcool|piscina|desinfetante|detergente|odorizador|pano|balde/.test(w)).slice(0, 12);
  const formato = post.media_product_type || post.media_type || 'OUTRO';
  const confidence = Math.min(1, 0.35 + categorias.length * 0.18 + keywords.length * 0.04);
  return {
    id: post.id,
    data: post.timestamp,
    periodo: post.periodo,
    legenda: caption,
    formato,
    permalink: post.permalink,
    campanha_detectada: categorias[0] || 'institucional',
    categorias_mencionadas: categorias.length ? categorias : ['institucional'],
    produtos_mencionados: [...new Set(produtos)],
    palavras_chave: [...new Set(keywords)].slice(0, 20),
    metricas: {
      curtidas: post.like_count ?? null,
      comentarios: post.comments_count ?? null,
      alcance: post.insights?.reach ?? null,
      visualizacoes: post.insights?.views ?? post.insights?.plays ?? null,
      salvos: post.insights?.saved ?? null,
      compartilhamentos: post.insights?.shares ?? null,
      interacoes: post.insights?.total_interactions ?? null
    },
    confianca_classificacao: Number(confidence.toFixed(2))
  };
}

const posts = await readPosts();
const publicacoes = posts.map(classify).sort((a, b) => String(a.data).localeCompare(String(b.data)));
const meses = new Map();
for (const post of publicacoes) {
  if (!meses.has(post.periodo)) meses.set(post.periodo, { periodo: post.periodo, total_publicacoes: 0, reels: 0, campanhas: {}, categorias: {}, produtos: {}, links: [] });
  const month = meses.get(post.periodo);
  month.total_publicacoes += 1;
  if (String(post.formato).toUpperCase() === 'REELS') month.reels += 1;
  month.campanhas[post.campanha_detectada] = (month.campanhas[post.campanha_detectada] || 0) + 1;
  for (const c of post.categorias_mencionadas) month.categorias[c] = (month.categorias[c] || 0) + 1;
  for (const p of post.produtos_mencionados) month.produtos[p] = (month.produtos[p] || 0) + 1;
  if (post.permalink) month.links.push(post.permalink);
}
await fs.writeFile(outputPath, JSON.stringify({
  gerado_em: new Date().toISOString(),
  fonte: 'publicações reais sincronizadas da API oficial do Instagram',
  total_publicacoes: publicacoes.length,
  categorias_minimas: taxonomy.map(([name]) => name),
  meses: [...meses.values()].sort((a, b) => a.periodo.localeCompare(b.periodo)),
  publicacoes
}, null, 2));
console.log(`Classificação concluída: ${publicacoes.length} publicações.`);