(()=>{
  const DATA=window.CALITO_OPERATIONAL_MEMORY||{};
  const months={janeiro:1,fevereiro:2,marco:3,abril:4,maio:5,junho:6,julho:7,agosto:8,setembro:9,outubro:10,novembro:11,dezembro:12};
  const clean=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const money=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const num=v=>Number(v||0).toLocaleString('pt-BR',{maximumFractionDigits:2});
  const pct=v=>num(v)+'%';

  function add(text){
    const chat=document.getElementById('chat'); if(!chat) return;
    const row=document.createElement('div'); row.className='message';
    row.innerHTML='<div class="avatar">C</div><div><div class="bubble"></div><div class="meta">Calito · skill Inteligência da Loja</div></div>';
    row.querySelector('.bubble').innerHTML=text; chat.appendChild(row); row.scrollIntoView({behavior:'smooth',block:'end'});
  }
  function table(rows,cols){return '<div class="table-wrap"><table><thead><tr>'+cols.map(c=>'<th>'+c[0]+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+cols.map(c=>'<td>'+c[1](r)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>'}
  function monthFrom(s){s=clean(s);for(const [n,m] of Object.entries(months))if(s.includes(n))return m;return null}
  function rowsForMonth(m){return (DATA.produto_mes||[]).filter(r=>Number(r.mes)===m)}
  function aggregateRows(rows){const map=new Map();for(const r of rows){const k=r.codigo||r.produto;const x=map.get(k)||{codigo:k,produto:r.produto,categoria:r.categoria,quantidade:0,faturamento:0,custo:0,lucro:0,meses:new Set(),anos:new Set()};x.quantidade+=Number(r.quantidade||0);x.faturamento+=Number(r.faturamento||0);x.custo+=Number(r.custo||0);x.lucro+=Number(r.lucro_bruto||0);x.meses.add(r.periodo);x.anos.add(r.ano);map.set(k,x)}return [...map.values()].map(x=>({...x,margem:x.faturamento?x.lucro/x.faturamento*100:0,recorrencia:x.anos.size}))}
  function score(p){
    const rev=Math.log10(Math.max(1,p.faturamento));
    const qty=Math.log10(Math.max(1,p.quantidade));
    const margin=Math.max(0,Math.min(100,p.margem))/100;
    const recurrence=Math.min(1,p.recorrencia/3);
    return rev*0.38+qty*0.24+margin*1.2+recurrence*0.8;
  }
  function priorityLabel(p, maxScore){const s=score(p)/(maxScore||1);if(s>=.78)return '🟢 Reforçar';if(s>=.58)return '🟡 Manter forte';if(s>=.38)return '🟠 Comprar com cautela';return '🔴 Baixa prioridade histórica'}
  function historicalMonth(m){
    const agg=aggregateRows(rowsForMonth(m)); if(!agg.length)return null;
    const ranked=agg.sort((a,b)=>score(b)-score(a)); const max=score(ranked[0]);
    return ranked.map(p=>({...p,prioridade:priorityLabel(p,max)}));
  }
  function categoriesForMonths(list){
    const rows=(DATA.produto_mes||[]).filter(r=>list.includes(Number(r.mes))); const map=new Map();
    for(const r of rows){const k=r.categoria||'Outros';const x=map.get(k)||{categoria:k,faturamento:0,lucro:0,quantidade:0};x.faturamento+=Number(r.faturamento||0);x.lucro+=Number(r.lucro_bruto||0);x.quantidade+=Number(r.quantidade||0);map.set(k,x)}
    return [...map.values()].map(x=>({...x,margem:x.faturamento?x.lucro/x.faturamento*100:0})).sort((a,b)=>b.faturamento-a.faturamento)
  }
  function buyingAnswer(m){
    const rows=historicalMonth(m); if(!rows)return 'Não encontrei histórico suficiente para esse mês.';
    const top=rows.slice(0,15);
    return '<b>Prioridade histórica para o mês '+String(m).padStart(2,'0')+'</b><div class="notice">Esta é uma recomendação de prioridade baseada em vendas, giro, margem bruta e recorrência histórica. Não define quantidade de compra sem estoque atual, mercadoria em trânsito, prazo e pedido mínimo.</div>'+table(top,[['Produto',r=>r.produto],['Categoria',r=>r.categoria],['Qtd. hist.',r=>num(r.quantidade)],['Faturamento',r=>money(r.faturamento)],['Margem bruta',r=>pct(r.margem)],['Prioridade',r=>r.prioridade]]);
  }
  function anchorsAnswer(m){const rows=historicalMonth(m);if(!rows)return 'Não encontrei histórico suficiente.';return '<b>Produtos que mais sustentaram historicamente esse mês</b>'+table(rows.sort((a,b)=>b.faturamento-a.faturamento).slice(0,20),[['Produto',r=>r.produto],['Categoria',r=>r.categoria],['Faturamento',r=>money(r.faturamento)],['Quantidade',r=>num(r.quantidade)],['Lucro bruto',r=>money(r.lucro)],['Recorrência',r=>r.recorrencia+' ano(s)']]);}
  function highMarginAnswer(m){const rows=historicalMonth(m);if(!rows)return 'Não encontrei histórico suficiente.';const filtered=rows.filter(r=>r.quantidade>=10&&r.faturamento>=500).sort((a,b)=>(b.margem*0.55+Math.log10(Math.max(1,b.faturamento))*10)-(a.margem*0.55+Math.log10(Math.max(1,a.faturamento))*10)).slice(0,20);return '<b>Boa venda + margem bruta relevante</b><div class="notice">Filtro evita destacar margens altas em produtos com volume irrelevante.</div>'+table(filtered,[['Produto',r=>r.produto],['Qtd.',r=>num(r.quantidade)],['Faturamento',r=>money(r.faturamento)],['Lucro bruto',r=>money(r.lucro)],['Margem',r=>pct(r.margem)]]);}
  function cautionAnswer(m){const rows=historicalMonth(m);if(!rows)return 'Não encontrei histórico suficiente.';const low=rows.filter(r=>r.recorrencia<=1||r.quantidade<5).sort((a,b)=>a.faturamento-b.faturamento).slice(0,20);return '<b>Itens para cautela</b><div class="notice">Não posso afirmar que estão encalhados sem o estoque atual. A tabela mostra apenas baixo giro/baixa recorrência histórica no mês analisado.</div>'+table(low,[['Produto',r=>r.produto],['Categoria',r=>r.categoria],['Qtd. hist.',r=>num(r.quantidade)],['Faturamento',r=>money(r.faturamento)],['Recorrência',r=>r.recorrencia+' ano(s)']]);}
  function categoriesAnswer(a,b){const list=[];for(let m=a;m<=b;m++)list.push(m);const rows=categoriesForMonths(list).slice(0,12);return '<b>Categorias mais relevantes entre os meses '+a+' e '+b+'</b>'+table(rows,[['Categoria',r=>r.categoria],['Quantidade',r=>num(r.quantidade)],['Faturamento',r=>money(r.faturamento)],['Lucro bruto',r=>money(r.lucro)],['Margem',r=>pct(r.margem)]]);}
  function marketingPerformance(){const rows=((DATA.instagram_correlations&&DATA.instagram_correlations.meses)||[]).filter(x=>x.vendas&&x.marketing);if(!rows.length)return '<div class="notice">A memória de marketing ainda não possui correlações suficientes.</div>';const best=[...rows].sort((a,b)=>Number(b.vendas.faturamento||0)-Number(a.vendas.faturamento||0)).slice(0,8);return '<b>Campanhas e períodos de maior desempenho comercial</b><div class="notice">É associação temporal; não comprova que a campanha causou a venda.</div>'+table(best,[['Período',r=>r.periodo],['Posts',r=>num(r.marketing.total_publicacoes)],['Reels',r=>num(r.marketing.total_reels)],['Faturamento',r=>money(r.vendas.faturamento)],['Margem',r=>pct(r.vendas.margem)]]);}
  function matches(s){return /o que devo comprar|o que comprar|reforcar|reforçar|estoque maior|prioridade de compra|sustentaram|sustenta.*mes|boa venda.*margem|margem alta.*venda|encalh|cautela|baixa prioridade|inteligencia da loja|inteligência da loja|calendario comercial|calendário comercial|categorias.*cres|campanhas.*melhor resultado/.test(s)}
  function answer(s){const n=clean(s),m=monthFrom(n);if(/campanhas.*melhor resultado/.test(n))return marketingPerformance();if(/categorias.*cres|setembro.*novembro/.test(n))return categoriesAnswer(9,11);if(/encalh|cautela|baixa prioridade/.test(n))return cautionAnswer(m||new Date().getMonth()+1);if(/boa venda.*margem|margem alta.*venda/.test(n))return highMarginAnswer(m||new Date().getMonth()+1);if(/sustentaram|sustenta.*mes/.test(n))return anchorsAnswer(m||new Date().getMonth()+1);if(/o que devo comprar|o que comprar|reforcar|reforçar|estoque maior|prioridade de compra/.test(n))return buyingAnswer(m||new Date().getMonth()+1);if(/calendario comercial|calendário comercial|inteligencia da loja|inteligência da loja/.test(n)){const mm=m||new Date().getMonth()+1;return buyingAnswer(mm)}return null}

  const form=document.getElementById('form');
  if(form){form.addEventListener('submit',e=>{const input=document.getElementById('question');const raw=input&&input.value.trim();const s=clean(raw);if(!raw||!matches(s))return;e.preventDefault();e.stopImmediatePropagation();const chat=document.getElementById('chat');const row=document.createElement('div');row.className='message user';row.innerHTML='<div class="avatar">V</div><div><div class="bubble"></div><div class="meta">Você · agora</div></div>';row.querySelector('.bubble').textContent=raw;chat.appendChild(row);input.value='';setTimeout(()=>add(answer(raw)),100)},true)}
  window.CALITO_SKILLS=window.CALITO_SKILLS||{};window.CALITO_SKILLS['inteligencia-da-loja']={version:'1.0.0',status:'ativo'};
})();