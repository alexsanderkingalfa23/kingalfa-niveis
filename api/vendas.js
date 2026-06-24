// ═══════════════════════════════════════════════════════════
//  King Alfa — Proxy GestãoClick API
//  Vercel Serverless Function
// ═══════════════════════════════════════════════════════════

const GC_BASE = 'https://api.gestaoclick.com';

async function fetchVendasMes(mes, lojaId) {
  const [year, month] = mes.split('-');
  const ultimo = new Date(parseInt(year), parseInt(month), 0).getDate();
  const inicio = `${year}-${month}-01`;
  const fim    = `${year}-${month}-${ultimo}`;

  let page = 1, all = [], total = null;

  while (true) {
    const url = `${GC_BASE}/vendas?data_inicio=${inicio}&data_fim=${fim}&loja_id=${lojaId}&limite=100&pagina=${page}`;
    const res = await fetch(url, {
      headers: {
        'access-token': process.env.GC_ACCESS_TOKEN,
        'secret-access-token': process.env.GC_SECRET_TOKEN,
        'Content-Type': 'application/json',
      }
    });
    const json = await res.json();
    const items = json.data || json.result || json.vendas || [];
    all = all.concat(items);
    if (total === null) total = json.total || json.count || items.length;
    if (all.length >= total || items.length === 0) break;
    page++;
  }

  return all;
}

function classifyVenda(situacao) {
  if (!situacao) return null;
  const s = situacao.trim().toUpperCase();
  if (s === 'CONCRETIZADA') return 'servico';
  if (s.startsWith('CONCRETIZADA ')) return 'aparelho';
  return null;
}

function groupByVendedor(vendas) {
  const result = {};
  for (const v of vendas) {
    const nome = (v.nome_vendedor || v.vendedor || '').trim();
    const tipo = classifyVenda(v.nome_situacao || v.situacao || '');
    if (!tipo || !nome) continue;
    if (!result[nome]) result[nome] = { aparelhos: 0, servicos: 0 };
    result[nome][tipo === 'aparelho' ? 'aparelhos' : 'servicos']++;
  }
  return result;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { mes, loja_id } = req.query;
  if (!mes || !loja_id) {
    return res.status(400).json({ error: 'mes e loja_id são obrigatórios' });
  }

  try {
    // Busca mês atual e mês anterior
    const [year, month] = mes.split('-').map(Number);
    const mesAnterior = month === 1
      ? `${year - 1}-12`
      : `${year}-${String(month - 1).padStart(2, '0')}`;

    const [vendasAtual, vendasAnterior] = await Promise.all([
      fetchVendasMes(mes, loja_id),
      fetchVendasMes(mesAnterior, loja_id),
    ]);

    return res.json({
      success: true,
      mesAtual: { mes, vendas: groupByVendedor(vendasAtual) },
      mesAnterior: { mes: mesAnterior, vendas: groupByVendedor(vendasAnterior) },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
