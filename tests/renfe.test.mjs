import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  renfeSnapshot,
  gpsProgress,
  renfeMatches,
} from "../src/renfe-realtime.js";
import { Movement } from "../src/geometry.js";
import {
  stationConnections,
  transferGroups,
  schematicDirections,
  schematicStopPositions,
  joinStopSequences,
} from "../src/boards.js";
const read = (name) =>
  JSON.parse(
    readFileSync(
      new URL(`../public/data/espana/${name}.json`, import.meta.url),
    ),
  );
test("R3 is one Barcelona commercial line, retains both directions and never transfers to itself", () => {
  const n = read("network"),
    routes = n.routes.filter(
      (r) => r.feed === "cercanias" && r.name === "R3" && r.nucleus === "51",
    );
  assert.equal(routes.length, 1);
  const r = routes[0],
    index = n.routes.indexOf(r);
  assert(r.aliases.length > 10);
  assert(
    r.directions.some((d) => n.stops[d.stops.at(-1)].name.includes("Querol")),
  );
  assert(r.directions.some((d) => n.stops[d.stops[0]].name.includes("Querol")));
  const rows = schematicDirections(r.directions, [], true);
  assert.equal(rows.length, 2);
  for (const d of r.directions)
    assert(rows.some((row) => schematicStopPositions(row, [d.stops])));
  const st = n.stops.findIndex(
    (s) => s.name.includes("Sant Mart") && s.name.includes("Centelles"),
  );
  assert(st >= 0);
  assert(
    !transferGroups(n, stationConnections(n)[st], index)
      .flat()
      .some((i) => n.routes[i].transferKey === r.transferKey),
  );
});
test("linear directions join compatible partial journeys while retaining genuine branches", () => {
  assert.deepEqual(
    joinStopSequences([1, 2, 3, 4], [3, 4, 5, 6]),
    [1, 2, 3, 4, 5, 6],
  );
  assert.deepEqual(joinStopSequences([1, 2, 3, 4], [1, 4, 5]), [1, 2, 3, 4, 5]);
  assert.equal(joinStopSequences([1, 2, 3, 4], [4, 3, 2, 1]), null);
  assert.equal(joinStopSequences([1, 2, 4, 5], [1, 3, 4, 5]), null);
  assert.equal(joinStopSequences([1, 2, 3], [3, 4, 5]), null);
});
test("Regional Express uses the operator's Barcelona tunnel, avoiding the 32 km infrastructure detour", () => {
  const n = read("network"),
    s = read("schedule"),
    m = new Movement(n, s);
  const index = n.routes.findIndex(
    (r) =>
      r.feed === "renfe" &&
      r.name === "REG.EXP." &&
      r.description.includes("Reus") &&
      r.description.includes("Barcelona"),
  );
  assert(index >= 0);
  const t = s.trips.find(
    (t) =>
      t[0] === index &&
      s.patterns[t[4]][0].some((i) => n.stops[i].name === "Barcelona-Sants") &&
      n.shapeInfo[t[2]].kind === "gtfs",
  );
  assert(t);
  const p = s.patterns[t[4]][0],
    k = p.findIndex((i) => n.stops[i].name === "Barcelona-Sants"),
    path = m.path({ t });
  assert(path);
  assert(n.stops[p[k + 1]].name.includes("Passeig"));
  const length = path.positions[k + 1] - path.positions[k];
  assert(length > 2000 && length < 3000, `tunnel length: ${length}`);
});
test("fresh Renfe GPS joins exact GTFS trip IDs, ignoring missing coordinates, unknown IDs and stale measurements", () => {
  const now = 1700000000000,
    schedule = { tripIds: ["cercanias:abc"] },
    record = {
      id: "VP_1",
      vehicle: {
        trip: { tripId: "abc" },
        position: { latitude: 41, longitude: 2 },
        timestamp: String(now / 1000),
        vehicle: { id: "123" },
      },
    };
  const data = {
    header: { timestamp: String(now / 1000) },
    entity: [
      record,
      {
        ...record,
        id: "missing",
        vehicle: { ...record.vehicle, position: undefined },
      },
      {
        ...record,
        id: "stale",
        vehicle: { ...record.vehicle, timestamp: String(now / 1000 - 100) },
      },
      {
        ...record,
        id: "unknown",
        vehicle: { ...record.vehicle, trip: { tripId: "xyz" } },
      },
    ],
  };
  const snapshot = renfeSnapshot(data, schedule, now);
  assert.equal(snapshot.vehicles.length, 1);
  assert.equal(snapshot.vehicles[0].number, "123");
  assert.throws(() => renfeSnapshot(data, schedule, now + 100000));
});
test("Renfe rejects impossible timetable speeds while legitimate movements and GPS progress remain available", () => {
  const n = {
    routes: [{ feed: "cercanias", name: "R3", mode: "rail", color: "#fff" }],
    stops: [
      { lon: 2, lat: 41 },
      { lon: 2.1, lat: 41 },
    ],
    shapes: [
      [
        [2, 41],
        [2.1, 41],
      ],
    ],
    shapeInfo: [{ kind: "gtfs" }],
  };
  const s = {
      patterns: [
        [
          [0, 1],
          [0, 10],
          [0, 10],
        ],
      ],
      heads: ["B"],
    },
    trip = { id: "0-0", t: [0, 0, 0, 0, 0], start: 0 },
    m = new Movement(n, s);
  assert.deepEqual(m.features([trip], 5), []);
  const progress = gpsProgress(m, trip, { lon: 2.05, lat: 41 });
  assert.equal(progress.segment, 0);
  assert(Math.abs(progress.fraction - 0.5) < 0.01);
  assert.equal(gpsProgress(m, trip, { lon: 3, lat: 41 }), null);
  s.patterns[0][1][1] = s.patterns[0][2][1] = 600;
  assert.equal(new Movement(n, s).features([trip], 300).length, 1);
  s.patterns[0][1][1] = s.patterns[0][2][1] = 0;
  assert.deepEqual(new Movement(n, s).features([trip], 0), []);
});
test("commercial connection badges group corridors while retaining each navigable destination", () => {
  const n = {
    routes: [
      { id: "r3", transferKey: "cer:51:R3" },
      { id: "r3variant", transferKey: "cer:51:R3" },
      { id: "ave1", transferKey: "renfe:AVE" },
      { id: "ave2", transferKey: "renfe:AVE" },
      { id: "r3other", transferKey: "cer:62:R3" },
    ],
  };
  assert.deepEqual(transferGroups(n, [0, 1, 2, 3, 4], 0), [[2, 3], [4]]);
});

test("GPS is matched once across today's and yesterday's occurrences and ambiguous dates are withheld", () => {
  const now = 1700000000000,
    schedule = {
      patterns: [
        [
          [0, 1],
          [0, 600],
          [0, 600],
        ],
      ],
    },
    t = [0, 0, 0, 0, 0, 300];
  const today = { id: "0-0", t, start: 300 },
    yesterday = { id: "0-1", t, start: 300 - 86400 };
  const snapshot = { vehicles: [{ tripIndex: 0, timestamp: now }] };
  assert.deepEqual(
    renfeMatches(snapshot, [today, yesterday], schedule, 400, now).map(
      (x) => x.trip.id,
    ),
    ["0-0"],
  );
  assert.deepEqual(
    renfeMatches(snapshot, [today, yesterday], schedule, 400 - 86400, now).map(
      (x) => x.trip.id,
    ),
    ["0-1"],
  );
  assert.deepEqual(
    renfeMatches(snapshot, [today, yesterday], schedule, 200, now),
    [],
  );
  assert.deepEqual(
    renfeMatches(snapshot, [today, yesterday], schedule, 400, now + 100000),
    [],
  );
});
