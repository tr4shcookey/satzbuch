/* Satzbuch – laufendes Training, Pausen-Timer, Rekorde, Zusammenfassung, Start */
"use strict";
let WS = null;        // geöffnetes Trainings-Blatt
let W = null;         // Training, das gerade angezeigt wird (live: S.aktiv)
let MODE = "live";    // live | edit
let EDIT_NEW = false;

function newSet(k = "n") { return { k, w: null, r: null, done: false }; }
function startWorkout({ routine, fromWorkout }) {
  const go = () => {
    const w = { id: uid(), name: "Training", start: Date.now(), items: [], note: "", routine: null, rest: null };
    const h = new Date().getHours();
    w.name = h < 11 ? "Morgentraining" : h < 17 ? "Mittagstraining" : "Abendtraining";
    if (routine) {
      const r = S.routinen.find(x => x.id === routine);
      w.name = r.name; w.routine = r.id;
      w.items = r.items.map(i => ({ id: uid(), ex: i.ex, reps: i.reps || "", rest: i.rest || null, grp: i.grp || null, sets: Array.from({ length: EX(i.ex).nurBest ? 1 : i.sets }, () => newSet()) }));
    } else if (fromWorkout) {
      w.name = fromWorkout.name; w.routine = fromWorkout.routine || null;
      w.items = fromWorkout.items.filter(i => i.sets.some(isWork)).map(i => ({ id: uid(), ex: i.ex, reps: i.reps || "", rest: i.rest || null, grp: i.grp || null, sets: Array.from({ length: i.sets.filter(isWork).length }, () => newSet()) }));
    }
    S.aktiv = w; save(); openWorkout();
  };
  if (S.aktiv) {
    ask("Es läuft schon ein Training", "Möchtest du es fortsetzen oder verwerfen und neu beginnen?", [{ label: "Laufendes fortsetzen", cls: "primary", value: "open" }, { label: "Verwerfen und neu starten", cls: "danger", value: "new" }])
      .then(v => { if (v === "open") openWorkout(); if (v === "new") { S.aktiv = null; stopRest(); go(); } });
    return;
  }
  go();
}
function openWorkout() { if (!S.aktiv) return; showWorkoutSheet(S.aktiv, "live"); }
function editWorkout(w, isNew = false) { EDIT_NEW = isNew; showWorkoutSheet(JSON.parse(JSON.stringify(w)), "edit"); }

function showWorkoutSheet(w, mode) {
  if (WS) WS.close();
  W = w; MODE = mode;
  const right = mode === "live" ? `<button class="btn sm primary" data-w="finish">Beenden</button>` : `<button class="btn sm primary" data-w="save">Speichern</button>`;
  const me = openSheet({ title: "", full: true, right, body: "", foot: " ", cls: "wk", onClose: () => { if (WS !== me) return; WS = null; renderMini(); releaseWake(); if (MODE === "live") save(); } });
  WS = me;
  WS.el.querySelector(".sh h2").innerHTML = `<input class="wk-name" data-w="name" value="${esc(W.name)}" aria-label="Name des Trainings"><small class="wk-time" data-dur>${mode === "live" ? fsec((Date.now() - W.start) / 1000) : fdate(W.start, { wd: true, y: true })}</small>`;
  WS.foot = WS.el.querySelector(".sf");
  renderWorkout();
  renderRest();
  renderMini();
  if (mode === "live") wakeLock();
  WS.el.addEventListener("input", onWInput);
  WS.el.addEventListener("change", onWChange);
  WS.el.addEventListener("click", onWClick);
  WS.body.addEventListener("pointerdown", swipeStart);
  WS.el.querySelector("[data-w=name]").addEventListener("input", e => { W.name = e.target.value; if (MODE === "live") save(); });
}

