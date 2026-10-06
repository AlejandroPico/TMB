import { distance, transportGroup } from "./transit.js";
export const stationName = (name) =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^barcelona\s+[-–—]?\s*/, "")
    .replace(/^(placa|pl\.)\s+/, "")
    .replace(/[^a-z0-9]/g, "");
export function stationPlatforms(network, index) {
  const st = network.stops[index];
  return network.stops.flatMap((s, i) =>
    s.kind === 0 &&
    (i === index ||
      (st.parent && s.parent === st.parent) ||
      (transportGroup(st) === "rail" &&
        transportGroup(s) === "rail" &&
        stationName(st.name) === stationName(s.name) &&
        distance(st, s) < 350))
      ? [i]
      : [],
  );
}
export function departureGroups(departures, schedule) {
  const groups = new Map(),
    seen = new Set();
  for (const d of [...departures].sort((a, b) => a.time - b.time)) {
    const unique = d.trip.id + ":" + d.time;
    if (seen.has(unique)) continue;
    seen.add(unique);
    const route = d.trip.t[0],
      head = schedule.heads[d.trip.t[3]],
      key = route + ":" + head;
    if (!groups.has(key)) groups.set(key, { route, head, departures: [] });
    if (groups.get(key).departures.length < 2)
      groups.get(key).departures.push(d);
  }
  return [...groups.values()].sort(
    (a, b) => a.route - b.route || a.head.localeCompare(b.head),
  );
}
export function countdown(seconds) {
  if (!Number.isFinite(seconds)) return "—";
  const value = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}
// Match progress on a trip's actual stop sequence to an ordered schematic direction.
// Branches/short workings are positioned only when both adjacent stops occur in order.
export function schematicStopPositions(direction, pattern) {
  const positions = [];
  let next = 0;
  for (let i = 0; i < direction.stops.length && next < pattern[0].length; i++) {
    if (direction.stops[i] === pattern[0][next]) {
      positions.push(i);
      next++;
    }
  }
  return next === pattern[0].length ? positions : null;
}
export function schematicPosition(direction, pattern, segment, fraction) {
  const positions = schematicStopPositions(direction, pattern);
  if (!positions) return null;
  const a = positions[segment],
    b = positions[Math.min(segment + 1, positions.length - 1)];
  return a === undefined
    ? null
    : a + (b - a) * Math.max(0, Math.min(1, fraction));
}
export function schematicDirections(directions, patterns) {
  const rows = directions.map((d) => ({ ...d, stops: [...d.stops] }));
  for (const pattern of [...patterns].sort(
    (a, b) => b[0].length - a[0].length,
  )) {
    const stops = pattern[0];
    if (stops.length < 2) continue;
    const covered = rows.some((row) => schematicStopPositions(row, pattern));
    if (!covered) rows.push({ stops: [...stops] });
  }
  return rows;
}
