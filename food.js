'use strict';

const FOOD = {
  immer: [['', 'Bananennektar 1 L', 550], ['', 'Wasser 1,5 L', 0]],
  plaene: {
    frei: { n: 'Ohne Training', m: [
      ['07:30', 'Bäcker / Einkauf', 0],
      ['08:30', '150 g Müsli + 400 ml Milch + 1 Isoclear', 1050],
      ['12:00', '2 Tiger-Brötchen', 1000],
      ['15:00', 'Shake: 400 ml Milch, 60 g Haferflocken, 1 Banane, 2 Löffel Whey', 800],
      ['18:00', 'Abendessen', 1000],
      ['21:00', '50 g Nüsse', 300],
    ] },
    frueh: { n: 'Training morgens', m: [
      ['05:30', '1 Banane', 100],
      ['06:00–08:00', 'Training, danach 1 Isoclear', 100],
      ['08:30', 'Bäcker, dann 150 g Müsli + 400 ml Milch', 950],
      ['12:00', '2 Tiger-Brötchen', 1000],
      ['15:00', 'Shake: 400 ml Milch, 60 g Haferflocken, 1 Banane, 2 Löffel Whey', 800],
      ['18:00', 'Abendessen', 1000],
      ['21:00', '50 g Nüsse', 300],
    ] },
    fr: { n: 'Training nachmittags', m: [
      ['07:30', 'Bäcker / Einkauf', 0],
      ['08:30', '150 g Müsli + 400 ml Milch + 1 Isoclear', 1050],
      ['12:00', '2 Tiger-Brötchen', 1000],
      ['14:00', '1 Banane', 100],
      ['14:30–16:30', 'Training', 0],
      ['16:45', 'Shake: 400 ml Milch, 60 g Haferflocken, 1 Banane, 2 Löffel Whey', 800],
      ['18:00', 'Abendessen', 1000],
      ['21:00', '50 g Nüsse', 300],
    ] },
    we: { n: 'Training vormittags', m: [
      ['08:15', '1 Banane', 100],
      ['09:00–11:30', 'Training, danach 1 Isoclear', 100],
      ['11:45', 'Bäcker / Einkauf', 0],
      ['12:30', '150 g Müsli + 400 ml Milch + 2 Tiger-Brötchen', 1950],
      ['15:30', 'Shake: 400 ml Milch, 60 g Haferflocken, 1 Banane, 2 Löffel Whey', 800],
      ['18:00', 'Abendessen', 1000],
      ['21:00', '50 g Nüsse', 300],
    ] },
  },
  tage: ['we', 'frei', 'frueh', 'frei', 'frueh', 'frei', 'we'],
  freitagMitTraining: 'fr',
  zutaten: {
    '150 g Müsli + 400 ml Milch + 1 Isoclear': { muesli: 150, milch: 0.4, iso: 1 },
    'Bäcker, dann 150 g Müsli + 400 ml Milch': { muesli: 150, milch: 0.4 },
    '150 g Müsli + 400 ml Milch + 2 Tiger-Brötchen': { muesli: 150, milch: 0.4 },
    'Training, danach 1 Isoclear': { iso: 1 },
    '1 Banane': { banane: 1 },
    'Shake: 400 ml Milch, 60 g Haferflocken, 1 Banane, 2 Löffel Whey': { milch: 0.4, hafer: 60, banane: 1, whey: 1 },
    '50 g Nüsse': { nuss: 50 },
    'Bananennektar 1 L': { nektar: 1 },
    'Wasser 1,5 L': { wasser: 1 },
  },
  vorrat: {
    milch: ['H-Milch', 'L', 1, '1 L'],
    nektar: ['Bananennektar', 'L', 1, '1 L'],
    muesli: ['Müsli', 'g', 750, '750 g'],
    hafer: ['Haferflocken', 'g', 500, '500 g'],
    nuss: ['Nüsse', 'g', 300, '300 g'],
    banane: ['Bananen', 'Stück', 1, ''],
    wasser: ['Wasser', 'Flaschen', 1, '1,5 L'],
    pizza: ['TK-Pizza (Backup)', 'Stück', 1, ''],
    whey: ['Whey', 'Portionen', 1, '', true],
    iso: ['Isoclear', 'Portionen', 1, '', true],
  },
  einkaufTage: [2, 3, 4],
  abendessen: 'Abendessen',
  pizza: { n: 'TK-Pizza (Backup)', kcal: 950, vorrat: 2 },
};

