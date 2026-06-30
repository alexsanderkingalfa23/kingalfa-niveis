const GC_BASE = 'https://api.gestaoclick.com';
const LOJAS = [
  { id: '271212' },
  { id: '319869' },
  { id: '556719' }
];

async function fetchVendasMes(mes, lojaId, env) {
  const [year, month] = mes.split('-');
  const ultimo = new Date(parseInt(year), parseInt(month), 0).getDate();
  const inicio = year + '-' + month + '-01';
  const fim    = year + '-' + month + '-' + ultimo;

  async function puxarTipo(tipo) {
    let page = 1, all = [], hasMore = true, guard = 0;
    while (hasMore && guard++ < 100) {
      const url = GC_BASE + '/vendas?tipo=' + tipo + '&data_inicio=' + inicio + '&data_fim=' + fim + '&loja_id=' + lojaId + '&limite=100&pagina=' + page;
      const res = await fetch(url, { headers: {
        'access-token': env.GC_ACCESS_TOKEN,
        'secret-access-token': env.GC_SECRET_TOKEN,
        'Content-Type': 'application/json'
      }});
      const json = await res.json();
      const items = json.data || [];
      items.forEach(function(v){ v.__tipoGC = tipo; });
      all = all.concat(items);
      const total = parseInt((json.meta||{}).total_registros || 0);
      hasMore = items.length === 100 && all.length < total;
      page++;
    }
    return all;
  }

  const [vProd, vServ, vBalc] = await Promise.all([
    puxarTipo('produto'),
    puxarTipo('servico'),
    puxarTipo('vendas_balcao')
  ]);
  return vProd.concat(vServ).concat(vBalc);
}

function classify(sit, tipoGC) {
  if (!sit) return null;
  const s = sit.trim().toUpperCase();
  if (!s.startsWith('CONCRETIZADA')) return null;
  if (s !== 'CONCRETIZADA') return 'aparelho';
  if (tipoGC === 'vendas_balcao') return 'balcao';
  return 'servico';
}

function normNome(n) {
  return (n||'')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/\([^)]*\)/g,'')
    .replace(/\s+/g,' ').trim().toUpperCase();
}

function group(vendas) {
  const r = {};
  const indexNomes = {};
  for (const v of vendas) {
    const tipo = classify(v.nome_situacao||'', v.__tipoGC);
    if (!tipo) continue;

    const id = (v.vendedor_id != null && v.vendedor_id !== '') ? String(v.vendedor_id) : '__sem_id__';
    if (!r[id]) r[id] = {aparelhos:0, servicos:0, balcao:0, valor:0, valorAparelhos:0, valorServicos:0, valorBalcao:0, nomes:{}};
    const valor = parseFloat(v.valor_total||0);
    if (tipo==='aparelho') { r[id].aparelhos++; r[id].valorAparelhos += valor; }
    else if (tipo==='servico') { r[id].servicos++; r[id].valorServicos += valor; }
    else if (tipo==='balcao') { r[id].balcao++; r[id].valorBalcao += valor; }
    r[id].valor += valor;

    const nm = (v.nome_vendedor||'').trim();
    if (nm) {
      r[id].nomes[nm] = (r[id].nomes[nm]||0)+1;
      const key = normNome(nm);
      if (key) {
        if (!indexNomes[key]) indexNomes[key] = [];
        if (indexNomes[key].indexOf(id) === -1) indexNomes[key].push(id);
      }
    }
  }
  Object.keys(r).forEach(function(id){ r[id].nomes = Object.keys(r[id].nomes); });
  return { vendas: r, indexNomes: indexNomes };
}

const HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>King Alfa — Programa de Níveis</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.19.0/dist/tabler-icons.min.css">
<meta name="theme-color" content="#0A0A0A">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="King Níveis">
<meta name="mobile-web-app-capable" content="yes">
<script>if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){});});}</script>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --ka:#F07800; --kad:#D46400;
  --bg:#0A0A0A;
  --bg-card:#141414;
  --bg-card2:#1A1A1A;
  --bg-elev:#1F1F1F;
  --border:rgba(255,255,255,0.08);
  --border2:rgba(255,255,255,0.15);
  --text:#F3F4F6;
  --text2:#9CA3AF;
  --text3:#6B7280;
  --green:#10B981;
  --red:#EF4444;
  --r:14px; --rs:10px;
}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:var(--bg);min-height:100vh;color:var(--text)}

/* LOGIN */
#screen-login{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:24px;background:var(--bg)}
.login-card{background:var(--bg-card);border:1px solid var(--border);border-radius:20px;padding:32px 28px;width:100%;max-width:380px;box-shadow:0 24px 64px rgba(0,0,0,.6)}
.login-logo{text-align:center;margin-bottom:28px}
.login-title{font-size:13px;font-weight:600;color:var(--text3);text-align:center;margin-bottom:20px;text-transform:uppercase;letter-spacing:1px}
.seller-list{display:flex;flex-direction:column;gap:8px;margin-bottom:20px;max-height:280px;overflow-y:auto}
.seller-btn{background:var(--bg-card2);border:1px solid var(--border);color:var(--text);padding:12px 16px;border-radius:10px;cursor:pointer;text-align:left;font-size:14px;font-weight:500;transition:all .15s;display:flex;align-items:center;justify-content:space-between}
.seller-btn:hover{border-color:var(--ka);color:var(--ka)}
.seller-btn.admin-btn-login{border-color:rgba(255,255,255,0.05);color:var(--text3);font-size:13px}
.seller-btn.admin-btn-login:hover{border-color:var(--ka);color:var(--ka)}
.seller-unit-tag{font-size:11px;color:var(--text3);font-weight:400}

#pin-step{display:none}
.pin-back{background:none;border:none;color:var(--text3);cursor:pointer;font-size:13px;display:flex;align-items:center;gap:4px;margin-bottom:16px;padding:0}
.pin-back:hover{color:var(--ka)}
.pin-name{font-size:16px;font-weight:700;color:var(--text);margin-bottom:4px}
.pin-hint{font-size:12px;color:var(--text3);margin-bottom:20px}
.pin-dots{display:flex;gap:10px;justify-content:center;margin-bottom:20px}
.pin-dot{width:14px;height:14px;border-radius:50%;background:var(--bg-elev);border:2px solid var(--border);transition:all .15s}
.pin-dot.filled{background:var(--ka);border-color:var(--ka)}
.pin-pad{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.pin-key{background:var(--bg-card2);border:1px solid var(--border);color:var(--text);border-radius:12px;padding:16px;font-size:20px;font-weight:700;cursor:pointer;transition:all .15s;min-height:58px;display:flex;align-items:center;justify-content:center}
.pin-key:hover{border-color:var(--ka);color:var(--ka)}
.pin-key.del{font-size:16px;color:var(--text3)}
.pin-key.del:hover{color:var(--red);border-color:var(--red)}
.pin-error{color:var(--red);font-size:13px;text-align:center;margin-top:8px;min-height:20px}

#screen-changepin{display:none;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:24px;background:var(--bg)}
#screen-app{display:none;flex-direction:column;min-height:100vh;background:var(--bg)}

/* TOPBAR */
.topbar{background:var(--bg);border-bottom:1px solid var(--border);padding:0 20px;display:flex;align-items:center;justify-content:space-between;height:60px;flex-shrink:0}
.topbar-brand{font-size:14px;font-weight:800;letter-spacing:1px;color:var(--text)}
.topbar-brand span{color:var(--ka)}
.topbar-right{display:flex;align-items:center;gap:14px}
.topbar-user{font-size:13px;font-weight:600;color:var(--ka)}
.logout-btn{background:none;border:none;color:var(--text2);cursor:pointer;font-size:18px;display:flex;align-items:center}
.logout-btn:hover{color:var(--text)}

/* TABS */
.tabs{background:var(--bg);border-bottom:1px solid var(--border);display:flex;padding:0 20px;flex-shrink:0}
.tab{padding:14px 18px;font-size:13px;font-weight:600;color:var(--text2);cursor:pointer;border:none;background:none;border-bottom:2px solid transparent;margin-bottom:-1px;display:flex;align-items:center;gap:6px;transition:all .15s;white-space:nowrap}
.tab.on{color:var(--ka);border-bottom-color:var(--ka)}
.tab:hover:not(.on){color:var(--text)}

.view{display:none;flex:1;overflow-y:auto}
.view.on{display:block}

/* RANKING GERAL */
.vg-wrap{padding:20px;background:var(--bg);min-height:100%;max-width:1200px;margin:0 auto}

.hero-stats{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin-bottom:24px}
.hstat{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r);padding:18px 20px}
.hsl{font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;font-weight:600}
.hsv{font-size:32px;font-weight:800;color:var(--ka);line-height:1}
.hss{font-size:12px;color:var(--text3);margin-top:6px}

.sec-title{font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:1px;margin-bottom:14px;display:flex;align-items:center;gap:8px}
.sec-title i{color:var(--ka)}

.unit-section{margin-bottom:24px}
.unit-cards-row{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.ucard{background:var(--ka);border:1px solid var(--ka);border-radius:var(--r);padding:18px 20px;position:relative;overflow:hidden}
.ucard.lead{background:var(--ka);border-color:var(--ka);box-shadow:0 0 0 1px var(--ka),0 0 30px rgba(240,120,0,0.2)}
.ucard-label{font-size:11px;color:rgba(0,0,0,0.55);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;font-weight:700}
.ucard-name{font-size:19px;font-weight:800;color:#0A0A0A;margin-bottom:8px;line-height:1.2}
.ucard-meta{font-size:13px;color:rgba(0,0,0,0.7);font-weight:700}

/* RANKING TABLE (desktop) */
.rank-table-wrap{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r);overflow:hidden;margin-bottom:16px}
table{width:100%;border-collapse:collapse;font-size:13px}
th{padding:12px 14px;text-align:left;font-size:11px;font-weight:700;color:var(--text3);background:var(--bg-card2);border-bottom:1px solid var(--border);text-transform:uppercase;letter-spacing:1px}
td{padding:14px;border-bottom:1px solid var(--border);vertical-align:middle;color:var(--text)}
tbody tr:last-child td{border-bottom:none}
tbody tr:hover td{background:rgba(240,120,0,0.05)}
tr.me td{background:rgba(240,120,0,0.10) !important;position:relative}
tr.me td:first-child{border-left:3px solid var(--ka)}

/* Vendor name pill */
.vname-pill{display:inline-flex;align-items:center;gap:8px;background:var(--bg-card2);border:1px solid var(--border2);color:var(--ka);font-weight:700;padding:5px 14px;border-radius:8px;font-size:13px}
tr.me .vname-pill{border-color:var(--ka)}
.me-badge{display:inline-block;background:var(--ka);color:#0A0A0A;font-size:9px;font-weight:800;padding:2px 6px;border-radius:4px;letter-spacing:1px;margin-left:6px;vertical-align:middle}

/* Nivel badge inline (small emblem + name) */
.lvl-cell{display:inline-flex;align-items:center;gap:8px}
.lvl-emblem{width:28px;height:28px;flex-shrink:0}
.lvl-name{font-size:12px;font-weight:700}

/* Progress bar */
.pb{height:6px;background:var(--bg-elev);border-radius:3px;overflow:hidden;margin-top:6px}
.pf{height:100%;border-radius:3px;background:var(--ka)}

/* MOBILE RANKING CARDS */
.rank-cards{display:none}
.rcard{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r);padding:14px 16px;display:flex;align-items:center;gap:12px;margin-bottom:8px}
.rcard.me{border-color:var(--ka);background:rgba(240,120,0,0.08)}
.rcard-pos{font-size:22px;min-width:36px;text-align:center;flex-shrink:0}
.rcard-emb{width:32px;height:32px;flex-shrink:0}
.rcard-body{flex:1;min-width:0}
.rcard-name{margin-bottom:4px;display:flex;align-items:center;flex-wrap:wrap;gap:4px}
.rcard-meta{font-size:11px;color:var(--text3);margin-bottom:8px}
.rcard-nums{display:flex;align-items:center;gap:10px}
.rcard-val{font-size:15px;font-weight:800;color:var(--ka)}
.rcard-ap{font-size:11px;color:var(--text2);background:var(--bg-elev);padding:3px 8px;border-radius:6px}

/* INDIVIDUAL DASHBOARD */
.vi-wrap{padding:20px;background:var(--bg);min-height:100%;max-width:1000px;margin:0 auto}

.ind-hero{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r);padding:24px;display:flex;align-items:center;gap:20px;margin-bottom:20px}
.ind-emb{width:80px;height:80px;flex-shrink:0}
.ind-name{font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;font-weight:600}
.ind-lvl{font-size:24px;font-weight:800;color:var(--ka);line-height:1;margin-bottom:6px}
.ind-sub{font-size:12px;color:var(--text2)}

