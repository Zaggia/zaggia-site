import { ROME_PRESETS, centroid, distanceM, timeline } from "./geo.js";

const ROME = [41.8967, 12.4822];
const SYNC_MS = 3500;
const SESSION_KEY = "manhunt.session";
const NAME_KEY = "manhunt.name";

const $ = (sel) => document.querySelector(sel);
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const AUTO_HOLD_S = 5; // come AUTO_HOLD_MS nella funzione
const ROLE_LABEL = { hunter: "Cacciatore", runner: "Preda", referee: "Arbitro", caught: "Catturato" };
const ROLE_COUNT = {
  hunter: ["cacciatore", "cacciatori"],
  runner: ["preda", "prede"],
  referee: ["arbitro", "arbitri"],
  caught: ["catturato", "catturati"],
};
const countRole = (role, n) => `${n} ${ROLE_COUNT[role][n === 1 ? 0 : 1]}`;
const agoLabel = (at) => {
  const min = Math.round((now() - at) / 60000);
  return min < 1 ? "adesso" : `${min}′ fa`;
};

// ---------- Stato locale ----------
const app = {
  session: null, // { code, id, token }
  state: null, // ultima risposta del server
  clockOffset: 0,
  myPos: null, // { lat, lng, acc, at }
  geoError: null,
  syncTimer: null,
  syncing: false,
  edit: null, // { mode: "circle", center, radius } | { mode: "polygon", points }
  confirm: null, // azione in attesa di conferma
  seenEvents: null,
  lastDanger: null,
  wasOutside: false,
  fittedZone: null,
  wakeLock: null,
};

const storage = {
  get(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
  },
  set(key, value) {
    try { value == null ? localStorage.removeItem(key) : localStorage.setItem(key, JSON.stringify(value)); } catch {}
  },
};

async function api(action, body = {}) {
  const res = await fetch(`/api/${action}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...app.session, ...body }),
  });
  const data = await res.json().catch(() => ({ error: "Il server non ha risposto correttamente." }));
  if (!res.ok) {
    const err = new Error(data.error || "Qualcosa è andato storto.");
    err.status = res.status;
    throw err;
  }
  return data;
}

const now = () => Date.now() + app.clockOffset;

function fmtClock(ms) {
  if (ms == null || !Number.isFinite(ms)) return "";
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
const fmtTime = (t) => new Date(t).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
const fmtDist = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1).replace(".", ",")} km` : `${Math.round(m)} m`);
const initials = (name) => name.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

function toast(text, ms = 3200) {
  const el = $("#toast");
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (el.hidden = true), ms);
}

const vibrate = (pattern) => { try { navigator.vibrate?.(pattern); } catch {} };

// ---------- Home ----------
function showHome(error) {
  stopGame();
  $("#game").hidden = true;
  $("#home").hidden = false;
  const saved = storage.get(SESSION_KEY);
  $("#resume").hidden = !saved;
  if (saved) $("#resume-code").textContent = saved.code;
  $("#name").value = storage.get(NAME_KEY) ?? "";
  const fromUrl = new URLSearchParams(location.search).get("g");
  if (fromUrl) $("#code").value = fromUrl.toUpperCase().slice(0, 5);
  const err = $("#home-error");
  err.hidden = !error;
  err.textContent = error ?? "";
}

$("#home-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  let action = e.submitter?.value ?? "create";
  // Invio premuto nel campo codice: si entra, non si crea.
  if (document.activeElement === $("#code") && $("#code").value.trim()) action = "join";
  const name = $("#name").value.trim();
  const code = $("#code").value.trim().toUpperCase();
  const err = $("#home-error");
  err.hidden = true;
  if (!name) return showFormError("Scrivi il tuo nome.");
  if (action === "join" && code.length !== 5) return showFormError("Il codice ha 5 lettere.");
  storage.set(NAME_KEY, name);
  e.submitter && (e.submitter.disabled = true);
  try {
    app.session = null;
    const session = await api(action, { name, code });
    storage.set(SESSION_KEY, session);
    history.replaceState(null, "", `/?g=${session.code}`);
    startGame(session);
  } catch (ex) {
    showFormError(ex.message);
  } finally {
    e.submitter && (e.submitter.disabled = false);
  }
  function showFormError(msg) {
    err.textContent = msg;
    err.hidden = false;
  }
});
$("#code").addEventListener("input", (e) => (e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, "")));
$("#resume-btn").addEventListener("click", () => startGame(storage.get(SESSION_KEY)));
$("#resume-forget").addEventListener("click", () => {
  storage.set(SESSION_KEY, null);
  showHome();
});

// ---------- Mappa ----------
let map;
const layers = { zone: null, draft: null, markers: new Map(), accuracy: null };

function initMap() {
  if (map) return;
  map = L.map("map", { zoomControl: false, attributionControl: true }).setView(ROME, 14);
  // Tile OpenStreetMap (senza chiave); lo stile scuro arriva da un filtro CSS sulla classe "map-tiles".
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    className: "map-tiles",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
  map.on("click", onMapClick);
}

