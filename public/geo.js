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

// Zone già pronte su Roma (coordinate approssimate).
export const ROME_PRESETS = [
  {
    id: "centro",
    name: "Centro storico",
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
    name: "Trastevere",
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
    name: "Villa Borghese",
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
    name: "Dentro le Mura Aureliane",
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
    name: "Colosseo · 1 km",
    zone: { type: "circle", center: { lat: 41.8902, lng: 12.4922 }, radius: 1000 },
  },
];