.cards3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px}
.icard{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r);padding:16px 18px}
.icl{font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;font-weight:600}
.icv{font-size:24px;font-weight:800;color:var(--ka)}
.ics{font-size:11px;color:var(--text3);margin-top:4px}

.prog-sec{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r);padding:16px 18px;margin-bottom:20px}
.prog-hd{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px}
.prog-label{font-size:13px;font-weight:600;color:var(--text)}
.prog-count{font-size:13px;color:var(--text2)}
.prog-hint{font-size:11px;color:var(--text3);margin-top:8px}

.fat-sec{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r);padding:18px 20px;margin-bottom:20px}
.fat-title{font-size:13px;font-weight:700;color:var(--text);margin-bottom:14px;text-transform:uppercase;letter-spacing:1px}
.fat-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.fat-card{background:var(--bg-card2);border-radius:10px;padding:12px 14px;border-left:3px solid;border-color:var(--ka)}
.fat-card.serv{border-color:#3B82F6}
.fat-card.balc{border-color:var(--green)}
.fat-card.total{background:linear-gradient(135deg,var(--bg-card2),#0A0A0A);border-left-color:var(--ka);border:1px solid var(--ka)}
.fat-label{font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:6px}
.fat-val{font-size:18px;font-weight:800;color:var(--text)}
.fat-card.total .fat-val{color:var(--ka)}
.fat-qty{font-size:11px;color:var(--text3);margin-top:3px}

.meta-bar{margin-top:18px;padding-top:16px;border-top:1px solid var(--border)}
.meta-bar-hd{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px}
.meta-bar-label{font-size:13px;font-weight:600;color:var(--text)}
.meta-bar-val{font-size:12px;color:var(--text2)}
.meta-bar-bg{height:8px;background:var(--bg-elev);border-radius:4px;overflow:hidden}
.meta-bar-fill{height:100%;border-radius:4px;transition:width .3s}
.meta-bar-hint{font-size:11px;color:var(--text3);margin-top:8px}

.remun-card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r);padding:18px 20px;margin-bottom:20px}
.remun-title{font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:14px;display:flex;align-items:center;gap:6px}
.remun-title i{color:var(--ka)}
.remun-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)}
.remun-row:last-child{border-bottom:none;padding-top:12px;margin-top:4px}
.remun-label{font-size:13px;color:var(--text2)}
.remun-val{font-size:13px;font-weight:600;color:var(--text)}
.remun-total-label{font-size:14px;font-weight:700;color:var(--ka)}
.remun-total-val{font-size:22px;font-weight:800;color:var(--ka)}

.ibox{background:var(--bg-card);border:1px solid var(--border);border-left:3px solid var(--ka);border-radius:var(--rs);padding:14px 18px;margin-bottom:14px}
.ibox-t{font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;display:flex;align-items:center;gap:6px}
.ibox-t i{color:var(--ka)}
.irow{display:flex;align-items:flex-start;gap:8px;font-size:13px;color:var(--text);margin-bottom:8px;line-height:1.5}
.irow:last-child{margin-bottom:0}
.irow i{font-size:14px;margin-top:1px;flex-shrink:0}

/* ADMIN */
.admin-wrap{padding:20px;background:var(--bg);min-height:100%;max-width:1100px;margin:0 auto}
.admin-section{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r);padding:20px;margin-bottom:18px}
.admin-sec-title{font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:1px;margin-bottom:16px;display:flex;align-items:center;gap:8px}
.admin-sec-title i{color:var(--ka)}
.atw{border:1px solid var(--border);border-radius:var(--rs);overflow:hidden;margin-bottom:14px}
.at{width:100%;border-collapse:collapse;font-size:13px}
.at th{background:var(--bg-card2);padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid var(--border)}
.at td{padding:10px 12px;border-bottom:1px solid var(--border);vertical-align:middle;color:var(--text)}
.at tr:last-child td{border-bottom:none}
.at input[type=text],.at input[type=number],.at input[type=password]{padding:6px 10px;border:1px solid var(--border2);border-radius:6px;font-size:13px;outline:none;width:100%;background:var(--bg-card2);color:var(--text)}
.at input:focus{border-color:var(--ka)}
.at select{padding:6px 10px;border:1px solid var(--border2);border-radius:6px;font-size:12px;outline:none;background:var(--bg-card2);color:var(--text);width:100%}
.at select:focus{border-color:var(--ka)}
.del-btn{background:none;border:none;cursor:pointer;color:var(--text3);font-size:16px;padding:3px 5px}
.del-btn:hover{color:var(--red)}
.socio-badge{font-size:11px;background:var(--bg-elev);color:var(--text2);padding:3px 8px;border-radius:6px;white-space:nowrap}

.nivel-row{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;margin-bottom:12px;align-items:center}
.nivel-name{font-size:13px;font-weight:700;color:var(--text);display:flex;align-items:center;gap:8px}
.ni{padding:8px 12px;border:1px solid var(--border2);border-radius:6px;font-size:13px;outline:none;width:100%;background:var(--bg-card2);color:var(--text)}
.ni:focus{border-color:var(--ka)}

.btn{display:inline-flex;align-items:center;gap:6px;padding:10px 18px;border-radius:var(--rs);font-size:13px;font-weight:700;cursor:pointer;border:none;transition:all .15s}
.btn-p{background:var(--ka);color:#0A0A0A}.btn-p:hover{background:var(--kad)}
.btn-g{background:var(--bg-card2);color:var(--text);border:1px solid var(--border2)}.btn-g:hover{background:var(--bg-elev)}
.btn-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:10px}

.fi{padding:10px 14px;border:1px solid var(--border2);border-radius:var(--rs);font-size:14px;outline:none;width:100%;background:var(--bg-card2);color:var(--text)}
.fi:focus{border-color:var(--ka)}
.fl{font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;display:block}

.sync-msg{font-size:13px;padding:12px 16px;border-radius:var(--rs);margin-bottom:14px;display:none;align-items:center;gap:8px}
.sync-msg.ok{background:rgba(16,185,129,0.1);color:var(--green);border:1px solid rgba(16,185,129,0.3);display:flex}
.sync-msg.err{background:rgba(239,68,68,0.1);color:var(--red);border:1px solid rgba(239,68,68,0.3);display:flex}
.sync-msg.loading{background:rgba(240,120,0,0.1);color:var(--ka);border:1px solid rgba(240,120,0,0.3);display:flex}

@media(max-width:640px){
  .hero-stats{grid-template-columns:1fr 1fr;gap:10px}
  .hsv{font-size:26px}
  .unit-cards-row{grid-template-columns:1fr;gap:8px}
  .rank-table-wrap{display:none}
  .rank-cards{display:flex;flex-direction:column;gap:8px;margin-bottom:16px}
  .tabs{position:fixed;bottom:0;left:0;right:0;border-top:1px solid var(--border);border-bottom:none;justify-content:space-around;z-index:200;padding:0;background:var(--bg-card)}
  .tab{flex:1;justify-content:center;padding:14px 8px;font-size:11px;flex-direction:column;align-items:center;gap:3px}
  .tab i{font-size:20px}
  .vg-wrap,.vi-wrap,.admin-wrap{padding-bottom:80px}
  .topbar{height:52px;padding:0 14px}
  .cards3{grid-template-columns:1fr 1fr}
  .ind-hero{padding:16px}
  .ind-emb{width:60px;height:60px}
  .ind-lvl{font-size:20px}
  .nivel-row{grid-template-columns:1fr 1fr}
  .atw{overflow-x:auto}
}

@keyframes sp{to{transform:rotate(360deg)}}
.spin{animation:sp 1s linear infinite;display:inline-block}
</style>
</head>
<body>

<div id="screen-login">
  <div class="login-card">
    <div class="login-logo">
      <div style="font-size:22px;font-weight:800;color:var(--text)">GRUPO <span style="color:var(--ka)">KING ALFA</span></div>
      <div style="font-size:11px;color:var(--text3);margin-top:6px;text-transform:uppercase;letter-spacing:2px">Programa de Níveis</div>
    </div>
    <div id="seller-step">
      <div class="login-title">Quem é você?</div>
      <div class="seller-list" id="seller-list-ui"></div>
    </div>
    <div id="pin-step">
      <button class="pin-back" onclick="backToSeller()"><i class="ti ti-arrow-left"></i> Voltar</button>
      <div class="pin-name" id="pin-seller-name"></div>
      <div class="pin-hint">Digite seu PIN de 4 dígitos</div>
      <div class="pin-dots">
        <div class="pin-dot" id="d0"></div><div class="pin-dot" id="d1"></div>
        <div class="pin-dot" id="d2"></div><div class="pin-dot" id="d3"></div>
      </div>
      <div class="pin-pad">
        <button class="pin-key" onclick="pinKey('1')">1</button>
        <button class="pin-key" onclick="pinKey('2')">2</button>
        <button class="pin-key" onclick="pinKey('3')">3</button>
        <button class="pin-key" onclick="pinKey('4')">4</button>
        <button class="pin-key" onclick="pinKey('5')">5</button>
        <button class="pin-key" onclick="pinKey('6')">6</button>
        <button class="pin-key" onclick="pinKey('7')">7</button>
        <button class="pin-key" onclick="pinKey('8')">8</button>
        <button class="pin-key" onclick="pinKey('9')">9</button>
        <button class="pin-key" style="visibility:hidden"></button>
        <button class="pin-key" onclick="pinKey('0')">0</button>
        <button class="pin-key del" onclick="pinDel()"><i class="ti ti-backspace"></i></button>
      </div>
      <div class="pin-error" id="pin-error"></div>
    </div>
  </div>
</div>