function zoneRing(zone) {
  if (zone.type === "polygon") return zone.points.map((p) => [p.lat, p.lng]);
  const { center, radius } = zone;
  const ring = [];
  const dLat = radius / 111320;
  const dLng = radius / (111320 * Math.cos((center.lat * Math.PI) / 180));
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * 2 * Math.PI;
    ring.push([center.lat + dLat * Math.sin(a), center.lng + dLng * Math.cos(a)]);
  }
  return ring;
}

function zoneAreaKm2(zone) {
  if (zone.type === "circle") return (Math.PI * zone.radius ** 2) / 1e6;
  const c = centroid(zone.points);
  const k = Math.cos((c.lat * Math.PI) / 180);
  const xy = zone.points.map((p) => [(p.lng - c.lng) * 111320 * k, (p.lat - c.lat) * 111320]);
  let a = 0;
  for (let i = 0, j = xy.length - 1; i < xy.length; j = i++) a += xy[j][0] * xy[i][1] - xy[i][0] * xy[j][1];
  return Math.abs(a / 2) / 1e6;
}

function drawZone(original, current) {
  const key = JSON.stringify([original, current]);
  if (layers.zone?.key === key) return;
  layers.zone?.group.remove();
  layers.zone = null;
  if (!original) return;
  const world = [[90, -180], [90, 180], [-90, 180], [-90, -180]];
  const group = L.layerGroup();
  const active = current ?? original;
  L.polygon([world, zoneRing(active)], {
    stroke: false, fillColor: "#000", fillOpacity: 0.5, interactive: false,
  }).addTo(group);
  if (current && JSON.stringify(current) !== JSON.stringify(original)) {
    L.polygon(zoneRing(original), {
      color: css("--muted"), weight: 1.5, dashArray: "4 6", fill: false, interactive: false,
    }).addTo(group);
  }
  L.polygon(zoneRing(active), {
    color: css("--hunter"), weight: 3, fill: false, interactive: false,
  }).addTo(group);
  group.addTo(map);
  layers.zone = { key, group };
}

function drawDraft() {
  layers.draft?.remove();
  layers.draft = null;
  const ed = app.edit;
  if (!ed) return;
  const group = L.layerGroup();
  const color = css("--runner");
  if (ed.mode === "circle" && ed.center) {
    L.circle([ed.center.lat, ed.center.lng], { radius: ed.radius, color, weight: 2, dashArray: "6 6", fillOpacity: 0.12 }).addTo(group);
    L.marker([ed.center.lat, ed.center.lng], { icon: L.divIcon({ className: "", html: '<div class="vertex"></div>', iconSize: [14, 14], iconAnchor: [7, 7] }), interactive: false }).addTo(group);
  }
  if (ed.mode === "polygon" && ed.points.length) {
    const ll = ed.points.map((p) => [p.lat, p.lng]);
    (ll.length >= 3 ? L.polygon(ll, { color, weight: 2, dashArray: "6 6", fillOpacity: 0.12 }) : L.polyline(ll, { color, weight: 2, dashArray: "6 6" })).addTo(group);
    ll.forEach((p) => L.marker(p, { icon: L.divIcon({ className: "", html: '<div class="vertex"></div>', iconSize: [14, 14], iconAnchor: [7, 7] }), interactive: false }).addTo(group));
  }
  group.addTo(map);
  layers.draft = group;
}

function onMapClick(e) {
  const ed = app.edit;
  if (!ed) return;
  const p = { lat: +e.latlng.lat.toFixed(6), lng: +e.latlng.lng.toFixed(6) };
  if (ed.mode === "circle") ed.center = p;
  else ed.points.push(p);
  drawDraft();
  renderSheet();
}

function fitZone(zone) {
  if (!zone) return;
  map.fitBounds(L.polygon(zoneRing(zone)).getBounds(), { paddingTopLeft: [20, 110], paddingBottomRight: [20, sheetHeight() + 20] });
}

function markerHtml(p, isMe) {
  const cls = ["pin", p.role];
  if (p.visibility === "ping") cls.push("ping");
  if (isMe) cls.push("me");
  if (!p.online && !isMe) cls.push("offline");
  let label = esc(isMe ? "Tu" : p.name);
  if (p.visibility === "ping") label += ` · ${agoLabel(p.pos.at)}`;
  return `<div class="${cls.join(" ")}"><div class="pin-core">${esc(initials(p.name))}</div><div class="pin-label">${label}</div></div>`;
}

function drawPlayers() {
  const s = app.state;
  const seen = new Set();
  for (const p of s.players) {
    const isMe = p.id === s.me.id;
    const pos = isMe && app.myPos ? app.myPos : p.pos;
    if (!pos) continue;
    seen.add(p.id);
    const html = markerHtml({ ...p, pos }, isMe);
    let m = layers.markers.get(p.id);
    if (!m) {
      m = L.marker([pos.lat, pos.lng], {
        icon: L.divIcon({ className: "", html, iconSize: [34, 34], iconAnchor: [17, 17] }),
        zIndexOffset: isMe ? 1000 : p.visibility === "ping" ? 0 : 500,
        keyboard: false,
      }).addTo(map);
      m.html = html;
      layers.markers.set(p.id, m);
    } else {
      m.setLatLng([pos.lat, pos.lng]);
      if (m.html !== html) {
        m.setIcon(L.divIcon({ className: "", html, iconSize: [34, 34], iconAnchor: [17, 17] }));
        m.html = html;
      }
    }
  }
  for (const [id, m] of layers.markers) {
    if (!seen.has(id)) {
      m.remove();
      layers.markers.delete(id);
    }
  }
  if (app.myPos) {
    const ll = [app.myPos.lat, app.myPos.lng];
    if (!layers.accuracy) layers.accuracy = L.circle(ll, { radius: app.myPos.acc || 0, color: "#fff", weight: 1, opacity: 0.4, fillOpacity: 0.06, interactive: false }).addTo(map);
    else layers.accuracy.setLatLng(ll).setRadius(app.myPos.acc || 0);
  }
}

