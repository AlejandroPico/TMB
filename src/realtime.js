const FGC =
  "https://dadesobertes.fgc.cat/api/explore/v2.1/catalog/datasets/posicionament-dels-trens";
export const FGC_SOURCE = "https://geotren.fgc.cat/";
import { gpsProgress } from "./renfe-realtime.js";

const candidateCache = new WeakMap();
export function fgcFeatures(
  snapshot,
  network,
  schedule,
  movement,
  now = Date.now(),
) {
  if (!snapshot || now - snapshot.timestamp > (snapshot.maxAge || 180000))
    return [];
  let candidates = candidateCache.get(schedule);
  if (!candidates) {
    candidates = new Map();
    const seen = new Set();
    for (const t of schedule.trips) {
      const r = network.routes[t[0]];
      if (r.feed !== "fgc") continue;
      const key = t[0] + ":" + t[2] + ":" + t[4];
      if (seen.has(key)) continue;
      seen.add(key);
      const terminal = network.stops[schedule.patterns[t[4]][0].at(-1)];
      const destination = terminal.parent || terminal.id;
      const group = r.name + ":" + destination;
      if (!candidates.has(group)) candidates.set(group, []);
      candidates.get(group).push({ t });
    }
    candidateCache.set(schedule, candidates);
  }
  return snapshot.vehicles.flatMap((v) => {
    const route = network.routes.findIndex(
      (r) => r.feed === "fgc" && r.name === v.line,
    );
    if (route < 0) return [];
    const matched = (
      candidates.get(v.line + ":fgc:" + v.destination) || []
    ).flatMap((trip) => {
      const progress = gpsProgress(movement, trip, v);
      return progress ? [{ trip, progress }] : [];
    });
    // Projection is only a diagram coordinate. The map always uses the published point.
    const match = matched[0],
      p = match && schedule.patterns[match.trip.t[4]];
    return [
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [v.lon, v.lat] },
        properties: {
          id: v.id,
          line: v.line,
          route,
          mode: "rail",
          actual: true,
          measured: v.timestamp,
          maxAge: snapshot.maxAge || 180000,
          color: network.routes[route].color,
          linearUnavailable: !match,
          pattern: match?.trip.t[4],
          segment: match?.progress.segment,
          fraction: match?.progress.fraction,
          next: p?.[0][Math.min(match.progress.segment + 1, p[0].length - 1)],
          current: p?.[0][match.progress.segment],
          head: v.destination,
        },
      },
    ];
  });
}

export function fgcSnapshot(records, metadata, now = Date.now()) {
  const timestamp = Date.parse(metadata.metas?.default?.data_processed);
  if (
    !Number.isFinite(timestamp) ||
    now - timestamp > 180000 ||
    timestamp - now > 30000
  )
    throw new Error("La publicación de FGC no está actualizada.");
  const vehicles = records.results.flatMap((r) => {
    const { lat, lon } = r.geo_point_2d || {};
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      lat < 39 ||
      lat > 44 ||
      lon < -1 ||
      lon > 4
    )
      return [];
    const occupancy = ["mi", "ri", "m1", "m2"]
      .map((car) => r["ocupacio_" + car + "_percent"])
      .filter((value) => value !== null && value !== undefined && value !== "")
      .map(Number)
      .filter((value) => Number.isFinite(value) && value >= 0 && value <= 100);
    return [
      {
        id: String(r.id),
        line: String(r.lin || ""),
        lat,
        lon,
        destination: r.desti || "",
        trainType: r.tipus_unitat || "",
        station: r.estacionat_a || "",
        onTime:
          r.en_hora === "True" ? true : r.en_hora === "False" ? false : null,
        occupancy: occupancy.length
          ? Math.round(occupancy.reduce((a, b) => a + b, 0) / occupancy.length)
          : null,
        timestamp,
        details: r,
      },
    ];
  });
  return { timestamp, vehicles };
}

export function geotrenSnapshot(data, receivedAt = Date.now()) {
  if (!Array.isArray(data.features))
    throw new Error("Respuesta Geotren inválida");
  const vehicles = data.features.flatMap((f) => {
    const r = f.properties || {},
      point = f.geometry?.coordinates;
    if (
      f.geometry?.type !== "Point" ||
      !point ||
      !r.id ||
      !Number.isFinite(point[0]) ||
      !Number.isFinite(point[1]) ||
      point[1] < 39 ||
      point[1] > 44 ||
      point[0] < -1 ||
      point[0] > 4
    )
      return [];
    const values = ["mi", "ri", "m1", "m2"]
      .map((k) => r.ocupacio?.[k]?.percent)
      .filter((v) => v != null && v !== "")
      .map(Number)
      .filter((v) => Number.isFinite(v) && v >= 0 && v <= 100);
    return [
      {
        id: String(r.id),
        line: r.lin || "",
        lat: point[1],
        lon: point[0],
        destination: r.desti || "",
        station: r.estacionat_a || "",
        trainType: r.tipus_unitat || "",
        onTime: typeof r.en_hora === "boolean" ? r.en_hora : null,
        occupancy: values.length
          ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
          : null,
        timestamp: receivedAt,
        details: r,
      },
    ];
  });
  // Geotren publishes no per-position measurement timestamp. This is receipt time,
  // never the occupancy timestamp or a fabricated GPS measurement time.
  return {
    timestamp: receivedAt,
    timestampKind: "received",
    maxAge: 20000,
    vehicles,
  };
}
export async function fetchFGC() {
  const response = await fetch(
    "https://geotren.fgc.cat/tracker/trens.geojson?_=" + Date.now(),
    { cache: "no-store", signal: AbortSignal.timeout(7000) },
  );
  if (!response.ok) throw new Error("Geotren no está disponible ahora.");
  return geotrenSnapshot(await response.json());
}
