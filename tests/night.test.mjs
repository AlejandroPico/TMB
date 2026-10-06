import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NetworkFilters } from "../src/filters.js";
import {
  dayTrips,
  matchesTransport,
  buildDepartures,
  nextDepartures,
} from "../src/transit.js";
import { Movement } from "../src/geometry.js";

const read = (city, file) =>
  JSON.parse(
    readFileSync(
      new URL(`../public/data/${city}/${file}.json`, import.meta.url),
    ),
  );

test("night routes are selectable in every layer without enabling day buses", () => {
  const n = {
    routes: [
      { mode: "metro", feed: "m", stops: [0] },
      { mode: "bus", feed: "amb", night: false, stops: [1] },
      { mode: "bus", feed: "amb", night: true, stops: [2] },
    ],
  };
  const f = new NetworkFilters(n);
  for (const layer of ["routes", "stops", "motion"])
    assert.deepEqual(f.visible(layer, "night"), [2]);
  assert.deepEqual(f.ids("motion"), [0, 2]);
  assert.equal(f.groups().length, 3);
  assert.equal(f.groups().find((g) => g.night).key, "bus:amb:night");
  f.set("routes", [2], false);
  assert.deepEqual(f.visible("routes", "night"), []);
  assert.deepEqual(f.visible("stops", "night"), [2]);
  assert(!matchesTransport({ mode: "bus", name: "N1" }, "night"));
});

test("Nitbus has real shapes, boarding points and service after midnight", () => {
  const n = read("barcelona", "network"),
    s = read("barcelona", "schedule");
  const nights = n.routes.filter((r) => r.feed === "amb" && r.night);
  assert(nights.length >= 20);
  for (const name of ["N0", "N7", "N17", "N28"])
    assert(nights.some((r) => r.name === name));
  assert(
    nights.every(
      (r) =>
        r.stops.length > 1 &&
        r.directions.length > 0 &&
        r.directions.every(
          (d) => !d.approximate && n.shapeInfo[d.shape].kind === "gtfs",
        ),
    ),
  );
  const feed = n.meta.feeds.find((f) => f.id === "amb");
  const date = new Date(
    feed.start.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3") + "T12:00:00Z",
  );
  date.setUTCDate(date.getUTCDate() + 1);
  const trips = dayTrips(s, date.toISOString().slice(0, 10)).filter(
    (t) => n.routes[t.t[0]].feed === "amb" && n.routes[t.t[0]].night,
  );
  const time = 30 * 60;
  assert(
    trips.some(
      (t) => t.start < 0 && t.start + s.patterns[t.t[4]][2].at(-1) > 0,
    ),
    "previous day's journeys continue across midnight",
  );
  const features = new Movement(n, s).features(trips, time);
  assert(
    features.some((f) => n.routes[f.properties.route].name === "N7"),
    "N7 is animated at 00:30 on its published alignment",
  );
  const departures = buildDepartures(s, trips);
  assert(
    nights.some((r) =>
      r.stops.some((i) => nextDepartures(departures, i, time).length > 0),
    ),
  );
});

test("night coverage includes distinct local brands and avoids Granada's daytime Norte lines", () => {
  for (const [city, feed, names] of [
    ["madrid", "emt", ["N1", "NC1", "NC2", "N32"]],
    ["sevilla", "tussam", ["A1", "A8"]],
    ["zaragoza", "avanza-zaragoza", ["N1", "N7"]],
    ["malaga", "emt-malaga", ["N1", "N4"]],
    ["granada", "granada-urbano", ["111", "121"]],
    ["bilbao", "bilbobus", ["G1", "G8"]],
    ["donostia", "dbus", ["B1", "B10"]],
    ["vitoria", "tuvisa", ["G1", "G6"]],
    ["jaen", "jaen-buho", ["BÚHO"]],
  ]) {
    const n = read(city, "network");
    for (const name of names)
      assert(
        n.routes.some(
          (r) =>
            r.feed === feed && r.name === name && r.night && r.stops.length > 1,
        ),
        city + " " + name,
      );
  }
  const n = read("granada", "network");
  assert.equal(
    n.routes.find((r) => r.feed === "granada-urbano" && r.name === "N1").night,
    false,
  );
});

test("weekend night services do not run on a weekday or outside their calendar", () => {
  const s = {
    frequencies: [],
    services: [
      {
        calendar: ["20260101", "20261231", 0, 0, 0, 0, 1, 1, 0],
        dates: [],
        removed: ["20261009"],
      },
    ],
    trips: [[0, 0, 0, 0, 0, 25 * 3600]],
  };
  assert.equal(dayTrips(s, "2026-10-07").length, 0);
  assert.equal(dayTrips(s, "2026-10-10").length, 1);
  assert.equal(dayTrips(s, "2026-10-11")[0].start, 3600);
  assert.equal(dayTrips(s, "2027-01-03").length, 0);
});
