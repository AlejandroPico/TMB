import { projectStop } from "./geometry.js";
export const RENFE_POSITION_SOURCE =
  "https://data.renfe.com/es/dataset/ubicacion-vehiculos";
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
