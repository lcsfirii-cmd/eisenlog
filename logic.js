'use strict';
/* Eisenlog – Trainingsplan und Rechenlogik.
   Hier steht nur Rechnung, keine Oberfläche. Alle Gewichte in kg. */

const DAY_KEYS = ['ober', 'unter', 'push', 'pull', 'beine'];
// Wochentag (0 = Sonntag) → Einheit. Mo und Mi frei.
const WEEK0 = { 2: 'ober', 4: 'unter', 5: 'push', 6: 'pull', 0: 'beine' };

// Gerätearten. scheibe = Gesamtgewicht beider Seiten, lh = 20-kg-Stange plus Scheiben.
const EQ = { scheibe: 'Scheiben', lh: 'Langhantel', stack: 'Steckgewicht', kh: 'Kurzhanteln' };
const STEPS = [1.25, 2.5, 5, 10];

// Übungskatalog: id → [Name, Geräteart]
const EX = {
  sm_masch: ['Seitheben-Maschine', 'stack'],
  hs_incl: ['Iso-Lateral Incline (Hammer Strength)', 'scheibe'],
  row_kabel: ['Kabelrudern eng', 'stack'],
  sd_masch: ['Schulterdrücken (Hammer Strength)', 'scheibe'],
  lat_einarm: ['Latzug einarmig am Kabel', 'stack'],
  rev_kabel: ['Reverse Flys am Kabel', 'stack'],
  curl_kabel: ['Kabel-Curls', 'stack'],
  tri_seil: ['Trizeps-Pushdown mit Seil', 'stack'],
  pend_do: ['Pendulum / V-Squat', 'scheibe'],
  presse: ['Beinpresse', 'stack'],
  strecker: ['Beinstrecker', 'stack'],
  bb_sitz: ['Beinbeuger sitzend', 'stack'],
  waden: ['Wadenheben sitzend', 'stack'],
  rstr: ['Rückenstrecker-Maschine', 'stack'],
  hs_bench: ['Iso-Lateral Bench (Hammer Strength)', 'scheibe'],
  sh_kabel: ['Kabel-Seitheben', 'stack'],
  sd_kh: ['Schulterdrücken Kurzhanteln', 'kh'],
  butterfly: ['Butterfly-Maschine', 'stack'],
  sh_kabel2: ['Kabel-Seitheben, 2. Runde', 'stack'],
  tri_oh: ['Trizeps über Kopf am Kabel', 'stack'],
  tri_stange: ['Trizeps-Pushdown mit Stange', 'stack'],
  tbar: ['T-Bar-Rudern brustgestützt', 'scheibe'],
  lat_breit: ['Latzug breit', 'stack'],
  lat_eng: ['Latzug eng (V-Griff)', 'stack'],
  rev_bf: ['Reverse Butterfly', 'stack'],
  scott: ['Scott-Curls Maschine', 'stack'],
  curl_schraeg: ['Schrägbank-Curls Kurzhanteln', 'kh'],
  rdl: ['Rumänisches Kreuzheben mit Kurzhanteln', 'kh'],
  presse_so: ['Beinpresse, Füße hoch', 'stack'],
  pend_so: ['Pendulum / V-Squat', 'scheibe'],
  adduktoren: ['Adduktoren-Maschine', 'stack'],
};

