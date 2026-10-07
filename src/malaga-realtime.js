import { projectStop } from "./geometry.js";

export const MALAGA_SOURCE =
  "https://datosabiertos.malaga.eu/es/dataset/ubicaciones-de-autobuses-emt-en-tiempo-real";
export const MALAGA_FEED =
  "https://datosabiertos.malaga.eu/recursos/transporte/EMT/EMTlineasUbicaciones/lineasyubicaciones.geojson";
const localClock = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Madrid",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

// The publisher uses local civil time without an offset. Reject the ambiguous
// autumn hour instead of turning an old measurement into a fresh one.
export function malagaTimestamp(text) {
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text || "")) return NaN;
  const utc = Date.parse(text.replace(" ", "T") + "Z");
  const candidates = [60, 120]
    .map((offset) => utc - offset * 60000)
    .filter(
      (value) => Number.isFinite(value) && localClock.format(value) === text,
    );
  return candidates.length === 1 ? candidates[0] : NaN;
}

export function malagaSnapshot(data, now = Date.now()) {
  const rows = Array.isArray(data) ? data : data?.features;
  if (!Array.isArray(rows)) throw new Error("Publicación EMT Málaga inválida");
  const vehicles = rows.flatMap((row) => {
    const p = row.properties || {},
      coords = row.geometry?.coordinates;
    const timestamp = malagaTimestamp(p.last_update),
      lon = Number(coords?.[0]),
      lat = Number(coords?.[1]);
    const number = String(p.codBus ?? row.codBus ?? ""),
      routeCode = Number(p.codLinea ?? row.codLinea);
    if (
      !/^\d{1,8}$/.test(number) ||
      !Number.isFinite(routeCode) ||
      routeCode < 0 ||
      row.geometry?.type !== "Point" ||
      !Number.isFinite(lon) ||
      !Number.isFinite(lat) ||
      lon < -5 ||
      lon > -3 ||
      lat < 36 ||
      lat > 38 ||
      !Number.isFinite(timestamp) ||
      now - timestamp > 90000 ||
      timestamp - now > 30000
    )
      return [];
    return [
      {
        id: "emt-malaga:bus:" + number,
        number,
        routeCode: String(routeCode),
        referenceCode: String(p.codParIni ?? row.codParIni ?? ""),
        direction: String(p.sentido ?? row.sentido ?? ""),
        lon,
        lat,
        timestamp,
        details: p,
      },
    ];
  });
  const unique = new Map();
  for (const v of vehicles) {
    if (!unique.has(v.id) || unique.get(v.id).timestamp < v.timestamp)
      unique.set(v.id, v);
  }
  return { vehicles: [...unique.values()], timestamp: now };
}

const cache = new WeakMap();
export function malagaFeatures(
  snapshot,
  network,
  schedule,
  movement,
  now = Date.now(),
) {
  let candidates = cache.get(schedule);
  if (!candidates) {
    candidates = new Map();
    const seen = new Set();
    for (const t of schedule.trips) {
      if (network.routes[t[0]].feed !== "emt-malaga") continue;
      const key =
        t[0] + ":" + t[2] + ":" + schedule.patterns[t[4]][0].join(",");
      if (seen.has(key)) continue;
      seen.add(key);
      if (!candidates.has(t[0])) candidates.set(t[0], []);
      candidates.get(t[0]).push({ t });
    }
    cache.set(schedule, candidates);
  }
  return (snapshot?.vehicles || []).flatMap((v) => {
    if (now - v.timestamp > 90000 || v.timestamp - now > 30000) return [];
    const route = network.routes.findIndex(
      (r) => r.feed === "emt-malaga" && r.sourceId === v.routeCode,
    );
    if (route < 0) return [];
    const reference = network.stops.findIndex(
      (st) => st.feed === "emt-malaga" && st.code === v.referenceCode,
    );
    const matches = (candidates.get(route) || []).flatMap((trip) => {
      const stops = schedule.patterns[trip.t[4]][0];
      if (reference < 0 || !stops.includes(reference)) return [];
      const path = movement.path(trip),
        projected = path && projectStop(path, v);
      if (!projected || projected.error > 150) return [];
      let segment = 0;
      while (
        segment < path.positions.length - 2 &&
        projected.at > path.positions[segment + 1]
      )
        segment++;
      if (stops[segment] !== reference && stops[segment + 1] !== reference)
        return [];
      const a = path.positions[segment],
        b = path.positions[segment + 1];
      return [
        {
          trip,
          segment,
          fraction: Math.max(
            0,
            Math.min(1, (projected.at - a) / Math.max(0.001, b - a)),
          ),
        },
      ];
    });
    const match = matches.length === 1 ? matches[0] : null;
    const stops = match && schedule.patterns[match.trip.t[4]][0];
    return [
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [v.lon, v.lat] },
        properties: {
          id: v.id,
          number: v.number,
          route,
          mode: "bus",
          actual: true,
          measured: v.timestamp,
          color: network.routes[route].color,
          positionSource: "emt-malaga",
          publishedDetails: v.details,
          reference: reference >= 0 ? reference : null,
          direction: v.direction,
          linearUnavailable: !match,
          pattern: match?.trip.t[4],
          segment: match?.segment,
          fraction: match?.fraction,
          current: match ? stops[match.segment] : null,
          next: match
            ? stops[Math.min(match.segment + 1, stops.length - 1)]
            : null,
          head: match ? schedule.heads[match.trip.t[3]] : "",
        },
      },
    ];
  });
}

export async function fetchMalaga(apiBase) {
  const response = await fetch(apiBase + "/api/malaga/positions", {
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("EMT Málaga no disponible");
  return malagaSnapshot(await response.json());
}
