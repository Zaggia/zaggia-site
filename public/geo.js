// Geometria condivisa tra browser e funzione Netlify.
// Le zone sono { type: "circle", center: {lat,lng}, radius } oppure
// { type: "polygon", points: [{lat,lng}, ...] }.

const EARTH_RADIUS_M = 6371000;
const rad = (d) => (d * Math.PI) / 180;

export function distanceM(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

// Punto a `dist` metri da `p` nella direzione `bearing` (radianti, 0 = nord).
export function offsetM(p, dist, bearing) {
  return {
    lat: p.lat + (dist * Math.cos(bearing)) / 111320,
    lng: p.lng + (dist * Math.sin(bearing)) / (111320 * Math.cos(rad(p.lat))),
  };
}

export function centroid(points) {
  const n = points.length;
  return {
    lat: points.reduce((s, p) => s + p.lat, 0) / n,
    lng: points.reduce((s, p) => s + p.lng, 0) / n,
  };
}

// Zona ridotta di un fattore 0..1 verso il suo centro.
export function scaleZone(zone, factor) {
  if (!zone || factor >= 1) return zone;
  if (zone.type === "circle") return { ...zone, radius: zone.radius * factor };
  const c = centroid(zone.points);
  return {
    ...zone,
    points: zone.points.map((p) => ({
      lat: c.lat + (p.lat - c.lat) * factor,
      lng: c.lng + (p.lng - c.lng) * factor,
    })),
  };
}

export function insideZone(zone, p) {
  if (!zone || !p) return true;
  if (zone.type === "circle") return distanceM(zone.center, p) <= zone.radius;
  // Ray casting; a scala cittadina lat/lng si possono trattare come piane.
  let inside = false;
  const pts = zone.points;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];
    if (
      a.lat > p.lat !== b.lat > p.lat &&
      p.lng < ((b.lng - a.lng) * (p.lat - a.lat)) / (b.lat - a.lat) + a.lng
    ) {
      inside = !inside;
    }
  }
  return inside;
}

// Tempi chiave della partita, tutti in ms epoch.
export function timeline(game) {
  const s = game.settings;
  const startedAt = game.startedAt ?? 0;
  const huntStart = startedAt + s.headStartMin * 60000;
  const endsAt = huntStart + s.durationMin * 60000;
  return { startedAt, huntStart, endsAt };
}

// Zona effettiva in questo istante, considerando il restringimento.
export function currentZone(game, now) {
  if (!game.zone) return null;
  const shrinkTo = game.settings.shrinkTo ?? 100;
  if (game.status !== "running" || shrinkTo >= 100) return game.zone;
  const { huntStart, endsAt } = timeline(game);
  const progress = Math.min(1, Math.max(0, (now - huntStart) / (endsAt - huntStart)));
  return scaleZone(game.zone, 1 - (1 - shrinkTo / 100) * progress);
}

// Zone già pronte a Roma (coordinate approssimate). I nomi sono chiavi di traduzione.
export const ROME_PRESETS = [
  {
    id: "centro",
    nameKey: "preset.centro",
    zone: {
      type: "polygon",
      points: [
        { lat: 41.9107, lng: 12.4763 },
        { lat: 41.9081, lng: 12.483 },
        { lat: 41.901, lng: 12.487 },
        { lat: 41.8958, lng: 12.4826 },
        { lat: 41.8925, lng: 12.477 },
        { lat: 41.8925, lng: 12.4705 },
        { lat: 41.9015, lng: 12.4665 },
        { lat: 41.9058, lng: 12.4735 },
      ],
    },
  },
  {
    id: "trastevere",
    nameKey: "preset.trastevere",
    zone: {
      type: "polygon",
      points: [
        { lat: 41.8932, lng: 12.4693 },
        { lat: 41.8905, lng: 12.4776 },
        { lat: 41.888, lng: 12.4795 },
        { lat: 41.882, lng: 12.4738 },
        { lat: 41.88, lng: 12.47 },
        { lat: 41.889, lng: 12.461 },
        { lat: 41.8935, lng: 12.4652 },
      ],
    },
  },
  {
    id: "borghese",
    nameKey: "preset.borghese",
    zone: {
      type: "polygon",
      points: [
        { lat: 41.9115, lng: 12.4768 },
        { lat: 41.9105, lng: 12.4815 },
        { lat: 41.9092, lng: 12.4888 },
        { lat: 41.9142, lng: 12.4922 },
        { lat: 41.9172, lng: 12.4835 },
        { lat: 41.917, lng: 12.479 },
      ],
    },
  },
  {
    id: "mura",
    nameKey: "preset.mura",
    zone: {
      type: "polygon",
      points: [
        { lat: 41.9114, lng: 12.4762 },
        { lat: 41.909, lng: 12.4888 },
        { lat: 41.9095, lng: 12.5012 },
        { lat: 41.9065, lng: 12.5085 },
        { lat: 41.8915, lng: 12.516 },
        { lat: 41.8857, lng: 12.5098 },
        { lat: 41.879, lng: 12.5015 },
        { lat: 41.8735, lng: 12.5005 },
        { lat: 41.874, lng: 12.4915 },
        { lat: 41.876, lng: 12.481 },
        { lat: 41.882, lng: 12.4738 },
        { lat: 41.8845, lng: 12.46 },
        { lat: 41.896, lng: 12.462 },
        { lat: 41.9085, lng: 12.472 },
      ],
    },
  },
  {
    id: "colosseo",
    nameKey: "preset.colosseo",
    zone: { type: "circle", center: { lat: 41.8902, lng: 12.4922 }, radius: 1000 },
  },
];

