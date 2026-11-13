'use strict';
/* Eisenlog – Oberfläche, Speichern und Sicherung. Gerechnet wird in logic.js. */

const APP_V = '3.6.1';
const LS_KEY = 'eisenlog-state';
const DAY_MS = 864e5;
const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayIso = () => iso(new Date());
const dateOf = s => new Date(s + 'T12:00:00');
const fw = w => w == null ? '–' : String(r2(w)).replace('.', ',');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const WDN = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const WDS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const SHORT = { obA: 'Ober A', beinA: 'Beine A', arme: 'Schulter', beinB: 'Beine B', obB: 'Ober B' };
const OLD_DAYS = { ober: 'Oberkörper', unter: 'Unterkörper', push: 'Push', pull: 'Pull', beine: 'Beine' };
const BLOCK_WEEKS = 6; // 5 Wochen Aufbau + 1 Entlastungswoche
const ICON_X = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const ICON_GO = '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>';
const ICON_OK = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

let S = null; // alles, was gespeichert wird
const V = { sel: todayIso(), day0: todayIso(), pick: false, edit: null, fin: false, summary: null, sheet: null, paste: false, msg: '', msgOk: true, update: null, persist: false, storeErr: false, swapTo: null };
let wake = null, timerInt = null, tOver = null, hold = null;

/* ---------- Speichern ----------
   Doppelt: IndexedDB (groß, dauerhaft) und localStorage (sofort). Beim Start gewinnt der neuere Stand. */

function fresh() {
  return {
    v: 1, created: Date.now(), saved: 0, plan: makePlan(), planV: PLAN_V, planCustom: false, ov: {}, inc: {}, eq: {},
    sessions: [], draft: null, backupAt: 0, theme: 'auto', bw: [], stag: {}, block: null, blockLog: null, noEarly: '',
  };
}
function migrate(s) {
  const f = fresh();
  // Neuer Startplan wird übernommen, solange Lucas den Plan nicht selbst geändert hat (Tauschen, Block-Anpassung)
  if (s.planV === 5 && s.plan) {
    for (const k in s.plan) for (const e of s.plan[k].x || []) { const to = { mp_incl: 'hs_incl', mp_incl2: 'hs_incl2' }[e.id]; if (to) { e.id = to; e.h = 'Gewicht pro Seite'; } }
    s.planV = 6;
  }
  if (s.planV === 6 && s.plan) {
    for (const k in s.plan) for (const e of s.plan[k].x || []) if (e.id === 'presse') e.id = 'presse_tief';
    for (const x of s.sessions || []) if (x.date >= '2026-11-10' && x.ex && x.ex.presse) { x.ex.presse_tief = x.ex.presse.map(z => Object.assign({}, z, { pw: null, pr: null })); delete x.ex.presse; }
    s.planV = 7;
  }
  if (s.planV === 7 && s.plan) {
    const x = s.plan.beinB && s.plan.beinB.x, i = x ? x.findIndex(e => e.id === 'pend_so') : -1;
    if (i > 0) x.unshift(x.splice(i, 1)[0]);
    s.planV = 8;
  }
  if (s.planV === 8 && s.plan) {
    const add = (k, id, sets, lo, hi, h) => { const x = s.plan[k] && s.plan[k].x; if (x && !x.some(e => e.id === id)) x.push({ id, s: sets, lo, hi, role: 'iso', rest: REST.iso, lp: false, h }); };
    add('beinA', 'crunch', 3, 10, 15, 'Letzter Satz: Dropsatz erlaubt, nur den ersten Teil eintragen');
    add('beinB', 'beinheben', 3, 10, 15, 'Frei hängend an der Stange, ohne Gewicht. Becken einrollen, nicht schwingen');
    s.planV = 9;
  }
  if (s.planV === 9 && s.plan) {
    for (const k in s.plan) for (const e of s.plan[k].x || []) if (e.id === 'beinheben') e.h = 'Frei hängend an der Stange, ohne Gewicht. Becken einrollen, nicht schwingen';
    s.planV = PLAN_V;
  }
  if (s.planV !== PLAN_V && (!s.planCustom || (s.planV || 0) < 5)) { s.plan = f.plan; s.planV = PLAN_V; s.planCustom = false; s.block = null; }
  if (s.ov) for (const d of Object.keys(s.ov)) if (s.ov[d] && !DAY_KEYS.includes(s.ov[d])) delete s.ov[d];
  for (const k in f) if (s[k] === undefined) s[k] = f[k];
  if (!s.block) s.block = { n: 1, start: mondayOf(todayIso()), early: '' };
  return s;
}
function mondayOf(date) { const d = dateOf(date); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return iso(d); }
let idbP = null;
function idb() {
  if (!idbP) idbP = new Promise((res, rej) => {
    const q = indexedDB.open('eisenlog', 1);
    q.onupgradeneeded = () => q.result.createObjectStore('kv');
    q.onsuccess = () => res(q.result);
    q.onerror = () => rej(q.error);
  });
  return idbP;
}
async function idbGet(k) {
  const db = await idb();
  return new Promise((res, rej) => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
}
async function idbPut(k, v) {
  const db = await idb();
  return new Promise((res, rej) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); });
}
async function loadState() {
  let a = null, b = null;
  try { a = JSON.parse((await idbGet('state')) || 'null'); } catch (e) {}
  try { b = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch (e) {}
  const s = a && b ? ((a.saved || 0) >= (b.saved || 0) ? a : b) : (a || b);
  return migrate(s || fresh());
}
let saveT = null;
function save() {
  clearTimeout(saveT); saveT = null;
  S.saved = Date.now();
  const txt = JSON.stringify(S);
  let lsOk = true;
  try { localStorage.setItem(LS_KEY, txt); } catch (e) { lsOk = false; }
  idbPut('state', txt).then(() => { if (V.storeErr) { V.storeErr = false; renderBanner(); } })
    .catch(() => { if (!lsOk && !V.storeErr) { V.storeErr = true; renderBanner(); } });
}
function saveSoon() { clearTimeout(saveT); saveT = setTimeout(save, 400); }
function flush() { if (saveT) save(); }

/* ---------- Kleine Helfer ---------- */

// Gewichtsschritt: selbst gewählt, sonst fester Schritt des Geräts (Beinpresse 5 kg), sonst aus deinen Einträgen gelernt
const autoInc = id => (EX[id] && EX[id].inc) || learnedStep(S.sessions, id) || 1.25;
const incOf = id => S.inc[id] || autoInc(id);
const exName = id => EX[id] ? EX[id].n : id;
const dayName = k => S.plan[k] ? S.plan[k].n : OLD_DAYS[k] || 'Training';
function dayFor(date) {
  if (date in S.ov) return S.ov[date] || null;
  return WEEK0[dateOf(date).getDay()] || null;
}
function entryOf(day, id) {
  const D = S.draft, p = S.plan[day];
  if (D && D.day === day && D.ent && D.ent[id]) return D.ent[id]; // nur heute getauscht
  return (p && p.x.find(e => e.id === id)) || findEntry(id) || { id, s: 3, lo: 8, hi: 12, role: 'iso', rest: 90, h: '' };
}
// Woche im Block und Entlastung
function blockWeek(date) { return Math.floor((dateOf(date) - dateOf(S.block.start)) / (7 * DAY_MS)) + 1; }
function isDeload(date) { return blockWeek(date) === BLOCK_WEEKS || (!!S.block.early && mondayOf(date) === S.block.early); }
const pace = () => paceOf(S.sessions);
function optsFor(id) {
  const all = hist(id);
  return { days: all.length ? Math.round((dateOf(todayIso()) - dateOf(all[0].date)) / DAY_MS) : 0, reset: needsReset(id), bw: !!(EX[id] && EX[id].bw) };
}
function planFor(e) { return nextPlan(e, histW(e.id), incOf(e.id), optsFor(e.id)); }
// Stagnation Stufe 1: hängt seit 4 Einheiten und wurde noch nicht neu gestartet
function needsReset(id) { return !S.stag[id] && stalled(histW(id), id); }
// Stufe 2: nach dem Neustart 3 weitere Einheiten ohne neuen Bestwert → Tausch vorschlagen
function suggestSwap(id) {
  const st = S.stag[id];
  if (!st || st.no) return false;
  const h = histW(id);
  if (h.length < st.n + 3) return false;
  return Math.max(...eSeries(h, id).slice(-3).map(p => p.v)) <= st.best * 1.01;
}
function findEntry(id) {
  for (const k of DAY_KEYS) { const e = S.plan[k] && S.plan[k].x.find(x => x.id === id); if (e) return e; }
  return null;
}
const hist = id => histOf(S.sessions, id);
const histW = id => hist(id).filter(s => !s.deload);
const hasDone = D => !!D && D.order.some(id => D.ex[id].sets.some(s => s.done));
const sessById = id => S.sessions.find(s => s.id === id);
const restTxt = sec => sec >= 120 ? `${fw(sec / 60)} Min` : `${sec} s`;
const fmtD = d => { const x = dateOf(d); return `${pad(x.getDate())}.${pad(x.getMonth() + 1)}.`; };
const fmtDW = d => `${WDS[dateOf(d).getDay()]} ${fmtD(d)}`;
const dateLong = d => dateOf(d).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
function ago(date) {
  const n = Math.round((dateOf(todayIso()) - dateOf(date)) / DAY_MS);
  return n <= 0 ? 'heute' : n === 1 ? 'gestern' : `vor ${n} Tagen`;
}
const backupDue = () => S.sessions.length > 0 && Date.now() - (S.backupAt || S.created) > 7 * DAY_MS;

// Sätze kurz schreiben: „80 kg × 10 · 9 · 8“. useT = Zielwerte statt geschaffter Werte
function fmtSets(l, useT) {
  const ws = l.map(x => useT && x.tw != null ? x.tw : x.w), rs = l.map(x => useT && x.tr != null ? x.tr : x.r);
  if (!ws.length || ws.some(w => w == null)) return null;
  return new Set(ws).size === 1 ? `${fw(ws[0])} kg × ${rs.join(' · ')}` : ws.map((w, i) => `${fw(w)}×${rs[i]}`).join(' · ');
}
function goalTxt(s) {
  const w = s.tw != null ? s.tw : s.w, r = s.tr != null ? s.tr : s.r;
  return w == null ? `${r} Wdh., Gewicht wählen` : `${fw(w)} kg × ${r}`;
}

/* ---------- Training von heute ---------- */

function buildEx(e, deload) {
  let p = planFor(e), reps = p.reps, w = p.w;
  if (deload) { // Entlastung: halbe Sätze, 10 % leichter, nicht bis ans Limit
    reps = reps.slice(0, Math.max(1, Math.ceil(reps.length / 2)));
    if (w) w = roundRel(w * 0.9, w, incOf(e.id));
    p = { ...p, tag: 'deload' };
  }
  return {
    tag: p.tag, d: p.d || 0, first: w == null,
    sets: reps.map(r => ({ w, r, tw: w, tr: r, pw: w, pr: r, E: w ? e1(w, r) : undefined, done: false })),
  };
}
function buildDraft(k, date) {
  const deload = isDeload(date);
  const D = { date, day: k, start: null, order: [], skip: {}, ex: {}, ent: {}, last: null, cur: null, touched: false, rest: null, deload };
  for (const e of S.plan[k].x) { D.order.push(e.id); D.ex[e.id] = buildEx(e, deload); }
  return D;
}
function touch() { if (S.draft) S.draft.touched = true; }

function sessionFromDraft(D, end) {
  const ex = {};
  let lastT = 0;
  for (const id of D.order) {
    const l = [];
    for (const s of D.ex[id].sets) {
      if (!s.done || s.w == null) continue;
      const o = { w: s.w, r: s.r };
      if (s.f) o.f = s.f;
      if (s.t) { o.t = s.t; lastT = Math.max(lastT, s.t); }
      if (s.tw != null) o.tw = s.tw;
      if (s.tr != null) o.tr = s.tr;
      if (s.pw !== undefined) o.pw = s.pw; // geplantes Ziel zu Beginn, daran misst die App den Fortschritt
      if (s.pr !== undefined) o.pr = s.pr;
      l.push(o);
    }
    if (l.length) ex[id] = l;
  }
  if (!Object.keys(ex).length) return null;
  return {
    id: 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), v: 1,
    date: D.date, day: D.day, start: D.start, end: end || lastT || Date.now(),
    ex, skip: D.order.filter(id => D.skip[id]), deload: !!D.deload,
  };
}
// Ein Training von gestern, das nicht beendet wurde, wird mit den abgehakten Sätzen gespeichert
function settleOldDraft() {
  const D = S.draft;
  if (!D || D.date === todayIso()) return;
  const s = sessionFromDraft(D, 0);
  if (s) S.sessions.push(s);
  S.draft = null;
}

