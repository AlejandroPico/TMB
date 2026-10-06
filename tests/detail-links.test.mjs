import { test } from "node:test";
import assert from "node:assert/strict";
import {
  detailURL,
  readDetailURL,
  serviceReference,
  serviceStatus,
  resolveServiceLink,
} from "../src/detail-links.js";

const base =
  "https://alejandropico.github.io/TMB/?city=barcelona&detail=vehicle&ref=old&at=999&date=2026-10-06&start=0";
test("station and line links preserve namespaced IDs and remove stale vehicle times", () => {
  for (const kind of ["stop", "route"]) {
    const url = detailURL(base, {
      city: "madrid",
      kind,
      ref: "metro:123/á & B",
    });
    assert.deepEqual(readDetailURL(url), { kind, ref: "metro:123/á & B" });
    assert.equal(new URL(url).searchParams.get("city"), "madrid");
    assert.equal(new URL(url).searchParams.has("at"), false);
    assert.equal(new URL(url).pathname, "/TMB/");
  }
  assert.equal(readDetailURL(detailURL(base, { city: "sevilla" })), null);
});
test("service links select the exact day and frequency departure using a stable published trip reference", () => {
  const schedule = {
    tripIds: ["tmb:published-trip"],
    patterns: [
      [
        [0, 1],
        [0, 600],
        [10, 600],
      ],
    ],
  };
  const trips = [
    { id: "0-0-3600", t: [1, 0, 0, 0, 0], start: 3600 },
    { id: "0-0-4200", t: [1, 0, 0, 0, 0], start: 4200 },
    { id: "0-1-3600", t: [1, 0, 0, 0, 0], start: 3600 - 86400 },
  ];
  const url = detailURL(base, {
    city: "barcelona",
    kind: "vehicle",
    ref: "tmb:published-trip",
    date: "2026-10-06",
    time: 4000.5,
    start: 3600,
  });
  const target = readDetailURL(url);
  assert.equal(target.time, 4000);
  assert.equal(
    resolveServiceLink(schedule, trips, target.ref, target.start),
    trips[0],
  );
  assert.equal(resolveServiceLink(schedule, trips, target.ref, 4200), trips[1]);
  assert.equal(
    resolveServiceLink(schedule, trips, target.ref, 3600 - 86400),
    trips[2],
  );
  assert.equal(resolveServiceLink(schedule, trips, "unknown", 3600), null);
  assert.equal(serviceReference(schedule, trips[0]).label, "Servicio 01:00");
  assert.equal(
    serviceStatus(schedule, trips[0], 3500, true),
    "Salida pendiente",
  );
  assert.equal(
    serviceStatus(schedule, trips[0], 4000, true),
    "En camino · posición estimada",
  );
  assert.equal(
    serviceStatus(schedule, trips[0], 4000, false),
    "En servicio · sin posición disponible",
  );
  assert.equal(
    serviceStatus(schedule, trips[0], 4300, true),
    "Servicio finalizado",
  );
});
test("malformed and expired link identifiers do not manufacture vehicle matches", () => {
  for (const query of [
    "detail=vehicle&ref=x",
    "detail=vehicle&ref=x&date=2026-02-31&at=3600&start=0",
    "detail=vehicle&ref=x&date=2026-10-06&at=NaN&start=0",
    "detail=vehicle&ref=x&date=2026-10-06&at=3600&start=Infinity",
    "detail=unknown&ref=x",
  ])
    assert.equal(readDetailURL("https://example.com/?" + query), null);
});
