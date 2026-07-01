const GC_BASE = 'https://api.gestaoclick.com';
const JSONBIN_ID = '6a3bdd8bf5f4af5e292909de'; // ID do bin (nao e segredo); a chave vem de env.JSONBIN_KEY
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
      items.forEach(function(v){ v.__tipoGC = tipo; v.__lojaId = String(lojaId); });
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
    if (!r[id]) r[id] = {aparelhos:0, servicos:0, balcao:0, valor:0, valorAparelhos:0, valorServicos:0, valorBalcao:0, nomes:{}, porLoja:{}};
    const valor = parseFloat(v.valor_total||0);
    const lj = v.__lojaId || '';
    if (!r[id].porLoja[lj]) r[id].porLoja[lj] = {aparelhos:0, servicos:0, balcao:0, valor:0, valorAparelhos:0, valorServicos:0, valorBalcao:0};
    const pl = r[id].porLoja[lj];
    if (tipo==='aparelho') { r[id].aparelhos++; r[id].valorAparelhos += valor; pl.aparelhos++; pl.valorAparelhos += valor; }
    else if (tipo==='servico') { r[id].servicos++; r[id].valorServicos += valor; pl.servicos++; pl.valorServicos += valor; }
    else if (tipo==='balcao') { r[id].balcao++; r[id].valorBalcao += valor; pl.balcao++; pl.valorBalcao += valor; }
    r[id].valor += valor;
    pl.valor += valor;

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
<link rel="apple-touch-icon" href="/apple-touch-icon.png?v=7">
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
.lvl-emblem{width:46px;height:46px;flex-shrink:0;display:flex;align-items:center;justify-content:center}
.lvl-emblem img{width:100%!important;height:100%!important;object-fit:contain}
.lvl-name{font-size:12px;font-weight:700}

/* Progress bar */
.pb{height:6px;background:var(--bg-elev);border-radius:3px;overflow:hidden;margin-top:6px}
.pf{height:100%;border-radius:3px;background:var(--ka)}

/* MOBILE RANKING CARDS */
.rank-cards{display:none}
.rcard{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r);padding:14px 16px;display:flex;align-items:center;gap:12px;margin-bottom:8px}
.rcard.me{border-color:var(--ka);background:rgba(240,120,0,0.08)}
.rcard-pos{font-size:22px;min-width:36px;text-align:center;flex-shrink:0}
.rcard-emb{width:50px;height:50px;flex-shrink:0;display:flex;align-items:center;justify-content:center}
.rcard-emb img{width:100%!important;height:100%!important;object-fit:contain}
.rcard-body{flex:1;min-width:0}
.rcard-name{margin-bottom:4px;display:flex;align-items:center;flex-wrap:wrap;gap:4px}
.rcard-meta{font-size:11px;color:var(--text3);margin-bottom:8px}
.rcard-nums{display:flex;align-items:center;gap:10px}
.rcard-val{font-size:15px;font-weight:800;color:var(--ka)}
.rcard-ap{font-size:11px;color:var(--text2);background:var(--bg-elev);padding:3px 8px;border-radius:6px}

/* INDIVIDUAL DASHBOARD */
.vi-wrap{padding:20px;background:var(--bg);min-height:100%;max-width:1000px;margin:0 auto}

.ind-hero{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r);padding:24px;display:flex;align-items:center;gap:20px;margin-bottom:20px}
.ind-emb{width:104px;height:104px;flex-shrink:0;border-radius:50%;display:flex;align-items:center;justify-content:center;background:transparent;border:3px solid var(--ka);box-shadow:0 0 20px rgba(240,120,0,.45)}
.ind-emb img{width:100%!important;height:100%!important;object-fit:contain;padding:7px;box-sizing:border-box}
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

<div id="db-warn" style="display:none;position:fixed;top:0;left:0;right:0;z-index:9999;background:#7a1f1f;color:#fff;font-size:13px;font-weight:600;padding:10px 14px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.4)">⚠️ Sem conexão com o banco (JSONBin). Os dados exibidos NÃO são reais e nada será salvo. Não adicione/edite nada até reconectar.</div>
<div id="screen-login">
  <div class="login-card">
    <div class="login-logo">
      <div style="font-size:22px;font-weight:800;color:var(--text)">GRUPO <span style="color:var(--ka)">KING ALFA</span></div>
      <div style="font-size:11px;color:var(--text3);margin-top:6px;text-transform:uppercase;letter-spacing:2px">Programa de Níveis</div>
      <div style="font-size:10px;color:var(--ka);margin-top:4px;font-weight:700;letter-spacing:1px">BUILD 13 · leitura direta</div>
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
    <button class="tab" id="tab-hist" onclick="showTab('hist')" style="display:none"><i class="ti ti-calendar-stats"></i><span> Histórico</span></button>
    <button class="tab" id="tab-ger" onclick="showTab('ger')" style="display:none"><i class="ti ti-users-group"></i><span> Minha Equipe</span></button>
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
  <div id="view-hist" class="view">
    <div class="vg-wrap"><div id="hist-content"></div></div>
  </div>
  <div id="view-ger" class="view">
    <div class="vi-wrap" id="ger-content">
      <div style="text-align:center;padding:40px;color:var(--text3)">
        <i class="ti ti-loader-2 spin" style="font-size:28px;display:block;margin-bottom:8px"></i>Carregando...
      </div>
    </div>
  </div>