const FL = 'eisenlog-food';
let F = { saved: 0, d: {}, st: {}, h: 3, pk: 0 }, fSel = null;
const kc = n => n.toLocaleString('de-DE');
const fx = n => String(Math.round(n * 100) / 100).replace('.', ',');
const toMin = s => +s.slice(0, 2) * 60 + +s.slice(3);
const pkcal = () => F.pk || FOOD.pizza.kcal;
const stk = id => F.st[id] || 0;
const addSt = (id, v) => { F.st[id] = Math.max(0, Math.round((stk(id) + v) * 1000) / 1000); };
const useMeal = (w, s) => { const z = FOOD.zutaten[w]; if (z) for (const k in z) addSt(k, -s * z[k]); };
const fdRec = d => F.d[d] || (F.d[d] = { c: [], fr: false, ae: null, pp: 0, b: {}, k: 0, g: 0 });
const eatenOf = (p, r) => p.m.filter(x => x.pz || r.c.includes(x.w)).reduce((a, x) => a + x.k, 0);
const tgl = (l, x) => { const i = l.indexOf(x); if (i < 0) l.push(x); else l.splice(i, 1); };

function fdPlan(d) {
  const wd = dateOf(d).getDay(), r = F.d[d] || {}, m = [];
  const p = FOOD.plaene[wd === 5 && r.fr ? FOOD.freitagMitTraining : FOOD.tage[wd]], base = p.m.concat(FOOD.immer);
  for (const [z, w, k] of base) {
    if (w !== FOOD.abendessen) { m.push({ z, w, k }); continue; }
    m.push({ z, w, k: r.ae != null ? r.ae : k, est: r.ae != null, k0: k });
    if (r.pp) m.push({ z, w: `1 ${FOOD.pizza.n}`, k: pkcal(), pz: true });
  }
  return { n: p.n, m, g: base.reduce((a, x) => a + x[2], 0) };
}
function usage(n) {
  const t = todayIso(), r0 = F.d[t] || { c: [] };
  return Array.from({ length: n }, (_, i) => {
    const x = dateOf(t); x.setDate(x.getDate() + i);
    const u = {};
    for (const m of fdPlan(iso(x)).m) if (!(i === 0 && r0.c.includes(m.w))) { const z = FOOD.zutaten[m.w]; if (z) for (const k in z) u[k] = (u[k] || 0) + z[k]; }
    return u;
  });
}

async function foodLoad() {
  let a = null, b = null;
  try { a = JSON.parse((await idbGet('food')) || 'null'); } catch (e) {}
  try { b = JSON.parse(localStorage.getItem(FL) || 'null'); } catch (e) {}
  const s = a && b ? ((a.saved || 0) >= (b.saved || 0) ? a : b) : (a || b);
  if (s) F = { saved: s.saved || 0, d: s.d || {}, st: s.st || (s.pz ? { pizza: +s.pz } : {}), h: s.h || 3, pk: +s.pk || 0 };
}
function foodSave() {
  F.saved = Date.now();
  const t = JSON.stringify(F);
  try { localStorage.setItem(FL, t); } catch (e) {}
  idbPut('food', t).catch(() => {});
}
function foodImport(j) {
  if (!j || typeof j !== 'object') return;
  const arr = a => Array.isArray(a) ? a.filter(x => typeof x === 'string' && x.length < 200).slice(0, 60) : [];
  const num = (x, max) => x != null && isFinite(+x) && +x >= 0 && +x <= max ? +x : null;
  const map = o => { const out = {}; if (o && typeof o === 'object') for (const k in o) if (k in FOOD.vorrat && num(o[k], 1e5) != null) out[k] = +o[k]; return out; };
  if (!Object.keys(F.d).length) { F.st = j.st ? map(j.st) : { pizza: num(j.pz, 50) || 0 }; F.h = FOOD.einkaufTage.includes(j.h) ? j.h : 3; F.pk = num(j.pk, 3000) || 0; }
  for (const [d, r] of Object.entries(j.d || {})) if (DATE_RE.test(d) && r && typeof r === 'object' && !F.d[d])
    F.d[d] = { c: arr(r.c), fr: !!r.fr, ae: num(r.ae, 5000), pp: r.pp ? 1 : 0, b: map(r.b), k: +r.k || 0, g: +r.g || 0 };
  foodSave(); foodRender();
}

