import { distance, transportGroup } from "./transit.js";

export function applyRouteColors(network) {
  const palette = [
    "#e4ad63",
    "#79bbd8",
    "#c38ee0",
    "#83c69a",
    "#df8c9b",
    "#c6c277",
    "#829ee2",
    "#eaa07b",
    "#65c4bd",
    "#b7a1e0",
    "#b2cf83",
    "#de9cc6",
  ];
  const counts = new Map();
  for (const r of network.routes) {
    const key = r.feed + ":" + r.color;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  for (const r of network.routes) {
    r.sourceColor ??= r.color;
    if (r.feed === "renfe") {
      const family = r.name.toUpperCase();
      r.color = family.includes("AVLO")
        ? "#accc73"
        : family.includes("AVE")
          ? "#ad94de"
          : family.includes("AVANT")
            ? "#e2c16d"
            : family.includes("ALVIA")
              ? "#81b8db"
              : family.includes("EUROMED")
                ? "#df9a78"
                : family.includes("INTERCITY")
                  ? "#d88daf"
                  : family.includes("MD")
                    ? "#d5aa6f"
                    : family.includes("REG")
                      ? "#8bbf91"
                      : "#8fc4bf";
      continue;
    }
    if (
      transportGroup(r) !== "bus" ||
      counts.get(r.feed + ":" + r.sourceColor) < 8
    )
      continue;
    let hash = 0;
    for (const char of r.id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    r.color = palette[hash % palette.length];
  }
}

function measure(coords) {
  const d = [0];
  for (let i = 1; i < coords.length; i++)
    d.push(
      d[i - 1] +
        distance(
          { lon: coords[i - 1][0], lat: coords[i - 1][1] },
          { lon: coords[i][0], lat: coords[i][1] },
        ),
    );
  return { coords, d };
}

export function pointAt(path, at) {
  const { coords, d } = path;
  if (!coords.length) return null;
  at = Math.max(0, Math.min(at, d.at(-1)));
  let lo = 1,
    hi = d.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (d[mid] < at) lo = mid + 1;
    else hi = mid;
  }
  const index = Math.min(lo, coords.length - 1),
    a = coords[Math.max(0, index - 1)],
    b = coords[index];
  const mix = index
    ? (at - d[index - 1]) / Math.max(0.001, d[index] - d[index - 1])
    : 0;
  return [a[0] + (b[0] - a[0]) * mix, a[1] + (b[1] - a[1]) * mix];
}

export function projectStop(path, stop, minimum = 0) {
  const cos = Math.cos((stop.lat * Math.PI) / 180);
  let best = null;
  for (let k = 1; k < path.coords.length; k++) {
    if (path.d[k] < minimum) continue;
    const a = path.coords[k - 1],
      b = path.coords[k],
      x = (b[0] - a[0]) * cos,
      y = b[1] - a[1];
    const length = path.d[k] - path.d[k - 1];
    let mix =
      x * x + y * y
        ? ((stop.lon - a[0]) * cos * x + (stop.lat - a[1]) * y) /
          (x * x + y * y)
        : 0;
    mix = Math.max(
      0,
      Math.min(1, mix),
      length ? (minimum - path.d[k - 1]) / length : 0,
    );
    const at = path.d[k - 1] + length * mix,
      point = [a[0] + (b[0] - a[0]) * mix, a[1] + (b[1] - a[1]) * mix];
    const error = distance(stop, { lon: point[0], lat: point[1] });
    // Prefer the first equally close occurrence, important at loops and termini.
    if (!best || error < best.error - 0.5) best = { at, error, point };
  }
  return best;
}

export function trustedShape(network, id) {
  return (
    network.shapes[id]?.length >= 2 &&
    ["gtfs", "municipal", "rail-network", "osm-route"].includes(
      network.shapeInfo?.[id]?.kind,
    )
  );
}

export class Movement {
  constructor(network, schedule) {
    this.n = network;
    this.s = schedule;
    this.cache = new Map();
    this.shapes = network.shapes.map((coords) =>
      coords.length >= 2 ? measure(coords) : null,
    );
  }
  path(trip) {
    const t = trip.t,
      key = t[2] + ":" + t[4];
    if (this.cache.has(key)) return this.cache.get(key);
    if (!trustedShape(this.n, t[2])) {
      this.cache.set(key, null);
      return null;
    }
    const shape = this.shapes[t[2]],
      pattern = this.s.patterns[t[4]],
      positions = [];
    let last = 0;
    for (const id of pattern[0]) {
      const stop = this.n.stops[id],
        match = projectStop(shape, stop, last);
      const tolerance =
        transportGroup(this.n.routes[t[0]]) === "bus" ? 150 : 550;
      if (!match || match.error > tolerance) {
        this.cache.set(key, null);
        return null;
      }
      positions.push(match.at);
      last = match.at;
    }
    const path = { ...shape, positions };
    this.cache.set(key, path);
    return path;
  }
  leg(leg) {
    if (leg.walk || leg.shape == null || leg.pattern == null) return null;
    const path = this.path({ t: [leg.route, 0, leg.shape, 0, leg.pattern] });
    if (!path) return null;
    const start = path.positions[leg.board],
      end = path.positions[leg.alight];
    if (!(end > start)) return null;
    return [
      pointAt(path, start),
      ...path.coords.filter((_, i) => path.d[i] > start && path.d[i] < end),
      pointAt(path, end),
    ];
  }
  features(trips, time) {
    const features = [];
    for (const trip of trips) {
      const t = trip.t,
        p = this.s.patterns[t[4]],
        local = time - trip.start;
      if (local < p[1][0] || local > p[2].at(-1)) continue;
      const path = this.path(trip);
      if (!path) continue;
      let k = 0;
      while (k < p[0].length - 1 && local > p[1][k + 1]) k++;
      const next = Math.min(k + 1, p[0].length - 1),
        a = p[2][k],
        b = p[1][next];
      const mix =
        local <= a ? 0 : Math.min(1, (local - a) / Math.max(1, b - a));
      const at =
          path.positions[k] + (path.positions[next] - path.positions[k]) * mix,
        r = this.n.routes[t[0]];
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: pointAt(path, at) },
        properties: {
          id: trip.id,
          route: t[0],
          color: r.color,
          mode: transportGroup(r),
          next: p[0][next],
          head: this.s.heads[t[3]],
          pattern: t[4],
          segment: k,
          fraction: mix,
          arrival: trip.start + p[1][next],
          current: p[0][k],
          frequency: trip.frequency,
        },
      });
    }
    return features;
  }
}
