import { test } from "node:test";
import assert from "node:assert/strict";
import { stationTiming, motionState, motionSpeedLimit } from "../src/dwell.js";
import { Movement } from "../src/geometry.js";

const pattern = () => [
  [0, 1, 2],
  [0, 120, 240],
  [0, 120, 240],
  [0, 0, 0],
  [0, 0, 0],
];
test("published dwell is preserved exactly, including short waits and termini", () => {
  const p = pattern();
  p[2] = [7, 152, 251];
  const timing = stationTiming(p, [0, 800, 1600], { mode: "bus" });
  assert.deepEqual(timing.departures, p[2]);
  assert.deepEqual(timing.sources, ["schedule", "schedule", "schedule"]);
  const at = motionState(p, timing, 120);
  assert.equal(at.segment, 1);
  assert.equal(at.fraction, 0);
  assert.equal(at.stopped, true);
  assert.equal(motionState(p, timing, 151).stopped, true);
  assert.equal(motionState(p, timing, 152).stopped, false);
});
for (const [mode, seconds] of [
  ["bus", 18],
  ["metro", 25],
  ["tram", 20],
  ["rail", 30],
])
  test(`${mode} stops, resumes and reaches the next station at the original arrival`, () => {
    const p = pattern(),
      original = structuredClone(p);
    const timing = stationTiming(p, [0, 800, 1600], { mode });
    assert.equal(timing.departures[1], 120 + seconds);
    assert.equal(timing.sources[1], "simulated");
    for (const time of [120, 121, 120 + seconds - 0.1]) {
      const state = motionState(p, timing, time);
      assert.equal(state.stopped, true);
      assert.equal(state.fraction, 0);
      assert.equal(state.segment, 1);
    }
    assert(motionState(p, timing, 121 + seconds).fraction > 0);
    assert.equal(motionState(p, timing, 240).segment, 2);
    assert.deepEqual(p, original);
    assert.equal(timing.departures[0], 0);
    assert.equal(timing.departures[2], 240);
  });
test("no passenger service means no invented dwell, but one-way boarding still stops", () => {
  const p = pattern();
  p[3][1] = p[4][1] = 1;
  assert.equal(
    stationTiming(p, [0, 800, 1600], { mode: "bus" }).sources[1],
    null,
  );
  p[4][1] = 0;
  assert.equal(
    stationTiming(p, [0, 800, 1600], { mode: "bus" }).sources[1],
    "simulated",
  );
});
test("short or already fast segments have no artificial pause or overspeed", () => {
  const p = pattern();
  p[1][2] = p[2][2] = 125;
  assert.equal(
    stationTiming(p, [0, 800, 820], { mode: "bus" }).sources[1],
    null,
  );
  p[1][2] = p[2][2] = 160;
  const route = { mode: "rail", feed: "cercanias" };
  const t = stationTiming(p, [0, 800, 2800], route);
  assert(t.departures[1] < 160);
  assert((2000 * 3.6) / (160 - t.departures[1]) <= motionSpeedLimit(route));
  assert.equal(stationTiming(p, [0, 800, 3100], route).sources[1], null);
});
test("map and linear movement share a stationary station segment then depart on the same trace", () => {
  const n = {
    routes: [{ mode: "bus", color: "#f00" }],
    stops: [
      { lon: 0, lat: 0 },
      { lon: 0.005, lat: 0 },
      { lon: 0.01, lat: 0 },
    ],
    shapes: [
      [
        [0, 0],
        [0.005, 0],
        [0.01, 0],
      ],
    ],
    shapeInfo: [{ kind: "gtfs" }],
  };
  const s = { patterns: [pattern()], heads: ["Terminal"] };
  const trip = { t: [0, 0, 0, 0, 0], id: "bus", start: 36000 },
    m = new Movement(n, s);
  const arrival = m.features([trip], 36120)[0],
    paused = m.features([trip], 36130)[0];
  assert.deepEqual(arrival.geometry.coordinates, [0.005, 0]);
  assert.deepEqual(paused.geometry.coordinates, arrival.geometry.coordinates);
  assert.equal(paused.properties.stopped, true);
  assert.equal(paused.properties.current, 1);
  assert.equal(paused.properties.segment, 1);
  assert.equal(paused.properties.fraction, 0);
  assert.equal(paused.properties.departure, 36138);
  assert.equal(paused.properties.arrival, 36240);
  assert(m.features([trip], 36140)[0].geometry.coordinates[0] > 0.005);
  assert.deepEqual(
    m.features([trip], 36240)[0].geometry.coordinates,
    [0.01, 0],
  );
  assert.deepEqual(m.features([trip], 36241), []);
});