// Le città italiane giocabili. Le zone di Roma sono già pronte; per le altre c'è un cerchio attorno al centro
// (1 o 2 km). L'host può comunque disegnare una zona a mano ovunque in Italia.
const around = (lat, lng) => [
  { id: "center", nameKey: "preset.center", zone: { type: "circle", center: { lat, lng }, radius: 1000 } },
  { id: "wide", nameKey: "preset.wide", zone: { type: "circle", center: { lat, lng }, radius: 2000 } },
];

const CITY_CENTERS = [
  ["milano", 45.4642, 9.19],
  ["napoli", 40.847, 14.256],
  ["torino", 45.0703, 7.6869],
  ["palermo", 38.1157, 13.3615],
  ["genova", 44.4075, 8.934],
  ["bologna", 44.4949, 11.3426],
  ["firenze", 43.7696, 11.2558],
  ["bari", 41.1288, 16.87],
  ["catania", 37.5023, 15.0873],
  ["venezia", 45.434, 12.3388],
  ["verona", 45.4384, 10.9916],
  ["messina", 38.1938, 15.554],
  ["padova", 45.4064, 11.8768],
  ["trieste", 45.6495, 13.7768],
  ["brescia", 45.5416, 10.2118],
  ["parma", 44.8015, 10.3279],
  ["modena", 44.6471, 10.9252],
  ["perugia", 43.1107, 12.3908],
  ["cagliari", 39.2238, 9.1217],
  ["pisa", 43.7228, 10.4017],
  ["bergamo", 45.6983, 9.6773],
  ["lecce", 40.3515, 18.175],
  ["salerno", 40.6824, 14.7681],
  ["ancona", 43.6158, 13.5189],
  ["pescara", 42.4618, 14.2161],
  ["trento", 46.0748, 11.1217],
  ["bolzano", 46.4983, 11.3548],
  ["reggio-calabria", 38.1113, 15.6473],
  ["sassari", 40.7259, 8.5556],
  ["livorno", 43.5485, 10.3106],
  ["rimini", 44.0678, 12.5695],
  ["ravenna", 44.4184, 12.2035],
  ["vicenza", 45.5455, 11.5354],
  ["udine", 46.0711, 13.2346],
  ["siracusa", 37.0755, 15.2866],
  ["laquila", 42.3498, 13.3995],
  ["campobasso", 41.5603, 14.6627],
  ["potenza", 40.6404, 15.8056],
  ["catanzaro", 38.9098, 16.5877],
  ["aosta", 45.7371, 7.3201],
];

export const CITIES = [
  { id: "roma", center: { lat: 41.8967, lng: 12.4822 }, presets: ROME_PRESETS },
  ...CITY_CENTERS.map(([id, lat, lng]) => ({ id, center: { lat, lng }, presets: around(lat, lng) })),
];

export function nearestCity(pos) {
  return CITIES.reduce((best, c) => (distanceM(c.center, pos) < distanceM(best.center, pos) ? c : best), CITIES[0]);
}
