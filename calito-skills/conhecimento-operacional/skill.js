(()=>{
  const DATA=window.CALITO_OPERATIONAL_MEMORY||{};
  const KB=DATA.conhecimento_operacional||{};
  const clean=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  function add(text){const chat=document.getElementById('chat');if(!chat)return;const row=document.createElement('div');row.className='message';row.innerHTML='<div class="avatar">C</div><div><div class="bubble"></div><div class="meta">Calito · conhecimento operacional</div></div>';row.querySelector('.bubble').innerHTML=text;chat.appendChild(row);row.scrollIntoView({behavior:'smooth',block:'end'});}
  function list(items){return '<ul>'+items.map(x=>'<li>'+x+'</li>').join('')+'</ul>'}
  function matches(s){return /manual do vendedor|como atender|atendimento ao cliente|produto \+ solucao|produto \+ solução|piscina verde|atendimento.*piscina|perguntas.*piscina|diagnosticar piscina|pos-venda|pós-venda|fechar uma venda|fechamento de venda|seguranca.*quimic|segurança.*químic|o que perguntar.*produto/.test(s)}
  function answer(raw){const s=clean(raw),m=KB.metodo_atendimento||{},v=KB.manual_vendedor||{},p=KB.piscinas||{};
    if(/piscina verde/.test(s)){const pv=p.piscina_verde||{};return '<b>Piscina verde — roteiro de diagnóstico</b><div class="notice">Não indique tratamento completo sem dados mínimos e nunca invente dosagem.</div><b>Pergunte primeiro:</b>'+list(pv.perguntas||[])+'<b>Lógica do atendimento:</b>'+list(pv.logica||[])+'<b>Segurança:</b>'+list(p.seguranca||[])}
    if(/atendimento.*piscina|perguntas.*piscina|diagnosticar piscina/.test(s))return '<b>Atendimento de piscina</b><div class="notice">O diagnóstico começa pelos dados da água e da instalação, não pelo produto.</div><b>Dados mínimos:</b>'+list(p.dados_minimos||[])+'<b>Roteiro:</b>'+list(p.roteiro_atendimento||[])+'<b>Segurança:</b>'+list(p.seguranca||[]);
    if(/manual do vendedor/.test(s))return '<b>Manual do Vendedor — Casa da Limpeza</b><br><b>Objetivo:</b> '+(v.objetivo||'')+'<br><b>Abordagem:</b>'+list(v.abordagem||[])+'<b>Diagnóstico:</b>'+list(v.diagnostico||[])+'<b>Fechamento:</b>'+list(v.fechamento||[])+'<b>Pós-venda:</b>'+list(v.pos_venda||[]);
    if(/pos-venda|pós-venda/.test(s))return '<b>Pós-venda</b>'+list(v.pos_venda||[]);
    if(/fechar uma venda|fechamento de venda/.test(s))return '<b>Fechamento consultivo</b>'+list(m.fechamento||v.fechamento||[]);
    if(/seguranca.*quimic|segurança.*químic/.test(s))return '<b>Segurança no atendimento com químicos</b>'+list(p.seguranca||[]);
    return '<b>Método Produto + Solução</b><div class="notice">Princípio: '+(m.principio||'Não vender antes de compreender a necessidade.')+'</div><b>Passos:</b>'+list(m.passos||[])+'<b>Perguntas padrão:</b>'+list(m.perguntas_padrao||[])+'<b>Fechamento:</b>'+list(m.fechamento||[]);
  }
  const form=document.getElementById('form');if(form){form.addEventListener('submit',e=>{const input=document.getElementById('question'),raw=input&&input.value.trim(),s=clean(raw);if(!raw||!matches(s))return;e.preventDefault();e.stopImmediatePropagation();const chat=document.getElementById('chat'),row=document.createElement('div');row.className='message user';row.innerHTML='<div class="avatar">V</div><div><div class="bubble"></div><div class="meta">Você · agora</div></div>';row.querySelector('.bubble').textContent=raw;chat.appendChild(row);input.value='';setTimeout(()=>add(answer(raw)),100)},true)}
  window.CALITO_SKILLS=window.CALITO_SKILLS||{};window.CALITO_SKILLS['conhecimento-operacional']={version:'1.0.0',status:'ativo'};
})();