/* Satzbuch – Kern: Daten, Speicher, Rechnungen, Bausteine der Oberfläche */
"use strict";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const ic = (n, cls = "") => `<svg class="${cls}"><use href="#i-${n}"/></svg>`;
const DAY = 864e5;
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)");

/* Zahlen und Daten auf Deutsch */
function fmt(n, d = 1) {
  if (n == null || !isFinite(n)) return "–";
  const r = Math.round(n * 10 ** d) / 10 ** d;
  return r.toLocaleString("de-DE", { maximumFractionDigits: d });
}
const fkg = n => fmt(n, 2);
function fbig(n) { return n >= 10000 ? fmt(n / 1000, 1) + " t" : fmt(n, 0) + " kg"; }
function pnum(v) { if (v == null) return null; const s = String(v).trim().replace(",", "."); if (s === "") return null; const n = parseFloat(s); return isFinite(n) ? n : null; }
function fsec(s) { s = Math.max(0, Math.round(s)); const m = Math.floor(s / 60), r = s % 60; return m + ":" + String(r).padStart(2, "0"); }
function fdur(ms) { const m = Math.round(ms / 6e4); if (m < 60) return m + " min"; return Math.floor(m / 60) + " h " + String(m % 60).padStart(2, "0") + " min"; }
const WT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const MON = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
function fdate(ts, opt = {}) { const d = new Date(ts); return d.toLocaleDateString("de-DE", { weekday: opt.wd ? "short" : undefined, day: "numeric", month: opt.long ? "long" : "short", year: opt.y ? "numeric" : undefined }); }
function dayKey(ts) { const d = new Date(ts); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function startOfDay(ts) { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); }
function startOfWeek(ts) { const d = new Date(startOfDay(ts)); const wd = (d.getDay() + 6) % 7; return d.getTime() - wd * DAY; }
function ago(ts) {
  const d = Math.round((startOfDay(Date.now()) - startOfDay(ts)) / DAY);
  if (d <= 0) return "heute"; if (d === 1) return "gestern"; if (d < 7) return "vor " + d + " Tagen";
  if (d < 14) return "vor 1 Woche"; if (d < 60) return "vor " + Math.floor(d / 7) + " Wochen";
  return fdate(ts, { y: true });
}

/* ---------- Zustand ---------- */
const DEFAULT_SETTINGS = {
  theme: "auto", wochenziel: 3, pause: 90, autoPause: true, ton: true, wach: true, formel: "epley", rir: false,
  stange: 20, scheiben: [25, 20, 15, 10, 5, 2.5, 1.25], ruhetage: 2, erinnerung: 4, kbPause: false, kbHealth: false,
  sortUeb: "zuletzt", letzteSicherung: 0, hinweiseWeg: {}
};
function emptyState() { return { app: "Satzbuch", v: 1, eigene: [], meta: {}, listen: [], routinen: [], trainings: [], koerper: [], ziele: [], aktiv: null, settings: { ...DEFAULT_SETTINGS } }; }
let S = emptyState();
let VER = 0;           // erhöht sich bei jeder Änderung an Trainings, für Zwischenspeicher
const IDB = { db: null };
function idbOpen() {
  return new Promise(res => {
    try {
      const rq = indexedDB.open("satzbuch", 1);
      rq.onupgradeneeded = () => rq.result.createObjectStore("kv");
      rq.onsuccess = () => { IDB.db = rq.result; res(true); };
      rq.onerror = () => res(false);
    } catch { res(false); }
  });
}
function idbGet(k) { return new Promise(res => { try { const r = IDB.db.transaction("kv").objectStore("kv").get(k); r.onsuccess = () => res(r.result); r.onerror = () => res(null); } catch { res(null); } }); }
function idbPut(k, v) { return new Promise(res => { try { const t = IDB.db.transaction("kv", "readwrite"); t.objectStore("kv").put(v, k); t.oncomplete = () => res(true); t.onerror = () => res(false); } catch { res(false); } }); }
async function loadState() {
  let raw = null;
  if (await idbOpen()) raw = await idbGet("state");
  if (!raw) { try { raw = JSON.parse(localStorage.getItem("satzbuch.state") || "null"); } catch {} }
  if (raw && raw.app === "Satzbuch") S = normalize(raw);
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch {}
}
function normalize(s) {
  const e = emptyState();
  const o = { ...e, ...s, settings: { ...DEFAULT_SETTINGS, ...(s.settings || {}) } };
  for (const k of ["eigene", "listen", "routinen", "trainings", "koerper", "ziele"]) if (!Array.isArray(o[k])) o[k] = [];
  if (!o.meta || typeof o.meta !== "object") o.meta = {};
  o.trainings.sort((a, b) => a.start - b.start);
  return o;
}
let saveT = 0;
function save(changedTrainings = false) {
  if (changedTrainings) VER++;
  clearTimeout(saveT);
  saveT = setTimeout(flush, 250);
}
async function flush() {
  clearTimeout(saveT);
  const ok = IDB.db ? await idbPut("state", S) : false;
  if (!ok) { try { localStorage.setItem("satzbuch.state", JSON.stringify(S)); } catch { toast("Speichern fehlgeschlagen. Bitte eine Sicherung anlegen."); } }
  try { localStorage.setItem("satzbuch.theme", JSON.stringify(S.settings.theme)); } catch {}
}
addEventListener("pagehide", flush);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });

