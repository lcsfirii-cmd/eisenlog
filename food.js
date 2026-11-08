'use strict';

const FOOD = {
  immer: [['', 'Bananennektar 1 L', 550]],
  plaene: {
    frei: { n: 'Ohne Training', m: [
      ['07:30', 'Aldi + Bäcker (Einkaufsliste)', 0, { 5: 'Bäcker' }],
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
      ['07:30', 'Bäcker', 0],
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
      ['11:45', 'Aldi + Bäcker (Einkaufsliste)', 0, { 0: 'Bäcker' }],
      ['12:30', '150 g Müsli + 400 ml Milch + 2 Tiger-Brötchen', 1950],
      ['15:30', 'Shake: 400 ml Milch, 60 g Haferflocken, 1 Banane, 2 Löffel Whey', 800],
      ['18:00', 'Abendessen', 1000],
      ['21:00', '50 g Nüsse', 300],
    ] },
  },
  tage: ['we', 'frei', 'frueh', 'frei', 'frueh', 'frei', 'we'],
  freitagMitTraining: 'fr',
  einkauf: {
    1: ['Mo–Di', ['2 L H-Milch', '3 L Bananennektar', '1 Packung Müsli', '3 Bananen', '2 Flaschen Wasser (1,5 L)', 'Haferflocken für die Woche (ca. 420 g)', 'Nüsse für die Woche (ca. 350 g, direkt in 50-g-Portionen aufteilen)', 'Bäcker: 2 Tiger-Brötchen']],
    3: ['Mi–Fr', ['3 L H-Milch', '2 L Bananennektar', '1 Packung Müsli', '5 Bananen (eher grün)', '3 Flaschen Wasser (1,5 L)', 'Bäcker: 2 Tiger-Brötchen']],
    6: ['Sa–So', ['2 L H-Milch', '2 L Bananennektar', '1 Packung Müsli', '4 Bananen', '2 Flaschen Wasser (1,5 L)', 'Bäcker: 2 Tiger-Brötchen']],
  },
  abendessen: 'Abendessen',
  pizza: { n: 'TK-Pizza (Backup)', kcal: 950, vorrat: 2 },
  reserve: 'Mehr als eine Packung Reserve im Schrank? Beim nächsten Einkauf weglassen.',
  online: [],
};

const FL = 'eisenlog-food';
let F = { saved: 0, d: {}, o: {}, pz: 0, pk: 0 };
const kc = n => n.toLocaleString('de-DE');
const ym = () => todayIso().slice(0, 7);
const toMin = s => +s.slice(0, 2) * 60 + +s.slice(3);
const pkcal = () => F.pk || FOOD.pizza.kcal;
const pzTxt = n => `${n === 0.5 ? '½' : n} ${FOOD.pizza.n}`;
const pzNeed = () => Math.max(0, Math.ceil(FOOD.pizza.vorrat - F.pz));
const fdRec = d => F.d[d] || (F.d[d] = { c: [], e: [], fr: false, ae: null, pp: 0, pb: 0, k: 0, g: 0 });
const eatenOf = (p, r) => p.m.filter(x => x.pz || r.c.includes(x.w)).reduce((a, x) => a + x.k, 0);
const tgl = (l, x) => { const i = l.indexOf(x); if (i < 0) l.push(x); else l.splice(i, 1); };

function fdPlan(d) {
  const wd = dateOf(d).getDay(), r = F.d[d] || {}, m = [];
  const p = FOOD.plaene[wd === 5 && r.fr ? FOOD.freitagMitTraining : FOOD.tage[wd]], base = p.m.concat(FOOD.immer);
  for (const [z, w, k, o] of base) {
    if (w !== FOOD.abendessen) { m.push({ z, w: (o && o[wd]) || w, k }); continue; }
    m.push({ z, w, k: r.ae != null ? r.ae : k, est: r.ae != null, k0: k });
    if (r.pp) m.push({ z, w: pzTxt(r.pp), k: Math.round(pkcal() * r.pp), pz: true });
  }
  return { n: p.n, m, g: base.reduce((a, x) => a + x[2], 0) };
}