function nextSet(D) {
  const ids = D.order.filter(id => !D.skip[id]);
  if (D.cur && ids.includes(D.cur)) ids.unshift(D.cur);
  for (const id of ids) { const i = D.ex[id].sets.findIndex(s => !s.done); if (i >= 0) return { id, i }; }
  return null;
}
function restLabel(D) {
  const n = nextSet(D);
  if (!n) return 'Alle Sätze geschafft';
  const s = D.ex[n.id].sets[n.i], same = D.last && D.last.id === n.id;
  return `${same ? '' : exName(n.id) + ' · '}Satz ${n.i + 1} · ${goalTxt(s)}`;
}
function latestDone(x) {
  let b = -1, bt = -1;
  x.sets.forEach((s, i) => { if (s.done && (s.t || 0) >= bt) { bt = s.t || 0; b = i; } });
  return b;
}
function reAdjust(id) {
  const D = S.draft, x = D.ex[id], i = latestDone(x);
  if (i >= 0) adjustAfter(entryOf(D.day, id), x, i, incOf(id));
}
// Stärke für Punkt 4, wenn ein Satz kein eigenes Ziel hat: letzter Satz heute, sonst Arbeitsstärke
function liveE(id) {
  const x = S.draft.ex[id], i = latestDone(x);
  if (i >= 0) { const d = x.sets[i]; return e1(d.w, d.r, d.f); }
  return workE(histW(id), id);
}

// Gewicht ändern. Offener Satz: Wiederholungsziel neu ausrechnen (Punkt 4), gleiche Folgesätze mitnehmen.
function setW(id, i, w) {
  const D = S.draft, x = D.ex[id], s = x.sets[i], e = entryOf(D.day, id), old = s.w;
  s.w = w;
  touch();
  if (s.done) { reAdjust(id); return; }
  for (let j = i; j < x.sets.length; j++) {
    const o = x.sets[j];
    if (o.done || (j > i && o.w !== old && o.w != null)) continue;
    o.w = o.tw = w;
    o.man = true;
    const E = o.E || liveE(id);
    if (E > 0 && w > 0) {
      const r = clamp(repsFor(E, w), Math.max(1, e.lo - 3), e.hi + 5); // nie absurde Ziele wie „2 Wdh.“
      o.r = o.tr = r;
      o.warn = r < e.lo ? 'heavy' : r > e.hi + 3 ? 'light' : null;
    }
  }
}
function setR(id, i, r) {
  const s = S.draft.ex[id].sets[i];
  s.r = r;
  touch();
  if (s.done) reAdjust(id);
}

function check(id, i) {
  const D = S.draft, x = D.ex[id], s = x.sets[i], e = entryOf(D.day, id);
  // Ein Tipp auf einen abgehakten Satz öffnet nur die Bearbeitung. Wieder öffnen geht dort mit „Nicht gemacht“.
  if (s.done) {
    V.edit = V.edit && V.edit.id === id && V.edit.i === i ? null : { id, i };
    renderMain();
    return;
  }
  if (s.w == null) {
    V.edit = { id, i };
    renderMain();
    setTimeout(() => { const el = $(`w-${id}-${i}`); if (el) el.focus(); }, 60);
    return;
  }
  if (s.tw == null) s.tw = s.w; // erstes Mal: das selbst gewählte Gewicht ist das Ziel
  s.done = true;
  s.t = Date.now();
  if (!D.start) D.start = s.t;
  D.last = { id, i };
  D.cur = id;
  V.edit = null;
  V.fin = false;
  adjustAfter(e, x, i, incOf(id));
  D.rest = { end: Date.now() + e.rest * 1000, total: e.rest };
  touch(); save(); renderMain(); keepAwake();
}
function undone(id, i) {
  const D = S.draft, s = D.ex[id].sets[i];
  if (!s || !s.done) return;
  s.done = false; delete s.f; delete s.t;
  if (D.last && D.last.id === id && D.last.i === i) D.last = null;
  V.edit = null;
  touch(); save(); renderMain();
}
function addSet(id) {
  const x = S.draft.ex[id], L = x.sets[x.sets.length - 1];
  const w = L.done ? L.w : (L.tw != null ? L.tw : L.w), r = L.done ? L.r : (L.tr != null ? L.tr : L.r);
  x.sets.push({ w, r, tw: w, tr: r, pw: null, pr: null, E: w > 0 ? e1(w, r) : undefined, done: false, add: true }); // Zusatzsatz zählt nicht als verfehlt
  touch(); save(); renderMain();
}
function delSet(id, i) {
  const D = S.draft, x = D.ex[id];
  if (x.sets.length < 2 || x.sets[i].done) return;
  x.sets.splice(i, 1);
  if (D.last && D.last.id === id && D.last.i > i) D.last.i--;
  V.edit = null;
  touch(); save(); renderMain();
}
function toggleSkip(id) {
  const D = S.draft;
  if (D.skip[id]) delete D.skip[id]; else D.skip[id] = true;
  if (D.cur === id) D.cur = null;
  V.edit = null;
  touch(); save(); renderMain();
}
function move(id, d) {
  const o = S.draft.order, i = o.indexOf(id), j = i + d;
  if (i < 0 || j < 0 || j >= o.length) return;
  [o[i], o[j]] = [o[j], o[i]];
  touch(); save(); renderMain();
}
function pickDay(date, k) {
  const planned = WEEK0[dateOf(date).getDay()] || '';
  if (k === 'plan' || k === planned) delete S.ov[date]; else S.ov[date] = k;
  if (date === todayIso() && S.draft && !hasDone(S.draft)) S.draft = null;
  V.pick = false; V.summary = null; V.edit = null;
  save(); render();
}
function finish() {
  const D = S.draft;
  if (!D) return;
  const s = sessionFromDraft(D, Date.now());
  if (s) {
    S.sessions.push(s);
    for (const id in s.ex) noteStag(id, D.ex[id] && D.ex[id].tag);
  }
  S.draft = null;
  V.fin = false; V.edit = null; V.summary = s ? s.id : null;
  releaseWake(); hideTimer(); save(); render(); scrollTo(0, 0);
}
// Stagnation merken: Neustart gemacht → Stufe 1. Neuer Bestwert → alles wieder normal.
function noteStag(id, tag) {
  const h = histW(id), ser = eSeries(h, id).map(p => p.v);
  if (tag === 'reset') { S.stag[id] = { st: 1, n: h.length, best: Math.max(...ser.slice(0, -1), 0) }; return; }
  const st = S.stag[id];
  if (st && ser.length && ser[ser.length - 1] > st.best * 1.01) delete S.stag[id];
}
// Übung tauschen: nur heute oder dauerhaft im Plan. Die neue Übung hat ihren eigenen Verlauf.
function swapEx(id, to, forever) {
  const D = S.draft, day = D ? D.day : null, e = entryOf(day, id);
  if (D) D.ent = D.ent || {};
  const ne = { ...e, id: to, h: '' };
  if (forever && S.plan[day]) {
    const i = S.plan[day].x.findIndex(x => x.id === id);
    if (i >= 0) { S.plan[day].x[i] = ne; S.planCustom = true; }
  }
  if (D && D.ex[id] && !D.ex[id].sets.some(s => s.done)) {
    D.ent[to] = ne;
    D.order[D.order.indexOf(id)] = to;
    D.ex[to] = buildEx(ne, D.deload);
    delete D.ex[id];
    if (D.cur === id) D.cur = null;
    touch();
  }
  delete S.stag[id];
  V.swapTo = null;
  save(); closeSheet(); renderMain();
}
// Gespeichertes Training von heute wieder öffnen, um etwas zu ändern oder weiterzumachen
function reopen(sid) {
  const s = sessById(sid);
  if (!s || s.date !== todayIso() || hasDone(S.draft) || !S.plan[s.day]) return;
  S.sessions = S.sessions.filter(o => o.id !== sid);
  const D = buildDraft(s.day, s.date);
  D.start = s.start;
  D.touched = true;
  for (const id in s.ex) {
    if (!D.ex[id]) { D.order.push(id); D.ex[id] = { tag: null, d: 0, first: false, sets: [] }; }
    const x = D.ex[id];
    s.ex[id].forEach((z, j) => {
      const o = { w: z.w, r: z.r, tw: z.tw != null ? z.tw : z.w, tr: z.tr != null ? z.tr : z.r, pr: x.sets[j] ? x.sets[j].pr : z.r, done: true, t: z.t };
      if (z.f) o.f = z.f;
      if (j < x.sets.length) x.sets[j] = o; else x.sets.push(o);
    });
  }
  for (const id of s.skip || []) if (D.ex[id]) D.skip[id] = true;
  S.draft = D;
  V.summary = null;
  save(); render();
}