</div>

<script>
var PROGRAMA_INICIO = '2026-07';
var JSONBIN_ID  = '6a3bdd8bf5f4af5e292909de';
var JSONBIN_KEY = '$2a$10$WzIxNTgN9XRQfPCpGeVPoODb0VwvPbZoZcVT6nRkodWl01uzLgvXW'; // TEMP: leitura direta p/ recuperar acesso; re-esconder via secret depois
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
    {id:1, nome:'King 1 — Matriz',          nomeGC:'KING 01 - Matriz',         lojaId:'271212', metaFaturamento:null},
    {id:2, nome:'King 02 — Pq. Anhanguera', nomeGC:'KING 02 - Pq. Anhanguera', lojaId:'319869', metaFaturamento:null},
    {id:3, nome:'King 03 — Igualdade',      nomeGC:'KING 03 - Igualdade',      lojaId:'556719', metaFaturamento:null}
  ],
  vendedores: [],
  historico: {},
  gerentes: [
    {id:-101, unidadeId:1, nome:'Gerente Matriz KING 01',          pin:'03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', pinInicial:true},
    {id:-102, unidadeId:2, nome:'Gerente PQ. Anhanguera KING 02',  pin:'03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', pinInicial:true},
    {id:-103, unidadeId:3, nome:'Gerente Av. Igualdade KING 03',   pin:'03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', pinInicial:true}
  ]
};

var appData = null;
var dadosOk = false; // true SÓ quando dados reais foram lidos do bin. Bloqueia gravação em modo fallback.
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
function emblemaEscudeiro(size){ return embImg('/emb-escudeiro.png?v=6', size); }
function emblemaCavaleiro(size){ return embImg('/emb-cavaleiro.png?v=6', size); }
function emblemaDuque(size){ return embImg('/emb-duque.png?v=6', size); }
function emblemaRei(size){ return embImg('/emb-rei.png?v=6', size); }

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
function getGerente(id){return (appData.gerentes||[]).find(function(g){return g.id===id;});}
function findUserById(id){return getVendedor(id)||getGerente(id);}

var jbConfigured = () => JSONBIN_ID!=='COLE_O_BIN_ID_AQUI';

async function loadData() {
  dadosOk = false;
  if (!jbConfigured()) { appData = JSON.parse(JSON.stringify(DEFAULT_DATA)); return; }
  try {
    const r = await fetch('https://api.jsonbin.io/v3/b/'+JSONBIN_ID+'/latest',{headers:{'X-Master-Key':JSONBIN_KEY,'X-Bin-Meta':'false'}});
    const j = await r.json();
    var rec = j.record||j;
    var registroValido = r.ok && rec && rec.config && rec.adminPin && Array.isArray(rec.vendedores);
    if (!registroValido) {
      // NÃO conseguimos ler dados reais: modo somente-leitura, sem gravar nada por cima.
      appData = JSON.parse(JSON.stringify(DEFAULT_DATA));
      dadosOk = false;
      return;
    }
    appData = rec;
    dadosOk = true;
    if (!appData.historico) appData.historico = {};
    var migrou = false;
    if (!appData.gerentes || !appData.gerentes.length) { appData.gerentes = JSON.parse(JSON.stringify(DEFAULT_DATA.gerentes)); migrou = true; }
    var LOJA_POR_UNIDADE = {1:'271212', 2:'319869', 3:'556719'};
    (appData.unidades||[]).forEach(function(u){
      if (u.metaFaturamento == null && u.metaServicos != null) { u.metaFaturamento = u.metaServicos; migrou = true; }
      if ((u.lojaId == null || u.lojaId === '') && LOJA_POR_UNIDADE[u.id]) { u.lojaId = LOJA_POR_UNIDADE[u.id]; migrou = true; }
    });
    (appData.vendedores||[]).forEach(function(v){
      if (v.metaFaturamento == null && v.metaServicos != null) { v.metaFaturamento = v.metaServicos; migrou = true; }
    });
    if (migrou) { try { await saveData(); } catch(e){} }
  } catch(e) { appData = JSON.parse(JSON.stringify(DEFAULT_DATA)); dadosOk = false; }
}

