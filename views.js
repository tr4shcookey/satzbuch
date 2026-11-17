/* Satzbuch – Ansichten: Heute, Training, Übungen, Verlauf, Ich */
"use strict";
let TAB = "heute";
const UI = { uebFilter: "alle", uebSuche: "", calM: null, chartMetric: {}, chartRange: {}, histFilter: {} };

function showTab(t, keepScroll) {
  TAB = t;
  for (const b of $$("#tabbar [data-tab]")) b.setAttribute("aria-current", b.dataset.tab === t ? "page" : "false");
  for (const v of $$(".view")) v.hidden = v.id !== "v-" + t;
  render(true);
  if (!keepScroll) scrollTo(0, 0);
}
$("#tabbar").addEventListener("click", e => { const b = e.target.closest("[data-tab]"); if (b) { if (TAB === b.dataset.tab) scrollTo({ top: 0, behavior: REDUCED.matches ? "auto" : "smooth" }); else showTab(b.dataset.tab); } });

function render(anim) {
  const v = $("#v-" + TAB);
  ({ heute: rHeute, training: rTraining, uebungen: rUebungen, verlauf: rVerlauf, ich: rIch })[TAB](v);
  if (anim) reveal(v);
  renderMini();
}
function rerender() { render(false); }

/* ---------- Heute ---------- */
function rHeute(v) {
  const now = new Date();
  const hour = now.getHours();
  const gruss = hour < 11 ? "Guten Morgen" : hour < 18 ? "Hallo" : "Guten Abend";
  const st = streak(), wk = weekCount(), goal = S.settings.wochenziel;
  const last = S.trainings[S.trainings.length - 1];
  const next = nextRoutine();
  let h = `<div class="vhead"><div><div class="sub">${now.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}</div><h1>${gruss}</h1></div></div>`;
  if (S.aktiv) {
    const a = S.aktiv, ws = workoutStats(a);
    h += `<div class="hero"><h2>Training läuft</h2><p>${esc(a.name)} · ${fdur(Date.now() - a.start)} · ${ws.sets} Sätze</p><button class="btn" data-act="open-workout">Weiter trainieren</button></div>`;
  } else {
    h += `<div class="hero"><h2>${next ? "Als Nächstes: " + esc(next.name) : "Bereit fürs Training?"}</h2><p>${next ? next.items.length + " Übungen · " + next.items.map(i => esc(EX(i.ex).name)).slice(0, 3).join(", ") + (next.items.length > 3 ? " …" : "") : "Starte leer und füge Übungen hinzu, oder wähle eine Routine."}</p>
      <div class="btns">${next ? `<button class="btn" data-act="start-routine" data-id="${next.id}">${ic("play")}Starten</button><button class="btn ghost" data-act="start-empty">Leer starten</button>` : `<button class="btn" data-act="start-empty">${ic("play")}Starten</button><button class="btn ghost" data-tab-go="training">Routinen</button>`}</div></div>`;
  }
  // Hinweise
  const hints = [];
  const since = last ? Math.floor((startOfDay(Date.now()) - startOfDay(last.start)) / DAY) : null;
  if (since != null && since >= S.settings.erinnerung && !S.aktiv) hints.push(`<div class="hint"><span class="ico" style="--c:var(--accent)">${ic("flamme")}</span><div><b>Seit ${since} Tagen kein Training</b><p>Ein kurzes Training reicht, um dranzubleiben.</p></div></div>`);
  const bk = S.settings.letzteSicherung;
  if (S.trainings.length && (!bk || Date.now() - bk > 7 * DAY) && !hintHidden("sicherung")) hints.push(`<div class="hint"><span class="ico" style="--c:#3B82F6">${ic("wolke")}</span><div class="grow"><b>Sicherung ${bk ? "ist " + Math.floor((Date.now() - bk) / DAY) + " Tage alt" : "fehlt noch"}</b><p>Speichere deine Daten in iCloud Drive, damit nichts verloren geht.</p><button class="btn sm tint" style="margin-top:8px" data-act="backup">Jetzt sichern</button></div><button class="x" data-act="hint-weg" data-h="sicherung" aria-label="Ausblenden">${ic("x")}</button></div>`);
  const dl = deloadHint();
  if (dl && !hintHidden("deload")) hints.push(`<div class="hint"><span class="ico" style="--c:#8B5CF6">${ic("blitz")}</span><div class="grow"><b>${dl.t}</b><p>${dl.p}</p></div><button class="x" data-act="hint-weg" data-h="deload" aria-label="Ausblenden">${ic("x")}</button></div>`);
  h += hints.join("");

  // Woche + Serie
  const ws0 = startOfWeek(Date.now());
  const days = new Set(trainDays());
  let strip = "";
  for (let i = 0; i < 7; i++) { const t = ws0 + i * DAY + 3600e3 * 12; const k = dayKey(t); strip += `<div><div class="wd">${WT[new Date(t).getDay()]}</div><div class="d ${days.has(k) ? "has" : ""} ${k === dayKey(Date.now()) ? "today" : ""}">${new Date(t).getDate()}</div></div>`; }
  const weekCard = `<div class="card"><div class="row" style="gap:16px">${ring(wk / goal, 84, 9, "var(--accent)", `${wk}/${goal}<small>Woche</small>`)}<div class="grow"><h3>Wochenziel</h3><div class="muted small">${wk >= goal ? "Geschafft! " : "Noch " + (goal - wk) + " Training" + (goal - wk === 1 ? "" : "s") + ". "}${weekStreak() > 1 ? weekStreak() + " Wochen in Folge erreicht." : ""}</div>
    <div class="row" style="margin-top:8px;gap:6px"><span class="badge acc">${ic("flamme")} Serie ${st.cur}</span><span class="badge">Rekord ${st.best}</span></div></div></div><div class="weekstrip" style="margin-top:14px">${strip}</div></div>`;

  // Muskeln diese Woche
  const ms = muscleSets(ws0, ws0 + 7 * DAY);
  const groups = {}; for (const [m, n] of Object.entries(ms)) { const g = window.SB_MUSKELN[m]?.g || "ganz"; groups[g] = (groups[g] || 0) + n; }
  const gmax = Math.max(10, ...Object.values(groups));
  const muscleCard = `<div class="card"><div class="ct"><h3>Sätze pro Muskelgruppe</h3><small>diese Woche</small></div>${Object.keys(groups).length ? `<div class="bars">${Object.entries(window.SB_GRUPPEN).filter(([g]) => groups[g]).sort((a, b) => (groups[b[0]] || 0) - (groups[a[0]] || 0)).map(([g, x]) => `<div class="bar-r"><span>${x.n}</span><div class="tr"><i style="--c:${x.c};width:${(groups[g] || 0) / gmax * 100}%"></i><span class="mk" style="left:${10 / gmax * 100}%"></span></div><span class="bv">${fmt(groups[g] || 0, 1)}</span></div>`).join("")}</div><div class="faint tiny" style="margin-top:10px">Nebenmuskeln zählen halb. Gestrichelt: 10 Sätze pro Woche als Orientierung.</div>` : `<div class="empty small">Diese Woche noch keine Sätze.</div>`}</div>`;

  // Letzte Rekorde
  const prs = [];
  for (let i = S.trainings.length - 1; i >= 0 && prs.length < 5; i--) {
    const w = S.trainings[i]; if (Date.now() - w.start > 30 * DAY) break;
    for (const it of w.items) for (const s of it.sets) if (s.pr && s.pr.length && prs.length < 5) prs.push({ w, it, s });
  }
  const prCard = `<div class="card"><div class="ct"><h3>Neue Rekorde</h3><small>30 Tage</small></div>${prs.length ? `<div>${prs.map(p => `<button class="li" style="padding-left:0;padding-right:0" data-act="ex-detail" data-id="${p.it.ex}"><span class="ico" style="--c:var(--gold)">${ic("pokal")}</span><div class="grow"><div class="t ell">${esc(EX(p.it.ex).name)}</div><div class="s">${prLabel(p.s.pr[0])} · ${setText(p.s, EX(p.it.ex).typ)}</div></div><span class="faint small">${ago(p.w.start)}</span></button>`).join("")}</div>` : `<div class="empty small">Hier erscheinen deine Bestleistungen.</div>`}</div>`;

  // Körpergewicht
  const kg = S.koerper.filter(k => k.gewicht).sort((a, b) => a.t - b.t);
  const bodyCard = `<div class="card"><div class="ct"><h3>Körpergewicht</h3><button class="btn sm tint" data-act="body-add">${ic("plus")}Eintragen</button></div>${kg.length ? `<div class="chart-big">${fmt(kg[kg.length - 1].gewicht, 1)} <small>kg · ${ago(kg[kg.length - 1].t)}</small></div>${kg.length > 1 ? lineChart(kg.slice(-30).map(k => ({ x: k.t, y: k.gewicht })), { h: 110, fmt: v => fmt(v, 1) + " kg", color: "#3B82F6" }) : ""}` : `<div class="faint small">Noch kein Eintrag.</div>`}</div>`;

  // Letztes Training
  const lastCard = last ? (() => { const s = workoutStats(last); return `<div class="card"><div class="ct"><h3>Letztes Training</h3><small>${ago(last.start)}</small></div><button class="li tap" style="padding:0" data-act="workout-detail" data-id="${last.id}"><div class="grow"><div class="t">${esc(last.name)}</div><div class="s">${fdur(s.dauer)} · ${s.sets} Sätze · ${fbig(s.vol)}${s.prs ? " · " + s.prs + " Rekord" + (s.prs > 1 ? "e" : "") : ""}</div></div>${ic("chev", "chev")}</button></div>`; })() : "";

  // Ziele
  const zielCard = S.ziele.length ? `<div class="card"><div class="ct"><h3>Ziele</h3><button class="btn sm plain" data-act="goals">Alle</button></div>${S.ziele.slice(0, 3).map(goalRow).join("")}</div>` : "";

  h += `<div class="wide2"><div class="col">${weekCard}${muscleCard}${lastCard}</div><div class="col">${prCard}${zielCard}${bodyCard}</div></div>`;
  if (!S.trainings.length && !S.aktiv) h += `<div class="card"><h3>So geht's los</h3><ol class="steps muted small" style="margin-top:8px"><li>Unter <b>Training</b> einen fertigen Plan übernehmen oder eine eigene Routine bauen.</li><li>Training starten, Sätze eintragen, mit ✓ abhaken. Die Pause läuft automatisch.</li><li>Unter <b>Ich → Daten</b> regelmäßig eine Sicherung in iCloud Drive speichern.</li><li>Am iPhone: Safari → Teilen → <b>Zum Home-Bildschirm</b>, dann startet das Satzbuch wie eine App.</li></ol></div>`;
  v.innerHTML = h;
}
const hintHidden = k => { const t = S.settings.hinweiseWeg[k]; return t && Date.now() - t < 3 * DAY; };
function nextRoutine() {
  if (!S.routinen.length) return null;
  const last = [...S.trainings].reverse().find(w => w.routine && S.routinen.some(r => r.id === w.routine));
  if (!last) return S.routinen[0];
  const r = S.routinen.find(x => x.id === last.routine);
  const same = S.routinen.filter(x => (x.ordner || "") === (r.ordner || ""));
  return same[(same.indexOf(r) + 1) % same.length];
}
function goalRow(g) {
  let p = 0, txt = "", sub = "";
  if (g.typ === "uebung") {
    const e = EX(g.ex), rec = records(g.ex), cur = g.mass === "1rm" ? rec.best1 : rec.maxW;
    p = cur / g.ziel; txt = esc(e.name) + ": " + fkg(g.ziel) + " kg " + (g.mass === "1rm" ? "(1RM)" : "");
    sub = "Aktuell " + fkg(Math.round(cur * 10) / 10) + " kg";
  } else if (g.typ === "gewicht") {
    const kg = S.koerper.filter(k => k.gewicht).sort((a, b) => a.t - b.t); const cur = kg.length ? kg[kg.length - 1].gewicht : null; const st = g.start ?? (kg[0] && kg[0].gewicht);
    p = cur == null || st == null || st === g.ziel ? 0 : (st - cur) / (st - g.ziel); txt = "Körpergewicht " + fmt(g.ziel, 1) + " kg"; sub = cur == null ? "Noch kein Eintrag" : "Aktuell " + fmt(cur, 1) + " kg";
  } else {
    const n = S.trainings.filter(w => w.start >= (g.seit || 0)).length; p = n / g.ziel; txt = g.ziel + " Trainings"; sub = n + " seit " + fdate(g.seit || Date.now(), { y: true });
  }
  if (g.bis) sub += " · bis " + fdate(g.bis, { y: true });
  return `<button class="li" style="padding-left:0;padding-right:0" data-act="goal-edit" data-id="${g.id}">${ring(p, 44, 6, p >= 1 ? "var(--good)" : "var(--accent)", `<span style="font-size:11px">${Math.min(999, Math.round(p * 100))}%</span>`)}<div class="grow"><div class="t ell">${txt}</div><div class="s">${sub}</div></div></button>`;
}