$("#tool-me").addEventListener("click", () => {
  if (app.myPos) map.setView([app.myPos.lat, app.myPos.lng], Math.max(map.getZoom(), 16));
  else toast("Posizione non ancora disponibile.");
});
$("#tool-zone").addEventListener("click", () => {
  const z = app.state?.currentZone ?? app.state?.zone;
  z ? fitZone(z) : map.setView(ROME, 14);
});

// ---------- Posizione ----------
let geoWatch = null;
function startGeo() {
  if (geoWatch != null) return;
  if (!("geolocation" in navigator)) {
    app.geoError = "Questo browser non supporta la geolocalizzazione.";
    return renderAlerts();
  }
  geoWatch = navigator.geolocation.watchPosition(
    (pos) => {
      const first = !app.myPos;
      app.myPos = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: Math.round(pos.coords.accuracy), at: Date.now() };
      app.geoError = null;
      if (app.state) drawPlayers();
      renderAlerts();
      if (first) scheduleSync(0);
    },
    (err) => {
      app.geoError =
        err.code === err.PERMISSION_DENIED
          ? "Posizione bloccata. Consenti l'accesso alla posizione nelle impostazioni del browser e ricarica."
          : "Sto cercando il segnale GPS…";
      renderAlerts();
    },
    { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 },
  );
}
function stopGeo() {
  if (geoWatch != null) navigator.geolocation.clearWatch(geoWatch);
  geoWatch = null;
}

async function keepAwake() {
  try {
    if (document.visibilityState === "visible" && !app.wakeLock) {
      app.wakeLock = await navigator.wakeLock?.request("screen");
      app.wakeLock?.addEventListener("release", () => (app.wakeLock = null));
    }
  } catch {}
}
document.addEventListener("visibilitychange", () => {
  if (!app.session) return;
  if (document.visibilityState === "visible") {
    keepAwake();
    scheduleSync(0);
  }
});

// ---------- Ciclo di gioco ----------
function startGame(session) {
  if (!session) return showHome();
  app.session = { code: session.code, id: session.id, token: session.token };
  app.state = null;
  app.seenEvents = null;
  app.fittedZone = null;
  app.edit = null;
  app.confirm = null;
  $("#home").hidden = true;
  $("#game").hidden = false;
  initMap();
  map.invalidateSize();
  startGeo();
  keepAwake();
  scheduleSync(0);
  clearInterval(app.tick);
  app.tick = setInterval(renderHud, 1000);
}

function stopGame() {
  clearTimeout(app.syncTimer);
  clearInterval(app.tick);
  stopGeo();
  app.session = null;
  app.state = null;
  app.myPos = null;
  layers.markers.forEach((m) => m.remove());
  layers.markers.clear();
  layers.accuracy?.remove();
  layers.accuracy = null;
  layers.zone?.group.remove();
  layers.zone = null;
  layers.draft?.remove();
  layers.draft = null;
  app.wakeLock?.release?.();
}

function scheduleSync(delay = SYNC_MS) {
  clearTimeout(app.syncTimer);
  app.syncTimer = setTimeout(sync, delay);
}

async function sync() {
  if (!app.session || app.syncing) return;
  app.syncing = true;
  try {
    const pos = app.myPos && Date.now() - app.myPos.at < 60000 ? app.myPos : null;
    applyState(await api("sync", { pos }));
  } catch (err) {
    if (err.status === 403 || err.status === 404) {
      storage.set(SESSION_KEY, null);
      return showHome(err.message);
    }
    // Rete instabile: si riprova al prossimo giro.
  } finally {
    app.syncing = false;
    if (app.session) scheduleSync();
  }
}

async function act(action, body, okText) {
  try {
    const res = await api(action, body);
    if (res.players) applyState(res);
    if (okText) toast(okText);
    return res;
  } catch (err) {
    toast(err.message, 4500);
    return null;
  }
}