/* ---------- Darstellung ---------- */
function renderWorkout() {
  if (!WS) return;
  const top = WS.body.scrollTop;
  let h = "";
  if (!W.items.length) h += `<div class="card empty">${ic("hantel")}<b>Noch keine Übungen</b>Füge unten Übungen hinzu.</div>`;
  W.items.forEach((it, ii) => { h += itemHTML(it, ii); });
  h += `<button class="btn big tint" data-w="add-ex">${ic("plus")}Übung hinzufügen</button>`;
  h += `<label class="field"><span>Notiz zum Training</span><textarea class="inp" data-w="note" placeholder="z. B. Schlecht geschlafen, Studio voll">${esc(W.note || "")}</textarea></label>`;
  if (MODE === "live") h += `<button class="btn big danger" data-w="discard">Training verwerfen</button>`;
  else if (!EDIT_NEW) h += `<div class="two" style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><label class="field"><span>Beginn</span><input class="inp" type="datetime-local" data-w="start" value="${localDT(W.start)}"></label><label class="field"><span>Ende</span><input class="inp" type="datetime-local" data-w="end" value="${localDT(W.end || W.start)}"></label></div>`;
  WS.body.innerHTML = h;
  WS.body.scrollTop = top;
}
function localDT(ts) { const d = new Date(ts); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); }
function prevSets(it) { const l = lastSession(it.ex, W.id); return l ? l.it.sets.filter(s => s.done) : []; }
function prevFor(it, si, prev) {
  const s = it.sets[si]; const sameKind = x => (x.k === "a") === (s.k === "a");
  const idx = it.sets.slice(0, si).filter(sameKind).length;
  return prev.filter(sameKind)[idx] || null;
}
function placeholder(it, si, prev, sug) {
  const s = it.sets[si];
  if (s.k !== "a" && sug) { const wi = it.sets.slice(0, si).filter(x => x.k !== "a").length; if (wi < sug.reps.length) return { w: sug.w, r: sug.reps[wi] }; }
  const p = prevFor(it, si, prev); if (p) return p;
  for (let j = si - 1; j >= 0; j--) { const o = it.sets[j]; if (o.k === s.k && (o.w != null || o.r != null || o.t || o.d)) return o; }
  return null;
}
function itemHTML(it, ii) {
  const e = EX(it.ex), typ = e.typ, prev = prevSets(it);
  const sug = MODE === "live" ? suggestion(it, W.id) : null;
  const grpPrev = ii > 0 && it.grp && W.items[ii - 1].grp === it.grp, grpNext = ii < W.items.length - 1 && it.grp && W.items[ii + 1].grp === it.grp;
  const inGrp = grpPrev || grpNext;
  const rir = S.settings.rir && (typ === "kg" || typ === "bw"), extra = !!e.extra;
  const heads = { kg: ["kg", "Wdh."], bw: ["+kg", "Wdh."], zeit: ["Zeit", "Uhr"], cardio: ["km", "Zeit"] }[typ];
  const cls = rir || extra ? (rir ? "rir" : "x") : "";
  let h = `<div class="ex ${inGrp ? "grp" : ""} ${grpPrev ? "gmid" : ""}" data-ii="${ii}" style="${inGrp ? "" : ""}">`;
  if (inGrp && !grpPrev) h += `<div class="ex-tag">Supersatz</div>`;
  h += `<div class="ex-h"><span class="dot" style="--c:${exColor(e)}"></span><button class="nm" data-w="detail">${esc(e.name)}<small>${muskelName(e.muskel)}${it.reps ? " · Ziel " + esc(it.reps) + " Wdh." : ""}${e.nurBest ? " · nur Bestleistung" : ""}</small></button><button class="btn icon" data-w="exmenu" aria-label="Optionen">${ic("mehr")}</button></div>`;
  h += `<div class="ex-tools">${typ === "kg" ? `<button class="chip" data-w="warmup">${ic("flamme")}Aufwärmen</button><button class="chip" data-w="plates">${ic("scheibe")}Scheiben</button>` : ""}<button class="chip" data-w="restset">${ic("timer")}${fsec(it.rest || exPause(e))}</button><button class="chip" data-w="itnote">${ic("notiz")}Notiz</button></div>`;
  if (e.notiz) h += `<div class="exnote">${esc(e.notiz)}</div>`;
  if (it.note) h += `<div class="exnote" style="background:var(--accent-soft)">${esc(it.note)}</div>`;
  if (sug && !it.sets.some(isWork)) h += `<div class="sugg"><span class="ico" style="--c:var(--accent);width:26px;height:26px">${ic(sug.up ? "hoch" : "blitz")}</span><div class="grow">${sug.text}</div><button class="btn sm primary" data-w="sugg">Übernehmen</button></div>`;
  h += cmpHTML(it, prev, typ);
  h += `<div class="sets ${cls}"><div class="hd"><span>Satz</span><span>Vorher</span><span>${heads[0]}</span><span>${heads[1]}</span>${rir ? "<span>RIR</span>" : extra ? `<span class="ell">${esc(e.extra)}</span>` : ""}<span>✓</span></div>`;
  let n = 0;
  it.sets.forEach((s, si) => {
    if (s.k !== "a") n++;
    const lab = s.k === "a" ? "A" : s.k === "d" ? "D" : s.k === "v" ? "V" : n;
    const pv = prevFor(it, si, prev), ph = placeholder(it, si, prev, sug) || {};
    const v = (x, d) => x == null ? "" : d === "t" ? fsec(x) : fkg(x);
    let c1, c2;
    if (typ === "kg" || typ === "bw") {
      c1 = `<input class="c" inputmode="decimal" enterkeyhint="next" data-f="w" value="${v(s.w)}" placeholder="${ph.w != null ? fkg(ph.w) : typ === "bw" ? "0" : "kg"}" aria-label="Gewicht">`;
      c2 = `<input class="c" inputmode="numeric" enterkeyhint="done" data-f="r" value="${s.r ?? ""}" placeholder="${ph.r ?? "Wdh"}" aria-label="Wiederholungen">`;
    } else if (typ === "zeit") {
      c1 = `<input class="c" inputmode="decimal" data-f="t" value="${s.t ? fsec(s.t) : ""}" placeholder="${ph.t ? fsec(ph.t) : "0:30"}" aria-label="Zeit">`;
      const run = STOPW && STOPW.it === it && STOPW.s === s;
      c2 = `<button class="sw-btn ${run ? "run" : ""}" data-w="stopwatch" aria-label="Stoppuhr">${run ? fsec((Date.now() - STOPW.t0) / 1000) : ic("play")}</button>`;
    } else {
      c1 = `<input class="c" inputmode="decimal" data-f="d" value="${s.d != null ? fkg(s.d) : ""}" placeholder="${ph.d != null ? fkg(ph.d) : "km"}" aria-label="Distanz">`;
      c2 = `<input class="c" inputmode="decimal" data-f="tm" value="${s.t ? fsec(s.t) : ""}" placeholder="${ph.t ? fsec(ph.t) : "min"}" aria-label="Zeit in Minuten">`;
    }
    const c3 = rir ? `<select class="c" data-f="rir" aria-label="RIR"><option value=""></option>${[0, 1, 2, 3, 4, 5].map(k => `<option ${s.rir === k ? "selected" : ""}>${k}</option>`).join("")}</select>` : extra ? `<input class="c" data-f="x" value="${esc(s.x ?? "")}" placeholder="${esc(pv && pv.x ? pv.x : "")}" aria-label="${esc(e.extra)}">` : "";
    h += `<div class="set-wrap"><div class="set-bg"><span class="l">${ic("kopie")}Kopieren</span><span class="r">Löschen${ic("papierkorb")}</span></div><div class="set ${s.done ? "done" : ""}" data-si="${si}">${s.pr && s.pr.length ? `<svg class="pr"><use href="#i-pokal"/></svg>` : ""}
      <button class="sl ${s.k === "a" ? "a" : s.k === "d" ? "d" : s.k === "v" ? "v" : ""}" data-w="setmenu" aria-label="Satz ${lab}, Optionen">${lab}</button>
      <button class="pv" data-w="copyprev" aria-label="Werte vom letzten Mal übernehmen">${pv ? setShort(pv, typ) : "–"}</button>${c1}${c2}${c3}
      <button class="ck" data-w="check" aria-label="Satz abhaken" aria-pressed="${s.done}">${ic("check")}</button></div></div>`;
  });
  h += `</div><div class="addset"><button class="btn" data-w="addset">${ic("plus")}Satz hinzufügen</button></div></div>`;
  return h;
}
function cmpHTML(it, prev, typ) {
  if (!prev.length || !it.sets.some(isWork) || typ === "zeit") return "";
  const st = itemStats(it), pall = itemStats({ ex: it.ex, sets: prev });
  const pst = itemStats({ ex: it.ex, sets: prev.filter(isWork).slice(0, st.sets) }); // fair: gleich viele Sätze vergleichen
  const chip = (lab, a, b, f) => { if (!b) return ""; const d = a - b, p = d / b * 100; const cls = Math.abs(p) < 0.5 ? "" : d > 0 ? "good" : "bad"; return `<span class="badge ${cls}">${lab} ${Math.abs(p) < 0.5 ? "=" : (d > 0 ? "↑ " : "↓ ") + (f ? f(a) : fmt(Math.abs(p), 0) + " %")}</span>`; };
  let h = `<div class="cmp"><span class="faint tiny" style="align-self:center">vs. letztes Mal:</span>`;
  if (typ === "kg") { h += chip("Volumen", st.vol, pst.vol) + chip("1RM", st.best1, pst.best1); }
  else if (typ === "bw") h += chip("Wdh.", st.reps, pst.reps);
  else h += chip("Distanz", st.dist, pst.dist);
  h += `<span class="badge">Sätze ${st.sets}/${pall.sets}</span></div>`;
  return h;
}
function rerenderItem(ii) {
  if (!WS) return;
  const old = WS.body.querySelector(`.ex[data-ii="${ii}"]`); if (!old) return renderWorkout();
  const tmp = document.createElement("div"); tmp.innerHTML = itemHTML(W.items[ii], ii); old.replaceWith(tmp.firstElementChild);
}
function ctx(el) { const ex = el.closest(".ex"), st = el.closest(".set"); const ii = ex ? +ex.dataset.ii : -1, si = st ? +st.dataset.si : -1; return { ii, si, it: W.items[ii], s: ii >= 0 && si >= 0 ? W.items[ii].sets[si] : null, el: st }; }
function parseTime(v, minutes) { if (v == null || v === "") return null; const s = String(v).trim(); if (s.includes(":")) { const [m, x] = s.split(":"); return (parseInt(m) || 0) * 60 + (parseInt(x) || 0); } const n = pnum(s); return n == null ? null : Math.round(minutes ? n * 60 : n); }