/* ---------- Training (Routinen und Pläne) ---------- */
function rTraining(v) {
  let h = `<div class="vhead"><div><h1>Training</h1></div><div class="acts"><button class="btn icon tint" data-act="routine-new" aria-label="Neue Routine">${ic("plus")}</button></div></div>`;
  h += S.aktiv ? `<button class="btn big primary" data-act="open-workout">${ic("play")}Laufendes Training öffnen</button>` : `<button class="btn big primary" data-act="start-empty">${ic("play")}Leeres Training starten</button>`;
  const folders = {};
  for (const r of S.routinen) (folders[r.ordner || ""] ||= []).push(r);
  if (!S.routinen.length) h += `<div class="card empty">${ic("hantel")}<b>Noch keine Routinen</b>Übernimm unten einen fertigen Plan oder baue mit + deine eigene.</div>`;
  for (const [f, rs] of Object.entries(folders)) {
    h += `<div class="sec-t">${f ? esc(f) : "Meine Routinen"}</div><div class="grid-r">${rs.map(routineCard).join("")}</div>`;
  }
  h += `<div class="sec-t">Fertige Pläne</div><div class="list">${window.SB_PLAENE.map(p => `<button class="li" data-act="plan" data-id="${p.id}"><span class="ico">${ic("hantel")}</span><div class="grow"><div class="t">${p.name}</div><div class="s">${p.ziel} · ${p.routinen.length} Routine${p.routinen.length > 1 ? "n" : ""}</div></div>${ic("chev", "chev")}</button>`).join("")}</div>`;
  v.innerHTML = h;
  $$(".grid-r", v).forEach(g => { g.style.display = "grid"; g.style.gap = "12px"; g.style.gridTemplateColumns = WIDE.matches ? "1fr 1fr" : "1fr"; });
}
function routineCard(r) {
  const last = [...S.trainings].reverse().find(w => w.routine === r.id);
  const col = r.farbe || "var(--accent)";
  return `<div class="card" style="border-top:4px solid ${col}"><div class="row sp"><div class="grow"><h3 class="ell">${esc(r.name)}</h3><div class="faint small">${r.items.length} Übungen · ${last ? "zuletzt " + ago(last.start) : "noch nie"}</div></div><button class="btn icon" data-act="routine-edit" data-id="${r.id}" aria-label="Bearbeiten">${ic("mehr")}</button></div>
    <div class="muted small" style="margin:8px 0 12px;line-height:1.5">${r.items.map(i => `${i.sets}× ${esc(EX(i.ex).name)}`).join(" · ")}</div>
    <button class="btn tint" style="width:100%" data-act="start-routine" data-id="${r.id}">${ic("play")}Starten</button></div>`;
}
function openPlan(id) {
  const p = window.SB_PLAENE.find(x => x.id === id);
  const body = `<p class="muted" style="margin:0">${p.text}</p>${p.routinen.map(r => `<div class="card"><h3>${r.name}</h3><table class="tb" style="margin-top:8px"><tr><th>Übung</th><th class="r">Sätze</th><th class="r">Wdh.</th><th class="r">Pause</th></tr>${r.items.map(i => `<tr><td style="font-family:var(--font)">${esc(EX(i.ex).name)}</td><td class="r">${i.sets}</td><td class="r">${i.reps}</td><td class="r">${fsec(i.rest)}</td></tr>`).join("")}</table></div>`).join("")}
    <p class="faint small">Die Wiederholungsbereiche (z. B. 8–12) nutzt die App für den Fortschrittsvorschlag: Schaffst du in allen Sätzen die obere Zahl, schlägt sie beim nächsten Mal mehr Gewicht vor.</p>`;
  const sh = openSheet({ title: p.name, sub: p.ziel, body, foot: `<button class="btn big primary" data-x="take">Zu meinen Routinen hinzufügen</button>` });
  sh.el.querySelector("[data-x=take]").onclick = () => {
    for (const r of p.routinen) S.routinen.push({ id: uid(), name: r.name, ordner: p.name, farbe: null, items: r.items.map(i => ({ ex: i.ex, sets: i.sets, reps: i.reps, rest: i.rest })) });
    save(); sh.close(); toast(p.routinen.length + " Routine" + (p.routinen.length > 1 ? "n" : "") + " hinzugefügt"); if (TAB !== "training") showTab("training"); else rerender();
  };
}
function editRoutine(id, preset) {
  const isNew = !id;
  const r = isNew ? (preset || { id: uid(), name: "", ordner: "", farbe: null, items: [] }) : JSON.parse(JSON.stringify(S.routinen.find(x => x.id === id)));
  const folders = [...new Set(S.routinen.map(x => x.ordner).filter(Boolean))];
  const sh = openSheet({ title: isNew ? "Neue Routine" : "Routine bearbeiten", full: true, body: "", foot: `<div class="btns">${isNew ? "" : `<button class="btn danger" data-x="del">${ic("papierkorb")}</button>`}<button class="btn primary" data-x="save" style="flex:3">Speichern</button></div>` });
  const draw = () => {
    sh.body.innerHTML = `<div class="form"><label class="field"><span>Name</span><input class="inp" data-f="name" value="${esc(r.name)}" placeholder="z. B. Push, Beine, Montag"></label>
      <label class="field"><span>Ordner (optional)</span><input class="inp" data-f="ordner" value="${esc(r.ordner || "")}" placeholder="z. B. Push/Pull/Beine" list="dl-ordner"><datalist id="dl-ordner">${folders.map(f => `<option value="${esc(f)}">`).join("")}</datalist></label>
      <div class="field"><span>Farbe</span>${colorPicker(r.farbe || "#FF5A1F")}</div></div>
      <div class="sec-t">Übungen</div>
      ${r.items.length ? r.items.map((it, i) => `<div class="card" style="padding:12px 14px;${it.grp ? "border-left:4px solid var(--accent)" : ""}" data-i="${i}">
        <div class="row"><span class="dot" style="--c:${exColor(EX(it.ex))}"></span><b class="grow ell">${esc(EX(it.ex).name)}</b>
        <button class="btn icon sm" data-x="up" aria-label="Nach oben" ${i ? "" : "disabled"}>${ic("hoch")}</button><button class="btn icon sm" data-x="down" aria-label="Nach unten" ${i < r.items.length - 1 ? "" : "disabled"}>${ic("down")}</button><button class="btn icon sm" data-x="rm" aria-label="Entfernen">${ic("x")}</button></div>
        <div class="row" style="margin-top:10px;gap:8px"><label class="field grow"><span>Sätze</span><input class="inp" inputmode="numeric" data-g="sets" value="${it.sets}"></label><label class="field grow"><span>Wdh. (z. B. 8-12)</span><input class="inp" data-g="reps" value="${esc(it.reps || "")}"></label><label class="field grow"><span>Pause (s)</span><input class="inp" inputmode="numeric" data-g="rest" value="${it.rest || ""}" placeholder="${S.settings.pause}"></label></div>
        ${i < r.items.length - 1 ? `<button class="btn sm ${it.grp && r.items[i + 1].grp === it.grp ? "tint" : ""}" style="margin-top:10px" data-x="link">${ic("link")}${it.grp && r.items[i + 1].grp === it.grp ? "Supersatz mit nächster lösen" : "Mit nächster als Supersatz"}</button>` : ""}
      </div>`).join("") : `<div class="faint small">Noch keine Übungen.</div>`}
      <button class="btn big tint" data-x="add">${ic("plus")}Übungen hinzufügen</button>`;
  };
  const read = () => {
    r.name = sh.body.querySelector("[data-f=name]").value.trim(); r.ordner = sh.body.querySelector("[data-f=ordner]").value.trim(); r.farbe = pickedColor(sh.body);
    $$("[data-i]", sh.body).forEach(c => { const it = r.items[+c.dataset.i]; it.sets = Math.max(1, parseInt(c.querySelector("[data-g=sets]").value) || 1); it.reps = c.querySelector("[data-g=reps]").value.trim(); it.rest = parseInt(c.querySelector("[data-g=rest]").value) || null; });
  };
  draw();
  sh.el.addEventListener("click", async e => {
    const b = e.target.closest("[data-x]"); if (!b) return;
    const x = b.dataset.x, card = b.closest("[data-i]"), i = card ? +card.dataset.i : -1;
    if (x !== "save" && x !== "del") read();
    if (x === "up" || x === "down") { const j = x === "up" ? i - 1 : i + 1; [r.items[i], r.items[j]] = [r.items[j], r.items[i]]; draw(); }
    else if (x === "rm") { r.items.splice(i, 1); draw(); }
    else if (x === "link") { const a = r.items[i], n = r.items[i + 1]; if (a.grp && n.grp === a.grp) { n.grp = null; if (!r.items.some((o, k) => k !== i && o.grp === a.grp)) a.grp = null; } else { const g = a.grp || uid(); a.grp = g; n.grp = g; } draw(); }
    else if (x === "add") { const ids = await pickExercises(); for (const id of ids) r.items.push({ ex: id, sets: 3, reps: EX(id).ziel || "", rest: null }); draw(); }
    else if (x === "save") {
      read(); if (!r.name) { toast("Bitte einen Namen eingeben"); return; }
      if (isNew) S.routinen.push(r); else S.routinen[S.routinen.findIndex(o => o.id === r.id)] = r;
      save(); sh.close(); rerender();
    } else if (x === "del") {
      if (await ask("Routine löschen?", "Deine bisherigen Trainings bleiben erhalten.", [{ label: "Löschen", cls: "danger" }])) {
        const idx = S.routinen.findIndex(o => o.id === r.id), old = S.routinen[idx]; S.routinen.splice(idx, 1); save(); sh.close(); rerender();
        toast("Routine gelöscht", { action: "Rückgängig", onAction: () => { S.routinen.splice(idx, 0, old); save(); rerender(); } });
      }
    }
  });
}

