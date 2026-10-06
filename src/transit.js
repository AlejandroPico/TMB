export const distance = (a, b) => {
  const p = Math.PI / 180,
    dy = (b.lat - a.lat) * p,
    dx = (b.lon - a.lon) * p;
  return (
    6371000 *
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin(dy / 2) ** 2 +
          Math.cos(a.lat * p) * Math.cos(b.lat * p) * Math.sin(dx / 2) ** 2,
      ),
    )
  );
};
export function transportMode(route) {
  if (route.mode) return route.mode;
  const t = route.type;
  if (t === 3 || (t >= 700 && t < 800)) return "bus";
  if (t === 1 || (t >= 400 && t < 500)) return "metro";
  if (t === 2 || (t >= 100 && t < 200)) return "rail";
  if (t === 0 || (t >= 900 && t < 1000)) return "tram";
  if (t === 7 || (t >= 1400 && t < 1500)) return "funicular";
  return "other";
}
export const transportGroup = (route) =>
  ["metro", "rail", "tram", "funicular"].includes(transportMode(route))
    ? "rail"
    : transportMode(route);
export const matchesTransport = (route, mode) =>
  mode === "all" ||
  transportMode(route) === mode ||
  (mode === "rail" && transportGroup(route) === "rail");
export const clock = (t) =>
  `${String(Math.floor((((t % 86400) + 86400) % 86400) / 3600)).padStart(2, "0")}:${String(Math.floor(t / 60) % 60).padStart(2, "0")}`;