function onWInput(e) {
  const t = e.target, f = t.dataset.f;
  if (t.dataset.w === "note") { W.note = t.value; if (MODE === "live") save(); return; }
  if (!f) return;
  const { s } = ctx(t); if (!s) return;
  if (f === "w") s.w = pnum(t.value); else if (f === "r") s.r = t.value === "" ? null : Math.max(0, parseInt(t.value) || 0);
  else if (f === "d") s.d = pnum(t.value); else if (f === "x") s.x = t.value.trim() || null;
  if (MODE === "live") save();
}
function onWChange(e) {
  const t = e.target, f = t.dataset.f; const { s, ii } = ctx(t);
  if (t.dataset.w === "start") { const v = new Date(t.value).getTime(); if (isFinite(v)) W.start = v; return; }
  if (t.dataset.w === "end") { const v = new Date(t.value).getTime(); if (isFinite(v)) W.end = v; return; }
  if (!s) return;
  if (f === "t") { s.t = parseTime(t.value); t.value = s.t ? fsec(s.t) : ""; }
  if (f === "tm") { s.t = parseTime(t.value, true); t.value = s.t ? fsec(s.t) : ""; }
  if (f === "rir") s.rir = t.value === "" ? null : +t.value;
  if (s.done && (f === "w" || f === "r" || f === "t" || f === "d")) { s.pr = checkPR(W, W.items[ii], s); rerenderItem(ii); }
  if (MODE === "live") save();
}

async function onWClick(e) {
  const b = e.target.closest("[data-w]"); if (!b) return;
  const a = b.dataset.w; const c = ctx(b);
  switch (a) {
    case "finish": finishWorkout(); break;
    case "save": saveEdit(); break;
    case "discard":
      if (await ask("Training verwerfen?", "Alle Sätze dieses Trainings gehen verloren.", [{ label: "Verwerfen", cls: "danger" }])) { S.aktiv = null; stopRest(); save(); WS && WS.close(); rerender(); }
      break;
    case "add-ex": {
      const ids = await pickExercises(); if (!ids.length) break;
      for (const id of ids) { const e2 = EX(id); W.items.push({ id: uid(), ex: id, reps: e2.ziel || "", rest: null, grp: null, sets: Array.from({ length: e2.nurBest ? 1 : 3 }, () => newSet()) }); }
      if (MODE === "live") save(); renderWorkout(); setTimeout(() => WS && WS.body.scrollTo({ top: WS.body.scrollHeight, behavior: REDUCED.matches ? "auto" : "smooth" }), 60);
      break;
    }
    case "detail": exDetail(c.it.ex); break;
    case "check": toggleCheck(c); break;
    case "addset": {
      const last = c.it.sets[c.it.sets.length - 1];
      const ns = newSet(last && last.k === "d" ? "d" : "n");
      c.it.sets.push(ns); if (MODE === "live") save(); rerenderItem(c.ii);
      const rows = WS.body.querySelectorAll(`.ex[data-ii="${c.ii}"] .set`); const r = rows[rows.length - 1];
      if (r && !REDUCED.matches) r.animate([{ opacity: 0, transform: "translateY(-8px)" }, { opacity: 1, transform: "none" }], { duration: 260, easing: "cubic-bezier(.2,.9,.3,1)" });
      break;
    }
    case "copyprev": {
      const pv = prevFor(c.it, c.si, prevSets(c.it)); if (!pv) break;
      for (const k of ["w", "r", "t", "d", "x"]) if (pv[k] != null) c.s[k] = pv[k];
      if (MODE === "live") save(); rerenderItem(c.ii); break;
    }
    case "sugg": {
      const sg = suggestion(c.it, W.id); if (!sg) break;
      let wi = 0; for (const s of c.it.sets) { if (s.k === "a" || s.done) continue; if (wi < sg.reps.length) { s.w = sg.w; s.r = sg.reps[wi]; } else { s.w = sg.w; s.r = sg.reps[sg.reps.length - 1]; } wi++; }
      while (wi < sg.reps.length) { c.it.sets.push({ ...newSet(), w: sg.w, r: sg.reps[wi] }); wi++; }
      if (MODE === "live") save(); rerenderItem(c.ii); toast("Vorschlag übernommen"); break;
    }
    case "setmenu": setMenu(c); break;
    case "exmenu": exMenu(c); break;
    case "warmup": warmup(c); break;
    case "plates": plateSheet(c); break;
    case "restset": {
      const v = await ask("Pause für " + esc(EX(c.it.ex).name), "", [30, 60, 90, 120, 150, 180, 240, 300].map(s => ({ label: fsec(s) + " min", value: s, cls: s === (c.it.rest || exPause(EX(c.it.ex))) ? "tint" : "" })));
      if (v) { c.it.rest = v; if (MODE === "live") save(); rerenderItem(c.ii); }
      break;
    }
    case "itnote": { const v = await askText("Notiz zu dieser Übung (heute)", c.it.note || "", "z. B. Griff enger"); if (v != null) { c.it.note = v; if (MODE === "live") save(); rerenderItem(c.ii); } break; }
    case "stopwatch": stopwatch(c, b); break;
    case "rest-minus": adjustRest(-15); break;
    case "rest-plus": adjustRest(15); break;
    case "rest-skip": stopRest(); break;
    case "rest-phone": { const r = W.rest; if (r) runShortcut("Satzbuch Pause", String(Math.max(1, Math.round((r.end - Date.now()) / 1000)))); break; }
  }
}

