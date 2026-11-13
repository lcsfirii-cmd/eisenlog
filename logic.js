'use strict';
/* Eisenlog – Trainingsplan und Rechenlogik.
   Hier steht nur Rechnung, keine Oberfläche. Alle Gewichte in kg.
   Die App braucht keine Bewertungen: Sie liest nur, ob die Ziele geschafft wurden. */

const DAY_KEYS = ['obA', 'beinA', 'arme', 'beinB', 'obB'];
// Wochentag (0 = Sonntag) → Einheit. Mo und Mi frei.
const WEEK0 = { 2: 'obA', 4: 'beinA', 5: 'arme', 6: 'beinB', 0: 'obB' };
const STEPS = [0.625, 1.25, 2, 2.5, 5, 10];

// Muskeln: Name, harte Sätze pro Woche [von, bis]. Hauptmuskel zählt 1 Satz, Nebenmuskel 0,5.
// Seitliche Schulter oben gedeckelt, weil Lucas nebenbei noch Aufrechtes Rudern macht.
const MUSCLES = {
  side: ['Seitliche Schulter', 14, 18], rear: ['Hintere Schulter', 12, 20], chest: ['Brust', 14, 22],
  back: ['Rücken', 14, 22], quads: ['Quads', 10, 16], hams: ['Beinbeuger', 10, 16], bi: ['Bizeps', 8, 14],
  tri: ['Trizeps', 8, 14], calves: ['Waden', 6, 12], low: ['Unterer Rücken', 3, 8], add: ['Adduktoren', 2, 6], abs: ['Bauch', 6, 10],
};
const MUSCLE_PRIO = ['side', 'rear', 'chest', 'back', 'quads', 'hams', 'bi', 'tri', 'calves', 'low', 'add', 'abs'];