/* ---------- Übungen ---------- */
function exLast(id) { const h = hist(id)[0]; return h ? h.w.start : 0; }
function exCount(id) { return hist(id).length; }
function exFiltered(filter, q) {
  q = (q || "").trim().toLowerCase();
  let list = [...allEx().values()].filter(e => !e.versteckt);
  if (filter && filter !== "alle") {
    if (filter.startsWith("l:")) list = list.filter(e => (e.listen || []).includes(filter.slice(2)));
    else if (filter === "eigene") list = list.filter(e => !e.builtin);
    else if (filter === "benutzt") list = list.filter(e => exCount(e.id));
    else list = list.filter(e => (window.SB_MUSKELN[e.muskel]?.g || "ganz") === filter);
  }
  if (q) list = list.filter(e => (e.name + " " + muskelName(e.muskel) + " " + e.geraet).toLowerCase().includes(q));
  const sort = S.settings.sortUeb;
  if (sort === "az") list.sort((a, b) => a.name.localeCompare(b.name, "de"));
  else if (sort === "oft") list.sort((a, b) => exCount(b.id) - exCount(a.id) || a.name.localeCompare(b.name, "de"));
  else list.sort((a, b) => exLast(b.id) - exLast(a.id) || a.name.localeCompare(b.name, "de"));
  return list;
}
function filterChips(cur) {
  const c = [["alle", "Alle"], ["benutzt", "Benutzt"], ...Object.entries(window.SB_GRUPPEN).map(([k, g]) => [k, g.n, g.c]), ...S.listen.map(l => ["l:" + l.id, l.name, l.farbe]), ["eigene", "Eigene"]];
  return `<div class="chips">${c.map(([k, n, col]) => `<button class="chip" data-filter="${k}" aria-pressed="${cur === k}">${col ? `<span class="dot" style="--c:${col}"></span>` : ""}${esc(n)}</button>`).join("")}</div>`;
}
function exRow(e, extra = "") {
  const last = hist(e.id)[0];
  const st = last ? itemStats(last.it) : null;
  const sub = muskelName(e.muskel) + " · " + e.geraet + (last ? " · " + ago(last.w.start) + (st.bestSet ? " · " + setShort(st.bestSet, e.typ) : "") : "");
  return `<button class="li ind exrow" data-act="ex-detail" data-id="${e.id}" ${extra}><span class="dot lg" style="--c:${exColor(e)};background:var(--c)">${esc(e.name.slice(0, 2))}</span><div class="grow"><div class="t ell">${esc(e.name)}</div><div class="s ell">${sub}</div></div>${ic("chev", "chev")}</button>`;
}
function rUebungen(v) {
  const list = exFiltered(UI.uebFilter, UI.uebSuche);
  if (!v.querySelector(".uebhead")) {
    v.innerHTML = `<div class="uebhead"><div class="vhead"><div><h1>Übungen</h1></div><div class="acts"><button class="btn icon" data-act="lists" aria-label="Listen verwalten">${ic("liste")}</button><button class="btn icon tint" data-act="ex-new" aria-label="Neue Übung">${ic("plus")}</button></div></div>
      <div class="search" style="margin-top:6px">${ic("suche")}<input class="inp" type="search" placeholder="Übung suchen" data-f="suche" value="${esc(UI.uebSuche)}"></div>
      <div class="row sp" style="margin-top:10px"><div class="seg" style="flex:1;max-width:340px" data-seg="sort"><button data-v="zuletzt">Zuletzt</button><button data-v="az">A–Z</button><button data-v="oft">Häufigste</button></div></div>
      <div class="fchips" style="margin-top:10px"></div></div><div class="ueblist"></div>`;
    v.querySelector("[data-f=suche]").addEventListener("input", e => { UI.uebSuche = e.target.value; rUebungen(v); });
  }
  $$("[data-seg=sort] button", v).forEach(b => b.setAttribute("aria-pressed", b.dataset.v === S.settings.sortUeb));
  v.querySelector(".fchips").innerHTML = filterChips(UI.uebFilter);
  v.querySelector(".ueblist").innerHTML = list.length ? `<div class="faint small" style="margin:12px 4px 8px">${list.length} Übungen</div><div class="list">${list.map(e => exRow(e)).join("")}</div>` : `<div class="card empty" style="margin-top:12px">${ic("suche")}<b>Nichts gefunden</b><button class="btn tint" data-act="ex-new">Eigene Übung anlegen</button></div>`;
}
document.addEventListener("click", e => {
  const f = e.target.closest("[data-filter]"); if (f && f.closest("#v-uebungen")) { UI.uebFilter = f.dataset.filter; rUebungen($("#v-uebungen")); }
  const s = e.target.closest("[data-seg=sort] button"); if (s) { S.settings.sortUeb = s.dataset.v; save(); rUebungen($("#v-uebungen")); }
});

/* Übungen auswählen (mehrere) */
function pickExercises(opt = {}) {
  return new Promise(res => {
    const sel = []; let filt = "alle", q = "", out = [];
    const sh = openSheet({ title: opt.title || "Übungen hinzufügen", full: true, body: `<div class="search">${ic("suche")}<input class="inp" type="search" placeholder="Suchen" data-f="q"></div><div class="pchips"></div><div class="plist pick"></div>`,
      foot: `<div class="btns"><button class="btn" data-x="neu">${ic("plus")}Neue</button><button class="btn primary" data-x="ok" style="flex:2">Hinzufügen</button></div>`, onClose: () => res(out) });
    const draw = () => {
      sh.body.querySelector(".pchips").innerHTML = filterChips(filt);
      const list = exFiltered(filt, q);
      sh.body.querySelector(".plist").innerHTML = `<div class="list">${list.map(e => `<button class="li ind ${sel.includes(e.id) ? "sel" : ""}" data-pick="${e.id}"><span class="dot lg" style="--c:${exColor(e)};background:var(--c)">${esc(e.name.slice(0, 2))}</span><div class="grow"><div class="t ell">${esc(e.name)}</div><div class="s ell">${muskelName(e.muskel)} · ${e.geraet}</div></div><span class="tick">${sel.includes(e.id) ? ic("check") : ""}</span></button>`).join("")}</div>`;
      const ok = sh.el.querySelector("[data-x=ok]"); ok.textContent = sel.length ? (opt.single ? "Auswählen" : `${sel.length} hinzufügen`) : "Auswählen"; ok.disabled = !sel.length;
    };
    draw();
    sh.body.querySelector("[data-f=q]").addEventListener("input", e => { q = e.target.value; draw(); });
    sh.el.addEventListener("click", async e => {
      const fc = e.target.closest("[data-filter]"); if (fc) { filt = fc.dataset.filter; draw(); return; }
      const p = e.target.closest("[data-pick]");
      if (p) { const id = p.dataset.pick; if (opt.single) { sel.length = 0; sel.push(id); } else { const i = sel.indexOf(id); i >= 0 ? sel.splice(i, 1) : sel.push(id); } draw(); return; }
      const x = e.target.closest("[data-x]"); if (!x) return;
      if (x.dataset.x === "ok") { out = sel.slice(); sh.close(); }
      if (x.dataset.x === "neu") { const id = await editExercise(null, q); if (id) { sel.push(id); draw(); } }
    });
  });
}

