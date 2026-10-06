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
// Build once per network. Named, co-located rail platforms and published GTFS
// transfers are connections; nearby bus stops alone do not imply a transfer.
export function stationConnections(network) {
  const served = network.stops.map(() => new Set()),
    parents = new Map(),
    names = new Map();
  network.routes.forEach((r, i) => r.stops.forEach((st) => served[st]?.add(i)));
  network.stops.forEach((st, i) => {
    if (st.kind !== 0) return;
    if (st.parent) {
      if (!parents.has(st.parent)) parents.set(st.parent, []);
      parents.get(st.parent).push(i);
    }
    if (transportGroup(st) === "rail") {
      const key = stationName(st.name);
      if (!names.has(key)) names.set(key, []);
      names.get(key).push(i);
    }
  });
  const peers = network.stops.map(
    (st, i) =>
      new Set([
        i,
        ...(parents.get(st.parent || st.id) || []),
        ...(transportGroup(st) === "rail"
          ? (names.get(stationName(st.name)) || []).filter(
              (j) => distance(st, network.stops[j]) < 350,
            )
          : []),
      ]),
  );
  const connections = peers.map(
    (indices) => new Set([...indices].flatMap((i) => [...served[i]])),
  );
  for (const [a, b, type] of network.transfers || []) {
    if (![0, 1, 2].includes(type) || !peers[a] || !peers[b]) continue;
    for (const i of peers[a])
      for (const j of peers[b])
        for (const route of served[j]) connections[i].add(route);
  }
  return connections;
}
export function transferGroups(network, connections, own) {
  const identity = (i) => network.routes[i].transferKey || network.routes[i].id;
  const groups = new Map();
  for (const index of connections) {
    const key = identity(index);
    if (index === own || key === identity(own)) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(index);
  }
  return [...groups.values()];
}
export function calendarNotice(feed, date) {
  const key = date?.replaceAll("-", "");
  if (
    !key ||
    !feed?.start ||
    !feed?.end ||
    (feed.start <= key && key <= feed.end)
  )
    return "";
  const format = (d) => `${d.slice(6, 8)}/${d.slice(4, 6)}/${d.slice(0, 4)}`;
  return `Calendario publicado: ${format(feed.start)}–${format(feed.end)}. No cubre la fecha seleccionada; no se estiman vehículos.`;
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
export function joinStopSequences(a, b) {
  const common = a.filter((st) => b.includes(st));
  if (
    common.length < 2 ||
    new Set(a).size !== a.length ||
    new Set(b).size !== b.length
  )
    return null;
  if (!schematicStopPositions({ stops: b }, [common])) return null;
  const result = [];
  let ai = 0,
    bi = 0;
  for (const anchor of [...common, null]) {
    const aj = anchor === null ? a.length : a.indexOf(anchor),
      bj = anchor === null ? b.length : b.indexOf(anchor);
    const left = a.slice(ai, aj),
      right = b.slice(bi, bj);
    // Two different branches between the same anchors cannot be flattened.
    const section = schematicStopPositions({ stops: left }, [right])
      ? left
      : schematicStopPositions({ stops: right }, [left])
        ? right
        : null;
    if (!section) return null;
    result.push(...section);
    if (anchor !== null) result.push(anchor);
    ai = aj + 1;
    bi = bj + 1;
  }
  return new Set(result).size === result.length ? result : null;
}
export function schematicDirections(directions, patterns, combine = false) {
  const rows = directions.map((d) => ({ ...d, stops: [...d.stops] }));
  for (const pattern of [...patterns].sort(
    (a, b) => b[0].length - a[0].length,
  )) {
    const stops = pattern[0];
    if (stops.length < 2) continue;
    const covered = rows.some((row) => schematicStopPositions(row, pattern));
    if (!covered) rows.push({ stops: [...stops] });
  }
  if (combine) {
    let changed = true;
    while (changed) {
      changed = false;
      outer: for (let i = 0; i < rows.length; i++)
        for (let j = i + 1; j < rows.length; j++) {
          const stops = joinStopSequences(rows[i].stops, rows[j].stops);
          if (stops) {
            rows[i] = { ...rows[i], stops };
            rows.splice(j, 1);
            changed = true;
            break outer;
          }
        }
    }
  }
  return rows;
}