async function saveData() {
  if (!jbConfigured()) return;
  if (!dadosOk) { console.warn('saveData BLOQUEADO: dados reais não carregados (modo fallback). Nada foi gravado.'); return; }
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
  var u = getUnidade(vendedor.unidadeId);
  var lojaId = (u && u.lojaId) ? String(u.lojaId) : '';
  Object.keys(ids).forEach(function(id) {
    var e = data.vendas[id];
    if (!e) return;
    var src = e;
    if (lojaId && e.porLoja) {
      src = e.porLoja[lojaId] || {aparelhos:0, servicos:0, balcao:0, valor:0, valorAparelhos:0, valorServicos:0, valorBalcao:0};
    }
    result.aparelhos      += src.aparelhos||0;
    result.servicos       += src.servicos||0;
    result.balcao         += src.balcao||0;
    result.valor          += src.valor||0;
    result.valorAparelhos += src.valorAparelhos||0;
    result.valorServicos  += src.valorServicos||0;
    result.valorBalcao    += src.valorBalcao||0;
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
  (appData.gerentes||[]).forEach(function(gr){
    html += '<button class="seller-btn admin-btn-login" onclick="selectSeller('+gr.id+')" style="margin-top:6px">'+
      '<span><i class="ti ti-user-cog" style="font-size:14px"></i> '+gr.nome+'</span>'+
      '<i class="ti ti-chevron-right" style="font-size:14px"></i>'+
    '</button>';
  });
  html += '<button class="seller-btn admin-btn-login" onclick="selectSeller(-1)" style="margin-top:6px">'+
    '<span><i class="ti ti-shield-lock" style="font-size:14px"></i> Admin</span>'+
    '<i class="ti ti-chevron-right" style="font-size:14px"></i>'+
  '</button>';
  list.innerHTML = html;
}

function selectSeller(id) {
  selectedSellerId = id;
  var nome = id === -1 ? 'Admin' : (getGerente(id) ? getGerente(id).nome : (getVendedor(id)||{nome:''}).nome);
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
  var ger = getGerente(selectedSellerId);
  if (ger) {
    if (hash === ger.pin) {
      var gerUser = {id:ger.id, nome:ger.nome, isGerente:true, gerenteUnidadeId:ger.unidadeId};
      if (ger.pinInicial) { currentUser = gerUser; resetChangePin(); showScreen('changepin'); }
      else loginSuccess(gerUser);
    } else { g('pin-error').textContent = 'PIN incorreto'; pinBuffer = ''; updatePinDots(); }
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
    var v = findUserById(currentUser.id);
    v.pin = hash; v.pinInicial = false;
    try { await saveData(); } catch(e){}
    loginSuccess(currentUser);
  }
}

function loginSuccess(user) {
  currentUser = user;
  g('topbar-user').textContent = user.nome;
  ['tab-admin','tab-acomp','tab-ind','tab-hist','tab-ger'].forEach(function(id){ var t=g(id); if(t) t.style.display='none'; });
  if (user.isAdmin) {
    g('tab-admin').style.display='flex'; g('tab-acomp').style.display='flex'; g('tab-hist').style.display='flex';
    g('tab-geral').style.display='flex';
    showScreen('app'); showTab('geral');
  } else if (user.isGerente) {
    g('tab-ger').style.display='flex';
    g('tab-geral').style.display='none';
    showScreen('app'); showTab('ger');
  } else {
    g('tab-ind').style.display='flex';
    g('tab-geral').style.display='flex';
    showScreen('app'); showTab('geral');
  }
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
  ['geral','ind','admin','acomp','hist','ger'].forEach(function(id){
    g('view-'+id).classList.toggle('on', id===t);
    var tab=g('tab-'+id); if(tab) tab.classList.toggle('on',id===t);
  });
  if (t==='geral') renderGeral();
  if (t==='ind')   renderInd();
  if (t==='admin') renderAdmin();
  if (t==='acomp') renderAcompanhamento();
  if (t==='hist')  renderHistorico();
  if (t==='ger')   renderGerente();
}

// Constrói o HTML do ranking (hero + unidades + individual) para qualquer mês.
// opts: { showFat: bool (mostra faturamento R$), meuId: id do vendedor logado ou null }
function buildRankingHTML(mes, allData, opts) {
  opts = opts || {};
  var isAdminGeral = !!opts.showFat;
  var meuId = (opts.meuId != null) ? opts.meuId : null;
  var niveis = appData.config.niveis;
  var unidades = appData.unidades;
  var vendedores = (appData.vendedores||[]).filter(function(v){ return !v.oculto; });

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
    var totalValor = us.reduce(function(sum,s){ return sum+(s.valor||0); },0);
    return {u:u, totalAp:totalAp, totalValor:totalValor, count:us.length};
  }).sort(function(a,b){ return b.totalValor-a.totalValor; });

  var totalAp = sellerStats.reduce(function(s,x){ return s+x.aparelhos; },0);
  var mediaAp = sellerStats.length ? Math.round(totalAp/sellerStats.length) : 0;
  var best = sellerStats[0];

  var uc = unitStats.map(function(us,i) {
    var label = i===0 ? 'Líder' : (i+1)+'ª';
    var fatLine = isAdminGeral
      ? '<div class="ucard-meta" style="font-size:18px;margin-bottom:2px">R$ '+Math.round(us.totalValor).toLocaleString('pt-BR')+'</div>'
      : '';
    return '<div class="ucard'+(i===0?' lead':'')+'">'+
      '<div class="ucard-label">'+label+'</div>'+
      '<div class="ucard-name">'+us.u.nome+'</div>'+
      fatLine+
      '<div class="ucard-meta" style="font-size:13px;opacity:0.85">'+us.totalAp+' ap. · '+us.count+' vend.</div>'+
    '</div>';
  }).join('');

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
      '<td><div class="lvl-cell"><div class="lvl-emblem">'+emblemaPorNivel(s.nivelId, 46)+'</div><span class="lvl-name">'+s.lvl.nome+'</span></div></td>'+
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
      '<div class="rcard-emb">'+emblemaPorNivel(s.nivelId, 50)+'</div>'+
      '<div class="rcard-body">'+
      '<div class="rcard-name"><span class="vname-pill">'+s.v.nome+'</span>'+meBadge+'</div>'+
      '<div class="rcard-meta">'+s.u.nome+' · '+s.lvl.nome+'</div>'+
      '<div class="rcard-nums">'+
      '<span class="rcard-val">'+valorStr+'</span>'+
      '<span class="rcard-ap">'+s.aparelhos+' ap.</span>'+
      '</div></div></div>';
  }).join('');

  return '<div class="hero-stats">'+
    '<div class="hstat"><div class="hsl">Total aparelhos</div><div class="hsv">'+totalAp+'</div><div class="hss">'+fmtMes(mes)+'</div></div>'+
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
}