/* Eigene Übung anlegen / Übung bearbeiten */
function editExercise(id, name = "") {
  return new Promise(res => {
    const e = id ? EX(id) : { name, muskel: "brust", neben: [], geraet: "Langhantel", typ: "kg", builtin: false };
    const own = !id || !e.builtin;
    let out = null;
    const opts = (o, cur) => o.map(([v, n]) => `<option value="${v}" ${v === cur ? "selected" : ""}>${n}</option>`).join("");
    const body = `<form class="form">
      ${own ? `<label class="field"><span>Name</span><input class="inp" data-f="name" value="${esc(e.name)}" required></label>
      <div class="two"><label class="field"><span>Muskel</span><select class="inp" data-f="muskel">${opts(Object.entries(window.SB_MUSKELN).map(([k, m]) => [k, m.n]), e.muskel)}</select></label>
      <label class="field"><span>Gerät</span><select class="inp" data-f="geraet">${opts(window.SB_GERAETE.map(g => [g, g]), e.geraet)}</select></label></div>
      <label class="field"><span>Erfassen als</span><select class="inp" data-f="typ">${opts([["kg", "Gewicht × Wiederholungen"], ["bw", "Wiederholungen (Körpergewicht, optional Zusatzgewicht)"], ["zeit", "Zeit (z. B. Plank)"], ["cardio", "Distanz + Zeit"]], e.typ)}</select></label>` : `<div class="muted small">${muskelName(e.muskel)} · ${e.geraet}. Mitgelieferte Übungen kannst du nicht umbenennen, aber anpassen.</div>`}
      <div class="two"><label class="field"><span>Pause (s)</span><input class="inp" inputmode="numeric" data-f="pause" value="${e.pause || ""}" placeholder="${S.settings.pause}"></label>
      <label class="field"><span>Gewichtsschritt (kg)</span><input class="inp" inputmode="decimal" data-f="schritt" value="${e.schritt ? fkg(e.schritt) : ""}" placeholder="${fkg(exIncrement({ ...e, schritt: 0 }))}"></label></div>
      <label class="field"><span>Ziel-Wiederholungen (für Vorschläge, z. B. 8-12)</span><input class="inp" data-f="ziel" value="${esc(e.ziel || "")}"></label>
      <label class="field"><span>Zusatzfeld (optional, z. B. Steigung %, Stufe, kcal)</span><input class="inp" data-f="extra" value="${esc(e.extra || "")}"></label>
      <div class="li" style="padding:0"><div class="grow"><div class="t">Nur Bestleistung erfassen</div><div class="s">Pro Training nur ein Satz, der beste.</div></div><label class="sw"><input type="checkbox" data-f="nurBest" ${e.nurBest ? "checked" : ""}><i></i></label></div>
      <div class="field"><span>Listen</span><div class="chips wrap">${S.listen.length ? S.listen.map(l => `<button type="button" class="chip" data-l="${l.id}" aria-pressed="${(e.listen || []).includes(l.id)}"><span class="dot" style="--c:${l.farbe}"></span>${esc(l.name)}</button>`).join("") : `<span class="faint small">Noch keine Listen. Lege sie unter Übungen → Listen an.</span>`}</div></div>
      <div class="field"><span>Farbe</span>${colorPicker(e.farbe || exColor(e))}</div>
      <label class="field"><span>Notiz</span><textarea class="inp" data-f="notiz" placeholder="z. B. Sitzhöhe 4, Griffbreite">${esc(e.notiz || "")}</textarea></label>
      ${id && own ? `<button type="button" class="btn danger" data-x="del">Übung löschen</button>` : ""}
      ${id && !own ? `<button type="button" class="btn" data-x="hide">${e.versteckt ? "Wieder anzeigen" : "In der Liste ausblenden"}</button>` : ""}
    </form>`;
    const sh = openSheet({ title: id ? "Übung bearbeiten" : "Neue Übung", full: true, body, foot: `<button class="btn big primary" data-x="save">Speichern</button>`, onClose: () => res(out) });
    sh.el.addEventListener("click", async ev => {
      const l = ev.target.closest("[data-l]"); if (l) { l.setAttribute("aria-pressed", l.getAttribute("aria-pressed") !== "true"); return; }
      const x = ev.target.closest("[data-x]"); if (!x) return;
      const g = f => sh.body.querySelector(`[data-f=${f}]`);
      if (x.dataset.x === "save") {
        const meta = { pause: parseInt(g("pause").value) || null, schritt: pnum(g("schritt").value), ziel: g("ziel").value.trim(), extra: g("extra").value.trim(), nurBest: g("nurBest").checked,
          listen: $$("[data-l][aria-pressed=true]", sh.body).map(b => b.dataset.l), farbe: pickedColor(sh.body), notiz: g("notiz").value.trim() };
        if (meta.farbe === GRUPPE(own ? g("muskel").value : e.muskel).c) meta.farbe = null;
        if (own) {
          const nm = g("name").value.trim(); if (!nm) { toast("Bitte einen Namen eingeben"); return; }
          const base = { name: nm, muskel: g("muskel").value, geraet: g("geraet").value, typ: g("typ").value, neben: e.neben || [] };
          if (id) { const o = S.eigene.find(z => z.id === id); Object.assign(o, base); }
          else { out = "u" + uid(); S.eigene.push({ id: out, ...base, builtin: false }); }
          setMeta(id || out, meta);
        } else setMeta(id, meta);
        if (id) out = id; save(true); sh.close(); rerender();
      }
      if (x.dataset.x === "del") {
        const used = hist(id).length;
        if (await ask("Übung löschen?", used ? `Sie kommt in ${used} Trainings vor. Diese bleiben erhalten, zeigen dann aber „Gelöschte Übung“.` : "", [{ label: "Löschen", cls: "danger" }])) {
          S.eigene = S.eigene.filter(z => z.id !== id); delete S.meta[id]; exChanged(); save(true); sh.close(); for (const s of [...sheets]) if (s.exId === id) s.close(); rerender();
        }
      }
      if (x.dataset.x === "hide") { setMeta(id, { versteckt: !e.versteckt }); sh.close(); rerender(); }
    });
  });
}
function manageLists() {
  const sh = openSheet({ title: "Listen", sub: "z. B. Montag, Zuhause, Programm", body: "" });
  const draw = () => {
    sh.body.innerHTML = `${S.listen.length ? `<div class="list">${S.listen.map(l => `<div class="li"><span class="dot" style="--c:${l.farbe}"></span><div class="grow t">${esc(l.name)}</div><span class="faint small">${[...allEx().values()].filter(e => (e.listen || []).includes(l.id)).length}</span><button class="btn icon sm" data-x="ren" data-id="${l.id}" aria-label="Umbenennen">${ic("notiz")}</button><button class="btn icon sm" data-x="del" data-id="${l.id}" aria-label="Löschen">${ic("papierkorb")}</button></div>`).join("")}</div>` : `<div class="faint small">Mit Listen ordnest du Übungen, z. B. nach Trainingstag oder Ort. Eine Übung kann in mehreren Listen sein.</div>`}
    <form class="form card"><input class="inp" placeholder="Neue Liste" data-f="n">${colorPicker("#3B82F6")}<button class="btn primary">Anlegen</button></form>`;
    sh.body.querySelector("form").onsubmit = e => { e.preventDefault(); const n = sh.body.querySelector("[data-f=n]").value.trim(); if (!n) return; S.listen.push({ id: uid(), name: n, farbe: pickedColor(sh.body) || "#3B82F6" }); save(); draw(); rerender(); };
  };
  draw();
  sh.body.addEventListener("click", async e => {
    const b = e.target.closest("[data-x]"); if (!b) return; const l = S.listen.find(x => x.id === b.dataset.id);
    if (b.dataset.x === "ren") { const n = await askText("Liste umbenennen", l.name); if (n) { l.name = n; save(); draw(); rerender(); } }
    if (b.dataset.x === "del" && await ask("Liste löschen?", "Die Übungen bleiben erhalten.", [{ label: "Löschen", cls: "danger" }])) { S.listen = S.listen.filter(x => x !== l); for (const m of Object.values(S.meta)) if (m.listen) m.listen = m.listen.filter(x => x !== l.id); exChanged(); save(); draw(); rerender(); }
  });
}

