module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const mes = req.query.mes || '2026-06';
  const parts = mes.split('-');
  const year = parts[0], month = parts[1];
  const ultimo = new Date(parseInt(year), parseInt(month), 0).getDate();
  const inicio = year + '-' + month + '-01';
  const fim = year + '-' + month + '-' + ultimo;

  const url = 'https://api.gestaoclick.com/vendas?data_inicio=' + inicio + '&data_fim=' + fim + '&limite=5';

  const r = await fetch(url, {
    headers: {
      'access-token': process.env.GC_ACCESS_TOKEN,
      'secret-access-token': process.env.GC_SECRET_TOKEN,
      'Content-Type': 'application/json'
    }
  });

  const json = await r.json();
  return res.json(json);
};
