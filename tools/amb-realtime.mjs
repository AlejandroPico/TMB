import bindings from "gtfs-realtime-bindings";
export const AMB_FEED =
  "https://www.ambmobilitat.cat/transit/trips-updates/trips.bin";
export const AMB_SOURCE =
  "https://www.amb.cat/ca/web/area-metropolitana/dades-obertes/cataleg/detall/-/dataset/servei-gtfs-real-time-autobusos/6332347/11692";

export function ambSnapshot(bytes, now = Date.now()) {
  const message = bindings.transit_realtime.FeedMessage.decode(bytes);
  const timestamp = Number(message.header.timestamp) * 1000;
  if (
    !Number.isFinite(timestamp) ||
    now - timestamp > 90000 ||
    timestamp - now > 30000
  )
    throw new Error("La publicación de AMB ha caducado.");
  const trips = message.entity.flatMap((entity) => {
    const update = entity.tripUpdate;
    if (
      !update ||
      entity.isDeleted ||
      [3, 7].includes(update.trip?.scheduleRelationship)
    )
      return [];
    const measured = Number(update.timestamp) * 1000 || timestamp;
    if (now - measured > 90000 || measured - now > 30000) return [];
    const stops = update.stopTimeUpdate.flatMap((stop) => {
      if ([1, 2].includes(stop.scheduleRelationship)) return [];
      // Only explicit predictions: a delay alone does not establish an arrival.
      const time = Number(stop.arrival?.time || stop.departure?.time) * 1000;
      if (!Number.isFinite(time) || time < now - 30000 || !stop.stopId)
        return [];
      return [{ id: stop.stopId, time }];
    });
    return stops.length
      ? [
          {
            id: update.trip.tripId,
            route: update.trip.routeId,
            vehicle: update.vehicle?.label || update.vehicle?.id || null,
            stops,
          },
        ]
      : [];
  });
  return { timestamp, trips };
}

export async function fetchAMB() {
  const response = await fetch(AMB_FEED, {
    signal: AbortSignal.timeout(10000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("AMB no disponible");
  return ambSnapshot(new Uint8Array(await response.arrayBuffer()));
}
