import { CITIES, centroid, distanceM, nearestCity, timeline } from "./geo.js";
import { LANGS, applyStatic, detectLang, getLang, has, plural, setLang, t } from "./i18n.js";

const DEFAULT_VIEW = [41.8967, 12.4822]; // senza GPS e senza zona si parte da Roma
const SYNC_MS = 3500;
const AUTO_HOLD_S = 3; // come AUTO_HOLD_MS nella funzione
const SESSION_KEY = "manhunt.session";
const NAME_KEY = "manhunt.name";
const LANG_KEY = "manhunt.lang";
const ACCOUNT_KEY = "manhunt.account";
// Da aggiornare a ogni modifica: compare in fondo alla schermata iniziale e serve a capire quale versione ha il telefono.
const APP_VERSION = "2026-10-28.1";

const $ = (sel) => document.querySelector(sel);
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const roleLabel = (role) => t(`role.${role}`);
const countRole = (role, n) => plural(`count.${role}`, n);
const cityName = (id) => t(`city.${id}`);
const presetName = (p) => t(p.nameKey);

// ---------- Stato locale ----------
const app = {
  session: null, // { code, id, token }
  state: null, // ultima risposta del server
  clockOffset: 0,
  myPos: null, // { lat, lng, acc, at }
  geoError: null, // "unsupported" | "denied" | "searching" | null
  syncTimer: null,
  syncing: false,
  edit: null, // { mode: "circle", center, radius } | { mode: "polygon", points }
  confirm: null, // azione in attesa di conferma
  seenEvents: null,
  lastDanger: null,
  wasOutside: false,
  fittedZone: null,
  wakeLock: null,
  wasKamikaze: false,
  account: null, // profilo dell'account, se si è entrati
  accountView: "out", // out | login | register | in
  city: null, // città scelta nell'editor della zona
  cityChosen: false,
  userMovedMap: false,
  boundsKey: "",
  bonusCount: null,
};

const storage = {
  get(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
  },
  set(key, value) {
    try { value == null ? localStorage.removeItem(key) : localStorage.setItem(key, JSON.stringify(value)); } catch {}
  },
};