async function renderGeral() {
  g('geral-loading').style.display='block';
  g('geral-content').style.display='none';
  var mes = curMes();
  var allData = await fetchVendas(mes);
  g('geral-content').innerHTML = buildRankingHTML(mes, allData, {
    showFat: !!(currentUser && currentUser.isAdmin),
    meuId: (currentUser && !currentUser.isAdmin && !currentUser.isGerente) ? currentUser.id : null
  });
  g('geral-loading').style.display='none';
  g('geral-content').style.display='block';
}

// ===== HISTÓRICO (admin): ranking completo de um mês selecionado =====
var histSelMes = null;
async function renderHistorico() {
  var cm = curMes();
  if (!histSelMes) histSelMes = mesAnteriorStr(cm);
  g('hist-content').innerHTML =
    '<div class="admin-section">'+
    '<div class="admin-sec-title"><i class="ti ti-calendar-stats"></i> Histórico do Ranking</div>'+
    '<p style="font-size:12px;color:var(--text2);margin-bottom:10px">Escolha o mês para ver o ranking completo (idêntico ao principal) com os dados daquele mês.</p>'+
    '<input type="month" id="hist-mes" value="'+histSelMes+'" max="'+cm+'" onchange="onHistMes(this.value)" style="padding:9px 12px;border:1px solid var(--border2);border-radius:8px;font-size:14px;background:var(--bg-card2);color:var(--text);outline:none">'+
    '</div>'+
    '<div id="hist-rank"><div style="text-align:center;padding:40px;color:var(--text3)"><i class="ti ti-loader-2 spin" style="font-size:28px;display:block;margin-bottom:8px"></i>Carregando '+fmtMes(histSelMes)+'...</div></div>';
  var allData = await fetchVendas(histSelMes);
  var rk = g('hist-rank');
  if (rk) rk.innerHTML = buildRankingHTML(histSelMes, allData, { showFat: true, meuId: null });
}
function onHistMes(val){ if(!val) return; histSelMes = val; renderHistorico(); }