/* Satz abhaken */
function toggleCheck(c) {
  const { it, s, ii } = c; const e = EX(it.ex);
  if (!s.done) {
    const ph = placeholder(it, c.si, prevSets(it), MODE === "live" ? suggestion(it, W.id) : null) || {};
    if (e.typ === "kg" || e.typ === "bw") { if (s.w == null && ph.w != null) s.w = ph.w; if (s.r == null && ph.r != null) s.r = ph.r; if (e.typ === "bw" && s.w == null) s.w = 0; if (s.r == null) { toast("Bitte Wiederholungen eintragen"); focusCell(ii, c.si, "r"); return; } if (e.typ === "kg" && s.w == null) { toast("Bitte ein Gewicht eintragen"); focusCell(ii, c.si, "w"); return; } }
    if (e.typ === "zeit") { if (!s.t && ph.t) s.t = ph.t; if (!s.t) { toast("Bitte eine Zeit eintragen oder die Stoppuhr nutzen"); return; } }
    if (e.typ === "cardio") { if (s.d == null && ph.d != null) s.d = ph.d; if (!s.t && ph.t) s.t = ph.t; if (s.d == null && !s.t) { toast("Bitte Distanz oder Zeit eintragen"); return; } }
    s.done = true; s.ts = Date.now();
    s.pr = MODE === "live" || MODE === "edit" ? checkPR(W, it, s) : [];
    rerenderItem(ii);
    const row = WS.body.querySelector(`.ex[data-ii="${ii}"] .set[data-si="${c.si}"]`);
    if (row && !REDUCED.matches) row.querySelector(".ck").animate([{ transform: "scale(.7)" }, { transform: "scale(1.12)" }, { transform: "scale(1)" }], { duration: 380, easing: "cubic-bezier(.3,1.4,.5,1)" });
    if (s.pr.length) celebrate(row, it, s);
    if (MODE === "live" && S.settings.autoPause && !(it.grp && W.items[ii + 1] && W.items[ii + 1].grp === it.grp)) startRest(it.rest || exPause(e), e.name);
  } else { s.done = false; s.pr = []; rerenderItem(ii); }
  if (MODE === "live") save();
}
function focusCell(ii, si, f) { const i = WS.body.querySelector(`.ex[data-ii="${ii}"] .set[data-si="${si}"] [data-f=${f}]`); i && i.focus(); }
function celebrate(row, it, s) {
  if (row) { row.classList.remove("shine"); void row.offsetWidth; row.classList.add("shine"); }
  beep("pr");
  toast(`<b>${prLabel(s.pr[0])}!</b> ${esc(EX(it.ex).name)} · ${setText(s, EX(it.ex).typ)}`, { cls: "gold", icon: "pokal", ms: 3800 });
}

/* Wischen: rechts = kopieren, links = löschen */
function swipeStart(e) {
  const row = e.target.closest(".set"); if (!row || e.target.closest("select") || e.button > 0) return;
  const x0 = e.clientX, y0 = e.clientY; let on = false, dx = 0, hist = [[x0, e.timeStamp]], anim = null;
  const bg = row.previousElementSibling;
  const move = ev => {
    if (ev.pointerId !== e.pointerId) return;
    const mx = ev.clientX - x0, my = ev.clientY - y0;
    if (!on) { if (Math.abs(mx) > 10 && Math.abs(mx) > Math.abs(my) * 1.3) { on = true; try { row.setPointerCapture(e.pointerId); } catch {} if (document.activeElement && row.contains(document.activeElement)) document.activeElement.blur(); } else if (Math.abs(my) > 10) { end(); return; } else return; }
    ev.preventDefault();
    dx = Math.abs(mx) > 110 ? Math.sign(mx) * (110 + rubber(Math.abs(mx) - 110, 200)) : mx;
    row.style.transform = `translateX(${dx}px)`;
    bg.querySelector(".l").style.opacity = dx > 0 ? Math.min(1, dx / 90) : 0; bg.querySelector(".r").style.opacity = dx < 0 ? Math.min(1, -dx / 90) : 0;
    hist.push([ev.clientX, ev.timeStamp]); if (hist.length > 5) hist.shift();
  };
  const up = ev => {
    if (ev.pointerId !== e.pointerId) return; end();
    if (!on) return;
    const a = hist[0], b = hist[hist.length - 1]; const v = b[1] > a[1] ? (b[0] - a[0]) / ((b[1] - a[1]) / 1000) : 0;
    const proj = dx + project(v, 0.99);
    const c = ctx(row);
    if (proj > 120) { spring({ from: dx, to: 0, v, damping: .85, response: .3, onUpdate: x => row.style.transform = `translateX(${x}px)` }); copySet(c); }
    else if (proj < -140) { spring({ from: dx, to: -row.offsetWidth, v, damping: 1, response: .25, onUpdate: x => row.style.transform = `translateX(${x}px)`, onDone: () => deleteSet(c) }); }
    else spring({ from: dx, to: 0, v, damping: .85, response: .3, onUpdate: x => row.style.transform = `translateX(${x}px)` });
  };
  const end = () => { removeEventListener("pointermove", move); removeEventListener("pointerup", up); removeEventListener("pointercancel", up); };
  addEventListener("pointermove", move, { passive: false }); addEventListener("pointerup", up); addEventListener("pointercancel", up);
}
function copySet(c) { const s = { ...c.s, done: false, pr: [], ts: null, note: null }; c.it.sets.splice(c.si + 1, 0, s); if (MODE === "live") save(); setTimeout(() => rerenderItem(c.ii), 120); toast("Satz kopiert"); }
function deleteSet(c) {
  const old = c.it.sets.splice(c.si, 1)[0]; if (MODE === "live") save(); rerenderItem(c.ii);
  toast("Satz gelöscht", { action: "Rückgängig", onAction: () => { c.it.sets.splice(c.si, 0, old); if (MODE === "live") save(); rerenderItem(c.ii); } });
}