/* ---------- Blöcke, Entlastung, Sätze pro Muskel ---------- */

// Nach 6 Wochen (oder nach einer vorgezogenen Entlastung) startet der nächste Block mit angepassten Sätzen
function rollBlock() {
  const t = todayIso(), earlyDone = S.block.early && mondayOf(t) > S.block.early;
  if (blockWeek(t) <= BLOCK_WEEKS && !earlyDone) return;
  const items = adjustVolume();
  S.blockLog = { n: S.block.n + 1, items, seen: false };
  S.block = { n: S.block.n + 1, start: mondayOf(t), early: '' };
  if (S.draft && !S.draft.touched) S.draft = null;
  save();
}
function dayMinutes(k, extra) {
  const x = S.plan[k].x;
  return estMinutes(x.reduce((a, e) => a + e.s, 0) + (extra || 0), x.length, pace());
}
// Punkt 9: Muskel überall stärker geworden → +1 Satz (Schultern zuerst), schwächer geworden → −1 Satz
function adjustVolume() {
  const start = S.block.start, ms = muscleSets(S.plan), out = [];
  const trend = id => {
    const ser = eSeries(histW(id), id).filter(p => p.s.date >= start);
    return ser.length >= 2 ? ser[ser.length - 1].v / ser[0].v : null;
  };
  for (const m of MUSCLE_PRIO) {
    const [, lo, hi] = MUSCLES[m], exs = [];
    for (const k of DAY_KEYS) for (const e of S.plan[k].x) if (EX[e.id] && EX[e.id].m === m) exs.push({ k, e });
    const tr = [...new Set(exs.map(x => x.e.id))].map(trend).filter(v => v != null);
    if (!tr.length) continue;
    if (tr.every(v => v > 1.01) && ms[m] + 1 <= hi) {
      const c = exs.filter(x => x.e.s < 5 && dayMinutes(x.k, 1) <= 90).sort((a, b) => a.e.s - b.e.s)[0];
      if (c) { c.e.s++; ms[m]++; out.push(`+1 Satz ${exName(c.e.id)} (${dayName(c.k)})`); }
    } else if (tr.some(v => v < 0.98) && ms[m] - 1 >= lo) {
      const c = exs.filter(x => x.e.s > 2).sort((a, b) => b.e.s - a.e.s)[0];
      if (c) { c.e.s--; ms[m]--; out.push(`−1 Satz ${exName(c.e.id)} (${dayName(c.k)})`); }
    }
  }
  if (out.length) S.planCustom = true;
  return out;
}
// Früher entlasten: in 2 Wochen hintereinander ist bei mindestens 40 % der Übungen die Stärke gefallen
function earlyDeloadDue() {
  const t = todayIso(), mon = mondayOf(t);
  if (S.block.early || isDeload(t) || S.noEarly === mon || blockWeek(t) < 3) return false;
  const fell = from => {
    const to = iso(new Date(dateOf(from).getTime() + 7 * DAY_MS));
    let n = 0, f = 0;
    for (const s of S.sessions) {
      if (s.deload || s.date < from || s.date >= to) continue;
      for (const id in s.ex) {
        const prev = histW(id).find(o => sessTime(o) < sessTime(s));
        if (!prev) continue;
        n++;
        if (setsStrength(s.ex[id]) < setsStrength(prev.ex[id]) * 0.99) f++;
      }
    }
    return n >= 4 ? f / n : 0;
  };
  const w1 = iso(new Date(dateOf(mon).getTime() - 7 * DAY_MS)), w2 = iso(new Date(dateOf(mon).getTime() - 14 * DAY_MS));
  return fell(w1) >= 0.4 && fell(w2) >= 0.4;
}

/* ---------- Körpergewicht ---------- */

function bwHint() {
  const last = S.bw[S.bw.length - 1];
  if (!last) return '';
  const t = bwTrend(S.bw, todayIso()), prot = Math.round(last.kg * 1.8 / 5) * 5;
  let txt = t == null ? 'Für einen Trend brauche ich noch ein paar Wochen.'
    : t < 0.1 ? `Dein Gewicht steigt kaum (${fw(Math.round(t * 100) / 100)} kg/Woche). Für mehr Masse iss etwa 200 kcal mehr am Tag.`
    : t > 0.35 ? `Du nimmst schnell zu (${fw(Math.round(t * 100) / 100)} kg/Woche), das ist viel Fett. Iss etwa 200 kcal weniger.`
    : `Passt: +${fw(Math.round(t * 100) / 100)} kg pro Woche, das ist sauberer Aufbau.`;
  return `${txt} Eiweiß: etwa ${prot} g am Tag.`;
}
const bwDue = () => !S.bw.length || dateOf(todayIso()) - dateOf(S.bw[S.bw.length - 1].d) >= 7 * DAY_MS;

/* ---------- Anzeige ---------- */

function render() { renderBanner(); renderWeek(); renderMain(); }

function renderBanner() {
  const out = [], busy = hasDone(S.draft);
  if (V.update) out.push('<div class="bn"><span>Neue Version ist da.</span><button data-act="update">Aktualisieren</button></div>');
  if (S.blockLog && !S.blockLog.seen) out.push(`<div class="bn"><span><b>Block ${S.blockLog.n} startet.</b> ${S.blockLog.items.length ? esc(S.blockLog.items.join(' · ')) : 'Sätze bleiben gleich.'}</span><button data-act="blockok">OK</button></div>`);
  if (!busy && earlyDeloadDue()) out.push('<div class="bn warn"><span>Bei vielen Übungen geht es gerade zurück. Diese Woche entlasten?</span><button data-act="early">Ja</button><button data-act="noearly">Nein</button></div>');
  if (!busy && bwDue() && V.bwLater !== todayIso()) out.push(`<div class="bn"><span>Wiegen: Gewicht von heute früh?</span><input id="bwIn" class="bwin" inputmode="decimal" placeholder="kg" aria-label="Körpergewicht in kg"><button data-act="bwsave">OK</button><button class="ghost" data-act="bwlater" aria-label="Später">Später</button></div>`);
  if (V.storeErr) out.push('<div class="bn warn"><span>Speichern klappt gerade nicht. Speicher jetzt eine Sicherung.</span><button data-act="export">Sichern</button></div>');
  else if (backupDue() && !hasDone(S.draft)) {
    const d = S.backupAt ? Math.floor((Date.now() - S.backupAt) / DAY_MS) : null;
    out.push(`<div class="bn warn"><span>${d == null ? 'Noch keine Sicherung gespeichert.' : `Letzte Sicherung vor ${d} Tagen.`}</span><button data-act="export">Jetzt sichern</button></div>`);
  }
  $('banner').innerHTML = out.join('');
}