// ===== MINHA EQUIPE (gerente): só a unidade do gerente =====
async function renderGerente() {
  if (!currentUser || !currentUser.isGerente) return;
  var el = g('ger-content');
  el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text3)"><i class="ti ti-loader-2 spin" style="font-size:28px;display:block;margin-bottom:8px"></i>Carregando...</div>';
  var uId = currentUser.gerenteUnidadeId;
  var u = getUnidade(uId);
  var niveis = appData.config.niveis;
  var mes = curMes();
  var allData = await fetchVendas(mes);
  var team = (appData.vendedores||[]).filter(function(v){ return v.unidadeId===uId; });

  var totalUnidade = 0;
  var totalAparelhosUnidade = 0;
  var totalMetaUnidade = 0;
  var totalMetaDefinida = true;
  var cards = team.map(function(v){
    var d  = getSellerVendas(allData.mesAtual, v);
    var da = getSellerVendas(allData.mesAnterior, v);
    var nc = calcNivel(v, d, da, mes);
    var lvl = niveis[nc.nivel]||niveis[0];
    var nx  = niveis[nc.nivel+1];
    totalUnidade += (d.valor||0);
    totalAparelhosUnidade += (d.aparelhos||0);
    var pctNivel = nx ? Math.min(100, Math.round(d.aparelhos/nx.minAp*100)) : 100;
    var gapNivel = nx ? Math.max(0, nx.minAp - d.aparelhos) : 0;
    var metaFat = (v.metaFaturamento != null) ? v.metaFaturamento : (u && u.metaFaturamento != null ? u.metaFaturamento : null);
    if (metaFat) { totalMetaUnidade += metaFat; } else { totalMetaDefinida = false; }
    var pctMeta = metaFat ? Math.min(100, Math.round(d.valor/metaFat*100)) : 0;
    var faltaMeta = metaFat ? Math.max(0, metaFat - d.valor) : 0;
    var metaBar = metaFat
      ? '<div class="meta-bar" style="margin-top:10px">'+
          '<div class="meta-bar-hd"><span class="meta-bar-label">Meta faturamento</span><span class="meta-bar-val">'+money(d.valor)+' / '+money(metaFat)+'</span></div>'+
          '<div class="meta-bar-bg"><div class="meta-bar-fill" style="width:'+pctMeta+'%;background:'+(d.valor>=metaFat?'var(--green)':'var(--ka)')+'"></div></div>'+
          '<div class="meta-bar-hint">'+(d.valor>=metaFat ? '✅ Meta atingida ('+pctMeta+'%)' : '⚠️ Faltam '+money(faltaMeta)+' ('+pctMeta+'%)')+'</div>'+
        '</div>'
      : '<div class="meta-bar" style="margin-top:10px"><div class="meta-bar-hint" style="font-style:italic">Meta a definir pelo admin</div></div>';
    return '<div class="admin-section" style="margin-bottom:14px">'+
      '<div style="display:flex;align-items:center;gap:12px">'+
        '<div style="width:52px;height:52px;flex-shrink:0">'+emblemaPorNivel(nc.nivel,52)+'</div>'+
        '<div style="flex:1;min-width:0">'+
          '<div style="font-weight:800;font-size:15px">'+v.nome+'</div>'+
          '<div style="font-size:12px;color:var(--text2)">'+lvl.nome+' · '+money(d.valor)+' · '+d.aparelhos+' ap.</div>'+
        '</div>'+
      '</div>'+
      '<div style="margin-top:10px">'+
        '<div class="meta-bar-hd"><span class="meta-bar-label">Progressão de nível'+(nx?' → '+nx.nome:'')+'</span><span class="meta-bar-val">'+(nx?d.aparelhos+' / '+nx.minAp+' ap.':'👑 Rei')+'</span></div>'+
        '<div class="meta-bar-bg"><div class="meta-bar-fill" style="width:'+pctNivel+'%;background:var(--ka)"></div></div>'+
        '<div class="meta-bar-hint">'+(nx?(gapNivel>0?'Faltam '+gapNivel+' aparelhos':'Na faixa de '+nx.nome+'!'):'Nível máximo')+'</div>'+
      '</div>'+
      metaBar+
    '</div>';
  }).join('');

  var pctMetaUnidade = totalMetaUnidade ? Math.min(100, Math.round(totalUnidade/totalMetaUnidade*100)) : 0;
  var faltaMetaUnidade = totalMetaUnidade ? Math.max(0, totalMetaUnidade - totalUnidade) : 0;
  var metaUnidadeHtml = (totalMetaUnidade > 0)
    ? '<div class="meta-bar" style="margin-top:14px">'+
        '<div class="meta-bar-hd"><span class="meta-bar-label">Meta da unidade'+(!totalMetaDefinida?' (parcial — falta meta de algum vendedor)':'')+'</span><span class="meta-bar-val">'+money(totalUnidade)+' / '+money(totalMetaUnidade)+'</span></div>'+
        '<div class="meta-bar-bg"><div class="meta-bar-fill" style="width:'+pctMetaUnidade+'%;background:'+(totalUnidade>=totalMetaUnidade?'var(--green)':'var(--ka)')+'"></div></div>'+
        '<div class="meta-bar-hint">'+(totalUnidade>=totalMetaUnidade ? '✅ Meta atingida ('+pctMetaUnidade+'%)' : '⚠️ Faltam '+money(faltaMetaUnidade)+' ('+pctMetaUnidade+'%)')+'</div>'+
      '</div>'
    : '<div class="meta-bar" style="margin-top:14px"><div class="meta-bar-hint" style="font-style:italic">Meta da unidade a definir pelo admin</div></div>';

  el.innerHTML =
    '<div class="ind-hero">'+
      '<div class="ind-emb"><i class="ti ti-users-group" style="font-size:56px;color:var(--ka)"></i></div>'+
      '<div>'+
        '<div class="ind-name">'+(u?u.nome:'Minha unidade')+'</div>'+
        '<div class="ind-lvl">'+money(totalUnidade)+'</div>'+
        '<div class="ind-sub">Faturamento total da unidade · '+fmtMes(mes)+' · '+team.length+' vendedor(es) · '+totalAparelhosUnidade+' aparelho(s) vendido(s)</div>'+
      '</div>'+
    '</div>'+
    metaUnidadeHtml+
    (cards || '<p style="font-size:13px;color:var(--text2)">Nenhum vendedor cadastrado nesta unidade.</p>');
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