/* Satz-Menü mit großen Zahlen und +/− */
function setMenu(c) {
  const e = EX(c.it.ex), s = c.s, typ = e.typ, inc = exIncrement(e);
  const ph = placeholder(c.it, c.si, prevSets(c.it), null) || {};
  const st = (f, lab, val, step) => `<div class="field"><span>${lab}</span><div class="stepper"><button type="button" data-st="${f}" data-d="-${step}" aria-label="weniger">−</button><input inputmode="decimal" data-sf="${f}" value="${val ?? ""}" placeholder="${f === "w" && ph.w != null ? fkg(ph.w) : f === "r" && ph.r != null ? ph.r : ""}"><button type="button" data-st="${f}" data-d="${step}" aria-label="mehr">+</button></div></div>`;
  let body = "";
  if (typ === "kg" || typ === "bw") body += st("w", typ === "bw" ? "Zusatzgewicht (kg)" : "Gewicht (kg)", s.w != null ? fkg(s.w) : "", inc) + st("r", "Wiederholungen", s.r, 1);
  if (typ === "zeit") body += st("t", "Zeit (Sekunden)", s.t, 5);
  if (typ === "cardio") body += st("d", "Distanz (km)", s.d != null ? fkg(s.d) : "", 0.1) + st("tmin", "Zeit (Minuten)", s.t ? fmt(s.t / 60, 1) : "", 1);
  body += `<div class="field"><span>Art des Satzes</span><div class="seg" data-k>${[["n", "Normal"], ["a", "Aufwärmen"], ["d", "Drop"], ["v", "Versagen"]].map(([k, n]) => `<button type="button" data-v="${k}" aria-pressed="${(s.k || "n") === k}">${n}</button>`).join("")}</div></div>`;
  if (typ === "kg" || typ === "bw") body += `<div class="field"><span>RIR – wie viele Wdh. wären noch gegangen?</span><div class="chips wrap" data-rir>${["–", 0, 1, 2, 3, 4, "5+"].map(k => `<button type="button" class="chip" data-v="${k}" aria-pressed="${k === "–" ? s.rir == null : s.rir === (k === "5+" ? 5 : k)}">${k}</button>`).join("")}</div></div>`;
  body += `<label class="field"><span>Notiz zum Satz</span><input class="inp" data-sf="note" value="${esc(s.note || "")}" placeholder="z. B. mit Hilfe, Technik sauber"></label>
    <div class="btns"><button class="btn" data-sx="dup">${ic("kopie")}Kopieren</button><button class="btn danger" data-sx="del">${ic("papierkorb")}Löschen</button></div>`;
  const draft = { ...s };
  const sh = openSheet({ title: "Satz " + (s.k === "a" ? "Aufwärmen" : c.it.sets.filter(x => x.k !== "a").indexOf(s) + 1), sub: esc(e.name), body: `<div class="form">${body}</div>`, foot: `<button class="btn big primary" data-sx="ok">Übernehmen</button>` });
  sh.el.addEventListener("click", ev => {
    const b = ev.target.closest("[data-st]");
    if (b) { const f = b.dataset.st, inp = sh.body.querySelector(`[data-sf=${f}]`); const cur = pnum(inp.value) ?? pnum(inp.placeholder) ?? 0; const n = Math.max(0, Math.round((cur + parseFloat(b.dataset.d)) * 100) / 100); inp.value = f === "r" ? Math.round(n) : fkg(n); beep("tick"); return; }
    const k = ev.target.closest("[data-k] button"); if (k) { for (const x of k.parentElement.children) x.setAttribute("aria-pressed", x === k); draft.k = k.dataset.v; return; }
    const r = ev.target.closest("[data-rir] button"); if (r) { for (const x of r.parentElement.children) x.setAttribute("aria-pressed", x === r); draft.rir = r.dataset.v === "–" ? null : r.dataset.v === "5+" ? 5 : +r.dataset.v; return; }
    const x = ev.target.closest("[data-sx]"); if (!x) return;
    if (x.dataset.sx === "ok") {
      const g = f => { const i = sh.body.querySelector(`[data-sf=${f}]`); return i ? i.value : null; };
      if (g("w") != null) s.w = pnum(g("w")); if (g("r") != null) s.r = g("r") === "" ? null : parseInt(g("r"));
      if (g("t") != null) s.t = parseTime(g("t")); if (g("d") != null) s.d = pnum(g("d")); if (g("tmin") != null) s.t = parseTime(g("tmin"), true);
      s.k = draft.k || "n"; s.rir = draft.rir ?? null; s.note = g("note").trim() || null;
      if (s.done) s.pr = checkPR(W, c.it, s);
      sh.close(); if (MODE === "live") save(); rerenderItem(c.ii);
    }
    if (x.dataset.sx === "dup") { sh.close(); copySet(c); }
    if (x.dataset.sx === "del") { sh.close(); deleteSet(c); }
  });
}

/* Übungs-Menü */
async function exMenu(c) {
  const ii = c.ii, it = c.it; const linked = it.grp && W.items[ii + 1] && W.items[ii + 1].grp === it.grp;
  const opts = [{ label: "Übung ersetzen", value: "swap" }];
  if (ii < W.items.length - 1) opts.push({ label: linked ? "Supersatz mit nächster lösen" : "Mit nächster als Supersatz verbinden", value: "link" });
  if (ii > 0) opts.push({ label: "Nach oben", value: "up" });
  if (ii < W.items.length - 1) opts.push({ label: "Nach unten", value: "down" });
  opts.push({ label: "Übung aus dem Training entfernen", value: "rm", cls: "danger" });
  const v = await ask(esc(EX(it.ex).name), "", opts);
  if (v === "swap") { const ids = await pickExercises({ single: true, title: "Ersetzen durch" }); if (ids[0]) { it.ex = ids[0]; for (const s of it.sets) if (!s.done) { s.w = null; s.r = null; } } }
  if (v === "link") { const n = W.items[ii + 1]; if (linked) { n.grp = null; if (!W.items.some((o, k) => k !== ii && o.grp === it.grp)) it.grp = null; } else { const g = it.grp || uid(); it.grp = g; n.grp = g; } }
  if (v === "up" || v === "down") { const j = v === "up" ? ii - 1 : ii + 1; [W.items[ii], W.items[j]] = [W.items[j], W.items[ii]]; }
  if (v === "rm") { const old = W.items.splice(ii, 1)[0]; toast("Übung entfernt", { action: "Rückgängig", onAction: () => { W.items.splice(ii, 0, old); if (MODE === "live") save(); renderWorkout(); } }); }
  if (v) { if (MODE === "live") save(); renderWorkout(); }
}

/* Aufwärmsätze */
function warmup(c) {
  const it = c.it, e = EX(it.ex); const sug = suggestion(it, W.id);
  const first = it.sets.find(s => s.k !== "a"); const ph = first ? placeholder(it, it.sets.indexOf(first), prevSets(it), sug) : null;
  const Wt = (first && first.w) || (ph && ph.w) || (sug && sug.w);
  if (!Wt) { toast("Trage zuerst dein Arbeitsgewicht im ersten Satz ein"); return; }
  const bar = e.geraet === "Langhantel" || e.geraet === "Multipresse" ? S.settings.stange : e.geraet === "SZ-Stange" ? 10 : 0;
  const step = exIncrement(e);
  const rnd = x => Math.max(bar, Math.round(x / step) * step);
  let list = Wt <= bar * 1.6 && bar ? [[bar, 10]] : [[0.4, 8], [0.6, 5], [0.8, 3]].map(([p, r]) => [rnd(Wt * p), r]);
  if (bar && Wt > bar * 2.2) list.unshift([bar, 10]);
  list = list.filter((x, i, a) => x[0] < Wt && (i === 0 || x[0] > a[i - 1][0]));
  if (!list.length) { toast("Das Gewicht ist zu leicht für Aufwärmsätze"); return; }
  it.sets = it.sets.filter(s => s.k !== "a" || s.done);
  const pos = it.sets.findIndex(s => s.k !== "a"); const at = pos < 0 ? it.sets.length : pos;
  it.sets.splice(at, 0, ...list.map(([w, r]) => ({ k: "a", w, r, done: false })));
  if (MODE === "live") save(); rerenderItem(c.ii);
  toast(list.length + " Aufwärmsätze: " + list.map(x => fkg(x[0])).join(" → ") + " kg. Sie zählen nicht für Rekorde.");
}

