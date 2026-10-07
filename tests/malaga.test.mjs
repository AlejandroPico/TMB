import test from "node:test";
import assert from "node:assert/strict";
import {
  malagaTimestamp,
  malagaSnapshot,
  malagaFeatures,
} from "../src/malaga-realtime.js";
import { Movement } from "../src/geometry.js";
import { detailURL, readDetailURL } from "../src/detail-links.js";

test("Málaga local timestamps respect summer/winter offsets and reject ambiguous or invalid civil time", () => {
  assert.equal(
    malagaTimestamp("2026-10-07 16:00:00"),
    Date.parse("2026-10-07T14:00:00Z"),
  );
  assert.equal(
    malagaTimestamp("2026-01-07 16:00:00"),
    Date.parse("2026-01-07T15:00:00Z"),
  );
  for (const text of [
    "2026-10-25 02:30:00",
    "2026-03-29 02:30:00",
    "2026-02-30 12:00:00",
    "no time",
  ])
    assert.ok(Number.isNaN(malagaTimestamp(text)));
});
const now = Date.parse("2026-10-07T14:00:00Z");
const row = {
  geometry: { type: "Point", coordinates: ["-4.42", "36.72"] },
  properties: {
    codBus: "594",
    codLinea: "1.0",
    codParIni: "103",
    sentido: "1",
    last_update: "2026-10-07 16:00:00",
  },
};
test("Málaga accepts published physical bus numbers but rejects stale/future/invalid positions", () => {
  const v = malagaSnapshot([row], now).vehicles[0];
  assert.equal(v.id, "emt-malaga:bus:594");
  assert.equal(v.routeCode, "1");
  assert.equal(v.timestamp, now);
  assert.deepEqual(malagaSnapshot([row], now + 90001).vehicles, []);
  assert.deepEqual(malagaSnapshot([row], now - 30001).vehicles, []);
  assert.deepEqual(
    malagaSnapshot(
      [{ ...row, geometry: { type: "Point", coordinates: [0, null] } }],
      now,
    ).vehicles,
    [],
  );
  assert.throws(() => malagaSnapshot({ error: "unavailable" }, now));
});
const network = {
  routes: [
    {
      feed: "emt-malaga",
      sourceId: "1",
      name: "1",
      color: "#123",
      mode: "bus",
    },
  ],
  stops: [
    { feed: "emt-malaga", code: "103", lon: -4.42, lat: 36.72 },
    { feed: "emt-malaga", code: "104", lon: -4.41, lat: 36.72 },
  ],
  shapes: [
    [
      [-4.42, 36.72],
      [-4.41, 36.72],
    ],
  ],
  shapeInfo: [{ kind: "gtfs" }],
};
const schedule = {
  trips: [[0, 0, 0, 0, 0]],
  heads: ["Destino"],
  patterns: [
    [
      [0, 1],
      [0, 600],
      [0, 600],
    ],
  ],
};
test("Málaga projects onto a uniquely identified diagram but preserves the actual map coordinate", () => {
  const snapshot = malagaSnapshot(
    [{ ...row, geometry: { type: "Point", coordinates: [-4.415, 36.7201] } }],
    now,
  );
  const features = malagaFeatures(
    snapshot,
    network,
    schedule,
    new Movement(network, schedule),
    now,
  );
  assert.equal(features.length, 1);
  assert.deepEqual(features[0].geometry.coordinates, [-4.415, 36.7201]);
  assert.equal(features[0].properties.linearUnavailable, false);
  assert.ok(
    features[0].properties.fraction > 0.4 &&
      features[0].properties.fraction < 0.6,
  );
  assert.equal(features[0].properties.number, "594");
  assert.deepEqual(
    malagaFeatures(
      snapshot,
      network,
      schedule,
      new Movement(network, schedule),
      now + 90001,
    ),
    [],
  );
});
test("ambiguous direction or unavailable geometry cannot invent diagram positions", () => {
  const snapshot = malagaSnapshot([row], now);
  const reverse = {
    ...schedule,
    patterns: [
      ...schedule.patterns,
      [
        [1, 0],
        [0, 600],
        [0, 600],
      ],
    ],
    trips: [...schedule.trips, [0, 0, 0, 0, 1]],
  };
  const movement = {
    path: () => ({
      coords: network.shapes[0],
      d: [0, 900],
      positions: [0, 900],
    }),
  };
  assert.equal(
    malagaFeatures(snapshot, network, reverse, movement, now)[0].properties
      .linearUnavailable,
    true,
  );
  assert.equal(
    malagaFeatures(snapshot, network, schedule, { path: () => null }, now)[0]
      .properties.linearUnavailable,
    true,
  );
});
test("physical bus links reopen the live observation without converting into a dated simulation", () => {
  const link = detailURL(
    "https://alejandropico.github.io/TMB/?detail=vehicle&at=3&date=2026-10-06&start=1",
    {
      city: "malaga",
      kind: "observed",
      ref: "emt-malaga:bus:594",
    },
  );
  assert.deepEqual(readDetailURL(link), {
    kind: "observed",
    ref: "emt-malaga:bus:594",
  });
  assert.equal(new URL(link).searchParams.has("at"), false);
});