function applyState(s) {
  const prev = app.state;
  app.state = s;
  app.clockOffset = s.now - Date.now();

  // Nuovi eventi -> notifiche.
  const keyOf = (e) => `${e.kind}:${e.at}:${e.text}`;
  if (app.seenEvents) {
    const fresh = s.events.filter((e) => !app.seenEvents.has(keyOf(e)) && e.kind !== "outside");
    if (fresh.length) {
      toast(fresh[0].text, 4500);
      vibrate([120, 80, 120]);
    }
  }
  app.seenEvents = new Set(s.events.map(keyOf));

  if (prev && prev.phase !== s.phase) {
    app.confirm = null;
    if (s.phase !== "lobby") app.edit = null;
  }

  if (s.danger != null && (app.lastDanger == null || s.danger < app.lastDanger)) vibrate([300, 100, 300]);
  app.lastDanger = s.danger;
  const meP = s.players.find((p) => p.id === s.me.id);
  if (meP?.outside && !app.wasOutside) vibrate([500, 150, 500]);
  app.wasOutside = !!meP?.outside;

  const zoneKey = JSON.stringify(s.zone);
  if (s.zone && app.fittedZone !== zoneKey && !app.edit) {
    fitZone(s.zone);
    app.fittedZone = zoneKey;
  }

  drawZone(s.zone, s.currentZone);
  drawPlayers();
  renderHud();
  renderAlerts();
  renderCatchBar();
  renderSheet();
}

// ---------- HUD ----------
function nextPingAt(s, everyMin) {
  const every = everyMin * 60000;
  if (s.phase !== "hunt" || !every) return null;
  const t = timeline({ ...s, startedAt: s.timeline.startedAt });
  const tick = Math.floor((now() - t.huntStart) / every);
  return t.huntStart + (tick + 1) * every;
}

function renderHud() {
  const s = app.state;
  if (!s) return;
  $("#hud-code").textContent = s.code;
  const role = s.me.role;
  const badge = $("#hud-role");
  badge.className = `role-badge role-${role}`;
  badge.textContent = ROLE_LABEL[role];

  let phase = "";
  let timer = "";
  let note = "";
  const t = s.timeline;
  if (s.phase === "lobby") {
    phase = "In attesa";
    note = s.isHost ? "Disegna la zona, scegli i ruoli e inizia." : "L'host sta preparando la partita.";
  } else if (s.phase === "headstart") {
    phase = "Le prede scappano";
    timer = fmtClock(t.huntStart - now());
    note = role === "hunter" ? "Resta fermo: parti allo scadere del conto alla rovescia." : role === "runner" ? "Allontanati dai cacciatori!" : "Vantaggio iniziale per le prede.";
  } else if (s.phase === "hunt") {
    phase = "Caccia aperta";
    timer = fmtClock(t.endsAt - now());
    const preyPing = nextPingAt(s, s.settings.revealEveryMin);
    const hunterPing = s.settings.runnersSeeHunters ? null : nextPingAt(s, s.settings.hunterRevealEveryMin);
    if (role === "runner") {
      const bits = [];
      if (preyPing) bits.push(`La tua posizione verrà rivelata tra ${fmtClock(preyPing - now())}`);
      if (hunterPing) bits.push(`${bits.length ? "cacciatori" : "Cacciatori"} visibili tra ${fmtClock(hunterPing - now())}`);
      note = bits.join(" · ");
    } else if (role === "hunter") {
      if (preyPing) note = `Nuove posizioni delle prede tra ${fmtClock(preyPing - now())}`;
      if (hunterPing) note += `${note ? " · " : ""}le prede vedono te tra ${fmtClock(hunterPing - now())}`;
    }
    if (!note && !s.settings.revealEveryMin) note = "Prede in diretta per tutti.";
    if (s.settings.shrinkTo < 100) note += note ? " · la zona si restringe" : "La zona si restringe";
  } else {
    phase = s.winner === "hunters" ? "Vincono i cacciatori" : s.winner === "runners" ? "Vincono le prede" : "Partita finita";
  }
  $("#hud-phase").textContent = phase;
  $("#hud-timer").textContent = timer;
  $("#hud-note").textContent = note;
}

function renderAlerts() {
  const s = app.state;
  const danger = $("#alert-danger");
  const outside = $("#alert-outside");
  const gps = $("#alert-gps");
  gps.hidden = !app.geoError;
  gps.textContent = app.geoError ?? "";
  if (!s) return;
  const beingCaught = s.capturing != null;
  danger.hidden = s.danger == null && !beingCaught;
  danger.textContent = beingCaught
    ? `Ti stanno prendendo: ${s.capturing} s`
    : s.danger != null ? `Cacciatore a meno di ${s.danger} m!` : "";
  const meP = s.players.find((p) => p.id === s.me.id);
  outside.hidden = !meP?.outside;
  outside.textContent = s.settings.outsideReveal
    ? "Sei fuori zona: i cacciatori ti vedono in diretta. Rientra!"
    : "Sei fuori zona. Rientra!";
}

function renderCatchBar() {
  const s = app.state;
  const bar = $("#catch-bar");
  const list = s?.catchable ?? [];
  // Quando c'è qualcuno da catturare il pannello si chiude per lasciare spazio al pulsante.
  if (list.length && bar.hidden) sheet.classList.remove("open");
  bar.hidden = !list.length;
  const html = list
    .map((c) => `<button class="btn btn-primary catch-btn" type="button" data-catch="${esc(c.id)}">Cattura ${esc(c.name)} · ${c.dist} m</button>`)
    .join("");
  if (bar.dataset.html !== html) {
    bar.innerHTML = html;
    bar.dataset.html = html;
  }
}
$("#catch-bar").addEventListener("click", (e) => {
  const id = e.target.closest("[data-catch]")?.dataset.catch;
  if (id) act("catch", { target: id }).then((r) => r && vibrate(400));
});