function weekDays() {
  const n = new Date(), m = new Date(n);
  m.setDate(n.getDate() - ((n.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(m); d.setDate(m.getDate() + i); return d; });
}
function renderWeek() {
  const t = todayIso();
  $('week').innerHTML = weekDays().map(d => {
    const ds = iso(d), k = dayFor(ds), done = S.sessions.some(s => s.date === ds);
    const cls = ['wd', k ? '' : 'rest', ds === t ? 'today' : '', ds === V.sel ? 'sel' : '', done ? 'done' : '', ds in S.ov && !done ? 'ov' : ''].filter(Boolean).join(' ');
    return `<button class="${cls}" data-act="day" data-date="${ds}" aria-label="${WDN[d.getDay()]}, ${d.getDate()}."><b>${WDS[d.getDay()]}</b><i>${d.getDate()}</i><small>${done ? 'Fertig' : k ? (SHORT[k] || '') : 'Frei'}</small></button>`;
  }).join('');
}

function renderMain() {
  const t = todayIso();
  if (V.sel !== t) { hideTimer(); return renderOther(V.sel); }
  if (V.summary) { const s = sessById(V.summary); if (s) { hideTimer(); return renderSummary(s); } V.summary = null; }
  const k = dayFor(t);
  let D = S.draft;
  if (D && D.date === t && D.day !== k && !hasDone(D)) D = S.draft = null;
  if (D && D.date === t) return renderTraining(D);
  hideTimer();
  if (!k) return renderRest();
  const done = S.sessions.filter(s => s.date === t && s.day === k).pop();
  if (done) return renderSummary(done);
  S.draft = buildDraft(k, t);
  save();
  return renderTraining(S.draft);
}

function pickChips(date, cur) {
  const planned = WEEK0[dateOf(date).getDay()] || '';
  return `<div class="pick">${DAY_KEYS.map(k => `<button data-act="pickday" data-date="${date}" data-k="${k}"${k === cur ? ' class="on"' : ''}>${esc(dayName(k))}</button>`).join('')}<button data-act="pickday" data-date="${date}" data-k=""${!cur ? ' class="on"' : ''}>Ruhetag</button></div>`
    + (date in S.ov ? `<button class="link" data-act="pickday" data-date="${date}" data-k="plan">Zurück zum normalen Plan (${planned ? esc(dayName(planned)) : 'Ruhetag'})</button>` : '');
}

function renderRest() {
  const n = new Date();
  let nx = null;
  for (let i = 1; i <= 7 && !nx; i++) { const d = new Date(n); d.setDate(n.getDate() + i); const k = dayFor(iso(d)); if (k) nx = { k, d }; }
  $('hero').innerHTML = `<div class="eyebrow">${WDN[n.getDay()]} · heute</div><h1>Ruhetag</h1>${nx ? `<p>Nächste Einheit: ${WDN[nx.d.getDay()]}, ${esc(dayName(nx.k))}.</p>` : ''}`;
  $('list').innerHTML = `<div class="card"><h2>Trotzdem trainieren?</h2><p>Wähl die Einheit für heute. Das gilt nur für heute.</p>${pickChips(todayIso(), null)}</div>`;
}

function renderTraining(D) {
  const ids = D.order.filter(id => !D.skip[id]);
  let total = 0, done = 0;
  for (const id of ids) {
    const ss = D.ex[id].sets;
    total += ss.length;
    done += ss.filter(s => s.done).length;
  }
  const min = Math.round(estMinutes(total, ids.length, pace()) / 5) * 5, wk = blockWeek(D.date);
  $('hero').innerHTML = `<div class="eyebrow">${WDN[dateOf(D.date).getDay()]} · heute · Block ${S.block.n}, Woche ${Math.min(wk, BLOCK_WEEKS)}/${BLOCK_WEEKS}</div><h1>${esc(dayName(D.day))}</h1>
    <p>${D.deload ? '<b>Entlastungswoche:</b> halbe Sätze, 10 % leichter. Nicht bis ans Limit.' : esc((S.plan[D.day] && S.plan[D.day].f) || '')}</p>
    <div class="meta"><span><strong>${ids.length}</strong> Übungen</span><span><strong>${total}</strong> Sätze</span><span>ca. <strong>${min}</strong> Min</span><span><strong>${done}/${total}</strong> erledigt</span></div>
    <div class="bar"><div style="width:${total ? done / total * 100 : 0}%"></div></div>
    <button class="link" data-act="picktoggle">${V.pick ? 'Doch nicht tauschen' : 'Heute was anderes trainieren?'}</button>`;
  const nx = nextSet(D);
  const pick = !V.pick ? '' : `<div class="card"><h2>Stattdessen heute</h2>${hasDone(D)
    ? '<p>Du hast schon Sätze abgehakt. Beende erst dieses Training.</p>'
    : `<p>Gilt nur für heute.</p>${pickChips(D.date, D.day)}`}</div>`;
  const fin = V.fin
    ? '<div class="card"><p>Training speichern? Nicht abgehakte Sätze zählen nicht.</p><div class="two"><button class="btn ghost" data-act="finno">Zurück</button><button class="btn confirm" data-act="finyes">Speichern</button></div></div>'
    : `<button class="btn primary" data-act="fin"${done ? '' : ' disabled'}>Training beenden</button>`;
  $('list').innerHTML = pick + D.order.map((id, ix) => exCard(D, id, ix, nx, id === ids[0])).join('') + fin;
  if (D.rest) showTimer(); else hideTimer();
}

function exCard(D, id, ix, nx, isFirst) {
  const e = entryOf(D.day, id), x = D.ex[id], name = esc(exName(id));
  if (D.skip[id]) return `<article class="ex skipped"><button class="exn" data-act="exsheet" data-id="${id}">${name} · übersprungen</button><button class="add" data-act="skip" data-id="${id}">Zurückholen</button></article>`;
  const complete = x.sets.every(s => s.done);
  const hint = [D.deload ? '2–3 Wdh. im Tank' : e.role === 'iso' ? 'Bis zum Versagen' : '1–2 Wdh. im Tank', e.h].filter(Boolean).join(' · ');
  const swap = !D.deload && suggestSwap(id) ? `<p class="hint warn">Hängt trotz Neustart. <button class="link" data-act="exsheet" data-id="${id}">Tauschen?</button></p>` : '';
  return `<article class="ex${complete ? ' complete' : ''}" id="ex-${id}">
    <div class="exh"><div class="num">${ix + 1}</div><button class="exn" data-act="exsheet" data-id="${id}">${name}${ICON_GO}</button>
      <div class="exm"><span>${x.sets.length} × ${e.lo}–${e.hi}</span><span>Pause ${restTxt(e.rest)}</span>${tagHTML(x)}</div>
      <p class="hint">${esc(hint)}</p>${swap}</div>
    <div class="plan" id="pl-${id}">${planHTML(D, id)}</div>
    ${isFirst ? `<div class="warm" id="wu-${id}">${warmHTML(id, x)}</div>` : ''}
    <div class="sets">${x.sets.map((s, i) => rowHTML(D, id, i, nx)).join('')}</div>
    <div class="exf"><button class="add" data-act="addset" data-id="${id}">+ Satz</button></div>
  </article>`;
}

// Kurzes Etikett, warum das Ziel heute so ist
function tagHTML(p) {
  const t = p.tag, d = p.d;
  return t === 'up' ? `<span class="tag up">+${fw(d)} kg</span>`
    : t === 'more' ? `<span class="tag up">+${d} Wdh.</span>`
    : t === 'down' ? `<span class="tag down">−${fw(d)} kg, neu aufbauen</span>`
    : t === 'hold' ? '<span class="tag down">Ziel wiederholen</span>'
    : t === 'again' ? '<span class="tag new">Wie letztes Mal geplant</span>'
    : t === 'pause' ? `<span class="tag down">${d} Tage Pause, leichter</span>`
    : t === 'reset' ? '<span class="tag down">Hängt: 10 % leichter, volle Spanne</span>'
    : t === 'deload' ? '<span class="tag new">Entlastung</span>'
    : t === 'new' ? '<span class="tag new">Erstes Mal</span>'
    : t === 'bwmax' ? '<span class="tag up">Oben angekommen: langsamer ablassen oder Beine gestreckter</span>' : '';
}
function planHTML(D, id) {
  const x = D.ex[id], lh = hist(id)[0], tgt = fmtSets(x.sets, true);
  const last = lh ? `<span>Letztes Mal</span><b>${fmtSets(lh.ex[id], false)} <span>· ${ago(lh.date)}</span></b>` : '';
  if (tgt) return `${last}<span class="now">Ziel heute</span><b class="now">${tgt}</b>`;
  return `${last}<b class="full">Erstes Mal: ${x.sets[0].r} Wdh. pro Satz. Nimm ein Gewicht, mit dem du die gerade so schaffst. Ab dann gibt die App die Gewichte vor.</b>`;
}
function warmHTML(id, x) {
  const s = x.sets[0], w0 = s.tw != null ? s.tw : s.w, inc = incOf(id);
  if (!(w0 > 0)) return '';
  return `Aufwärmen: ${fw(roundW(w0 * 0.5, inc))} kg × 10 · ${fw(roundW(w0 * 0.75, inc))} kg × 5`;
}
const wValHTML = s => s.w == null ? 'kg wählen' : `${fw(s.w)}<small>kg</small>`;
const rValHTML = s => `${s.r}<small>Wdh.</small>`;
function warnTxt(s) {
  if (s.done) {
    const tw = s.tw != null ? s.tw : s.w;
    return s.tr != null && (s.r !== s.tr || s.w !== tw) ? `Ziel war ${fw(tw)} kg × ${s.tr}` : '';
  }
  return s.warn === 'heavy' ? 'Zu schwer für die Spanne. Lieber etwas leichter.' : s.warn === 'light' ? 'Zu leicht für die Spanne. Lieber etwas schwerer.' : '';
}
function rowHTML(D, id, i, nx) {
  const x = D.ex[id], s = x.sets[i], a = `data-id="${id}" data-i="${i}"`;
  const isNext = nx && nx.id === id && nx.i === i, ed = V.edit && V.edit.id === id && V.edit.i === i;
  const lp = isNext && !D.deload && entryOf(D.day, id).lp && i === x.sets.length - 1;
  return `<div class="row${s.done ? ' done' : ''}${isNext ? ' next' : ''}">
    ${isNext ? `<div class="goal"><span>Satz ${i + 1} · Ziel</span><b id="gl-${id}-${i}">${goalTxt(s)}</b>${lp ? '<small>Danach 3–6 halbe Wdh. in der Dehnung</small>' : ''}</div>` : ''}
    <div class="si">${i + 1}</div>
    <button class="val${s.w == null ? ' empty' : ''}${ed ? ' on' : ''}" data-act="ed" ${a} id="vw-${id}-${i}" aria-label="Gewicht Satz ${i + 1} ändern">${wValHTML(s)}</button>
    <button class="val${ed ? ' on' : ''}" data-act="ed" ${a} id="vr-${id}-${i}" aria-label="Wiederholungen Satz ${i + 1} ändern">${rValHTML(s)}</button>
    <button class="chk" data-act="chk" ${a} aria-label="Satz ${i + 1} ${s.done ? 'bearbeiten' : 'abhaken'}">${ICON_OK}</button>
    <p class="wn" id="wn-${id}-${i}">${esc(warnTxt(s))}</p>
    ${ed ? editHTML(id, i, s, x) : ''}
  </div>`;
}
function editHTML(id, i, s, x) {
  const a = `data-id="${id}" data-i="${i}"`, inc = fw(incOf(id));
  return `<div class="edit"><div class="edit2">
    <div class="step"><label for="w-${id}-${i}">Gewicht kg · Schritt ${inc}</label><div class="stp"><button data-step="w-" ${a} aria-label="${inc} kg weniger">−</button><input id="w-${id}-${i}" data-inp="w" ${a} inputmode="decimal" enterkeyhint="done" autocomplete="off" value="${s.w == null ? '' : fw(s.w)}" placeholder="kg"><button data-step="w+" ${a} aria-label="${inc} kg mehr">+</button></div></div>
    <div class="step"><label for="r-${id}-${i}">Wiederholungen</label><div class="stp"><button data-step="r-" ${a} aria-label="eine Wiederholung weniger">−</button><input id="r-${id}-${i}" data-inp="r" ${a} inputmode="numeric" enterkeyhint="done" autocomplete="off" value="${s.r}"><button data-step="r+" ${a} aria-label="eine Wiederholung mehr">+</button></div></div>
    </div><div class="eacts">${s.done ? `<button data-act="undone" ${a}>Nicht gemacht</button>` : x.sets.length > 1 ? `<button data-act="delset" ${a}>Satz löschen</button>` : '<span></span>'}<button class="ok" data-act="edclose">Fertig</button></div></div>`;
}

// Nur Zahlen neu malen, ohne Knöpfe neu zu bauen. So gehen schnelle Plus/Minus-Tipps nicht verloren.
function paintEx(id) {
  const D = S.draft;
  if (!D || !D.ex[id]) return;
  const x = D.ex[id];
  x.sets.forEach((s, i) => {
    const vw = $(`vw-${id}-${i}`); if (vw) { vw.innerHTML = wValHTML(s); vw.classList.toggle('empty', s.w == null); }
    const vr = $(`vr-${id}-${i}`); if (vr) vr.innerHTML = rValHTML(s);
    const wn = $(`wn-${id}-${i}`); if (wn) wn.textContent = warnTxt(s);
    const gl = $(`gl-${id}-${i}`); if (gl) gl.textContent = goalTxt(s);
    const wi = $(`w-${id}-${i}`); if (wi && document.activeElement !== wi) wi.value = s.w == null ? '' : fw(s.w);
    const ri = $(`r-${id}-${i}`); if (ri && document.activeElement !== ri) ri.value = s.r;
  });
  const pl = $(`pl-${id}`); if (pl) pl.innerHTML = planHTML(D, id);
  const wu = $(`wu-${id}`); if (wu) wu.innerHTML = warmHTML(id, x);
  if (D.rest) tick();
}

function renderSummary(s) {
  const k = s.day, ids = Object.keys(s.ex);
  const sets = ids.reduce((a, id) => a + s.ex[id].length, 0);
  const vol = ids.reduce((a, id) => a + s.ex[id].reduce((b, x) => b + x.w * x.r, 0), 0);
  // Dauer aus den Satzzeiten, damit spät getipptes „Training beenden“ nichts verfälscht
  const ts = ids.flatMap(id => s.ex[id].map(x => x.t).filter(Boolean)).sort((a, b) => a - b);
  const pc = pace(), gaps = ts.slice(1).map((t, i) => (t - ts[i]) / 60000).filter(g => g >= 0.4 && g <= 15);
  const min = ts.length > 1 ? Math.max(1, Math.round(gaps.reduce((a, g) => a + g, 0) + pc.set * (ts.length - gaps.length))) : null;
  const prs = [], nxt = [];
  for (const id of ids) {
    const best = setsStrength(s.ex[id]);
    const prev = S.sessions.filter(o => o.id !== s.id && sessTime(o) < sessTime(s) && o.ex && o.ex[id]);
    const pb = Math.max(0, ...prev.map(o => setsStrength(o.ex[id])));
    if (prev.length && best > pb + 0.01) {
      const top = s.ex[id].reduce((a, x) => e1(x.w, x.r, x.f) > e1(a.w, a.r, a.f) ? x : a);
      prs.push(`<li><span>${esc(exName(id))}</span><span class="pr">${fw(top.w)} kg × ${top.r}</span></li>`);
    }
    const h = histW(id);
    if (!h.length || h[0].id !== s.id) continue; // „Nächstes Mal“ nur für die neueste Einheit
    if (s.deload) continue;
    const p = planFor(entryOf(k, id));
    const ch = p.tag === 'up' ? ` (+${fw(p.d)} kg)` : p.tag === 'down' ? ` (−${fw(p.d)} kg)` : p.tag === 'hold' ? ' (nochmal)' : p.tag === 'more' ? ` (+${p.d} Wdh.)` : '';
    nxt.push(`<li><span>${esc(exName(id))}</span><span class="${p.tag === 'up' || p.tag === 'more' ? 'up' : p.tag === 'down' || p.tag === 'hold' ? 'down' : ''}">${p.w == null ? '–' : fw(p.w)} kg × ${p.reps.join(' · ')}${ch}</span></li>`);
  }
  $('hero').innerHTML = `<div class="eyebrow">${dateLong(s.date)}</div><h1>${esc(dayName(k))} erledigt</h1>`;
  $('list').innerHTML = `<div class="card">
      <div class="stats"><div class="stat"><b>${sets}</b><span>Sätze</span></div><div class="stat"><b>${Math.round(vol).toLocaleString('de-DE')}</b><span>kg Volumen</span></div><div class="stat"><b>${min == null ? '–' : min}</b><span>Minuten</span></div></div>
      ${prs.length ? `<p class="sec">Neue Bestwerte</p><ul class="lst">${prs.join('')}</ul>` : ''}
      ${nxt.length ? `<p class="sec">Nächstes Mal</p><ul class="lst">${nxt.join('')}</ul><p class="note">Alles geschafft: mehr Wiederholungen, oben angekommen: mehr Gewicht. Verfehlt: gleiches Ziel noch mal.</p>` : ''}
      ${s.skip && s.skip.length ? `<p class="note">Übersprungen: ${s.skip.map(id => esc(exName(id))).join(', ')}</p>` : ''}
    </div>
    ${s.date === todayIso() && !hasDone(S.draft) ? `<button class="btn ghost" data-act="reopen" data-sid="${esc(s.id)}">Nochmal öffnen</button>` : ''}`;
}

function renderOther(date) {
  const past = date < todayIso(), k = dayFor(date);
  const ss = S.sessions.filter(s => s.date === date);
  if (past) {
    if (ss.length) return renderSummary(ss[ss.length - 1]);
    $('hero').innerHTML = `<div class="eyebrow">${dateLong(date)}</div><h1>${k ? 'Nicht trainiert' : 'Ruhetag'}</h1>${k ? `<p>Geplant war ${esc(dayName(k))}.</p>` : ''}`;
    $('list').innerHTML = '';
    return;
  }
  $('hero').innerHTML = `<div class="eyebrow">${dateLong(date)}</div><h1>${k ? esc(dayName(k)) : 'Ruhetag'}</h1>${k ? `<p>${esc(S.plan[k].f)}</p>` : ''}`;
  const prev = !k ? '' : `<div class="card"><h2>Vorschau</h2><div class="prev">${S.plan[k].x.map(e => {
    const p = planFor(e);
    return `<div><span>${esc(exName(e.id))}</span><span>${p.w == null ? `Erstes Mal · ${p.reps[0]} Wdh.` : `${fw(p.w)} kg × ${p.reps.join(' · ')}`}</span></div>`;
  }).join('')}</div><p class="note">Stand heute. Was du bis dahin trainierst, fließt noch ein.</p></div>`;
  $('list').innerHTML = prev + `<div class="card"><h2>An diesem Tag tauschen</h2><p>Gilt nur für diesen einen Tag.</p>${pickChips(date, k)}</div>`;
}

/* ---------- Pause ---------- */

function showTimer() { if (!timerInt) timerInt = setInterval(tick, 250); tick(); }
function hideTimer() { clearInterval(timerInt); timerInt = null; tOver = null; $('timer').hidden = true; }
function tick() {
  const D = S.draft, R = D && D.date === todayIso() && D.rest;
  if (!R || V.sel !== todayIso() || V.summary) { hideTimer(); return; }
  const ms = R.end - Date.now(), over = ms <= 0;
  if (over && -ms > 120000) { D.rest = null; saveSoon(); hideTimer(); return; }
  const sec = Math.ceil(Math.abs(ms) / 1000);
  $('timer').hidden = false;
  $('tclock').textContent = `${over ? '+' : ''}${Math.floor(sec / 60)}:${pad(sec % 60)}`;
  $('tlab').textContent = (over ? 'Pause vorbei · ' : 'Gleich: ') + restLabel(D);
  $('tprog').style.width = `${Math.min(100, (1 - ms / (R.total * 1000)) * 100)}%`;
  if (tOver !== over) {
    tOver = over;
    $('timer').classList.toggle('over', over);
    $('tbtns').innerHTML = (over ? '' : '<button data-tact="t15">+15 s</button>') + `<button data-tact="tskip">${over ? 'OK' : 'Weiter'}</button>`;
  }
}
function tact(a) {
  const D = S.draft;
  if (!D || !D.rest) return;
  if (a === 't15') { D.rest.end += 15000; D.rest.total += 15; tick(); }
  if (a === 'tskip') {
    D.rest = null;
    hideTimer();
    const n = document.querySelector('.row.next');
    if (n) n.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  saveSoon();
}
async function keepAwake() {
  try { if (!wake && navigator.wakeLock) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); } } catch (e) {}
}
function releaseWake() { try { if (wake) wake.release(); } catch (e) {} wake = null; }