/* ---------- Übungen ---------- */
const BUILTIN = new Map(window.SB_UEBUNGEN.map(e => [e.id, e]));
let exCache = null;
function allEx() {
  if (exCache) return exCache;
  const m = new Map();
  for (const b of window.SB_UEBUNGEN) m.set(b.id, { ...b, ...(S.meta[b.id] || {}) });
  for (const e of S.eigene) m.set(e.id, { ...e, ...(S.meta[e.id] || {}) });
  exCache = m; return m;
}
function EX(id) { return allEx().get(id) || { id, name: "Gelöschte Übung", muskel: "ganz", neben: [], geraet: "", typ: "kg", geloescht: true }; }
function exChanged() { exCache = null; }
function setMeta(id, patch) { S.meta[id] = { ...(S.meta[id] || {}), ...patch }; exChanged(); save(); }
const GRUPPE = id => window.SB_GRUPPEN[(window.SB_MUSKELN[id] || window.SB_MUSKELN.ganz).g];
const exColor = e => e.farbe || GRUPPE(e.muskel).c;
const muskelName = id => (window.SB_MUSKELN[id] || { n: id }).n;
function exIncrement(e) { if (e.schritt) return e.schritt; return { Kurzhantel: 2, Maschine: 5, Kabelzug: 2.5, Kettlebell: 4 }[e.geraet] || 2.5; }
function exPause(e) { return e.pause || S.settings.pause; }

/* ---------- Rechnungen ---------- */
const FORMELN = {
  epley: { n: "Epley", f: (w, r) => w * (1 + r / 30), inv: p => 30 * (1 / p - 1) },
  brzycki: { n: "Brzycki", f: (w, r) => r >= 37 ? w : w * 36 / (37 - r), inv: p => 37 - 36 * p },
  lombardi: { n: "Lombardi", f: (w, r) => w * Math.pow(r, 0.1), inv: p => Math.pow(1 / p, 10) },
  oconner: { n: "O’Conner", f: (w, r) => w * (1 + 0.025 * r), inv: p => (1 / p - 1) / 0.025 },
  wathan: { n: "Wathan", f: (w, r) => 100 * w / (48.8 + 53.8 * Math.exp(-0.075 * r)), inv: p => -Math.log((100 * p - 48.8) / 53.8) / 0.075 },
  mayhew: { n: "Mayhew", f: (w, r) => 100 * w / (52.2 + 41.9 * Math.exp(-0.055 * r)), inv: p => -Math.log((100 * p - 52.2) / 41.9) / 0.055 }
};
function e1rm(w, r) { if (!w || !r) return 0; if (r === 1) return w; return (FORMELN[S.settings.formel] || FORMELN.epley).f(w, r); }
const isWork = s => s.done && s.k !== "a";
function setVol(s, typ) { if (!isWork(s)) return 0; if (typ === "kg") return (s.w || 0) * (s.r || 0); return 0; }
function itemStats(it) {
  const e = EX(it.ex); const ws = it.sets.filter(isWork);
  const o = { sets: ws.length, vol: 0, reps: 0, maxW: 0, best1: 0, zeit: 0, dist: 0, bestSet: null };
  for (const s of ws) {
    o.vol += setVol(s, e.typ); o.reps += s.r || 0; o.zeit += s.t || 0; o.dist += s.d || 0;
    if ((s.w || 0) > o.maxW) o.maxW = s.w || 0;
    const v = e.typ === "kg" ? e1rm(s.w, s.r) : e.typ === "bw" ? (s.r || 0) + (s.w || 0) / 100 : e.typ === "zeit" ? s.t || 0 : s.d || 0;
    if (v > o.best1) { o.best1 = v; o.bestSet = s; }
  }
  if (e.typ !== "kg") o.best1 = e.typ === "kg" ? o.best1 : o.best1;
  return o;
}
function workoutStats(w) {
  let vol = 0, sets = 0, reps = 0, prs = 0;
  for (const it of w.items) { const st = itemStats(it); vol += st.vol; sets += st.sets; reps += st.reps; prs += it.sets.filter(s => s.done && s.pr && s.pr.length).length; }
  return { vol, sets, reps, prs, dauer: (w.end || Date.now()) - w.start };
}
function setText(s, typ) {
  if (!s) return "";
  if (typ === "kg") return (s.w != null ? fkg(s.w) : "–") + " × " + (s.r ?? "–");
  if (typ === "bw") return (s.w ? "+" + fkg(s.w) + " × " : "") + (s.r ?? "–") + " Wdh.";
  if (typ === "zeit") return fsec(s.t || 0) + (s.w ? " · " + fkg(s.w) + " kg" : "");
  return fmt(s.d || 0, 2) + " km · " + fsec(s.t || 0);
}
function setShort(s, typ) {
  if (!s) return "";
  if (typ === "kg") return (s.w != null ? fkg(s.w) : "–") + "×" + (s.r ?? "–");
  if (typ === "bw") return (s.w ? "+" + fkg(s.w) + "×" : "") + (s.r ?? "–");
  if (typ === "zeit") return fsec(s.t || 0);
  return fmt(s.d || 0, 1) + " km";
}