// Übungskatalog: n = Name, g = Gruppe zum Tauschen, m = Hauptmuskel, m2 = Nebenmuskeln, inc = Standard-Schritt
const EX = {
  sh_kabel: { n: 'Kabel-Seitheben', g: 'seitl', m: 'side', inc: 0.625 },
  sm_masch: { n: 'Seitheben-Maschine', g: 'seitl', m: 'side' },
  sh_kh: { n: 'Kurzhantel-Seitheben', g: 'seitl', m: 'side', inc: 2.5 },
  y_raise: { n: 'Y-Raises am Kabel', g: 'seitl', m: 'side', m2: ['rear'], inc: 0.625 },
  sh_kabel2: { n: 'Kabel-Seitheben, 2. Runde', g: 'seitl', m: 'side', inc: 0.625 },
  rev_bf: { n: 'Reverse Butterfly', g: 'hinten', m: 'rear' },
  rev_kabel: { n: 'Reverse Flys am Kabel', g: 'hinten', m: 'rear', inc: 0.625 },
  rev_kh: { n: 'Vorgebeugte KH-Reverse-Flys', g: 'hinten', m: 'rear', inc: 2.5 },
  hs_incl: { n: 'Iso-Lateral Incline (Hammer Strength)', g: 'brust_dr', m: 'chest', m2: ['tri'] },
  hs_incl2: { n: 'Iso-Lateral Incline (Hammer Strength)', g: 'brust_dr', m: 'chest', m2: ['tri'] },
  hs_bench: { n: 'Iso-Lateral Bench (Hammer Strength)', g: 'brust_dr', m: 'chest', m2: ['tri'] },
  hs_bench2: { n: 'Iso-Lateral Bench (Hammer Strength)', g: 'brust_dr', m: 'chest', m2: ['tri'] },
  mp_incl: { n: 'Schrägbankdrücken Multipresse', g: 'brust_dr', m: 'chest', m2: ['tri'] },
  mp_incl2: { n: 'Schrägbankdrücken Multipresse', g: 'brust_dr', m: 'chest', m2: ['tri'] },
  kh_schraeg: { n: 'KH-Schrägbankdrücken', g: 'brust_dr', m: 'chest', m2: ['tri'], inc: 2.5 },
  kabel_fly: { n: 'Kabel-Flys', g: 'brust_iso', m: 'chest' },
  butterfly: { n: 'Butterfly-Maschine', g: 'brust_iso', m: 'chest' },
  sd_masch: { n: 'Schulterdrücken (Hammer Strength)', g: 'schulterdr', m: 'front', m2: ['tri'] },
  sd_kh: { n: 'Schulterdrücken Kurzhanteln', g: 'schulterdr', m: 'front', m2: ['tri'], inc: 2.5 },
  mp_sd: { n: 'Schulterdrücken Multipresse', g: 'schulterdr', m: 'front', m2: ['tri', 'side'] },
  lat_einarm: { n: 'Latzug einarmig am Kabel', g: 'lat', m: 'back', m2: ['bi'] },
  lat_breit: { n: 'Latzug breit', g: 'lat', m: 'back', m2: ['bi'] },
  lat_eng: { n: 'Latzug eng (V-Griff)', g: 'lat', m: 'back', m2: ['bi'] },
  pullover: { n: 'Pullover am Kabel', g: 'lat', m: 'back' },
  tbar: { n: 'T-Bar-Rudern eng', g: 'rudern', m: 'back', m2: ['bi', 'rear'] },
  row_kabel: { n: 'Kabelrudern eng', g: 'rudern', m: 'back', m2: ['bi', 'rear'] },
  row_breit: { n: 'Kabelrudern breit', g: 'rudern', m: 'back', m2: ['rear', 'bi'] },
  rstr: { n: 'Rückenstrecker-Maschine', g: 'unt_ruecken', m: 'low' },
  pend_do: { n: 'Pendulum / V-Squat', g: 'quads_dr', m: 'quads' },
  pend_so: { n: 'Pendulum / V-Squat', g: 'quads_dr', m: 'quads' },
  presse: { n: 'Beinpresse', g: 'quads_dr', m: 'quads', inc: 5 },
  presse_tief: { n: 'Beinpresse, Füße tief', g: 'quads_dr', m: 'quads', inc: 5 },
  presse_so: { n: 'Beinpresse, Füße hoch', g: 'quads_dr', m: 'quads', m2: ['hams'], inc: 5 },
  strecker: { n: 'Beinstrecker', g: 'quads_iso', m: 'quads' },
  bb_sitz: { n: 'Beinbeuger sitzend', g: 'hams', m: 'hams' },
  bb_lieg: { n: 'Beinbeuger liegend', g: 'hams', m: 'hams' },
  rdl: { n: 'Rumänisches Kreuzheben mit Kurzhanteln', g: 'hams', m: 'hams', m2: ['low'], inc: 2.5 },
  adduktoren: { n: 'Adduktoren-Maschine', g: 'add', m: 'add' },
  waden_steh: { n: 'Wadenheben stehend', g: 'waden', m: 'calves' },
  waden: { n: 'Wadenheben sitzend', g: 'waden', m: 'calves' },
  curl_schraeg: { n: 'Schrägbank-Curls Kurzhanteln', g: 'bizeps', m: 'bi', inc: 2.5 },
  scott: { n: 'Scott-Curls Maschine', g: 'bizeps', m: 'bi' },
  curl_kabel: { n: 'Kabel-Curls', g: 'bizeps', m: 'bi' },
  hammer: { n: 'Hammercurls', g: 'bizeps', m: 'bi', inc: 2.5 },
  sz_reverse: { n: 'SZ-Curls im Obergriff', g: 'bizeps', m: 'bi' },
  crunch: { n: 'Crunch-Maschine', g: 'bauch', m: 'abs' },
  beinheben: { n: 'Beinheben', g: 'bauch', m: 'abs', inc: 2.5, bw: true },
  tri_oh: { n: 'Trizeps über Kopf am Kabel', g: 'trizeps', m: 'tri' },
  tri_seil: { n: 'Trizeps-Pushdown mit Seil', g: 'trizeps', m: 'tri' },
  tri_stange: { n: 'Trizeps-Pushdown mit Stange', g: 'trizeps', m: 'tri' },
  tri_einarm: { n: 'Trizeps einarmig mit Schlaufe', g: 'trizeps', m: 'tri' },
  tri_sz: { n: 'Trizeps-Drücken SZ-Stange am Kabel', g: 'trizeps', m: 'tri' },
};