<div id="screen-changepin">
  <div class="login-card">
    <div style="font-size:18px;font-weight:800;color:var(--text);margin-bottom:6px">Altere seu PIN</div>
    <div style="font-size:13px;color:var(--text3);margin-bottom:20px">Primeiro acesso. Defina um PIN de 4 dígitos.</div>
    <div class="pin-name" id="changepin-stepname">Novo PIN</div>
    <div class="pin-hint" id="changepin-hint">Digite 4 dígitos</div>
    <div class="pin-dots">
      <div class="pin-dot" id="cpd0"></div><div class="pin-dot" id="cpd1"></div>
      <div class="pin-dot" id="cpd2"></div><div class="pin-dot" id="cpd3"></div>
    </div>
    <div class="pin-pad">
      <button class="pin-key" onclick="changePinKey('1')">1</button>
      <button class="pin-key" onclick="changePinKey('2')">2</button>
      <button class="pin-key" onclick="changePinKey('3')">3</button>
      <button class="pin-key" onclick="changePinKey('4')">4</button>
      <button class="pin-key" onclick="changePinKey('5')">5</button>
      <button class="pin-key" onclick="changePinKey('6')">6</button>
      <button class="pin-key" onclick="changePinKey('7')">7</button>
      <button class="pin-key" onclick="changePinKey('8')">8</button>
      <button class="pin-key" onclick="changePinKey('9')">9</button>
      <button class="pin-key" style="visibility:hidden"></button>
      <button class="pin-key" onclick="changePinKey('0')">0</button>
      <button class="pin-key del" onclick="changePinDel()"><i class="ti ti-backspace"></i></button>
    </div>
    <div class="pin-error" id="changepin-err"></div>
  </div>
</div>

<div id="screen-app">
  <div class="topbar">
    <div class="topbar-brand">GRUPO <span>KING ALFA</span></div>
    <div class="topbar-right">
      <div class="topbar-user" id="topbar-user"></div>
      <button class="logout-btn" onclick="logout()" title="Sair"><i class="ti ti-logout"></i></button>
    </div>
  </div>
  <div class="tabs" id="main-tabs">
    <button class="tab on" id="tab-geral" onclick="showTab('geral')"><i class="ti ti-trophy"></i><span> Ranking</span></button>
    <button class="tab" id="tab-ind" onclick="showTab('ind')"><i class="ti ti-user-circle"></i><span> Meu Dashboard</span></button>
    <button class="tab" id="tab-admin" onclick="showTab('admin')" style="display:none"><i class="ti ti-settings"></i><span> Admin</span></button>
    <button class="tab" id="tab-acomp" onclick="showTab('acomp')" style="display:none"><i class="ti ti-history"></i><span> Acompanhamento</span></button>
  </div>
  <div id="view-geral" class="view on">
    <div class="vg-wrap">
      <div id="geral-loading" style="text-align:center;padding:40px;color:var(--text3)">
        <i class="ti ti-loader-2 spin" style="font-size:28px;display:block;margin-bottom:8px"></i>Carregando...
      </div>
      <div id="geral-content" style="display:none"></div>
    </div>
  </div>
  <div id="view-ind" class="view">
    <div class="vi-wrap" id="ind-content">
      <div style="text-align:center;padding:40px;color:var(--text3)">
        <i class="ti ti-loader-2 spin" style="font-size:28px;display:block;margin-bottom:8px"></i>Carregando...
      </div>
    </div>
  </div>
  <div id="view-admin" class="view">
    <div class="admin-wrap" id="admin-content"></div>
  </div>
  <div id="view-acomp" class="view">
    <div class="admin-wrap" id="acomp-content"></div>
  </div>
</div>

<script>
var PROGRAMA_INICIO = '2026-07';
var JSONBIN_ID  = '6a3bdd8bf5f4af5e292909de';
var JSONBIN_KEY = '$2a$10$WzIxNTgN9XRQfPCpGeVPoODb0VwvPbZoZcVT6nRkodWl01uzLgvXW';
var API_BASE    = '/api';

var DEFAULT_DATA = {
  adminPin: '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4',
  config: {
    niveis: [
      {id:0,nome:'Escudeiro',minAp:0, maxAp:20, pct:0.008},
      {id:1,nome:'Cavaleiro',minAp:21,maxAp:30, pct:0.0115},
      {id:2,nome:'Duque',    minAp:31,maxAp:40, pct:0.018},
      {id:3,nome:'Rei',      minAp:41,maxAp:9999,pct:0.02}
    ]
  },
  unidades: [
    {id:1, nome:'King 1 — Matriz',          nomeGC:'KING 01 - Matriz',         lojaId:'', metaFaturamento:null},
    {id:2, nome:'King 02 — Pq. Anhanguera', nomeGC:'KING 02 - Pq. Anhanguera', lojaId:'', metaFaturamento:null},
    {id:3, nome:'King 03 — Igualdade',      nomeGC:'KING 03 - Igualdade',      lojaId:'', metaFaturamento:null}
  ],
  vendedores: [],
  historico: {}
};

var appData = null;
var currentUser = null;
var vendaCache = {};
var pinBuffer = '';
var selectedSellerId = null;
var acompSelectedId = null;

// ========== EMBLEMAS DOS NÍVEIS (SVG inline) ==========
// Cada função retorna SVG do emblema no tamanho passado.
function emblemaEscudeiro(size) {
  size = size || 48;
  return '<svg width="'+size+'" height="'+size+'" viewBox="0 0 110 160" xmlns="http://www.w3.org/2000/svg">'+
    '<defs><linearGradient id="eIron" x1="0" y1="0" x2="0" y2="1">'+
      '<stop offset="0%" stop-color="#F3F4F6"/><stop offset="50%" stop-color="#9CA3AF"/><stop offset="100%" stop-color="#4B5563"/>'+
    '</linearGradient></defs>'+
    '<circle cx="55" cy="80" r="68" fill="none" stroke="#9CA3AF" stroke-width="1.5" opacity="0.6"/>'+
    '<path d="M55 30 L92 42 L92 88 Q92 118 55 138 Q18 118 18 88 L18 42 Z" fill="url(#eIron)" stroke="#374151" stroke-width="1"/>'+
    '<path d="M55 30 L92 42 L92 80 Q72 65 55 65 Q38 65 18 80 L18 42 Z" fill="#FFFFFF" opacity="0.18"/>'+
    '<rect x="53" y="50" width="4" height="60" fill="#1F2937"/>'+
    '<rect x="47" y="58" width="16" height="4" fill="#1F2937"/>'+
    '<path d="M53 110 L57 110 L55 118 Z" fill="#1F2937"/>'+
  '</svg>';
}

function emblemaCavaleiro(size) {
  size = size || 48;
  return '<svg width="'+size+'" height="'+size+'" viewBox="0 0 110 160" xmlns="http://www.w3.org/2000/svg">'+
    '<defs><linearGradient id="cSilv" x1="0" y1="0" x2="0" y2="1">'+
      '<stop offset="0%" stop-color="#FFFFFF"/><stop offset="40%" stop-color="#E5E7EB"/><stop offset="100%" stop-color="#6B7280"/>'+
    '</linearGradient></defs>'+
    '<circle cx="55" cy="80" r="68" fill="none" stroke="#D1D5DB" stroke-width="1.5" opacity="0.7"/>'+
    '<g transform="rotate(-25 55 80)">'+
      '<rect x="51" y="25" width="8" height="80" fill="url(#cSilv)" stroke="#374151" stroke-width="0.8"/>'+
      '<path d="M55 22 L60 32 L50 32 Z" fill="url(#cSilv)" stroke="#374151" stroke-width="0.8"/>'+
      '<rect x="40" y="103" width="30" height="5" fill="url(#cSilv)" stroke="#374151" stroke-width="0.8"/>'+
      '<rect x="51" y="108" width="8" height="20" fill="#374151"/>'+
      '<circle cx="55" cy="132" r="4" fill="url(#cSilv)" stroke="#374151" stroke-width="0.8"/>'+
    '</g>'+
    '<g transform="rotate(25 55 80)">'+
      '<rect x="51" y="25" width="8" height="80" fill="url(#cSilv)" stroke="#374151" stroke-width="0.8"/>'+
      '<path d="M55 22 L60 32 L50 32 Z" fill="url(#cSilv)" stroke="#374151" stroke-width="0.8"/>'+
      '<rect x="40" y="103" width="30" height="5" fill="url(#cSilv)" stroke="#374151" stroke-width="0.8"/>'+
      '<rect x="51" y="108" width="8" height="20" fill="#374151"/>'+
      '<circle cx="55" cy="132" r="4" fill="url(#cSilv)" stroke="#374151" stroke-width="0.8"/>'+
    '</g>'+
  '</svg>';
}

function emblemaDuque(size) {
  size = size || 48;
  return '<svg width="'+size+'" height="'+size+'" viewBox="0 0 110 160" xmlns="http://www.w3.org/2000/svg">'+
    '<defs><linearGradient id="dGold" x1="0" y1="0" x2="0" y2="1">'+
      '<stop offset="0%" stop-color="#FDE68A"/><stop offset="50%" stop-color="#F59E0B"/><stop offset="100%" stop-color="#B45309"/>'+
    '</linearGradient></defs>'+
    '<circle cx="55" cy="80" r="68" fill="none" stroke="#FCD34D" stroke-width="2" opacity="0.85"/>'+
    '<circle cx="55" cy="80" r="65" fill="none" stroke="#F59E0B" stroke-width="0.5" opacity="0.4"/>'+
    '<path d="M15 122 L15 50 L32 75 L40 35 L55 65 L70 35 L78 75 L95 50 L95 122 Z" fill="url(#dGold)" stroke="#78350F" stroke-width="1"/>'+
    '<path d="M15 122 L15 50 L32 75 L40 35 L55 65 L70 35 L78 75 L95 50 L95 90 Q55 80 15 90 Z" fill="#FFFFFF" opacity="0.22"/>'+
    '<rect x="15" y="122" width="80" height="14" fill="url(#dGold)" stroke="#78350F" stroke-width="1"/>'+
    '<path d="M55 50 L62 65 L55 80 L48 65 Z" fill="#DC2626" stroke="#7F1D1D" stroke-width="0.8"/>'+
    '<circle cx="32" cy="128" r="2.5" fill="#78350F"/>'+
    '<circle cx="55" cy="128" r="2.5" fill="#78350F"/>'+
    '<circle cx="78" cy="128" r="2.5" fill="#78350F"/>'+
  '</svg>';
}

function emblemaRei(size) {
  size = size || 48;
  return '<svg width="'+size+'" height="'+size+'" viewBox="0 0 110 160" xmlns="http://www.w3.org/2000/svg">'+
    '<defs><linearGradient id="rDiam" x1="0" y1="0" x2="0" y2="1">'+
      '<stop offset="0%" stop-color="#DDD6FE"/><stop offset="50%" stop-color="#A78BFA"/><stop offset="100%" stop-color="#6D28D9"/>'+
    '</linearGradient></defs>'+
    '<circle cx="55" cy="80" r="68" fill="none" stroke="#A78BFA" stroke-width="2" opacity="0.9"/>'+
    '<circle cx="55" cy="80" r="65" fill="none" stroke="#7C3AED" stroke-width="0.5" opacity="0.4"/>'+
    '<path d="M55 22 L92 70 L55 138 L18 70 Z" fill="url(#rDiam)" stroke="#5B21B6" stroke-width="1"/>'+
    '<path d="M55 22 L92 70 L55 80 L18 70 Z" fill="#FFFFFF" opacity="0.35"/>'+
    '<path d="M55 22 L75 50 L55 60 L35 50 Z" fill="#FFFFFF" opacity="0.5"/>'+
    '<line x1="55" y1="22" x2="55" y2="138" stroke="#5B21B6" stroke-width="0.8" opacity="0.7"/>'+
    '<line x1="18" y1="70" x2="92" y2="70" stroke="#5B21B6" stroke-width="0.8" opacity="0.5"/>'+
  '</svg>';
}

function emblemaPorNivel(nivelIdx, size) {
  if (nivelIdx === 0) return emblemaEscudeiro(size);
  if (nivelIdx === 1) return emblemaCavaleiro(size);
  if (nivelIdx === 2) return emblemaDuque(size);
  if (nivelIdx === 3) return emblemaRei(size);
  return emblemaEscudeiro(size);
}