$("#hud-code").addEventListener("click", shareGame);
async function shareGame() {
  const s = app.state;
  if (!s) return;
  const url = `${location.origin}/?g=${s.code}`;
  const text = `Entra nella mia partita di Manhunt Roma con il codice ${s.code}`;
  try {
    if (navigator.share) return await navigator.share({ title: "Manhunt Roma", text, url });
  } catch (err) {
    if (err?.name === "AbortError") return;
  }
  try {
    await navigator.clipboard.writeText(`${text}: ${url}`);
    toast("Link copiato negli appunti");
  } catch {
    toast(`Codice: ${s.code}`);
  }
}

// ---------- Pannello ----------
const sheet = $("#sheet");
const sheetHeight = () => (window.innerWidth >= 760 ? 0 : sheet.getBoundingClientRect().height);
new ResizeObserver(() => document.documentElement.style.setProperty("--sheet-h", `${sheetHeight()}px`)).observe(sheet);
$("#sheet-handle").addEventListener("click", () => sheet.classList.toggle("open"));

function setSection(key, html) {
  const body = $("#sheet-body");
  let el = body.querySelector(`[data-section="${key}"]`);
  if (!el) {
    el = document.createElement("div");
    el.dataset.section = key;
    el.className = "section";
    body.appendChild(el);
  }
  // Non si ridisegna una sezione mentre l'utente ci sta scrivendo.
  if (el.contains(document.activeElement) && document.activeElement.matches("input, select")) return el;
  if (el.dataset.html !== html) {
    el.innerHTML = html;
    el.dataset.html = html;
  }
  return el;
}

function renderSheet() {
  const s = app.state;
  if (!s) return;
  const sections = [];
  if (s.phase === "lobby") {
    if (s.isHost) sections.push(["start", hostStartHtml(s)], ["zone", zoneEditorHtml(s)], ["players", playersHtml(s, true)], ["rules", rulesFormHtml(s)]);
    else sections.push(["wait", waitHtml(s)], ["players", playersHtml(s, false)], ["rules", rulesSummaryHtml(s)]);
    sections.push(["leave", leaveHtml(s)]);
  } else if (s.phase === "ended") {
    sections.push(["result", resultHtml(s)], ["players", playersHtml(s, false)], ["events", eventsHtml(s)], ["leave", leaveHtml(s)]);
  } else {
    sections.push(["actions", gameActionsHtml(s)], ["players", playersHtml(s, false)], ["events", eventsHtml(s)], ["rules", rulesSummaryHtml(s)]);
  }
  const body = $("#sheet-body");
  const keys = sections.map(([k]) => k);
  for (const el of [...body.children]) if (!keys.includes(el.dataset.section)) el.remove();
  sections.forEach(([k, html], i) => {
    const el = setSection(k, html);
    if (body.children[i] !== el) body.insertBefore(el, body.children[i] ?? null);
  });
}

function hostStartHtml(s) {
  const hunters = s.players.filter((p) => p.baseRole === "hunter").length;
  const runners = s.players.filter((p) => p.baseRole === "runner").length;
  let problem = "";
  if (!s.zone) problem = "Disegna la zona di gioco per poter iniziare.";
  else if (!hunters) problem = "Serve almeno un cacciatore.";
  else if (!runners) problem = "Serve almeno una preda.";
  return `
    <div class="row" style="justify-content:space-between">
      <div><div class="eyebrow">Codice partita</div><div class="mono" style="font-size:24px;letter-spacing:.2em">${esc(s.code)}</div></div>
      <button class="btn btn-sm" type="button" data-action="share">Invita amici</button>
    </div>
    <button class="btn btn-primary btn-lg btn-block" type="button" data-action="start" ${problem ? "disabled" : ""}>Inizia partita</button>
    <p class="hint">${problem ? esc(problem) : `${countRole("hunter", hunters)} contro ${countRole("runner", runners)}.`}</p>`;
}