/* ---------- Blätter: Übung und Einstellungen ---------- */

function openSheet(html) { $('shin').innerHTML = html; $('sheet').hidden = false; $('sheetBg').hidden = false; }
function closeSheet() { $('sheet').hidden = true; $('sheetBg').hidden = true; V.sheet = null; }

function exSheet(id) {
  V.sheet = { t: 'ex', id };
  const D = S.draft && S.draft.date === todayIso() && V.sel === todayIso() && !V.summary ? S.draft : null;
  const inD = D && D.ex[id], e = inD ? entryOf(D.day, id) : findEntry(id);
  const h = hist(id), ser = eSeries(h.filter(s => !s.deload), id).slice(-24);
  const E = ser.length ? ser[ser.length - 1].v : 0;
  let delta = '';
  if (ser.length >= 2) {
    const pc = Math.round((E / ser[0].v - 1) * 1000) / 10;
    delta = `${pc >= 0 ? '+' : '−'}${fw(Math.abs(pc))} % seit ${fmtD(ser[0].s.date)}`;
  }
  const inc = incOf(id), i = inD ? D.order.indexOf(id) : -1;
  const acts = !inD ? '' : `<div class="two"><button class="btn ghost" data-act="mv" data-id="${id}" data-d="-1"${i <= 0 ? ' disabled' : ''}>Früher machen</button><button class="btn ghost" data-act="mv" data-id="${id}" data-d="1"${i >= D.order.length - 1 ? ' disabled' : ''}>Später machen</button></div>
    <button class="btn ghost" data-act="skip" data-id="${id}">${D.skip[id] ? 'Zurückholen' : 'Heute überspringen'}</button>`;
  openSheet(`<div class="shh"><div><div class="eyebrow">${e ? `${e.s} × ${e.lo}–${e.hi} · Pause ${restTxt(e.rest)}` : 'Übung'}</div><h2>${esc(exName(id))}</h2></div><button class="icon-btn" data-act="close" aria-label="Schließen">${ICON_X}</button></div>
    ${acts}
    <p class="sec">Arbeitsstärke</p>
    ${E ? `<div class="big"><b>${fw(Math.round(E * 10) / 10)} kg</b><span>${delta}</span></div>${chartHTML(ser)}
      <p class="note">So viel könntest du etwa einmal schaffen, gemittelt aus deinen letzten 3 Einheiten. Steigt die Linie, wirst du stärker.</p>`
      : '<p class="note">Noch keine Werte. Nach dem ersten Training siehst du hier deinen Verlauf.</p>'}
    ${h.length ? `<p class="sec">Letzte Einheiten</p><ul class="hl">${h.slice(0, 10).map(s => `<li><span>${fmtDW(s.date)}${s.deload ? ' E' : ''}</span><span class="sx">${s.ex[id].map(x => `<i${tgtR(x) != null && x.r < tgtR(x) ? ' class="f3"' : ''}>${fw(x.w)}×${x.r}</i>`).join('')}</span></li>`).join('')}</ul>
      <p class="note">Gelb = Ziel nicht ganz geschafft. E = Entlastungswoche.</p>` : ''}
    ${inD && !D.ex[id].sets.some(s => s.done) ? swapHTML(id, e) : ''}
    <p class="sec">Gewichtsschritt</p>
    <div class="pick"><button data-act="inc" data-id="${id}" data-v="0"${!S.inc[id] ? ' class="on"' : ''}>Automatisch (${fw(autoInc(id))} kg)</button>${STEPS.map(v => `<button data-act="inc" data-id="${id}" data-v="${v}"${S.inc[id] === v ? ' class="on"' : ''}>${fw(v)} kg</button>`).join('')}</div>
    <p class="note">So viel ändern Plus/Minus und das Steigern. „Automatisch“ lernt den Schritt aus deinen Einträgen.</p>
    `);
  bindChart(ser);
}

