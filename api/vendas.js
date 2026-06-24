module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const r = await fetch('https://api.gestaoclick.com/lojas', {
    headers: {
      'access-token': process.env.GC_ACCESS_TOKEN,
      'secret-access-token': process.env.GC_SECRET_TOKEN,
      'Content-Type': 'application/json'
    }
  });
  const json = await r.json();
  return res.json(json);
};