/* Verlauf je Übung (neueste zuerst), zwischengespeichert */
let histCache = { ver: -1, map: null };
function histIndex() {
  if (histCache.ver === VER && histCache.map) return histCache.map;
  const m = new Map();
  for (let i = S.trainings.length - 1; i >= 0; i--) {
    const w = S.trainings[i];
    for (const it of w.items) { if (!it.sets.some(s => s.done)) continue; if (!m.has(it.ex)) m.set(it.ex, []); m.get(it.ex).push({ w, it }); }
  }
  histCache = { ver: VER, map: m }; return m;
}
function hist(exId) { return histIndex().get(exId) || []; }
function lastSession(exId, excludeWid) { return hist(exId).find(h => h.w.id !== excludeWid) || null; }
function records(exId, excludeWid) {
  const e = EX(exId);
  const r = { best1: 0, maxW: 0, maxR: 0, maxVolSet: 0, maxT: 0, maxD: 0, repBest: {}, repExact: {}, sessVol: 0, has: false, when: {} };
  for (const { w, it } of hist(exId)) {
    if (w.id === excludeWid) continue;
    let sv = 0;
    for (const s of it.sets) {
      if (!isWork(s)) continue; r.has = true;
      const W = s.w || 0, R = s.r || 0;
      if (e.typ === "kg") {
        const one = e1rm(W, R);
        if (one > r.best1) { r.best1 = one; r.when.best1 = w.start; }
        if (W > r.maxW) { r.maxW = W; r.when.maxW = w.start; }
        if (W * R > r.maxVolSet) r.maxVolSet = W * R;
        for (let k = 1; k <= Math.min(R, 20); k++) if (!r.repBest[k] || W > r.repBest[k]) r.repBest[k] = W;
        if (R <= 20 && (!r.repExact[R] || W > r.repExact[R])) r.repExact[R] = W;
        sv += W * R;
      }
      if (R > r.maxR) { r.maxR = R; r.when.maxR = w.start; }
      if (e.typ === "bw" && W > r.maxW) r.maxW = W;
      if ((s.t || 0) > r.maxT) { r.maxT = s.t; r.when.maxT = w.start; }
      if ((s.d || 0) > r.maxD) { r.maxD = s.d; r.when.maxD = w.start; }
    }
    if (sv > r.sessVol) r.sessVol = sv;
  }
  return r;
}
/* Prüft, ob ein Satz eine neue Bestleistung ist (gegen alles vor diesem Training und die früheren Sätze darin) */
function checkPR(w, it, s) {
  if (!isWork(s)) return [];
  const e = EX(it.ex), rec = records(it.ex, w.id);
  if (!rec.has) return [];
  // frühere Sätze dieses Trainings einbeziehen
  for (const x of w.items) if (x.ex === it.ex) for (const o of x.sets) {
    if (o === s || !isWork(o)) continue;
    if (x === it && it.sets.indexOf(o) > it.sets.indexOf(s)) continue;
    const W = o.w || 0, R = o.r || 0;
    if (e.typ === "kg") { rec.best1 = Math.max(rec.best1, e1rm(W, R)); rec.maxW = Math.max(rec.maxW, W); for (let k = 1; k <= Math.min(R, 20); k++) rec.repBest[k] = Math.max(rec.repBest[k] || 0, W); }
    rec.maxR = Math.max(rec.maxR, R); rec.maxT = Math.max(rec.maxT, o.t || 0); rec.maxD = Math.max(rec.maxD, o.d || 0);
  }
  const out = [], W = s.w || 0, R = s.r || 0;
  if (e.typ === "kg" && W > 0 && R > 0) {
    if (e1rm(W, R) > rec.best1 + 0.01) out.push("1RM");
    if (W > rec.maxW) out.push("Gewicht");
    if (!out.length && R <= 20 && rec.repBest[R] != null && W > rec.repBest[R]) out.push(R + " Wdh.");
  } else if (e.typ === "bw" && R > rec.maxR) out.push("Wdh.");
  else if (e.typ === "zeit" && (s.t || 0) > rec.maxT) out.push("Zeit");
  else if (e.typ === "cardio" && (s.d || 0) > rec.maxD) out.push("Distanz");
  return out;
}
function prLabel(p) { return p === "1RM" ? "Neues 1RM" : p === "Gewicht" ? "Höchstes Gewicht" : p === "Zeit" ? "Längste Zeit" : p === "Distanz" ? "Weiteste Distanz" : p === "Wdh." ? "Meiste Wdh." : "Rekord bei " + p; }