function zoneEditorHtml(s) {
  const ed = app.edit;
  const presetId = ROME_PRESETS.find((p) => JSON.stringify(p.zone) === JSON.stringify(s.zone))?.id;
  const presets = ROME_PRESETS.map(
    (p) => `<button class="chip preset ${p.id === presetId ? "active" : ""}" type="button" data-preset="${p.id}">${esc(p.name)}</button>`,
  ).join("");
  let body;
  if (!ed) {
    const desc = s.zone
      ? `${s.zone.type === "circle" ? `Cerchio di ${fmtDist(s.zone.radius)} di raggio` : `Poligono di ${s.zone.points.length} punti`} · ${zoneAreaKm2(s.zone).toFixed(2).replace(".", ",")} km²`
      : "Nessuna zona: scegline una qui sotto o disegnala.";
    body = `
      <p class="hint">${esc(desc)}</p>
      <div class="presets">${presets}</div>
      <div class="row">
        <button class="btn btn-sm" type="button" data-action="draw-circle">Disegna cerchio</button>
        <button class="btn btn-sm" type="button" data-action="draw-polygon">Disegna poligono</button>
      </div>`;
  } else if (ed.mode === "circle") {
    body = `
      <p class="hint">${ed.center ? "Tocca la mappa per spostare il centro." : "Tocca la mappa per mettere il centro della zona."}</p>
      <label class="field"><span class="label">Raggio · <span id="radius-val">${fmtDist(ed.radius)}</span></span>
        <input id="radius" type="range" min="200" max="5000" step="50" value="${ed.radius}"></label>
      <div class="row">
        <button class="btn btn-sm btn-runner" type="button" data-action="save-zone" ${ed.center ? "" : "disabled"}>Salva zona</button>
        <button class="btn btn-sm btn-ghost" type="button" data-action="cancel-zone">Annulla</button>
      </div>`;
  } else {
    body = `
      <p class="hint">Tocca la mappa per aggiungere i vertici. Punti: ${ed.points.length}${ed.points.length < 3 ? " (minimo 3)" : ""}.</p>
      <div class="row">
        <button class="btn btn-sm btn-runner" type="button" data-action="save-zone" ${ed.points.length >= 3 ? "" : "disabled"}>Salva zona</button>
        <button class="btn btn-sm" type="button" data-action="undo-point" ${ed.points.length ? "" : "disabled"}>Togli ultimo punto</button>
        <button class="btn btn-sm btn-ghost" type="button" data-action="cancel-zone">Annulla</button>
      </div>`;
  }
  return `<div class="section-head"><h3>Zona di gioco</h3></div>${body}`;
}

function playerStatus(s, p) {
  const bits = [];
  if (p.isHost) bits.push("host");
  if (!p.online) bits.push("offline");
  if (p.outside) bits.push("fuori zona");
  if (p.visibility === "ping" && p.pos) bits.push(`segnale ${agoLabel(p.pos.at)}`);
  if (p.id !== s.me.id && p.pos && app.myPos && s.phase !== "lobby") bits.push(fmtDist(distanceM(app.myPos, p.pos)));
  return bits.join(" · ");
}

function playersHtml(s, editable) {
  const order = { hunter: 0, runner: 1, caught: 2, referee: 3 };
  const players = [...s.players].sort((a, b) => order[a.role] - order[b.role] || a.name.localeCompare(b.name));
  const rows = players
    .map((p) => {
      const isMe = p.id === s.me.id;
      let controls = "";
      if (editable) {
        const seg = ["hunter", "runner", "referee"]
          .map((r) => `<button type="button" class="r-${r}" aria-pressed="${p.baseRole === r}" data-role="${r}" data-player="${esc(p.id)}">${ROLE_LABEL[r]}</button>`)
          .join("");
        controls = `<div class="seg">${seg}</div>${isMe ? "" : `<button class="btn btn-sm btn-ghost" type="button" data-kick="${esc(p.id)}" aria-label="Espelli ${esc(p.name)}">✕</button>`}`;
      } else if (s.isHost && s.phase === "hunt" && p.role === "caught") {
        controls = `<button class="btn btn-sm btn-ghost" type="button" data-uncatch="${esc(p.id)}">Annulla cattura</button>`;
      } else if (s.me.role === "referee" && s.phase === "hunt" && p.role === "runner") {
        controls = `<button class="btn btn-sm btn-danger" type="button" data-catch="${esc(p.id)}">Segna preso</button>`;
      }
      const status = playerStatus(s, p);
      return `<li class="player ${p.online ? "" : "offline"}">
        <span class="dot ${p.role}" title="${ROLE_LABEL[p.role]}"></span>
        <span class="player-name">${esc(p.name)}${isMe ? '<span class="tag">tu</span>' : ""}
          ${status ? `<div class="player-meta">${esc(status)}</div>` : ""}</span>
        ${controls}
      </li>`;
    })
    .join("");
  const counts = ["hunter", "runner", "caught", "referee"]
    .map((r) => [r, s.players.filter((p) => p.role === r).length])
    .filter(([, n]) => n)
    .map(([r, n]) => countRole(r, n))
    .join(" · ");
  const shuffle = editable && s.players.length > 1 ? `<button class="btn btn-sm" type="button" data-action="shuffle">Ruoli a caso</button>` : "";
  return `<div class="section-head"><h3>Giocatori</h3>${shuffle}</div>
    <p class="hint">${esc(counts)}</p>
    <ul class="players">${rows}</ul>`;
}

const SETTING_FIELDS = [
  ["durationMin", "Durata caccia (min)", 5, 600],
  ["headStartMin", "Vantaggio prede (min)", 0, 60],
  ["revealEveryMin", "Segnale prede ogni (min, 0 = diretta)", 0, 60],
  ["hunterRevealEveryMin", "Segnale cacciatori ogni (min, 0 = mai)", 0, 60],
  ["catchRadiusM", "Distanza cattura (m)", 5, 200],
  ["dangerRadiusM", "Allarme vicinanza (m, 0 = off)", 0, 2000],
  ["shrinkTo", "Zona finale (% , 100 = fissa)", 10, 100],
];
const SETTING_TOGGLES = [
  ["runnersSeeHunters", "Le prede vedono i cacciatori sempre in diretta"],
  ["autoCatch", `Cattura automatica: preso dopo ${AUTO_HOLD_S} s entro la distanza`],
  ["outsideReveal", "Chi esce dalla zona viene mostrato in diretta"],
  ["infection", "Infezione: chi viene preso diventa cacciatore"],
];