/* Übungsdetail: Verlauf, Diagramm, Rekorde, 1RM-Tabelle */
function exDetail(id) {
  const e = EX(id);
  const sh = openSheet({ title: esc(e.name), sub: muskelName(e.muskel) + " · " + e.geraet, full: true, right: `<button class="btn icon" data-x="edit" aria-label="Bearbeiten">${ic("zahnrad")}</button>`, body: "" });
  sh.exId = id;
  const draw = () => {
    const e = EX(id), hs = hist(id), rec = records(id), typ = e.typ;
    const metric = UI.chartMetric[id] || (typ === "kg" ? "1rm" : typ === "bw" ? "reps" : typ === "zeit" ? "zeit" : "dist");
    const range = UI.chartRange[id] || "alle";
    const metrics = typ === "kg" ? [["1rm", "1RM"], ["max", "Gewicht"], ["vol", "Volumen"], ["reps", "Wdh."]] : typ === "bw" ? [["reps", "Wdh."], ["vol", "Gesamt-Wdh."]] : typ === "zeit" ? [["zeit", "Zeit"]] : [["dist", "Distanz"], ["pace", "Tempo"]];
    const from = range === "3m" ? Date.now() - 91 * DAY : range === "1j" ? Date.now() - 365 * DAY : 0;
    let best = -Infinity;
    const pts = hs.filter(h => h.w.start >= from).slice().reverse().map(h => {
      const st = itemStats(h.it); const ws = h.it.sets.filter(isWork);
      const y = metric === "1rm" ? st.best1 : metric === "max" ? st.maxW : metric === "vol" ? (typ === "kg" ? st.vol : st.reps) : metric === "reps" ? Math.max(0, ...ws.map(s => s.r || 0)) : metric === "zeit" ? Math.max(0, ...ws.map(s => s.t || 0)) : metric === "dist" ? Math.max(0, ...ws.map(s => s.d || 0)) : (() => { const s = ws.find(z => z.d && z.t); return s ? s.t / 60 / s.d : 0; })();
      const hi = y > best && metric !== "pace"; if (hi) best = y;
      return { x: h.w.start, y, hi: false, _hi: hi };
    }).filter(p => p.y > 0);
    if (pts.length) { const mx = Math.max(...pts.map(p => p.y)); const p = pts.find(z => z.y === mx); if (metric !== "pace") p.hi = true; }
    const unit = { "1rm": " kg", max: " kg", vol: typ === "kg" ? " kg" : " Wdh.", reps: " Wdh.", zeit: "", dist: " km", pace: " min/km" }[metric];
    const ff = v => metric === "zeit" ? fsec(v) : metric === "pace" ? fsec(v * 60) + " min/km" : fmt(v, metric === "dist" ? 2 : 1) + unit;
    const cur = pts.length ? pts[pts.length - 1].y : null;

    let h = "";
    if (e.notiz) h += `<div class="exnote" style="margin:0">${esc(e.notiz)}</div>`;
    h += `<div class="card"><div class="seg" data-seg="metric">${metrics.map(([k, n]) => `<button data-v="${k}" aria-pressed="${k === metric}">${n}</button>`).join("")}</div>
      <div style="margin:14px 0 6px;flex-wrap:wrap" class="row sp"><div><div class="chart-big">${cur != null ? ff(cur) : "–"}</div><div class="faint tiny">zuletzt</div></div><div class="seg" data-seg="range" style="width:150px">${[["3m", "3 M"], ["1j", "1 J"], ["alle", "Alle"]].map(([k, n]) => `<button data-v="${k}" aria-pressed="${k === range}">${n}</button>`).join("")}</div></div>
      ${pts.length >= 2 ? lineChart(pts, { fmt: ff, h: 160 }) : `<div class="empty small">${pts.length ? "Ab zwei Trainings siehst du hier eine Kurve." : "Noch nicht trainiert."}</div>`}</div>`;

    // Rekorde
    if (rec.has) {
      const cells = typ === "kg" ? [["Geschätztes 1RM", fkg(Math.round(rec.best1 * 10) / 10) + " kg", rec.when.best1], ["Höchstes Gewicht", fkg(rec.maxW) + " kg", rec.when.maxW], ["Bester Satz (Volumen)", fbig(rec.maxVolSet)], ["Bestes Training (Volumen)", fbig(rec.sessVol)]]
        : typ === "bw" ? [["Meiste Wdh.", rec.maxR, rec.when.maxR], ["Max. Zusatzgewicht", rec.maxW ? fkg(rec.maxW) + " kg" : "–"]]
        : typ === "zeit" ? [["Längste Zeit", fsec(rec.maxT), rec.when.maxT]] : [["Weiteste Distanz", fmt(rec.maxD, 2) + " km", rec.when.maxD]];
      h += `<div class="sec-t">Rekorde</div><div class="grid2">${cells.map(c => `<div class="card stat" style="padding:14px"><div class="l">${c[0]}</div><div class="v" style="font-size:22px;margin-top:2px">${c[1]}</div>${c[2] ? `<div class="faint tiny">${fdate(c[2], { y: true })}</div>` : ""}</div>`).join("")}</div>`;
      if (typ === "kg") {
        const reps = Object.keys(rec.repExact).map(Number).sort((a, b) => a - b);
        h += `<div class="card"><div class="ct"><h3>Bestes Gewicht je Wiederholungszahl</h3></div><table class="tb"><tr><th>Wdh.</th><th class="r">Gewicht</th><th class="r">1RM daraus</th></tr>${reps.map(r => `<tr><td>${r}</td><td class="r">${fkg(rec.repExact[r])} kg</td><td class="r faint">${fkg(Math.round(e1rm(rec.repExact[r], r) * 10) / 10)} kg</td></tr>`).join("")}</table></div>`;
        const F = FORMELN[S.settings.formel] || FORMELN.epley;
        const pcts = [100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50];
        h += `<details class="card"><summary style="font-weight:650;cursor:pointer">1RM-Tabelle (${F.n})</summary><p class="faint small" style="margin:8px 0">Basis: geschätztes 1RM von ${fkg(Math.round(rec.best1 * 10) / 10)} kg. Die Formel änderst du unter Ich → Einstellungen. Schätzungen sind bei vielen Wiederholungen ungenauer.</p>
          <table class="tb"><tr><th>%</th><th class="r">Gewicht</th><th class="r">ca. Wdh.</th></tr>${pcts.map(p => { const r = p === 100 ? 1 : Math.max(1, Math.round(F.inv(p / 100))); return `<tr><td>${p} %</td><td class="r">${fkg(Math.round(rec.best1 * p / 100 / 0.5) * 0.5)} kg</td><td class="r faint">${isFinite(r) ? r : "–"}</td></tr>`; }).join("")}</table></details>`;
      }
    }
    // Verlauf mit Filter
    const hf = UI.histFilter[id] || "alle";
    const fr = { alle: [0, 999], "1-5": [1, 5], "6-10": [6, 10], "11-15": [11, 15], "16+": [16, 999] }[hf];
    h += `<div class="sec-t">Verlauf</div>`;
    if (typ === "kg" || typ === "bw") h += `<div class="chips" style="margin-bottom:10px">${["alle", "1-5", "6-10", "11-15", "16+"].map(k => `<button class="chip" data-hf="${k}" aria-pressed="${k === hf}">${k === "alle" ? "Alle Wdh." : k + " Wdh."}</button>`).join("")}</div>`;
    const rows = hs.map(({ w, it }) => {
      const ss = it.sets.filter(s => s.done && (s.k === "a" || (s.r || 0) >= fr[0] && (s.r || 0) <= fr[1] || typ === "zeit" || typ === "cardio"));
      if (!ss.some(isWork)) return "";
      const st = itemStats(it);
      return `<button class="li" data-act="workout-detail" data-id="${w.id}"><div class="grow"><div class="row sp"><span class="t">${fdate(w.start, { wd: true, y: true })}</span><span class="faint small">${typ === "kg" ? "1RM " + fkg(Math.round(st.best1 * 10) / 10) + " · " + fbig(st.vol) : ""}</span></div>
        <div class="hist-s">${ss.map(s => `<span class="${s.pr && s.pr.length ? "pr" : ""}">${s.k === "a" ? "<span class='faint'>A</span> " : s.k === "d" ? "D " : ""}<b>${setShort(s, typ)}</b>${s.rir != null ? " <span class='faint'>@" + s.rir + "</span>" : ""}${s.pr && s.pr.length ? " ★" : ""}</span>`).join("")}</div>${it.note ? `<div class="faint small" style="margin-top:4px">${esc(it.note)}</div>` : ""}</div></button>`;
    }).join("");
    h += rows ? `<div class="list">${rows}</div>` : `<div class="card empty small">Keine passenden Sätze.</div>`;
    if (e.hinweis) h += `<div class="card"><div class="ct"><h3>Ausführung</h3></div><div class="muted">${esc(e.hinweis)}</div></div>`;
    h += `<div class="sec-t">Notiz</div><textarea class="inp" data-f="notiz" placeholder="z. B. Sitzhöhe, Griff, Gefühl">${esc(e.notiz || "")}</textarea>`;
    sh.body.innerHTML = h;
    sh.body.querySelector("[data-f=notiz]").addEventListener("change", ev => { setMeta(id, { notiz: ev.target.value.trim() }); });
  };
  draw();
  sh.el.addEventListener("click", async ev => {
    const m = ev.target.closest("[data-seg=metric] button"); if (m) { UI.chartMetric[id] = m.dataset.v; draw(); return; }
    const r = ev.target.closest("[data-seg=range] button"); if (r) { UI.chartRange[id] = r.dataset.v; draw(); return; }
    const f = ev.target.closest("[data-hf]"); if (f) { UI.histFilter[id] = f.dataset.hf; draw(); return; }
    if (ev.target.closest("[data-x=edit]")) { await editExercise(id); if (!sh.closed && allEx().has(id)) { sh.el.querySelector(".sh h2").firstChild.textContent = EX(id).name; draw(); } }
  });
}