// Bei jeder Änderung am Startplan hochzählen, dann übernimmt die App den neuen Plan beim Start
const PLAN_V = 9;
// Rolle: main = schwere Hauptübung (1–2 im Tank), comp = Grundübung (1–2 im Tank), iso = bis zum Versagen
const REST = { main: 180, comp: 120, iso: 90 };
const KNEE = 'Nur so tief, wie das Knie es mag';
// Block 1 ab November 2026: [id, Sätze, Wdh. von, bis, Rolle, Lengthened Partials im letzten Satz, Hinweis]
const PLAN_RAW = {
  obA: ['Oberkörper A', 'Schrägbank-Fokus: Brust, Rücken, Seitheben, Arme', [
    ['sh_kabel', 3, 10, 15, 'iso', 1, ''],
    ['hs_incl', 3, 5, 8, 'main', 0, 'Gewicht pro Seite'],
    ['tbar', 3, 5, 8, 'main', 0, 'Enger Griff'],
    ['hs_bench2', 3, 6, 10, 'comp', 0, 'Gewicht pro Seite'],
    ['lat_breit', 3, 6, 10, 'comp', 0, ''],
    ['kabel_fly', 2, 10, 15, 'iso', 1, ''],
    ['curl_schraeg', 2, 8, 12, 'iso', 1, 'Gewicht pro Hantel'],
    ['tri_einarm', 2, 10, 15, 'iso', 0, '']]],
  beinA: ['Beine A', 'Quads, Beinbeuger, Waden, unterer Rücken', [
    ['pend_do', 3, 5, 8, 'main', 0, KNEE],
    ['bb_sitz', 3, 10, 15, 'iso', 1, ''],
    ['presse_tief', 3, 8, 12, 'comp', 0, 'Füße tief und eng'],
    ['strecker', 3, 10, 15, 'iso', 1, ''],
    ['waden_steh', 3, 10, 15, 'iso', 1, 'Beine gestreckt, unten 2 s halten'],
    ['rstr', 2, 10, 15, 'iso', 0, ''],
    ['crunch', 3, 10, 15, 'iso', 0, 'Letzter Satz: Dropsatz erlaubt, nur den ersten Teil eintragen']]],
  arme: ['Schultern + Arme', 'Seitliche und hintere Schulter, Bizeps, Trizeps', [
    ['sm_masch', 4, 10, 15, 'iso', 1, ''],
    ['mp_sd', 3, 6, 10, 'comp', 0, 'Gewicht pro Seite, ohne Stange'],
    ['sh_kabel', 3, 10, 15, 'iso', 1, ''],
    ['rev_kabel', 3, 10, 15, 'iso', 0, ''],
    ['rev_kh', 2, 10, 15, 'iso', 0, 'Gewicht pro Hantel'],
    ['scott', 3, 8, 12, 'iso', 1, ''],
    ['tri_oh', 3, 10, 15, 'iso', 1, ''],
    ['sz_reverse', 2, 10, 15, 'iso', 0, 'Obergriff'],
    ['tri_sz', 2, 10, 15, 'iso', 0, '']]],
  beinB: ['Beine B', 'Beinbeuger, Quads, Waden, Adduktoren', [
    ['pend_so', 3, 8, 12, 'comp', 0, KNEE],
    ['rdl', 3, 6, 10, 'main', 0, 'Gewicht pro Hantel, Zughilfen'],
    ['bb_sitz', 4, 10, 15, 'iso', 1, ''],
    ['strecker', 2, 10, 15, 'iso', 1, ''],
    ['waden', 3, 10, 15, 'iso', 1, 'Beine angewinkelt, unten 2 s halten'],
    ['adduktoren', 2, 10, 15, 'iso', 0, ''],
    ['beinheben', 3, 10, 15, 'iso', 0, 'Becken einrollen, nicht schwingen. 0 kg = ohne Gewicht']]],
  obB: ['Oberkörper B', 'Flach-Fokus: Brust, Rücken, Seitheben, hintere Schulter', [
    ['sm_masch', 3, 10, 15, 'iso', 1, ''],
    ['hs_bench', 3, 5, 8, 'main', 0, 'Gewicht pro Seite'],
    ['row_breit', 4, 6, 10, 'comp', 0, 'Breiter Griff, Zughilfen'],
    ['hs_incl2', 3, 6, 10, 'comp', 0, 'Gewicht pro Seite'],
    ['lat_einarm', 4, 8, 12, 'comp', 0, 'Ellbogen Richtung Hüfte'],
    ['kabel_fly', 2, 10, 15, 'iso', 1, ''],
    ['rev_kabel', 2, 10, 15, 'iso', 0, '']]],
};