async function foodLoad() {
  let a = null, b = null;
  try { a = JSON.parse((await idbGet('food')) || 'null'); } catch (e) {}
  try { b = JSON.parse(localStorage.getItem(FL) || 'null'); } catch (e) {}
  const s = a && b ? ((a.saved || 0) >= (b.saved || 0) ? a : b) : (a || b);
  if (s) F = { saved: s.saved || 0, d: s.d || {}, o: s.o || {}, pz: +s.pz || 0, pk: +s.pk || 0 };
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
  if (!Object.keys(F.d).length) { F.pz = num(j.pz, 50) || 0; F.pk = num(j.pk, 3000) || 0; }
  for (const [d, r] of Object.entries(j.d || {})) if (DATE_RE.test(d) && r && typeof r === 'object' && !F.d[d])
    F.d[d] = { c: arr(r.c), e: arr(r.e), fr: !!r.fr, ae: num(r.ae, 5000), pp: [0.5, 1].includes(r.pp) ? r.pp : 0, pb: num(r.pb, 20) || 0, k: +r.k || 0, g: +r.g || 0 };
  for (const [m, l] of Object.entries(j.o || {})) if (/^\d{4}-\d{2}$/.test(m) && !F.o[m]) F.o[m] = arr(l);
  foodSave(); foodRender();
}

function foodRender() {
  const el = $('food'), d = todayIso(), now = new Date(), wd = now.getDay(), nm = now.getHours() * 60 + now.getMinutes();
  const r = F.d[d] || { c: [], e: [], fr: false, ae: null, pp: 0, pb: 0 }, p = fdPlan(d), eaten = eatenOf(p, r), ol = F.o[ym()] || [];
  const op = {};
  el.querySelectorAll('details[data-k]').forEach(x => { op[x.dataset.k] = x.open; });
  const nx = p.m.find(x => { const t = x.z.match(/\d\d:\d\d/g); return t && !x.pz && !r.c.includes(x.w) && toMin(t[t.length - 1]) + 60 >= nm; });
  const item = (a, v, on, cls, inner) => `<button class="mi${cls}${on ? ' on' : ''}" data-fact="${a}" data-v="${esc(v)}" aria-pressed="${on}">${inner}<i>${ICON_OK}</i></button>`;
  const checks = (l, a, have) => l.map(x => item(a, x, have.includes(x), ' s', `<b>${esc(x)}</b>`)).join('');
  const pzN = r.pb || pzNeed();
  let shop = '';
  if (FOOD.einkauf[wd]) shop = `<div class="card"><h2>Einkaufsliste</h2><p>Für ${FOOD.einkauf[wd][0]}</p><div class="ml">${checks(FOOD.einkauf[wd][1], 'shop', r.e)}${pzN ? item('pkauf', pzN, !!r.pb, ' s', `<b>${pzN} ${FOOD.pizza.n}</b>`) : ''}</div><p class="note">${FOOD.reserve}</p></div>`;
  else for (let i = 1; i < 7; i++) {
    const w = (wd + i) % 7, e = FOOD.einkauf[w];
    if (!e) continue;
    const l = pzNeed() ? e[1].concat(`${pzNeed()} ${FOOD.pizza.n}`) : e[1];
    shop = `<details class="card fd" data-k="shop"${op.shop ? ' open' : ''}><summary><b>Nächster Einkauf: ${i === 1 ? 'morgen' : WDN[w]}</b><span>Liste für ${e[0]}</span></summary><ul class="lst">${l.map(x => `<li>${esc(x)}</li>`).join('')}</ul><p class="note">${FOOD.reserve}</p></details>`;
    break;
  }
  const dn = p.m.find(x => x.w === FOOD.abendessen), gap = dn && r.ae != null ? dn.k0 - r.ae : 0;
  const tip = r.ae == null ? '' : gap <= 0 ? 'Passt, kein Backup nötig.' : `Fehlen ca. ${kc(gap)} kcal → ${gap <= pkcal() * 0.75 ? '½ Pizza' : '1 Pizza'} passt.`;
  const din = !dn ? '' : `<details class="card fd" data-k="din"${(op.din ?? (r.ae != null || !!r.pp)) ? ' open' : ''}><summary><b>Abendessen schätzen + Backup</b><span>${r.ae != null ? `Geschätzt ${kc(r.ae)} kcal` : `Normal ${kc(dn.k0)} kcal`} · Vorrat ${fw(F.pz)} Pizza</span></summary>
      <div class="bwrow"><input id="aeIn" class="bwin" inputmode="numeric" placeholder="kcal" value="${r.ae ?? ''}" aria-label="Abendessen geschätzt in kcal"><button class="btn ghost" data-fact="ae">Eintragen</button></div>
      ${tip ? `<p class="note ok">${tip}</p>` : ''}
      <p class="sec">Pizza dazu</p><div class="pick">${[[0, 'Keine'], [0.5, '½ Pizza'], [1, '1 Pizza']].map(([v, n]) => `<button data-fact="pp" data-v="${v}"${(r.pp || 0) === v ? ' class="on"' : ''}>${n}</button>`).join('')}</div>
      <div class="pzr"><span>Vorrat im Gefrierfach: <b>${fw(F.pz)}</b></span><button data-fact="pz" data-v="-1" aria-label="Eine Pizza weniger">−</button><button data-fact="pz" data-v="1" aria-label="Eine Pizza mehr">+</button></div>
      <div class="pzr"><span>1 Pizza laut Packung</span><input id="pkIn" class="bwin" inputmode="numeric" value="${pkcal()}" aria-label="kcal pro Pizza"><span>kcal</span></div></details>`;
  const hist = Array.from({ length: 7 }, (_, i) => {
    const x = new Date(now); x.setDate(now.getDate() - 6 + i);
    const ds = iso(x), q = ds === d ? { k: eaten, g: p.g } : F.d[ds], pc = q && q.g ? Math.round(q.k / q.g * 100) : null;
    return `<div class="hd${ds === d ? ' t' : ''}${pc >= 100 ? ' ok' : ''}"><div><em style="height:${Math.min(pc || 0, 100)}%"></em></div><b>${pc == null ? '–' : pc + '%'}</b><small>${WDS[x.getDay()]}</small></div>`;
  }).join('');
  el.innerHTML = (FOOD.online.every(x => ol.includes(x)) ? '' : `<div class="card fo"><h2>Online-Bestellung</h2><p>Monatsvorrat für ${now.toLocaleDateString('de-DE', { month: 'long' })}. Abhaken, was bestellt ist.</p><div class="ml">${checks(FOOD.online, 'order', ol)}</div></div>`)
    + `<section class="hero"><div class="eyebrow">${WDN[wd]} · heute</div><h1>${esc(p.n)}</h1>
      <div class="meta"><span><strong>${kc(eaten)}</strong> / ${kc(p.g)} kcal</span></div>
      <div class="bar${eaten >= p.g ? ' full' : ''}"><div style="width:${Math.min(100, eaten / p.g * 100)}%"></div></div></section>`
    + (wd === 5 ? `<div class="pick">${[['0', 'Ohne Training'], ['1', 'Mit Training']].map(([v, n]) => `<button data-fact="fr" data-v="${v}"${(r.fr ? '1' : '0') === v ? ' class="on"' : ''}>${n}</button>`).join('')}</div>` : '')
    + `<div class="card"><h2>Tagesplan</h2><div class="ml">${p.m.map(x => item(x.pz ? 'pp' : 'meal', x.pz ? 0 : x.w, x.pz || r.c.includes(x.w), x === nx ? ' nx' : '', `<time>${x.z ? esc(x.z) : 'über den Tag'}</time><b>${esc(x.w)}<span>${kc(x.k)} kcal${x.est ? ' (geschätzt)' : ''}</span></b>`)).join('')}</div></div>`
    + din + shop + `<div class="card"><h2>Letzte 7 Tage</h2><div class="hist">${hist}</div></div>`;
}

