import { clock } from "./transit.js";

const kinds = new Set(["stop", "route", "vehicle", "gps", "observed"]);

export function detailURL(base, { city, kind, ref, date, time, start }) {
  const url = new URL(base);
  for (const key of ["detail", "ref", "date", "at", "start"])
    url.searchParams.delete(key);
  url.searchParams.set("city", city);
  if (kinds.has(kind) && ref != null) {
    url.searchParams.set("detail", kind);
    url.searchParams.set("ref", ref);
    if (kind === "vehicle") {
      url.searchParams.set("date", date);
      url.searchParams.set("at", String(Math.floor(time)));
      url.searchParams.set("start", String(start));
    }
  }
  return url.href;
}

export function readDetailURL(base) {
  const p = new URL(base).searchParams;
  const kind = p.get("detail"),
    ref = p.get("ref");
  if (!kinds.has(kind) || !ref || ref.length > 512) return null;
  if (kind !== "vehicle") return { kind, ref };
  const date = p.get("date"),
    time = Number(p.get("at")),
    start = Number(p.get("start"));
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date || "") ||
    !Number.isFinite(Date.parse(date)) ||
    new Date(date).toISOString().slice(0, 10) !== date ||
    !p.has("at") ||
    !p.has("start") ||
    !Number.isFinite(time) ||
    time < 0 ||
    time >= 172800 ||
    !Number.isFinite(start) ||
    start < -86400 ||
    start >= 172800
  )
    return null;
  return { kind, ref, date, time, start };
}

export function serviceReference(schedule, trip) {
  const index = Number(trip.id.split("-")[0]);
  const reference = schedule.tripIds[index] || trip.id;
  const originTime = trip.start + (schedule.patterns[trip.t[4]]?.[1]?.[0] || 0);
  return { reference, label: "Servicio " + clock(originTime) };
}

export function serviceStatus(schedule, trip, time, located = false) {
  const pattern = schedule.patterns[trip.t[4]];
  if (time < trip.start + pattern[1][0]) return "Salida pendiente";
  if (time > trip.start + pattern[2].at(-1)) return "Servicio finalizado";
  return located
    ? "En camino · posición estimada"
    : "En servicio · sin posición disponible";
}

export function resolveServiceLink(schedule, trips, reference, start) {
  const index = schedule.tripIds.indexOf(reference);
  if (index < 0) return null;
  return (
    trips.find(
      (trip) => Number(trip.id.split("-")[0]) === index && trip.start === start,
    ) || null
  );
}
