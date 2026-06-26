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
      // Marca cada venda com o tipo da chamada
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

  const [vProd, vServ, vBalc] = await Promise.all([
  puxarTipo('produto'),
  puxarTipo('servico'),
  puxarTipo('vendas_balcao')
]);
return vProd.concat(vServ).concat(vBalc);
}

function classify(sit) {
  if (!sit) return null;
  const s = sit.trim().toUpperCase();
  if (!s.startsWith('CONCRETIZADA')) return null;
  return s === 'CONCRETIZADA' ? 'servico' : 'aparelho';
}

// Monta lookup vendedor_id -> nome a partir das vendas que TÊM os dois campos.
// Usado pra preencher o nome das vendas que vierem só com vendedor_id.
// Normaliza o nome do vendedor pra casar variantes:
// tira acento, remove "(VENDEDOR 2)" e afins, colapsa espaços, sobe pra maiúscula.
function normNome(n) {
  return (n||'')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')   // remove acentos
    .replace(/\([^)]*\)/g,'')                           // remove "(...)" ex.: (VENDEDOR 2)
    .replace(/\s+/g,' ').trim().toUpperCase();
}

// Agrupa por vendedor_id (estável). Retorna:
//   vendas: { [id]: {aparelhos, servicos, valor, nomes:[...]} }
//   indexNomes: { [nomeNormalizado]: [id, ...] }  <- usado pra casar nome -> id
function group(vendas) {
  const r = {};
  const indexNomes = {};
  for (const v of vendas) {
    const tipo = classify(v.nome_situacao||'', v.__tipoGC);
    if (!tipo) continue;

    const id = (v.vendedor_id != null && v.vendedor_id !== '') ? String(v.vendedor_id) : '__sem_id__';
    if (!r[id]) r[id] = {aparelhos:0, servicos:0, balcao:0, valor:0, valorAparelhos:0, valorServicos:0, valorBalcao:0, nomes:{}};
    const valor = parseFloat(v.valor_total||0);
    if (tipo==='aparelho') {
      r[id].aparelhos++;
      r[id].valorAparelhos += valor;
    } else if (tipo==='servico') {
      r[id].servicos++;
      r[id].valorServicos += valor;
    } else if (tipo==='balcao') {
      r[id].balcao++;
      r[id].valorBalcao += valor;
    }
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
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>King Alfa — Programa de Níveis</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.19.0/dist/tabler-icons.min.css">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --ka:#F07800; --kad:#D46400; --kab:#CC5A00;
  --bg:#F7F7F7; --bg2:#FFFFFF; --border:#E8E8E8;
  --gray:#6B7280; --grayl:#9CA3AF;
  --black:#111; --white:#FFF;
  --r:12px; --rs:8px;
}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:var(--ka);min-height:100vh;color:var(--black)}