/* Scheibenrechner und Smart Plates */
const PLATE_COL = { 25: "#D83A3A", 20: "#2F6FDB", 15: "#E6B417", 10: "#2E9E4F", 5: "#E9EBEE", 2.5: "#30343B", 2: "#3A3F47", 1.25: "#A7ADB5", 1: "#8E949C", 0.5: "#C5CAD0" };
function platesFor(total, bar, plates) {
  let side = (total - bar) / 2; const out = [];
  if (side < 0) return { out, rest: side * 2 };
  for (const p of plates) { while (side >= p - 1e-9) { out.push(p); side -= p; } }
  return { out, rest: Math.round(side * 2 * 100) / 100 };
}
function plateSheet(c) {
  const it = c.it; let si = it.sets.findIndex(s => !s.done && s.k !== "a"); if (si < 0) si = it.sets.length - 1;
  const s = it.sets[si]; const ph = s ? placeholder(it, si, prevSets(it), suggestion(it, W.id)) : null;
  let bar = S.settings.stange, total = (s && s.w) || (ph && ph.w) || bar;
  const plates = S.settings.scheiben.slice().sort((a, b) => b - a);
  const sh = openSheet({ title: "Scheiben", sub: esc(EX(it.ex).name), body: "", foot: `<button class="btn big primary" data-p="ok">Übernehmen</button>` });
  const draw = () => {
    const { out, rest } = platesFor(total, bar, plates);
    const maxP = Math.max(...plates);
    const pl = out.map(p => `<span class="p" style="background:${PLATE_COL[p] || "#7C8798"};height:${40 + p / maxP * 70}px;${p === 5 || p === 0.5 || p === 1.25 ? "color:#333" : ""}">${fkg(p)}</span>`);
    sh.body.innerHTML = `<div class="stepper"><button data-p="minus" aria-label="weniger">−</button><input inputmode="decimal" data-p="tot" value="${fkg(total)}"><button data-p="plus" aria-label="mehr">+</button></div>
      <div class="card"><div class="plates">${pl.slice().reverse().join("")}<span class="sleeve"></span><span class="bar"></span><span class="sleeve"></span>${pl.join("")}</div>
      <div style="text-align:center" class="muted">${out.length ? "Pro Seite: <b style='color:var(--text)'>" + out.map(fkg).join(" + ") + "</b> kg" : total < bar ? "Weniger als die Stange" : "Nur die Stange"}${rest > 0.001 ? `<br><span style="color:var(--bad)">${fkg(rest)} kg lassen sich nicht darstellen</span>` : ""}</div></div>
      <div class="field"><span>Scheiben antippen (pro Seite, zählt doppelt)</span><div class="plate-pick">${plates.map(p => `<button data-add="${p}" style="background:${PLATE_COL[p] || "#7C8798"};${p === 5 || p === 0.5 || p === 1.25 ? "color:#333" : ""}">${fkg(p)}</button>`).join("")}</div></div>
      <div class="btns"><button class="btn" data-p="reset">Nur Stange</button><button class="btn" data-p="bar">Stange: ${fkg(bar)} kg</button></div>`;
    sh.body.querySelector("[data-p=tot]").onchange = ev => { total = pnum(ev.target.value) ?? total; draw(); };
  };
  draw();
  sh.el.addEventListener("click", async ev => {
    const a = ev.target.closest("[data-add]"); if (a) { total = Math.round((total + 2 * +a.dataset.add) * 100) / 100; beep("tick"); draw(); return; }
    const p = ev.target.closest("[data-p]"); if (!p) return;
    const step = plates[plates.length - 1] * 2;
    if (p.dataset.p === "minus") { total = Math.max(0, total - step); draw(); }
    if (p.dataset.p === "plus") { total += step; draw(); }
    if (p.dataset.p === "reset") { total = bar; draw(); }
    if (p.dataset.p === "bar") { const v = await ask("Gewicht der Stange", "", [20, 15, 10, 7.5, 0].map(x => ({ label: x ? fkg(x) + " kg" : "Ohne Stange", value: String(x) }))); if (v != null) { bar = +v; draw(); } }
    if (p.dataset.p === "ok") {
      const inp = sh.body.querySelector("[data-p=tot]"); total = pnum(inp.value) ?? total;
      for (let j = si; j < it.sets.length; j++) { const x = it.sets[j]; if (x.done || x.k === "a") continue; if (j === si || x.w == null) x.w = total; }
      if (MODE === "live") save(); sh.close(); rerenderItem(c.ii);
    }
  });
}

/* Stoppuhr für Zeitsätze */
let STOPW = null, stopT = 0;
function stopwatch(c, btn) {
  if (STOPW && STOPW.s === c.s) { c.s.t = Math.round((Date.now() - STOPW.t0) / 1000); STOPW = null; clearInterval(stopT); if (MODE === "live") save(); rerenderItem(c.ii); return; }
  STOPW = { it: c.it, s: c.s, t0: Date.now() }; clearInterval(stopT);
  stopT = setInterval(() => { const b = WS && WS.body.querySelector(".sw-btn.run"); if (b) b.textContent = fsec((Date.now() - STOPW.t0) / 1000); }, 250);
  rerenderItem(c.ii);
}

/* ---------- Pausen-Timer ---------- */
let restT = 0;
function startRest(sec, label) {
  if (!S.aktiv) return;
  S.aktiv.rest = { end: Date.now() + sec * 1000, total: sec, label, fired: false }; save();
  renderRest(); renderMini(); tickRest();
}
function adjustRest(d) { const r = S.aktiv && S.aktiv.rest; if (!r) return; r.end += d * 1000; r.total = Math.max(5, r.total + d); r.fired = false; save(); tickRest(); }
function stopRest() { if (S.aktiv) S.aktiv.rest = null; renderRest(); renderMini(); }
function renderRest() {
  if (!WS || !WS.foot) return;
  const r = MODE === "live" && S.aktiv && S.aktiv.rest;
  if (!r) { WS.foot.hidden = true; return; }
  WS.foot.hidden = false;
  WS.foot.innerHTML = `<div class="rest">${ring(1, 54, 6, "var(--accent)", "")}<div class="grow"><div class="big" data-rest>0:00</div><div class="lab ell">Pause · ${esc(r.label || "")}</div></div>
    <button class="btn sm" data-w="rest-minus" aria-label="15 Sekunden weniger">−15</button><button class="btn sm" data-w="rest-plus" aria-label="15 Sekunden mehr">+15</button>
    ${S.settings.kbPause ? `<button class="btn sm tint" data-w="rest-phone">iPhone</button>` : ""}<button class="btn sm primary" data-w="rest-skip">Weiter</button></div>`;
  tickRest();
}
function tickRest() {
  const r = S.aktiv && S.aktiv.rest; if (!r) return;
  const left = (r.end - Date.now()) / 1000;
  if (WS && WS.foot && !WS.foot.hidden) {
    const big = WS.foot.querySelector("[data-rest]"); if (big) big.textContent = left >= 0 ? fsec(Math.ceil(left)) : "+" + fsec(-left);
    const box = WS.foot.querySelector(".rest"); if (box) box.classList.toggle("over", left < 0);
    const arc = WS.foot.querySelector(".arc"); if (arc) { const C = +arc.getAttribute("stroke-dasharray"); arc.style.transition = "none"; arc.setAttribute("stroke-dashoffset", C * (1 - Math.max(0, left) / r.total)); arc.setAttribute("stroke", left < 0 ? "var(--good)" : "var(--accent)"); }
  }
  const mr = $("#minibar .rest"); if (mr) mr.textContent = left >= 0 ? fsec(Math.ceil(left)) : "Los!";
  if (left <= 0 && !r.fired) { r.fired = true; save(); beep("end"); toast("Pause vorbei. Nächster Satz!", { icon: "timer" }); }
  if (left < -120) stopRest();
}

/* Leiste unten, solange ein Training läuft */
function renderMini() {
  const m = $("#minibar");
  if (!S.aktiv || WS) { m.hidden = true; return; }
  const r = S.aktiv.rest;
  m.hidden = false;
  m.innerHTML = `<span class="pulse"></span><div class="grow"><b class="ell" style="display:block">${esc(S.aktiv.name)}</b><span class="tm" data-dur>${fsec((Date.now() - S.aktiv.start) / 1000)}</span></div>${r ? `<span class="rest">${fsec(Math.max(0, Math.ceil((r.end - Date.now()) / 1000)))}</span>` : ""}<span class="btn sm tint">Öffnen</span>`;
}
$("#minibar").addEventListener("click", openWorkout);
setInterval(() => {
  if (!S.aktiv) return;
  const d = fsec((Date.now() - S.aktiv.start) / 1000);
  for (const el of $$("[data-dur]")) if (MODE === "live" || !el.closest(".sheet")) el.textContent = d;
  tickRest();
}, 500);

/* Bildschirm anlassen */
let WL = null;
async function wakeLock() { if (!S.settings.wach || !WS || MODE !== "live") return releaseWake(); try { if (!WL && navigator.wakeLock) { WL = await navigator.wakeLock.request("screen"); WL.addEventListener("release", () => { WL = null; }); } } catch {} }
function releaseWake() { try { WL && WL.release(); } catch {} WL = null; }
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { wakeLock(); tickRest(); updateBadge(); } });

/* ---------- Training beenden ---------- */
function cleanItems(w) { for (const it of w.items) it.sets = it.sets.filter(s => s.done); w.items = w.items.filter(it => it.sets.length); }
async function finishWorkout() {
  const w = S.aktiv; const done = w.items.reduce((a, it) => a + it.sets.filter(s => s.done).length, 0);
  const open = w.items.reduce((a, it) => a + it.sets.filter(s => !s.done && (s.w != null || s.r != null || s.t || s.d)).length, 0);
  if (!done) { if (await ask("Noch keine Sätze abgehakt", "Ein Training ohne abgehakte Sätze wird nicht gespeichert.", [{ label: "Training verwerfen", cls: "danger" }])) { S.aktiv = null; stopRest(); save(); WS && WS.close(); rerender(); } return; }
  const v = await ask("Training beenden?", open ? `${open} ausgefüllte Sätze sind nicht abgehakt und werden nicht gespeichert.` : "", [{ label: "Beenden und speichern", cls: "primary", value: "end" }, ...(open ? [{ label: "Offene Sätze abhaken und beenden", value: "all" }] : [])]);
  if (!v) return;
  if (v === "all") for (const it of w.items) for (const s of it.sets) if (!s.done && (s.w != null || s.r != null || s.t || s.d)) { s.done = true; s.pr = checkPR(w, it, s); }
  w.end = Date.now(); delete w.rest; cleanItems(w);
  S.trainings.push(w); S.trainings.sort((a, b) => a.start - b.start); S.aktiv = null; save(true);
  if (w.routine) { const r = S.routinen.find(x => x.id === w.routine); if (r) r.zuletzt = w.end; }
  WS && WS.close(); releaseWake(); rerender(); updateBadge();
  setTimeout(() => summary(w), REDUCED.matches ? 0 : 260);
}
function saveEdit() {
  const w = W; cleanItems(w);
  for (const it of w.items) for (const s of it.sets) s.pr = checkPR(w, it, s);
  if (!w.end || w.end < w.start) w.end = w.start + 3600e3;
  const i = S.trainings.findIndex(x => x.id === w.id);
  if (!w.items.length) { if (i >= 0) S.trainings.splice(i, 1); }
  else if (i >= 0) S.trainings[i] = w; else S.trainings.push(w);
  S.trainings.sort((a, b) => a.start - b.start); save(true); WS && WS.close(); rerender(); toast(w.items.length ? "Training gespeichert" : "Leeres Training entfernt");
}
function summary(w) {
  const s = workoutStats(w);
  const prev = S.trainings.filter(x => x.id !== w.id && x.start < w.start && (w.routine ? x.routine === w.routine : x.name === w.name)).pop();
  const ps = prev ? workoutStats(prev) : null;
  const prs = []; for (const it of w.items) for (const x of it.sets) if (x.pr && x.pr.length) prs.push({ it, x });
  const d = (a, b) => b ? `<span class="badge ${a >= b ? "good" : "bad"}" style="margin-top:4px">${a >= b ? "+" : ""}${fmt((a / b - 1) * 100, 0)} %</span>` : "";
  const body = `<div style="text-align:center;padding:6px 0 4px"><div style="display:flex;justify-content:center">${ring(1, 96, 10, prs.length ? "var(--gold)" : "var(--good)", prs.length ? `<svg style="width:40px;height:40px;color:var(--gold)"><use href="#i-pokal"/></svg>` : `<svg style="width:40px;height:40px;color:var(--good)"><use href="#i-check"/></svg>`)}</div>
    <h2 style="font-size:24px;margin-top:12px;letter-spacing:-.02em">${prs.length ? prs.length + " neue Rekord" + (prs.length > 1 ? "e" : "") + "!" : "Stark gemacht!"}</h2><div class="muted">${esc(w.name)} · ${fdate(w.start, { wd: true, long: true })}</div></div>
    <div class="stats"><div class="stat"><div class="v">${Math.round(s.dauer / 6e4)}<small>min</small></div><div class="l">Dauer</div></div><div class="stat"><div class="v">${s.sets}</div><div class="l">Sätze ${ps ? d(s.sets, ps.sets) : ""}</div></div><div class="stat"><div class="v">${s.vol >= 10000 ? fmt(s.vol / 1000, 1) + "<small>t</small>" : fmt(s.vol, 0) + "<small>kg</small>"}</div><div class="l">Volumen ${ps ? d(s.vol, ps.vol) : ""}</div></div></div>
    ${prs.length ? `<div class="card"><div class="ct"><h3>Rekorde</h3></div>${prs.map(p => `<div class="row" style="padding:6px 0"><span class="ico" style="--c:var(--gold)">${ic("pokal")}</span><div class="grow"><b>${esc(EX(p.it.ex).name)}</b><div class="muted small">${prLabel(p.x.pr[0])} · ${setText(p.x, EX(p.it.ex).typ)}</div></div></div>`).join("")}</div>` : ""}
    <div class="card"><div class="ct"><h3>Übungen</h3></div>${w.items.map(it => { const e = EX(it.ex), st = itemStats(it); const l = S.trainings.filter(x => x.start < w.start).reverse().map(x => x.items.find(i => i.ex === it.ex)).find(Boolean); const ls = l ? itemStats(l) : null;
      return `<div class="row" style="padding:6px 0"><span class="dot" style="--c:${exColor(e)}"></span><div class="grow ell">${esc(e.name)}</div><span class="faint small">${st.sets}× ${st.bestSet ? setShort(st.bestSet, e.typ) : ""}</span>${ls && e.typ === "kg" && ls.best1 ? `<span class="badge ${st.best1 >= ls.best1 ? "good" : "bad"}">${st.best1 >= ls.best1 ? "↑" : "↓"}</span>` : ""}</div>`; }).join("")}</div>`;
  const sh = openSheet({ title: "Training gespeichert", body, foot: `<div class="btns"><button class="btn" data-z="share">${ic("teilen")}Teilen</button>${S.settings.kbHealth ? `<button class="btn tint" data-z="health">Health</button>` : ""}<button class="btn primary" data-z="ok" style="flex:1.4">Fertig</button></div>` });
  if (prs.length) beep("pr");
  sh.el.addEventListener("click", e => {
    const z = e.target.closest("[data-z]"); if (!z) return;
    if (z.dataset.z === "ok") sh.close();
    if (z.dataset.z === "share") shareImage(w);
    if (z.dataset.z === "health") runShortcut("Satzbuch Health", String(Math.max(1, Math.round(s.dauer / 6e4))));
  });
}

/* Zusammenfassung als Bild */
async function shareImage(w) {
  const s = workoutStats(w), c = document.createElement("canvas"), W0 = 1080, H0 = 1350; c.width = W0; c.height = H0;
  const g = c.getContext("2d"); const F = "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif";
  const grd = g.createLinearGradient(0, 0, W0, H0); grd.addColorStop(0, "#16181D"); grd.addColorStop(1, "#0E0F12"); g.fillStyle = grd; g.fillRect(0, 0, W0, H0);
  g.fillStyle = "#FF5A1F"; g.beginPath(); g.arc(W0 - 60, 60, 260, 0, Math.PI * 2); g.globalAlpha = .18; g.fill(); g.globalAlpha = 1;
  g.fillStyle = "#FF6A33"; g.font = `700 34px ${F}`; g.fillText("SATZBUCH", 80, 120);
  g.fillStyle = "#fff"; g.font = `800 76px ${F}`; g.fillText(w.name.slice(0, 22), 80, 220);
  g.fillStyle = "#A6AAB4"; g.font = `500 36px ${F}`; g.fillText(fdate(w.start, { wd: true, long: true, y: true }), 80, 280);
  const stats = [[Math.round(s.dauer / 6e4) + " min", "Dauer"], [String(s.sets), "Sätze"], [s.vol >= 10000 ? fmt(s.vol / 1000, 1) + " t" : fmt(s.vol, 0) + " kg", "Volumen"]];
  stats.forEach(([v, l], i) => { const x = 80 + i * 320; g.fillStyle = "#1F2228"; roundRect(g, x, 340, 290, 160, 28); g.fill(); g.fillStyle = "#fff"; g.font = `750 58px ${F}`; g.fillText(v, x + 28, 425); g.fillStyle = "#A6AAB4"; g.font = `500 30px ${F}`; g.fillText(l, x + 28, 470); });
  let y = 590;
  const prs = []; for (const it of w.items) for (const x of it.sets) if (x.pr && x.pr.length) prs.push({ it, x });
  if (prs.length) { g.fillStyle = "#F5B700"; g.font = `750 40px ${F}`; g.fillText("★ " + prs.length + " neue Rekord" + (prs.length > 1 ? "e" : ""), 80, y); y += 70; }
  for (const it of w.items.slice(0, prs.length ? 6 : 8)) {
    const e = EX(it.ex), st = itemStats(it);
    g.fillStyle = GRUPPE(e.muskel).c; g.beginPath(); g.arc(92, y - 12, 10, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#F2F2F4"; g.font = `600 38px ${F}`; g.fillText(e.name.slice(0, 26), 120, y);
    g.fillStyle = "#A6AAB4"; g.font = `500 34px ${F}`; g.textAlign = "right"; g.fillText(st.sets + " × " + (st.bestSet ? setShort(st.bestSet, e.typ).replace("×", " × ") : ""), W0 - 80, y); g.textAlign = "left";
    y += 72; if (y > H0 - 120) break;
  }
  g.fillStyle = "#70757F"; g.font = `500 28px ${F}`; g.fillText("Trainingstagebuch · Satzbuch", 80, H0 - 70);
  const blob = await new Promise(r => c.toBlob(r, "image/png"));
  const name = "Satzbuch-" + dayKey(w.start) + ".png";
  try { const f = new File([blob], name, { type: "image/png" }); if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f] }); return; } } catch (err) { if (err && err.name === "AbortError") return; }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => a.remove(), 1000);
}
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

/* Zahl am App-Symbol: Tage ohne Training */
function updateBadge() {
  try {
    if (!navigator.setAppBadge) return;
    const last = S.trainings[S.trainings.length - 1]; const d = last ? Math.floor((startOfDay(Date.now()) - startOfDay(last.start)) / DAY) : 0;
    if (last && d >= S.settings.erinnerung) navigator.setAppBadge(d); else navigator.clearAppBadge();
  } catch {}
}

/* ---------- Start ---------- */
(async function boot() {
  await loadState();
  applyTheme();
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);
  const p = new URLSearchParams(location.search).get("tab");
  showTab(["heute", "training", "uebungen", "verlauf", "ich"].includes(p) ? p : "heute");
  updateBadge();
  if (S.aktiv && new URLSearchParams(location.search).get("open") === "1") openWorkout();
  WIDE.addEventListener("change", () => { rerender(); });
  // Updates: beim Start und beim Zurückkehren prüfen; neue Version lädt die Seite neu
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then(reg => {
      reg.update().catch(() => {});
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") reg.update().catch(() => {}); });
    }).catch(() => {});
    const had = !!navigator.serviceWorker.controller; let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", async () => {
      if (!had || reloading) return;
      if (WS || sheets.length) { toast("Neue Version geladen. Sie gilt beim nächsten Öffnen."); return; }
      reloading = true; await flush(); location.reload();
    });
  }
})();