function foodDo(a, v) {
  const d = todayIso(), r = fdRec(d);
  if (a === 'meal') tgl(r.c, v);
  else if (a === 'shop') tgl(r.e, v);
  else if (a === 'fr') r.fr = v === '1';
  else if (a === 'order') tgl(F.o[ym()] || (F.o[ym()] = []), v);
  else if (a === 'ae') {
    const n = parseInt($('aeIn').value, 10);
    r.ae = isFinite(n) && n >= 0 && n < 5000 ? n : null;
    if (r.ae != null && !r.c.includes(FOOD.abendessen)) r.c.push(FOOD.abendessen);
  } else if (a === 'pp') { F.pz = Math.max(0, F.pz - (+v - (r.pp || 0))); r.pp = +v; }
  else if (a === 'pz') F.pz = Math.max(0, F.pz + +v);
  else if (a === 'pkauf') { if (r.pb) { F.pz = Math.max(0, F.pz - r.pb); r.pb = 0; } else { r.pb = +v; F.pz += r.pb; } }
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
document.addEventListener('change', ev => { if (ev.target.id === 'aeIn') foodDo('ae'); else if (ev.target.id === 'pkIn') foodDo('pk'); });
document.addEventListener('keydown', ev => { if (ev.key === 'Enter' && (ev.target.id === 'aeIn' || ev.target.id === 'pkIn')) ev.target.blur(); });
const foodLive = () => { if (document.body.dataset.tab === 'food' && !document.hidden && !$('food').contains(document.activeElement)) foodRender(); };
setInterval(foodLive, 60000);
document.addEventListener('visibilitychange', foodLive);
foodLoad().then(foodRender);