export function madridNow() {
  const f = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(new Date());
  return {
    date: f.slice(0, 10),
    time: +f.slice(11, 13) * 3600 + +f.slice(14, 16) * 60 + +f.slice(17, 19),
  };
}
export function activeService(s, date) {
  const key = date.replaceAll("-", "");
  if (s.removed.includes(key)) return false;
  if (s.dates.includes(key)) return true;
  const c = s.calendar;
  if (!c || key < c[0] || key > c[1]) return false;
  return !!c[2 + ((new Date(date + "T12:00:00Z").getUTCDay() + 6) % 7)];
}
export function dayTrips(schedule, date) {
  const previous = new Date(date + "T12:00:00Z");
  previous.setUTCDate(previous.getUTCDate() - 1);
  const dates = [date, previous.toISOString().slice(0, 10)],
    out = [],
    freq = new Map();
  for (const f of schedule.frequencies) {
    if (!freq.has(f[0])) freq.set(f[0], []);
    freq.get(f[0]).push(f);
  }
  for (let day = 0; day < 2; day++) {
    const active = schedule.services.map((s) => activeService(s, dates[day]));
    schedule.trips.forEach((t, i) => {
      if (!active[t[1]]) return;
      const intervals = freq.get(i);
      if (intervals) {
        for (const f of intervals)
          for (let time = f[1]; time < f[2]; time += f[3])
            out.push({
              id: `${i}-${day}-${time}`,
              t,
              start: time - day * 86400,
              frequency: f[4] !== 1,
            });
      } else
        out.push({
          id: `${i}-${day}`,
          t,
          start: t[5] - day * 86400,
          frequency: false,
        });
    });
  }
  return out;
}
export function buildDepartures(schedule, trips) {
  const map = new Map();
  for (const trip of trips) {
    const p = schedule.patterns[trip.t[4]];
    p[0].forEach((s, k) => {
      if (k === p[0].length - 1 || p[3]?.[k] === 1) return;
      if (!map.has(s)) map.set(s, []);
      map.get(s).push({ trip, k, time: trip.start + p[2][k] });
    });
  }
  for (const list of map.values()) list.sort((a, b) => a.time - b.time);
  return map;
}
export function lowerBound(list, time) {
  let l = 0,
    r = list.length;
  while (l < r) {
    const m = (l + r) >> 1;
    if (list[m].time < time) l = m + 1;
    else r = m;
  }
  return l;
}
export function nextDepartures(map, stop, time, count = 8) {
  const list = map.get(stop) || [],
    start = lowerBound(list, time);
  return list.slice(start, start + count);
}
class Heap {
  a = [];
  push(v) {
    let i = this.a.push(v) - 1;
    while (i) {
      const p = (i - 1) >> 1;
      if (this.a[p][0] <= v[0]) break;
      this.a[i] = this.a[p];
      i = p;
    }
    this.a[i] = v;
  }
  pop() {
    const first = this.a[0],
      v = this.a.pop();
    if (this.a.length) {
      let i = 0;
      while (i * 2 + 1 < this.a.length) {
        let c = i * 2 + 1;
        if (c + 1 < this.a.length && this.a[c + 1][0] < this.a[c][0]) c++;
        if (this.a[c][0] >= v[0]) break;
        this.a[i] = this.a[c];
        i = c;
      }
      this.a[i] = v;
    }
    return first;
  }
}
export function buildTransfers(network) {
  const groups = new Map(),
    map = new Map();
  network.stops.forEach((s, i) => {
    if (s.kind !== 0) return;
    const key = s.parent || s.id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(i);
  });
  const platforms = network.stops
    .map((s, i) => ({ s, i }))
    .filter((x) => x.s.kind === 0);
  const cells = new Map();
  const cell = (s) => [Math.floor(s.lat / 0.002), Math.floor(s.lon / 0.002)];
  for (const point of platforms) {
    const key = cell(point.s).join(",");
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(point);
  }
  for (const { s, i } of platforms) {
    const [lat, lon] = cell(s),
      candidates = new Map();
    for (let a = -1; a <= 1; a++)
      for (let b = -1; b <= 1; b++)
        for (const point of cells.get(`${lat + a},${lon + b}`) || [])
          candidates.set(point.i, point);
    for (const j of groups.get(s.parent || s.id) || [])
      candidates.set(j, { i: j, s: network.stops[j] });
    const near = [...candidates.values()].filter(
      (x) =>
        x.i !== i &&
        ((s.parent && s.parent === x.s.parent) || distance(s, x.s) < 140),
    );
    map.set(
      i,
      near.map((x) => [
        x.i,
        Math.max(
          s.parent && s.parent === x.s.parent ? 180 : 60,
          Math.ceil(distance(s, x.s) / 1.2) + 45,
        ),
      ]),
    );
  }
  for (const [from, to, type, cost] of network.transfers || []) {
    const links = (map.get(from) || []).filter(([v]) => v !== to);
    if (type !== 3) links.push([to, cost || 60]);
    map.set(from, links);
  }
  return map;
}
export function planJourney(
  network,
  schedule,
  departures,
  transfers,
  origin,
  destination,
  start,
  { accessible = false, mode = "all", minutes = 180 } = {},
) {
  const n = network.stops.length,
    dist = new Float64Array(n).fill(Infinity),
    prev = new Array(n),
    heap = new Heap(),
    targets = new Set();
  const siblings = (i) =>
    network.stops
      .map((s, j) => ({ s, j }))
      .filter(
        (x) =>
          x.s.kind === 0 &&
          (x.j === i ||
            (network.stops[i].parent &&
              network.stops[i].parent === x.s.parent) ||
            (network.stops[i].kind === 1 &&
              x.s.parent === network.stops[i].id)),
      )
      .map((x) => x.j);
  for (const i of siblings(origin)) {
    if (accessible && network.stops[i].accessible !== 1) continue;
    dist[i] = start;
    heap.push([start, i]);
  }
  if (destination != null)
    for (const i of siblings(destination)) targets.add(i);
  let end = -1;
  const horizon = start + minutes * 60;
  while (heap.a.length) {
    const [time, u] = heap.pop();
    if (time !== dist[u]) continue;
    if (time > horizon) break;
    if (targets.has(u)) {
      end = u;
      break;
    }
    for (const [v, cost] of transfers.get(u) || []) {
      if (accessible && network.stops[v].accessible !== 1) continue;
      const at = time + cost;
      if (at < dist[v]) {
        dist[v] = at;
        prev[v] = { from: u, walk: true, start: time, end: at };
        heap.push([at, v]);
      }
    }
    const list = departures.get(u) || [];
    for (
      let pos = lowerBound(list, time);
      pos < list.length && list[pos].time <= horizon;
      pos++
    ) {
      const d = list[pos],
        t = d.trip.t,
        r = network.routes[t[0]];
      if (!matchesTransport(r, mode)) continue;
      const p = schedule.patterns[t[4]];
      for (let k = d.k + 1; k < p[0].length; k++) {
        const v = p[0][k];
        if (p[4]?.[k] === 1) continue;
        if (accessible && network.stops[v].accessible !== 1) continue;
        const at = d.trip.start + p[1][k];
        if (at >= dist[v]) continue;
        dist[v] = at;
        prev[v] = {
          from: u,
          walk: false,
          route: t[0],
          trip: d.trip.id,
          shape: t[2],
          pattern: t[4],
          board: d.k,
          alight: k,
          head: schedule.heads[t[3]],
          start: d.time,
          end: at,
          stops: k - d.k,
          via: p[0].slice(d.k, k + 1),
        };
        heap.push([at, v]);
      }
    }
  }
  if (destination == null)
    return [...dist].flatMap((at, stop) =>
      Number.isFinite(at) && at <= horizon
        ? [{ stop, minutes: Math.ceil((at - start) / 60) }]
        : [],
    );
  if (end < 0) return null;
  const legs = [];
  let node = end;
  while (prev[node]) {
    const leg = prev[node];
    legs.unshift({ ...leg, to: node });
    node = leg.from;
  }
  return {
    legs,
    departure: start,
    arrival: dist[end],
    duration: dist[end] - start,
  };
}