// ========== UTILS ==========
async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
function g(id){return document.getElementById(id);}
function money(v){return'R$ '+Math.round(v||0).toLocaleString('pt-BR');}
function fmtMes(m){if(!m)return'';var p=m.split('-');var n=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];return n[parseInt(p[1])-1]+'/'+p[0];}
function curMes(){return new Date().toISOString().slice(0,7);}
function getUnidade(id){return (appData.unidades||[]).find(function(u){return u.id===id;});}
function getVendedor(id){return (appData.vendedores||[]).find(function(v){return v.id===id;});}

var jbConfigured = () => JSONBIN_ID!=='COLE_O_BIN_ID_AQUI';

async function loadData() {
  if (!jbConfigured()) { appData = JSON.parse(JSON.stringify(DEFAULT_DATA)); return; }
  try {
    const r = await fetch('https://api.jsonbin.io/v3/b/'+JSONBIN_ID+'/latest',{headers:{'X-Master-Key':JSONBIN_KEY,'X-Bin-Meta':'false'}});
    const j = await r.json();
    var rec = j.record||j;
    appData = (rec&&rec.vendedores) ? rec : DEFAULT_DATA;
    if (!appData.historico) appData.historico = {};
    var migrou = false;
    (appData.unidades||[]).forEach(function(u){
      if (u.metaFaturamento == null && u.metaServicos != null) { u.metaFaturamento = u.metaServicos; migrou = true; }
    });
    (appData.vendedores||[]).forEach(function(v){
      if (v.metaFaturamento == null && v.metaServicos != null) { v.metaFaturamento = v.metaServicos; migrou = true; }
    });
    if (migrou) { try { await saveData(); } catch(e){} }
  } catch(e) { appData = JSON.parse(JSON.stringify(DEFAULT_DATA)); }
}

async function saveData() {
  if (!jbConfigured()) return;
  await fetch('https://api.jsonbin.io/v3/b/'+JSONBIN_ID,{method:'PUT',headers:{'Content-Type':'application/json','X-Master-Key':JSONBIN_KEY},body:JSON.stringify(appData)});
}

async function fetchVendas(mes) {
  if (vendaCache[mes]) return vendaCache[mes];
  try {
    var url = API_BASE+'/vendas?mes='+mes+'&t='+Date.now();
    var r = await fetch(url);
    var j = await r.json();
    if (!j.success) throw new Error(j.error);
    vendaCache[mes] = j;
    return j;
  } catch(e) {
    return { mesAtual:{mes:mes,vendas:{}}, mesAnterior:{vendas:{}} };
  }
}

function normNomeFront(n) {
  var s = (n || '').normalize('NFD');
  var r = '';
  for (var i = 0; i < s.length; i++) {
    var code = s.charCodeAt(i);
    if (code >= 0x0300 && code <= 0x036f) continue;
    r += s[i];
  }
  var out = '';
  var skip = 0;
  for (var i = 0; i < r.length; i++) {
    var ch = r[i];
    if (ch === '(') { skip++; continue; }
    if (ch === ')') { if (skip > 0) skip--; continue; }
    if (skip > 0) continue;
    out += ch;
  }
  return out.replace(/  +/g, ' ').replace(/^ +| +$/g, '').toUpperCase();
}

function getSellerVendas(data, vendedor) {
  var result = {aparelhos:0, servicos:0, balcao:0, valor:0, valorAparelhos:0, valorServicos:0, valorBalcao:0};
  if (!data || !data.vendas) return result;
  var idx = data.indexNomes || {};
  var ids = {};
  (vendedor.nomesGC||[]).forEach(function(nomeGC) {
    var key = normNomeFront(nomeGC);
    var arr = idx[key] || [];
    arr.forEach(function(id){ ids[id] = true; });
  });
  Object.keys(ids).forEach(function(id) {
    var e = data.vendas[id];
    if (e) {
      result.aparelhos      += e.aparelhos||0;
      result.servicos       += e.servicos||0;
      result.balcao         += e.balcao||0;
      result.valor          += e.valor||0;
      result.valorAparelhos += e.valorAparelhos||0;
      result.valorServicos  += e.valorServicos||0;
      result.valorBalcao    += e.valorBalcao||0;
    }
  });
  return result;
}

function calcNivel(vendedor, vendaAtual, vendaAnterior, mesAtual) {
  var niveis = appData.config.niveis;
  var apAtual    = vendaAtual.aparelhos;
  var apAnterior = vendaAnterior.aparelhos;
  if (!mesAtual || mesAtual < PROGRAMA_INICIO) {
    for (var j = niveis.length-1; j >= 0; j--) {
      if (apAtual >= niveis[j].minAp) return { nivel: j, status:'referencia', apAtual:apAtual };
    }
    return { nivel: 0, status:'referencia', apAtual:apAtual };
  }
  var nivelAtual  = vendedor.nivelAtual || 0;
  var lvlAtual = niveis[nivelAtual];
  var lvlProx  = niveis[nivelAtual+1];
  var lvlAnt   = nivelAtual > 0 ? niveis[nivelAtual-1] : null;
  var subiuMesAnterior = lvlProx && apAnterior >= lvlProx.minAp;
  var subiuMesAtual    = lvlProx && apAtual    >= lvlProx.minAp;
  if (subiuMesAnterior && subiuMesAtual) return { nivel: nivelAtual+1, status:'subiu', apAtual:apAtual };
  var caiu1 = apAtual    < lvlAtual.minAp;
  var caiu2 = apAnterior < lvlAtual.minAp;
  if (caiu1 && caiu2 && lvlAnt) return { nivel: nivelAtual-1, status:'desceu', apAtual:apAtual };
  return { nivel: nivelAtual, status:'manteve', apAtual:apAtual };
}

function renderLoginList() {
  var list = g('seller-list-ui');
  var html = '';
  (appData.vendedores||[]).forEach(function(v) {
    var u = getUnidade(v.unidadeId);
    html += '<button class="seller-btn" onclick="selectSeller('+v.id+')">'+
      '<span>'+v.nome+'</span>'+
      '<span class="seller-unit-tag">'+(u?u.nome:'')+'</span>'+
    '</button>';
  });
  html += '<button class="seller-btn admin-btn-login" onclick="selectSeller(-1)" style="margin-top:6px">'+
    '<span><i class="ti ti-shield-lock" style="font-size:14px"></i> Admin / Gerente</span>'+
    '<i class="ti ti-chevron-right" style="font-size:14px"></i>'+
  '</button>';
  list.innerHTML = html;
}

function selectSeller(id) {
  selectedSellerId = id;
  var nome = id === -1 ? 'Admin / Gerente' : (getVendedor(id)||{nome:''}).nome;
  g('pin-seller-name').textContent = nome;
  g('seller-step').style.display = 'none';
  g('pin-step').style.display = 'block';
  pinBuffer = '';
  updatePinDots();
  g('pin-error').textContent = '';
}
function backToSeller() {
  g('pin-step').style.display = 'none';
  g('seller-step').style.display = 'block';
  pinBuffer = '';
  updatePinDots();
}
function updatePinDots() {
  for (var i=0;i<4;i++) g('d'+i).classList.toggle('filled', i < pinBuffer.length);
}
function pinKey(k) {
  if (pinBuffer.length >= 4) return;
  pinBuffer += k;
  updatePinDots();
  if (pinBuffer.length === 4) setTimeout(checkPin, 150);
}
function pinDel() {
  if (pinBuffer.length > 0) { pinBuffer = pinBuffer.slice(0,-1); updatePinDots(); }
}

async function checkPin() {
  var hash = await sha256(pinBuffer);
  g('pin-error').textContent = '';
  if (selectedSellerId === -1) {
    if (hash === appData.adminPin) loginSuccess({id:-1, nome:'Admin', isAdmin:true});
    else { g('pin-error').textContent = 'PIN incorreto'; pinBuffer = ''; updatePinDots(); }
    return;
  }
  var v = getVendedor(selectedSellerId);
  if (!v) return;
  if (hash === v.pin) {
    if (v.pinInicial) {
      currentUser = {id:v.id, nome:v.nome, isAdmin:false};
      resetChangePin();
      showScreen('changepin');
    } else {
      loginSuccess({id:v.id, nome:v.nome, isAdmin:false});
    }
  } else {
    g('pin-error').textContent = 'PIN incorreto';
    pinBuffer = ''; updatePinDots();
  }
}

// ========== CHANGE-PIN (PIN-pad em 2 etapas) ==========
var changePinStep = 1;
var changePinBuffer = '';
var changePinFirst = '';

function resetChangePin() {
  changePinStep = 1;
  changePinBuffer = '';
  changePinFirst = '';
  g('changepin-stepname').textContent = 'Novo PIN';
  g('changepin-hint').textContent = 'Digite 4 dígitos';
  g('changepin-err').textContent = '';
  updateChangePinDots();
}

function updateChangePinDots() {
  for (var i=0;i<4;i++) g('cpd'+i).classList.toggle('filled', i < changePinBuffer.length);
}

function changePinKey(k) {
  if (changePinBuffer.length >= 4) return;
  changePinBuffer += k;
  updateChangePinDots();
  g('changepin-err').textContent = '';
  if (changePinBuffer.length === 4) setTimeout(advanceChangePin, 150);
}

function changePinDel() {
  if (changePinBuffer.length > 0) {
    changePinBuffer = changePinBuffer.slice(0,-1);
    updateChangePinDots();
  }
}

async function advanceChangePin() {
  if (changePinStep === 1) {
    changePinFirst = changePinBuffer;
    changePinBuffer = '';
    changePinStep = 2;
    g('changepin-stepname').textContent = 'Confirme o PIN';
    g('changepin-hint').textContent = 'Digite o mesmo PIN de novo';
    updateChangePinDots();
  } else {
    if (changePinBuffer !== changePinFirst) {
      g('changepin-err').textContent = 'PINs não coincidem. Começando de novo.';
      setTimeout(resetChangePin, 1500);
      return;
    }
    var pin = changePinBuffer;
    var hash = await sha256(pin);
    var v = getVendedor(currentUser.id);
    v.pin = hash; v.pinInicial = false;
    try { await saveData(); } catch(e){}
    loginSuccess(currentUser);
  }
}

function loginSuccess(user) {
  currentUser = user;
  g('topbar-user').textContent = user.nome;
  if (user.isAdmin) { g('tab-admin').style.display = 'flex'; g('tab-acomp').style.display = 'flex'; g('tab-ind').style.display = 'none'; }
  else { g('tab-admin').style.display = 'none'; g('tab-acomp').style.display = 'none'; g('tab-ind').style.display = 'flex'; }
  showScreen('app');
  showTab('geral');
}

function logout() {
  currentUser = null; vendaCache = {};
  showScreen('login');
  pinBuffer = ''; backToSeller();
}

function showScreen(s) {
  ['login','changepin','app'].forEach(function(id){ g('screen-'+id).style.display='none'; });
  g('screen-'+s).style.display = 'flex';
  g('screen-'+s).style.flexDirection = 'column';
}
function showTab(t) {
  ['geral','ind','admin','acomp'].forEach(function(id){
    g('view-'+id).classList.toggle('on', id===t);
    var tab=g('tab-'+id); if(tab) tab.classList.toggle('on',id===t);
  });
  if (t==='geral') renderGeral();
  if (t==='ind')   renderInd();
  if (t==='admin') renderAdmin();
  if (t==='acomp') renderAcompanhamento();
}