function makePlan() {
  const p = {};
  for (const k of DAY_KEYS) {
    const [n, f, x] = PLAN_RAW[k];
    p[k] = { n, f, x: x.map(([id, s, lo, hi, role, lp, h]) => ({ id, s, lo, hi, role, rest: REST[role], lp: !!lp, h })) };
  }
  return p;
}

/* ---------- Grundgrößen ---------- */

const r2 = x => Math.round(x * 100) / 100;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const midOf = e => Math.round((e.lo + e.hi) / 2);
const median = a => { if (!a.length) return 0; const b = a.slice().sort((x, y) => x - y), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };

// Reserve-Wiederholungen. Alte Einträge haben noch Bewertungen (1 Leicht, 3 Am Limit), neue nicht.
function rir(f) { return f === 1 ? 4 : f === 3 ? 0 : 2; }
// Satzstärke
function e1(w, r, f) { return w * (1 + (r + rir(f)) / 30); }
function roundW(w, inc) { return r2(Math.max(inc, Math.round(w / inc) * inc)); }
// Auf das Raster des Geräts runden, ausgehend von einem echten Gewicht (z. B. 49,5 + 2,5er-Schritte)
function roundRel(w, base, inc) { return r2(Math.max(inc, base + Math.round((w - base) / inc) * inc)); }
// Wiederholungen, die bei Stärke E mit Gewicht w gehen
function repsFor(E, w) { return Math.max(1, Math.round(30 * (E / w - 1)) - 2); }

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
// E nach jeder Einheit, älteste zuerst (für das Diagramm und die Stagnation)
function eSeries(h, id) {
  const asc = h.slice().reverse(), out = [];
  for (let k = 0; k < asc.length; k++) out.push({ s: asc[k], v: workE(asc.slice(Math.max(0, k - 2), k + 1).reverse(), id) });
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

/* ---------- Wie lief eine Einheit? ---------- */

// Ziel eines gespeicherten Satzes: das geplante (pw/pr), bei alten Einträgen das Ziel beim Abhaken
const tgtW = x => x.pw !== undefined ? x.pw : x.tw;
const tgtR = x => x.pr !== undefined ? x.pr : x.tr;
// hit = alle Ziele geschafft, miss = ein Ziel verfehlt, bad = selbst leichter genommen (schlechter Tag),
// first = erstes Mal, noch ohne Gewichtsziel. Entscheidend ist der erste Satz, der vom Ziel abweicht.
function sessStatus(sets) {
  if (sets.every(x => tgtW(x) == null)) return 'first';
  const order = sets.slice().sort((a, b) => (a.t || 0) - (b.t || 0));
  for (const x of order) {
    const w = tgtW(x), r = tgtR(x);
    if (w != null && x.w < w * 0.97 - 0.01) { // leichter als geplant: schlechter Tag, außer die Leistung war gleich gut
      if (r == null || x.w * (1 + x.r / 30) < w * (1 + r / 30) * 0.98) return 'bad';
      continue;
    }
    if (r != null && x.r < r) return 'miss';
  }
  return 'hit';
}
// Wiederholungen eines Satzes, umgerechnet auf ein anderes Gewicht (gleiche Satzstärke)
function repsAt(x, w) { return x.w === w ? x.r : Math.max(0, Math.round(30 * (e1(x.w, x.r, x.f) / w - 1)) - rir(x.f)); }

/* ---------- Ziel für die nächste Einheit ----------
   Doppelte Progression: erst die Wiederholungen durch die Spanne, dann Gewicht + 1 Schritt, Wdh. wieder unten.
   Geschafft → +1 Wdh. (ab dem 2. Erfolg in Folge +2). Verfehlt → gleiches Ziel noch mal.
   Zweimal hintereinander verfehlt → 1 Schritt leichter. Schlechter Tag zählt nicht. */

// e = Planeintrag, h = Verlauf (neueste zuerst, ohne Entlastung), inc = Schritt,
// o.days = Tage seit der letzten Einheit, o.reset = Stagnation Stufe 1
function nextPlan(e, h, inc, o = {}) {
  const n = e.s, cl = r => clamp(r, e.lo, e.hi), fill = r => Array(n).fill(r);
  if (!h.length) return { w: o.bw ? 0 : null, reps: fill(midOf(e)), tag: 'new' };
  const last = h[0].ex[e.id], w = workWeight(last), at = (a, i) => a[Math.min(i, a.length - 1)];
  // Geschaffte Wdh. mit dem Arbeitsgewicht (ein leichterer Einstiegssatz zählt nicht mit)
  const atW = last.filter(x => Math.abs(x.w - w) < 0.01), got = (atW.length ? atW : last).map(x => repsAt(x, w));
  // Längere Pause
  if (o.days > 28) return { w: roundRel(w * 0.8, w, inc), reps: fill(cl(e.lo + 2)), tag: 'pause', d: o.days };
  if (o.days > 14) return { w: roundRel(w * 0.9, w, inc), reps: Array.from({ length: n }, (_, i) => cl(at(got, i))), tag: 'pause', d: o.days };
  // Hängt die Übung: einmal 10 % leichter, dafür volle Spanne
  if (o.reset) return { w: roundRel(w * 0.9, w, inc), reps: fill(e.hi), tag: 'reset' };
  const st = sessStatus(last);
  const planW = workWeight(last.map(x => ({ w: tgtW(x) != null ? tgtW(x) : x.w })));
  const planR = i => cl(tgtR(at(last, i)) != null ? tgtR(at(last, i)) : at(got, i));
  if (st === 'bad') return { w: planW, reps: Array.from({ length: n }, (_, i) => planR(i)), tag: 'again' };
  if (last.length >= Math.min(n, 2) && got.every(r => r >= e.hi)) return { w: r2(w + inc), reps: fill(e.lo), tag: 'up', d: inc };
  if (st === 'miss') {
    // Zweimal verfehlt und dabei nicht besser geworden → leichter. Wer trotzdem zulegt, bekommt das Ziel noch mal.
    const prev = h.slice(1).find(s => sessStatus(s.ex[e.id]) !== 'bad');
    const sum = l => l.filter(x => Math.abs(x.w - w) < 0.01).reduce((a, x) => a + x.r, 0);
    if (prev && sessStatus(prev.ex[e.id]) === 'miss' && Math.abs(workWeight(prev.ex[e.id]) - w) < 0.01 && sum(last) <= sum(prev.ex[e.id]) && w - inc > 0)
      return { w: r2(w - inc), reps: fill(Math.min(e.hi, e.lo + 2)), tag: 'down', d: inc };
    return { w: Math.max(w, planW), reps: Array.from({ length: n }, (_, i) => cl(Math.min(planR(i), at(got, i) + 1))), tag: 'hold' };
  }
  // Geschafft: +1 Wdh. pro Satz
  return { w, reps: Array.from({ length: n }, (_, i) => cl(at(got, i) + 1)), tag: 'more', d: 1 };
}

/* ---------- Während des Trainings ---------- */

// Nach einem abgehakten Satz i: Hat er das Ziel verfehlt, die offenen Sätze anpassen.
// Knapp verfehlt → gleiches Gewicht, Ziel = geschaffte Wdh. Deutlich verfehlt (3+) → leichter, Ziel bleibt.
function adjustAfter(e, x, i, inc) {
  const d = x.sets[i];
  if (!d || !d.done || !(d.w > 0)) return;
  const tr = d.tr == null ? d.r : d.tr, miss = tr - d.r;
  if (miss <= 0) return;
  const E0 = d.w * (1 + d.r / 30); // verfehlt = am Limit
  for (const s of x.sets) {
    if (s.done || s.man) continue;
    if (miss < 3) { s.w = s.tw = d.w; s.r = s.tr = Math.max(1, d.r); }
    else {
      const r = clamp(s.tr == null ? s.r : s.tr, e.lo, e.hi);
      s.w = s.tw = Math.min(d.w, roundRel(E0 / (1 + r / 30), d.w, inc));
      s.r = s.tr = r;
    }
    s.E = e1(s.w, s.r);
    delete s.warn;
  }
}

/* ---------- Gelernt aus den Daten ---------- */

// Gewichtsschritt eines Geräts: der kleinste Sprung (bis 5 kg), den Lucas mindestens zweimal gemacht hat
function learnedStep(sessions, id) {
  const ws = [];
  for (const s of sessions.slice().sort((a, b) => sessTime(a) - sessTime(b))) if (s.ex[id]) for (const x of s.ex[id]) ws.push(x.w);
  const cnt = new Map();
  for (let i = 1; i < ws.length; i++) {
    if (i > 1 && ws[i] === ws[i - 2]) continue; // hin und gleich wieder zurück (Vertipper) zählt nicht
    const d = r2(Math.abs(ws[i] - ws[i - 1]));
    if (d >= 0.5 && d <= 5) cnt.set(d, (cnt.get(d) || 0) + 1);
  }
  const ok = [...cnt].filter(([, c]) => c >= 2).map(([d]) => d);
  return ok.length ? Math.min(...ok) : 0;
}

// Echtes Tempo: Minuten zwischen zwei Sätzen derselben Übung und beim Wechsel der Übung
function paceOf(sessions) {
  const inEx = [], between = [];
  for (const s of sessions.slice().sort((a, b) => sessTime(b) - sessTime(a)).slice(0, 12)) {
    const l = [];
    for (const id in s.ex) for (const x of s.ex[id]) if (x.t) l.push([x.t, id]);
    l.sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < l.length; i++) {
      const g = (l[i][0] - l[i - 1][0]) / 60000;
      if (g < 0.4 || g > 15) continue; // nachträglich abgehakt oder lange Unterbrechung
      (l[i][1] === l[i - 1][1] ? inEx : between).push(g);
    }
  }
  return { set: median(inEx) || 3, change: median(between) || 6 };
}
function estMinutes(sets, exercises, pace) {
  if (!sets) return 0;
  return Math.round(1 + (sets - exercises) * pace.set + Math.max(0, exercises - 1) * pace.change);
}

