const GC_BASE = 'https://api.gestaoclick.com';

async function fetchVendasMes(mes) {
  const parts = mes.split('-');
  const year = parts[0], month = parts[1];
  const ultimo = new Date(parseInt(year), parseInt(month), 0).getDate();
  const inicio = year + '-' + month + '-01';
  const fim    = year + '-' + month + '-' + ultimo;

  let page = 1, all = [], hasMore = true;

  while (hasMore) {
    const url = GC_BASE + '/vendas?data_inicio=' + inicio + '&data_fim=' + fim + '&limite=100&pagina=' + page;
    const res = await fetch(url, {
      headers: {
        'access-token':        process.env.GC_ACCESS_TOKEN,
        'secret-access-token': process.env.GC_SECRET_TOKEN,
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
  if (s === 'CONCRETIZADA') return 'servico';
  if (s.startsWith('CONCRETIZADA ') || s.startsWith('CONCRETIZADA(')) return 'aparelho';
  return null;
}

function groupByVendedor(vendas) {
  const result = {};
  for (let i = 0; i < vendas.length; i++) {
    const v = vendas[i];
    const nome = (v.nome_vendedor || v.vendedor || '').trim();
    const tipo = classifyVenda(v.nome_situacao || v.situacao || '');
    if (!tipo || !nome) continue;
    if (!result[nome]) result[nome] = { aparelhos: 0, servicos: 0 };
    if (tipo === 'aparelho') result[nome].aparelhos++;
    else result[nome].servicos++;
  }
  return result;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const mes = req.query.mes;
  if (!mes) return res.status(400).json({ error: 'mes e obrigatorio' });

  try {
    const parts = mes.split('-').map(Number);
    const year = parts[0], month = parts[1];
    const mesAnterior = month === 1
      ? (year - 1) + '-12'
      : year + '-' + String(month - 1).padStart(2, '0');

    const [vendasAtual, vendasAnterior] = await Promise.all([
      fetchVendasMes(mes),
      fetchVendasMes(mesAnterior),
    ]);

    return res.json({
      success:     true,
      mesAtual:    { mes,              vendas: groupByVendedor(vendasAtual) },
      mesAnterior: { mes: mesAnterior, vendas: groupByVendedor(vendasAnterior) },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
