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
<title>KING ALFA NÍVEIS</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.19.0/dist/tabler-icons.min.css">
<meta name="theme-color" content="#0A0A0A">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="KING ALFA NÍVEIS">
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
.ind-emb{width:104px;height:104px;flex-shrink:0;border-radius:50%;display:flex;align-items:center;justify-content:center;overflow:hidden;background:radial-gradient(circle at 50% 28%,#2c2c2c 0%,#0d0d0d 76%);border:3px solid var(--ka);box-shadow:0 6px 22px rgba(240,120,0,.45),inset 0 0 14px rgba(0,0,0,.65)}
.ind-emb img{width:100%!important;height:100%!important;object-fit:contain;padding:14px;box-sizing:border-box}
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
  .ind-emb{width:84px;height:84px;border-width:2px}
  .ind-emb img{padding:11px}
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
function embImg(src, size) {
  size = size || 48;
  return '<img src="'+src+'" width="'+size+'" height="'+size+'" alt="" loading="lazy" style="display:block;object-fit:contain">';
}
function emblemaEscudeiro(size){ return embImg('/emb-escudeiro.png', size); }
function emblemaCavaleiro(size){ return embImg('/emb-cavaleiro.png', size); }
function emblemaDuque(size){ return embImg('/emb-duque.png', size); }
function emblemaRei(size){ return embImg('/emb-rei.png', size); }

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
const EMB_ESCUDEIRO = "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";
const EMB_CAVALEIRO = "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";
const EMB_DUQUE = "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";
const EMB_REI = "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";
const ICON_192 = "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";
const ICON_512 = "iVBORw0KGgoAAAANSUhEUgAAAgAAAAIACAYAAAD0eNT6AABzaElEQVR4nO3deXxkR3Uv8N+put3S7Lvt8TLjZWzANl4w+/I8NsszS8IWDWEJCYTAg4QEQshGQCMIeSGEBCfBLzYQx4HgIBkwhGAIJpZZjLENtsErXsaexbOv0kjqvrfqvD/ure7bV90ajUeamav5ff2RJfV6u3Wn69SpU1UAEREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREREdERI0f6AIiONqoqAGRwcNCsXr36SB8OHaKBgQHt6elREVEAeqSPh4iIjh7S399vVTXKGn+aoVTVZl/8O9Mxj/8I6JilqjI4OGgvvfTSRLXZMfzKV76y3Ht/0hlnnHH+WWedtXjfvn3dw8PD3cYY8d4jiiIPAN77Cf/9eEBUVUz2u4ioB2BytzHGqPc+fBdj0muLj11ssETEF55OsscZd1sPiAE03CH//Jr2igF4mNw1qirSuK71+fOXewCSXZe/vCh/f1VVY0zb2+bfg+JD5K8vHo+qSuK9UVUDANVqtbZ44cLhXbt2jd59990PnnrqqQ9fdNFFGwGM5Y7Dpm/BuPeS6JgQHekDIDrcssbDiIgDkACQm2666TkrVqx4+eLFiy9V1fO7urrmzZ49GwAwZ86cI3m4dAgWLVqEU045BbVazW/duvWher3+03379n2jv7//uyKyCwBU1axduxZ9fX0MBOiYwgwAHVNU1WYNP/7xH//xxFe84hW/vnDhwjd3d3c/IzT4AOC9BwCnWWog+x0AICIQmfw/HRFBPsMwVQ71cfP3b/dY4TXmLw+v+lBejaq2vIfh9+JzHfTjet84rpBFyB7XqKqx1jZuu2fPni0jIyNf37179z+fe+65d2XPbbNsAOsE6JjAAICOCaGwT0T8FVdccdxll132vsWLF//OggULlgJAkiRQ1QSAmJTkG/l8ABC0CwRaGstCAxeuK96m2CAWHyvfQLb7vXifJxuctLtvu+MOjWvxdYWfOx1Dp0a+eL8D3T//GPnHDH+j8F4WrlPvvWo6toFKpWIBoFarud27d/ffddddH3/5y19+r4jAe284LEDHAgYANOPle/33/Pyed56y8pS18+fPXw4A3vsE6bC4yW7baDiK30MjFTyZAKBTY158nGLAMVGjfqCe+0QNZ6fHKN7mQI07kH6YFB+lGDSEy/KPN5njLh5X/r7t7le8rHj7LBBwqhpZazE0NFTbuXPnJ9797nf/1be//e3aTTfdFF1yySVJ2wMgmiEYANCMpqqRiCRXXXXVya96+Sv/3/KTT3wVADjnEhGxxpjWgjnvQ2OhIqLWWp+/DmhtzDrx3qcRhTFppVx6KSbRrRQAtl0gEn4uNtbt0vgtjacqBAIIkL9r2mA3r4OmDbiiTSYgu7OG+6kivVvzvvnvOv641BjjGu9N9h4658YfL9q/x+2yMI3bt7tEPRL1BmlWJxQqjrulqjpVtdZa7N69+yd33333Oy655JJ78oEj0UzEAIBmrND433vvvS9fvnz55xYtWnRivV5PANgoirIUvyDfQXbO+7S9ksjaI/fPwzk3ruEP34u98HzqO2+iGoF2Pe9w+UT1AMX7t+2lqwKF4zyYYYmplgV1LjuOxthO/nVmQwSuUqlEIyMjI4888sjvnXfeeVdnMwX8RDMciMqKAQDNSKH3duutt77zggsu+H9dXV0mjuNERCKgdZw4K/RzxpjGrJiRkbFk165dj86ePfsB75N4dHQ0EZHGOHJ4DADIpgeGf0vee++SJPHpYWh4fO+9bzQi2VQ2TZIkNExijIm6uroWLFu27JWzZ8+ehXSKmmSvp21qO/d6D7qR7dSITxQ4dMpA5OsCCml/BSDDw8N79u7d+930JSdJkiQuO+bQOxdjDIwxFoXPpex2qqqiqj5JksR773wa+Wh2fysp773HggULFlQqlWh4ePj0JUuWnDVnzpyu8Hjee5fdx4SMTzb2D1V1URRZEcH69es/uXLlyj9mEEBEVBKqGgHArbfe+n7vvTrnfNbgqHNOkyTRJEk0jmON4zjRzNDQUH3Dhg3/ef/997/zuuu+8VQAXQd4qmmxYcOG9dmxOs1xzmkoZsv/fDBfne6nqge8X/5wJvNc4bBVVR955JE7j8R7CcB+8YtfXHn//fe/edOmTV/et2/frnBg9Xo9iePYh9eWJEl4nd45F6uqbt++/e+B5jlFRERHqfBBfcstt7wra7AS51yjNQoNab1ed3Ece1XVPXv2bH3ooYf+7/XXX392m8cLKwRO69cdd9xRUdXooosuWrBhw4Z1IQDINaQtDfFkG/v87SdquPO3Kz5+8ff8sRRvE67L3capqq5bt+4Xl19+eVf+tR6GL1vMbnzuc5878f777//g9u3b16mqJkmi9XrdFd/XLCCoq6o+8MADvflzi4iIjjL9/f0WAH7+8/teOjIy4p1zSWjk8w1pkiSJquro6Kg+9thjV3z6058+PjyGqhpVjXp7ew0O7xBZeK45GzZseDQ7zpYAIB/AFBv3dr3v4vUHCgCSJGnbwOefKx+MTBQ8hNuEzMu6devuARCF4ffD+b729vaam266KdI0lQ8AeOc737ngl7/8Ze++fftGVVXjOI4LmYuQOYpHR0f1rrvu+hWgsXogEREdLXp7e42qSn9//wk7duzcoqp+bKzm4jjRJHH5RjFWVd29e/fDt99++0vD/XON/hGhzaVt561fv/7xdgHAZFL17Rr7J5v2Lz73gYYVitmG7P12qqqPP/74fQCqRyAAGPc+53vyN9544zO2bt16Rzg3iq+rXq87VfU7d+7c/cUvfnFlVgNxxM4TIiIqCD2zTZs23aCqWqvVknSsP26M+dfr9VhVdc+ePT/o7e09LrvfUbEBUD4A2LhxYyMAmKi3faAGebK/TybdP5n7tjs+zWoAsgxA5UgHAEE+EPjABz4wZ9OmTddlQUCSz3gkSaK1Wi1RVd22bduPANiQaSIioiPspptuigDg3nvvfXvWcMb5xijf+O/du/fGD3zgA3Py9ztKhE1woq1bt94Tes/FFHyxh92pV98uUCjePu9Avf92wwnt7l8oplNVdd573bhx4x3A5NZQOJz6+/sbdQIPPvjgZ1TT4YA4bgaOWcForKp6//33/z7AoQAioiMu68nJFVdcsWjv3r1bsh6nK6RxE1XVnTt3Dn7qU5+adbSmcUOjsn79+i+rqg8p6fzMhQM1wJ166xPdrlOQ0C4AKNYCtHvM/PEmSRKrql+3bt1ns9d4NAVdABrDRxYA1q1bd52q6tjYWBICmVwmww0NDe244oorjlNVOZJDRkREx7xco/kXofcWGqUsG+BU1W/fvv2Jj3/848uAZrHg0Sa8lv/+7/9+Rdb4xMXGdzLp93YV+arNaYTtMgnFXnyn4KFT5X+7YCGbZhmPjo7qDTfc8Dzg6H3vsyDAXH311d1btmy5IzuXikWYsarqI4888n+BozOYISI6JoTef39//+K9e/duzeZvN6r+s8Yoqdfreuutt74MOOrS/uNkmQlZt27djaqq9XSO2rje/2TH79v10jsFAMUGvN1jdQoi2g0/1Ov1mqrqQw899MXstR2VjX8QgpOvfe1rTx8dHR3RbApp7n3zqur37du348orr1wazr8jfdxERMec0AO75557fjffQwvtVZjut2HDhqM2/VwUZjNce+21p+zcufORrCdaD9X0xR55cWigXaNebKAPNN7f6THaBRJtbhumX8aqqjt27PjFpz71qcWaTq886hvLcI788pe//EgW8CT5wCYb0tD77rvv/fnbExHRYaRp799u27btztDwpL1PH1Zz83v37t1++eWXLytLAwQ0sgD4t3/7t9N27tz509CyZr3qkFrXer2uY2NjOjo6qrVaTev1esv14Tbhq1artVwXri/+XHyMdrcbGxtrPGf+8rwtW7bccOONNx4PpIHNkX1XJ0fTXr3p7e2dvXfv3vWq6jWbyeC91ziOnarq9u3b7+nt7Q0zSEpxXhERzQihkbz55pufMTY2pkmS+HSJeK/O+UYtwLp16z6R3b5UPbXw+pYvXz77l7/85Yf37Nnzi127dvl8Y55v9Ds1/MXbFW9Tq9XaNubF4KHTfcNXeIwdO3YM7dix43/uueeeN4fXUpbGPwjnyv333/9HxSxAGAqo1Wr6wx/+8KiuayA6kFJ9KBLlGAB+6dKlL+7q6kK9XnfW2khVoQoVkWj//v31xx577LNZL20SO/EePUTE9/b2mr6+vpGzzjrrYwA+fscdd5x12mmnTce/2bCZ7yH77ne/u/eNb3zjBqC5toGIlOq9B+BUVa66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AGaEG264Yfmdd975mvXr11+5Z8+eJ8Lfe2xsLMmP94fhopAhGhsbG7v33ntfDnD9CJqZ+AFHM9JNN90UXXLJJcmtt976orPOOusrixYtWhbHcWKMiUTS0z58z3Z389baRg9v7969Y8PDw/ctXrz48Y0bN+7cvXv3NhFRAKrpHHHvvVcR8SJijDGNbWGz20FVRUSM914AaOH+inRfec0dthER8d4jux7WWlFVKyKhKyvZMaNw3yA8d7hOVVWNMfDepxsoZMcYdrgD0mxHkF2uACRcnr224msMryl/m/DehsfXcCySMtlrkdx12rxaNPt7tDxOlo0Z93nlvU8fNL1eRcQnSYJFixadeMoppxw3NDR00qxZs85esGDBnHAf55zLnt9kz4Hm24XEWhsNDQ3t3rhx4xvOPvvs72q6NXDS5r0mIqKjUei1XXPNNWft3LnzLtV0adc4jlsWeMnxSZIk9Xq9OCRMJZckiXPOxelq0c39IkLPv1aruVDwt2fPnruuvfbap+XPIaKZiBkAmtE07T27N7/5zfM/+tGPfnLFihXvjKIIzrlERKwxJu1Rq8/6zo0tX1VV1VrrD/D44y4LPcqQYeh0v07X5x8zf5t2l4fL2v1evC5kAdo9VvF+xWMrPla7Y2p3zAd6fcVjLz7/gd6ndq8zXJe9VjEpaffaskDARVEUqSo2bNjwL1dcccUffuITn9gbzp0JXwxRiTEAoBlP05XePADcddddr1q5cuUnFy5c+FQA8M4lgBiFikAky0ZDjHRsGNs1ennFxjh//4luM9FjtbvtwT5msWHNp/0nCmQO9NgHek8mChpEJAxNtG38i8deaLzHPX7+vuErf3nueq+q3lobAcC+PXseefSxxz544YUXfi27vnHOEM1UnNJCM56IeM2mgl1wwQXf/MhHPvKcTZs2/cW+ffueMNZGxhrjvRfvfaIKZwRabNSycfmWRqfdF3DghjrcJt+otWvo841Ypx548bIDBRT5+4TXlH+uiXR6De3uV2y8272OiXr27Rr/4m3yQUO715f/ytL9znufuLSmwFhro7179255/PHHe//u059+5oUXXvg1zVaVZONPxwJmAOiY0t/fb9esWeMA4JOf/ORxr33ta9+0aPGiN3V3dT9r9uzZAACvCk0L/JwxBs65loYrVys4TggQ8un20NOe6Lr8/YuXtbtvu9vkb9dOm0K/ccfW6fadjm2i4+302BMdx4Eubyf/9wGaf6PccIcFIOHvNjIygrFa7c79w8Nf+upXv/qF973vfVvD7Zjyp2MJAwA65mhaTW7yH/a33HLLs4874bhfnT9vwaXVruqF8+bM7Z5M40NHP1XF0NDQaBzHd+4f2v+9dY+vu2H16tU/ARCmKVgAPj+jgehYwACAjlmqKoODg/bSSy9N8j3IW2+99eStW7ee9ZznPOeCer0+b2hoaJ73vor034uE+4bbi4jm7t+YLpdvULJhCLRpZDo1OuP+bWaPmf8dIqLGGM2mJDam5jnnTHZjE+5rjJFsvD1MFWw+WW66Xafj6ZBqD9P4ADQyFOH1I5vWOO49QzoF0ucuL77elsdt85zj3p7ssYyIaBRFIwsWLBgCMHLHHXfcfdxxxz343Oc+d2PuMfA///M/0erVqx0bfiKiY5dkY7/cD2AGy+pAomxFP/6d6ZjHOa5EzQVtPJDuKXDOOedIT09PS4/1yBwaPUmNv93AwIDee++9mhX2cUEfIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiKiI+//A79eKUsGBL0aAAAAAElFTkSuQmCC";
const ICON_180 = "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";
const MANIFEST = '{"name":"KING ALFA NÍVEIS","short_name":"King Níveis","description":"Programa de Níveis — Grupo King Alfa","start_url":"/","scope":"/","display":"standalone","orientation":"portrait","background_color":"#0A0A0A","theme_color":"#0A0A0A","lang":"pt-BR","icons":[{"src":"/icon-192.png","sizes":"192x192","type":"image/png","purpose":"any"},{"src":"/icon-512.png","sizes":"512x512","type":"image/png","purpose":"any"}]}';
const SW_JS = `const CACHE='kingalfa-v3';
const SHELL=['/','/icon-192.png','/icon-512.png','/manifest.webmanifest','/emb-escudeiro.png','/emb-cavaleiro.png','/emb-duque.png','/emb-rei.png'];
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
    if (url.pathname === '/emb-escudeiro.png') return pngResponse(EMB_ESCUDEIRO);
    if (url.pathname === '/emb-cavaleiro.png') return pngResponse(EMB_CAVALEIRO);
    if (url.pathname === '/emb-duque.png') return pngResponse(EMB_DUQUE);
    if (url.pathname === '/emb-rei.png') return pngResponse(EMB_REI);
    if (url.pathname === '/icon-192.png') return pngResponse(ICON_192);
    if (url.pathname === '/icon-512.png') return pngResponse(ICON_512);
    if (url.pathname === '/apple-touch-icon.png' || url.pathname === '/icon-180.png') return pngResponse(ICON_180);

    return new Response(HTML, {headers:{'Content-Type':'text/html;charset=UTF-8'}});
  }
};
