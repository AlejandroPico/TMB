import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NetworkFilters } from "../src/filters.js";
import { stationConnections, calendarNotice } from "../src/boards.js";
import { stationOperators } from "../src/operators.js";
import { themes, resolveTheme } from "../src/themes.js";
import { cityThemes, accentText } from "../src/city-themes.js";

test("shared visibility supports mode combinations, line isolation and separate layers", () => {
  const f = new NetworkFilters({
    routes: [
      { mode: "metro", stops: [0] },
      { mode: "tram", stops: [1] },
      { mode: "rail", stops: [2] },
      { mode: "bus", stops: [3] },
    ],
  });
  f.set("routes", [1, 3], false);
  assert.deepEqual(f.visible("routes"), [0, 2]);
  assert.deepEqual(f.visible("routes", "metro"), [0]);
  assert.deepEqual(f.visible("routes", "bus"), []);
  assert.deepEqual(f.visible("routes", "rail", 2), [2]);
  assert.deepEqual(f.visible("stops", "rail"), [0, 1, 2]);
  f.only([1, 3]);
  assert.deepEqual(f.visible("routes"), [1, 3]);
  assert.deepEqual(f.visible("motion", "rail"), [1]);
});
test("connections use station groups and permitted GTFS transfers, avoiding nearby unrelated stops", () => {
  const stop = (name, mode, lat = 41, parent = "") => ({
    name,
    mode,
    lat,
    lon: 2,
    parent,
    kind: 0,
  });
  const n = {
    stops: [
      stop("Sagrada Família", "metro"),
      stop("Sagrada Familia", "metro", 41.0001),
      stop("Sagrada Família", "bus"),
      stop("Sagrada Família", "metro", 42),
      stop("Tranvía", "tram"),
      stop("Teleférico", "funicular"),
    ],
    routes: Array.from({ length: 6 }, (_, i) => ({ stops: [i] })),
    transfers: [
      [0, 4, 2, 90],
      [0, 5, 3, 0],
    ],
  };
  const c = stationConnections(n);
  assert.deepEqual([...c[0]].sort(), [0, 1, 4]);
  assert.deepEqual([...c[1]].sort(), [0, 1, 4]);
  assert.deepEqual([...c[2]], [2]);
  assert.deepEqual([...c[3]], [3]);
});
test("Barcelona's published platforms link L2/L5 at Sagrada Família and L2/L3/L4 at Passeig de Gràcia", () => {
  const n = JSON.parse(
    readFileSync(
      new URL("../public/data/barcelona/network.json", import.meta.url),
    ),
  );
  const c = stationConnections(n);
  for (const [name, expected] of [
    ["Sagrada Família", ["L2", "L5"]],
    ["Passeig de Gràcia", ["L2", "L3", "L4"]],
  ]) {
    const i = n.stops.findIndex(
      (st) => st.kind === 0 && st.name === name && st.mode === "metro",
    );
    assert.notEqual(i, -1);
    assert.deepEqual(
      [...c[i]]
        .map((r) => n.routes[r])
        .filter((r) => r.feed === "tmb")
        .map((r) => r.name)
        .sort(),
      expected,
    );
  }
});
test("station logos appear once per operator across lines and feed subdivisions", () => {
  const rows = [
    { feed: "tmb", mode: "metro", name: "L2" },
    { feed: "tmb", mode: "metro", name: "L3" },
    { feed: "tmb", mode: "metro", name: "L4" },
    { feed: "tram-tbx" },
    { feed: "tram-tbs" },
    { feed: "fgc" },
    { feed: "tmb", mode: "funicular" },
  ];
  assert.deepEqual(
    stationOperators(rows).map((op) => op.name),
    ["Metro de Barcelona", "TRAM", "FGC"],
  );
});
test("every registered operator asset is an image, including HTTP 200 block-page regressions", () => {
  const registry = JSON.parse(
    readFileSync(new URL("../docs/operator-identities.json", import.meta.url)),
  );
  for (const { file } of registry.assets) {
    const data = readFileSync(new URL("../" + file, import.meta.url));
    if (file.endsWith(".svg")) {
      assert.match(data.toString(), /<svg\b/, file);
      assert.doesNotMatch(
        data.toString(),
        /<html\b|<!doctype\s+html|<script\b/i,
        file,
      );
    } else if (file.endsWith(".png"))
      assert.equal(
        data.subarray(0, 8).toString("hex"),
        "89504e470d0a1a0a",
        file,
      );
    else if (file.endsWith(".gif"))
      assert.match(data.subarray(0, 6).toString(), /^GIF8[79]a$/, file);
    else assert.fail("Unvalidated image format: " + file);
  }
});
test("urban themes remain selectable, have evidence and migrate former city choices", () => {
  assert.equal(resolveTheme("operator", "madrid"), "madrid");
  assert.equal(resolveTheme("barcelona", "madrid"), "barcelona");
  assert.equal(resolveTheme("unknown"), "auto");
  assert.ok(!themes.operator);
  assert.equal(Object.keys(cityThemes).length, 9);
  for (const t of Object.values(cityThemes)) {
    assert.match(t.source, /^https:\/\//);
    assert.match(t.evidence, /^https:\/\//);
    assert.match(t.accent, /^#[0-9a-f]{6}$/);
  }
  assert.equal(accentText("#cc0018"), "#ffffff");
  assert.equal(accentText("#58ab27"), "#17201d");
});
test("calendar warnings explain unavailable vehicles without hiding networks or extending dates", () => {
  const feed = { start: "20250101", end: "20260527" };
  assert.equal(calendarNotice(feed, "2026-05-27"), "");
  assert.match(
    calendarNotice(feed, "2026-10-06"),
    /27\/05\/2026.*no se estiman vehículos/,
  );
  assert.equal(calendarNotice({}, "2026-10-06"), "");
});
