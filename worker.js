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
var JSONBIN_ID  = '6a3bdd8bf5f4af5e292909de'; // usado so pra gate jbConfigured; a chave nao existe mais no cliente
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
  if (!jbConfigured()) { appData = JSON.parse(JSON.stringify(DEFAULT_DATA)); return; }
  try {
    const r = await fetch(API_BASE+'/config');
    const j = await r.json();
    var rec = j.record||j;
    appData = (rec&&rec.vendedores) ? rec : DEFAULT_DATA;
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
  } catch(e) { appData = JSON.parse(JSON.stringify(DEFAULT_DATA)); }
}

async function saveData() {
  if (!jbConfigured()) return;
  await fetch(API_BASE+'/config',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(appData)});
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
  var cards = team.map(function(v){
    var d  = getSellerVendas(allData.mesAtual, v);
    var da = getSellerVendas(allData.mesAnterior, v);
    var nc = calcNivel(v, d, da, mes);
    var lvl = niveis[nc.nivel]||niveis[0];
    var nx  = niveis[nc.nivel+1];
    totalUnidade += (d.valor||0);
    var pctNivel = nx ? Math.min(100, Math.round(d.aparelhos/nx.minAp*100)) : 100;
    var gapNivel = nx ? Math.max(0, nx.minAp - d.aparelhos) : 0;
    var metaFat = (v.metaFaturamento != null) ? v.metaFaturamento : (u && u.metaFaturamento != null ? u.metaFaturamento : null);
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

  el.innerHTML =
    '<div class="ind-hero">'+
      '<div class="ind-emb"><i class="ti ti-users-group" style="font-size:56px;color:var(--ka)"></i></div>'+
      '<div>'+
        '<div class="ind-name">'+(u?u.nome:'Minha unidade')+'</div>'+
        '<div class="ind-lvl">'+money(totalUnidade)+'</div>'+
        '<div class="ind-sub">Faturamento total da unidade · '+fmtMes(mes)+' · '+team.length+' vendedor(es)</div>'+
      '</div>'+
    '</div>'+
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
  renderLoginList();
}
init();
</script>
</body>
</html>
`;

// ========== PWA ASSETS ==========
const EMB_ESCUDEIRO = "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