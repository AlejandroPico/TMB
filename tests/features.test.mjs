import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NetworkFilters } from "../src/filters.js";
import {
  stationPlatforms,
  departureGroups,
  countdown,
  schematicPosition,
  schematicDirections,
} from "../src/boards.js";
test("route, stop and vehicle line selections are independent and survive parent toggles", () => {
  const n = {
    routes: [
      { mode: "metro", feed: "m", stops: [0, 1] },
      { mode: "bus", feed: "b", stops: [1, 2] },
    ],
  };
  const f = new NetworkFilters(n);
  f.set("routes", [0], false);
  assert.deepEqual(f.ids("routes"), [1]);
  assert.deepEqual(f.stops(), [0, 1, 2]);
  assert.deepEqual(f.ids("motion"), [0]);
  assert.deepEqual(f.state("routes", [0, 1]), { checked: false, mixed: true });
  f.set("routes", [0, 1], true);
  assert.deepEqual(new Set(f.ids("routes")), new Set([0, 1]));
  f.only([1]);
  assert.deepEqual(f.stops(), [1, 2]);
  assert.deepEqual(f.ids("motion"), [1]);
});
test("station display joins platforms and co-located rail lines without merging neighbouring bus stops", () => {
  const n = {
    stops: [
      {
        name: "Plaça Catalunya",
        kind: 0,
        mode: "metro",
        lat: 41,
        lon: 2,
        parent: "a",
      },
      {
        name: "Barcelona - Plaça Catalunya",
        kind: 0,
        mode: "rail",
        lat: 41.0001,
        lon: 2,
        parent: "b",
      },
      { name: "Catalunya", kind: 0, mode: "bus", lat: 41, lon: 2 },
      { name: "Catalunya", kind: 0, mode: "rail", lat: 42, lon: 2 },
    ],
  };
  assert.deepEqual(stationPlatforms(n, 0), [0, 1]);
  assert.deepEqual(stationPlatforms(n, 2), [2]);
});
test("station groups preserve every line and direction, with two unique forthcoming departures", () => {
  const s = { heads: ["A", "B"] };
  const d = (route, head, time, id) => ({
    time,
    trip: { id, t: [route, 0, 0, head] },
  });
  const groups = departureGroups(
    [
      d(0, 0, 10, "x"),
      d(0, 0, 10, "x"),
      d(0, 0, 20, "y"),
      d(0, 0, 30, "z"),
      d(0, 1, 11, "a"),
      d(1, 0, 12, "b"),
    ],
    s,
  );
  assert.equal(groups.length, 3);
  assert.deepEqual(
    groups[0].departures.map((d) => d.time),
    [10, 20],
  );
});
test("second counters clamp expired arrivals and retain hour-long services", () => {
  assert.equal(countdown(64), "01:04");
  assert.equal(countdown(0), "00:00");
  assert.equal(countdown(-5), "00:00");
  assert.equal(countdown(3601), "60:01");
  assert.equal(countdown(NaN), "—");
});
test("linear view places short workings correctly and never puts reversed or disconnected branches on a track", () => {
  const d = { stops: [0, 1, 2, 3] };
  assert.equal(schematicPosition(d, [[1, 2]], 0, 0.5), 1.5);
  assert.equal(schematicPosition(d, [[2, 1]], 0, 0.5), null);
  assert.equal(schematicPosition(d, [[2, 4]], 0, 0.5), null);
  assert.equal(schematicPosition(d, [[0, 1, 4]], 0, 0.5), null);
  assert.equal(
    schematicPosition({ stops: [0, 1, 0, 2] }, [[0, 1, 0, 2]], 2, 0.5),
    2.5,
  );
});
test("linear view adds branches while reusing tracks for identical and short-working patterns", () => {
  const rows = schematicDirections(
    [{ stops: [0, 1, 2, 3] }, { stops: [3, 2, 1, 0] }],
    [[[1, 2]], [[0, 1, 4]], [[0, 1, 4]], [[4, 1, 0]], [[8]]],
  );
  assert.deepEqual(
    rows.map((r) => r.stops),
    [
      [0, 1, 2, 3],
      [3, 2, 1, 0],
      [0, 1, 4],
      [4, 1, 0],
    ],
  );
});
test("Barcelona contains both TRAM networks and the T4 extension to Verdaguer", () => {
  const n = JSON.parse(
    readFileSync(
      new URL("../public/data/barcelona/network.json", import.meta.url),
    ),
  );
  const routes = n.routes.filter((r) => r.feed?.startsWith("tram-"));
  assert.equal(routes.length, 6);
  const t4 = routes.find((r) => r.name === "T4");
  assert.ok(t4);
  assert.ok(t4.stops.some((i) => n.stops[i].name.includes("Verdaguer")));
  for (const r of routes) {
    assert.equal(r.mode, "tram");
    for (const d of r.directions)
      assert.equal(n.shapeInfo[d.shape].kind, "gtfs");
  }
});