async function renderGeral() {
  g('geral-loading').style.display='block';
  g('geral-content').style.display='none';
  var mes = curMes();
  var niveis = appData.config.niveis;
  var unidades = appData.unidades;
  var vendedores = appData.vendedores;
  var allData = await fetchVendas(mes);

  var sellerStats = vendedores.map(function(v) {
    var u = getUnidade(v.unidadeId);
    var atualData = getSellerVendas(allData.mesAtual, v);
    var anteriorData = getSellerVendas(allData.mesAnterior, v);
    var nivelCalc = calcNivel(v, atualData, anteriorData, mes);
    var lvl = niveis[nivelCalc.nivel]||niveis[0];
    return {
      v:v, u:u, lvl:lvl,
      aparelhos: atualData.aparelhos,
      servicos:  atualData.servicos,
      valor:     atualData.valor||0,
      nivelId:   nivelCalc.nivel
    };
  }).sort(function(a,b){ return (b.valor||0) - (a.valor||0); });

  var unitStats = unidades.map(function(u) {
    var us = sellerStats.filter(function(s){ return s.u&&s.u.id===u.id; });
    var totalAp = us.reduce(function(sum,s){ return sum+s.aparelhos; },0);
    return {u:u, totalAp:totalAp, count:us.length};
  }).sort(function(a,b){ return b.totalAp-a.totalAp; });

  var totalAp = sellerStats.reduce(function(s,x){ return s+x.aparelhos; },0);
  var mediaAp = sellerStats.length ? Math.round(totalAp/sellerStats.length) : 0;
  var best = sellerStats[0];

  var uc = unitStats.map(function(us,i) {
    var label = i===0 ? 'Líder' : (i+1)+'ª';
    return '<div class="ucard'+(i===0?' lead':'')+'">'+
      '<div class="ucard-label">'+label+'</div>'+
      '<div class="ucard-name">'+us.u.nome+'</div>'+
      '<div class="ucard-meta">'+us.totalAp+' ap. · '+us.count+' vend.</div>'+
    '</div>';
  }).join('');

  var meuId = currentUser && !currentUser.isAdmin ? currentUser.id : null;

  var rows = sellerStats.map(function(s,i) {
    var nx = niveis[s.nivelId+1];
    var pct = nx ? Math.min(100,Math.round(s.aparelhos/nx.minAp*100)) : 100;
    var valorStr = 'R$ '+Math.round(s.valor||0).toLocaleString('pt-BR');
    var medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':'<span style="color:var(--text3);font-weight:700">#'+(i+1)+'</span>';
    var nxtHtml = nx
      ? '<span style="font-size:11px;color:var(--text3)">'+s.aparelhos+'/'+nx.minAp+'</span>'+
        '<div class="pb"><div class="pf" style="width:'+pct+'%"></div></div>'
      : '<span style="font-size:11px;font-weight:700;color:var(--ka)">👑 Rei</span>';
    var isMe = meuId === s.v.id;
    var meBadge = isMe ? '<span class="me-badge">VOCÊ</span>' : '';
    return '<tr'+(isMe?' class="me"':'')+'>'+
      '<td style="font-weight:700;font-size:15px;min-width:48px">'+medal+'</td>'+
      '<td><span class="vname-pill">'+s.v.nome+'</span>'+meBadge+'</td>'+
      '<td style="font-size:12px;color:var(--text2)">'+s.u.nome+'</td>'+
      '<td><div class="lvl-cell"><div class="lvl-emblem">'+emblemaPorNivel(s.nivelId, 28)+'</div><span class="lvl-name">'+s.lvl.nome+'</span></div></td>'+
      '<td style="font-weight:700;font-size:13px;color:var(--ka)">'+valorStr+'</td>'+
      '<td style="font-weight:700;color:var(--text)">'+s.aparelhos+'</td>'+
      '<td style="min-width:90px">'+nxtHtml+'</td></tr>';
  }).join('');

  var rcards = sellerStats.map(function(s,i) {
    var valorStr = 'R$ '+Math.round(s.valor||0).toLocaleString('pt-BR');
    var medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':'#'+(i+1);
    var isMe = meuId === s.v.id;
    var meBadge = isMe ? '<span class="me-badge">VOCÊ</span>' : '';
    return '<div class="rcard'+(isMe?' me':'')+'">'+
      '<div class="rcard-pos">'+medal+'</div>'+
      '<div class="rcard-emb">'+emblemaPorNivel(s.nivelId, 32)+'</div>'+
      '<div class="rcard-body">'+
      '<div class="rcard-name"><span class="vname-pill">'+s.v.nome+'</span>'+meBadge+'</div>'+
      '<div class="rcard-meta">'+s.u.nome+' · '+s.lvl.nome+'</div>'+
      '<div class="rcard-nums">'+
      '<span class="rcard-val">'+valorStr+'</span>'+
      '<span class="rcard-ap">'+s.aparelhos+' ap.</span>'+
      '</div></div></div>';
  }).join('');

  g('geral-content').innerHTML =
    '<div class="hero-stats">'+
    '<div class="hstat"><div class="hsl">Total aparelhos</div><div class="hsv">'+totalAp+'</div><div class="hss">mês atual</div></div>'+
    '<div class="hstat"><div class="hsl">Média/vendedor</div><div class="hsv">'+mediaAp+'</div><div class="hss">aparelhos</div></div>'+
    '<div class="hstat"><div class="hsl">Melhor vendedor</div><div class="hsv" style="font-size:18px;line-height:1.3">'+(best?best.v.nome:'-')+'</div><div class="hss">'+(best?'R$ '+Math.round(best.valor||0).toLocaleString('pt-BR'):'')+'</div></div>'+
    '<div class="hstat"><div class="hsl">Mês</div><div class="hsv" style="font-size:18px">'+fmtMes(mes)+'</div></div>'+
    '</div>'+
    '<div class="unit-section">'+
    '<div class="sec-title"><i class="ti ti-building"></i> Ranking de Unidades</div>'+
    '<div class="unit-cards-row">'+uc+'</div></div>'+
    '<div class="sec-title" style="margin-top:24px"><i class="ti ti-list-numbers"></i> Ranking Individual</div>'+
    '<div class="rank-table-wrap"><table><thead><tr>'+
    '<th>#</th><th>Vendedor</th><th>Unidade</th><th>Nível</th><th>Valor</th><th>Ap.</th><th>Próximo</th>'+
    '</tr></thead><tbody>'+rows+'</tbody></table></div>'+
    '<div class="rank-cards">'+rcards+'</div>';

  g('geral-loading').style.display='none';
  g('geral-content').style.display='block';
}

async function renderInd() {
  if (!currentUser || currentUser.isAdmin) return;
  var v = getVendedor(currentUser.id);
  if (!v) return;
  var u = getUnidade(v.unidadeId);
  var niveis = appData.config.niveis;
  var mes = curMes();

  var data = await fetchVendas(mes);
  var atualData    = getSellerVendas(data.mesAtual, v);
  var anteriorData = getSellerVendas(data.mesAnterior, v);
  var nivelCalc = calcNivel(v, atualData, anteriorData, mes);
  var lvl  = niveis[nivelCalc.nivel]||niveis[0];
  var nx   = niveis[nivelCalc.nivel+1];
  var pv   = nivelCalc.nivel>0 ? niveis[nivelCalc.nivel-1] : null;
  var pct  = nx ? Math.min(100,Math.round(atualData.aparelhos/nx.minAp*100)) : 100;
  var gap  = nx ? Math.max(0,nx.minAp-atualData.aparelhos) : 0;
  var pctVal = (lvl.pct*100).toFixed(2).replace('.',',')+'%';
  var commAp = v.isSocio ? 0 : Math.round(lvl.pct * atualData.valorAparelhos);
  var commBalc = v.isSocio ? 0 : Math.round(0.04 * atualData.valorBalcao);
  var total  = v.isSocio ? 0 : v.salario + v.beneficios + commAp + commBalc;

  var infos = [];
  if (nx) {
    if (gap>0) infos.push({i:'ti-arrow-up',c:'var(--ka)',t:'Faltam <strong>'+gap+' aparelhos</strong> para entrar na faixa de '+nx.nome+' este mês'});
    else infos.push({i:'ti-check',c:'var(--green)',t:'Você já está na faixa de <strong>'+nx.nome+'</strong>! Mantenha por mais 1 mês para ser promovido.'});
  } else {
    infos.push({i:'ti-crown',c:'var(--ka)',t:'Nível máximo! Mantenha 41+ aparelhos para defender a posição de Rei.'});
  }
  if (anteriorData.aparelhos < lvl.minAp && pv) {
    infos.push({i:'ti-alert-triangle',c:'var(--red)',t:'Atenção: mês anterior abaixo da meta de '+lvl.nome+'. Mais 1 mês assim e você desce para <strong>'+pv.nome+'</strong>.'});
  } else if (pv) {
    infos.push({i:'ti-shield-check',c:'var(--green)',t:'Nível seguro — mês anterior dentro da meta.'});
  }

  var metaInd = v.metaFaturamento != null;
  var metaFat = metaInd ? v.metaFaturamento : (u && u.metaFaturamento != null ? u.metaFaturamento : null);
  var pctMeta = metaFat ? Math.min(100, Math.round(atualData.valor / metaFat * 100)) : 0;
  var faltaMeta = metaFat ? Math.max(0, metaFat - atualData.valor) : 0;
  var metaBatida = !metaFat || (atualData.valor >= metaFat);
  var metaBarra = metaFat
    ? '<div class="meta-bar">'+
        '<div class="meta-bar-hd">'+
          '<span class="meta-bar-label">Meta de faturamento'+(metaInd?' (individual)':' (unidade)')+'</span>'+
          '<span class="meta-bar-val">'+money(atualData.valor)+' / '+money(metaFat)+'</span>'+
        '</div>'+
        '<div class="meta-bar-bg"><div class="meta-bar-fill" style="width:'+pctMeta+'%;background:'+(atualData.valor>=metaFat?'var(--green)':'var(--ka)')+'"></div></div>'+
        '<div class="meta-bar-hint">'+
          (atualData.valor>=metaFat ? '✅ Meta atingida ('+pctMeta+'%)' : '⚠️ Faltam '+money(faltaMeta)+' ('+pctMeta+'%)')+
        '</div>'+
      '</div>'
    : '<div class="meta-bar"><div class="meta-bar-hint" style="font-style:italic">Meta a definir pelo administrador</div></div>';

  var fatHtml = '<div class="fat-sec">'+
    '<div class="fat-title">Faturamento — '+fmtMes(mes)+'</div>'+
    '<div class="fat-grid">'+
      '<div class="fat-card">'+
        '<div class="fat-label">Aparelhos</div>'+
        '<div class="fat-val">'+money(atualData.valorAparelhos)+'</div>'+
        '<div class="fat-qty">'+atualData.aparelhos+' un.</div>'+
      '</div>'+
      '<div class="fat-card serv">'+
        '<div class="fat-label">Serviços</div>'+
        '<div class="fat-val">'+money(atualData.valorServicos)+'</div>'+
        '<div class="fat-qty">'+atualData.servicos+' un.</div>'+
      '</div>'+
      '<div class="fat-card balc">'+
        '<div class="fat-label">Balcão</div>'+
        '<div class="fat-val">'+money(atualData.valorBalcao)+'</div>'+
        '<div class="fat-qty">'+atualData.balcao+' un.</div>'+
      '</div>'+
      '<div class="fat-card total">'+
        '<div class="fat-label">Total</div>'+
        '<div class="fat-val">'+money(atualData.valor)+'</div>'+
        '<div class="fat-qty">'+(atualData.aparelhos+atualData.servicos+atualData.balcao)+' vendas</div>'+
      '</div>'+
    '</div>'+
    metaBarra+
  '</div>';

  var remunHtml = v.isSocio ? '' :
    '<div class="remun-card">'+
    '<div class="remun-title"><i class="ti ti-cash"></i> Remuneração estimada — '+fmtMes(mes)+'</div>'+
    '<div class="remun-row"><span class="remun-label">Salário fixo</span><span class="remun-val">'+money(v.salario)+'</span></div>'+
    '<div class="remun-row"><span class="remun-label">Benefícios</span><span class="remun-val">'+money(v.beneficios)+'</span></div>'+
    '<div class="remun-row"><span class="remun-label">Comissão financeiras ('+pctVal+')</span><span class="remun-val">'+money(commAp)+'</span></div>'+
    '<div class="remun-row"'+(metaBatida?'':' style="opacity:.45"')+'><span class="remun-label">Comissão Balcão (4%)'+(metaBatida?'':' <span style="font-size:11px;color:var(--text3)"><i class="ti ti-lock" style="font-size:11px"></i> libera ao bater a meta</span>')+'</span><span class="remun-val">'+money(commBalc)+'</span></div>'+
    '<div class="remun-row"><span class="remun-total-label">Total estimado</span><span class="remun-total-val">'+money(total)+'</span></div>'+
    '</div>';

  var histInd = histTableHTML(v.id, { excludeCurrent:true, showComissao: !v.isSocio });
  var histHtml = '<div class="fat-sec">'+
    '<div class="fat-title"><i class="ti ti-history" style="color:var(--ka)"></i> Seu histórico mensal</div>'+
    (histInd
      ? histInd
      : '<p style="font-size:12px;color:var(--text2);line-height:1.6;margin:0">Ainda não há meses fechados arquivados. Conforme os meses forem fechando, seu histórico aparece aqui automaticamente.</p>')+
  '</div>';

  g('ind-content').innerHTML =
    '<div class="ind-hero">'+
    '<div class="ind-emb">'+emblemaPorNivel(nivelCalc.nivel, 80)+'</div>'+
    '<div>'+
    '<div class="ind-name">'+v.nome+' · '+u.nome+'</div>'+
    '<div class="ind-lvl">'+lvl.nome+'</div>'+
    '<div class="ind-sub">Nível '+(nivelCalc.nivel+1)+' de 4 · '+pctVal+' de comissão</div>'+
    '</div></div>'+

    '<div class="cards3">'+
    '<div class="icard"><div class="icl">Aparelhos</div><div class="icv">'+atualData.aparelhos+'</div><div class="ics">mês atual</div></div>'+
    '<div class="icard"><div class="icl">Mês anterior</div><div class="icv">'+anteriorData.aparelhos+'</div><div class="ics">aparelhos</div></div>'+
    '<div class="icard"><div class="icl">Meta nível</div><div class="icv">'+(nx?nx.minAp+'+':'Rei ✓')+'</div><div class="ics">'+(gap>0?'faltam '+gap:'na faixa!')+'</div></div>'+
    '</div>'+

    (nx?'<div class="prog-sec">'+
    '<div class="prog-hd"><span class="prog-label">Progressão para '+nx.nome+'</span><span class="prog-count">'+atualData.aparelhos+' / '+nx.minAp+' ap.</span></div>'+
    '<div class="meta-bar-bg"><div class="meta-bar-fill" style="width:'+pct+'%;background:var(--ka)"></div></div>'+
    '<div class="prog-hint">'+(gap>0?'Faltam '+gap+' aparelhos':'Na faixa de '+nx.nome+'! Mantenha para ser promovido.')+'</div>'+
    '</div>':'')+

    fatHtml +
    remunHtml +
    histHtml +

    '<div class="ibox">'+
    '<div class="ibox-t"><i class="ti ti-info-circle"></i> O que você precisa saber</div>'+
    infos.map(function(n){return'<div class="irow"><i class="ti '+n.i+'" style="color:'+n.c+'"></i><span>'+n.t+'</span></div>';}).join('')+
    '</div>';
}