function foodRender() {
  const el = $('food'), t = todayIso(), d = fSel || t, now = new Date(), wd = dateOf(d).getDay(), nm = now.getHours() * 60 + now.getMinutes();
  const r = F.d[d] || { c: [], fr: false, ae: null, pp: 0 }, rt = F.d[t] || {}, bt = rt.b || {}, p = fdPlan(d), eaten = eatenOf(p, r), U = usage(7);
  const op = {};
  el.querySelectorAll('details[data-k]').forEach(x => { op[x.dataset.k] = x.open; });
  const nx = d === t && p.m.find(x => { const tt = x.z.match(/\d\d:\d\d/g); return tt && !x.pz && !r.c.includes(x.w) && toMin(tt[tt.length - 1]) + 60 >= nm; });
  const item = (a, v, on, cls, inner) => `<button class="mi${cls}${on ? ' on' : ''}" data-fact="${a}" data-v="${esc(v)}" aria-pressed="${on}">${inner}<i>${ICON_OK}</i></button>`;
  const cover = id => { let s = stk(id), i = 0; while (i < 7 && s + 1e-9 >= (U[i][id] || 0)) { s -= U[i][id] || 0; i++; } return i; };
  const buy = Object.keys(FOOD.vorrat).filter(id => !FOOD.vorrat[id][4]).map(id => {
    const [n, , pk, pl] = FOOD.vorrat[id], miss = (id === 'pizza' ? FOOD.pizza.vorrat : U.slice(0, F.h).reduce((a, u) => a + (u[id] || 0), 0)) - stk(id);
    const packs = bt[id] ? Math.round(bt[id] / pk) : Math.max(0, Math.ceil(miss / pk - 1e-9));
    return packs ? item('buy', `${id}:${packs * pk}`, !!bt[id], ' s', `<b>${packs}× ${esc(n)}${pl ? ' ' + pl : ''}</b>`) : '';
  }).join('');
  const shop = d !== t ? '' : `<div class="card"><h2>Einkaufszettel</h2><p>Was fehlt, damit es reicht für</p>
      <div class="pick">${FOOD.einkaufTage.map(n => `<button data-fact="h" data-v="${n}"${F.h === n ? ' class="on"' : ''}>${n} Tage</button>`).join('')}</div>
      ${buy ? `<div class="ml">${buy}</div><p class="note">Abhaken legt die Menge in den Vorrat.</p>` : '<p class="note ok">Alles da, nichts kaufen.</p>'}</div>`;
  const low = Object.keys(FOOD.vorrat).filter(id => id !== 'pizza' && cover(id) < F.h).length;
  const vor = d !== t ? '' : `<details class="card fd" data-k="vor"${op.vor ? ' open' : ''}><summary><b>Vorrat</b><span>${low ? `${low} ${low === 1 ? 'Produkt reicht' : 'Produkte reichen'} keine ${F.h} Tage` : 'Alles reicht'} · Abhaken im Tagesplan zieht automatisch ab</span></summary>
      ${Object.entries(FOOD.vorrat).map(([id, [n, u, pk]]) => { const c = cover(id); return `<div class="vr"><span><b>${esc(n)}</b><small>${u}${id === 'pizza' ? ` · Soll ${FOOD.pizza.vorrat}` : ` · reicht ${c >= 7 ? '7+ Tage' : c === 1 ? '1 Tag' : c + ' Tage'}`}</small></span><button data-fact="st" data-v="${id}:-1" aria-label="${esc(n)} weniger">−</button><input data-st="${id}" class="bwin" inputmode="decimal" value="${fx(stk(id))}" aria-label="${esc(n)} Vorrat in ${u}"><button data-fact="st" data-v="${id}:1" aria-label="${esc(n)} mehr">+</button></div>`; }).join('')}
      <p class="note">− / + ändert um eine Packung, ins Feld kannst du die genaue Menge tippen.</p></details>`;
  const dn = p.m.find(x => x.w === FOOD.abendessen), gap = dn && r.ae != null ? dn.k0 - r.ae : 0;
  const tip = r.ae == null ? '' : gap <= 0 ? 'Passt, kein Backup nötig.' : gap < 300 ? `Fehlen nur ca. ${kc(gap)} kcal, Pizza nicht nötig.` : `Fehlen ca. ${kc(gap)} kcal → Pizza dazu.`;
  const din = !dn ? '' : `<details class="card fd" data-k="din"${(op.din ?? (r.ae != null || !!r.pp)) ? ' open' : ''}><summary><b>Abendessen schätzen + Backup</b><span>${r.ae != null ? `Geschätzt ${kc(r.ae)} kcal` : `Normal ${kc(dn.k0)} kcal`} · Vorrat ${fx(stk('pizza'))} Pizza</span></summary>
      <div class="bwrow"><input id="aeIn" class="bwin" inputmode="numeric" placeholder="kcal" value="${r.ae ?? ''}" aria-label="Abendessen geschätzt in kcal"><button class="btn ghost" data-fact="ae">Eintragen</button></div>
      ${tip ? `<p class="note ok">${tip}</p>` : ''}
      <p class="sec">Pizza dazu</p><div class="pick">${[[0, 'Keine'], [1, '1 Pizza']].map(([v, n]) => `<button data-fact="pp" data-v="${v}"${(r.pp || 0) === v ? ' class="on"' : ''}>${n}</button>`).join('')}</div>
      <div class="pzr"><span>1 Pizza laut Packung</span><input id="pkIn" class="bwin" inputmode="numeric" value="${pkcal()}" aria-label="kcal pro Pizza"><span>kcal</span></div></details>`;
  const hist = Array.from({ length: 7 }, (_, i) => {
    const x = dateOf(t); x.setDate(x.getDate() - 6 + i);
    const ds = iso(x), q = ds === d ? { k: eaten, g: p.g } : F.d[ds], pc = q && q.g ? Math.round(q.k / q.g * 100) : null;
    return `<button class="hd${ds === d ? ' t' : ''}${pc >= 100 ? ' ok' : ''}" data-fact="sel" data-v="${ds}" aria-label="${WDN[x.getDay()]} bearbeiten"><div><em style="height:${Math.min(pc || 0, 100)}%"></em></div><b>${pc == null ? '–' : pc + '%'}</b><small>${WDS[x.getDay()]}</small></button>`;
  }).join('');
  el.innerHTML = `<section class="hero"><div class="eyebrow">${d === t ? `${WDN[wd]} · heute` : `${WDN[wd]}, ${fmtD(d)} · nachtragen`}</div><h1>${esc(p.n)}</h1>
      ${d === t ? '' : `<button class="link" data-fact="sel" data-v="${t}">Zurück zu heute</button>`}
      <div class="meta"><span><strong>${kc(eaten)}</strong> / ${kc(p.g)} kcal</span></div>
      <div class="bar${eaten >= p.g ? ' full' : ''}"><div style="width:${Math.min(100, eaten / p.g * 100)}%"></div></div></section>`
    + (wd === 5 ? `<div class="pick">${[['0', 'Ohne Training'], ['1', 'Mit Training']].map(([v, n]) => `<button data-fact="fr" data-v="${v}"${(r.fr ? '1' : '0') === v ? ' class="on"' : ''}>${n}</button>`).join('')}</div>` : '')
    + `<div class="card"><h2>Tagesplan</h2><div class="ml">${p.m.map(x => item(x.pz ? 'pp' : 'meal', x.pz ? 0 : x.w, x.pz || r.c.includes(x.w), x === nx ? ' nx' : '', `<time>${x.z ? esc(x.z) : 'über den Tag'}</time><b>${esc(x.w)}<span>${kc(x.k)} kcal${x.est ? ' (geschätzt)' : ''}</span></b>`)).join('')}</div></div>`
    + din + shop + vor + `<div class="card"><h2>Letzte 7 Tage</h2><p class="note">Tag antippen zum Nachtragen.</p><div class="hist">${hist}</div></div>`;
}

