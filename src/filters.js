import { transportMode, matchesTransport } from "./transit.js";

export const typeNames = {
  metro: "Metro",
  tram: "Tranvía",
  rail: "Tren",
  bus: "Autobús",
  funicular: "Funicular",
  ferry: "Barco",
  other: "Otros",
};
export class NetworkFilters {
  constructor(network) {
    this.network = network;
    this.layers = Object.fromEntries(
      ["routes", "stops", "motion"].map((layer) => [
        layer,
        new Set(
          network.routes.flatMap((r, i) =>
            r.stops.length &&
            (layer !== "motion" ||
              !["bus", "ferry", "other"].includes(transportMode(r)))
              ? [i]
              : [],
          ),
        ),
      ]),
    );
  }
  groups() {
    const groups = new Map();
    this.network.routes.forEach((r, i) => {
      if (!r.stops.length) return;
      const type = transportMode(r),
        key = type + ":" + r.feed;
      if (!groups.has(key))
        groups.set(key, { key, type, operator: r.operator, ids: [] });
      groups.get(key).ids.push(i);
    });
    return [...groups.values()].sort(
      (a, b) =>
        ["metro", "tram", "rail", "bus", "funicular", "ferry", "other"].indexOf(
          a.type,
        ) -
        ["metro", "tram", "rail", "bus", "funicular", "ferry", "other"].indexOf(
          b.type,
        ),
    );
  }
  set(layer, ids, checked) {
    for (const id of ids)
      checked ? this.layers[layer].add(id) : this.layers[layer].delete(id);
  }
  ids(layer) {
    return [...this.layers[layer]];
  }
  visible(layer, mode = "all", selected = null) {
    return this.ids(layer).filter(
      (i) =>
        matchesTransport(this.network.routes[i], mode) &&
        (selected == null || selected === i),
    );
  }
  stops() {
    return [
      ...new Set(
        this.ids("stops").flatMap((i) => this.network.routes[i].stops),
      ),
    ];
  }
  state(layer, ids) {
    const count = ids.filter((i) => this.layers[layer].has(i)).length;
    return {
      checked: count === ids.length && count > 0,
      mixed: count > 0 && count < ids.length,
    };
  }
  only(ids) {
    for (const layer of Object.keys(this.layers))
      this.layers[layer] = new Set(ids);
  }
}