// Tauschen: Alternativen aus derselben Gruppe, danach „nur heute“ oder „dauerhaft“
function swapHTML(id, e) {
  const g = EX[id] && EX[id].g, usedN = new Set(S.draft.order.map(exName)); // nichts, was heute schon dran ist
  const alts = Object.keys(EX).filter(k => EX[k].g === g && !usedN.has(EX[k].n) && k !== 'sh_kabel2');
  const seen = new Set(), list = alts.filter(k => !seen.has(EX[k].n) && seen.add(EX[k].n));
  if (!list.length) return '';
  const to = V.swapTo && V.swapTo.id === id ? V.swapTo.to : null;
  return `<p class="sec">Tauschen</p>
    ${suggestSwap(id) ? `<p class="note bad">Die Übung hängt trotz Neustart. Ein Tausch bringt oft neuen Reiz.</p><button class="link" data-act="swapno" data-id="${id}">Nein, behalten</button>` : ''}
    <div class="pick">${list.map(k => `<button data-act="swappick" data-id="${id}" data-to="${k}"${to === k ? ' class="on"' : ''}>${esc(EX[k].n)}</button>`).join('')}</div>
    ${to ? `<div class="two"><button class="btn ghost" data-act="swapgo" data-id="${id}" data-to="${to}" data-f="0">Nur heute</button><button class="btn primary" data-act="swapgo" data-id="${id}" data-to="${to}" data-f="1">Dauerhaft</button></div>
      <p class="note">Gleiche Sätze und Spanne (${e.s} × ${e.lo}–${e.hi}). Die neue Übung startet mit eigenem Verlauf.</p>` : '<p class="note">Gerät besetzt oder Übung hängt? Wähl eine Alternative.</p>'}`;
}
// Linie der Arbeitsstärke. Antippen zeigt Datum und Wert.
const CH = { W: 340, H: 170, L: 42, R: 14, T: 16, B: 26 };
function chartPts(ser) {
  const { W, H, L, R, T, B } = CH, vs = ser.map(p => p.v), mn = Math.min(...vs), mx = Math.max(...vs);
  const pv = Math.max((mx - mn) * 0.18, mx * 0.02, 0.5), lo = mn - pv, hi = mx + pv;
  const X = i => L + i * (W - L - R) / (ser.length - 1), Y = v => T + (hi - v) / (hi - lo) * (H - T - B);
  return { pts: ser.map((p, i) => [X(i), Y(p.v)]), Y, mn, mx };
}
function chartHTML(ser) {
  if (ser.length < 2) return '<p class="note">Ab der zweiten Einheit siehst du hier eine Linie.</p>';
  const { W, H, L, R, B } = CH, { pts, Y, mn, mx } = chartPts(ser);
  const line = pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1], base = H - B;
  const grid = [...new Set([Math.round(mn), Math.round(mx)])].map(v => `<line x1="${L}" x2="${W - R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke="var(--line)" stroke-dasharray="3 4"/><text x="${L - 6}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="var(--muted)">${v}</text>`).join('');
  return `<div class="chart" id="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Arbeitsstärke von ${fw(Math.round(ser[0].v))} auf ${fw(Math.round(ser[ser.length - 1].v))} kg">
    ${grid}
    <line x1="${L}" x2="${W - R}" y1="${base}" y2="${base}" stroke="var(--line)"/>
    <text x="${L}" y="${H - 7}" font-size="11" fill="var(--muted)">${fmtD(ser[0].s.date)}</text>
    <text x="${W - R}" y="${H - 7}" font-size="11" fill="var(--muted)" text-anchor="end">${fmtD(ser[ser.length - 1].s.date)}</text>
    <polygon points="${pts[0][0].toFixed(1)},${base} ${line} ${last[0].toFixed(1)},${base}" fill="var(--accent-soft)" opacity=".7"/>
    <polyline points="${line}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    ${pts.length <= 16 ? pts.slice(0, -1).map(p => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"/>`).join('') : ''}
    <circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="5" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"/>
    <circle id="chHi" r="6" fill="none" stroke="var(--ink)" stroke-width="2" visibility="hidden"/>
  </svg><div class="tip" id="chTip" hidden></div></div>`;
}
function bindChart(ser) {
  const box = $('chart');
  if (!box || ser.length < 2) return;
  const svg = box.querySelector('svg'), { pts } = chartPts(ser), hi = $('chHi'), tip = $('chTip');
  const show = ev => {
    const r = svg.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width * CH.W;
    let k = 0;
    pts.forEach((p, i) => { if (Math.abs(p[0] - x) < Math.abs(pts[k][0] - x)) k = i; });
    hi.setAttribute('cx', pts[k][0]); hi.setAttribute('cy', pts[k][1]); hi.setAttribute('visibility', 'visible');
    tip.hidden = false;
    tip.textContent = `${fmtDW(ser[k].s.date)} · ${fw(Math.round(ser[k].v * 10) / 10)} kg`;
    tip.style.left = `${Math.min(80, Math.max(20, pts[k][0] / CH.W * 100))}%`;
  };
  svg.addEventListener('pointerdown', show);
  svg.addEventListener('pointermove', show);
  svg.addEventListener('pointerleave', ev => { if (ev.pointerType === 'mouse') { tip.hidden = true; hi.setAttribute('visibility', 'hidden'); } });
}

function setSheet() {
  V.sheet = { t: 'set' };
  const last = S.backupAt ? `Letzte Sicherung: ${ago(iso(new Date(S.backupAt)))}.` : 'Noch keine Sicherung gespeichert.';
  openSheet(`<div class="shh"><h2>Einstellungen</h2><button class="icon-btn" data-act="close" aria-label="Schließen">${ICON_X}</button></div>
    <p class="sec">Sicherung</p>
    <p class="note">Deine Daten liegen nur auf diesem Handy. Speicher die Sicherung einmal pro Woche in „Dateien“, am besten in iCloud Drive.</p>
    <p class="note">${last}</p>
    <button class="btn primary" data-act="export">Sicherung speichern</button>
    <div class="two"><button class="btn ghost" data-act="import">Sicherung laden</button><button class="btn ghost" data-act="paste">Text einfügen</button></div>
    ${V.paste ? '<textarea id="pasteTxt" placeholder="Gesicherten Text hier einfügen, auch aus der alten Version" aria-label="Sicherung als Text"></textarea><button class="btn primary" data-act="pastego">Übernehmen</button>' : ''}
    <p class="note${V.msg ? (V.msgOk ? ' ok' : ' bad') : ''}" id="setMsg">${esc(V.msg)}</p>
    <p class="sec">Körpergewicht</p>
    <div class="bwrow"><input id="bwIn2" class="bwin" inputmode="decimal" placeholder="kg" aria-label="Körpergewicht in kg"><button class="btn ghost" data-act="bwsave2">Eintragen</button></div>
    ${S.bw.length ? `<p class="note">${S.bw.slice(-6).reverse().map(p => `${fmtD(p.d)} ${fw(p.kg)} kg`).join(' · ')}</p><p class="note">${esc(bwHint())}</p>` : '<p class="note">Einmal pro Woche morgens wiegen. Die App sagt dir dann, ob du im Aufbau bist.</p>'}
    <p class="sec">Darstellung</p>
    <div class="pick">${[['auto', 'Wie iPhone'], ['light', 'Hell'], ['dark', 'Dunkel']].map(([k, n]) => `<button data-act="theme" data-v="${k}"${S.theme === k ? ' class="on"' : ''}>${n}</button>`).join('')}</div>
    <p class="sec">Info</p>
    <p class="note">${S.sessions.length} Trainings gespeichert · Version ${APP_V}${V.persist ? ' · Speicher dauerhaft' : ''}</p>`);
}

/* ---------- Sicherung: Export und Import ---------- */

function exportData() {
  const data = { app: 'eisenlog', v: 1, exported: Date.now(), sessions: S.sessions, plan: S.plan, planV: S.planV, planCustom: S.planCustom, inc: S.inc, ov: S.ov, theme: S.theme, bw: S.bw, stag: S.stag, block: S.block, food: F };
  const txt = JSON.stringify(data), name = `eisenlog-sicherung-${todayIso()}.json`;
  const done = () => {
    S.backupAt = Date.now(); save();
    V.msg = 'Sicherung gespeichert.'; V.msgOk = true;
    renderBanner();
    if (V.sheet && V.sheet.t === 'set') setSheet();
  };
  let file = null;
  try { file = new File([txt], name, { type: 'application/json' }); } catch (e) {}
  // Auf dem iPhone über „Teilen“ → „In Dateien sichern“, am PC als Download
  if (file && navigator.maxTouchPoints > 0 && navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share({ files: [file] }).then(done).catch(err => { if (err && err.name === 'AbortError') return; download(txt, name); done(); });
    return;
  }
  download(txt, name);
  done();
}
function download(txt, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 3000);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/, ID_RE = /^[a-z0-9_]{1,40}$/i;
function cleanSession(o) {
  if (!o || typeof o !== 'object' || !o.ex || typeof o.ex !== 'object') return null;
  const ex = {};
  for (const id of Object.keys(o.ex)) {
    if (!ID_RE.test(id) || !Array.isArray(o.ex[id])) continue;
    const l = [];
    for (const x of o.ex[id]) {
      const w = Number(x && x.w), r = Number(x && x.r);
      if (!isFinite(w) || !isFinite(r) || w < 0 || w > 1000 || r < 0 || r > 200) continue;
      const z = { w: r2(w), r: Math.round(r) };
      if ([1, 2, 3].includes(x.f)) z.f = x.f;
      for (const k of ['t', 'tw', 'tr']) if (x[k] != null && isFinite(Number(x[k]))) z[k] = Number(x[k]);
      for (const k of ['pw', 'pr']) if (x[k] === null || (x[k] != null && isFinite(Number(x[k])))) z[k] = x[k] === null ? null : Number(x[k]);
      l.push(z);
    }
    if (l.length) ex[id] = l;
  }
  if (!Object.keys(ex).length) return null;
  const end = Number(o.end) > 0 ? Number(o.end) : null;
  const date = DATE_RE.test(o.date) ? o.date : end ? iso(new Date(end)) : null;
  if (!date) return null;
  return {
    id: o.id != null ? String(o.id).slice(0, 60) : `i${date}-${end || 0}`, v: 1, date,
    day: typeof o.day === 'string' && o.day.length < 20 ? o.day : '',
    start: Number(o.start) > 0 ? Number(o.start) : null, end: end || Date.parse(date + 'T18:00:00'),
    ex, skip: Array.isArray(o.skip) ? o.skip.filter(s => typeof s === 'string' && ID_RE.test(s)) : [], deload: !!o.deload,
  };
}
function cleanMap(o, ok) {
  const out = {};
  if (o && typeof o === 'object') for (const k of Object.keys(o)) if (ID_RE.test(k) && ok(o[k])) out[k] = o[k];
  return out;
}
function validPlan(p) {
  return !!p && DAY_KEYS.every(k => p[k] && typeof p[k].n === 'string' && Array.isArray(p[k].x) && p[k].x.length
    && p[k].x.every(e => e && ID_RE.test(e.id) && [e.s, e.lo, e.hi, e.rest].every(Number.isInteger) && e.lo <= e.hi && e.s > 0 && e.s < 12 && (e.role in REST)));
}
function importText(txt) {
  let j;
  try { j = JSON.parse(txt); } catch (e) { return [false, 'Das ist keine gültige Sicherung. Nimm die ganze Datei oder den ganzen Text.']; }
  if (!j || !Array.isArray(j.sessions)) return [false, 'In der Datei stehen keine Trainings.'];
  const was = S.sessions.length, have = new Set(S.sessions.map(s => s.id));
  let add = 0, dup = 0, bad = 0;
  for (const raw of j.sessions) {
    const s = cleanSession(raw);
    if (!s) { bad++; continue; }
    if (have.has(s.id)) { dup++; continue; }
    have.add(s.id); S.sessions.push(s); add++;
  }
  S.inc = Object.assign(cleanMap(j.inc, v => typeof v === 'number' && v > 0 && v <= 20), S.inc);
  if (j.app === 'eisenlog') {
    const ov = {};
    if (j.ov && typeof j.ov === 'object') for (const d of Object.keys(j.ov)) if (DATE_RE.test(d) && (j.ov[d] === '' || DAY_KEYS.includes(j.ov[d]))) ov[d] = j.ov[d];
    S.ov = Object.assign(ov, S.ov);
    const have = new Set(S.bw.map(p => p.d));
    if (Array.isArray(j.bw)) for (const p of j.bw) if (p && DATE_RE.test(p.d) && p.kg > 30 && p.kg < 250 && !have.has(p.d)) S.bw.push({ d: p.d, kg: r2(+p.kg) });
    S.bw.sort((a, b) => a.d < b.d ? -1 : 1);
    if (!was) { // leeres Handy: alles übernehmen, auch Plan und Block
      if (j.planV === PLAN_V && validPlan(j.plan)) { S.plan = j.plan; S.planCustom = !!j.planCustom; }
      if (j.block && DATE_RE.test(j.block.start) && j.block.n > 0) S.block = { n: +j.block.n, start: j.block.start, early: DATE_RE.test(j.block.early) ? j.block.early : '' };
      if (j.stag && typeof j.stag === 'object') S.stag = cleanMap(j.stag, v => v && typeof v === 'object' && v.st > 0);
      if (['auto', 'light', 'dark'].includes(j.theme)) S.theme = j.theme;
    }
  }
  if (j.food) foodImport(j.food);
  if (S.draft && !S.draft.touched) S.draft = null;
  save(); applyTheme(); render();
  return [true, `${add} Trainings übernommen${dup ? `, ${dup} waren schon da` : ''}${bad ? `, ${bad} unlesbar` : ''}.`];
}
function showImport(res) {
  [V.msgOk, V.msg] = res;
  if (res[0]) V.paste = false;
  setSheet();
}

function applyTheme() {
  const r = document.documentElement;
  if (S.theme === 'auto') delete r.dataset.theme; else r.dataset.theme = S.theme;
}

/* ---------- Bedienung ---------- */

function act(a, b) {
  const id = b.dataset.id, i = +b.dataset.i;
  switch (a) {
    case 'day': V.sel = b.dataset.date; V.pick = false; V.edit = null; V.fin = false; V.summary = null; render(); scrollTo(0, 0); break;
    case 'picktoggle': V.pick = !V.pick; renderMain(); break;
    case 'pickday': pickDay(b.dataset.date, b.dataset.k); break;
    case 'ed': V.edit = V.edit && V.edit.id === id && V.edit.i === i ? null : { id, i }; renderMain(); break;
    case 'edclose': V.edit = null; renderMain(); break;
    case 'chk': check(id, i); break;
    case 'undone': undone(id, i); break;
    case 'swappick': V.swapTo = { id, to: b.dataset.to }; exSheet(id); break;
    case 'swapgo': swapEx(id, b.dataset.to, b.dataset.f === '1'); break;
    case 'swapno': if (S.stag[id]) S.stag[id].no = true; save(); exSheet(id); renderMain(); break;
    case 'bwsave': case 'bwsave2': {
      const el = $(a === 'bwsave' ? 'bwIn' : 'bwIn2'), kg = parseFloat(String(el && el.value).replace(',', '.'));
      if (!(kg > 30 && kg < 250)) { if (el) el.focus(); break; }
      const t = todayIso();
      S.bw = S.bw.filter(p => p.d !== t).concat({ d: t, kg: r2(kg) });
      save(); renderBanner();
      if (a === 'bwsave2') setSheet();
      break;
    }
    case 'bwlater': V.bwLater = todayIso(); renderBanner(); break;
    case 'blockok': S.blockLog.seen = true; save(); renderBanner(); break;
    case 'early': S.block.early = mondayOf(todayIso()); if (S.draft && !hasDone(S.draft)) S.draft = null; save(); render(); break;
    case 'noearly': S.noEarly = mondayOf(todayIso()); save(); renderBanner(); break;
    case 'addset': addSet(id); break;
    case 'delset': delSet(id, i); break;
    case 'skip': toggleSkip(id); if (V.sheet) exSheet(id); break;
    case 'mv': move(id, +b.dataset.d); exSheet(id); break;
    case 'exsheet': exSheet(id); break;
    case 'inc': {
      if (+b.dataset.v) S.inc[id] = +b.dataset.v; else delete S.inc[id];
      const D = S.draft;
      // Ziel dieser Übung mit dem neuen Schritt neu rechnen, solange noch kein Satz abgehakt ist
      if (D && D.ex[id] && !D.ex[id].sets.some(s => s.done)) D.ex[id] = buildEx(entryOf(D.day, id), D.deload);
      save(); exSheet(id); renderMain(); break;
    }
    case 'fin': V.fin = true; renderMain(); break;
    case 'finno': V.fin = false; renderMain(); break;
    case 'finyes': finish(); break;
    case 'reopen': reopen(b.dataset.sid); break;
    case 'settings': V.msg = ''; V.paste = false; setSheet(); break;
    case 'close': closeSheet(); break;
    case 'export': exportData(); break;
    case 'import': $('fileIn').value = ''; $('fileIn').click(); break;
    case 'paste': V.paste = !V.paste; V.msg = ''; setSheet(); if (V.paste) setTimeout(() => $('pasteTxt') && $('pasteTxt').focus(), 50); break;
    case 'pastego': showImport(importText($('pasteTxt').value)); break;
    case 'theme': S.theme = b.dataset.v; applyTheme(); save(); setSheet(); break;
    case 'update': flush(); if (V.update) V.update.postMessage('skip'); break;
  }
}

// Plus/Minus: zählt beim Loslassen, gedrückt halten zählt schnell weiter. Wer wischt, scrollt nur.
function stepOnce(b) {
  const D = S.draft;
  if (!D) return;
  const id = b.dataset.id, i = +b.dataset.i, a = b.dataset.step, x = D.ex[id], s = x && x.sets[i];
  if (!s) return;
  if (a[0] === 'w') {
    const inc = incOf(id), up = a === 'w+';
    const base = s.w == null ? 20 + (up ? -inc : inc) : s.w;
    setW(id, i, Math.max(0, r2(base + (up ? inc : -inc))));
  } else setR(id, i, Math.max(0, s.r + (a === 'r+' ? 1 : -1)));
  paintEx(id);
  saveSoon();
}
function endHold() { if (hold) clearTimeout(hold.t); hold = null; }
document.addEventListener('pointerdown', ev => {
  const b = ev.target.closest && ev.target.closest('[data-step]');
  if (!b || ev.button > 0) return;
  ev.preventDefault();
  endHold();
  const h = hold = { b, x: ev.clientX, y: ev.clientY, n: 0, moved: false, pid: ev.pointerId };
  const rep = () => { if (hold !== h) return; stepOnce(b); h.n++; h.t = setTimeout(rep, h.n > 8 ? 60 : 110); };
  h.t = setTimeout(rep, 450);
});
document.addEventListener('pointermove', ev => {
  if (hold && ev.pointerId === hold.pid && Math.hypot(ev.clientX - hold.x, ev.clientY - hold.y) > 12) { hold.moved = true; clearTimeout(hold.t); }
});
document.addEventListener('pointerup', ev => {
  if (!hold || ev.pointerId !== hold.pid) return;
  const h = hold;
  endHold();
  if (!h.moved && h.n === 0) stepOnce(h.b);
});
document.addEventListener('pointercancel', endHold);

document.addEventListener('click', ev => {
  const t = ev.target.closest && ev.target.closest('[data-tact],[data-step],[data-act]');
  if (!t) return;
  if (t.dataset.tact) { tact(t.dataset.tact); return; }
  if (t.dataset.step) { if (ev.detail === 0) stepOnce(t); return; } // Tastatur; Finger laufen über pointerup
  act(t.dataset.act, t);
});
document.addEventListener('input', ev => {
  const el = ev.target, k = el.dataset && el.dataset.inp;
  if (!k || !S.draft) return;
  const id = el.dataset.id, i = +el.dataset.i;
  if (k === 'w') {
    const v = parseFloat(el.value.replace(',', '.'));
    if (isFinite(v) && v >= 0 && v < 1000) { setW(id, i, r2(v)); paintEx(id); saveSoon(); }
  } else {
    const v = parseInt(el.value, 10);
    if (isFinite(v) && v >= 0 && v < 200) { setR(id, i, v); paintEx(id); saveSoon(); }
  }
});
document.addEventListener('focusout', ev => {
  const el = ev.target;
  if (el.dataset && el.dataset.inp && S.draft) setTimeout(() => paintEx(el.dataset.id), 0);
});
document.addEventListener('keydown', ev => {
  if (ev.key === 'Enter' && ev.target.dataset && ev.target.dataset.inp) ev.target.blur();
  if (ev.key === 'Escape' && !$('sheet').hidden) closeSheet();
});
$('fileIn').addEventListener('change', ev => {
  const f = ev.target.files && ev.target.files[0];
  if (!f) return;
  f.text().then(t => showImport(importText(t))).catch(() => showImport([false, 'Die Datei ließ sich nicht lesen.']));
});
document.addEventListener('visibilitychange', () => {
  if (!S) return;
  if (document.visibilityState === 'hidden') { flush(); return; }
  if (todayIso() !== V.day0) { // neuer Tag, während die App offen war
    V.day0 = V.sel = todayIso(); V.summary = null; V.edit = null;
    settleOldDraft(); rollBlock(); save(); render();
  } else if (S.draft && S.draft.rest) tick();
  if (hasDone(S.draft)) keepAwake();
});
window.addEventListener('pagehide', () => { if (S) flush(); });

/* ---------- Offline und Updates ---------- */

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  const hadCtl = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').then(reg => {
    const found = w => { V.update = w; renderBanner(); };
    const watch = w => { if (w) w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) found(w); }); };
    if (reg.waiting && hadCtl) found(reg.waiting);
    watch(reg.installing); // Update lief schon beim Laden der Seite an
    reg.addEventListener('updatefound', () => watch(reg.installing));
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch(() => {});
  let done = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!hadCtl || done) return; done = true; location.reload(); });
}

(async function boot() {
  S = await loadState();
  settleOldDraft();
  rollBlock();
  if (S.draft && !S.draft.touched) S.draft = null; // unberührtes Training frisch berechnen
  applyTheme();
  save();
  render();
  registerSW();
  try { if (navigator.storage && navigator.storage.persist) V.persist = await navigator.storage.persist(); } catch (e) {}
})();