function foodDo(a, v) {
  const t = todayIso();
  if (a === 'sel') { fSel = v === t ? null : v; scrollTo(0, 0); return foodRender(); }
  const d = fSel || t, r = fdRec(d), rt = fdRec(t);
  if (!rt.b) rt.b = {};
  if (!rt.g) { const p0 = fdPlan(t); rt.k = eatenOf(p0, rt); rt.g = p0.g; }
  if (a === 'meal') { useMeal(v, r.c.includes(v) ? -1 : 1); tgl(r.c, v); }
  else if (a === 'fr') r.fr = v === '1';
  else if (a === 'ae') {
    const n = parseInt($('aeIn').value, 10);
    r.ae = isFinite(n) && n >= 0 && n < 5000 ? n : null;
    if (r.ae != null && !r.c.includes(FOOD.abendessen)) r.c.push(FOOD.abendessen);
  } else if (a === 'pp') { addSt('pizza', -(+v - (r.pp || 0))); r.pp = +v; }
  else if (a === 'buy') { const [id, n] = v.split(':'); if (rt.b[id]) { addSt(id, -rt.b[id]); delete rt.b[id]; } else { addSt(id, +n); rt.b[id] = +n; } }
  else if (a === 'st') { const [id, s] = v.split(':'); addSt(id, s * FOOD.vorrat[id][2]); }
  else if (a === 'h') F.h = +v;
  else if (a === 'pk') { const n = parseInt($('pkIn').value, 10); F.pk = n > 0 && n < 3000 ? n : 0; }
  const p = fdPlan(d);
  r.k = eatenOf(p, r); r.g = p.g;
  foodSave(); foodRender();
}
document.addEventListener('click', ev => {
  const b = ev.target.closest && ev.target.closest('[data-fact]');
  if (!b) return;
  const a = b.dataset.fact, v = b.dataset.v;
  if (a !== 'tab') return foodDo(a, v);
  document.body.dataset.tab = v;
  document.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x === b));
  if (v === 'food') foodRender();
  scrollTo(0, 0);
});
document.addEventListener('change', ev => {
  const el = ev.target, id = el.dataset && el.dataset.st;
  if (id) { const n = parseFloat(el.value.replace(',', '.')); if (isFinite(n) && n >= 0 && n < 1e5) F.st[id] = n; foodSave(); foodRender(); }
  else if (el.id === 'aeIn') foodDo('ae');
  else if (el.id === 'pkIn') foodDo('pk');
});
document.addEventListener('keydown', ev => { if (ev.key === 'Enter' && (ev.target.id === 'aeIn' || ev.target.id === 'pkIn' || (ev.target.dataset && ev.target.dataset.st))) ev.target.blur(); });
const foodLive = () => { if (document.body.dataset.tab === 'food' && !document.hidden && !$('food').contains(document.activeElement)) foodRender(); };
setInterval(foodLive, 60000);
document.addEventListener('visibilitychange', foodLive);
foodLoad().then(foodRender);
