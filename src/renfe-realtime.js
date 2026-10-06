import { projectStop } from "./geometry.js";
export const RENFE_POSITION_SOURCE =
  "https://data.renfe.com/es/dataset/ubicacion-vehiculos";
export const RENFE_LD_SOURCE = "https://tiempo-real.largorecorrido.renfe.com/";
export function renfeMatches(
  snapshot,
  trips,
  schedule,
  time,
  now = Date.now(),
) {
  const candidates = new Map();
  for (const trip of trips) {
    const index = Number(trip.id.split("-")[0]);
    if (!candidates.has(index)) candidates.set(index, []);
    candidates.get(index).push(trip);
  }
  return (snapshot?.vehicles || []).flatMap((vehicle) => {
    if (now - vehicle.timestamp > 90000) return [];
    const matches = (candidates.get(vehicle.tripIndex) || []).filter(
      (trip) => !vehicle.instanceId || trip.id === vehicle.instanceId,
    );
    const active = matches.filter((trip) => {
      const p = schedule.patterns[trip.t[4]],
        local = time - trip.start;
      return local >= p[1][0] && local <= p[2].at(-1);
    });
    // dayTrips includes yesterday as well as today. Never draw the same GPS
    // measurement twice or attach it to an ambiguous overnight occurrence.
    const trip =
      active.length === 1
        ? active[0]
        : matches.length === 1
          ? matches[0]
          : null;
    return trip ? [{ vehicle, trip }] : [];
  });
}
export function gpsProgress(movement, trip, vehicle) {
  const path = movement.path(trip);
  if (!path) return null;
  const match = projectStop(path, vehicle);
  if (!match || match.error > 550) return null;
  let segment = 0;
  while (
    segment < path.positions.length - 2 &&
    match.at > path.positions[segment + 1]
  )
    segment++;
  const a = path.positions[segment],
    b = path.positions[segment + 1];
  return {
    segment,
    fraction: Math.max(0, Math.min(1, (match.at - a) / Math.max(0.001, b - a))),
  };
}
export function renfeSnapshot(data, schedule, now = Date.now()) {
  const timestamp = Number(data.header?.timestamp) * 1000;
  if (
    !Number.isFinite(timestamp) ||
    now - timestamp > 90000 ||
    timestamp > now + 30000
  )
    throw new Error("Publicación Renfe caducada");
  const tripIndex = new Map(schedule.tripIds.map((id, index) => [id, index]));
  const vehicles = (data.entity || []).flatMap((entity) => {
    const v = entity.vehicle,
      position = v?.position,
      measured = Number(v?.timestamp) * 1000;
    const index = tripIndex.get("cercanias:" + v?.trip?.tripId);
    if (
      !position ||
      index === undefined ||
      !Number.isFinite(measured) ||
      now - measured > 90000 ||
      measured > now + 30000
    )
      return [];
    const lat = position.latitude,
      lon = position.longitude;
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      lat < 27 ||
      lat > 44 ||
      lon < -19 ||
      lon > 5
    )
      return [];
    return [
      {
        id: "renfe:" + entity.id,
        tripIndex: index,
        reference: schedule.tripIds[index],
        number: v.vehicle?.id || "",
        label: v.vehicle?.label || "",
        lat,
        lon,
        timestamp: measured,
        status: v.currentStatus,
        stopId: "cercanias:" + (v.stopId || ""),
        details: v,
      },
    ];
  });
  return { timestamp, vehicles };
}
export async function fetchRenfe(base, schedule) {
  const response = await fetch(base + "/api/renfe/positions", {
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error("Renfe no está disponible");
  return renfeSnapshot(await response.json(), schedule);
}
export function renfeLongDistanceSnapshot(
  data,
  schedule,
  network,
  trips,
  time,
  now = Date.now(),
) {
  const commercial = (value) =>
    /^\d+$/.test(String(value)) ? String(value).replace(/^0+(?=\d)/, "") : "";
  const vehicles = (data.trenes || []).flatMap((record) => {
    const timestamp = Number(record.time) * 1000,
      lat = record.latitud,
      lon = record.longitud;
    if (
      !Number.isFinite(timestamp) ||
      now - timestamp > 90000 ||
      timestamp > now + 30000 ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      lat < 27 ||
      lat > 44 ||
      lon < -19 ||
      lon > 5
    )
      return [];
    const number = commercial(record.codComercial);
    if (!number) return [];
    const matches = trips.filter((trip) => {
      const index = Number(trip.id.split("-")[0]),
        t = trip.t,
        p = schedule.patterns[t[4]][0];
      return (
        network.routes[t[0]].feed === "renfe" &&
        commercial(schedule.tripNames?.[index]) === number &&
        network.stops[p[0]].sourceId === record.codOrigen &&
        network.stops[p.at(-1)].sourceId === record.codDestino
      );
    });
    const active = matches.filter((trip) => {
      const p = schedule.patterns[trip.t[4]],
        local = time - trip.start;
      return local >= p[1][0] && local <= p[2].at(-1);
    });
    const trip =
      active.length === 1
        ? active[0]
        : matches.length === 1
          ? matches[0]
          : null;
    if (!trip) return [];
    const index = Number(trip.id.split("-")[0]);
    return [
      {
        id: "renfe:LD:" + number,
        instanceId: trip.id,
        tripIndex: index,
        reference: schedule.tripIds[index],
        number: String(record.codComercial),
        lat,
        lon,
        timestamp,
        stopId: "renfe:" + record.codEstSig,
        source: "long-distance",
        details: record,
      },
    ];
  });
  return {
    timestamp: vehicles.length
      ? Math.max(...vehicles.map((v) => v.timestamp))
      : now,
    vehicles,
  };
}
export async function fetchRenfeLongDistance(
  base,
  schedule,
  network,
  trips,
  time,
) {
  const response = await fetch(base + "/api/renfe/long-distance", {
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error("Larga distancia no disponible");
  return renfeLongDistanceSnapshot(
    await response.json(),
    schedule,
    network,
    trips,
    time,
  );
}