// Gli errori del server arrivano come codice: qui diventano una frase nella lingua scelta.
async function api(action, body = {}) {
  let res;
  try {
    res = await fetch(`/api/${action}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...app.session, ...body }),
    });
  } catch {
    throw Object.assign(new Error(t("err.network")), { code: "network" });
  }
  const data = await res.json().catch(() => ({ error: "bad_response" }));
  if (!res.ok) {
    const key = `err.${data.error}`;
    const err = new Error(has(key) ? t(key, data.params) : t("err.generic"));
    err.status = res.status;
    err.code = data.error;
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
const fmtTime = (ms) => new Date(ms).toLocaleTimeString(getLang(), { hour: "2-digit", minute: "2-digit" });
const fmtNum = (n, digits = 1) => n.toLocaleString(getLang(), { maximumFractionDigits: digits });
const fmtDist = (m) => (m >= 1000 ? `${fmtNum(m / 1000)} km` : `${Math.round(m)} m`);
const initials = (name) => name.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
const agoLabel = (at) => {
  const min = Math.round((now() - at) / 60000);
  return min < 1 ? t("ago.now") : t("ago.min", { n: min });
};

function toast(text, ms = 3200) {
  const el = $("#toast");
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (el.hidden = true), ms);
}

const vibrate = (pattern) => { try { navigator.vibrate?.(pattern); } catch {} };

// Gli eventi arrivano dal server come codice + nomi, la frase si compone qui.
const eventText = (e) => t(`ev.${e.code}`, { a: e.a || t("someone"), b: e.b || t("someone") });

// ---------- Lingua ----------
function fillLangSelect(sel) {
  sel.innerHTML = Object.entries(LANGS)
    .map(([code, name]) => `<option value="${code}">${esc(name)}</option>`)
    .join("");
}

function changeLang(lang, { persist = true } = {}) {
  setLang(lang);
  storage.set(LANG_KEY, lang);
  applyStatic();
  $("#lang-select").value = lang;
  $("#reg-lang").value = lang;
  showError("#home-error");
  if (!$("#home").hidden) renderAccount();
  if (app.state) {
    renderHud();
    renderAlerts();
    renderCatchBar();
    renderSheet();
    drawPlayers();
  }
  const token = storage.get(ACCOUNT_KEY)?.token;
  if (persist && app.account && token) {
    api("setLanguage", { userToken: token, language: lang })
      .then((r) => (app.account = r.profile))
      .catch(() => {});
  }
}

// ---------- Home ----------
function showHome(error) {
  stopGame();
  $("#game").hidden = true;
  $("#home").hidden = false;
  const saved = storage.get(SESSION_KEY);
  $("#resume").hidden = !saved;
  if (saved) $("#resume-code").textContent = saved.code;
  $("#name").value = storage.get(NAME_KEY) || app.account?.firstName || "";
  renderAccount();
  const fromUrl = new URLSearchParams(location.search).get("g");
  if (fromUrl) $("#code").value = fromUrl.toUpperCase().slice(0, 5);
  showError("#home-error", error);
}

$("#home-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  let action = e.submitter?.value ?? "create";
  // Invio premuto nel campo codice: si entra, non si crea.
  if (document.activeElement === $("#code") && $("#code").value.trim()) action = "join";
  const name = $("#name").value.trim();
  const code = $("#code").value.trim().toUpperCase();
  showError("#home-error");
  if (!name) return showError("#home-error", t("home.err_name"));
  if (action === "join" && code.length !== 5) return showError("#home-error", t("home.err_code"));
  storage.set(NAME_KEY, name);
  e.submitter && (e.submitter.disabled = true);
  try {
    app.session = null;
    const session = await api(action, { name, code, userToken: storage.get(ACCOUNT_KEY)?.token });
    storage.set(SESSION_KEY, session);
    history.replaceState(null, "", `/?g=${session.code}`);
    startGame(session);
  } catch (ex) {
    showError("#home-error", ex.message);
  } finally {
    e.submitter && (e.submitter.disabled = false);
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
const layers = { zone: null, draft: null, poi: null, markers: new Map(), accuracy: null };

function initMap() {
  if (map) return;
  map = L.map("map", { zoomControl: false, attributionControl: true, maxBoundsViscosity: 0.9 }).setView(DEFAULT_VIEW, 13);
  // Tile OpenStreetMap (senza chiave, tutta l'Italia); lo stile scuro arriva da un filtro CSS sulla classe "map-tiles".
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    className: "map-tiles",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
  map.on("click", onMapClick);
  map.on("dragstart", () => (app.userMovedMap = true));
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

const zoneCenter = (zone) => (zone.type === "circle" ? zone.center : centroid(zone.points));

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

// Zona di interesse: cerchio turchese finché è aperta.
function drawPoi(poi) {
  const key = poi ? JSON.stringify([poi.index, poi.center]) : "";
  if ((layers.poi?.key ?? "") === key) return;
  layers.poi?.circle.remove();
  layers.poi = null;
  if (!poi) return;
  const color = css("--poi");
  const circle = L.circle([poi.center.lat, poi.center.lng], {
    radius: poi.radius, color, weight: 3, dashArray: "6 6", fillColor: color, fillOpacity: 0.2, interactive: false,
  }).addTo(map);
  layers.poi = { key, circle };
}

// Durante la partita la mappa resta sulla città di gioco: non si può andare in giro per l'Italia.
function limitMap(s) {
  const playing = s.phase === "headstart" || s.phase === "hunt";
  const key = playing && s.zone ? JSON.stringify(s.zone) : "";
  if (app.boundsKey === key) return;
  app.boundsKey = key;
  map.setMaxBounds(key ? L.polygon(zoneRing(s.zone)).getBounds().pad(0.6) : null);
}

function drawDraft() {
  layers.draft?.remove();
  layers.draft = null;
  const ed = app.edit;
  if (!ed) return;
  const group = L.layerGroup();
  const color = css("--runner");
  const vertex = L.divIcon({ className: "", html: '<div class="vertex"></div>', iconSize: [14, 14], iconAnchor: [7, 7] });
  if (ed.mode === "circle" && ed.center) {
    L.circle([ed.center.lat, ed.center.lng], { radius: ed.radius, color, weight: 2, dashArray: "6 6", fillOpacity: 0.12 }).addTo(group);
    L.marker([ed.center.lat, ed.center.lng], { icon: vertex, interactive: false }).addTo(group);
  }
  if (ed.mode === "polygon" && ed.points.length) {
    const ll = ed.points.map((p) => [p.lat, p.lng]);
    (ll.length >= 3 ? L.polygon(ll, { color, weight: 2, dashArray: "6 6", fillOpacity: 0.12 }) : L.polyline(ll, { color, weight: 2, dashArray: "6 6" })).addTo(group);
    ll.forEach((p) => L.marker(p, { icon: vertex, interactive: false }).addTo(group));
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
  let label = esc(isMe ? t("players.you_label") : p.name);
  if (p.visibility === "ping") label += ` · ${esc(agoLabel(p.pos.at))}`;
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
  else toast(t("toast.no_position"));
});
$("#tool-zone").addEventListener("click", () => {
  const z = app.state?.currentZone ?? app.state?.zone;
  if (z) fitZone(z);
  else if (app.myPos) map.setView([app.myPos.lat, app.myPos.lng], 15);
  else map.setView(DEFAULT_VIEW, 13);
});

// ---------- Posizione ----------
let geoWatch = null;
function startGeo() {
  if (geoWatch != null) return;
  if (!("geolocation" in navigator)) {
    app.geoError = "unsupported";
    return renderAlerts();
  }
  geoWatch = navigator.geolocation.watchPosition(
    (pos) => {
      const first = !app.myPos;
      app.myPos = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: Math.round(pos.coords.accuracy), at: Date.now() };
      app.geoError = null;
      // Al primo segnale GPS, se la zona non c'è ancora, la mappa va sulla città dove ti trovi.
      if (first && !app.state?.zone && !app.userMovedMap && map) map.setView([app.myPos.lat, app.myPos.lng], 15);
      if (first && !app.cityChosen) app.city = nearestCity(app.myPos).id;
      if (app.state) {
        drawPlayers();
        if (first) renderSheet();
      }
      renderAlerts();
      if (first) scheduleSync(0);
    },
    (err) => {
      app.geoError = err.code === err.PERMISSION_DENIED ? "denied" : "searching";
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
  app.city = null;
  app.cityChosen = false;
  app.userMovedMap = false;
  app.boundsKey = "";
  app.bonusCount = null;
  $("#home").hidden = true;
  $("#game").hidden = false;
  initMap();
  map.setMaxBounds(null);
  map.invalidateSize();
  if (app.myPos) map.setView([app.myPos.lat, app.myPos.lng], 15);
  startGeo();
  keepAwake();
  scheduleSync(0);
  clearInterval(app.tick);
  app.tick = setInterval(() => {
    renderHud();
    renderAlerts();
  }, 1000);
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
  layers.poi?.circle.remove();
  layers.poi = null;
  map?.setMaxBounds(null);
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
  const keyOf = (e) => `${e.kind}:${e.at}:${e.code}:${e.a ?? ""}:${e.b ?? ""}`;
  if (app.seenEvents) {
    const fresh = s.events.filter((e) => !app.seenEvents.has(keyOf(e)) && e.kind !== "outside");
    if (fresh.length) {
      toast(eventText(fresh[0]), 4500);
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
  if (s.me.kamikaze && !app.wasKamikaze) {
    toast(t("toast.kamikaze_you"), 7000);
    vibrate([200, 100, 200, 100, 400]);
  }
  app.wasKamikaze = !!s.me.kamikaze;
  const bonuses = s.me.bonus?.list ?? [];
  if (app.bonusCount != null && bonuses.length > app.bonusCount) {
    toast(t("toast.bonus", { name: t(`bonus.${bonuses[bonuses.length - 1].type}`) }), 6000);
    vibrate([100, 60, 100, 60, 100]);
  }
  app.bonusCount = bonuses.length;

  // La città dell'editor segue la zona già scelta, finché l'host non ne sceglie un'altra.
  if (s.zone && !app.cityChosen) app.city = nearestCity(zoneCenter(s.zone)).id;

  const zoneKey = JSON.stringify(s.zone);
  if (s.zone && app.fittedZone !== zoneKey && !app.edit) {
    fitZone(s.zone);
    app.fittedZone = zoneKey;
  }

  limitMap(s);
  drawZone(s.zone, s.currentZone);
  drawPoi(s.poi);
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
  const tl = timeline({ ...s, startedAt: s.timeline.startedAt });
  const tick = Math.floor((now() - tl.huntStart) / every);
  return tl.huntStart + (tick + 1) * every;
}

function renderHud() {
  const s = app.state;
  if (!s) return;
  $("#hud-code").textContent = s.code;
  const role = s.me.role;
  const badge = $("#hud-role");
  const kamikaze = s.me.kamikaze && role === "runner";
  badge.className = `role-badge role-${role}${kamikaze ? " role-kamikaze" : ""}`;
  badge.textContent = kamikaze ? t("role.kamikaze_badge") : roleLabel(role);

  let phase = "";
  let timer = "";
  let note = "";
  const tl = s.timeline;
  if (s.phase === "lobby") {
    phase = t("hud.waiting");
    note = s.isHost ? t("hud.waiting_host") : t("hud.waiting_guest");
  } else if (s.phase === "headstart") {
    phase = t("hud.headstart");
    timer = fmtClock(tl.huntStart - now());
    note = role === "hunter" ? t("hud.headstart_hunter") : role === "runner" ? t("hud.headstart_runner") : t("hud.headstart_other");
  } else if (s.phase === "hunt") {
    phase = t("hud.hunt");
    timer = fmtClock(tl.endsAt - now());
    const preyPing = nextPingAt(s, s.settings.revealEveryMin);
    const hunterPing = s.settings.runnersSeeHunters ? null : nextPingAt(s, s.settings.hunterRevealEveryMin);
    if (role === "runner") {
      const bits = [];
      if (preyPing) bits.push(t("hud.reveal_you", { t: fmtClock(preyPing - now()) }));
      if (hunterPing) bits.push(t(bits.length ? "hud.hunters_visible_next" : "hud.hunters_visible_first", { t: fmtClock(hunterPing - now()) }));
      note = bits.join(" · ");
    } else if (role === "hunter") {
      if (preyPing) note = t("hud.prey_ping", { t: fmtClock(preyPing - now()) });
      if (hunterPing) note += `${note ? " · " : ""}${t("hud.preys_see_you", { t: fmtClock(hunterPing - now()) })}`;
    }
    if (!note && !s.settings.revealEveryMin) note = t("hud.live_all");
    if (s.settings.shrinkTo < 100) note += note ? ` · ${t("hud.zone_shrinks_next")}` : t("hud.zone_shrinks_first");
  } else {
    phase = winnerTitle(s.winner, "hud.ended");
  }
  $("#hud-phase").textContent = phase;
  $("#hud-timer").textContent = timer;
  $("#hud-note").textContent = note;
}

const winnerTitle = (winner, fallbackKey) =>
  winner === "hunters" ? t("res.hunters") : winner === "runners" ? t("res.runners") : winner === "draw" ? t("res.draw") : t(fallbackKey);

function renderAlerts() {
  const s = app.state;
  const danger = $("#alert-danger");
  const outside = $("#alert-outside");
  const gps = $("#alert-gps");
  gps.hidden = !app.geoError;
  gps.textContent = app.geoError ? t(`geo.${app.geoError}`) : "";
  if (!s) return;
  const beingCaught = s.capturing != null;
  danger.hidden = s.danger == null && !beingCaught;
  danger.textContent = beingCaught
    ? t("alert.capturing", { s: s.capturing })
    : s.danger != null ? t("alert.danger", { m: s.danger }) : "";
  const meP = s.players.find((p) => p.id === s.me.id);
  outside.hidden = !meP?.outside;
  outside.textContent = s.settings.outsideReveal ? t("alert.outside_reveal") : t("alert.outside");
  const poiText = poiAlertText(s);
  $("#alert-poi").hidden = !poiText;
  $("#alert-poi").textContent = poiText;
}

// Conto alla rovescia della zona di interesse: per le prede arrivare/restare, per i cacciatori un avviso.
function poiAlertText(s) {
  const poi = s.poi;
  if (!poi || s.phase !== "hunt" || now() > poi.endsAt) return "";
  const role = s.me.role;
  const dist = app.myPos ? fmtDist(distanceM(app.myPos, poi.center)) : "?";
  if (role === "hunter") return t("poi.hunter", { d: dist });
  if (role !== "runner") return "";
  const prog = s.me.poi;
  if (prog?.done) return t("poi.done");
  if (prog?.since != null) return t("poi.hold", { t: fmtClock(prog.since + prog.holdMs - now()) });
  if (now() <= poi.arriveBy) return t("poi.go", { d: dist, t: fmtClock(poi.arriveBy - now()) });
  return "";
}

function renderCatchBar() {
  const s = app.state;
  const bar = $("#catch-bar");
  const list = s?.catchable ?? [];
  // Quando c'è qualcuno da catturare il pannello si chiude per lasciare spazio al pulsante.
  if (list.length && bar.hidden) sheet.classList.remove("open");
  bar.hidden = !list.length;
  const html = list
    .map((c) => `<button class="btn btn-primary catch-btn" type="button" data-catch="${esc(c.id)}">${esc(t("catch.btn", { name: c.name, m: c.dist }))}</button>`)
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
  const text = t("share.text", { code: s.code });
  try {
    if (navigator.share) return await navigator.share({ title: t("meta.title"), text, url });
  } catch (err) {
    if (err?.name === "AbortError") return;
  }
  try {
    await navigator.clipboard.writeText(`${text}: ${url}`);
    toast(t("toast.link_copied"));
  } catch {
    toast(t("toast.code", { code: s.code }));
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
  if (!s.zone) problem = t("err.need_zone");
  else if (!hunters) problem = t("err.need_hunter");
  else if (!runners) problem = t("err.need_runner");
  // Con il kamikaze attivo il server sceglie la preda segreta all'inizio.
  const kamikazeHint = s.settings.kamikaze ? t("lobby.kamikaze_on") : "";
  return `
    <div class="row" style="justify-content:space-between">
      <div><div class="eyebrow">${esc(t("lobby.code"))}</div><div class="mono" style="font-size:24px;letter-spacing:.2em">${esc(s.code)}</div></div>
      <button class="btn btn-sm" type="button" data-action="share">${esc(t("lobby.invite_friends"))}</button>
    </div>
    <button class="btn btn-primary btn-lg btn-block" type="button" data-action="start" ${problem ? "disabled" : ""}>${esc(t("lobby.start"))}</button>
    <p class="hint">${problem ? esc(problem) : esc(t("lobby.versus", { h: countRole("hunter", hunters), r: countRole("runner", runners) }))}</p>
    ${kamikazeHint ? `<p class="hint">${esc(kamikazeHint)}</p>` : ""}`;
}

function zoneEditorHtml(s) {
  const ed = app.edit;
  const city = CITIES.find((c) => c.id === (app.city ?? "roma")) ?? CITIES[0];
  const sameZone = (z) => JSON.stringify(z) === JSON.stringify(s.zone);
  const presets = city.presets
    .map((p) => `<button class="chip preset ${sameZone(p.zone) ? "active" : ""}" type="button" data-preset="${esc(p.id)}">${esc(presetName(p))}</button>`)
    .join("");
  const cityOptions = CITIES.map((c) => ({ id: c.id, name: cityName(c.id) }))
    .sort((a, b) => a.name.localeCompare(b.name, getLang()))
    .map((c) => `<option value="${c.id}" ${c.id === city.id ? "selected" : ""}>${esc(c.name)}</option>`)
    .join("");
  let body;
  if (!ed) {
    const desc = s.zone
      ? `${s.zone.type === "circle" ? t("zone.desc_circle", { r: fmtDist(s.zone.radius) }) : t("zone.desc_polygon", { n: s.zone.points.length })} · ${fmtNum(zoneAreaKm2(s.zone), 2)} km²`
      : t("zone.none");
    body = `
      <p class="hint">${esc(desc)}</p>
      <label class="field"><span class="label">${esc(t("zone.city"))}</span>
        <select id="city-select">${cityOptions}</select></label>
      <div class="presets">${presets}</div>
      <div class="row">
        <button class="btn btn-sm" type="button" data-action="zone-here" ${app.myPos ? "" : "disabled"}>${esc(t("zone.around_me"))}</button>
        <button class="btn btn-sm" type="button" data-action="draw-circle">${esc(t("zone.draw_circle"))}</button>
        <button class="btn btn-sm" type="button" data-action="draw-polygon">${esc(t("zone.draw_polygon"))}</button>
      </div>`;
  } else if (ed.mode === "circle") {
    body = `
      <p class="hint">${esc(ed.center ? t("zone.circle_move") : t("zone.circle_set"))}</p>
      <label class="field"><span class="label">${esc(t("zone.radius"))} · <span id="radius-val">${fmtDist(ed.radius)}</span></span>
        <input id="radius" type="range" min="200" max="5000" step="50" value="${ed.radius}"></label>
      <div class="row">
        <button class="btn btn-sm btn-runner" type="button" data-action="save-zone" ${ed.center ? "" : "disabled"}>${esc(t("zone.save"))}</button>
        <button class="btn btn-sm btn-ghost" type="button" data-action="cancel-zone">${esc(t("common.cancel"))}</button>
      </div>`;
  } else {
    body = `
      <p class="hint">${esc(t("zone.polygon_hint", { n: ed.points.length }))}${ed.points.length < 3 ? esc(t("zone.min3")) : ""}</p>
      <div class="row">
        <button class="btn btn-sm btn-runner" type="button" data-action="save-zone" ${ed.points.length >= 3 ? "" : "disabled"}>${esc(t("zone.save"))}</button>
        <button class="btn btn-sm" type="button" data-action="undo-point" ${ed.points.length ? "" : "disabled"}>${esc(t("zone.undo"))}</button>
        <button class="btn btn-sm btn-ghost" type="button" data-action="cancel-zone">${esc(t("common.cancel"))}</button>
      </div>`;
  }
  return `<div class="section-head"><h3>${esc(t("zone.title"))}</h3></div>${body}`;
}

function playerStatus(s, p) {
  const bits = [];
  if (p.isHost) bits.push(t("players.host"));
  if (!p.online) bits.push(t("players.offline"));
  if (p.outside) bits.push(t("players.outside"));
  if (p.inPoi) bits.push(t("players.in_poi"));
  if (p.visibility === "ping" && p.pos) bits.push(t("players.signal", { ago: agoLabel(p.pos.at) }));
  if (p.id !== s.me.id && p.pos && app.myPos && s.phase !== "lobby") bits.push(fmtDist(distanceM(app.myPos, p.pos)));
  return bits.join(" · ");
}

function playersHtml(s, editable) {
  const order = { hunter: 0, runner: 1, caught: 2, eliminated: 2, referee: 3 };
  const players = [...s.players].sort((a, b) => order[a.role] - order[b.role] || a.name.localeCompare(b.name));
  const rows = players
    .map((p) => {
      const isMe = p.id === s.me.id;
      let controls = "";
      if (editable) {
        const seg = ["hunter", "runner", "referee"]
          .map((r) => `<button type="button" class="r-${r}" aria-pressed="${p.baseRole === r}" data-role="${r}" data-player="${esc(p.id)}">${esc(roleLabel(r))}</button>`)
          .join("");
        controls = `<div class="seg">${seg}</div>${isMe ? "" : `<button class="btn btn-sm btn-ghost" type="button" data-kick="${esc(p.id)}" aria-label="${esc(t("players.kick_aria", { name: p.name }))}">✕</button>`}`;
      } else if (s.isHost && s.phase === "hunt" && p.role === "caught") {
        controls = `<button class="btn btn-sm btn-ghost" type="button" data-uncatch="${esc(p.id)}">${esc(t("players.uncatch"))}</button>`;
      } else if (s.isHost && s.phase === "hunt" && p.role === "eliminated") {
        controls = `<button class="btn btn-sm btn-ghost" type="button" data-unelim="${esc(p.id)}">${esc(t("players.unelim"))}</button>`;
      } else if (s.me.role === "referee" && s.phase === "hunt" && p.role === "runner") {
        controls = `<button class="btn btn-sm btn-danger" type="button" data-catch="${esc(p.id)}">${esc(t("players.mark_caught"))}</button>`;
      }
      const status = playerStatus(s, p);
      return `<li class="player ${p.online ? "" : "offline"}">
        <span class="dot ${p.role}" title="${esc(roleLabel(p.role))}"></span>
        <span class="player-name">${esc(p.name)}${isMe ? `<span class="tag">${esc(t("players.you"))}</span>` : ""}
          ${status ? `<div class="player-meta">${esc(status)}</div>` : ""}</span>
        ${controls}
      </li>`;
    })
    .join("");
  const counts = ["hunter", "runner", "caught", "eliminated", "referee"]
    .map((r) => [r, s.players.filter((p) => p.role === r).length])
    .filter(([, n]) => n)
    .map(([r, n]) => countRole(r, n))
    .join(" · ");
  const shuffle = editable && s.players.length > 1 ? `<button class="btn btn-sm" type="button" data-action="shuffle">${esc(t("players.shuffle"))}</button>` : "";
  return `<div class="section-head"><h3>${esc(t("players.title"))}</h3>${shuffle}</div>
    <p class="hint">${esc(counts)}</p>
    <ul class="players">${rows}</ul>`;
}

const SETTING_FIELDS = [
  ["durationMin", 5, 600],
  ["headStartMin", 0, 60],
  ["revealEveryMin", 0, 60],
  ["hunterRevealEveryMin", 0, 60],
  ["catchRadiusM", 5, 200],
  ["dangerRadiusM", 0, 2000],
  ["shrinkTo", 10, 100],
  ["poiEveryMin", 0, 30],
];
const SETTING_TOGGLES = ["runnersSeeHunters", "outsideReveal", "infection", "kamikaze"];

function rulesFormHtml(s) {
  const fields = SETTING_FIELDS.map(
    ([k, min, max]) => `<label class="setting"><span class="label">${esc(t(`rules.${k}`))}</span>
      <input id="set-${k}" type="number" inputmode="numeric" min="${min}" max="${max}" value="${s.settings[k]}" data-setting="${k}"></label>`,
  ).join("");
  // L'opzione kamikaze compare solo quando i giocatori sono abbastanza (più di 10).
  const toggles = SETTING_TOGGLES.filter((k) => k !== "kamikaze" || s.kamikazeAvailable)
    .map((k) => `<label class="toggle"><input id="set-${k}" type="checkbox" data-setting="${k}" ${s.settings[k] ? "checked" : ""}>${esc(t(`rules.${k}`))}</label>`)
    .join("");
  return `<div class="section-head"><h3>${esc(t("rules.title"))}</h3></div><div class="settings">${fields}${toggles}</div>`;
}

function rulesSummaryHtml(s) {
  const st = s.settings;
  const items = [
    [t("sum.duration"), t("val.min", { n: st.durationMin })],
    [t("sum.headstart"), t("val.min", { n: st.headStartMin })],
    [t("sum.prey_signal"), st.revealEveryMin ? t("val.every_min", { n: st.revealEveryMin }) : t("val.live")],
    [t("sum.hunter_signal"), st.runnersSeeHunters ? t("val.live") : st.hunterRevealEveryMin ? t("val.every_min", { n: st.hunterRevealEveryMin }) : t("val.hidden")],
    [t("sum.capture"), t("val.capture", { m: st.catchRadiusM, s: AUTO_HOLD_S })],
    [t("sum.alarm"), st.dangerRadiusM ? `${st.dangerRadiusM} m` : t("val.off")],
    [t("sum.zone"), st.shrinkTo < 100 ? t("val.shrinks", { n: st.shrinkTo }) : t("val.fixed")],
    [t("sum.poi"), st.poiEveryMin ? t("val.every_min", { n: st.poiEveryMin }) : t("val.off")],
    [t("sum.infection"), st.infection ? t("val.yes") : t("val.no")],
  ];
  if (st.kamikaze || s.kamikazeActive) items.push([t("sum.kamikaze"), t("val.active")]);
  return `<div class="section-head"><h3>${esc(t("rules.title"))}</h3></div>
    <dl class="rules-summary">${items.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>`;
}

function waitHtml(s) {
  const host = s.players.find((p) => p.isHost)?.name ?? t("someone");
  const you = t(`wait.as_${s.me.role === "referee" ? "referee" : s.me.role === "hunter" ? "hunter" : "runner"}`);
  return `<div class="section-head"><h3>${esc(t("wait.title"))}</h3><button class="btn btn-sm" type="button" data-action="share">${esc(t("wait.invite"))}</button></div>
    <p class="hint">${esc(you)} ${esc(t("wait.preparing", { host }))}${s.zone ? "" : ` ${esc(t("wait.no_zone"))}`}</p>`;
}

function confirmBox(title, yesAction, yesLabel, noLabel = t("common.cancel")) {
  return `<div class="confirm"><strong>${esc(title)}</strong>
    <div class="row"><button class="btn btn-primary" type="button" data-action="${yesAction}">${esc(yesLabel)}</button>
    <button class="btn btn-ghost" type="button" data-action="confirm-no">${esc(noLabel)}</button></div></div>`;
}

function gameActionsHtml(s) {
  const role = s.me.role;
  const parts = [];
  if (role === "runner" && s.phase === "hunt") {
    parts.push(
      app.confirm === "surrender"
        ? confirmBox(t("act.surrender_confirm"), "surrender-yes", t("act.surrender_yes"), t("act.no"))
        : `<button class="btn btn-danger btn-block" type="button" data-action="surrender">${esc(t("act.surrender"))}</button>`,
    );
  }
  if (s.me.kamikaze && role === "runner") {
    parts.push(`<p class="hint"><strong>${esc(t("act.kamikaze_you_title"))}</strong> ${esc(t("act.kamikaze_you_text"))}</p>`);
  }
  if (role === "hunter" && s.kamikazeActive && s.phase === "hunt") {
    parts.push(`<p class="hint">${esc(t("act.hunter_kamikaze"))}</p>`);
  }
  const b = s.me.bonus;
  if (role === "runner" && b) {
    const items = [];
    if (b.stealthUntil > now()) items.push(t("bonus.stealth_until", { t: fmtTime(b.stealthUntil) }));
    if (b.seeHuntersUntil > now()) items.push(t("bonus.see_until", { t: fmtTime(b.seeHuntersUntil) }));
    if (b.radarUntil > now()) items.push(t("bonus.radar_until", { t: fmtTime(b.radarUntil) }));
    if (b.quickNext) items.push(t("bonus.quick_next"));
    if (items.length) {
      parts.push(`<div class="bonus-box"><strong>${esc(t("bonus.title"))}</strong><ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul></div>`);
    }
  }
  if (role === "caught") parts.push(`<p class="hint">${esc(t("act.caught"))}</p>`);
  if (role === "eliminated") parts.push(`<p class="hint">${esc(t("act.eliminated"))}</p>`);
  if (role === "hunter" && s.phase === "hunt" && !s.catchable.length) {
    parts.push(`<p class="hint">${esc(t("act.hunter_hint", { m: s.settings.catchRadiusM, s: AUTO_HOLD_S }))}</p>`);
  }
  if (s.isHost) {
    parts.push(
      app.confirm === "stop"
        ? confirmBox(t("act.stop_confirm"), "stop-yes", t("act.stop_yes"))
        : `<button class="btn btn-ghost btn-sm" type="button" data-action="stop">${esc(t("act.stop"))}</button>`,
    );
  }
  return parts.join("") || `<p class="hint">${esc(t("act.good_hunt"))}</p>`;
}

function resultHtml(s) {
  const cls = s.winner ?? "none";
  const title = winnerTitle(s.winner, "res.ended");
  const tl = s.timeline;
  const played = tl && s.endedAt ? fmtClock(s.endedAt - tl.startedAt) : "";
  const caught = s.catches.filter((c) => !c.eliminated).length;
  const host = s.isHost
    ? `<div class="row"><button class="btn btn-primary" type="button" data-action="reset">${esc(t("res.new"))}</button>
        ${app.confirm === "delete"
          ? `<button class="btn btn-danger" type="button" data-action="delete-yes">${esc(t("res.delete_confirm"))}</button>`
          : `<button class="btn btn-ghost" type="button" data-action="delete">${esc(t("res.close_delete"))}</button>`}</div>`
    : "";
  return `<div class="result ${cls}"><h2>${esc(title)}</h2>
    <p class="hint">${esc(plural("res.meta", caught, { t: played }))}</p>
    ${s.kamikazeName ? `<p class="hint">${esc(t("res.kamikaze_was", { name: s.kamikazeName }))}</p>` : ""}</div>${host}`;
}

function eventsHtml(s) {
  if (!s.events.length) return "";
  const items = s.events
    .map((e) => `<li class="ev-${e.kind}"><time class="mono">${fmtTime(e.at)}</time><span>${esc(eventText(e))}</span></li>`)
    .join("");
  return `<div class="section-head"><h3>${esc(t("ev.title"))}</h3></div><ul class="events">${items}</ul>`;
}

function leaveHtml(s) {
  if (s.isHost) {
    if (s.phase === "ended") return "";
    return app.confirm === "delete"
      ? confirmBox(t("leave.delete_title"), "delete-yes", t("leave.delete_yes"))
      : `<button class="btn btn-ghost btn-sm" type="button" data-action="delete">${esc(t("leave.close"))}</button>`;
  }
  return `<button class="btn btn-ghost btn-sm" type="button" data-action="leave">${esc(t("leave.leave"))}</button>`;
}

// Delegazione eventi del pannello.
$("#sheet-body").addEventListener("click", async (e) => {
  const s = app.state;
  const btn = e.target.closest("button");
  if (!btn || !s) return;

  if (btn.dataset.preset) {
    const city = CITIES.find((c) => c.id === app.city) ?? CITIES[0];
    const preset = city.presets.find((p) => p.id === btn.dataset.preset);
    const res = await act("config", { zone: preset.zone }, t("toast.zone_set", { name: presetName(preset) }));
    if (res) fitZone(preset.zone);
    return;
  }
  if (btn.dataset.role) {
    return act("config", { roles: { [btn.dataset.player]: btn.dataset.role } });
  }
  if (btn.dataset.kick) return act("kick", { target: btn.dataset.kick }, t("toast.kicked"));
  if (btn.dataset.uncatch) return act("uncatch", { target: btn.dataset.uncatch }, t("toast.uncaught"));
  if (btn.dataset.unelim) return act("uncatch", { target: btn.dataset.unelim, elim: true }, t("toast.unelim"));
  if (btn.dataset.catch) return act("catch", { target: btn.dataset.catch });

  const action = btn.dataset.action;
  switch (action) {
    case "share": return shareGame();
    case "start": return act("start", {}, t("toast.started"));
    case "zone-here": {
      if (!app.myPos) return;
      const zone = { type: "circle", center: { lat: +app.myPos.lat.toFixed(6), lng: +app.myPos.lng.toFixed(6) }, radius: 1000 };
      if (await act("config", { zone }, t("toast.zone_saved"))) fitZone(zone);
      return;
    }
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
      if (await act("config", { zone }, t("toast.zone_saved"))) {
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
      return act("config", { roles }, t("toast.shuffled"));
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
      await act("reset", {}, t("toast.reset"));
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
  if (e.target.id === "city-select") {
    const city = CITIES.find((c) => c.id === e.target.value);
    if (!city) return;
    app.city = city.id;
    app.cityChosen = true;
    app.userMovedMap = true;
    map.setView([city.center.lat, city.center.lng], 13);
    e.target.blur();
    renderSheet();
    return;
  }
  const key = e.target.dataset.setting;
  if (!key) return;
  const value = e.target.type === "checkbox" ? e.target.checked : Number(e.target.value);
  act("config", { settings: { [key]: value } }).then(() => {
    // Il campo potrebbe essere stato corretto dal server (limiti min/max).
    e.target.blur();
    renderSheet();
  });
});

// ---------- Account ----------
const ACCOUNT_VIEWS = { out: "#account-out", login: "#login-form", register: "#register-form", in: "#account-in" };

function showError(sel, msg) {
  const el = $(sel);
  el.hidden = !msg;
  el.textContent = msg ?? "";
}

function showAccountView(view) {
  app.accountView = view;
  for (const [key, sel] of Object.entries(ACCOUNT_VIEWS)) $(sel).hidden = key !== view;
  $("#delete-form").hidden = true;
}

function renderAccount() {
  const a = app.account;
  if (a) {
    $("#acc-name").textContent = `${a.firstName} ${a.lastName}`;
    $("#acc-details").textContent = t("acc.details", { email: a.email, age: a.age, lang: LANGS[a.language] ?? a.language });
    showAccountView("in");
  } else {
    showAccountView(app.accountView === "in" ? "out" : app.accountView);
  }
}

function setAccount(profile, token) {
  app.account = profile;
  if (token) storage.set(ACCOUNT_KEY, { token });
  if (!$("#name").value.trim()) $("#name").value = profile.firstName;
  // La lingua scelta nell'account diventa la lingua dell'app.
  if (profile.language && profile.language !== getLang()) changeLang(profile.language, { persist: false });
  renderAccount();
}

function clearAccount() {
  app.account = null;
  app.accountView = "out";
  storage.set(ACCOUNT_KEY, null);
  renderAccount();
}

async function loadAccount() {
  const saved = storage.get(ACCOUNT_KEY);
  if (!saved?.token) return renderAccount();
  try {
    const { profile } = await api("me", { userToken: saved.token });
    setAccount(profile);
  } catch (err) {
    if (err.status === 401) clearAccount();
  }
}

async function submitAccount(e, errorSel, run) {
  e.preventDefault();
  const btn = e.submitter;
  if (btn) btn.disabled = true;
  showError(errorSel);
  try {
    await run();
  } catch (err) {
    showError(errorSel, err.message);
  } finally {
    if (btn) btn.disabled = false;
  }
}

$("#acc-show-login").addEventListener("click", () => showAccountView("login"));
$("#acc-show-register").addEventListener("click", () => showAccountView("register"));
document.querySelectorAll("[data-acc-cancel]").forEach((b) =>
  b.addEventListener("click", () => {
    showError("#login-error");
    showError("#register-error");
    renderAccount();
    if (!app.account) showAccountView("out");
  }),
);

$("#login-form").addEventListener("submit", (e) =>
  submitAccount(e, "#login-error", async () => {
    const { token, profile } = await api("login", { email: $("#login-email").value, password: $("#login-password").value });
    $("#login-password").value = "";
    setAccount(profile, token);
  }),
);

$("#register-form").addEventListener("submit", (e) =>
  submitAccount(e, "#register-error", async () => {
    const { token, profile } = await api("register", {
      firstName: $("#reg-first").value,
      lastName: $("#reg-last").value,
      age: $("#reg-age").value,
      language: $("#reg-lang").value,
      email: $("#reg-email").value,
      password: $("#reg-password").value,
      consent: $("#reg-consent").checked,
    });
    $("#reg-password").value = "";
    setAccount(profile, token);
  }),
);

$("#acc-logout").addEventListener("click", () => {
  const token = storage.get(ACCOUNT_KEY)?.token;
  clearAccount();
  if (token) api("logout", { userToken: token }).catch(() => {});
});

$("#acc-delete").addEventListener("click", () => {
  $("#delete-form").hidden = false;
  $("#delete-password").focus();
});
$("#delete-cancel").addEventListener("click", () => {
  $("#delete-form").hidden = true;
  $("#delete-password").value = "";
  showError("#delete-error");
});
$("#delete-form").addEventListener("submit", (e) =>
  submitAccount(e, "#delete-error", async () => {
    await api("deleteAccount", { userToken: storage.get(ACCOUNT_KEY)?.token, password: $("#delete-password").value });
    $("#delete-password").value = "";
    clearAccount();
  }),
);

// ---------- Avvio ----------
$("#app-version").textContent = `v${APP_VERSION}`;
fillLangSelect($("#lang-select"));
fillLangSelect($("#reg-lang"));
$("#lang-select").addEventListener("change", (e) => changeLang(e.target.value));
$("#reg-lang").addEventListener("change", (e) => changeLang(e.target.value));
changeLang(detectLang(storage.get(LANG_KEY)), { persist: false });

if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
const saved = storage.get(SESSION_KEY);
const urlCode = new URLSearchParams(location.search).get("g")?.toUpperCase();
if (saved && (!urlCode || urlCode === saved.code)) startGame(saved);
else showHome();
loadAccount();