/* ---------- Verlauf ---------- */
function rVerlauf(v) {
  const now = new Date();
  if (!UI.calM) UI.calM = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const m0 = new Date(UI.calM), y = m0.getFullYear(), mo = m0.getMonth();
  const m1 = new Date(y, mo + 1, 1).getTime();
  const inMonth = S.trainings.filter(w => w.start >= UI.calM && w.start < m1);
  const byDay = {}; for (const w of inMonth) (byDay[dayKey(w.start)] ||= []).push(w);
  const first = (new Date(y, mo, 1).getDay() + 6) % 7, nd = new Date(y, mo + 1, 0).getDate();
  let cal = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map(d => `<div class="wd">${d}</div>`).join("");
  for (let i = 0; i < first; i++) cal += `<div class="d out"></div>`;
  for (let d = 1; d <= nd; d++) {
    const k = dayKey(new Date(y, mo, d).getTime()), ws = byDay[k] || [];
    const gs = [...new Set(ws.flatMap(w => w.items.filter(i => i.sets.some(isWork)).map(i => window.SB_MUSKELN[EX(i.ex).muskel]?.g || "ganz")))].slice(0, 3);
    cal += `<button class="d ${ws.length ? "has" : ""} ${k === dayKey(Date.now()) ? "today" : ""}" ${ws.length ? `data-act="workout-detail" data-id="${ws[0].id}"` : "disabled"}>${d}${gs.length ? `<span class="ds">${gs.map(g => `<i style="--c:${window.SB_GRUPPEN[g].c}"></i>`).join("")}</span>` : ""}</button>`;
  }
  const st = streak();
  let tot = { vol: 0, sets: 0, dauer: 0 }; for (const w of inMonth) { const s = workoutStats(w); tot.vol += s.vol; tot.sets += s.sets; tot.dauer += s.dauer; }
  let h = `<div class="vhead"><div><h1>Verlauf</h1></div><div class="acts"><button class="btn icon" data-act="add-past" aria-label="Training nachtragen">${ic("plus")}</button></div></div>
  <div class="wide2"><div class="col"><div class="card"><div class="row sp" style="margin-bottom:12px"><button class="btn icon" data-act="cal-prev" aria-label="Voriger Monat">${ic("chev-l")}</button><h3>${MON[mo]} ${y}</h3><button class="btn icon" data-act="cal-next" aria-label="Nächster Monat">${ic("chev")}</button></div><div class="cal">${cal}</div></div>
  <div class="stats"><div class="stat"><div class="v">${new Set(inMonth.map(w => dayKey(w.start))).size}</div><div class="l">Trainings</div></div><div class="stat"><div class="v">${tot.sets}</div><div class="l">Sätze</div></div><div class="stat"><div class="v">${tot.vol >= 10000 ? fmt(tot.vol / 1000, 1) + "<small>t</small>" : fmt(tot.vol, 0) + "<small>kg</small>"}</div><div class="l">Volumen</div></div></div>
  <div class="card row" style="gap:14px"><span class="ico" style="--c:var(--accent);width:40px;height:40px;border-radius:12px">${ic("flamme")}</span><div class="grow"><b>Serie: ${st.cur} Training${st.cur === 1 ? "" : "s"}</b><div class="muted small">Bis zu ${S.settings.ruhetage} Ruhetag${S.settings.ruhetage === 1 ? "" : "e"} dazwischen erlaubt. Längste Serie: ${st.best}.</div></div></div></div>
  <div class="col">`;
  h += inMonth.length ? `<div class="list">${inMonth.slice().reverse().map(workoutRow).join("")}</div>` : `<div class="card empty">${ic("kalender")}<b>Keine Trainings in diesem Monat</b></div>`;
  h += `</div></div>`;
  v.innerHTML = h;
}
function workoutRow(w) {
  const s = workoutStats(w);
  const gs = [...new Set(w.items.filter(i => i.sets.some(isWork)).map(i => window.SB_MUSKELN[EX(i.ex).muskel]?.g || "ganz"))];
  return `<button class="li" data-act="workout-detail" data-id="${w.id}"><div class="grow"><div class="row sp"><span class="t ell">${esc(w.name)}</span><span class="faint small">${fdate(w.start, { wd: true })}</span></div>
    <div class="s">${fdur(s.dauer)} · ${s.sets} Sätze · ${fbig(s.vol)}${s.prs ? ` · <span style="color:var(--gold-ink)">★ ${s.prs}</span>` : ""}</div>
    <div class="row" style="gap:4px;margin-top:6px">${gs.map(g => `<span class="dot" style="--c:${window.SB_GRUPPEN[g].c}" title="${window.SB_GRUPPEN[g].n}"></span>`).join("")}</div></div>${ic("chev", "chev")}</button>`;
}
function workoutDetail(id) {
  const w = S.trainings.find(x => x.id === id); if (!w) return;
  const s = workoutStats(w);
  const prev = S.trainings.filter(x => x.start < w.start && (w.routine ? x.routine === w.routine : x.name === w.name)).pop();
  const ps = prev ? workoutStats(prev) : null;
  const delta = (a, b) => b ? `<span class="badge ${a >= b ? "good" : "bad"}">${a >= b ? "+" : ""}${fmt((a / b - 1) * 100, 0)} %</span>` : "";
  let h = `<div class="stats four"><div class="stat"><div class="v">${Math.round(s.dauer / 6e4)}<small>min</small></div><div class="l">Dauer</div></div><div class="stat"><div class="v">${s.sets}</div><div class="l">Sätze</div></div><div class="stat"><div class="v">${s.vol >= 10000 ? fmt(s.vol / 1000, 1) + "<small>t</small>" : fmt(s.vol, 0)}</div><div class="l">Volumen kg ${ps ? delta(s.vol, ps.vol) : ""}</div></div><div class="stat"><div class="v" style="color:var(--gold-ink)">${s.prs}</div><div class="l">Rekorde</div></div></div>`;
  if (w.note) h += `<div class="exnote" style="margin:0">${esc(w.note)}</div>`;
  for (const it of w.items) {
    const e = EX(it.ex), ss = it.sets.filter(x => x.done); if (!ss.length) continue;
    const st = itemStats(it);
    h += `<button class="card" style="width:100%;text-align:left;display:block" data-act="ex-detail" data-id="${it.ex}"><div class="row sp"><b class="ell" style="color:var(--accent-ink)">${esc(e.name)}</b><span class="faint small">${e.typ === "kg" ? "1RM " + fkg(Math.round(st.best1 * 10) / 10) : ""}</span></div>
      <table class="tb" style="margin-top:6px">${ss.map((x, i) => `<tr><td style="width:36px" class="faint">${x.k === "a" ? "A" : x.k === "d" ? "D" : x.k === "v" ? "V" : it.sets.filter(z => z.done && z.k !== "a").indexOf(x) + 1}</td><td>${setText(x, e.typ)}${x.rir != null ? ` <span class="faint">· RIR ${x.rir}</span>` : ""}${x.x ? ` <span class="faint">· ${esc(e.extra || "Extra")} ${esc(x.x)}</span>` : ""}</td><td class="r">${x.pr && x.pr.length ? `<span class="badge gold">${ic("pokal")}${prLabel(x.pr[0])}</span>` : ""}</td></tr>${x.note ? `<tr><td></td><td colspan="2" class="faint small" style="border:0;padding-top:0;font-family:var(--font)">${esc(x.note)}</td></tr>` : ""}`).join("")}</table>${it.note ? `<div class="faint small" style="margin-top:6px">${esc(it.note)}</div>` : ""}</button>`;
  }
  h += `<div class="list"><button class="li" data-x="repeat"><span class="ico">${ic("play")}</span><span class="grow t">Nochmal trainieren</span></button><button class="li" data-x="share"><span class="ico" style="--c:#3B82F6">${ic("teilen")}</span><span class="grow t">Als Bild teilen</span></button><button class="li" data-x="routine"><span class="ico" style="--c:#14B8A6">${ic("liste")}</span><span class="grow t">Als Routine speichern</span></button><button class="li" data-x="edit"><span class="ico" style="--c:#7C8798">${ic("notiz")}</span><span class="grow t">Bearbeiten</span></button>${S.settings.kbHealth ? `<button class="li" data-x="health"><span class="ico" style="--c:#E5484D">${ic("heute")}</span><span class="grow t">In Apple Health eintragen</span></button>` : ""}<button class="li" data-x="del"><span class="ico" style="--c:var(--bad)">${ic("papierkorb")}</span><span class="grow t" style="color:var(--bad)">Löschen</span></button></div>`;
  const sh = openSheet({ title: esc(w.name), sub: fdate(w.start, { wd: true, long: true, y: true }) + ", " + new Date(w.start).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) + " Uhr", full: true, body: h });
  sh.el.addEventListener("click", async e => {
    const x = e.target.closest("[data-x]"); if (!x) return;
    const a = x.dataset.x;
    if (a === "repeat") { sh.close(); startWorkout({ fromWorkout: w }); }
    if (a === "share") shareImage(w);
    if (a === "health") runShortcut("Satzbuch Health", String(Math.max(1, Math.round(s.dauer / 6e4))));
    if (a === "routine") { sh.close(); editRoutine(null, { id: uid(), name: w.name, ordner: "", farbe: null, items: w.items.map(i => ({ ex: i.ex, sets: Math.max(1, i.sets.filter(isWork).length), reps: "", rest: i.rest || null, grp: i.grp || null })) }); }
    if (a === "edit") { sh.close(); editWorkout(w); }
    if (a === "del" && await ask("Training löschen?", "", [{ label: "Löschen", cls: "danger" }])) {
      const i = S.trainings.indexOf(w); S.trainings.splice(i, 1); save(true); sh.close(); rerender();
      toast("Training gelöscht", { action: "Rückgängig", onAction: () => { S.trainings.splice(i, 0, w); save(true); rerender(); } });
    }
  });
}