/* Fortschrittsvorschlag (doppelte Progression) */
function parseRange(t) { if (!t) return null; const m = String(t).match(/(\d+)\s*[-–]\s*(\d+)/); if (m) return [+m[1], +m[2]]; const n = parseInt(t); return n ? [n, n] : null; }
function suggestion(it, wid) {
  const e = EX(it.ex); if (e.typ !== "kg") return null;
  const last = lastSession(it.ex, wid); if (!last) return null;
  const ws = last.it.sets.filter(isWork).filter(s => s.w && s.r); if (!ws.length) return null;
  const top = Math.max(...ws.map(s => s.w)); const work = ws.filter(s => s.w === top);
  const range = parseRange(it.reps) || parseRange(e.ziel);
  const inc = exIncrement(e);
  let w = top, reps, text, up = false;
  if (range) {
    const [lo, hi] = range;
    if (work.every(s => s.r >= hi)) { w = top + inc; reps = work.map(() => lo); up = true; }
    else reps = work.map(s => Math.min(s.r + 1, hi));
  } else {
    const minR = Math.min(...work.map(s => s.r)), maxR = Math.max(...work.map(s => s.r));
    if (minR === maxR && maxR >= 12) { w = top + inc; reps = work.map(() => Math.max(6, maxR - 4)); up = true; }
    else { reps = work.map(s => s.r); const i = reps.indexOf(Math.min(...reps)); reps[i]++; }
  }
  const lastTxt = fkg(top) + " kg × " + work.map(s => s.r).join(", ");
  text = up ? `Letztes Mal ${lastTxt} geschafft. Heute <b>${fkg(w)} kg</b> × ${reps[0]}` : `Letztes Mal ${lastTxt}. Heute <b>${fkg(w)} kg</b> × ${reps.join(", ")}`;
  return { w, reps, text, up };
}

/* Trainingstage, Serie, Woche */
function trainDays() { return [...new Set(S.trainings.map(w => dayKey(w.start)))].sort(); }
function streak() {
  const days = trainDays().map(k => new Date(k + "T12:00").getTime()); if (!days.length) return { cur: 0, best: 0 };
  const gap = (S.settings.ruhetage || 0) + 1; let best = 1, run = 1;
  for (let i = 1; i < days.length; i++) { const d = Math.round((days[i] - days[i - 1]) / DAY); run = d <= gap ? run + 1 : 1; best = Math.max(best, run); }
  const since = Math.round((startOfDay(Date.now()) - startOfDay(days[days.length - 1])) / DAY);
  return { cur: since <= gap ? run : 0, best, since };
}
function weekCount(ts = Date.now()) { const a = startOfWeek(ts), b = a + 7 * DAY; return new Set(S.trainings.filter(w => w.start >= a && w.start < b).map(w => dayKey(w.start))).size; }
function weekStreak() {
  let n = 0, t = startOfWeek(Date.now()); const goal = S.settings.wochenziel || 1;
  if (weekCount(t) >= goal) n++;
  t -= 7 * DAY;
  while (weekCount(t) >= goal) { n++; t -= 7 * DAY; if (n > 520) break; }
  return n;
}
/* Sätze pro Muskel (Hauptmuskel 1, Nebenmuskel 0,5) */
function muscleSets(from, to) {
  const m = {};
  for (const w of S.trainings) {
    if (w.start < from || w.start >= to) continue;
    for (const it of w.items) {
      const e = EX(it.ex); const n = it.sets.filter(isWork).length; if (!n) continue;
      m[e.muskel] = (m[e.muskel] || 0) + n;
      for (const x of e.neben || []) if (x !== "cardio") m[x] = (m[x] || 0) + n / 2;
    }
  }
  return m;
}
function deloadHint() {
  // 1) mehrere Übungen zweimal in Folge schwächer
  let falling = 0;
  for (const [exId, hs] of histIndex()) {
    if (EX(exId).typ !== "kg" || hs.length < 3) continue;
    const v = hs.slice(0, 3).map(h => itemStats(h.it).best1);
    if (v[0] < v[1] * 0.985 && v[1] < v[2] * 0.985 && Date.now() - hs[0].w.start < 21 * DAY) falling++;
  }
  if (falling >= 3) return { t: "Leistung sinkt bei " + falling + " Übungen", p: "Zwei Einheiten in Folge schwächer. Eine leichtere Woche mit etwa halb so vielen Sätzen kann helfen, dich zu erholen." };
  // 2) viele Wochen am Stück trainiert
  let weeks = 0, t = startOfWeek(Date.now()) - 7 * DAY;
  while (weekCount(t) >= 2) { weeks++; t -= 7 * DAY; if (weeks > 30) break; }
  if (weeks >= 8) return { t: weeks + " Wochen ohne Pause", p: "Du trainierst seit " + weeks + " Wochen durchgehend. Plane bei Bedarf eine leichtere Woche ein." };
  return null;
}