// Bei jeder Änderung am Startplan hochzählen, dann übernimmt die App den neuen Plan beim Start
const PLAN_V = 2;
const KNEE ='Nur so tief, wie das Knie es mag';
// Startplan Block 1: [id, Sätze, Wdh. von, Wdh. bis, Pause s, Hinweis]
const PLAN_RAW = {
  ober: ['Oberkörper', 'Schultern, Brust, Rücken, Arme', [
    ['sm_masch', 4, 12, 20, 75, 'Schultern zuerst'],
    ['hs_incl', 3, 6, 10, 150, ''],
    ['row_kabel', 3, 8, 12, 120, 'Zughilfen'],
    ['sd_masch', 2, 8, 12, 120, 'Gesamtgewicht beider Seiten'],
    ['lat_einarm', 2, 10, 15, 90, ''],
    ['rev_kabel', 3, 12, 20, 75, ''],
    ['curl_kabel', 2, 10, 15, 75, ''],
    ['tri_seil', 2, 10, 15, 75, '']]],
  unter: ['Unterkörper', 'Quads, Beinbeuger, Waden, unterer Rücken', [
    ['pend_do', 3, 6, 10, 150, KNEE],
    ['presse', 3, 10, 15, 120, 'Aus der Ferse, Füße breit'],
    ['strecker', 3, 12, 15, 75, 'Letzter Satz als Drop-Satz'],
    ['bb_sitz', 2, 10, 15, 75, ''],
    ['waden', 4, 12, 20, 60, ''],
    ['rstr', 3, 10, 15, 90, '']]],
  push: ['Push', 'Brust, Schultern, Trizeps', [
    ['hs_bench', 3, 6, 10, 150, ''],
    ['sh_kabel', 3, 12, 20, 75, 'Mit Handgelenkschlaufe'],
    ['sd_kh', 3, 8, 12, 120, ''],
    ['butterfly', 3, 10, 15, 75, ''],
    ['sh_kabel2', 3, 15, 20, 60, ''],
    ['tri_oh', 3, 10, 15, 75, ''],
    ['tri_stange', 2, 10, 15, 75, '']]],
  pull: ['Pull', 'Rücken, hintere Schulter, Bizeps', [
    ['tbar', 3, 6, 10, 150, ''],
    ['lat_breit', 3, 8, 12, 120, ''],
    ['lat_eng', 2, 10, 12, 90, ''],
    ['row_kabel', 2, 10, 12, 90, 'Zughilfen'],
    ['rev_bf', 4, 12, 20, 60, ''],
    ['rstr', 3, 10, 15, 90, ''],
    ['scott', 3, 8, 12, 75, ''],
    ['curl_schraeg', 2, 10, 12, 75, '']]],
  beine: ['Beine', 'Beinbeuger, Po, Adduktoren, Waden', [
    ['rdl', 3, 8, 12, 150, 'Gewicht pro Hantel, Zughilfen, Hüfte nach hinten'],
    ['bb_sitz', 4, 10, 15, 75, ''],
    ['presse_so', 3, 12, 15, 120, ''],
    ['pend_so', 2, 10, 12, 120, KNEE],
    ['adduktoren', 3, 12, 15, 60, ''],
    ['waden', 4, 12, 20, 60, '']]],
};

function makePlan() {
  const p = {};
  for (const k of DAY_KEYS) {
    const [n, f, x] = PLAN_RAW[k];
    p[k] = { n, f, x: x.map(([id, s, lo, hi, rest, h]) => ({ id, s, lo, hi, rest, h })) };
  }
  return p;
}

/* ---------- 1. Grundgrößen ---------- */

const r2 = x => Math.round(x * 100) / 100;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const midOf = e => Math.round((e.lo + e.hi) / 2);

// Bewertung → Wiederholungen im Tank: 1 Leicht = 4, 2 Passt = 2, 3 Am Limit = 0, keine = 2
function rir(f) { return f === 1 ? 4 : f === 3 ? 0 : 2; }
// Satzstärke
function e1(w, r, f) { return w * (1 + (r + rir(f)) / 30); }
function roundW(w, inc) { return r2(Math.max(inc, Math.round(w / inc) * inc)); }
// Wiederholungen, die bei Stärke E mit Gewicht w und 2 im Tank gehen
function repsFor(E, w) { return Math.max(1, Math.round(30 * (E / w - 1)) - 2); }
// Gewicht, mit dem bei Stärke E genau r Wiederholungen mit 2 im Tank gehen
function weightFor(E, r, inc) { return roundW(E / (1 + (r + 2) / 30), inc); }

// Einheitsstärke: höchste Satzstärke einer Übung in einer Einheit
function setsStrength(sets) {
  let m = 0;
  for (const x of sets) if (x.w > 0 && x.r > 0) m = Math.max(m, e1(x.w, x.r, x.f));
  return m;
}

const sessTime = s => s.end || Date.parse(s.date + 'T18:00:00') || 0;
// Verlauf einer Übung, neueste Einheit zuerst
function histOf(sessions, id) {
  return sessions.filter(s => s.ex && s.ex[id] && s.ex[id].length).sort((a, b) => sessTime(b) - sessTime(a));
}

// Arbeitsstärke E: gewichtetes Mittel der letzten 3 Einheitsstärken (50 / 30 / 20 %)
const EW = [0.5, 0.3, 0.2];
function workE(h, id) {
  let sum = 0, ws = 0;
  h.slice(0, 3).forEach((s, i) => {
    const v = setsStrength(s.ex[id]);
    if (v > 0) { sum += v * EW[i]; ws += EW[i]; }
  });
  return ws ? sum / ws : 0;
}

// E nach jeder Einheit, älteste zuerst (für das Diagramm)
function eSeries(h, id) {
  const asc = h.slice().reverse(), out = [];
  for (let k = 0; k < asc.length; k++) {
    const win = asc.slice(Math.max(0, k - 2), k + 1).reverse();
    out.push({ s: asc[k], v: workE(win, id) });
  }
  return out;
}