/* ---------- Ich ---------- */
function rIch(v) {
  const s = S.settings;
  const kg = S.koerper.filter(k => k.gewicht).sort((a, b) => a.t - b.t);
  const sw = (k, label, sub = "") => `<div class="li"><div class="grow"><div class="t">${label}</div>${sub ? `<div class="s">${sub}</div>` : ""}</div><label class="sw"><input type="checkbox" data-set="${k}" ${s[k] ? "checked" : ""}><i></i></label></div>`;
  const num = (k, label, unit, step = 1) => `<div class="li"><div class="grow t">${label}</div><input class="inp" style="width:92px;text-align:right;min-height:38px" inputmode="decimal" data-setn="${k}" value="${fkg(s[k])}"><span class="faint small" style="width:28px">${unit}</span></div>`;
  let h = `<div class="vhead"><div><h1>Ich</h1></div></div><div class="wide2"><div class="col">
  <div class="sec-t">Körper und Ziele</div><div class="list">
    <button class="li" data-act="body"><span class="ico" style="--c:#3B82F6">${ic("waage")}</span><div class="grow"><div class="t">Körpergewicht und Maße</div><div class="s">${kg.length ? fmt(kg[kg.length - 1].gewicht, 1) + " kg · " + ago(kg[kg.length - 1].t) : "Noch kein Eintrag"}</div></div>${ic("chev", "chev")}</button>
    <button class="li" data-act="goals"><span class="ico" style="--c:#22A447">${ic("ziel")}</span><div class="grow"><div class="t">Ziele</div><div class="s">${S.ziele.length ? S.ziele.length + " aktiv" : "z. B. 100 kg Bankdrücken"}</div></div>${ic("chev", "chev")}</button>
  </div>
  <div class="sec-t">Training</div><div class="list">
    ${num("wochenziel", "Trainings pro Woche (Ziel)", "")}
    ${num("pause", "Standard-Pause", "s")}
    ${sw("autoPause", "Pause automatisch starten", "Nach jedem abgehakten Satz")}
    ${sw("ton", "Ton am Ende der Pause")}
    ${sw("wach", "Bildschirm im Training anlassen")}
    ${sw("rir", "RIR erfassen", "Wie viele Wdh. wären noch gegangen?")}
    <div class="li"><div class="grow t">1RM-Formel</div><select class="inp" style="width:150px;min-height:38px" data-sets="formel">${Object.entries(FORMELN).map(([k, f]) => `<option value="${k}" ${k === s.formel ? "selected" : ""}>${f.n}</option>`).join("")}</select></div>
    ${num("ruhetage", "Ruhetage in einer Serie", "")}
    ${num("erinnerung", "Erinnern nach … Tagen ohne Training", "")}
  </div>
  <div class="sec-t">Scheibenrechner</div><div class="list">${num("stange", "Gewicht der Stange", "kg")}<div class="li"><div class="grow"><div class="t">Scheiben im Studio</div><div class="s">Mit Komma getrennt</div></div><input class="inp" style="width:170px;min-height:38px" data-sets="scheiben" value="${s.scheiben.map(fkg).join("; ")}"></div></div>
  </div><div class="col">
  <div class="sec-t">Erscheinungsbild</div><div class="card"><div class="seg" data-seg="theme">${[["auto", "Automatisch"], ["light", "Hell"], ["dark", "Dunkel"]].map(([k, n]) => `<button data-v="${k}" aria-pressed="${s.theme === k}">${n}</button>`).join("")}</div></div>
  <div class="sec-t">iPhone-Kurzbefehle</div><div class="list">
    ${sw("kbPause", "Pausen-Timer aufs iPhone", "Startet den Uhr-Timer, sichtbar auf dem Sperrbildschirm")}
    ${sw("kbHealth", "Training in Apple Health", "Nach dem Training per Kurzbefehl eintragen")}
    <button class="li" data-act="shortcuts"><span class="ico" style="--c:#8B5CF6">${ic("blitz")}</span><div class="grow t">Anleitung: Kurzbefehle einrichten</div>${ic("chev", "chev")}</button>
  </div>
  <div class="sec-t">Daten</div><div class="list">
    <button class="li" data-act="backup"><span class="ico" style="--c:#3B82F6">${ic("wolke")}</span><div class="grow"><div class="t">Sicherung speichern</div><div class="s">${s.letzteSicherung ? "Zuletzt " + ago(s.letzteSicherung) : "Noch nie gesichert"} · iCloud Drive</div></div></button>
    <button class="li" data-act="restore"><span class="ico" style="--c:#14B8A6">${ic("teilen")}</span><div class="grow"><div class="t">Sicherung laden</div><div class="s">z. B. vom anderen Gerät</div></div></button>
    <button class="li" data-act="csv"><span class="ico" style="--c:#22A447">${ic("liste")}</span><div class="grow"><div class="t">Als CSV exportieren</div><div class="s">Für Excel oder Numbers</div></div></button>
    <button class="li" data-act="wipe"><span class="ico" style="--c:var(--bad)">${ic("papierkorb")}</span><div class="grow t" style="color:var(--bad)">Alle Daten löschen</div></button>
  </div>
  <div class="card small muted"><b style="color:var(--text)">Satzbuch</b> · ${S.trainings.length} Trainings · ${S.trainings.reduce((a, w) => a + workoutStats(w).sets, 0)} Sätze<br>Deine Daten bleiben auf diesem Gerät. Zwischen iPhone und Mac überträgst du sie mit „Sicherung speichern“ und „Sicherung laden“ über iCloud Drive.</div>
  </div></div>`;
  v.innerHTML = h;
}
document.addEventListener("change", e => {
  const t = e.target;
  if (t.dataset.set) { S.settings[t.dataset.set] = t.checked; save(); if (t.dataset.set === "wach") wakeLock(); }
  if (t.dataset.setn) { const n = pnum(t.value); if (n != null && n >= 0) { S.settings[t.dataset.setn] = t.dataset.setn === "stange" ? n : Math.round(n); save(); } t.value = fkg(S.settings[t.dataset.setn]); }
  if (t.dataset.sets === "formel") { S.settings.formel = t.value; save(true); }
  if (t.dataset.sets === "scheiben") { const p = t.value.split(/[;\s]+/).map(pnum).filter(x => x > 0).sort((a, b) => b - a); if (p.length) { S.settings.scheiben = [...new Set(p)]; save(); } t.value = S.settings.scheiben.map(fkg).join("; "); }
});
document.addEventListener("click", e => { const b = e.target.closest("[data-seg=theme] button"); if (b) { S.settings.theme = b.dataset.v; applyTheme(); save(); flush(); rerender(); } });
function applyTheme() {
  const t = S.settings.theme; if (t === "auto") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  const dark = t === "dark" || (t === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  for (const m of $$("meta[name=theme-color]")) m.content = dark ? "#0E0F12" : "#F6F5F2";
}

/* Körpergewicht und Maße */
const MASSE = [["gewicht", "Gewicht", "kg"], ["fett", "Körperfett", "%"], ["bauch", "Bauch", "cm"], ["brust", "Brust", "cm"], ["arm", "Oberarm", "cm"], ["bein", "Oberschenkel", "cm"], ["huefte", "Hüfte", "cm"], ["wade", "Wade", "cm"]];
function bodySheet() {
  let metric = "gewicht";
  const sh = openSheet({ title: "Körper", sub: "Gewicht und Maße", full: true, body: "", foot: `<button class="btn big primary" data-x="add">${ic("plus")}Neuer Eintrag</button>` });
  const draw = () => {
    const list = S.koerper.filter(k => k[metric] != null).sort((a, b) => a.t - b.t);
    const m = MASSE.find(x => x[0] === metric);
    const first = list[0], last = list[list.length - 1];
    sh.body.innerHTML = `<div class="chips">${MASSE.map(([k, n]) => `<button class="chip" data-m="${k}" aria-pressed="${k === metric}">${n}</button>`).join("")}</div>
      <div class="card">${last ? `<div class="row sp"><div class="chart-big">${fmt(last[metric], 1)} <small>${m[2]}</small></div>${first !== last ? `<span class="badge ${last[metric] - first[metric] <= 0 ? "good" : "acc"}">${last[metric] - first[metric] > 0 ? "+" : ""}${fmt(last[metric] - first[metric], 1)} ${m[2]} seit ${fdate(first.t)}</span>` : ""}</div>${list.length > 1 ? lineChart(list.map(k => ({ x: k.t, y: k[metric] })), { fmt: v => fmt(v, 1) + " " + m[2], color: "#3B82F6" }) : ""}` : `<div class="empty small">Noch keine Werte für ${m[1]}.</div>`}</div>
      ${S.koerper.length ? `<div class="list">${S.koerper.slice().sort((a, b) => b.t - a.t).map(k => `<button class="li" data-k="${k.id}"><div class="grow"><div class="t">${fdate(k.t, { wd: true, y: true })}</div><div class="s">${MASSE.filter(x => k[x[0]] != null).map(x => x[1] + " " + fmt(k[x[0]], 1) + " " + x[2]).join(" · ")}</div></div>${ic("chev", "chev")}</button>`).join("")}</div>` : ""}`;
  };
  draw();
  sh.el.addEventListener("click", async e => {
    const c = e.target.closest("[data-m]"); if (c) { metric = c.dataset.m; draw(); return; }
    const k = e.target.closest("[data-k]"); if (k) { await bodyEntry(S.koerper.find(x => x.id === k.dataset.k)); draw(); return; }
    if (e.target.closest("[data-x=add]")) { await bodyEntry(); draw(); }
  });
}
function bodyEntry(k) {
  return new Promise(res => {
    const isNew = !k; k = k || { id: uid(), t: Date.now() };
    const d = new Date(k.t); const ds = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    const sh = openSheet({ title: isNew ? "Neuer Eintrag" : "Eintrag bearbeiten", body: `<form class="form"><label class="field"><span>Datum</span><input class="inp" type="date" data-f="t" value="${ds}"></label><div class="two">${MASSE.map(([f, n, u]) => `<label class="field"><span>${n} (${u})</span><input class="inp" inputmode="decimal" data-f="${f}" value="${k[f] != null ? fkg(k[f]) : ""}"></label>`).join("")}</div>
      <button class="btn big primary">Speichern</button>${isNew ? "" : `<button type="button" class="btn danger" data-x="del">Eintrag löschen</button>`}</form>`, onClose: () => res() });
    const f = sh.body.querySelector("form");
    setTimeout(() => isNew && f.querySelector("[data-f=gewicht]").focus(), 350);
    f.onsubmit = e => {
      e.preventDefault();
      const tv = f.querySelector("[data-f=t]").value; const t = tv ? new Date(tv + "T" + new Date().toTimeString().slice(0, 5)).getTime() : Date.now();
      const o = { id: k.id, t }; let any = false;
      for (const [x] of MASSE) { const n = pnum(f.querySelector(`[data-f=${x}]`).value); if (n != null) { o[x] = n; any = true; } }
      if (!any) { toast("Bitte mindestens einen Wert eintragen"); return; }
      const i = S.koerper.findIndex(z => z.id === k.id); if (i >= 0) S.koerper[i] = o; else S.koerper.push(o);
      save(); res(); sh.close(); rerender();
    };
    sh.body.addEventListener("click", e => { if (e.target.closest("[data-x=del]")) { S.koerper = S.koerper.filter(z => z.id !== k.id); save(); res(); sh.close(); rerender(); } });
  });
}

/* Ziele */
function goalsSheet() {
  const sh = openSheet({ title: "Ziele", full: true, body: "", foot: `<button class="btn big primary" data-x="add">${ic("plus")}Neues Ziel</button>` });
  const draw = () => { sh.body.innerHTML = S.ziele.length ? `<div class="card" style="padding:4px 16px">${S.ziele.map(goalRow).join("")}</div>` : `<div class="card empty">${ic("ziel")}<b>Noch keine Ziele</b>z. B. „Bankdrücken 100 kg bis Juni“ oder „50 Trainings“.</div>`; };
  draw();
  sh.el.addEventListener("click", async e => {
    const g = e.target.closest("[data-act=goal-edit]"); if (g) { e.stopPropagation(); await goalEdit(S.ziele.find(z => z.id === g.dataset.id)); draw(); return; }
    if (e.target.closest("[data-x=add]")) { await goalEdit(); draw(); }
  });
}
function goalEdit(g) {
  return new Promise(res => {
    const isNew = !g; g = g ? { ...g } : { id: uid(), typ: "uebung", ex: "bankdruecken", mass: "max", ziel: 100, bis: null, seit: Date.now() };
    const sh = openSheet({ title: isNew ? "Neues Ziel" : "Ziel bearbeiten", body: "", onClose: () => res() });
    const draw = () => {
      const bis = g.bis ? new Date(g.bis).toISOString().slice(0, 10) : "";
      sh.body.innerHTML = `<form class="form"><div class="seg" data-gt>${[["uebung", "Übung"], ["anzahl", "Trainings"], ["gewicht", "Körpergewicht"]].map(([k, n]) => `<button type="button" data-v="${k}" aria-pressed="${g.typ === k}">${n}</button>`).join("")}</div>
        ${g.typ === "uebung" ? `<button type="button" class="li tap card" style="padding:12px 14px" data-x="ex"><div class="grow"><div class="s">Übung</div><div class="t">${esc(EX(g.ex).name)}</div></div>${ic("chev", "chev")}</button>
          <div class="seg" data-gm>${[["max", "Gewicht"], ["1rm", "Geschätztes 1RM"]].map(([k, n]) => `<button type="button" data-v="${k}" aria-pressed="${g.mass === k}">${n}</button>`).join("")}</div>` : ""}
        <label class="field"><span>${g.typ === "anzahl" ? "Anzahl Trainings" : "Ziel (kg)"}</span><input class="inp" inputmode="decimal" data-f="ziel" value="${fkg(g.ziel)}"></label>
        <label class="field"><span>Bis (optional)</span><input class="inp" type="date" data-f="bis" value="${bis}"></label>
        <button class="btn big primary">Speichern</button>${isNew ? "" : `<button type="button" class="btn danger" data-x="del">Ziel löschen</button>`}</form>`;
      sh.body.querySelector("form").onsubmit = e => {
        e.preventDefault(); g.ziel = pnum(sh.body.querySelector("[data-f=ziel]").value) || 1; const b = sh.body.querySelector("[data-f=bis]").value; g.bis = b ? new Date(b + "T12:00").getTime() : null;
        if (g.typ === "gewicht" && g.start == null) { const kg = S.koerper.filter(k => k.gewicht).sort((a, b) => a.t - b.t); g.start = kg.length ? kg[kg.length - 1].gewicht : null; }
        const i = S.ziele.findIndex(z => z.id === g.id); if (i >= 0) S.ziele[i] = g; else S.ziele.push(g); save(); res(); sh.close(); rerender();
      };
    };
    draw();
    sh.body.addEventListener("click", async e => {
      const t = e.target.closest("[data-gt] button"); if (t) { g.typ = t.dataset.v; if (g.typ === "anzahl") g.ziel = 50; if (g.typ === "gewicht") { g.ziel = 75; g.start = null; } draw(); return; }
      const m = e.target.closest("[data-gm] button"); if (m) { g.mass = m.dataset.v; draw(); return; }
      if (e.target.closest("[data-x=ex]")) { const ids = await pickExercises({ single: true, title: "Übung wählen" }); if (ids[0]) { g.ex = ids[0]; draw(); } }
      if (e.target.closest("[data-x=del]")) { S.ziele = S.ziele.filter(z => z.id !== g.id); save(); res(); sh.close(); rerender(); }
    });
  });
}

/* Sicherung, CSV */
async function backup() {
  const d = new Date(); const name = `Satzbuch-Sicherung-${dayKey(d)}.json`;
  const data = JSON.stringify({ ...S, gespeichert: d.toISOString() });
  const r = await saveFile(name, data, "application/json");
  if (r === "ok") { S.settings.letzteSicherung = Date.now(); save(); rerender(); toast("Sicherung erstellt"); }
}
$("#file-in").addEventListener("change", async e => {
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    if (d.app !== "Satzbuch") throw 0;
    const n = (d.trainings || []).length;
    const ok = await ask("Sicherung laden?", `Die Datei enthält ${n} Trainings vom ${d.gespeichert ? fdate(d.gespeichert, { y: true }) : "unbekannten Datum"}. Die Daten auf diesem Gerät werden ersetzt.`, [{ label: "Ersetzen und laden", cls: "primary" }]);
    if (!ok) return;
    const keep = { theme: S.settings.theme };
    S = normalize(d); S.settings.theme = keep.theme; S.settings.letzteSicherung = Date.now(); exChanged(); save(true); await flush(); applyTheme(); showTab(TAB); renderMini(); toast("Sicherung geladen: " + n + " Trainings");
  } catch { toast("Das ist keine Satzbuch-Sicherung."); }
});
function toCsv() {
  const q = v => { const s = String(v ?? ""); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const n = (v, d = 2) => v == null ? "" : String(+(+v).toFixed(d)).replace(".", ",");
  const rows = [["Datum", "Uhrzeit", "Training", "Übung", "Muskel", "Satz", "Art", "Gewicht (kg)", "Wdh.", "Zeit (s)", "Distanz (km)", "RIR", "Zusatz", "1RM geschätzt (kg)", "Rekord", "Notiz"]];
  for (const w of S.trainings) for (const it of w.items) { const e = EX(it.ex); let i = 0; for (const s of it.sets) { if (!s.done) continue; if (s.k !== "a") i++;
    rows.push([dayKey(w.start), new Date(w.start).toTimeString().slice(0, 5), w.name, e.name, muskelName(e.muskel), s.k === "a" ? "A" : i, { n: "Normal", a: "Aufwärmen", d: "Dropsatz", v: "Bis Versagen" }[s.k || "n"], n(s.w), s.r ?? "", s.t ?? "", n(s.d), s.rir ?? "", s.x ?? "", e.typ === "kg" && s.w && s.r ? n(e1rm(s.w, s.r), 1) : "", (s.pr || []).join(", "), s.note || ""]); } }
  return "﻿" + rows.map(r => r.map(q).join(";")).join("\r\n");
}

/* Kurzbefehle */
function runShortcut(name, text) { location.href = "shortcuts://run-shortcut?name=" + encodeURIComponent(name) + "&input=text&text=" + encodeURIComponent(text); }
function shortcutsGuide() {
  openSheet({ title: "Kurzbefehle einrichten", sub: "Einmalig, dauert etwa 3 Minuten", full: true, body: `
  <p class="muted" style="margin:0">Eine Web-App darf keine Timer auf dem Sperrbildschirm zeigen und nicht in Apple Health schreiben. Die Kurzbefehle-App darf das. Das Satzbuch startet dafür zwei Kurzbefehle, die du einmal selbst anlegst.</p>
  <div class="card"><h3>1. „Satzbuch Pause“ (Timer auf dem Sperrbildschirm)</h3><ol class="steps small" style="margin-top:8px">
    <li>Öffne die App <b>Kurzbefehle</b> und tippe oben rechts auf <b>+</b>.</li>
    <li>Tippe oben auf den Namen und nenne den Kurzbefehl genau <b>Satzbuch Pause</b>.</li>
    <li>Suche die Aktion <b>Zahlen abrufen</b> (oder „Zahlen aus Eingabe abrufen“) und füge sie hinzu. Als Eingabe wählst du <b>Kurzbefehleingabe</b>.</li>
    <li>Suche die Aktion <b>Timer starten</b> (App Uhr). Tippe auf die Zahl, wähle die Variable <b>Zahlen</b> und stelle die Einheit auf <b>Sekunden</b>.</li>
    <li>Fertig. Schalte hier unter Ich den Punkt <b>Pausen-Timer aufs iPhone</b> ein. Im Training erscheint dann neben dem Pausen-Timer ein Knopf <b>iPhone</b>.</li></ol>
    <button class="btn tint" style="margin-top:6px" data-x="t-pause">Jetzt testen (30 Sekunden)</button></div>
  <div class="card"><h3>2. „Satzbuch Health“ (Training in Apple Health)</h3><ol class="steps small" style="margin-top:8px">
    <li>Neuen Kurzbefehl anlegen, Name genau <b>Satzbuch Health</b>.</li>
    <li>Aktion <b>Zahlen abrufen</b> mit Eingabe <b>Kurzbefehleingabe</b> (das ist die Dauer in Minuten).</li>
    <li>Aktion <b>Training protokollieren</b> (Bereich Health) hinzufügen. Typ: <b>Traditionelles Krafttraining</b>, Dauer: Variable <b>Zahlen</b> in Minuten, Start: <b>Aktuelles Datum</b>.</li>
    <li>Beim ersten Start fragt das iPhone nach der Erlaubnis für Health. Erlauben.</li>
    <li>Schalte hier den Punkt <b>Training in Apple Health</b> ein. Nach jedem Training erscheint dann der Knopf <b>In Apple Health eintragen</b>.</li></ol>
    <button class="btn tint" style="margin-top:6px" data-x="t-health">Jetzt testen (1 Minute)</button></div>
  <div class="card"><h3>Apple Watch</h3><p class="small muted" style="margin:6px 0 0">Öffne in der Kurzbefehle-App den Kurzbefehl „Satzbuch Pause“, tippe auf das ⓘ-Symbol und schalte <b>Auf Apple Watch zeigen</b> ein. Der Uhr-Timer klingelt dann auch an der Watch.</p></div>
  <p class="faint small">Gut zu wissen: Beim Start springt das iPhone kurz in die Kurzbefehle-App. Tippe danach oben links auf „Satzbuch“ oder wische zurück. Die Namen der Aktionen können je nach iOS-Version leicht abweichen. Ich konnte das nicht auf einem echten iPhone testen; sag mir Bescheid, falls etwas nicht passt.</p>
  <p class="faint tiny">Link-Format: <span class="code">shortcuts://run-shortcut?name=Satzbuch%20Pause&amp;input=text&amp;text=90</span></p>` }).el.addEventListener("click", e => {
    const x = e.target.closest("[data-x]"); if (!x) return;
    if (x.dataset.x === "t-pause") runShortcut("Satzbuch Pause", "30");
    if (x.dataset.x === "t-health") runShortcut("Satzbuch Health", "1");
  });
}

/* Training nachtragen */
async function addPast() {
  const sh = openSheet({ title: "Training nachtragen", body: `<form class="form"><label class="field"><span>Datum</span><input class="inp" type="date" data-f="d" value="${dayKey(Date.now() - DAY)}"></label><div class="two"><label class="field"><span>Beginn</span><input class="inp" type="time" data-f="s" value="18:00"></label><label class="field"><span>Dauer (min)</span><input class="inp" inputmode="numeric" data-f="m" value="60"></label></div><label class="field"><span>Name</span><input class="inp" data-f="n" value="Training"></label><button class="btn big primary">Weiter: Übungen eintragen</button></form>` });
  sh.body.querySelector("form").onsubmit = e => {
    e.preventDefault(); const g = f => sh.body.querySelector(`[data-f=${f}]`).value;
    const start = new Date(g("d") + "T" + (g("s") || "18:00")).getTime(); if (!isFinite(start)) return;
    const w = { id: uid(), name: g("n") || "Training", start, end: start + (parseInt(g("m")) || 60) * 6e4, items: [], note: "" };
    sh.close(); editWorkout(w, true);
  };
}

/* Zentrale Klick-Verteilung */
document.addEventListener("click", async e => {
  const t = e.target.closest("[data-tab-go]"); if (t) { showTab(t.dataset.tabGo); return; }
  const b = e.target.closest("[data-act]"); if (!b) return;
  const a = b.dataset.act, id = b.dataset.id;
  switch (a) {
    case "start-empty": startWorkout({}); break;
    case "start-routine": startWorkout({ routine: id }); break;
    case "open-workout": openWorkout(); break;
    case "routine-new": editRoutine(null); break;
    case "routine-edit": editRoutine(id); break;
    case "plan": openPlan(id); break;
    case "ex-detail": exDetail(id); break;
    case "ex-new": editExercise(null, UI.uebSuche); break;
    case "lists": manageLists(); break;
    case "workout-detail": workoutDetail(id); break;
    case "cal-prev": { const d = new Date(UI.calM); UI.calM = new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime(); rVerlauf($("#v-verlauf")); break; }
    case "cal-next": { const d = new Date(UI.calM); UI.calM = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime(); rVerlauf($("#v-verlauf")); break; }
    case "add-past": addPast(); break;
    case "body": bodySheet(); break;
    case "body-add": bodyEntry(); break;
    case "goals": goalsSheet(); break;
    case "goal-edit": goalEdit(S.ziele.find(z => z.id === id)); break;
    case "backup": backup(); break;
    case "restore": $("#file-in").click(); break;
    case "csv": { const r = await saveFile(`Satzbuch-Export-${dayKey(Date.now())}.csv`, toCsv(), "text/csv"); if (r === "ok") toast("CSV erstellt"); break; }
    case "shortcuts": shortcutsGuide(); break;
    case "hint-weg": S.settings.hinweiseWeg[b.dataset.h] = Date.now(); save(); rerender(); break;
    case "wipe": {
      if (await ask("Alle Daten löschen?", "Trainings, Routinen, eigene Übungen, Körperdaten und Ziele werden auf diesem Gerät gelöscht. Lege vorher eine Sicherung an.", [{ label: "Alles löschen", cls: "danger" }])) {
        const th = S.settings.theme; S = emptyState(); S.settings.theme = th; exChanged(); save(true); await flush(); stopRest(); showTab("heute"); toast("Alle Daten gelöscht");
      }
      break;
    }
  }
});
