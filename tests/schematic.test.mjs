import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NetworkFilters } from "../src/filters.js";
import { Schematic } from "../src/schematic.js";

const network = JSON.parse(
  readFileSync(
    new URL("../public/data/barcelona/network.json", import.meta.url),
  ),
);

function renderSelection(filters) {
  const previous = globalThis.IntersectionObserver;
  globalThis.IntersectionObserver = class {
    observe() {}
    disconnect() {}
  };
  try {
    const container = { innerHTML: "", querySelectorAll: () => [] };
    const schematic = new Schematic(container, { badge: (r) => r.name });
    schematic.render(network, { trips: [] }, filters.visible("routes"), {
      // Reproduce the stale or empty map-point selection from the reported bug.
      stops: filters.stops(),
    });
    return { schematic, container };
  } finally {
    if (previous === undefined) delete globalThis.IntersectionObserver;
    else globalThis.IntersectionObserver = previous;
  }
}

function assertCompleteStations(schematic, route) {
  for (const direction of network.routes[route].directions) {
    direction.stops.forEach((st, k) => {
      assert.match(
        schematic.station(st, k, route),
        new RegExp(`data-schematic-stop="${st}"`),
        `${network.routes[route].name}: missing ${network.stops[st].name}`,
      );
    });
  }
}

test("adding metro lines after Solo preserves every station and interchange", () => {
  const id = (name) =>
    network.routes.findIndex((r) => r.name === name && r.feed === "tmb");
  const filters = new NetworkFilters(network);
  filters.only([id("L2")]);
  filters.set("routes", [id("L11"), id("L5")], true);
  const { schematic, container } = renderSelection(filters);
  for (const route of filters.visible("routes")) {
    assert.match(
      container.innerHTML,
      new RegExp(`data-schematic-line="${route}"`),
    );
    assertCompleteStations(schematic, route);
  }
  const l5 = id("L5");
  const sagrada = network.routes[l5].stops.find(
    (st) => network.stops[st].name === "Sagrada Família",
  );
  assert.match(
    schematic.station(sagrada, 0, l5),
    new RegExp(`data-connection="${id("L2")}"`),
  );
  assert.deepEqual(filters.visible("stops"), [id("L2")]);
  assert.deepEqual(filters.visible("motion"), [id("L2")]);
});

test("hiding map points never leaves selected tram, train or bus diagrams empty", () => {
  const filters = new NetworkFilters(network);
  const ids = ["tram", "rail", "bus"].map((mode) =>
    network.routes.findIndex((r) => r.mode === mode && r.directions.length),
  );
  assert.ok(ids.every((i) => i >= 0));
  filters.only(ids);
  filters.set("stops", ids, false);
  const { schematic } = renderSelection(filters);
  for (const route of ids) assertCompleteStations(schematic, route);
  assert.deepEqual(filters.stops(), []);
});