// Arbeitsgewicht einer Einheit: das häufigste Gewicht, bei Gleichstand das spätere
function workWeight(sets) {
  const c = new Map();
  let best = null, bc = 0;
  for (const x of sets) {
    const n = (c.get(x.w) || 0) + 1;
    c.set(x.w, n);
    if (n >= bc) { bc = n; best = x.w; }
  }
  return best;
}

/* ---------- 2. + 5. Ziel für die nächste Einheit (doppelte Progression) ---------- */

// e = Planeintrag {id,s,lo,hi}, h = Verlauf (neueste zuerst, ohne Entlastung), inc = Gewichtsschritt
function nextPlan(e, h, inc) {
  const mid = midOf(e), cl = r => clamp(r, e.lo, e.hi);
  if (!h.length) return { w: null, reps: Array(e.s).fill(mid), tag: 'new' };
  const w = workWeight(h[0].ex[e.id]), full = h[0].ex[e.id].length >= e.s;
  // Sätze mit anderem Gewicht auf das Arbeitsgewicht umrechnen (gleiche Satzstärke, gleiche Bewertung)
  const last = h[0].ex[e.id].map(x => x.w === w ? x : { ...x, w, r: Math.max(0, Math.round(30 * (e1(x.w, x.r, x.f) / w - 1)) - rir(x.f)) });
  const at = i => last[Math.min(i, last.length - 1)];
  if (full && last.every(x => x.r >= e.hi))
    return { w: r2(w + inc), reps: Array(e.s).fill(e.lo), tag: 'up', d: inc, why: 'top' };
  if (full && last.every(x => x.f === 1 && x.r >= e.lo))
    return { w: r2(w + inc), reps: Array.from({ length: e.s }, (_, i) => cl(at(i).r)), tag: 'up', d: inc, why: 'easy' };
  const under = s => s.ex[e.id].some(x => x.r < e.lo);
  if (h.length >= 2 && under(h[0]) && under(h[1]) && w - inc > 0)
    return { w: r2(w - inc), reps: Array(e.s).fill(Math.min(e.hi, e.lo + 2)), tag: 'down', d: inc };
  const reps = Array.from({ length: e.s }, (_, i) => { const x = at(i); return cl(x.r + (x.f === 1 ? 2 : x.f === 3 ? 0 : 1)); });
  return { w, reps, tag: 'same' };
}

/* ---------- 2. + 3. Während des Trainings ---------- */

// Nach einem abgehakten Satz i: offene Sätze derselben Übung anpassen.
// x = Übung im Training {first, sets}, keepMan = von Hand gesetzte offene Sätze nicht anfassen
function adjustAfter(e, x, i, inc, keepMan) {
  const d = x.sets[i];
  if (!d || !d.done || !(d.w > 0)) return;
  const open = x.sets.filter(s => !s.done && !(keepMan && s.man));
  if (!open.length) return;
  const f = d.f || 2, mid = midOf(e);
  const firstSet = x.first && x.sets.filter(s => s.done).length === 1;
  const viaE = firstSet || Math.abs(d.r - (d.tr == null ? d.r : d.tr)) >= 3;
  const E = e1(d.w, d.r, f);
  for (const s of open) {
    let w, r;
    if (viaE) {
      r = firstSet ? mid : clamp(s.pr == null ? mid : s.pr, e.lo, e.hi);
      w = weightFor(E, r, inc);
    } else if (f === 1) {
      w = r2(d.w + inc);
      r = clamp(s.pr == null ? d.r : s.pr, e.lo, e.hi);
    } else if (f === 3 && d.r < e.lo) {
      w = Math.max(inc, r2(d.w - inc));
      r = e.lo;
    } else {
      w = d.w;
      r = Math.max(1, d.r);
    }
    s.w = s.tw = w;
    s.r = s.tr = r;
    s.E = e1(w, r, 2); // Stärke, die dieses Ziel voraussetzt (für Punkt 4)
    delete s.man;
    delete s.warn;
  }
}

/* ---------- Scheiben pro Seite ---------- */

const PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
function platesFor(eq, w) {
  if (!(w > 0) || (eq !== 'scheibe' && eq !== 'lh')) return null;
  let side = (w - (eq === 'lh' ? 20 : 0)) / 2;
  if (side <= 0) return null;
  const out = [];
  for (const p of PLATES) while (side >= p - 1e-9) { out.push(p); side -= p; }
  return { plates: out, rest: r2(side) };
}