/* ---------- Feder-Animation (nach Apples Dämpfung + Antwortzeit) ---------- */
function spring({ from, to, v = 0, damping = 1, response = 0.35, onUpdate, onDone }) {
  const k = Math.pow(2 * Math.PI / response, 2), c = 4 * Math.PI * damping / response;
  let x = from, vel = v, last = performance.now(), raf = 0, stopped = false;
  if (REDUCED.matches) { onUpdate(to); onDone && onDone(); return { stop() {}, get value() { return to; }, get velocity() { return 0; } }; }
  const step = now => {
    if (stopped) return;
    let dt = Math.min(0.064, (now - last) / 1000); last = now;
    while (dt > 0) { const h = Math.min(dt, 1 / 240); const a = -k * (x - to) - c * vel; vel += a * h; x += vel * h; dt -= h; }
    if (Math.abs(x - to) < 0.3 && Math.abs(vel) < 4) { x = to; onUpdate(x); onDone && onDone(); return; }
    onUpdate(x); raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return { stop() { stopped = true; cancelAnimationFrame(raf); }, get value() { return x; }, get velocity() { return vel; } };
}
const project = (v, d = 0.998) => (v / 1000) * d / (1 - d);

/* ---------- Blätter (von unten, mit dem Finger wegziehbar) ---------- */
const WIDE = matchMedia("(min-width: 1000px)");
const sheets = [];
function openSheet({ title = "", sub = "", body = "", foot = "", full = false, cls = "", onClose, right = "", left = "" } = {}) {
  const layer = document.createElement("div"); layer.className = "layer";
  layer.innerHTML = `<div class="scrim"></div><div class="sheet ${full ? "full" : ""} ${cls}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="grab"><i></i></div>
    <div class="sh">${left}<h2>${title}${sub ? `<small>${sub}</small>` : ""}</h2>${right}<button class="btn icon" data-close aria-label="Schließen">${ic("x")}</button></div>
    <div class="sb">${body}</div>${foot ? `<div class="sf">${foot}</div>` : ""}</div>`;
  $("#layers").appendChild(layer);
  const sh = layer.querySelector(".sheet"), scrim = layer.querySelector(".scrim"), sb = sh.querySelector(".sb");
  const o = { layer, el: sh, body: sb, closed: false, onClose, anim: null, y: 0, h: 0 };
  const apply = y => {
    o.y = y; const p = o.h ? Math.max(0, Math.min(1, 1 - y / o.h)) : 1;
    if (WIDE.matches) { sh.style.transform = `translate(-50%, calc(-50% + ${y}px))`; sh.style.opacity = String(Math.min(1, p * 1.6)); }
    else sh.style.transform = `translateY(${y}px)`;
    scrim.style.opacity = String(p);
  };
  o.apply = apply;
  o.h = WIDE.matches ? 120 : sh.getBoundingClientRect().height || innerHeight;
  if (REDUCED.matches) { apply(0); sh.style.transition = "opacity .2s"; }
  else { apply(o.h); o.anim = spring({ from: o.h, to: 0, damping: 1, response: WIDE.matches ? 0.3 : 0.38, onUpdate: apply }); }
  o.close = (v = 0) => {
    if (o.closed) return; o.closed = true; o.anim && o.anim.stop();
    const i = sheets.indexOf(o); if (i >= 0) sheets.splice(i, 1); if (!sheets.length) document.body.classList.remove("has-sheet");
    const end = () => { layer.remove(); o.onClose && o.onClose(); };
    if (REDUCED.matches) { layer.style.transition = "opacity .2s"; layer.style.opacity = "0"; setTimeout(end, 200); return; }
    layer.style.pointerEvents = "none";
    o.h = WIDE.matches ? 120 : sh.getBoundingClientRect().height;
    spring({ from: o.y, to: o.h + 20, v, damping: 1, response: 0.3, onUpdate: apply, onDone: end });
  };
  scrim.addEventListener("click", () => o.close());
  layer.addEventListener("click", e => { if (e.target.closest("[data-close]")) o.close(); });
  dragToDismiss(o, sh.querySelector(".grab"), sh.querySelector(".sh"), sb);
  sheets.push(o); document.body.classList.add("has-sheet");
  return o;
}
function dragToDismiss(o, ...zones) {
  const sb = zones[2];
  let st = null;
  const down = e => {
    if (WIDE.matches || e.button > 0) return;
    if (e.target.closest("input,textarea,select,button,.set,.chart")) return;
    const fromBody = e.currentTarget === sb;
    if (fromBody && sb.scrollTop > 0) return;
    st = { y0: e.clientY, x0: e.clientX, y: o.y, hist: [[e.clientY, e.timeStamp]], fromBody, on: false, id: e.pointerId, tgt: e.currentTarget };
  };
  const move = e => {
    if (!st || e.pointerId !== st.id) return;
    const dy = e.clientY - st.y0;
    if (!st.on) {
      if (Math.abs(e.clientX - st.x0) > 10 && Math.abs(e.clientX - st.x0) > Math.abs(dy)) { st = null; return; }
      if (dy > 8 && (!st.fromBody || sb.scrollTop <= 0)) { st.on = true; o.anim && o.anim.stop(); o.h = o.el.getBoundingClientRect().height; try { st.tgt.setPointerCapture(e.pointerId); } catch {} }
      else if (dy < -4 && st.fromBody) { st = null; return; } else return;
    }
    e.preventDefault();
    let y = st.y + dy; if (y < 0) y = -rubber(-y, o.h);
    o.apply(y);
    st.hist.push([e.clientY, e.timeStamp]); if (st.hist.length > 5) st.hist.shift();
  };
  const up = e => {
    if (!st || e.pointerId !== st.id) return;
    const s = st; st = null; if (!s.on) return;
    const h = s.hist, a = h[0], b = h[h.length - 1];
    const v = b[1] > a[1] ? (b[0] - a[0]) / ((b[1] - a[1]) / 1000) : 0;
    const end = o.y + project(v, 0.99);
    if (end > o.h * 0.45 || v > 900) o.close(v);
    else { o.anim = spring({ from: o.y, to: 0, v, damping: 0.85, response: 0.3, onUpdate: o.apply }); }
  };
  for (const z of zones) { if (!z) continue; z.addEventListener("pointerdown", down); z.addEventListener("pointermove", move, { passive: false }); z.addEventListener("pointerup", up); z.addEventListener("pointercancel", up); }
  sb.addEventListener("touchmove", e => { if (st && st.on) e.preventDefault(); }, { passive: false });
}
function rubber(x, dim, c = 0.55) { return (x * dim * c) / (dim + c * Math.abs(x)); }
function topSheet() { return sheets[sheets.length - 1]; }
document.addEventListener("keydown", e => { if (e.key === "Escape" && sheets.length) topSheet().close(); });

/* Aktionsblatt / Rückfrage */
function ask(title, text, buttons) {
  return new Promise(res => {
    let val = null;
    const body = `<div class="msg"><b>${title}</b>${text || ""}</div><div class="form">${buttons.map((b, i) => `<button class="btn big ${b.cls || ""}" data-i="${i}">${b.label}</button>`).join("")}<button class="btn big" data-close>Abbrechen</button></div>`;
    const sh = openSheet({ body, cls: "asheet", onClose: () => res(val) });
    sh.el.querySelector(".sh h2").textContent = "";
    sh.body.addEventListener("click", e => { const b = e.target.closest("[data-i]"); if (b) { val = buttons[+b.dataset.i].value ?? true; sh.close(); } });
  });
}
function askText(title, value = "", ph = "") {
  return new Promise(res => {
    let val = null;
    const sh = openSheet({ title, body: `<form class="form"><input class="inp" value="${esc(value)}" placeholder="${esc(ph)}" enterkeyhint="done"><button class="btn big primary">Übernehmen</button></form>`, onClose: () => res(val) });
    const f = sh.body.querySelector("form"), i = f.querySelector("input");
    setTimeout(() => i.focus(), 350);
    f.addEventListener("submit", e => { e.preventDefault(); val = i.value.trim(); sh.close(); });
  });
}

/* Hinweise unten */
function toast(msg, opt = {}) {
  const t = document.createElement("div"); t.className = "toast " + (opt.cls || "") + (opt.action ? " act" : "");
  t.innerHTML = (opt.icon ? ic(opt.icon) : "") + `<span>${msg}</span>` + (opt.action ? `<button>${opt.action}</button>` : "");
  $("#toasts").appendChild(t);
  t.animate([{ opacity: 0, transform: "translateY(16px) scale(.96)" }, { opacity: 1, transform: "none" }], { duration: REDUCED.matches ? 1 : 320, easing: "cubic-bezier(.2,.9,.3,1)" });
  let done = false;
  const kill = () => { if (done) return; done = true; t.animate([{ opacity: 1 }, { opacity: 0, transform: "translateY(8px)" }], { duration: 200 }).onfinish = () => t.remove(); };
  if (opt.action) t.querySelector("button").onclick = () => { opt.onAction && opt.onAction(); kill(); };
  setTimeout(kill, opt.ms || (opt.action ? 6000 : 3200));
}

/* Ton (Web Audio, wird beim ersten Tippen freigeschaltet) */
let AC = null;
function audioUnlock() { if (AC) return; try { AC = new (window.AudioContext || window.webkitAudioContext)(); const b = AC.createBuffer(1, 1, 22050); const s = AC.createBufferSource(); s.buffer = b; s.connect(AC.destination); s.start(0); } catch {} }
addEventListener("pointerdown", audioUnlock, { once: true, capture: true });
function beep(kind = "end") {
  if (!S.settings.ton || !AC) return;
  try {
    if (AC.state === "suspended") AC.resume();
    const notes = kind === "pr" ? [[784, 0], [988, .1], [1319, .2]] : kind === "tick" ? [[880, 0]] : [[880, 0], [880, .25], [1175, .5]];
    for (const [f, t] of notes) {
      const o = AC.createOscillator(), g = AC.createGain(); o.type = "sine"; o.frequency.value = f;
      const s = AC.currentTime + t; g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(kind === "tick" ? .12 : .3, s + .015); g.gain.exponentialRampToValueAtTime(.0001, s + (kind === "tick" ? .12 : .35));
      o.connect(g); g.connect(AC.destination); o.start(s); o.stop(s + .4);
    }
  } catch {}
  try { navigator.vibrate && navigator.vibrate(kind === "pr" ? [30, 40, 30] : [200, 100, 200]); } catch {}
}

/* ---------- Diagramme (SVG, ohne fremde Bibliothek) ---------- */
function lineChart(pts, opt = {}) {
  // pts: [{x: ms, y: Zahl, lab: Text}]
  const W = 340, H = opt.h || 150, pl = 6, pr = 40, pt = 14, pb = 22;
  if (pts.length === 0) return `<div class="empty small">Noch keine Daten</div>`;
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  let x0 = Math.min(...xs), x1 = Math.max(...xs); if (x1 === x0) { x0 -= DAY; x1 += DAY; }
  let y0 = Math.min(...ys), y1 = Math.max(...ys); const pad = (y1 - y0) * 0.15 || Math.max(1, y1 * 0.05); y0 -= pad; y1 += pad; if (opt.zero) y0 = Math.min(0, y0);
  const X = x => pl + (x - x0) / (x1 - x0) * (W - pl - pr), Y = y => pt + (1 - (y - y0) / (y1 - y0)) * (H - pt - pb);
  const col = opt.color || "var(--accent)";
  const ticks = niceTicks(y0, y1, 3);
  let d = "", area = "";
  pts.forEach((p, i) => { d += (i ? "L" : "M") + X(p.x).toFixed(1) + " " + Y(p.y).toFixed(1); });
  area = d + `L${X(pts[pts.length - 1].x).toFixed(1)} ${H - pb}L${X(pts[0].x).toFixed(1)} ${H - pb}Z`;
  const gid = "g" + uid();
  const xl = [pts[0], pts[pts.length - 1]].map((p, i) => `<text x="${i ? W - pr : pl}" y="${H - 5}" text-anchor="${i ? "end" : "start"}" font-size="11" fill="var(--text3)">${fdate(p.x, { y: x1 - x0 > 300 * DAY })}</text>`).join("");
  const svg = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="aspect-ratio:${W}/${H}">
    <defs><linearGradient id="${gid}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity=".22"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs>
    ${ticks.map(t => `<line x1="${pl}" x2="${W - pr}" y1="${Y(t)}" y2="${Y(t)}" stroke="var(--sep)" stroke-width="1"/><text x="${W - pr + 6}" y="${Y(t) + 4}" font-size="11" fill="var(--text3)">${fmt(t, t < 10 ? 1 : 0)}</text>`).join("")}
    <path d="${area}" fill="url(#${gid})"/>
    <path d="${d}" fill="none" stroke="${col}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
    ${pts.length < 40 ? pts.map(p => `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="${p.hi ? 4.5 : 3}" fill="${p.hi ? "var(--gold)" : "var(--card)"}" stroke="${p.hi ? "var(--gold)" : col}" stroke-width="2" vector-effect="non-scaling-stroke"/>`).join("") : ""}
    <line class="cur" x1="0" x2="0" y1="${pt}" y2="${H - pb}" stroke="var(--text3)" stroke-width="1" stroke-dasharray="3 3" opacity="0"/>
    <circle class="curp" r="5" fill="${col}" stroke="var(--card)" stroke-width="2" opacity="0"/>
    ${xl}</svg>`;
  const id = "c" + uid();
  CHARTS[id] = { pts, X, Y, W, H, fmt: opt.fmt || (v => fmt(v, 1)) };
  return `<div class="chart" data-chart="${id}">${svg}<div class="tip"></div></div>`;
}
const CHARTS = {};
function niceTicks(a, b, n) {
  const span = b - a; if (span <= 0) return [a];
  const step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0))), err = step0 / mag;
  const step = (err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1) * mag;
  const out = []; for (let v = Math.ceil(a / step) * step; v <= b; v += step) out.push(+v.toFixed(6)); return out;
}
document.addEventListener("pointermove", chartHover);
document.addEventListener("pointerdown", chartHover);
function chartHover(e) {
  const c = e.target.closest && e.target.closest(".chart"); if (!c) return;
  const d = CHARTS[c.dataset.chart]; if (!d) return;
  const svg = c.querySelector("svg"), r = svg.getBoundingClientRect();
  const sx = (e.clientX - r.left) / r.width * d.W;
  let best = d.pts[0], bd = Infinity; for (const p of d.pts) { const dd = Math.abs(d.X(p.x) - sx); if (dd < bd) { bd = dd; best = p; } }
  const cx = d.X(best.x), cy = d.Y(best.y);
  const line = svg.querySelector(".cur"), dot = svg.querySelector(".curp");
  line.setAttribute("x1", cx); line.setAttribute("x2", cx); line.setAttribute("opacity", "1");
  dot.setAttribute("cx", cx); dot.setAttribute("cy", cy); dot.setAttribute("opacity", "1");
  const tip = c.querySelector(".tip"); tip.textContent = d.fmt(best.y) + " · " + fdate(best.x, { y: true }) + (best.lab ? " · " + best.lab : "");
  const px = cx / d.W * r.width; tip.style.left = Math.max(60, Math.min(r.width - 60, px)) + "px"; tip.style.top = "-30px"; tip.classList.add("on");
  clearTimeout(c._t); c._t = setTimeout(() => { tip.classList.remove("on"); line.setAttribute("opacity", "0"); dot.setAttribute("opacity", "0"); }, 2500);
}
function ring(p, size = 84, stroke = 9, col = "var(--accent)", inner = "") {
  const r = (size - stroke) / 2, C = 2 * Math.PI * r, v = Math.max(0, Math.min(1, p));
  return `<div class="ring" style="width:${size}px;height:${size}px"><svg viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--fill2)" stroke-width="${stroke}"/><circle class="arc" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${col}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - v)}" style="transition:stroke-dashoffset .8s cubic-bezier(.2,.8,.2,1)"/></svg><div class="rval">${inner}</div></div>`;
}

/* Einblenden beim Erscheinen */
function reveal(root) {
  if (REDUCED.matches) return;
  const kids = [...root.children].filter(k => !k.hidden);
  kids.forEach((k, i) => { k.classList.add("rv"); k.classList.remove("in"); setTimeout(() => k.classList.add("in"), 30 + Math.min(i, 8) * 45); });
}

/* Datei sichern: iPhone -> Teilen-Menü -> "In Dateien sichern"; sonst Download */
async function saveFile(name, data, type) {
  try {
    const file = new File([data], name, { type });
    if (navigator.canShare && navigator.canShare({ files: [file] }) && matchMedia("(pointer: coarse)").matches) { await navigator.share({ files: [file] }); return "ok"; }
  } catch (err) { if (err && err.name === "AbortError") return "cancel"; }
  try { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([data], { type })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); return "ok"; }
  catch { return "error"; }
}

/* Farben zur Auswahl */
const FARBEN = ["#FF5A1F", "#E5484D", "#E05FA0", "#8B5CF6", "#3B82F6", "#0EA5E9", "#14B8A6", "#22A447", "#C08A4A", "#7C8798"];
function colorPicker(cur, name = "farbe") { return `<div class="colors" data-colors="${name}">${FARBEN.map(c => `<button type="button" style="--c:${c}" data-c="${c}" aria-label="Farbe ${c}" aria-pressed="${c === cur}"></button>`).join("")}</div>`; }
document.addEventListener("click", e => { const b = e.target.closest("[data-colors] button"); if (!b) return; for (const x of b.parentElement.children) x.setAttribute("aria-pressed", x === b); });
const pickedColor = root => { const b = root.querySelector("[data-colors] [aria-pressed=true]"); return b ? b.dataset.c : null; };