async function renderAdmin() {
  var niveis = appData.config.niveis;
  var unidades = appData.unidades;
  var vendedores = appData.vendedores;
  var mesAdm = curMes();
  var allDataAdm = await fetchVendas(mesAdm);
  var unitFat = {};
  unidades.forEach(function(u){ unitFat[u.id] = 0; });
  vendedores.forEach(function(v){
    var d = getSellerVendas(allDataAdm.mesAtual, v);
    if (v.unidadeId != null && unitFat[v.unidadeId] != null) unitFat[v.unidadeId] += (d.valor||0);
  });

  var nivelRows = niveis.map(function(lv) {
    return '<div class="nivel-row">'+
      '<div class="nivel-name"><span style="width:24px;height:24px;display:inline-block">'+emblemaPorNivel(lv.id, 24)+'</span>'+lv.nome+'</div>'+
      '<div><label class="fl">Min ap.</label><input class="ni" type="number" id="nv-min-'+lv.id+'" value="'+lv.minAp+'" min="0"></div>'+
      '<div><label class="fl">Max ap.</label><input class="ni" type="number" id="nv-max-'+lv.id+'" value="'+(lv.maxAp>=9999?'∞':lv.maxAp)+'" '+(lv.id===3?'disabled':'')+'></div>'+
      '<div><label class="fl">Comissão %</label><input class="ni" type="number" id="nv-pct-'+lv.id+'" value="'+(lv.pct*100).toFixed(3)+'" step="0.001" min="0" max="100"></div>'+
    '</div>';
  }).join('');

  var metasUnidadeHtml = unidades.map(function(u) {
    var fatU = Math.round(unitFat[u.id]||0);
    return '<tr><td style="font-weight:600">'+u.nome+'</td>'+
      '<td style="font-weight:800;color:var(--ka);white-space:nowrap;font-size:15px">R$ '+fatU.toLocaleString('pt-BR')+'</td>'+
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
      '<td><button class="btn btn-g" onclick="toggleOculto('+v.id+')" title="Mostrar/ocultar no ranking" style="font-size:12px;padding:6px 10px;white-space:nowrap">'+(v.oculto?'<i class="ti ti-eye-off" style="font-size:13px;color:var(--red)"></i> Oculto':'<i class="ti ti-eye" style="font-size:13px;color:var(--green)"></i> Visível')+'</button></td>'+
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
    '<p style="font-size:12px;color:var(--text2);margin-bottom:14px">Faturamento atual do mês (aparelhos + serviços + balcão) de cada unidade, e a meta mensal em R$ que ela precisa atingir.</p>'+
    '<div class="atw"><table class="at"><thead><tr><th>Unidade</th><th>Faturamento atual</th><th>Meta mensal (R$)</th></tr></thead><tbody>'+metasUnidadeHtml+'</tbody></table></div>'+
    '<div class="btn-row"><button class="btn btn-p" onclick="saveMetasUnidade()"><i class="ti ti-device-floppy"></i> Salvar metas</button></div>'+
    '</div>'+

    '<div class="admin-section">'+
    '<div class="admin-sec-title"><i class="ti ti-users"></i> Vendedores</div>'+
    '<p style="font-size:12px;color:var(--text2);margin-bottom:14px">O campo <strong>Nome no GC</strong> deve ter o nome <em>exato</em> do vendedor como aparece nas vendas do Gestão Click. Se o vendedor usa mais de um nome (ex: sócio que vende em 2 lojas), separe por vírgula.</p>'+
    '<div class="atw" style="overflow-x:auto"><table class="at"><thead><tr>'+
    '<th>Nome</th><th>Unidade</th><th>Nome no GC</th><th>Salário</th><th>Benefícios</th><th>Meta R$</th><th>Ranking</th><th>PIN</th><th></th>'+
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
    '</div>'+

    '<div class="admin-section">'+
    '<div class="admin-sec-title"><i class="ti ti-user-cog"></i> Gerentes (acesso por unidade)</div>'+
    '<p style="font-size:12px;color:var(--text2);margin-bottom:14px">Cada gerente vê apenas os vendedores da sua unidade (progresso, meta e faturamento). PIN inicial <strong>1234</strong> — trocado no primeiro acesso. Use o botão para redefinir se o gerente esquecer o PIN.</p>'+
    '<div class="atw" style="overflow-x:auto"><table class="at"><thead><tr><th>Gerente</th><th>Unidade</th><th>PIN</th></tr></thead><tbody>'+
    (appData.gerentes||[]).map(function(gr){ var gu=getUnidade(gr.unidadeId); return '<tr><td style="font-weight:600">'+gr.nome+'</td><td style="font-size:12px;color:var(--text2)">'+(gu?gu.nome:'')+'</td><td><button class="btn btn-g" onclick="resetGerentePin('+gr.id+')" style="font-size:12px;padding:6px 10px"><i class="ti ti-refresh" style="font-size:13px"></i> 1234</button></td></tr>'; }).join('')+
    '</tbody></table></div>'+
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
    pinInicial:true, metaFaturamento:null, nivelAtual:1, mesesAcima:0, mesesAbaixo:0, oculto:false
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

async function toggleOculto(id) {
  var v = getVendedor(id);
  if (!v) return;
  v.oculto = !v.oculto;
  await saveData();
  vendaCache = {};
  renderAdmin();
}

async function resetGerentePin(id) {
  var gr = getGerente(id);
  if (!gr) return;
  gr.pin = '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4';
  gr.pinInicial = true;
  await saveData();
  alert('PIN de '+gr.nome+' redefinido para 1234.');
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
  var w = g('db-warn'); if (w) w.style.display = dadosOk ? 'none' : 'block';
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
const ICON_192 = "iVBORw0KGgoAAAANSUhEUgAAAMAAAADABAMAAACg8nE0AAAAMFBMVEXmYwMmGxNnZ2iWlpZZJQHU1NSuSAKNOgIAAAD8aQL+/v6Tk5Nubm5zc3MpEwHl5eX4XLYDAAAEk0lEQVR42u2bT2gcVRzHP9nZ7ew0VIIHsYoxIiKlBweRWinIWiqIh7qHauxFRzzEIg0jFJucutRW2pi0owE1kta91aKEAQ8SPbggGNIcWilSpB72UtmiaEDb3UkmWQ+727SbnT/mvaGJvHfZ4b2XfPf9vr/f9/d+7+10nSDZlkIBKAAFoAAUgAJQAApAAax7ACfOpHT0lJFHL3QeOLxvcEYCQKbifhkw1P+nm4/6c21PxATvcsjg8lNHd4qu4OwHGe11ALbZK6iDADxw0R35TRDAu+oe7T8MwJPzt5m/8bH1ky2OLWai+h+1h5uPW2srvPzV+Nz14bPV+8Xc9Bzvtx5v+6rV1sOrvCgYB6ZntR7fWOm9r/WwydHEOPDyt74sS8M9Lbu9cquznIkgoSu8Rkv3TpmhExYf7y2JmKhKOcqPbSEOshTDJ2ymoOT6LgPUhQHmFQeCf39TmSiqbVYcJGyizMWEV5DKYyXKwU2iEk530hzc2PBxoMRuPQAI7YsifYRu0o4AwD/56DgYzIlo0SMxbFQU4eCtGIFmCQB4uxP2ovS1KDUVd9M2C/tt5UaX7DhoB6jLBpgdTViLSn6yUuE7lBIFGMWYlhpo7e0AfNzeZ0kE8Pog5SS4Ar0My/adUpEpyzSRbld/ausyXAEAf5hVgevKjAO9nUA9l7alumm2vaNPkx1oPXfYwjObTnRaXqCdbPznex2ADOQBvOvNQQl70ydKAJqRB/gWdgCcnnAA/HnxvWneeKEEaPZZgNlmFt2PBfjHHRl7U2OvBZ4zXgbfgXEH6iYOeNccCQnHBe0rOACT4APkYRpOQs2UQvIlsMGCMZgAmIRfQGscbopntLwJSwDVK00PSsFBqsB5OUl/BgZgp42LbwKMl1iEYzAgJw4O2XzuoJcxaabLEhrv2HjXGfhGQiSnt/DREYt+4yVmm2nN+xXwKkWGcjK2LW9DasrahjfcTMf+9+fRvIrpDPRIycn6JViYMjE+beYyY7/DaKUY634mhhdBGYx2ETVMB8ZklLFFeDpgqHpF0rZlU9BAWVKlvxwS5FJWEJQl37UlAQSRcEraWUWA6BySdlZxprMT2dIKkOWOxjaKUsTOApacwBXI4UCfCaJAAgfFZkStbp9JLEA6nRZUL0is0XS7s1BIOxRcCBQKSYeCenWNQhG7AMl1Foo4QhZv2t6XV5utKBNgIZ5PSqj0/3OLt4JKJ61IH5MG4E9MdOo+YidsIlMaB+mOpwVLuTiRHI+Dx1Z7KX/rRXkkr91L1QVF8vcHG/+SCEWyInn9A3QrE0W1+oYPNFQk///dVAHc/ZS58U0kfpxjJbuCWtTvi8TluifKRAUhACP6J1iOEMANpsMnTDYuLdZcQuluxM3fd3O2GAeFVKgJvL6sIMm7Fp8JNYC7RxDgIPtCluD9HHg032pRrwdoz/2++72gtyS81+7RekXr5K8f0sdOZQtDJ2AIsgWoZaFWyBZqnJtj+9UoLYl8AfrM8ZDBL3aIi92bD4Ys70cZRwk/jMwF6NDzA9uj5Va9I64AFIACUAAKQAEoAAWgANYJwL9H5CSNN5SU0AAAAABJRU5ErkJggg==";
const ICON_512 = "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";
const ICON_180 = "iVBORw0KGgoAAAANSUhEUgAAALQAAAC0BAMAAADP4xsBAAAAMFBMVEXwaAIkFw6sSQKamppgKAJcXFza2tqKOQKAgH8AAAD8aQL+/v5oaGikpKQnEQFDQ0L4CIesAAAD1ElEQVR42u3bT2gcVRzA8e/+dRgkBAWJIDaIQsjFPWjRiy7YglKQAUsSI62Df2pRD57StNX2WdgQ1ENACdZDOyopSyIyhyKtWghSQURwTkF66qlITwspk8lONulhk5VsZ2fWeW8MwttLZn9v32dnfvN7LzMvk9x5snrl0bSmNa1pTWta05reG7qY9IHgl08i4xPXnYSeuYSrp8KfVo+W8NuqVEKCi71kSkeEVEJqC+HZ3wHWfu3ELs8BHB6yXpRJSHDj0IMeAK0nOsHvKwBsrBx6U6RPSN5a8noe71JpWCLXx7myvdX6J7jzZafdGQm62tw55HLn2PP29obRuJM+18HopWd2tss/bG9c73zJRwtHRVq6/MijyzHNzZHnnLQJaZFQAp7EkPkgrvE+PalqWtOa3iP6RGb0Rj0z2sguIb6uEE3vFW0m9r4/LZ13k+hbjZR0czRxt63scm2npIOvMzuN+dp/V3ybNzOjT45kRr9bzooOKgWREV2OLzYZ+hV4OiN6PxzuCjmK6ElY6AoJRfSQ7Z/bHZmqpqTL3+x+vwVdM92XqXP9fNd1STWXVfFxM4Mhsy4ASqL9M5xTQk8DMPs3wB1MG+DDdrAmST/rAlQuCmC2PWSCZgHgzC1J2h93gRUawGB7yGw5R4Fw1ZHNtTnuwm3zPIQC6hZ8xQUI33dkc21iLhM4GBabNlAlEJiCmUUVFTJMweaIy6wDTGN4UGHKlqZ9aFA6RhMGAXIwz6RFMXmCTaIdmIDHGSEQAIZA+AfhZYdRSfrqPE/WaXFCbLUDg8EpPM78xuR7srket83X/8rZ5qc/tt+fvupQeelz/INJPWNXzAr7BrzgYRgb3T0tTVww8dcp7BvwZPbaELDYNeHVTXhLQfE9FB1WUdc3osOvKaCnI+vXryqg85GThekpoEuRex0IFXPIsajgG0p+gUXWQksJPRV1FkeU0MWIZJvDSuhWRIn4lhLaiCiGdxRdh0QM9aYi2ku3dtQPfc5OMcz7oyOGutNHt2Ifnykd6I6suopollLd7fZD1+49j6tXlNDhZz/fO2RcS8VpjPr7nLmsZK+nbH8RGOuwPub8sBJ6YIhp4LFdpb6mJtcp15r1EqKmNa1pTWta05rWtKb/h/R6/INga8ylpjeoxDUXWE5NG27sk5e1UKTPdaMU12ptSZzGn0oxd8xN6zsJ+iynejfWCSToojD+6JHP4JoIqjJ3YBOMbR6IbHm1xowd2zfpceNrb/dsWnxKbjS+YPRYnwg/vix7S7py6YvI+AOzST1z+r/XNK1pTWta05rWtKb/xesuDRztr0Sd+vQAAAAASUVORK5CYII=";
const MANIFEST = '{"name":"KING ALFA NÍVEIS","short_name":"King Níveis","description":"Programa de Níveis — Grupo King Alfa","start_url":"/","scope":"/","display":"standalone","orientation":"portrait","background_color":"#0A0A0A","theme_color":"#0A0A0A","lang":"pt-BR","icons":[{"src":"/icon-192.png?v=7","sizes":"192x192","type":"image/png","purpose":"any"},{"src":"/icon-512.png?v=7","sizes":"512x512","type":"image/png","purpose":"any"},{"src":"/icon-512.png?v=7","sizes":"512x512","type":"image/png","purpose":"maskable"}]}';
const SW_JS = `const CACHE='kingalfa-v13';
const SHELL=['/','/icon-192.png?v=7','/icon-512.png?v=7','/manifest.webmanifest','/emb-escudeiro.png?v=6','/emb-cavaleiro.png?v=6','/emb-duque.png?v=6','/emb-rei.png?v=6'];
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
        function calcSituacoes(lista){
          const out = {};
          lista.forEach(function(v){
            const s = (v.nome_situacao||'(vazio)');
            if (!out[s]) out[s] = { qtd:0, valor:0, contaNoApp: !!classify(s, v.__tipoGC) };
            out[s].qtd++;
            out[s].valor += parseFloat(v.valor_total||0);
          });
          Object.keys(out).forEach(function(k){ out[k].valor = Math.round(out[k].valor); });
          return out;
        }
        function totalConta(lista){
          return Math.round(lista.reduce(function(sum,v){
            return sum + (classify(v.nome_situacao||'', v.__tipoGC) ? parseFloat(v.valor_total||0) : 0);
          },0));
        }
        const situacoes = calcSituacoes(todas);
        const porLoja = {
          'Matriz (271212)':      { faturamentoApp: totalConta(d1), situacoes: calcSituacoes(d1) },
          'Anhanguera (319869)':  { faturamentoApp: totalConta(d2), situacoes: calcSituacoes(d2) },
          'Igualdade (556719)':   { faturamentoApp: totalConta(d3), situacoes: calcSituacoes(d3) }
        };
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
          var camposGC = [...new Set(matches.flatMap(function(v){ return Object.keys(v); }))].sort();
          vendedor = {
            filtro: filtro,
            qtdVendas: matches.length,
            valorTodasSituacoes: Math.round(totalTudo),
            valorSoConcretizada_oQueOAppConta: Math.round(totalConcretizada),
            diferenca: Math.round(totalTudo - totalConcretizada),
            nomesEncontrados: [...new Set(matches.map(function(v){ return v.nome_vendedor; }))],
            camposGC: camposGC,
            vendas: matches.map(function(v){
              var o = { tipoGC: v.__tipoGC };
              Object.keys(v).forEach(function(k){ if (k!=='__tipoGC') o[k] = v[k]; });
              return o;
            })
          };
        }
        return new Response(JSON.stringify({
          tokensConfigurados: { access: !!env.GC_ACCESS_TOKEN, secret: !!env.GC_SECRET_TOKEN },
          totalVendas: todas.length,
          situacoes: situacoes,
          porLoja: porLoja,
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

    // Proxy seguro do JSONBin: a X-Master-Key fica SO no servidor (env.JSONBIN_KEY),
    // nunca chega ao navegador. Cliente usa GET /api/config (ler) e PUT /api/config (gravar).
    if (url.pathname === '/api/config') {
      if (request.method === 'OPTIONS') return new Response(null, {headers:cors});
      const key = env.JSONBIN_KEY;
      if (!key) return new Response(JSON.stringify({error:'JSONBIN_KEY nao configurada no Worker'}),{status:500,headers:cors});
      const binBase = 'https://api.jsonbin.io/v3/b/' + JSONBIN_ID;
      try {
        if (request.method === 'GET') {
          const r = await fetch(binBase + '/latest', {headers:{'X-Master-Key':key,'X-Bin-Meta':'false'}});
          const body = await r.text();
          return new Response(body, {status:r.status, headers:cors});
        }
        if (request.method === 'PUT') {
          const payload = await request.text();
          const r = await fetch(binBase, {method:'PUT', headers:{'Content-Type':'application/json','X-Master-Key':key}, body:payload});
          const body = await r.text();
          return new Response(body, {status:r.status, headers:cors});
        }
        return new Response(JSON.stringify({error:'metodo nao suportado'}),{status:405,headers:cors});
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