// Hängt eine Übung? E in den letzten 4 Einheiten nie mehr als 1 % über dem besten E davor
function stalled(h, id) {
  const ser = eSeries(h, id).map(p => p.v);
  if (ser.length < 5) return false;
  const best = Math.max(...ser.slice(0, -4));
  return ser.slice(-4).every(v => v <= best * 1.01);
}

// Harte Sätze pro Muskel und Woche im Plan
function muscleSets(plan) {
  const m = {};
  for (const k of DAY_KEYS) for (const e of plan[k].x) {
    const x = EX[e.id];
    if (!x) continue;
    m[x.m] = (m[x.m] || 0) + e.s;
    for (const o of x.m2 || []) m[o] = (m[o] || 0) + e.s * 0.5;
  }
  return m;
}

// Körpergewicht: Trend in kg pro Woche aus den letzten 5 Wochen (mind. 3 Einträge über 2 Wochen)
function bwTrend(list, today) {
  const t0 = Date.parse(today + 'T12:00:00');
  const pts = list.map(p => [(Date.parse(p.d + 'T12:00:00') - t0) / 6048e5, p.kg]).filter(p => p[0] > -5);
  if (pts.length < 3 || Math.max(...pts.map(p => p[0])) - Math.min(...pts.map(p => p[0])) < 2) return null;
  const mx = pts.reduce((a, p) => a + p[0], 0) / pts.length, my = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  const num = pts.reduce((a, p) => a + (p[0] - mx) * (p[1] - my), 0), den = pts.reduce((a, p) => a + (p[0] - mx) ** 2, 0);
  return den ? num / den : null;
}