// ========== ACOMPANHAMENTO / HISTÓRICO ==========
function nivelPorAparelhos(ap) {
  var niveis = appData.config.niveis;
  for (var j=niveis.length-1;j>=0;j--){ if(ap>=niveis[j].minAp) return j; }
  return 0;
}

function mesAnteriorStr(mes) {
  var p = mes.split('-'); var y=parseInt(p[0]), m=parseInt(p[1]);
  return m===1 ? (y-1)+'-12' : y+'-'+String(m-1).padStart(2,'0');
}

function snapshotVendedor(atual, isSocio) {
  var idx = nivelPorAparelhos(atual.aparelhos);
  var pct = (appData.config.niveis[idx]||{pct:0}).pct;
  var vAp = Math.round(atual.valorAparelhos);
  var vBalc = Math.round(atual.valorBalcao);
  return {
    aparelhos: atual.aparelhos, servicos: atual.servicos, balcao: atual.balcao,
    valorAparelhos: vAp,
    valorServicos:  Math.round(atual.valorServicos),
    valorBalcao:    vBalc,
    valorTotal:     Math.round(atual.valor),
    nivelIdx: idx,
    comissao: isSocio ? 0 : Math.round(pct * vAp),
    comissaoBalcao: isSocio ? 0 : Math.round(0.04 * vBalc),
    arquivadoEm: new Date().toISOString()
  };
}

// Tabela de histórico reutilizável (admin e dashboard do vendedor)
function histTableHTML(vendedorId, opts) {
  opts = opts || {};
  var hist = appData.historico||{};
  var hv = hist[vendedorId]||{};
  var meses = Object.keys(hv).sort().reverse();
  if (opts.excludeCurrent) { var cm = curMes(); meses = meses.filter(function(m){ return m!==cm; }); }
  if (!meses.length) return null;
  var showC = !!opts.showComissao;
  var niveis = appData.config.niveis;
  var tAp=0,tVa=0,tVs=0,tVb=0,tVt=0,tC=0;
  var trs = meses.map(function(m){
    var s = hv[m];
    var comDev = (s.comissao!=null) ? s.comissao : Math.round(((niveis[s.nivelIdx]||{pct:0}).pct) * (s.valorAparelhos||0));
    var comBal = (s.comissaoBalcao!=null) ? s.comissaoBalcao : 0;
    var com = comDev + comBal;
    tAp+=s.aparelhos; tVa+=s.valorAparelhos; tVs+=s.valorServicos; tVb+=s.valorBalcao; tVt+=s.valorTotal; tC+=com;
    var nivelNome = (niveis[s.nivelIdx]||{nome:'-'}).nome;
    return '<tr>'+
      '<td style="font-weight:700;white-space:nowrap">'+fmtMes(m)+'</td>'+
      '<td><span style="display:inline-flex;align-items:center;gap:6px"><span style="width:22px;height:22px;display:inline-block">'+emblemaPorNivel(s.nivelIdx,22)+'</span>'+nivelNome+'</span></td>'+
      '<td style="text-align:center;font-weight:700">'+s.aparelhos+'</td>'+
      '<td style="white-space:nowrap">'+money(s.valorAparelhos)+'</td>'+
      '<td style="white-space:nowrap">'+money(s.valorServicos)+' <span style="color:var(--text3);font-size:11px">('+s.servicos+')</span></td>'+
      '<td style="white-space:nowrap">'+money(s.valorBalcao)+' <span style="color:var(--text3);font-size:11px">('+s.balcao+')</span></td>'+
      '<td style="font-weight:800;color:var(--ka);white-space:nowrap">'+money(s.valorTotal)+'</td>'+
      (showC ? '<td style="font-weight:700;color:var(--green);white-space:nowrap">'+money(com)+'</td>' : '')+
    '</tr>';
  }).join('');
  var foot = '<tr style="border-top:2px solid var(--border2)">'+
    '<td style="font-weight:800">Total ('+meses.length+'m)</td>'+
    '<td></td>'+
    '<td style="text-align:center;font-weight:800">'+tAp+'</td>'+
    '<td style="font-weight:700">'+money(tVa)+'</td>'+
    '<td style="font-weight:700">'+money(tVs)+'</td>'+
    '<td style="font-weight:700">'+money(tVb)+'</td>'+
    '<td style="font-weight:800;color:var(--ka)">'+money(tVt)+'</td>'+
    (showC ? '<td style="font-weight:800;color:var(--green)">'+money(tC)+'</td>' : '')+
  '</tr>';
  return '<div class="atw" style="overflow-x:auto"><table class="at"><thead><tr>'+
    '<th>Mês</th><th>Nível</th><th>Aparelhos</th><th>R$ Aparelhos</th><th>Serviços</th><th>Balcão</th><th>Total</th>'+
    (showC ? '<th>Comissão</th>' : '')+
    '</tr></thead><tbody>'+trs+foot+'</tbody></table></div>';
}

async function arquivarMes(mes, preData) {
  var data;
  if (preData) { data = preData; }
  else { delete vendaCache[mes]; data = await fetchVendas(mes); }
  if (!data || !data.mesAtual) throw new Error('Sem dados para '+mes);
  if (!appData.historico) appData.historico = {};
  (appData.vendedores||[]).forEach(function(v){
    var atual = getSellerVendas(data.mesAtual, v);
    if (!appData.historico[v.id]) appData.historico[v.id] = {};
    appData.historico[v.id][mes] = snapshotVendedor(atual, v.isSocio);
  });
  await saveData();
}

function onAcompSel(val) { acompSelectedId = parseInt(val); renderAcompanhamento(); }

async function backfillMes() {
  var mes = g('acomp-mes').value;
  var msg = g('acomp-msg');
  if (!mes) { if(msg){msg.className='sync-msg err';msg.style.display='flex';msg.innerHTML='<i class="ti ti-alert-circle"></i> Escolha um mês.';} return; }
  if (msg) { msg.className='sync-msg loading'; msg.style.display='flex'; msg.innerHTML='<i class="ti ti-loader-2 spin"></i> Buscando '+fmtMes(mes)+' no Gestão Click e arquivando...'; }
  try {
    await arquivarMes(mes);
    renderAcompanhamento();
    var m2 = g('acomp-msg');
    if (m2) { m2.className='sync-msg ok'; m2.style.display='flex'; m2.innerHTML='<i class="ti ti-check"></i> '+fmtMes(mes)+' arquivado!'; }
  } catch(e) {
    var m3 = g('acomp-msg');
    if (m3) { m3.className='sync-msg err'; m3.style.display='flex'; m3.innerHTML='<i class="ti ti-alert-circle"></i> Erro: '+e.message; }
  }
}