function rulesFormHtml(s) {
  const fields = SETTING_FIELDS.map(
    ([k, label, min, max]) => `<label class="setting"><span class="label">${label}</span>
      <input id="set-${k}" type="number" inputmode="numeric" min="${min}" max="${max}" value="${s.settings[k]}" data-setting="${k}"></label>`,
  ).join("");
  const toggles = SETTING_TOGGLES.map(
    ([k, label]) => `<label class="toggle"><input id="set-${k}" type="checkbox" data-setting="${k}" ${s.settings[k] ? "checked" : ""}>${label}</label>`,
  ).join("");
  return `<div class="section-head"><h3>Regole</h3></div><div class="settings">${fields}${toggles}</div>`;
}

function rulesSummaryHtml(s) {
  const st = s.settings;
  const items = [
    ["Durata", `${st.durationMin} min`],
    ["Vantaggio", `${st.headStartMin} min`],
    ["Segnale prede", st.revealEveryMin ? `ogni ${st.revealEveryMin} min` : "in diretta"],
    ["Cattura entro", `${st.catchRadiusM} m`],
    ["Allarme", st.dangerRadiusM ? `${st.dangerRadiusM} m` : "spento"],
    ["Zona", st.shrinkTo < 100 ? `si riduce al ${st.shrinkTo}%` : "fissa"],
    ["Segnale cacciatori", st.runnersSeeHunters ? "in diretta" : st.hunterRevealEveryMin ? `ogni ${st.hunterRevealEveryMin} min` : "nascosti"],
    ["Cattura", st.autoCatch ? `automatica (${AUTO_HOLD_S} s)` : "con pulsante"],
    ["Infezione", st.infection ? "sì" : "no"],
  ];
  return `<div class="section-head"><h3>Regole</h3></div>
    <dl class="rules-summary">${items.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>`;
}

function waitHtml(s) {
  const host = s.players.find((p) => p.isHost)?.name ?? "l'host";
  return `<div class="section-head"><h3>Sala d'attesa</h3><button class="btn btn-sm" type="button" data-action="share">Invita</button></div>
    <p class="hint">Sei ${s.me.role === "referee" ? "arbitro" : s.me.role === "hunter" ? "cacciatore" : "una preda"}. ${esc(host)} sta preparando zona e ruoli.${s.zone ? "" : " Zona non ancora scelta."}</p>`;
}

function gameActionsHtml(s) {
  const role = s.me.role;
  const parts = [];
  if (role === "runner" && s.phase === "hunt") {
    parts.push(
      app.confirm === "surrender"
        ? `<div class="confirm"><strong>Confermi di essere stato catturato?</strong>
            <div class="row"><button class="btn btn-primary" type="button" data-action="surrender-yes">Sì, mi hanno preso</button>
            <button class="btn btn-ghost" type="button" data-action="confirm-no">No</button></div></div>`
        : `<button class="btn btn-danger btn-block" type="button" data-action="surrender">Mi hanno preso</button>`,
    );
  }
  if (role === "caught") parts.push(`<p class="hint">Sei stato catturato. Ora vedi tutti i giocatori.</p>`);
  if (role === "hunter" && s.phase === "hunt" && !s.catchable.length) {
    parts.push(
      s.settings.autoCatch
        ? `<p class="hint">Cattura automatica: resta entro ${s.settings.catchRadiusM} m da una preda per ${AUTO_HOLD_S} secondi. Se serve, compare anche il pulsante.</p>`
        : `<p class="hint">Avvicinati entro ${s.settings.catchRadiusM} m da una preda: comparirà il pulsante per catturarla.</p>`,
    );
  }
  if (s.isHost) {
    parts.push(
      app.confirm === "stop"
        ? `<div class="confirm"><strong>Terminare la partita per tutti?</strong>
            <div class="row"><button class="btn btn-primary" type="button" data-action="stop-yes">Termina</button>
            <button class="btn btn-ghost" type="button" data-action="confirm-no">Annulla</button></div></div>`
        : `<button class="btn btn-ghost btn-sm" type="button" data-action="stop">Termina partita</button>`,
    );
  }
  return parts.join("") || `<p class="hint">Buona caccia.</p>`;
}

function resultHtml(s) {
  const cls = s.winner ?? "none";
  const title = s.winner === "hunters" ? "Vincono i cacciatori" : s.winner === "runners" ? "Vincono le prede" : "Partita terminata";
  const t = s.timeline;
  const played = t && s.endedAt ? fmtClock(s.endedAt - t.startedAt) : "";
  const caught = s.catches.length;
  const host = s.isHost
    ? `<div class="row"><button class="btn btn-primary" type="button" data-action="reset">Nuova partita</button>
        ${app.confirm === "delete"
          ? `<button class="btn btn-danger" type="button" data-action="delete-yes">Conferma: cancella tutto</button>`
          : `<button class="btn btn-ghost" type="button" data-action="delete">Chiudi e cancella</button>`}</div>`
    : "";
  return `<div class="result ${cls}"><h2>${title}</h2>
    <p class="hint">Durata ${played} · ${caught} ${caught === 1 ? "cattura" : "catture"}</p></div>${host}`;
}

