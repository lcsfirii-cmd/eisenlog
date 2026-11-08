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
    1: ['Mo–Di', ['2 L H-Milch', '3 L Bananennektar', '1 Packung Müsli', '3 Bananen', 'Bäcker: 2 Tiger-Brötchen']],
    3: ['Mi–Fr', ['3 L H-Milch', '2 L Bananennektar', '1 Packung Müsli', '5 Bananen (eher grün)', 'Bäcker: 2 Tiger-Brötchen']],
    6: ['Sa–So', ['2 L H-Milch', '2 L Bananennektar', '1 Packung Müsli', '4 Bananen', 'Bäcker: 2 Tiger-Brötchen']],
  },
  reserve: 'Mehr als eine Packung Reserve im Schrank? Beim nächsten Einkauf weglassen.',
  online: ['Haferflocken ca. 1,8 kg', 'Nüsse ca. 1,5 kg (direkt in 50-g-Portionen aufteilen)', 'Whey ca. 1,8 kg', 'Isoclear ca. 30 Portionen'],
};

const FL = 'eisenlog-food';
let F = { saved: 0, d: {}, o: {} };
const kc = n => n.toLocaleString('de-DE');
const ym = () => todayIso().slice(0, 7);
const toMin = s => +s.slice(0, 2) * 60 + +s.slice(3);
const fdRec = d => F.d[d] || (F.d[d] = { c: [], e: [], fr: false, k: 0, g: 0 });
const eatenOf = (p, r) => p.m.filter(x => r.c.includes(x.w)).reduce((a, x) => a + x.k, 0);
const tgl = (l, x) => { const i = l.indexOf(x); if (i < 0) l.push(x); else l.splice(i, 1); };

function fdPlan(d) {
  const wd = dateOf(d).getDay(), r = F.d[d];
  const p = FOOD.plaene[wd === 5 && r && r.fr ? FOOD.freitagMitTraining : FOOD.tage[wd]];
  const m = p.m.concat(FOOD.immer).map(([z, w, k, o]) => ({ z, w: (o && o[wd]) || w, k }));
  return { n: p.n, m, g: m.reduce((a, x) => a + x.k, 0) };
}

async function foodLoad() {
  let a = null, b = null;
  try { a = JSON.parse((await idbGet('food')) || 'null'); } catch (e) {}
  try { b = JSON.parse(localStorage.getItem(FL) || 'null'); } catch (e) {}
  const s = a && b ? ((a.saved || 0) >= (b.saved || 0) ? a : b) : (a || b);
  if (s) F = { saved: s.saved || 0, d: s.d || {}, o: s.o || {} };
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
  for (const [d, r] of Object.entries(j.d || {})) if (DATE_RE.test(d) && r && typeof r === 'object' && !F.d[d]) F.d[d] = { c: arr(r.c), e: arr(r.e), fr: !!r.fr, k: +r.k || 0, g: +r.g || 0 };
  for (const [m, l] of Object.entries(j.o || {})) if (/^\d{4}-\d{2}$/.test(m) && !F.o[m]) F.o[m] = arr(l);
  foodSave(); foodRender();
}

