import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Movement, applyRouteColors, trustedShape } from "../src/geometry.js";
import { buildDepartures, planJourney, distance } from "../src/transit.js";
const read = (city) =>
  JSON.parse(
    readFileSync(
      new URL(`../public/data/${city}/network.json`, import.meta.url),
    ),
  );
function fixture(kind = "gtfs") {
  const n = {
    routes: [{ mode: "rail", color: "#ff0000" }],
    stops: [
      { lon: 0, lat: 0 },
      { lon: 0.02, lat: 0 },
    ],
    shapes: [
      [
        [0, 0],
        [0, 0.01],
        [0.02, 0.01],
        [0.02, 0],
      ],
    ],
    shapeInfo: [{ kind }],
  };
  n.stops.forEach((s) => (s.kind = 0));
  const s = {
    patterns: [
      [
        [0, 1],
        [0, 600],
        [0, 600],
      ],
    ],
    heads: ["B"],
  };
  return { n, s, trip: { t: [0, 0, 0, 0, 0], id: "a", start: 0 } };
}
test("vehicles follow every bend instead of a straight station chord", () => {
  const { n, s, trip } = fixture(),
    motion = new Movement(n, s);
  const f = motion.features([trip], 300)[0];
  assert(Math.abs(f.geometry.coordinates[1] - 0.01) < 0.00001);
  assert(
    f.geometry.coordinates[0] > 0.005 && f.geometry.coordinates[0] < 0.015,
  );
});
test("unavailable geometry never produces a vehicle or a journey line", () => {
  const { n, s, trip } = fixture("missing"),
    motion = new Movement(n, s);
  assert.deepEqual(motion.features([trip], 300), []);
  assert.equal(
    motion.leg({ route: 0, shape: 0, pattern: 0, board: 0, alight: 1 }),
    null,
  );
  assert.equal(trustedShape(n, 0), false);
});
test("planner preserves trip geometry and crops the same path used by movement", () => {
  const { n, s, trip } = fixture(),
    motion = new Movement(n, s);
  const result = planJourney(
    n,
    s,
    buildDepartures(s, [trip]),
    new Map(),
    0,
    1,
    0,
  );
  assert.equal(result.legs[0].shape, 0);
  assert.equal(result.legs[0].alight, 1);
  assert.deepEqual(motion.leg(result.legs[0]), n.shapes[0]);
  assert.equal(motion.leg({ walk: true, from: 0, to: 1 }), null);
});
test("stops project onto segments rather than snapping to a distant vertex", () => {
  const { n, s, trip } = fixture();
  n.shapes = [
    [
      [0, 0],
      [0.02, 0],
    ],
  ];
  n.stops = [
    { lon: 0.005, lat: 0 },
    { lon: 0.015, lat: 0 },
  ];
  const motion = new Movement(n, s),
    p = motion.path(trip);
  assert(Math.abs(p.positions[0] / p.d.at(-1) - 0.25) < 0.001);
  assert(Math.abs(p.positions[1] / p.d.at(-1) - 0.75) < 0.001);
});
test("all published missing shapes are empty, with provenance for every drawable path", () => {
  const cities = JSON.parse(
    readFileSync(new URL("../public/data/cities.json", import.meta.url)),
  ).cities;
  for (const city of cities) {
    const n = read(city.id);
    assert.equal(n.shapes.length, n.shapeInfo.length);
    n.shapes.forEach((shape, i) => {
      assert(n.shapeInfo[i].source);
      if (n.shapeInfo[i].kind === "missing") assert.deepEqual(shape, []);
      else assert(shape.length >= 2);
    });
  }
});
test("Sevilla bus and metro recover detailed, sourced alignments", () => {
  const n = read("sevilla");
  for (const feed of ["tussam", "metro-sevilla"]) {
    const routes = n.routes.filter((r) => r.feed === feed && r.stops.length);
    assert(routes.length);
    for (const r of routes)
      for (const d of r.directions) {
        assert(!d.approximate);
        assert(n.shapes[d.shape].length > d.stops.length * 2);
        assert(["municipal", "osm-route"].includes(n.shapeInfo[d.shape].kind));
      }
  }
});
test("Barcelona–Madrid AVE uses the rail corridor, not a diagonal across Spain", () => {
  const n = read("espana");
  const route = n.routes.find(
    (r) =>
      r.name === "AVE" &&
      r.directions.some(
        (d) =>
          n.stops[d.stops[0]].name === "Barcelona-Sants" &&
          n.stops[d.stops.at(-1)].name.startsWith("Madrid-Puerta"),
      ),
  );
  assert(route);
  const direction = route.directions.find(
    (d) =>
      n.stops[d.stops[0]].name === "Barcelona-Sants" &&
      n.stops[d.stops.at(-1)].name.startsWith("Madrid-Puerta"),
  );
  const shape = n.shapes[direction.shape];
  assert(shape.length > 500);
  assert.equal(n.shapeInfo[direction.shape].kind, "rail-network");
  const total = shape
    .slice(1)
    .reduce(
      (sum, p, i) =>
        sum +
        distance(
          { lon: p[0], lat: p[1] },
          { lon: shape[i][0], lat: shape[i][1] },
        ),
      0,
    );
  assert(total > 600000 && total < 720000, `rail corridor length: ${total}`);
  // Both Zaragoza and the Camp de Tarragona corridor lie on the traced route.
  for (const [point, tolerance] of [
    [{ lon: -0.9113, lat: 41.6587 }, 10000],
    [{ lon: 1.2727, lat: 41.1921 }, 1500],
  ])
    assert(
      Math.min(...shape.map((p) => distance(point, { lon: p[0], lat: p[1] }))) <
        tolerance,
    );
});
test("monochrome Madrid buses receive distinguishable stable colors; metro colors remain official", () => {
  const n = read("madrid");
  const metro = n.routes.find((r) => r.mode === "metro"),
    old = metro.color;
  applyRouteColors(n);
  assert.equal(metro.color, old);
  assert(
    new Set(n.routes.filter((r) => r.feed === "emt").map((r) => r.color))
      .size >= 8,
  );
  const colors = n.routes.map((r) => r.color);
  applyRouteColors(n);
  assert.deepEqual(
    n.routes.map((r) => r.color),
    colors,
  );
});

test("Renfe service families are distinguishable while preserving the source color", () => {
  const n = read("espana");
  const old = n.routes.map((r) => r.color);
  applyRouteColors(n);
  assert(
    new Set(n.routes.filter((r) => r.feed === "renfe").map((r) => r.color))
      .size >= 8,
  );
  n.routes.forEach((r, i) => assert.equal(r.sourceColor, old[i]));
});