/* ── LOGIN ── */
#screen-login{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:24px;background:var(--ka)}
.login-card{background:var(--black);border-radius:20px;padding:32px 28px;width:100%;max-width:380px;box-shadow:0 24px 64px rgba(0,0,0,.4)}
.login-logo{text-align:center;margin-bottom:28px}
.login-logo img{height:60px}
.login-title{font-size:15px;font-weight:600;color:#888;text-align:center;margin-bottom:20px;text-transform:uppercase;letter-spacing:.5px}
.seller-list{display:flex;flex-direction:column;gap:8px;margin-bottom:20px;max-height:280px;overflow-y:auto}
.seller-btn{background:#1A1A1A;border:1.5px solid #2A2A2A;color:var(--white);padding:12px 16px;border-radius:10px;cursor:pointer;text-align:left;font-size:14px;font-weight:500;transition:all .15s;display:flex;align-items:center;justify-content:space-between}
.seller-btn:hover{border-color:var(--ka);color:var(--ka)}
.seller-btn.admin-btn-login{border-color:#333;color:#666;font-size:13px}
.seller-btn.admin-btn-login:hover{border-color:var(--ka);color:var(--ka)}
.seller-unit-tag{font-size:11px;color:#555;font-weight:400}

/* PIN PAD */
#pin-step{display:none}
.pin-back{background:none;border:none;color:#666;cursor:pointer;font-size:13px;display:flex;align-items:center;gap:4px;margin-bottom:16px;padding:0}
.pin-back:hover{color:var(--ka)}
.pin-name{font-size:16px;font-weight:700;color:var(--white);margin-bottom:4px}
.pin-hint{font-size:12px;color:#666;margin-bottom:20px}
.pin-dots{display:flex;gap:10px;justify-content:center;margin-bottom:20px}
.pin-dot{width:14px;height:14px;border-radius:50%;background:#2A2A2A;border:2px solid #333;transition:all .15s}
.pin-dot.filled{background:var(--ka);border-color:var(--ka)}
.pin-pad{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.pin-key{background:#1A1A1A;border:1.5px solid #2A2A2A;color:var(--white);border-radius:12px;padding:16px;font-size:20px;font-weight:700;cursor:pointer;transition:all .15s;min-height:58px;display:flex;align-items:center;justify-content:center}
.pin-key:hover{border-color:var(--ka);color:var(--ka)}
.pin-key.del{font-size:16px;color:#555}
.pin-key.del:hover{color:#EF4444;border-color:#EF4444}
.pin-error{color:#EF4444;font-size:13px;text-align:center;margin-top:8px;min-height:20px}

/* ── CHANGE PIN ── */
#screen-changepin{display:none;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:24px;background:var(--ka)}

/* ── APP ── */
#screen-app{display:none;flex-direction:column;min-height:100vh;background:var(--ka)}

/* TOPBAR */
.topbar{background:#FFFFFF;border-bottom:1.5px solid #E5E7EB;padding:0 16px;display:flex;align-items:center;justify-content:space-between;height:56px;flex-shrink:0}
.topbar-brand{display:flex;align-items:center;gap:10px}
.topbar-logo{height:32px}
.topbar-period{font-size:11px;color:#666;margin-top:2px}
.topbar-right{display:flex;align-items:center;gap:10px}
.topbar-user{font-size:12px;font-weight:600;color:var(--ka)}
.logout-btn{background:none;border:none;color:#9CA3AF;cursor:pointer;font-size:18px;display:flex;align-items:center}
.logout-btn:hover{color:#111}

/* TABS */
.tabs{background:#FFFFFF;border-bottom:1.5px solid #E5E7EB;display:flex;padding:0 16px;flex-shrink:0}
.tab{padding:12px 16px;font-size:13px;font-weight:600;color:#9CA3AF;cursor:pointer;border:none;background:none;border-bottom:2px solid transparent;margin-bottom:-1.5px;display:flex;align-items:center;gap:6px;transition:all .15s;white-space:nowrap}
.tab.on{color:var(--ka);border-bottom-color:var(--ka)}
.tab:hover:not(.on){color:#111}

/* VIEWS */
.view{display:none;flex:1;overflow-y:auto}
.view.on{display:block}

/* ── RANKING GERAL (orange bg) ── */
.vg-wrap{padding:16px;background:#FFFFFF;min-height:100%}

/* Hero stats on orange */
.hero-stats{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:20px}
.hstat{background:#FFFFFF;border-radius:var(--r);padding:14px 16px;border:1.5px solid #111}
.hsl{font-size:11px;color:#6B7280;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;font-weight:600}
.hsv{font-size:22px;font-weight:800;color:var(--ka);line-height:1}
.hss{font-size:11px;color:#9CA3AF;margin-top:4px}

/* Unit ranking on orange */
.unit-section{margin-bottom:20px}
.sec-title{font-size:13px;font-weight:700;color:#111;text-transform:uppercase;letter-spacing:.6px;margin-bottom:10px;display:flex;align-items:center;gap:6px}
.unit-cards-row{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.ucard-o{background:var(--ka);border-radius:var(--r);padding:16px 18px;border:2px solid #111}
.ucard-o.lead{border-color:#111;background:var(--ka)}
.ucard-o-label{font-size:11px;color:rgba(255,255,255,.9);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;font-weight:700}
.ucard-o-name{font-size:18px;font-weight:800;color:var(--white);margin-bottom:6px}
.ucard-o-meta{font-size:13px;color:rgba(255,255,255,.9);font-weight:700}

/* Ranking table on orange */
.rank-table-wrap{background:#FFFFFF;border:1.5px solid #E5E7EB;border-radius:var(--r);overflow:hidden;margin-bottom:16px}
table{width:100%;border-collapse:collapse;font-size:13px}
th{padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#6B7280;background:#F9FAFB;border-bottom:1px solid #E5E7EB;text-transform:uppercase;letter-spacing:.4px}
td{padding:11px 12px;border-bottom:1px solid #F3F4F6;vertical-align:middle;color:#111}
tr:last-child td{border-bottom:none}
tbody tr:hover td{background:#FFF9F4}

/* Badges on orange */
.badge{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:20px;font-size:12px;font-weight:600}
.be{background:#FFF;color:var(--ka);border:1.5px solid var(--ka)}
.bc{background:#FFF;color:var(--ka);border:1.5px solid var(--ka)}
.bd2{background:#FFF;color:var(--ka);border:1.5px solid var(--ka)}
.br{background:#FFF;color:var(--ka);border:1.5px solid var(--ka)}

/* Progress bar on orange */
.pb{height:5px;background:#E5E7EB;border-radius:3px;overflow:hidden;margin-top:4px}
.pf{height:100%;border-radius:3px}
.pbb{height:8px;background:rgba(0,0,0,.2);border-radius:4px;overflow:hidden}
.pbf{height:100%;border-radius:4px}

/* ── INDIVIDUAL DASHBOARD ── */
.vi-wrap{padding:16px;background:var(--bg);min-height:100%}

.ind-hero{background:var(--black);border-radius:var(--r);padding:18px;display:flex;align-items:center;gap:14px;margin-bottom:16px}
.ind-ico{width:56px;height:56px;flex-shrink:0;background:rgba(240,120,0,.15);border-radius:50%;border:2px solid var(--ka);display:flex;align-items:center;justify-content:center}
.ind-ico i{font-size:24px;color:var(--ka)}
.ind-lvl{font-size:20px;font-weight:800;color:var(--ka)}
.ind-sub{font-size:12px;color:#888;margin-top:3px}

.cards3{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px}
.cards2{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px}
.icard{background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);padding:14px}
.icl{font-size:11px;color:var(--gray);text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px;font-weight:600}
.icv{font-size:18px;font-weight:700;color:var(--black)}
.ics{font-size:11px;color:var(--grayl);margin-top:3px}

.prog-sec{background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);padding:14px;margin-bottom:14px}
.prog-hd{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px}
.prog-label{font-size:13px;font-weight:600;color:var(--black)}
.prog-count{font-size:13px;color:var(--gray)}
.prog-hint{font-size:11px;color:var(--gray);margin-top:6px}

.ibox{background:#FFF7ED;border-left:3px solid var(--ka);border-radius:0 var(--rs) var(--rs) 0;padding:12px 14px;margin-bottom:14px}
.ibox-t{font-size:11px;font-weight:700;color:var(--gray);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;display:flex;align-items:center;gap:4px}
.irow{display:flex;align-items:flex-start;gap:7px;font-size:13px;color:var(--black);margin-bottom:7px;line-height:1.5}
.irow:last-child{margin-bottom:0}
.irow i{font-size:14px;margin-top:1px;flex-shrink:0}

/* Serviços section */
.servicos-sec{background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);padding:14px;margin-bottom:14px}
.servicos-hd{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
.servicos-title{font-size:13px;font-weight:600;color:var(--black)}
.servicos-meta{font-size:12px;color:var(--gray)}
.servicos-val{font-size:28px;font-weight:800;color:var(--black);margin-bottom:4px}
.servicos-hint{font-size:11px;color:var(--gray)}
.meta-undefined{font-size:12px;color:var(--grayl);font-style:italic}

/* Total remuneracao */
.remun-card{background:var(--black);border-radius:var(--r);padding:16px;margin-bottom:14px}
.remun-title{font-size:11px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px}
.remun-row{display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #1A1A1A}
.remun-row:last-child{border-bottom:none;padding-top:10px;margin-top:4px}
.remun-label{font-size:13px;color:#888}
.remun-val{font-size:13px;font-weight:600;color:var(--white)}
.remun-total-label{font-size:14px;font-weight:700;color:var(--ka)}
.remun-total-val{font-size:20px;font-weight:800;color:var(--ka)}


/* Vendor name pill */
.vname-pill{display:inline-block;background:#111;color:var(--ka);font-weight:700;padding:5px 14px;border-radius:8px;font-size:13px}
/* AP value orange */
.ap-val{font-weight:800;color:var(--ka);font-size:15px}

/* ── RANK CARDS (mobile) ── */
.rcard{background:#fff;border:1.5px solid #E5E7EB;border-radius:12px;padding:14px 16px;display:flex;align-items:center;gap:12px}
.rcard-pos{font-size:22px;min-width:36px;text-align:center;flex-shrink:0}
.rcard-body{flex:1;min-width:0}
.rcard-name{margin-bottom:6px}
.rcard-meta{font-size:12px;color:#9CA3AF;margin-bottom:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rcard-nums{display:flex;align-items:center;gap:12px}
.rcard-val{font-size:15px;font-weight:800;color:#F07800}
.rcard-ap{font-size:12px;color:#6B7280;background:#F3F4F6;padding:3px 8px;border-radius:6px}
.rcard-right{display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0}
/* ── ADMIN PANEL ── */
.admin-wrap{padding:16px;background:var(--bg);min-height:100%}
.admin-section{background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);padding:16px;margin-bottom:16px}
.admin-sec-title{font-size:12px;font-weight:700;color:var(--gray);text-transform:uppercase;letter-spacing:.5px;margin-bottom:14px;display:flex;align-items:center;gap:6px}

/* Admin table */
.atw{border:1px solid var(--border);border-radius:var(--rs);overflow:hidden;margin-bottom:12px}
.at{width:100%;border-collapse:collapse;font-size:13px}
.at th{background:var(--bg);padding:9px 11px;text-align:left;font-size:11px;font-weight:700;color:var(--gray);text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid var(--border)}
.at td{padding:8px 10px;border-bottom:1px solid #F3F3F3;vertical-align:middle}
.at tr:last-child td{border-bottom:none}
.at input[type=text],.at input[type=number],.at input[type=password]{padding:5px 8px;border:1.5px solid var(--border);border-radius:6px;font-size:13px;outline:none;width:100%}
.at input:focus{border-color:var(--ka)}
.at select{padding:5px 8px;border:1.5px solid var(--border);border-radius:6px;font-size:12px;outline:none;background:#fff;width:100%}
.at select:focus{border-color:var(--ka)}
.del-btn{background:none;border:none;cursor:pointer;color:#D1D5DB;font-size:16px;padding:3px 5px}
.del-btn:hover{color:#EF4444}
.socio-badge{font-size:11px;background:#F3F4F6;color:var(--gray);padding:2px 7px;border-radius:10px;white-space:nowrap}

/* Nivel config table */
.nivel-row{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;margin-bottom:10px;align-items:center}
.nivel-name{font-size:13px;font-weight:700}
.ni{padding:7px 10px;border:1.5px solid var(--border);border-radius:6px;font-size:13px;outline:none;width:100%}
.ni:focus{border-color:var(--ka)}

/* Buttons */
.btn{display:inline-flex;align-items:center;gap:6px;padding:9px 18px;border-radius:var(--rs);font-size:13px;font-weight:700;cursor:pointer;border:none;transition:all .15s}
.btn-p{background:var(--ka);color:#fff}.btn-p:hover{background:var(--kad)}.btn-p:disabled{background:#ccc;cursor:not-allowed}
.btn-g{background:#F3F4F6;color:var(--gray);border:1px solid var(--border)}.btn-g:hover{background:var(--border)}
.btn-d{background:#FEE2E2;color:#DC2626;border:1px solid #FECACA}.btn-d:hover{background:#FECACA}
.btn-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px}

/* Form inputs standalone */
.fi{padding:9px 12px;border:1.5px solid var(--border);border-radius:var(--rs);font-size:14px;outline:none;width:100%}
.fi:focus{border-color:var(--ka)}
.fl{font-size:12px;font-weight:700;color:var(--gray);text-transform:uppercase;letter-spacing:.4px;margin-bottom:5px;display:block}

/* Sync status */
.sync-msg{font-size:13px;padding:10px 14px;border-radius:var(--rs);margin-bottom:12px;display:none;align-items:center;gap:6px}
.sync-msg.ok{background:#F0FDF4;color:#16A34A;border:1px solid #BBF7D0;display:flex}
.sync-msg.err{background:#FEF2F2;color:#DC2626;border:1px solid #FECACA;display:flex}
.sync-msg.loading{background:#FFF7ED;color:#92400E;border:1px solid #FED7AA;display:flex}

/* Sócios row highlight */


/* RESPONSIVE */
@media(max-width:640px){
  /* Stats 2x2 */
  .hero-stats{grid-template-columns:1fr 1fr;gap:8px}
  .hsv{font-size:26px}
  /* Units stack */
  .unit-cards-row{grid-template-columns:1fr;gap:8px}
  .uc-name{font-size:20px}
  /* Hide table, show cards */
  .rank-table-wrap{display:none}
  .rank-cards{display:flex;flex-direction:column;gap:8px;margin-bottom:16px}
  /* Bottom nav */
  .tabs{position:fixed;bottom:0;left:0;right:0;border-top:1.5px solid #E5E7EB;border-bottom:none;justify-content:space-around;z-index:200;padding:0}
  .tab{flex:1;justify-content:center;padding:14px 8px;font-size:12px;flex-direction:column;align-items:center;gap:3px}
  .tab i{font-size:20px}
  .tab span{display:block;font-size:11px}
  /* Add bottom padding for fixed tabs */
  .vg-wrap,.vi-wrap,.admin-wrap{padding-bottom:80px}
  /* Topbar compact */
  .topbar{height:50px;padding:0 14px}
  /* Cards */
  .cards3{grid-template-columns:1fr 1fr}
  .cards2{grid-template-columns:1fr 1fr}
  /* Individual */
  .ind-hero{padding:14px}
  .ind-lvl{font-size:18px}
  /* Admin responsive */
  .nivel-row{grid-template-columns:1fr 1fr}
  .atw{overflow-x:auto}
}
@media(min-width:641px){
  .rank-cards{display:none}
}

/* Loading spinner */
@keyframes sp{to{transform:rotate(360deg)}}
.spin{animation:sp 1s linear infinite;display:inline-block}
</style>
</head>
<body>

<!-- ══ LOGIN ══════════════════════════════════════════════ -->
<div id="screen-login">
  <div class="login-card">
    <div class="login-logo">
      <img src="https://i.imgur.com/placeholder.png" id="login-logo-img" alt="King Alfa" style="display:none">
      <div style="font-size:22px;font-weight:800;color:#fff">GRUPO <span style="color:#F07800">KING ALFA</span></div>
      <div style="font-size:12px;color:#666;margin-top:4px;text-transform:uppercase;letter-spacing:.5px">Programa de Níveis</div>
    </div>

    <!-- STEP 1: Selecionar vendedor -->
    <div id="seller-step">
      <div class="login-title">Quem é você?</div>
      <div class="seller-list" id="seller-list-ui"></div>
    </div>

    <!-- STEP 2: PIN -->
    <div id="pin-step">
      <button class="pin-back" onclick="backToSeller()">
        <i class="ti ti-arrow-left"></i> Voltar
      </button>
      <div class="pin-name" id="pin-seller-name"></div>
      <div class="pin-hint">Digite seu PIN de 4 dígitos</div>
      <div class="pin-dots">
        <div class="pin-dot" id="d0"></div>
        <div class="pin-dot" id="d1"></div>
        <div class="pin-dot" id="d2"></div>
        <div class="pin-dot" id="d3"></div>
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

<!-- ══ CHANGE PIN ══════════════════════════════════════════ -->
<div id="screen-changepin">
  <div class="login-card">
    <div style="font-size:18px;font-weight:800;color:#fff;margin-bottom:6px">Altere seu PIN</div>
    <div style="font-size:13px;color:#666;margin-bottom:20px">Este é seu primeiro acesso. Defina um PIN de 4 dígitos.</div>
    <div style="margin-bottom:12px">
      <label class="fl" style="color:#888">Novo PIN</label>
      <input type="password" id="new-pin1" class="fi" style="background:#1A1A1A;border-color:#2A2A2A;color:#fff" maxlength="4" placeholder="••••">
    </div>
    <div style="margin-bottom:16px">
      <label class="fl" style="color:#888">Confirmar PIN</label>
      <input type="password" id="new-pin2" class="fi" style="background:#1A1A1A;border-color:#2A2A2A;color:#fff" maxlength="4" placeholder="••••">
    </div>
    <div id="changepin-err" style="color:#EF4444;font-size:12px;margin-bottom:10px;min-height:18px"></div>
    <button class="btn btn-p" style="width:100%" onclick="savePinChange()">Salvar PIN</button>
  </div>
</div>

<!-- ══ APP ════════════════════════════════════════════════ -->
<div id="screen-app">
  <div class="topbar">
    <div class="topbar-brand">
      <div style="font-size:15px;font-weight:800;color:#fff">GRUPO <span style="color:#F07800">KING ALFA</span></div>
    </div>
    <div class="topbar-right">
      <div class="topbar-user" id="topbar-user"></div>
      <button class="logout-btn" onclick="logout()" title="Sair"><i class="ti ti-logout"></i></button>
    </div>
  </div>

  <div class="tabs" id="main-tabs">
    <button class="tab on" id="tab-geral" onclick="showTab('geral')"><i class="ti ti-trophy"></i><span> Ranking</span></button>
    <button class="tab" id="tab-ind" onclick="showTab('ind')"><i class="ti ti-user-circle"></i><span> Meu Dashboard</span></button>
    <button class="tab" id="tab-admin" onclick="showTab('admin')" style="display:none"><i class="ti ti-settings"></i><span> Admin</span></button>
  </div>

  <!-- RANKING GERAL (orange) -->
  <div id="view-geral" class="view on">
    <div class="vg-wrap">
      <div id="geral-loading" style="text-align:center;padding:40px;color:rgba(255,255,255,.7)">
        <i class="ti ti-loader-2 spin" style="font-size:28px;display:block;margin-bottom:8px"></i>Carregando...
      </div>
      <div id="geral-content" style="display:none"></div>
    </div>
  </div>

  <!-- INDIVIDUAL -->
  <div id="view-ind" class="view">
    <div class="vi-wrap" id="ind-content">
      <div style="text-align:center;padding:40px;color:var(--gray)">
        <i class="ti ti-loader-2 spin" style="font-size:28px;display:block;margin-bottom:8px"></i>Carregando...
      </div>
    </div>
  </div>

  <!-- ADMIN -->
  <div id="view-admin" class="view">
    <div class="admin-wrap" id="admin-content"></div>
  </div>
</div>

<script>
// ══════════════════════════════════════════════
// CONFIGURAÇÃO
// ══════════════════════════════════════════════
var PROGRAMA_INICIO = '2026-07';
var JSONBIN_ID  = '6a3bdd8bf5f4af5e292909de';
var JSONBIN_KEY = '$2a$10$WzIxNTgN9XRQfPCpGeVPoODb0VwvPbZoZcVT6nRkodWl01uzLgvXW';
var API_BASE    = '/api';  // Cloudflare Workers — mesmo domínio

// ══════════════════════════════════════════════
// DADOS INICIAIS (JSONBin)
// ══════════════════════════════════════════════
var DEFAULT_DATA = {
  adminPin: '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', // SHA256 de 1234
  config: {
    niveis: [
      {id:0,nome:'Escudeiro',minAp:0, maxAp:20, pct:0.008},
      {id:1,nome:'Cavaleiro',minAp:21,maxAp:30, pct:0.0115},
      {id:2,nome:'Duque',    minAp:31,maxAp:40, pct:0.018},
      {id:3,nome:'Rei',      minAp:41,maxAp:9999,pct:0.02}
    ]
  },
  unidades: [
    {id:1, nome:'King 1 — Matriz',            nomeGC:'KING 01 - Matriz',          lojaId:'', metaServicos:null},
    {id:2, nome:'King 02 — Pq. Anhanguera',   nomeGC:'KING 02 - Pq. Anhanguera',  lojaId:'', metaServicos:null},
    {id:3, nome:'King 03 — Igualdade',         nomeGC:'KING 03 - Igualdade',       lojaId:'', metaServicos:null}
  ],
  vendedores: [
    // MATRIZ
    {id:1, nome:'King Garavelo',      nomesGC:['King Garavelo'],                      unidadeId:1, isSocio:true,  salario:0,    beneficios:0,   pin:'03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', pinInicial:true, metaServicos:null, nivelAtual:1, mesesAcima:0, mesesAbaixo:0},
    {id:2, nome:'Jamilly',            nomesGC:['Jamilly'],                             unidadeId:1, isSocio:false, salario:1722, beneficios:200, pin:'03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', pinInicial:true, metaServicos:null, nivelAtual:1, mesesAcima:0, mesesAbaixo:0},
    {id:3, nome:'Gabrielly',          nomesGC:['Gabrielly'],                           unidadeId:1, isSocio:false, salario:1722, beneficios:200, pin:'03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', pinInicial:true, metaServicos:null, nivelAtual:1, mesesAcima:0, mesesAbaixo:0},
    {id:4, nome:'Alexsander Celestino',nomesGC:['Alexsander Celestino'],              unidadeId:1, isSocio:true,  salario:0,    beneficios:0,   pin:'03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', pinInicial:true, metaServicos:null, nivelAtual:1, mesesAcima:0, mesesAbaixo:0},
    // ANHANGUERA
    {id:5, nome:'King Garavelo + Anhanguera', nomesGC:['King Garavelo','King Anhanguera'], unidadeId:2, isSocio:true, salario:0, beneficios:0, pin:'03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', pinInicial:true, metaServicos:null, nivelAtual:1, mesesAcima:0, mesesAbaixo:0},
    {id:6, nome:'Geovana',            nomesGC:['Geovana'],                             unidadeId:2, isSocio:false, salario:1722, beneficios:200, pin:'03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', pinInicial:true, metaServicos:null, nivelAtual:1, mesesAcima:0, mesesAbaixo:0},
    {id:7, nome:'Karen Tayene',       nomesGC:['Karen Tayene'],                        unidadeId:2, isSocio:true,  salario:0,    beneficios:0,   pin:'03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', pinInicial:true, metaServicos:null, nivelAtual:1, mesesAcima:0, mesesAbaixo:0},
    // IGUALDADE
    {id:8, nome:'King Alfa 3 Igualdade',nomesGC:['King Alfa 3 Igualdade'],             unidadeId:3, isSocio:true,  salario:0,    beneficios:0,   pin:'03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', pinInicial:true, metaServicos:null, nivelAtual:1, mesesAcima:0, mesesAbaixo:0},
    {id:9, nome:'Camila Lima',         nomesGC:['Camila Lima'],                         unidadeId:3, isSocio:false, salario:1722, beneficios:200, pin:'03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', pinInicial:true, metaServicos:null, nivelAtual:1, mesesAcima:0, mesesAbaixo:0},
    {id:10,nome:'Ana Clara',           nomesGC:['Ana Clara'],                           unidadeId:3, isSocio:false, salario:1722, beneficios:200, pin:'03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', pinInicial:true, metaServicos:null, nivelAtual:1, mesesAcima:0, mesesAbaixo:0},
    {id:11,nome:'Izadora Alves',       nomesGC:['Izadora Alves'],                       unidadeId:3, isSocio:false, salario:1722, beneficios:200, pin:'03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', pinInicial:true, metaServicos:null, nivelAtual:1, mesesAcima:0, mesesAbaixo:0},
  ]
};

// ══════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════
var appData = null;
var currentUser = null; // {id, nome, isAdmin}
var vendaCache = {}; // mes -> resposta da API
var pinBuffer = '';
var selectedSellerId = null;

// ══════════════════════════════════════════════
// UTILS
// ══════════════════════════════════════════════
async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
function g(id){return document.getElementById(id);}
function money(v){return'R$ '+Math.round(v||0).toLocaleString('pt-BR');}
function fmtMes(m){if(!m)return'';var p=m.split('-');var n=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];return n[parseInt(p[1])-1]+'/'+p[0];}
function curMes(){return new Date().toISOString().slice(0,7);}
function getLvl(ap, niveis){
  var lvls = niveis || appData.config.niveis;
  for(var i=lvls.length-1;i>=0;i--){if(ap>=lvls[i].minAp)return lvls[i];}
  return lvls[0];
}
function getUnidade(id){return (appData.unidades||[]).find(function(u){return u.id===id;});}
function getVendedor(id){return (appData.vendedores||[]).find(function(v){return v.id===id;});}

// ══════════════════════════════════════════════
// JSONBIN
// ══════════════════════════════════════════════
var jbConfigured = () => JSONBIN_ID!=='COLE_O_BIN_ID_AQUI';

async function loadData() {
  if (!jbConfigured()) { appData = JSON.parse(JSON.stringify(DEFAULT_DATA)); return; }
  try {
    const r = await fetch('https://api.jsonbin.io/v3/b/'+JSONBIN_ID+'/latest',{headers:{'X-Master-Key':JSONBIN_KEY,'X-Bin-Meta':'false'}});
    const j = await r.json();
    var rec = j.record||j;
    appData = (rec&&rec.vendedores) ? rec : DEFAULT_DATA;
  } catch(e) { appData = JSON.parse(JSON.stringify(DEFAULT_DATA)); }
}

async function saveData() {
  if (!jbConfigured()) return;
  await fetch('https://api.jsonbin.io/v3/b/'+JSONBIN_ID,{method:'PUT',headers:{'Content-Type':'application/json','X-Master-Key':JSONBIN_KEY},body:JSON.stringify(appData)});
}

// ══════════════════════════════════════════════
// GESTÃO CLICK API
// ══════════════════════════════════════════════
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
    // Return empty if API not configured or error
    return { mesAtual:{mes:mes,vendas:{}}, mesAnterior:{vendas:{}} };
  }
}

// Mesma normalização do worker (tira acento, "(VENDEDOR 2)", caixa)
function normNome(n) {
  return (n||'')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(new RegExp('\\([^)]*\\)','g'),'')
    .replace(new RegExp('\\s+','g'),' ').trim().toUpperCase();
}
// Mesma normalização do worker (tira acento, "(VENDEDOR 2)", caixa)
function normNomeFront(n) {
  var s = (n || '').normalize('NFD');
  var r = '';
  for (var i = 0; i < s.length; i++) {
    var code = s.charCodeAt(i);
    if (code >= 0x0300 && code <= 0x036f) continue; // pula acentos
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

// ══════════════════════════════════════════════
// LEVEL CALCULATION
// ══════════════════════════════════════════════
function calcNivel(vendedor, vendaAtual, vendaAnterior, mesAtual) {
  var niveis = appData.config.niveis;
  var apAtual    = vendaAtual.aparelhos;
  var apAnterior = vendaAnterior.aparelhos;

  // Antes do início do programa: nível baseado só no mês atual (sem regra de 2 meses)
  if (!mesAtual || mesAtual < PROGRAMA_INICIO) {
    // Calcula o nível diretamente pelos aparelhos do mês
    for (var j = niveis.length-1; j >= 0; j--) {
      if (apAtual >= niveis[j].minAp) return { nivel: j, status:'referencia', apAtual:apAtual };
    }
    return { nivel: 0, status:'referencia', apAtual:apAtual };
  }

  // A partir de julho: regra dos 2 meses
  var nivelAtual  = vendedor.nivelAtual || 0;
  var lvlAtual = niveis[nivelAtual];
  var lvlProx  = niveis[nivelAtual+1];
  var lvlAnt   = nivelAtual > 0 ? niveis[nivelAtual-1] : null;

  var subiuMesAnterior = lvlProx && apAnterior >= lvlProx.minAp;
  var subiuMesAtual    = lvlProx && apAtual    >= lvlProx.minAp;
  if (subiuMesAnterior && subiuMesAtual) {
    return { nivel: nivelAtual+1, status:'subiu', apAtual:apAtual };
  }

  var caiu1 = apAtual    < lvlAtual.minAp;
  var caiu2 = apAnterior < lvlAtual.minAp;
  if (caiu1 && caiu2 && lvlAnt) {
    return { nivel: nivelAtual-1, status:'desceu', apAtual:apAtual };
  }

  return { nivel: nivelAtual, status:'manteve', apAtual:apAtual };
}

// ══════════════════════════════════════════════
// LOGIN
// ══════════════════════════════════════════════
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
    '<i class="ti ti-chevron-right" style="font-size:14px;color:#555"></i>'+
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
  for (var i=0;i<4;i++) {
    g('d'+i).classList.toggle('filled', i < pinBuffer.length);
  }
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
    // Admin
    if (hash === appData.adminPin) {
      loginSuccess({id:-1, nome:'Admin', isAdmin:true});
    } else {
      g('pin-error').textContent = 'PIN incorreto';
      pinBuffer = ''; updatePinDots();
    }
    return;
  }

  var v = getVendedor(selectedSellerId);
  if (!v) return;
  if (hash === v.pin) {
    if (v.pinInicial) {
      // Force change PIN
      currentUser = {id:v.id, nome:v.nome, isAdmin:false};
      showScreen('changepin');
    } else {
      loginSuccess({id:v.id, nome:v.nome, isAdmin:false});
    }
  } else {
    g('pin-error').textContent = 'PIN incorreto';
    pinBuffer = ''; updatePinDots();
  }
}

async function savePinChange() {
  var p1 = g('new-pin1').value, p2 = g('new-pin2').value;
  g('changepin-err').textContent = '';
  if (p1.length !== 4 || !/^\d+$/.test(p1)) { g('changepin-err').textContent = 'PIN deve ter 4 dígitos numéricos'; return; }
  if (p1 !== p2) { g('changepin-err').textContent = 'PINs não coincidem'; return; }
  var hash = await sha256(p1);
  var v = getVendedor(currentUser.id);
  v.pin = hash; v.pinInicial = false;
  await saveData();
  loginSuccess(currentUser);
}

function loginSuccess(user) {
  currentUser = user;
  g('topbar-user').textContent = user.nome;
  if (user.isAdmin) {
    g('tab-admin').style.display = 'flex';
    g('tab-ind').style.display = 'none';
  } else {
    g('tab-admin').style.display = 'none';
    g('tab-ind').style.display = 'flex';
  }
  showScreen('app');
  showTab('geral');
}

function logout() {
  currentUser = null; vendaCache = {};
  showScreen('login');
  pinBuffer = ''; backToSeller();
}

// ══════════════════════════════════════════════
// SCREENS & TABS
// ══════════════════════════════════════════════
function showScreen(s) {
  ['login','changepin','app'].forEach(function(id){ g('screen-'+id).style.display='none'; });
  g('screen-'+s).style.display = s==='app' ? 'flex' : (s==='changepin'?'flex':'flex');
  g('screen-'+s).style.flexDirection = 'column';
}

function showTab(t) {
  ['geral','ind','admin'].forEach(function(id){
    g('view-'+id).classList.toggle('on', id===t);
    var tab=g('tab-'+id); if(tab) tab.classList.toggle('on',id===t);
  });
  if (t==='geral') renderGeral();
  if (t==='ind')   renderInd();
  if (t==='admin') renderAdmin();
}

// ══════════════════════════════════════════════
// RANKING GERAL
// ══════════════════════════════════════════════
async function renderGeral() {
  g('geral-loading').style.display='block';
  g('geral-content').style.display='none';

  var mes = curMes();
  var niveis = appData.config.niveis;
  var unidades = appData.unidades;
  var vendedores = appData.vendedores;

  // O worker já agrega as 3 lojas numa resposta só
  var allData = await fetchVendas(mes);

  // Build seller stats
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
      nivelId:   nivelCalc.nivel,
      status:    nivelCalc.status
    };
  }).sort(function(a,b){ return (b.valor||0) - (a.valor||0); });

  // Unit summaries
  var unitStats = unidades.map(function(u) {
    var us = sellerStats.filter(function(s){ return s.u&&s.u.id===u.id; });
    var totalAp = us.reduce(function(sum,s){ return sum+s.aparelhos; },0);
    var avgLvl = us.length ? us.reduce(function(sum,s){ return sum+s.nivelId; },0)/us.length : 0;
    return {u:u, totalAp:totalAp, avgLvl:avgLvl, count:us.length};
  }).sort(function(a,b){ return b.totalAp-a.totalAp; });

  var totalAp = sellerStats.reduce(function(s,x){ return s+x.aparelhos; },0);
  var mediaAp = sellerStats.length ? Math.round(totalAp/sellerStats.length) : 0;
  var best = sellerStats[0];

  // Cards de unidade (Líder / 2ª / 3ª)
  var uc = unitStats.map(function(us,i) {
    var label = i===0 ? 'Líder' : (i+1)+'ª';
    return '<div class="ucard-o'+(i===0?' lead':'')+'">'+
      '<div class="ucard-o-label">'+label+'</div>'+
      '<div class="ucard-o-name">'+us.u.nome+'</div>'+
      '<div class="ucard-o-meta">'+us.totalAp+' ap. · '+us.count+' vend.</div>'+
    '</div>';
  }).join('');

  // Linhas da tabela (desktop)
  var rows = sellerStats.map(function(s,i) {
    var nx = niveis[s.nivelId+1];
    var pct = nx ? Math.min(100,Math.round(s.aparelhos/nx.minAp*100)) : 100;
    var valorStr = 'R$ '+Math.round(s.valor||0).toLocaleString('pt-BR');
    var medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':'#'+(i+1);
    var nxtHtml = nx
      ? '<span style="font-size:11px;color:#9CA3AF">'+s.aparelhos+'/'+nx.minAp+'</span>'+
        '<div class="pb"><div class="pf" style="width:'+pct+'%;background:#F07800"></div></div>'
      : '<span style="font-size:11px;font-weight:700;color:#F07800">👑 Rei</span>';
    return '<tr><td style="font-weight:700;font-size:15px">'+medal+'</td>'+
      '<td><span class="vname-pill">'+s.v.nome+'</span></td>'+
      '<td style="font-size:12px;color:#9CA3AF">'+s.u.nome+'</td>'+
      '<td><span class="badge '+s.lvl.nome.toLowerCase().split(' ')[0].replace('escudeiro','be').replace('cavaleiro','bc').replace('duque','bd2').replace('rei','br')+'">'+s.lvl.nome+'</span></td>'+
      '<td style="font-weight:700;font-size:13px;color:#F07800">'+valorStr+'</td>'+
      '<td style="font-weight:700;color:#111">'+s.aparelhos+'</td>'+
      '<td style="min-width:90px">'+nxtHtml+'</td></tr>';
  }).join('');

  // Cards do ranking (mobile)
  var rcards = sellerStats.map(function(s,i) {
    var valorStr = 'R$ '+Math.round(s.valor||0).toLocaleString('pt-BR');
    var medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':'#'+(i+1);
    return '<div class="rcard">'+
      '<div class="rcard-pos">'+medal+'</div>'+
      '<div class="rcard-body">'+
      '<div class="rcard-name"><span class="vname-pill">'+s.v.nome+'</span></div>'+
      '<div class="rcard-meta">'+s.u.nome+' · '+s.lvl.nome+'</div>'+
      '<div class="rcard-nums">'+
      '<span class="rcard-val">'+valorStr+'</span>'+
      '<span class="rcard-ap">'+s.aparelhos+' ap.</span>'+
      '</div>'+
      '</div>'+
    '</div>';
  }).join('');

  g('geral-content').innerHTML =
    '<div class="hero-stats">'+
    '<div class="hstat"><div class="hsl">Total aparelhos</div><div class="hsv">'+totalAp+'</div><div class="hss">mês atual</div></div>'+
    '<div class="hstat"><div class="hsl">Média/vendedor</div><div class="hsv">'+mediaAp+'</div><div class="hss">aparelhos</div></div>'+
    '<div class="hstat"><div class="hsl">Melhor vendedor</div><div class="hsv" style="font-size:16px;line-height:1.3">'+(best?best.v.nome:'-')+'</div><div class="hss">'+(best?'R$ '+Math.round(best.valor||0).toLocaleString('pt-BR'):'')+'</div></div>'+
    '<div class="hstat"><div class="hsl">Mês</div><div class="hsv" style="font-size:16px">'+fmtMes(mes)+'</div></div>'+
    '</div>'+
    '<div class="unit-section">'+
    '<div class="sec-title"><i class="ti ti-building"></i> Ranking de Unidades</div>'+
    '<div class="unit-cards-row">'+uc+'</div></div>'+
    '<div class="sec-title" style="margin-top:16px"><i class="ti ti-list-numbers"></i> Ranking Individual</div>'+
    '<div class="rank-table-wrap"><table><thead><tr>'+
    '<th>#</th><th>Vendedor</th><th>Unidade</th><th>Nível</th><th>Valor</th><th>Ap.</th><th>Próximo</th>'+
    '</tr></thead><tbody>'+rows+'</tbody></table></div>'+
    '<div class="rank-cards">'+rcards+'</div>';

  g('geral-loading').style.display='none';
  g('geral-content').style.display='block';
}

// ══════════════════════════════════════════════
// INDIVIDUAL DASHBOARD
// ══════════════════════════════════════════════
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
  var commAp = v.isSocio ? 0 : Math.round(lvl.pct * 1646.18 * atualData.aparelhos);
  var total  = v.isSocio ? 0 : v.salario + v.beneficios + commAp;

  // Info messages
  var infos = [];
  if (nx) {
    if (gap>0) infos.push({i:'ti-arrow-up',c:'#F07800',t:'Faltam <strong>'+gap+' aparelhos</strong> para entrar na faixa de '+nx.nome+' este mês'});
    else infos.push({i:'ti-check',c:'#16A34A',t:'Você já está na faixa de <strong>'+nx.nome+'</strong>! Mantenha por mais 1 mês para ser promovido.'});
  } else {
    infos.push({i:'ti-crown',c:'#F07800',t:'Nível máximo! Mantenha 41+ aparelhos para defender a posição de Rei.'});
  }
  if (anteriorData.aparelhos < lvl.minAp && pv) {
    infos.push({i:'ti-alert-triangle',c:'#DC2626',t:'Atenção: mês anterior abaixo da meta de '+lvl.nome+'. Mais 1 mês assim e você desce para <strong>'+pv.nome+'</strong>.'});
  } else if (pv) {
    infos.push({i:'ti-shield-check',c:'#16A34A',t:'Nível seguro — mês anterior dentro da meta.'});
  }

  var metaServicos = v.metaServicos || (u?u.metaServicos:null);
  var servicosHtml = '<div class="servicos-sec">'+
  '<div class="servicos-hd">'+
  '<div class="servicos-title">Faturamento — '+fmtMes(mes)+'</div>'+
  '</div>'+
  '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px">'+
    '<div style="background:#FFF7ED;border-radius:8px;padding:10px 12px;border-left:3px solid #F07800">'+
      '<div style="font-size:11px;color:#6B7280;text-transform:uppercase;letter-spacing:.4px;font-weight:600;margin-bottom:4px">Aparelhos</div>'+
      '<div style="font-size:16px;font-weight:800;color:#111">'+money(atualData.valorAparelhos)+'</div>'+
      '<div style="font-size:11px;color:#9CA3AF;margin-top:2px">'+atualData.aparelhos+' un.</div>'+
    '</div>'+
    '<div style="background:#EFF6FF;border-radius:8px;padding:10px 12px;border-left:3px solid #2563EB">'+
      '<div style="font-size:11px;color:#6B7280;text-transform:uppercase;letter-spacing:.4px;font-weight:600;margin-bottom:4px">Serviços</div>'+
      '<div style="font-size:16px;font-weight:800;color:#111">'+money(atualData.valorServicos)+'</div>'+
      '<div style="font-size:11px;color:#9CA3AF;margin-top:2px">'+atualData.servicos+' un.</div>'+
    '</div>'+
    '<div style="background:#F0FDF4;border-radius:8px;padding:10px 12px;border-left:3px solid #16A34A">'+
      '<div style="font-size:11px;color:#6B7280;text-transform:uppercase;letter-spacing:.4px;font-weight:600;margin-bottom:4px">Balcão</div>'+
      '<div style="font-size:16px;font-weight:800;color:#111">'+money(atualData.valorBalcao)+'</div>'+
      '<div style="font-size:11px;color:#9CA3AF;margin-top:2px">'+atualData.balcao+' un.</div>'+
    '</div>'+
    '<div style="background:#111;border-radius:8px;padding:10px 12px">'+
      '<div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.4px;font-weight:600;margin-bottom:4px">Total</div>'+
      '<div style="font-size:16px;font-weight:800;color:#F07800">'+money(atualData.valor)+'</div>'+
      '<div style="font-size:11px;color:#666;margin-top:2px">'+(atualData.aparelhos+atualData.servicos+atualData.balcao)+' vendas</div>'+
    '</div>'+
  '</div>'+
'</div>';

  var remunHtml = v.isSocio ? '' :
    '<div class="remun-card">'+
    '<div class="remun-title"><i class="ti ti-cash" style="font-size:14px"></i> Remuneração estimada — '+fmtMes(mes)+'</div>'+
    '<div class="remun-row"><span class="remun-label">Salário fixo</span><span class="remun-val">'+money(v.salario)+'</span></div>'+
    '<div class="remun-row"><span class="remun-label">Benefícios</span><span class="remun-val">'+money(v.beneficios)+'</span></div>'+
    '<div class="remun-row"><span class="remun-label">Comissão financeiras ('+pctVal+')</span><span class="remun-val">'+money(commAp)+'</span></div>'+
    '<div class="remun-row"><span class="remun-total-label">Total estimado</span><span class="remun-total-val">'+money(total)+'</span></div>'+
    '</div>';

  var icoMap={'Escudeiro':'ti-sword','Cavaleiro':'ti-shield','Duque':'ti-crown','Rei':'ti-diamond'};
  var ico = icoMap[lvl.nome]||'ti-sword';

  g('ind-content').innerHTML =
    '<div class="ind-hero">'+
    '<div class="ind-ico"><i class="ti '+ico+'"></i></div>'+
    '<div>'+
    '<div style="font-size:11px;color:#777;text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px">'+v.nome+' · '+u.nome+'</div>'+
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
    '<div class="pbb"><div class="pbf" style="width:'+pct+'%;background:#F07800"></div></div>'+
    '<div class="prog-hint">'+(gap>0?'Faltam '+gap+' aparelhos':'Na faixa de '+nx.nome+'! Mantenha para ser promovido.')+'</div>'+
    '</div>':'')+

    servicosHtml +
    remunHtml +

    '<div class="ibox">'+
    '<div class="ibox-t"><i class="ti ti-info-circle"></i> O que você precisa saber</div>'+
    infos.map(function(n){return'<div class="irow"><i class="ti '+n.i+'" style="color:'+n.c+'"></i><span>'+n.t+'</span></div>';}).join('')+
    '</div>';
}

// ══════════════════════════════════════════════
// ADMIN PANEL
// ══════════════════════════════════════════════
function renderAdmin() {
  var niveis = appData.config.niveis;
  var unidades = appData.unidades;
  var vendedores = appData.vendedores;

  // Nível config
  var nivelRows = niveis.map(function(lv) {
    var icoMap={'Escudeiro':'⚔️','Cavaleiro':'🛡️','Duque':'👑','Rei':'💎'};
    return '<div class="nivel-row">'+
      '<div class="nivel-name">'+(icoMap[lv.nome]||'')+'  '+lv.nome+'</div>'+
      '<div><label class="fl">Min ap.</label><input class="ni" type="number" id="nv-min-'+lv.id+'" value="'+lv.minAp+'" min="0"></div>'+
      '<div><label class="fl">Max ap.</label><input class="ni" type="number" id="nv-max-'+lv.id+'" value="'+(lv.maxAp>=9999?'∞':lv.maxAp)+'" '+(lv.id===3?'disabled':'')+'></div>'+
      '<div><label class="fl">Comissão %</label><input class="ni" type="number" id="nv-pct-'+lv.id+'" value="'+(lv.pct*100).toFixed(3)+'" step="0.001" min="0" max="100"></div>'+
    '</div>';
  }).join('');

  // Metas de serviços por unidade
  var metasUnidadeHtml = unidades.map(function(u) {
    return '<tr><td style="font-weight:600">'+u.nome+'</td>'+
      '<td><input type="number" id="meta-u-'+u.id+'" value="'+(u.metaServicos||'')+'" placeholder="Sem meta" min="0" style="width:100px;padding:5px 8px;border:1.5px solid var(--border);border-radius:6px;font-size:13px;outline:none"></td></tr>';
  }).join('');

  // Vendors table
  var vendRows = vendedores.map(function(v) {
    var u = getUnidade(v.unidadeId);
    return '<tr class="'+(v.isSocio?'socio-row':'')+'">'+
      '<td><input type="text" class="adm-nome" data-id="'+v.id+'" value="'+v.nome+'" style="min-width:130px"></td>'+
      '<td><select class="adm-unit" data-id="'+v.id+'">'+
        unidades.map(function(u2){return'<option value="'+u2.id+'"'+(u2.id===v.unidadeId?' selected':'')+'>'+u2.nome+'</option>';}).join('')+
      '</select></td>'+
      '<td>'+(v.isSocio?'<span class="socio-badge">Sócio</span>':'<input type="number" class="adm-sal" data-id="'+v.id+'" value="'+v.salario+'" min="0" style="width:90px">')+'</td>'+
      '<td>'+(v.isSocio?'—':'<input type="number" class="adm-ben" data-id="'+v.id+'" value="'+v.beneficios+'" min="0" style="width:80px">')+'</td>'+
      '<td><input type="number" class="adm-meta" data-id="'+v.id+'" value="'+(v.metaServicos||'')+'" placeholder="—" min="0" style="width:70px"></td>'+
      '<td><button class="btn btn-g" onclick="resetPin('+v.id+')" style="font-size:12px;padding:5px 10px"><i class="ti ti-refresh" style="font-size:13px"></i> 1234</button></td>'+
      '<td><button class="del-btn" onclick="deleteVendedor('+v.id+')" title="Remover"><i class="ti ti-trash"></i></button></td>'+
    '</tr>';
  }).join('');

  // Admin PIN change
  g('admin-content').innerHTML =
    // Sync button
    '<div class="admin-section">'+
    '<div class="admin-sec-title"><i class="ti ti-refresh"></i> Sincronização</div>'+
    '<div id="sync-msg" class="sync-msg"></div>'+
    '<p style="font-size:13px;color:var(--gray);margin-bottom:12px">Clique para buscar os dados do mês atual no Gestão Click e recalcular os níveis de todos os vendedores.</p>'+
    '<button class="btn btn-p" onclick="syncGestaoClick()"><i class="ti ti-cloud-download"></i> Sincronizar com Gestão Click</button>'+
    '</div>'+

    // Níveis
    '<div class="admin-section">'+
    '<div class="admin-sec-title"><i class="ti ti-stairs-up"></i> Configuração dos Níveis</div>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;margin-bottom:8px;padding:0 0 6px">'+
    '<div style="font-size:11px;color:var(--gray);font-weight:700;text-transform:uppercase;letter-spacing:.4px">Nível</div>'+
    '<div style="font-size:11px;color:var(--gray);font-weight:700;text-transform:uppercase;letter-spacing:.4px">Min ap.</div>'+
    '<div style="font-size:11px;color:var(--gray);font-weight:700;text-transform:uppercase;letter-spacing:.4px">Max ap.</div>'+
    '<div style="font-size:11px;color:var(--gray);font-weight:700;text-transform:uppercase;letter-spacing:.4px">Comissão %</div>'+
    '</div>'+
    nivelRows+
    '<div class="btn-row"><button class="btn btn-p" onclick="saveNiveis()"><i class="ti ti-device-floppy"></i> Salvar níveis</button></div>'+
    '</div>'+

    // Metas por unidade
    '<div class="admin-section">'+
    '<div class="admin-sec-title"><i class="ti ti-target"></i> Meta de Serviços/Produtos por Unidade</div>'+
    '<div class="atw"><table class="at"><thead><tr><th>Unidade</th><th>Meta mensal</th></tr></thead><tbody>'+metasUnidadeHtml+'</tbody></table></div>'+
    '<div class="btn-row"><button class="btn btn-p" onclick="saveMetasUnidade()"><i class="ti ti-device-floppy"></i> Salvar metas</button></div>'+
    '</div>'+

    // Vendedores
    '<div class="admin-section">'+
    '<div class="admin-sec-title"><i class="ti ti-users"></i> Vendedores</div>'+
    '<div class="atw" style="overflow-x:auto"><table class="at"><thead><tr>'+
    '<th>Nome</th><th>Unidade</th><th>Salário</th><th>Benefícios</th><th>Meta Serv.</th><th>PIN</th><th></th>'+
    '</tr></thead><tbody id="vend-tbody">'+vendRows+'</tbody></table></div>'+
    '<div class="btn-row">'+
    '<button class="btn btn-g" onclick="addVendedor()"><i class="ti ti-user-plus"></i> Adicionar</button>'+
    '<button class="btn btn-p" onclick="saveVendedores()"><i class="ti ti-device-floppy"></i> Salvar vendedores</button>'+
    '</div></div>'+

    // Admin PIN
    '<div class="admin-section">'+
    '<div class="admin-sec-title"><i class="ti ti-lock"></i> Alterar PIN do Admin</div>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">'+
    '<div><label class="fl">Novo PIN</label><input type="password" id="adm-pin1" class="fi" maxlength="4" placeholder="••••"></div>'+
    '<div><label class="fl">Confirmar</label><input type="password" id="adm-pin2" class="fi" maxlength="4" placeholder="••••"></div>'+
    '</div>'+
    '<div id="adm-pin-err" style="color:#DC2626;font-size:12px;margin-bottom:8px;min-height:16px"></div>'+
    '<button class="btn btn-p" onclick="saveAdminPin()"><i class="ti ti-device-floppy"></i> Salvar PIN admin</button>'+
    '</div>';
}

// Admin actions
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
    u.metaServicos = el && el.value ? parseInt(el.value) : null;
  });
  await saveData();
  alert('Metas por unidade salvas!');
}

function addVendedor() {
  var maxId = Math.max.apply(null, appData.vendedores.map(function(v){return v.id;}));
  var newV = {
    id: maxId+1, nome:'Novo Vendedor', nomesGC:[''], unidadeId:1,
    isSocio:false, salario:1722, beneficios:200,
    pin:'03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4',
    pinInicial:true, metaServicos:null, nivelAtual:1, mesesAcima:0, mesesAbaixo:0
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
    if (v) v.metaServicos = el.value ? parseInt(el.value) : null;
  });
  await saveData();
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
      // Update consecutive months
      var lvl = niveis[v.nivelAtual]||niveis[0];
      var nx  = niveis[v.nivelAtual+1];
      v.mesesAcima  = (nx && atualData.aparelhos >= nx.minAp) ? (v.mesesAcima||0)+1 : 0;
      v.mesesAbaixo = (atualData.aparelhos < lvl.minAp) ? (v.mesesAbaixo||0)+1 : 0;
    });

    await saveData();
    msg.className='sync-msg ok';
    msg.innerHTML='<i class="ti ti-check"></i> Sincronização concluída! Níveis recalculados.';
  } catch(e) {
    msg.className='sync-msg err';
    msg.innerHTML='<i class="ti ti-alert-circle"></i> Erro: '+e.message;
  }
}

// ══════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = {'Access-Control-Allow-Origin':'*','Content-Type':'application/json'};

    if (url.pathname === '/api/vendas') {
      if (request.method === 'OPTIONS') return new Response(null, {headers:cors});
      const mes = url.searchParams.get('mes');
      const debugParam = url.searchParams.get('debug');
      if (!mes) return new Response(JSON.stringify({error:'mes obrigatorio'}),{status:400,headers:cors});

      // debug=2: diagnóstico cru. Bate em cada loja (página 1) e mostra status HTTP,
      // se os tokens estão configurados, quantas vendas vieram e quais situações.
      // Serve pra descobrir POR QUE o ranking vem vazio.
      if (debugParam === '2') {
        // Ferramenta de reconciliação. Puxa o mês inteiro (todas as páginas, 3 lojas),
        // soma o dinheiro por situação, e — com &vendedor=alexsander — lista as vendas
        // cruas daquele vendedor (situação + valor) pra achar dinheiro que sumiu no filtro.
        const filtro = (url.searchParams.get('vendedor')||'').trim().toLowerCase();
        const [d1,d2,d3] = await Promise.all([
          fetchVendasMes(mes, LOJAS[0].id, env),
          fetchVendasMes(mes, LOJAS[1].id, env),
          fetchVendasMes(mes, LOJAS[2].id, env),
        ]);
        const todas = [...d1, ...d2, ...d3];

        // Quanto dinheiro existe em cada situação (e quantas vendas)
        const situacoes = {};
        todas.forEach(function(v){
          const s = (v.nome_situacao||'(vazio)');
          if (!situacoes[s]) situacoes[s] = { qtd:0, valor:0, contaNoApp: !!classify(s) };
          situacoes[s].qtd++;
          situacoes[s].valor += parseFloat(v.valor_total||0);
        });
        Object.keys(situacoes).forEach(function(k){ situacoes[k].valor = Math.round(situacoes[k].valor); });

        // ROSTER por vendedor_id: a verdade. Cada id, todos os nomes que ele aparece,
        // e os totais corretos (já com a regra de NF descartada). É o que casa por id.
        const roster = {};
        todas.forEach(function(v){
          const id = v.vendedor_id || '(sem_id)';
          if (!roster[id]) roster[id] = { nomes:{}, aparelhos:0, servicos:0, valor:0, ignoradas:0 };
          const nm = (v.nome_vendedor||'(sem_nome)');
          roster[id].nomes[nm] = (roster[id].nomes[nm]||0)+1;
          const tipo = classify(v.nome_situacao||'');
          if (!tipo) { roster[id].ignoradas++; return; }
          if (tipo==='aparelho') roster[id].aparelhos++; else roster[id].servicos++;
          roster[id].valor += parseFloat(v.valor_total||0);
        });
        Object.keys(roster).forEach(function(id){
          roster[id].valor = Math.round(roster[id].valor);
          roster[id].nomes = Object.keys(roster[id].nomes);
        });

        // Dump cru das vendas de um vendedor específico
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

      // debug=3: puxa o mês SEM filtro de loja. Revela vendas em lojas/PDV não
      // configurados (ex.: o balcão "Consumidor"). Quebra por nome_loja + situação.
      if (debugParam === '3') {
        const [yy,mm] = mes.split('-');
        const ultimoD = new Date(parseInt(yy), parseInt(mm), 0).getDate();
        const inicioD = mes+'-01';
        const fimD    = mes+'-'+ultimoD;
        let page=1, all=[], hasMore=true, guard=0;
        while (hasMore && guard++ < 60) {
          const u = GC_BASE+'/vendas?data_inicio='+inicioD+'&data_fim='+fimD+'&limite=100&pagina='+page;
          const res = await fetch(u, {headers:{
            'access-token': env.GC_ACCESS_TOKEN,
            'secret-access-token': env.GC_SECRET_TOKEN,
            'Content-Type':'application/json'
          }});
          const j = await res.json();
          const items = j.data || [];
          all = all.concat(items);
          const total = parseInt((j.meta||{}).total_registros || 0);
          hasMore = items.length === 100 && all.length < total;
          page++;
        }
        const porLoja = {};
        all.forEach(function(v){
          const k = (v.nome_loja||'(sem nome_loja)');
          if (!porLoja[k]) porLoja[k] = { qtd:0, valor:0, situacoes:{}, lojaIds:{} };
          porLoja[k].qtd++;
          porLoja[k].valor += parseFloat(v.valor_total||0);
          const s = (v.nome_situacao||'(vazio)');
          porLoja[k].situacoes[s] = (porLoja[k].situacoes[s]||0)+1;
          const lid = v.loja_id!=null ? String(v.loja_id) : '?';
          porLoja[k].lojaIds[lid] = (porLoja[k].lojaIds[lid]||0)+1;
        });
        Object.keys(porLoja).forEach(function(k){ porLoja[k].valor = Math.round(porLoja[k].valor); });
        const lojasConfiguradas = LOJAS.map(function(l){ return l.id; });
        return new Response(JSON.stringify({
          totalVendasMes: all.length,
          lojasConfiguradasNoApp: lojasConfiguradas,
          porLoja: porLoja
        }, null, 2), {headers:cors});
      } if (debugParam === '5') {
  // Lista TODAS as lojas/PDVs cadastrados no Gestão Click
  const res = await fetch(GC_BASE+'/lojas', {headers:{
    'access-token': env.GC_ACCESS_TOKEN,
    'secret-access-token': env.GC_SECRET_TOKEN,
    'Content-Type':'application/json'
  }});
  const j = await res.json();
  return new Response(JSON.stringify({
    statusHTTP: res.status,
    lojasCadastradasNoGestaoClick: j,
    lojasConfiguradasNoApp: LOJAS.map(function(l){ return l.id; })
  }, null, 2), {headers:cors});
}if (debugParam === '6') {
  // Puxa vendas do mês especificamente da loja 559864 (FINANCEIRO)
  // pra ver se é lá que cai o balcão "Consumidor"
  const [yy,mm] = mes.split('-');
  const ultimoD = new Date(parseInt(yy), parseInt(mm), 0).getDate();
  const inicioD = mes+'-01';
  const fimD    = mes+'-'+ultimoD;
  let page=1, all=[], hasMore=true, guard=0;
  while (hasMore && guard++ < 60) {
    const u = GC_BASE+'/vendas?data_inicio='+inicioD+'&data_fim='+fimD+'&loja_id=559864&limite=100&pagina='+page;
    const res = await fetch(u, {headers:{
      'access-token': env.GC_ACCESS_TOKEN,
      'secret-access-token': env.GC_SECRET_TOKEN,
      'Content-Type':'application/json'
    }});
    const j = await res.json();
    const items = j.data || [];
    all = all.concat(items);
    const total = parseInt((j.meta||{}).total_registros || 0);
    hasMore = items.length === 100 && all.length < total;
    page++;
  }
  const porVendedor = {};
  const situacoes = {};
  const amostraClientes = [];
  all.forEach(function(v){
    const nm = (v.nome_vendedor||'(sem vendedor)');
    porVendedor[nm] = (porVendedor[nm]||0)+1;
    const s = (v.nome_situacao||'(vazio)');
    situacoes[s] = (situacoes[s]||0)+1;
    if (amostraClientes.length < 10) {
      amostraClientes.push({
        cliente: v.nome_cliente || v.cliente || '(sem cliente)',
        vendedor: v.nome_vendedor || '(sem vendedor)',
        situacao: v.nome_situacao,
        valor: v.valor_total,
        data: v.data
      });
    }
  });
  return new Response(JSON.stringify({
    lojaTestada: '559864 (FINANCEIRO)',
    totalVendas: all.length,
    porVendedor: porVendedor,
    situacoes: situacoes,
    amostraClientes: amostraClientes
  }, null, 2), {headers:cors});
}if (debugParam === '7') {
  // Caça vendas com cliente "Consumidor" nas 3 lojas configuradas
  const [yy,mm] = mes.split('-');
  const ultimoD = new Date(parseInt(yy), parseInt(mm), 0).getDate();
  const inicioD = mes+'-01';
  const fimD    = mes+'-'+ultimoD;
  const resultadoPorLoja = {};
  for (const loja of LOJAS) {
    let page=1, all=[], hasMore=true, guard=0;
    while (hasMore && guard++ < 60) {
      const u = GC_BASE+'/vendas?data_inicio='+inicioD+'&data_fim='+fimD+'&loja_id='+loja.id+'&limite=100&pagina='+page;
      const res = await fetch(u, {headers:{
        'access-token': env.GC_ACCESS_TOKEN,
        'secret-access-token': env.GC_SECRET_TOKEN,
        'Content-Type':'application/json'
      }});
      const j = await res.json();
      const items = j.data || [];
      all = all.concat(items);
      const total = parseInt((j.meta||{}).total_registros || 0);
      hasMore = items.length === 100 && all.length < total;
      page++;
    }
    // Filtra: cliente "Consumidor" OU sem vendedor
    const suspeitas = all.filter(function(v){
      const cli = (v.nome_cliente||v.cliente||'').toLowerCase();
      const semVend = !v.vendedor_id || v.vendedor_id === '' || !v.nome_vendedor;
      return cli.includes('consumidor') || semVend;
    });
    resultadoPorLoja[loja.id] = {
      totalVendasNaLoja: all.length,
      qtdSuspeitas: suspeitas.length,
      amostra: suspeitas.slice(0, 15).map(function(v){
        return {
          cliente: v.nome_cliente || v.cliente,
          vendedor_id: v.vendedor_id,
          nome_vendedor: v.nome_vendedor,
          situacao: v.nome_situacao,
          valor: v.valor_total,
          data: v.data
        };
      })
    };
  }
  return new Response(JSON.stringify(resultadoPorLoja, null, 2), {headers:cors});
}if (debugParam === '8') {
  // Testa endpoints candidatos pra venda de balcão/PDV
  const [yy,mm] = mes.split('-');
  const ultimoD = new Date(parseInt(yy), parseInt(mm), 0).getDate();
  const inicioD = mes+'-01';
  const fimD    = mes+'-'+ultimoD;
  const candidatos = [
    '/pdv',
    '/balcao',
    '/vendas-balcao',
    '/vendas/balcao',
    '/pdv/vendas',
    '/caixa',
    '/caixas',
    '/vendas?tipo=balcao'
  ];
  const resultado = {};
  for (const ep of candidatos) {
    const sep = ep.includes('?') ? '&' : '?';
    const u = GC_BASE+ep+sep+'data_inicio='+inicioD+'&data_fim='+fimD+'&limite=5&pagina=1';
    try {
      const res = await fetch(u, {headers:{
        'access-token': env.GC_ACCESS_TOKEN,
        'secret-access-token': env.GC_SECRET_TOKEN,
        'Content-Type':'application/json'
      }});
      let body = null;
      try { body = await res.json(); } catch(e) { body = '(resposta não-JSON)'; }
      resultado[ep] = {
        statusHTTP: res.status,
        totalRegistros: body && body.meta ? body.meta.total_registros : null,
        qtdNaPaginaAtual: body && body.data ? body.data.length : null,
        amostraPrimeiroRegistro: body && body.data && body.data[0] ? body.data[0] : null,
        respostaCrua: (!body || !body.data) ? body : undefined
      };
    } catch(e) {
      resultado[ep] = { erro: e.message };
    }
  }
  return new Response(JSON.stringify(resultado, null, 2), {headers:cors});
}if (debugParam === '9') {
  // Testa tipo=vendas_balcao nas 3 lojas (conforme doc oficial Gestão Click)
  const [yy,mm] = mes.split('-');
  const ultimoD = new Date(parseInt(yy), parseInt(mm), 0).getDate();
  const inicioD = mes+'-01';
  const fimD    = mes+'-'+ultimoD;
  const resultado = {};
  for (const loja of LOJAS) {
    let page=1, all=[], hasMore=true, guard=0;
    while (hasMore && guard++ < 60) {
      const u = GC_BASE+'/vendas?tipo=vendas_balcao&data_inicio='+inicioD+'&data_fim='+fimD+'&loja_id='+loja.id+'&limite=100&pagina='+page;
      const res = await fetch(u, {headers:{
        'access-token': env.GC_ACCESS_TOKEN,
        'secret-access-token': env.GC_SECRET_TOKEN,
        'Content-Type':'application/json'
      }});
      const j = await res.json();
      const items = j.data || [];
      all = all.concat(items);
      const total = parseInt((j.meta||{}).total_registros || 0);
      hasMore = items.length === 100 && all.length < total;
      page++;
    }
    const porVendedor = {};
    const situacoes = {};
    let valorTotal = 0;
    all.forEach(function(v){
      const nm = (v.nome_vendedor||'(sem vendedor)');
      porVendedor[nm] = (porVendedor[nm]||0)+1;
      const s = (v.nome_situacao||'(vazio)');
      situacoes[s] = (situacoes[s]||0)+1;
      valorTotal += parseFloat(v.valor_total||0);
    });
    resultado[loja.id] = {
      qtdVendas: all.length,
      valorTotal: Math.round(valorTotal),
      porVendedor: porVendedor,
      situacoes: situacoes,
      amostra: all.slice(0,3).map(function(v){
        return {
          codigo: v.codigo,
          cliente: v.nome_cliente,
          vendedor: v.nome_vendedor,
          situacao: v.nome_situacao,
          valor: v.valor_total,
          data: v.data
        };
      })
    };
  }
  return new Response(JSON.stringify(resultado, null, 2), {headers:cors});
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

    return new Response(HTML, {headers:{'Content-Type':'text/html;charset=UTF-8'}});
  }
};