function foodRender() {
  const el = $('food'), d = todayIso(), now = new Date(), wd = now.getDay(), nm = now.getHours() * 60 + now.getMinutes();
  const r = F.d[d] || { c: [], e: [], fr: false }, p = fdPlan(d), eaten = eatenOf(p, r), ol = F.o[ym()] || [];
  const det = el.querySelector('details'), open = det && det.open;
  const nx = p.m.find(x => { const t = x.z.match(/\d\d:\d\d/g); return t && !r.c.includes(x.w) && toMin(t[t.length - 1]) + 60 >= nm; });
  const item = (a, v, on, cls, inner) => `<button class="mi${cls}${on ? ' on' : ''}" data-fact="${a}" data-v="${esc(v)}" aria-pressed="${on}">${inner}<i>${ICON_OK}</i></button>`;
  const checks = (l, a, have) => `<div class="ml">${l.map(x => item(a, x, have.includes(x), ' s', `<b>${esc(x)}</b>`)).join('')}</div>`;
  let shop = '';
  if (FOOD.einkauf[wd]) shop = `<div class="card"><h2>Einkaufsliste</h2><p>Für ${FOOD.einkauf[wd][0]}</p>${checks(FOOD.einkauf[wd][1], 'shop', r.e)}<p class="note">${FOOD.reserve}</p></div>`;
  else for (let i = 1; i < 7; i++) {
    const w = (wd + i) % 7, e = FOOD.einkauf[w];
    if (!e) continue;
    shop = `<details class="card fd"${open ? ' open' : ''}><summary><b>Nächster Einkauf: ${i === 1 ? 'morgen' : WDN[w]}</b><span>Liste für ${e[0]}</span></summary><ul class="lst">${e[1].map(x => `<li>${esc(x)}</li>`).join('')}</ul><p class="note">${FOOD.reserve}</p></details>`;
    break;
  }
  const hist = Array.from({ length: 7 }, (_, i) => {
    const x = new Date(now); x.setDate(now.getDate() - 6 + i);
    const ds = iso(x), q = ds === d ? { k: eaten, g: p.g } : F.d[ds], pc = q && q.g ? Math.round(q.k / q.g * 100) : null;
    return `<div class="hd${ds === d ? ' t' : ''}${pc >= 100 ? ' ok' : ''}"><div><em style="height:${Math.min(pc || 0, 100)}%"></em></div><b>${pc == null ? '–' : pc + '%'}</b><small>${WDS[x.getDay()]}</small></div>`;
  }).join('');
  el.innerHTML = (FOOD.online.every(x => ol.includes(x)) ? '' : `<div class="card fo"><h2>Online-Bestellung</h2><p>Monatsvorrat für ${now.toLocaleDateString('de-DE', { month: 'long' })}. Abhaken, was bestellt ist.</p>${checks(FOOD.online, 'order', ol)}</div>`)
    + `<section class="hero"><div class="eyebrow">${WDN[wd]} · heute</div><h1>${esc(p.n)}</h1>
      <div class="meta"><span><strong>${kc(eaten)}</strong> / ${kc(p.g)} kcal</span></div>
      <div class="bar${eaten >= p.g ? ' full' : ''}"><div style="width:${Math.min(100, eaten / p.g * 100)}%"></div></div></section>`
    + (wd === 5 ? `<div class="pick">${[['0', 'Ohne Training'], ['1', 'Mit Training']].map(([v, n]) => `<button data-fact="fr" data-v="${v}"${(r.fr ? '1' : '0') === v ? ' class="on"' : ''}>${n}</button>`).join('')}</div>` : '')
    + `<div class="card"><h2>Tagesplan</h2><div class="ml">${p.m.map(x => item('meal', x.w, r.c.includes(x.w), x === nx ? ' nx' : '', `<time>${x.z ? esc(x.z) : 'über den Tag'}</time><b>${esc(x.w)}<span>${kc(x.k)} kcal</span></b>`)).join('')}</div></div>`
    + shop + `<div class="card"><h2>Letzte 7 Tage</h2><div class="hist">${hist}</div></div>`;
}

document.addEventListener('click', ev => {
  const b = ev.target.closest && ev.target.closest('[data-fact]');
  if (!b) return;
  const a = b.dataset.fact, v = b.dataset.v, d = todayIso();
  if (a === 'tab') {
    document.body.dataset.tab = v;
    document.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x === b));
    if (v === 'food') foodRender();
    scrollTo(0, 0);
    return;
  }
  const r = fdRec(d);
  if (a === 'meal') tgl(r.c, v);
  else if (a === 'shop') tgl(r.e, v);
  else if (a === 'fr') r.fr = v === '1';
  else if (a === 'order') tgl(F.o[ym()] || (F.o[ym()] = []), v);
  const p = fdPlan(d);
  r.k = eatenOf(p, r); r.g = p.g;
  foodSave(); foodRender();
});
const foodLive = () => { if (document.body.dataset.tab === 'food' && !document.hidden) foodRender(); };
setInterval(foodLive, 60000);
document.addEventListener('visibilitychange', foodLive);
foodLoad().then(foodRender);
