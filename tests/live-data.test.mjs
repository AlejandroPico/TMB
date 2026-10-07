import test from "node:test";
import assert from "node:assert/strict";
import bindings from "gtfs-realtime-bindings";
import {
  displayVehicles,
  ibusSnapshot,
  liveBoardState,
  fgcVehicleName,
} from "../src/live-data.js";
import { ambSnapshot } from "../tools/amb-realtime.mjs";
import { fgcFeatures, geotrenSnapshot } from "../src/realtime.js";
import { Movement } from "../src/geometry.js";

const now = Date.now();
const estimated = { properties: { id: "model" } };
const real = { properties: { id: "gps", actual: true, measured: now } };
test("live mode never falls back to timetable vehicles, including stale feeds", () => {
  assert.deepEqual(displayVehicles("live", [estimated], []), []);
  assert.deepEqual(displayVehicles("live", [estimated], [real], now), [real]);
  assert.deepEqual(
    displayVehicles("live", [estimated], [real], now + 90001),
    [],
  );
  assert.deepEqual(
    displayVehicles("schedule", [estimated, real], [real], now),
    [estimated],
  );
});
test("iBus preserves true arrival predictions and accepts a fresh empty response", () => {
  const response = {
    timestamp: now,
    parades: [
      {
        linies_trajectes: [
          {
            nom_linia: "128",
            desti_trajecte: "El Coll",
            propers_busos: [{ temps_arribada: now + 120000, id_bus: 300 }],
          },
        ],
      },
    ],
  };
  const snapshot = ibusSnapshot(response, now);
  assert.equal(snapshot.arrivals[0].vehicle, 300);
  assert.equal(snapshot.arrivals[0].time, now + 120000);
  assert.deepEqual(
    ibusSnapshot({ timestamp: now, parades: [] }, now).arrivals,
    [],
  );
  assert.throws(() => ibusSnapshot(response, now + 90001));
});
test("an unavailable arrival prediction cannot become a scheduled countdown in live mode", () => {
  assert.equal(
    liveBoardState({ source: "schedule" }, "live", now),
    "unavailable",
  );
  assert.equal(
    liveBoardState({ source: "live", timestamp: now - 90001 }, "live", now),
    "unavailable",
  );
  assert.equal(
    liveBoardState(
      { source: "live", timestamp: now, arrivals: [] },
      "live",
      now,
    ),
    "live",
  );
  assert.equal(
    liveBoardState({ source: "unavailable" }, "schedule", now),
    "schedule",
  );
});
test("FGC names do not expose opaque train or record identifiers", () => {
  assert.equal(
    fgcVehicleName({ id: "6c4bdae302747640fd55c10d40|682dc6e001", line: "L6" }),
    "Tren L6",
  );
  assert.equal(fgcVehicleName({ id: "long-hash" }), "Tren FGC");
});
test("Geotren retains published points and distinguishes receipt from measurement time", () => {
  const snapshot = geotrenSnapshot(
    {
      features: [
        {
          geometry: { type: "Point", coordinates: [2.1, 41.4] },
          properties: {
            id: "hash",
            lin: "L6",
            en_hora: true,
            ocupacio: {
              dt: "2020-01-01",
              mi: { percent: 0 },
              ri: { percent: 40 },
            },
          },
        },
      ],
    },
    now,
  );
  assert.equal(snapshot.vehicles[0].occupancy, 20);
  assert.equal(snapshot.vehicles[0].timestamp, now);
  assert.equal(snapshot.timestampKind, "received");
  assert.equal(snapshot.maxAge, 20000);
  const network = { routes: [{ feed: "fgc", name: "L6" }] },
    schedule = { trips: [] };
  assert.deepEqual(
    fgcFeatures(snapshot, network, schedule, {}, now + 20001),
    [],
  );
  assert.throws(() => geotrenSnapshot({ error: "failure" }, now));
});
const encoded = (entities, timestamp = now) =>
  bindings.transit_realtime.FeedMessage.encode(
    bindings.transit_realtime.FeedMessage.fromObject({
      header: {
        gtfsRealtimeVersion: "1.0",
        timestamp: Math.floor(timestamp / 1000),
      },
      entity: entities,
    }),
  ).finish();
test("AMB publishes arrivals, never fabricated coordinates or vehicles from a trip ID", () => {
  const bytes = encoded([
    {
      id: "1",
      tripUpdate: {
        trip: { tripId: "a" },
        stopTimeUpdate: [
          { stopId: "001", arrival: { time: Math.floor(now / 1000) + 120 } },
        ],
      },
    },
  ]);
  const snapshot = ambSnapshot(bytes, now);
  assert.equal(snapshot.trips[0].stops[0].id, "001");
  assert.equal(snapshot.trips[0].vehicle, null);
  assert.equal(snapshot.trips[0].lat, undefined);
  assert.throws(() => ambSnapshot(bytes, now + 90001));
});
test("AMB skips cancelled trips, skipped stops and delay-only updates", () => {
  const bytes = encoded([
    {
      id: "cancelled",
      tripUpdate: {
        trip: { tripId: "a", scheduleRelationship: "CANCELED" },
        stopTimeUpdate: [
          { stopId: "1", arrival: { time: Math.floor(now / 1000) + 60 } },
        ],
      },
    },
    {
      id: "delay",
      tripUpdate: {
        trip: { tripId: "b" },
        stopTimeUpdate: [{ stopId: "1", arrival: { delay: 120 } }],
      },
    },
    {
      id: "skipped",
      tripUpdate: {
        trip: { tripId: "c" },
        stopTimeUpdate: [
          {
            stopId: "1",
            scheduleRelationship: "SKIPPED",
            arrival: { time: Math.floor(now / 1000) + 60 },
          },
        ],
      },
    },
  ]);
  assert.deepEqual(ambSnapshot(bytes, now).trips, []);
});
test("FGC diagram projects a measured point in its published destination direction", () => {
  const network = {
    routes: [{ feed: "fgc", name: "L6", color: "#797FBC", mode: "rail" }],
    shapes: [
      [
        [2, 41],
        [2.01, 41],
      ],
    ],
    shapeInfo: [{ kind: "gtfs" }],
    stops: [
      { id: "fgc:PC1", parent: "fgc:PC", lon: 2, lat: 41 },
      { id: "fgc:SR1", parent: "fgc:SR", lon: 2.01, lat: 41 },
    ],
  };
  const schedule = {
    trips: [[0, 0, 0, 0, 0, 0]],
    patterns: [
      [
        [0, 1],
        [0, 120],
        [0, 120],
      ],
    ],
  };
  const snapshot = {
    timestamp: now,
    vehicles: [
      {
        id: "actual",
        line: "L6",
        destination: "SR",
        lon: 2.005,
        lat: 41,
        timestamp: now,
      },
    ],
  };
  const features = fgcFeatures(
    snapshot,
    network,
    schedule,
    new Movement(network, schedule),
    now,
  );
  assert.deepEqual(features[0].geometry.coordinates, [2.005, 41]);
  assert.equal(features[0].properties.linearUnavailable, false);
  assert(Math.abs(features[0].properties.fraction - 0.5) < 0.01);
  snapshot.vehicles[0].destination = "unknown";
  assert.equal(
    fgcFeatures(
      snapshot,
      network,
      schedule,
      new Movement(network, schedule),
      now,
    )[0].properties.linearUnavailable,
    true,
  );
  assert.deepEqual(
    fgcFeatures(
      snapshot,
      network,
      schedule,
      new Movement(network, schedule),
      now + 180001,
    ),
    [],
  );
});