function renderAcompanhamento() {
  var vendedores = appData.vendedores||[];
  var hist = appData.historico||{};
  if ((acompSelectedId==null || !getVendedor(acompSelectedId)) && vendedores.length) acompSelectedId = vendedores[0].id;
  var v = getVendedor(acompSelectedId);
  var defMes = mesAnteriorStr(curMes());

  var selOpts = vendedores.map(function(x){
    return '<option value="'+x.id+'"'+(x.id===acompSelectedId?' selected':'')+'>'+x.nome+'</option>';
  }).join('');

  var tabela;
  if (!v) {
    tabela = '<p style="font-size:13px;color:var(--text2)">Nenhum vendedor cadastrado.</p>';
  } else {
    var t = histTableHTML(v.id, { showComissao: !v.isSocio });
    tabela = t || '<p style="font-size:13px;color:var(--text2);line-height:1.6">Nenhum mês arquivado ainda para <strong>'+v.nome+'</strong>.<br>Clique em <strong>Sincronizar</strong> (aba Admin) para arquivar o mês atual, ou use o controle acima para buscar um mês passado.</p>';
  }

  g('acomp-content').innerHTML =
    '<div class="admin-section">'+
    '<div class="admin-sec-title"><i class="ti ti-user-search"></i> Acompanhamento por Vendedor</div>'+
    '<label class="fl">Selecione o vendedor</label>'+
    '<select id="acomp-sel" onchange="onAcompSel(this.value)" style="padding:10px 12px;border:1px solid var(--border2);border-radius:8px;font-size:14px;background:var(--bg-card2);color:var(--text);width:100%;max-width:320px;outline:none">'+selOpts+'</select>'+
    '<div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">'+
    '<label class="fl">Arquivar um mês passado (puxa do Gestão Click e congela)</label>'+
    '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">'+
    '<input type="month" id="acomp-mes" value="'+defMes+'" style="padding:9px 12px;border:1px solid var(--border2);border-radius:8px;font-size:14px;background:var(--bg-card2);color:var(--text);outline:none">'+
    '<button class="btn btn-p" onclick="backfillMes()"><i class="ti ti-archive"></i> Buscar e arquivar</button>'+
    '</div>'+
    '<div id="acomp-msg" class="sync-msg" style="margin-top:12px"></div>'+
    '</div>'+
    '</div>'+
    '<div class="admin-section">'+
    '<div class="admin-sec-title"><i class="ti ti-history"></i> Histórico'+(v?' — '+v.nome:'')+'</div>'+
    tabela+
    '</div>';
}

function renderAdmin() {
  var niveis = appData.config.niveis;
  var unidades = appData.unidades;
  var vendedores = appData.vendedores;

  var nivelRows = niveis.map(function(lv) {
    return '<div class="nivel-row">'+
      '<div class="nivel-name"><span style="width:24px;height:24px;display:inline-block">'+emblemaPorNivel(lv.id, 24)+'</span>'+lv.nome+'</div>'+
      '<div><label class="fl">Min ap.</label><input class="ni" type="number" id="nv-min-'+lv.id+'" value="'+lv.minAp+'" min="0"></div>'+
      '<div><label class="fl">Max ap.</label><input class="ni" type="number" id="nv-max-'+lv.id+'" value="'+(lv.maxAp>=9999?'∞':lv.maxAp)+'" '+(lv.id===3?'disabled':'')+'></div>'+
      '<div><label class="fl">Comissão %</label><input class="ni" type="number" id="nv-pct-'+lv.id+'" value="'+(lv.pct*100).toFixed(3)+'" step="0.001" min="0" max="100"></div>'+
    '</div>';
  }).join('');

  var metasUnidadeHtml = unidades.map(function(u) {
    return '<tr><td style="font-weight:600">'+u.nome+'</td>'+
      '<td><div style="display:flex;align-items:center;gap:6px"><span style="color:var(--text3);font-size:13px">R$</span><input type="number" id="meta-u-'+u.id+'" value="'+(u.metaFaturamento||'')+'" placeholder="Sem meta" min="0" step="100" style="width:130px"></div></td></tr>';
  }).join('');

  var vendRows = vendedores.map(function(v) {
    var gcVal = (v.nomesGC||[]).filter(function(n){return n && n.trim();}).join(', ');
    return '<tr>'+
      '<td><input type="text" class="adm-nome" data-id="'+v.id+'" value="'+v.nome+'" style="min-width:130px"></td>'+
      '<td><select class="adm-unit" data-id="'+v.id+'">'+
        unidades.map(function(u2){return'<option value="'+u2.id+'"'+(u2.id===v.unidadeId?' selected':'')+'>'+u2.nome+'</option>';}).join('')+
      '</select></td>'+
      '<td><input type="text" class="adm-gcnomes" data-id="'+v.id+'" value="'+gcVal+'" placeholder="Ex: CYBELLE" title="Nome(s) exato(s) como aparece no Gestão Click. Vários separados por vírgula." style="min-width:180px"></td>'+
      '<td>'+(v.isSocio?'<span class="socio-badge">Sócio</span>':'<input type="number" class="adm-sal" data-id="'+v.id+'" value="'+v.salario+'" min="0" style="width:90px">')+'</td>'+
      '<td>'+(v.isSocio?'—':'<input type="number" class="adm-ben" data-id="'+v.id+'" value="'+v.beneficios+'" min="0" style="width:80px">')+'</td>'+
      '<td><div style="display:flex;align-items:center;gap:4px"><span style="color:var(--text3);font-size:12px">R$</span><input type="number" class="adm-meta" data-id="'+v.id+'" value="'+(v.metaFaturamento||'')+'" placeholder="—" min="0" step="100" style="width:100px"></div></td>'+
      '<td><button class="btn btn-g" onclick="resetPin('+v.id+')" style="font-size:12px;padding:6px 10px"><i class="ti ti-refresh" style="font-size:13px"></i> 1234</button></td>'+
      '<td><button class="del-btn" onclick="deleteVendedor('+v.id+')" title="Remover"><i class="ti ti-trash"></i></button></td>'+
    '</tr>';
  }).join('');

  g('admin-content').innerHTML =
    '<div class="admin-section">'+
    '<div class="admin-sec-title"><i class="ti ti-refresh"></i> Sincronização</div>'+
    '<div id="sync-msg" class="sync-msg"></div>'+
    '<p style="font-size:13px;color:var(--text2);margin-bottom:14px">Clique para buscar os dados do mês atual no Gestão Click e recalcular os níveis de todos os vendedores.</p>'+
    '<button class="btn btn-p" onclick="syncGestaoClick()"><i class="ti ti-cloud-download"></i> Sincronizar com Gestão Click</button>'+
    '</div>'+

    '<div class="admin-section">'+
    '<div class="admin-sec-title"><i class="ti ti-stairs-up"></i> Configuração dos Níveis</div>'+
    nivelRows+
    '<div class="btn-row"><button class="btn btn-p" onclick="saveNiveis()"><i class="ti ti-device-floppy"></i> Salvar níveis</button></div>'+
    '</div>'+

    '<div class="admin-section">'+
    '<div class="admin-sec-title"><i class="ti ti-target"></i> Meta de Faturamento por Unidade</div>'+
    '<p style="font-size:12px;color:var(--text2);margin-bottom:14px">Valor total em R$ que cada unidade precisa faturar no mês (aparelhos + serviços + balcão).</p>'+
    '<div class="atw"><table class="at"><thead><tr><th>Unidade</th><th>Meta mensal (R$)</th></tr></thead><tbody>'+metasUnidadeHtml+'</tbody></table></div>'+
    '<div class="btn-row"><button class="btn btn-p" onclick="saveMetasUnidade()"><i class="ti ti-device-floppy"></i> Salvar metas</button></div>'+
    '</div>'+

    '<div class="admin-section">'+
    '<div class="admin-sec-title"><i class="ti ti-users"></i> Vendedores</div>'+
    '<p style="font-size:12px;color:var(--text2);margin-bottom:14px">O campo <strong>Nome no GC</strong> deve ter o nome <em>exato</em> do vendedor como aparece nas vendas do Gestão Click. Se o vendedor usa mais de um nome (ex: sócio que vende em 2 lojas), separe por vírgula.</p>'+
    '<div class="atw" style="overflow-x:auto"><table class="at"><thead><tr>'+
    '<th>Nome</th><th>Unidade</th><th>Nome no GC</th><th>Salário</th><th>Benefícios</th><th>Meta R$</th><th>PIN</th><th></th>'+
    '</tr></thead><tbody id="vend-tbody">'+vendRows+'</tbody></table></div>'+
    '<div class="btn-row">'+
    '<button class="btn btn-g" onclick="addVendedor()"><i class="ti ti-user-plus"></i> Adicionar</button>'+
    '<button class="btn btn-p" onclick="saveVendedores()"><i class="ti ti-device-floppy"></i> Salvar vendedores</button>'+
    '</div></div>'+

    '<div class="admin-section">'+
    '<div class="admin-sec-title"><i class="ti ti-lock"></i> Alterar PIN do Admin</div>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">'+
    '<div><label class="fl">Novo PIN</label><input type="password" id="adm-pin1" class="fi" maxlength="4" placeholder="••••"></div>'+
    '<div><label class="fl">Confirmar</label><input type="password" id="adm-pin2" class="fi" maxlength="4" placeholder="••••"></div>'+
    '</div>'+
    '<div id="adm-pin-err" style="color:var(--red);font-size:12px;margin-bottom:8px;min-height:16px"></div>'+
    '<button class="btn btn-p" onclick="saveAdminPin()"><i class="ti ti-device-floppy"></i> Salvar PIN admin</button>'+
    '</div>';
}

async function saveNiveis() {
  appData.config.niveis.forEach(function(lv) {
    var min = parseInt(g('nv-min-'+lv.id).value)||0;
    var pct = parseFloat(g('nv-pct-'+lv.id).value)||lv.pct*100;
    lv.minAp = min;
    lv.pct = pct/100;
    if (lv.id < 3) {
      var maxEl = g('nv-max-'+lv.id);
      if (maxEl && !maxEl.disabled) lv.maxAp = parseInt(maxEl.value)||lv.maxAp;
    }
  });
  await saveData();
  alert('Níveis salvos!');
}

async function saveMetasUnidade() {
  appData.unidades.forEach(function(u) {
    var el = g('meta-u-'+u.id);
    u.metaFaturamento = el && el.value ? parseFloat(el.value) : null;
  });
  await saveData();
  alert('Metas por unidade salvas!');
}

function addVendedor() {
  var maxId = appData.vendedores.length ? Math.max.apply(null, appData.vendedores.map(function(v){return v.id;})) : 0;
  var newV = {
    id: maxId+1, nome:'Novo Vendedor', nomesGC:[''], unidadeId:1,
    isSocio:false, salario:1722, beneficios:200,
    pin:'03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4',
    pinInicial:true, metaFaturamento:null, nivelAtual:1, mesesAcima:0, mesesAbaixo:0
  };
  appData.vendedores.push(newV);
  renderAdmin();
  var tbody = g('vend-tbody');
  tbody.lastElementChild.querySelector('input[type=text]').focus();
}

async function deleteVendedor(id) {
  if (!confirm('Remover este vendedor?')) return;
  appData.vendedores = appData.vendedores.filter(function(v){return v.id!==id;});
  await saveData(); renderAdmin();
}

async function resetPin(id) {
  var v = getVendedor(id);
  if (!v) return;
  v.pin = '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4';
  v.pinInicial = true;
  await saveData();
  alert('PIN de '+v.nome+' redefinido para 1234.');
}

async function saveVendedores() {
  document.querySelectorAll('[class*=adm-nome]').forEach(function(el) {
    var id = parseInt(el.dataset.id), v = getVendedor(id);
    if (v) v.nome = el.value.trim();
  });
  document.querySelectorAll('[class*=adm-unit]').forEach(function(el) {
    var id = parseInt(el.dataset.id), v = getVendedor(id);
    if (v) v.unidadeId = parseInt(el.value);
  });
  document.querySelectorAll('[class*=adm-gcnomes]').forEach(function(el) {
    var id = parseInt(el.dataset.id), v = getVendedor(id);
    if (v) {
      var lista = el.value.split(',').map(function(s){return s.trim();}).filter(function(s){return s;});
      v.nomesGC = lista.length ? lista : [''];
    }
  });
  document.querySelectorAll('[class*=adm-sal]').forEach(function(el) {
    var id = parseInt(el.dataset.id), v = getVendedor(id);
    if (v) v.salario = parseInt(el.value)||0;
  });
  document.querySelectorAll('[class*=adm-ben]').forEach(function(el) {
    var id = parseInt(el.dataset.id), v = getVendedor(id);
    if (v) v.beneficios = parseInt(el.value)||0;
  });
  document.querySelectorAll('[class*=adm-meta]').forEach(function(el) {
    var id = parseInt(el.dataset.id), v = getVendedor(id);
    if (v) v.metaFaturamento = el.value ? parseFloat(el.value) : null;
  });
  await saveData();
  vendaCache = {};
  alert('Vendedores salvos!');
  renderAdmin();
}

