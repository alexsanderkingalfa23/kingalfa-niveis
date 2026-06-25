const GC_BASE = 'https://api.gestaoclick.com';

const LOJAS = [
  { id: '271212', nome: 'Matriz' },
  { id: '319869', nome: 'Pq. Anhanguera' },
  { id: '556719', nome: 'Igualdade' }
];

async function fetchVendasMes(mes, lojaId, env) {
  const parts = mes.split('-');
  const year = parts[0], month = parts[1];
  const ultimo = new Date(parseInt(year), parseInt(month), 0).getDate();
  const inicio = year + '-' + month + '-01';
  const fim    = year + '-' + month + '-' + ultimo;

  let page = 1, all = [], hasMore = true;

  while (hasMore) {
    const url = GC_BASE + '/vendas?data_inicio=' + inicio + '&data_fim=' + fim +
                '&loja_id=' + lojaId + '&limite=100&pagina=' + page;
    const res = await fetch(url, {
      headers: {
        'access-token':        env.GC_ACCESS_TOKEN,
        'secret-access-token': env.GC_SECRET_TOKEN,
        'Content-Type':        'application/json',
      }
    });
    const json = await res.json();
    const items = json.data || json.result || json.vendas || [];
    all = all.concat(items);
    const meta = json.meta || {};
    const total = parseInt(meta.total_registros || json.total || 0);
    hasMore = items.length === 100 && all.length < total;
    page++;
  }
  return all;
}

function classifyVenda(situacao) {
  if (!situacao) return null;
  const s = situacao.trim().toUpperCase();
  if (!s.startsWith('CONCRETIZADA')) return null;
  if (s === 'CONCRETIZADA') return 'servico';
  return 'aparelho';
}

function groupByVendedor(vendas) {
  const result = {};
  for (let i = 0; i < vendas.length; i++) {
    const v = vendas[i];
    const nome = (v.nome_vendedor || v.vendedor || '').trim();
    const tipo = classifyVenda(v.nome_situacao || v.situacao || '');
    if (!tipo || !nome) continue;
    if (!result[nome]) result[nome] = { aparelhos: 0, servicos: 0, valor: 0 };
    if (tipo === 'aparelho') result[nome].aparelhos++;
    else result[nome].servicos++;
    result[nome].valor += parseFloat(v.valor_total || 0);
  }
  return result;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const mes = url.searchParams.get('mes');

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  if (!mes) {
    return new Response(JSON.stringify({ error: 'mes e obrigatorio' }), { status: 400, headers });
  }

  try {
    const parts = mes.split('-').map(Number);
    const year = parts[0], month = parts[1];
    const mesAnterior = month === 1
      ? (year - 1) + '-12'
      : year + '-' + String(month - 1).padStart(2, '0');

    const [v1, v2, v3, a1, a2, a3] = await Promise.all([
      fetchVendasMes(mes,         LOJAS[0].id, env),
      fetchVendasMes(mes,         LOJAS[1].id, env),
      fetchVendasMes(mes,         LOJAS[2].id, env),
      fetchVendasMes(mesAnterior, LOJAS[0].id, env),
      fetchVendasMes(mesAnterior, LOJAS[1].id, env),
      fetchVendasMes(mesAnterior, LOJAS[2].id, env),
    ]);

    const vendasAtual    = v1.concat(v2).concat(v3);
    const vendasAnterior = a1.concat(a2).concat(a3);

    const body = JSON.stringify({
      success:     true,
      mesAtual:    { mes,              vendas: groupByVendedor(vendasAtual) },
      mesAnterior: { mes: mesAnterior, vendas: groupByVendedor(vendasAnterior) },
    });

    return new Response(body, { headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    }
  });
}