function eventsHtml(s) {
  if (!s.events.length) return "";
  const items = s.events
    .map((e) => `<li class="ev-${e.kind}"><time class="mono">${fmtTime(e.at)}</time><span>${esc(e.text)}</span></li>`)
    .join("");
  return `<div class="section-head"><h3>Cronaca</h3></div><ul class="events">${items}</ul>`;
}

function leaveHtml(s) {
  if (s.isHost) {
    if (s.phase === "ended") return "";
    return app.confirm === "delete"
      ? `<div class="confirm"><strong>Cancellare la partita per tutti?</strong>
          <div class="row"><button class="btn btn-primary" type="button" data-action="delete-yes">Cancella</button>
          <button class="btn btn-ghost" type="button" data-action="confirm-no">Annulla</button></div></div>`
      : `<button class="btn btn-ghost btn-sm" type="button" data-action="delete">Chiudi la partita</button>`;
  }
  return `<button class="btn btn-ghost btn-sm" type="button" data-action="leave">Esci dalla partita</button>`;
}

// Delegazione eventi del pannello.
$("#sheet-body").addEventListener("click", async (e) => {
  const s = app.state;
  const t = e.target.closest("button");
  if (!t || !s) return;

  if (t.dataset.preset) {
    const preset = ROME_PRESETS.find((p) => p.id === t.dataset.preset);
    const res = await act("config", { zone: preset.zone }, `Zona: ${preset.name}`);
    if (res) fitZone(preset.zone);
    return;
  }
  if (t.dataset.role) {
    return act("config", { roles: { [t.dataset.player]: t.dataset.role } });
  }
  if (t.dataset.kick) return act("kick", { target: t.dataset.kick }, "Giocatore espulso");
  if (t.dataset.uncatch) return act("uncatch", { target: t.dataset.uncatch }, "Cattura annullata");
  if (t.dataset.catch) return act("catch", { target: t.dataset.catch });

  const action = t.dataset.action;
  switch (action) {
    case "share": return shareGame();
    case "start": return act("start", {}, "Si parte! Le prede hanno il vantaggio.");
    case "draw-circle": {
      const z = s.zone?.type === "circle" ? s.zone : null;
      const c = map.getCenter();
      app.edit = { mode: "circle", center: z?.center ?? { lat: c.lat, lng: c.lng }, radius: z?.radius ?? 1000 };
      break;
    }
    case "draw-polygon":
      app.edit = { mode: "polygon", points: [] };
      break;
    case "undo-point":
      app.edit.points.pop();
      break;
    case "cancel-zone":
      app.edit = null;
      break;
    case "save-zone": {
      const ed = app.edit;
      const zone = ed.mode === "circle" ? { type: "circle", center: ed.center, radius: ed.radius } : { type: "polygon", points: ed.points };
      if (await act("config", { zone }, "Zona salvata")) {
        app.edit = null;
        fitZone(zone);
      }
      break;
    }
    case "shuffle": {
      const pool = s.players.filter((p) => p.baseRole !== "referee").map((p) => p.id);
      const hunters = Math.max(1, Math.min(pool.length - 1, s.players.filter((p) => p.baseRole === "hunter").length || 1));
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      const roles = Object.fromEntries(pool.map((id, i) => [id, i < hunters ? "hunter" : "runner"]));
      return act("config", { roles }, "Ruoli mescolati");
    }
    case "surrender":
    case "stop":
    case "delete":
      app.confirm = action;
      break;
    case "confirm-no":
      app.confirm = null;
      break;
    case "surrender-yes":
      app.confirm = null;
      await act("catch", { target: s.me.id });
      break;
    case "stop-yes":
      app.confirm = null;
      await act("stop");
      break;
    case "reset":
      app.confirm = null;
      await act("reset", {}, "Nuova partita: stesse regole e zona");
      break;
    case "delete-yes":
      if (await act("delete")) {
        storage.set(SESSION_KEY, null);
        showHome();
      }
      return;
    case "leave":
      if (await act("leave")) {
        storage.set(SESSION_KEY, null);
        showHome();
      }
      return;
    default:
      return;
  }
  drawDraft();
  renderSheet();
});

$("#sheet-body").addEventListener("input", (e) => {
  if (e.target.id === "radius" && app.edit?.mode === "circle") {
    app.edit.radius = Number(e.target.value);
    $("#radius-val").textContent = fmtDist(app.edit.radius);
    drawDraft();
  }
});

$("#sheet-body").addEventListener("change", (e) => {
  const key = e.target.dataset.setting;
  if (!key) return;
  const value = e.target.type === "checkbox" ? e.target.checked : Number(e.target.value);
  act("config", { settings: { [key]: value } }).then(() => {
    // Il campo potrebbe essere stato corretto dal server (limiti min/max).
    e.target.blur();
    renderSheet();
  });
});

// ---------- Avvio ----------
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
const saved = storage.get(SESSION_KEY);
const urlCode = new URLSearchParams(location.search).get("g")?.toUpperCase();
if (saved && (!urlCode || urlCode === saved.code)) startGame(saved);
else showHome();
