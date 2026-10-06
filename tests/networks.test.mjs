import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  dayTrips,
  buildDepartures,
  buildTransfers,
  matchesTransport,
  planJourney,
} from "../src/transit.js";
import { fgcSnapshot } from "../src/realtime.js";
const read = (path) =>
  JSON.parse(readFileSync(new URL("../public/" + path, import.meta.url)));
const cities = read("data/cities.json").cities;
test("EMT keeps individual departures without multiplying advisory frequency windows", () => {
  const n = read("data/madrid/network.json"),
    s = read("data/madrid/schedule.json");
  const emt = n.meta.feeds.find((f) => f.id === "emt");
  assert.equal(emt.frequencyPolicy, "scheduled");
  assert(s.frequencies.every((f) => n.routes[s.trips[f[0]][0]].feed !== "emt"));
  const date = emt.start.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
  assert(dayTrips(s, date).length < s.trips.length * 3);
});
test("planner cannot alight where the operator prohibits it", () => {
  const n = {
    routes: [{ type: 3 }],
    stops: [0, 1, 2].map((id) => ({ id, kind: 0 })),
  };
  const s = {
    heads: ["C"],
    patterns: [
      [
        [0, 1, 2],
        [0, 60, 120],
        [0, 60, 120],
        [0, 0, 0],
        [0, 1, 0],
      ],
    ],
  };
  const deps = buildDepartures(s, [
    { t: [0, 0, 0, 0, 0], id: "trip", start: 0 },
  ]);
  assert.equal(planJourney(n, s, deps, new Map(), 0, 1, 0), null);
  assert.equal(planJourney(n, s, deps, new Map(), 0, 2, 0).duration, 120);
});
for (const city of cities)
  test(
    city.name + ": namespaced identifiers and valid merged references",
    () => {
      const n = read(city.network.replace("./", "")),
        s = read(city.schedule.replace("./", ""));
      assert.equal(n.routes.length, city.routes);
      for (const kind of ["routes", "stops"]) {
        assert.equal(new Set(n[kind].map((v) => v.id)).size, n[kind].length);
        assert(n[kind].every((v) => v.id.startsWith(v.feed + ":")));
      }
      assert.equal(new Set(s.tripIds).size, s.trips.length);
      for (const t of s.trips) {
        assert(
          n.routes[t[0]] &&
            s.services[t[1]] &&
            Array.isArray(n.shapes[t[2]]) &&
            s.heads[t[3]] !== undefined,
        );
        const p = s.patterns[t[4]];
        assert.equal(p[0].length, p[1].length);
        p[0].forEach((i, k) => {
          assert(n.stops[i]);
          assert(p[1][k] <= p[2][k]);
          if (k) assert(p[2][k - 1] <= p[1][k]);
        });
      }
      const last = s.services
        .flatMap((service) => [
          ...service.dates,
          ...(service.calendar ? [service.calendar[1]] : []),
        ])
        .sort()
        .at(-1);
      const beyond = new Date(
        `${last.slice(0, 4)}-${last.slice(4, 6)}-${last.slice(6, 8)}T12:00:00Z`,
      );
      beyond.setUTCDate(beyond.getUTCDate() + 2);
      assert.equal(dayTrips(s, beyond.toISOString().slice(0, 10)).length, 0);
    },
  );
test("extended GTFS types and FGC rail override match their transport group", () => {
  assert(matchesTransport({ type: 704 }, "bus"));
  assert(matchesTransport({ type: 900 }, "rail"));
  assert(matchesTransport({ type: 1, mode: "rail" }, "rail"));
  assert(!matchesTransport({ type: 1, mode: "rail" }, "metro"));
});
test("boarding restrictions, terminal stops and alighting restrictions are retained", () => {
  const s = {
    patterns: [
      [
        [0, 1, 2],
        [0, 60, 120],
        [0, 60, 120],
        [1, 0, 0],
        [0, 1, 0],
      ],
    ],
  };
  const deps = buildDepartures(s, [{ t: [0, 0, 0, 0, 0], start: 0 }]);
  assert(!deps.has(0));
  assert(deps.has(1));
  assert(!deps.has(2));
});
test("spatial transfers include neighboring cells and explicit prohibitions", () => {
  const n = {
    stops: [
      { id: "a", kind: 0, lat: 41.3899, lon: 2.1699 },
      { id: "b", kind: 0, lat: 41.3901, lon: 2.1701 },
      { id: "c", kind: 0, lat: 41.3902, lon: 2.1702 },
    ],
    transfers: [[0, 2, 3, 0]],
  };
  const transfers = buildTransfers(n);
  assert(transfers.get(0).some(([i]) => i === 1));
  assert(!transfers.get(0).some(([i]) => i === 2));
});
test("FGC only accepts fresh publications, valid coordinates and reported occupancy", () => {
  const now = Date.now(),
    meta = {
      metas: { default: { data_processed: new Date(now).toISOString() } },
    };
  const data = {
    results: [
      {
        id: "train",
        lin: "S1",
        geo_point_2d: { lat: 41.4, lon: 2.1 },
        en_hora: "True",
        ocupacio_mi_percent: "20",
        ocupacio_ri_percent: null,
        ocupacio_m1_percent: "40",
      },
      { id: "broken", geo_point_2d: { lat: null, lon: 2 } },
    ],
  };
  const snapshot = fgcSnapshot(data, meta, now);
  assert.equal(snapshot.vehicles.length, 1);
  assert.equal(snapshot.vehicles[0].occupancy, 30);
  assert.throws(() => fgcSnapshot(data, meta, now + 180001));
  assert.throws(() => fgcSnapshot(data, {}, now));
});