async function saveAdminPin() {
  var p1 = g('adm-pin1').value, p2 = g('adm-pin2').value;
  g('adm-pin-err').textContent = '';
  if (p1.length!==4||!/^\d+$/.test(p1)){g('adm-pin-err').textContent='PIN deve ter 4 dígitos';return;}
  if (p1!==p2){g('adm-pin-err').textContent='PINs não coincidem';return;}
  appData.adminPin = await sha256(p1);
  await saveData();
  alert('PIN admin alterado!');
}

async function syncGestaoClick() {
  var msg = g('sync-msg');
  msg.className='sync-msg loading';
  msg.innerHTML='<i class="ti ti-loader-2 spin"></i> Buscando dados do Gestão Click...';
  msg.style.display='flex';
  try {
    var mes = curMes();
    var niveis = appData.config.niveis;
    vendaCache = {};
    var data = await fetchVendas(mes);
    appData.vendedores.forEach(function(v) {
      var atualData    = getSellerVendas(data.mesAtual, v);
      var anteriorData = getSellerVendas(data.mesAnterior, v);
      var nivelCalc = calcNivel(v, atualData, anteriorData, mes);
      v.nivelAtual = nivelCalc.nivel;
      var lvl = niveis[v.nivelAtual]||niveis[0];
      var nx  = niveis[v.nivelAtual+1];
      v.mesesAcima  = (nx && atualData.aparelhos >= nx.minAp) ? (v.mesesAcima||0)+1 : 0;
      v.mesesAbaixo = (atualData.aparelhos < lvl.minAp) ? (v.mesesAbaixo||0)+1 : 0;
      if (!appData.historico) appData.historico = {};
      if (!appData.historico[v.id]) appData.historico[v.id] = {};
      appData.historico[v.id][mes] = snapshotVendedor(atualData, v.isSocio);
    });
    await saveData();
    msg.className='sync-msg ok';
    msg.innerHTML='<i class="ti ti-check"></i> Sincronização concluída! Níveis recalculados.';
  } catch(e) {
    msg.className='sync-msg err';
    msg.innerHTML='<i class="ti ti-alert-circle"></i> Erro: '+e.message;
  }
}

// Suporte a teclado físico (notebook): captura 0-9 e Backspace nas telas de PIN
document.addEventListener('keydown', function(e) {
  var loginEl = g('screen-login');
  var changeEl = g('screen-changepin');
  var pinStepEl = g('pin-step');
  var loginVisible = loginEl && loginEl.style.display === 'flex';
  var changeVisible = changeEl && changeEl.style.display === 'flex';
  var pinStepVisible = pinStepEl && pinStepEl.style.display === 'block';

  if (loginVisible && pinStepVisible) {
    if (e.key >= '0' && e.key <= '9') { pinKey(e.key); e.preventDefault(); }
    else if (e.key === 'Backspace') { pinDel(); e.preventDefault(); }
  } else if (changeVisible) {
    if (e.key >= '0' && e.key <= '9') { changePinKey(e.key); e.preventDefault(); }
    else if (e.key === 'Backspace') { changePinDel(); e.preventDefault(); }
  }
});

async function init() {
  showScreen('login');
  await loadData();
  renderLoginList();
}
init();
</script>
</body>
</html>
`;

// ========== PWA ASSETS ==========
const ICON_192 = "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";
const ICON_512 = "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";
const ICON_180 = "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";
const MANIFEST = '{"name":"King Alfa — Níveis","short_name":"King Níveis","description":"Programa de Níveis — Grupo King Alfa","start_url":"/","scope":"/","display":"standalone","orientation":"portrait","background_color":"#0A0A0A","theme_color":"#0A0A0A","lang":"pt-BR","icons":[{"src":"/icon-192.png","sizes":"192x192","type":"image/png","purpose":"any"},{"src":"/icon-512.png","sizes":"512x512","type":"image/png","purpose":"any"},{"src":"/icon-512.png","sizes":"512x512","type":"image/png","purpose":"maskable"}]}';
const SW_JS = `const CACHE='kingalfa-v1';
const SHELL=['/','/icon-192.png','/icon-512.png','/manifest.webmanifest'];
self.addEventListener('install',function(e){e.waitUntil(caches.open(CACHE).then(function(c){return c.addAll(SHELL);}).then(function(){return self.skipWaiting();}));});
self.addEventListener('activate',function(e){e.waitUntil(caches.keys().then(function(ks){return Promise.all(ks.filter(function(k){return k!==CACHE;}).map(function(k){return caches.delete(k);}));}).then(function(){return self.clients.claim();}));});
self.addEventListener('fetch',function(e){
  var url=new URL(e.request.url);
  if(e.request.method!=='GET')return;
  if(url.pathname.indexOf('/api/')===0)return; // vendas sempre via rede, nunca cache
  if(e.request.mode==='navigate'){
    e.respondWith(fetch(e.request).then(function(r){var cp=r.clone();caches.open(CACHE).then(function(c){c.put('/',cp);});return r;}).catch(function(){return caches.match('/');}));
    return;
  }
  e.respondWith(caches.match(e.request).then(function(c){return c||fetch(e.request);}));
});`;
function pngResponse(b64){
  var bin=atob(b64), len=bin.length, bytes=new Uint8Array(len);
  for(var i=0;i<len;i++)bytes[i]=bin.charCodeAt(i);
  return new Response(bytes,{headers:{'Content-Type':'image/png','Cache-Control':'public,max-age=2592000'}});
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = {'Access-Control-Allow-Origin':'*','Content-Type':'application/json'};

    if (url.pathname === '/api/vendas') {
      if (request.method === 'OPTIONS') return new Response(null, {headers:cors});
      const mes = url.searchParams.get('mes');
      const debugParam = url.searchParams.get('debug');
      if (!mes) return new Response(JSON.stringify({error:'mes obrigatorio'}),{status:400,headers:cors});

      if (debugParam === '2') {
        const filtro = (url.searchParams.get('vendedor')||'').trim().toLowerCase();
        const [d1,d2,d3] = await Promise.all([
          fetchVendasMes(mes, LOJAS[0].id, env),
          fetchVendasMes(mes, LOJAS[1].id, env),
          fetchVendasMes(mes, LOJAS[2].id, env),
        ]);
        const todas = [...d1, ...d2, ...d3];
        const situacoes = {};
        todas.forEach(function(v){
          const s = (v.nome_situacao||'(vazio)');
          if (!situacoes[s]) situacoes[s] = { qtd:0, valor:0, contaNoApp: !!classify(s, v.__tipoGC) };
          situacoes[s].qtd++;
          situacoes[s].valor += parseFloat(v.valor_total||0);
        });
        Object.keys(situacoes).forEach(function(k){ situacoes[k].valor = Math.round(situacoes[k].valor); });
        const roster = {};
        todas.forEach(function(v){
          const id = v.vendedor_id || '(sem_id)';
          if (!roster[id]) roster[id] = { nomes:{}, aparelhos:0, servicos:0, balcao:0, valor:0, ignoradas:0 };
          const nm = (v.nome_vendedor||'(sem_nome)');
          roster[id].nomes[nm] = (roster[id].nomes[nm]||0)+1;
          const tipo = classify(v.nome_situacao||'', v.__tipoGC);
          if (!tipo) { roster[id].ignoradas++; return; }
          if (tipo==='aparelho') roster[id].aparelhos++;
          else if (tipo==='servico') roster[id].servicos++;
          else if (tipo==='balcao') roster[id].balcao++;
          roster[id].valor += parseFloat(v.valor_total||0);
        });
        Object.keys(roster).forEach(function(id){
          roster[id].valor = Math.round(roster[id].valor);
          roster[id].nomes = Object.keys(roster[id].nomes);
        });
        let vendedor = null;
        if (filtro) {
          const matches = todas.filter(function(v){ return (v.nome_vendedor||'').toLowerCase().includes(filtro); });
          let totalTudo = 0, totalConcretizada = 0;
          matches.forEach(function(v){
            const val = parseFloat(v.valor_total||0);
            totalTudo += val;
            const s = (v.nome_situacao||'').trim().toUpperCase();
            if (s.startsWith('CONCRETIZADA')) totalConcretizada += val;
          });
          vendedor = {
            filtro: filtro,
            qtdVendas: matches.length,
            valorTodasSituacoes: Math.round(totalTudo),
            valorSoConcretizada_oQueOAppConta: Math.round(totalConcretizada),
            diferenca: Math.round(totalTudo - totalConcretizada),
            nomesEncontrados: [...new Set(matches.map(function(v){ return v.nome_vendedor; }))],
            vendas: matches.map(function(v){ return {
              tipoGC: v.__tipoGC,
              situacao: v.nome_situacao,
              valor: v.valor_total,
              nome_vendedor: v.nome_vendedor,
              vendedor_id: v.vendedor_id
            };})
          };
        }
        return new Response(JSON.stringify({
          tokensConfigurados: { access: !!env.GC_ACCESS_TOKEN, secret: !!env.GC_SECRET_TOKEN },
          totalVendas: todas.length,
          situacoes: situacoes,
          roster: roster,
          vendedor: vendedor
        }, null, 2), {headers:cors});
      }

      try {
        const [y,m] = mes.split('-').map(Number);
        const mesAnt = m===1 ? (y-1)+'-12' : y+'-'+String(m-1).padStart(2,'0');
        const [v1,v2,v3,a1,a2,a3] = await Promise.all([
          fetchVendasMes(mes, LOJAS[0].id, env),
          fetchVendasMes(mes, LOJAS[1].id, env),
          fetchVendasMes(mes, LOJAS[2].id, env),
          fetchVendasMes(mesAnt, LOJAS[0].id, env),
          fetchVendasMes(mesAnt, LOJAS[1].id, env),
          fetchVendasMes(mesAnt, LOJAS[2].id, env),
        ]);
        const atual = [...v1,...v2,...v3];
        const ant   = [...a1,...a2,...a3];
        const gAtual = group(atual);
        const gAnt   = group(ant);
        return new Response(JSON.stringify({
          success: true,
          mesAtual:    { mes,         vendas: gAtual.vendas, indexNomes: gAtual.indexNomes },
          mesAnterior: { mes: mesAnt, vendas: gAnt.vendas,   indexNomes: gAnt.indexNomes },
        }),{headers:cors});
      } catch(e) {
        return new Response(JSON.stringify({error:e.message}),{status:500,headers:cors});
      }
    }

    if (url.pathname === '/manifest.webmanifest') {
      return new Response(MANIFEST, {headers:{'Content-Type':'application/manifest+json','Cache-Control':'public,max-age=86400'}});
    }
    if (url.pathname === '/sw.js') {
      return new Response(SW_JS, {headers:{'Content-Type':'application/javascript','Cache-Control':'no-cache'}});
    }
    if (url.pathname === '/icon-192.png') return pngResponse(ICON_192);
    if (url.pathname === '/icon-512.png') return pngResponse(ICON_512);
    if (url.pathname === '/apple-touch-icon.png' || url.pathname === '/icon-180.png') return pngResponse(ICON_180);

    return new Response(HTML, {headers:{'Content-Type':'text/html;charset=UTF-8'}});
  }
};
