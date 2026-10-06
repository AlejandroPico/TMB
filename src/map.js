import * as maplibregl from "maplibre-gl";
import mapWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import { distance, transportGroup } from "./transit.js";
maplibregl.setWorkerUrl(mapWorkerUrl);
export class CityMap {
  constructor(
    network,
    { onStop, onRoute, onStory, onVehicle, onGPS, onReady, onError },
  ) {
    this.network = network;
    this.callbacks = { onStop, onRoute, onStory, onVehicle };
    this.ready = false;
    this.map = new maplibregl.Map({
      container: "map",
      style: "https://tiles.openfreemap.org/styles/dark",
      center: network.meta.center || [2.165, 41.391],
      zoom: network.meta.zoom || 12.5,
      pitch: 35,
      bearing: -18,
      attributionControl: false,
      maxPitch: 70,
    });
    this.map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-right",
    );
    this.map.on("error", (e) => {
      if (!this.ready) onError(e.error?.message);
    });
    this.map.on("load", () => {
      this.setup();
      this.ready = true;
      onReady();
    });
    this.map.on("click", (e) => {
      if (!this.ready) return;
      for (const [layer, cb, field] of [
        ["gps", onGPS, "id"],
        ["stops", onStop, "index"],
        ["stories", onStory, "id"],
        ["vehicles", onVehicle, "id"],
        ["routes", onRoute, "index"],
      ]) {
        const features = this.map.queryRenderedFeatures(e.point, {
          layers: [layer],
        });
        if (features.length) {
          cb(features[0].properties[field]);
          return;
        }
      }
    });
    for (const layer of ["stops", "routes", "stories", "vehicles", "gps"]) {
      this.map.on(
        "mouseenter",
        layer,
        () => (this.map.getCanvas().style.cursor = "pointer"),
      );
      this.map.on(
        "mouseleave",
        layer,
        () => (this.map.getCanvas().style.cursor = ""),
      );
    }
  }
  source(name, features = []) {
    this.map.addSource(name, {
      type: "geojson",
      data: { type: "FeatureCollection", features },
    });
  }
  setup() {
    const n = this.network;
    const routeFeatures = n.routes.flatMap((r, i) =>
      r.directions.map((d) => ({
        type: "Feature",
        geometry: { type: "LineString", coordinates: n.shapes[d.shape] },
        properties: {
          index: i,
          name: r.name,
          color: r.color,
          mode: transportGroup(r),
        },
      })),
    );
    this.source("routes", routeFeatures);
    this.map.addLayer({
      id: "route-glow",
      type: "line",
      source: "routes",
      paint: {
        "line-color": ["get", "color"],
        "line-width": 10,
        "line-opacity": 0.1,
        "line-blur": 4,
      },
    });
    this.map.addLayer({
      id: "routes",
      type: "line",
      source: "routes",
      paint: {
        "line-color": ["get", "color"],
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          10,
          1.5,
          14,
          3,
          17,
          5,
        ],
        "line-opacity": 0.8,
      },
    });
    this.source(
      "stops",
      n.stops.flatMap((s, i) =>
        s.kind === 0
          ? [
              {
                type: "Feature",
                geometry: { type: "Point", coordinates: [s.lon, s.lat] },
                properties: {
                  index: i,
                  name: s.name,
                  mode: transportGroup({ mode: s.mode }),
                  accessible: s.accessible,
                },
              },
            ]
          : [],
      ),
    );
    this.map.addLayer({
      id: "stops",
      type: "circle",
      source: "stops",
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          10,
          1,
          13,
          2.5,
          16,
          5,
        ],
        "circle-color": [
          "match",
          ["get", "mode"],
          "rail",
          "#eef2df",
          "#8eaca2",
        ],
        "circle-stroke-color": "#182722",
        "circle-stroke-width": 1,
      },
    });
    this.map.addLayer({
      id: "stop-labels",
      type: "symbol",
      source: "stops",
      minzoom: 14.6,
      layout: {
        "text-field": ["get", "name"],
        "text-font": ["Noto Sans Regular"],
        "text-size": 11,
        "text-offset": [0, 1.2],
        "text-anchor": "top",
      },
      paint: {
        "text-color": "#dee4da",
        "text-halo-color": "#15211e",
        "text-halo-width": 2,
      },
    });
    this.source("vehicles");
    this.map.addLayer({
      id: "vehicle-glow",
      type: "circle",
      source: "vehicles",
      paint: {
        "circle-radius": 9,
        "circle-color": ["get", "color"],
        "circle-opacity": 0.2,
        "circle-blur": 0.5,
      },
    });
    this.map.addLayer({
      id: "vehicles",
      type: "circle",
      source: "vehicles",
      paint: {
        "circle-radius": ["match", ["get", "mode"], "bus", 3, 4.5],
        "circle-color": ["get", "color"],
        "circle-stroke-color": "#fffce7",
        "circle-stroke-width": 1.2,
      },
    });
    this.source("gps");
    this.map.addLayer({
      id: "gps-glow",
      type: "circle",
      source: "gps",
      paint: {
        "circle-radius": 13,
        "circle-color": "#72dbeb",
        "circle-opacity": 0.17,
      },
    });
    this.map.addLayer({
      id: "gps",
      type: "circle",
      source: "gps",
      paint: {
        "circle-radius": 5.5,
        "circle-color": "#72dbeb",
        "circle-stroke-color": "#f0ffff",
        "circle-stroke-width": 1.5,
      },
    });
    this.source("stories");
    this.map.addLayer({
      id: "stories",
      type: "circle",
      source: "stories",
      paint: {
        "circle-radius": 8,
        "circle-color": "#f3b891",
        "circle-stroke-color": "#101817",
        "circle-stroke-width": 3,
      },
    });
    this.source("selection");
    this.map.addLayer({
      id: "selection",
      type: "circle",
      source: "selection",
      paint: {
        "circle-radius": 12,
        "circle-color": "#daed99",
        "circle-opacity": 0.2,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#daed99",
      },
    });
    this.source("journey");
    this.map.addLayer({
      id: "journey",
      type: "line",
      source: "journey",
      paint: {
        "line-color": ["get", "color"],
        "line-width": 7,
        "line-opacity": 0.95,
      },
      layout: { "line-cap": "round", "line-join": "round" },
    });
    this.source("reach");
    this.map.addLayer({
      id: "reach",
      type: "circle",
      source: "reach",
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 3, 14, 11],
        "circle-color": "#daed99",
        "circle-opacity": 0.4,
      },
    });
    const vector = Object.entries(this.map.getStyle().sources).find(
      ([, s]) => s.type === "vector",
    );
    if (vector)
      this.map.addLayer(
        {
          id: "buildings-3d",
          type: "fill-extrusion",
          source: vector[0],
          "source-layer": "building",
          minzoom: 14.5,
          paint: {
            "fill-extrusion-color": "#37453c",
            "fill-extrusion-height": ["coalesce", ["get", "render_height"], 8],
            "fill-extrusion-base": [
              "coalesce",
              ["get", "render_min_height"],
              0,
            ],
            "fill-extrusion-opacity": 0.65,
          },
        },
        "route-glow",
      );
  }
  set(name, features) {
    if (this.ready)
      this.map
        .getSource(name)
        ?.setData({ type: "FeatureCollection", features });
  }
  filters({ mode, route, stops, stories, vehicles }) {
    if (!this.ready) return;
    const routeFilter = [
      "all",
      ...(mode === "all" ? [] : [["==", ["get", "mode"], mode]]),
      ...(route == null ? [] : [["==", ["get", "index"], route]]),
    ];
    for (const id of ["routes", "route-glow"])
      this.map.setFilter(id, routeFilter);
    this.map.setFilter(
      "stops",
      mode === "all" ? null : ["==", ["get", "mode"], mode],
    );
    for (const id of ["stops", "stop-labels"])
      this.map.setLayoutProperty(id, "visibility", stops ? "visible" : "none");
    this.map.setLayoutProperty(
      "stories",
      "visibility",
      stories ? "visible" : "none",
    );
    for (const id of ["vehicles", "vehicle-glow", "gps", "gps-glow"]) {
      this.map.setLayoutProperty(
        id,
        "visibility",
        vehicles ? "visible" : "none",
      );
      this.map.setFilter(id, [
        "all",
        ...(mode === "all" ? [] : [["==", ["get", "mode"], mode]]),
        ...(route == null ? [] : [["==", ["get", "route"], route]]),
      ]);
    }
  }
  focusStop(i) {
    const s = this.network.stops[i];
    this.set("selection", [
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [s.lon, s.lat] },
      },
    ]);
    this.map.flyTo({
      center: [s.lon, s.lat],
      zoom: 15.3,
      pitch: 45,
      duration: 1200,
      padding: { left: 70, right: 100 },
    });
  }
  focusRoute(i) {
    const points = this.network.routes[i].directions.flatMap(
      (d) => this.network.shapes[d.shape],
    );
    if (!points.length) return;
    const b = points.reduce(
      (b, p) => b.extend(p),
      new maplibregl.LngLatBounds(points[0], points[0]),
    );
    this.map.fitBounds(b, { padding: 90, duration: 1200, maxZoom: 14.5 });
  }
  home() {
    this.map.flyTo({
      center: this.network.meta.center || [2.165, 41.391],
      zoom: this.network.meta.zoom || 12.5,
      pitch: 35,
      bearing: -18,
      duration: 1200,
    });
  }
  journeyOfficial(it) {
    const decode = (str) => {
      let index = 0,
        lat = 0,
        lon = 0,
        coords = [];
      while (index < str.length) {
        const read = () => {
          let result = 0,
            shift = 0,
            byte;
          do {
            byte = str.charCodeAt(index++) - 63;
            result |= (byte & 31) << shift;
            shift += 5;
          } while (byte >= 32 && index < str.length);
          return result & 1 ? ~(result >> 1) : result >> 1;
        };
        lat += read();
        lon += read();
        coords.push([lon / 1e5, lat / 1e5]);
      }
      return coords;
    };
    const features = it.legs.map((l) => ({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: l.legGeometry?.points
          ? decode(l.legGeometry.points)
          : [
              [l.from.lon, l.from.lat],
              [l.to.lon, l.to.lat],
            ],
      },
      properties: {
        color:
          l.mode === "WALK"
            ? "#deead1"
            : /^[0-9a-f]{6}$/i.test(l.routeColor || "")
              ? "#" + l.routeColor
              : "#d7eaa1",
      },
    }));
    this.set("journey", features);
    const b = new maplibregl.LngLatBounds();
    features.flatMap((f) => f.geometry.coordinates).forEach((c) => b.extend(c));
    this.map.fitBounds(b, { padding: 100, duration: 1200, maxZoom: 15 });
  }
  journey(result) {
    this.set(
      "journey",
      result
        ? result.legs.map((l) => ({
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: (l.via || [l.from, l.to]).map((i) => [
                this.network.stops[i].lon,
                this.network.stops[i].lat,
              ]),
            },
            properties: {
              color: l.walk ? "#dee1d1" : this.network.routes[l.route].color,
            },
          }))
        : [],
    );
    if (result?.legs.length) {
      const ids = result.legs.flatMap((l) => [l.from, l.to]),
        pts = ids.map((i) => this.network.stops[i]);
      const b = new maplibregl.LngLatBounds();
      pts.forEach((s) => b.extend([s.lon, s.lat]));
      this.map.fitBounds(b, { padding: 100, duration: 1000, maxZoom: 15 });
    }
  }
}
export class Movement {
  constructor(network, schedule) {
    this.n = network;
    this.s = schedule;
    this.cache = new Map();
    this.shapes = network.shapes.map((coords) => {
      let d = [0];
      for (let k = 1; k < coords.length; k++)
        d.push(
          d[k - 1] +
            distance(
              { lon: coords[k - 1][0], lat: coords[k - 1][1] },
              { lon: coords[k][0], lat: coords[k][1] },
            ),
        );
      return { coords, d };
    });
  }
  path(trip) {
    const t = trip.t,
      key = t[2] + "-" + t[4];
    if (this.cache.has(key)) return this.cache.get(key);
    const shape = this.shapes[t[2]],
      p = this.s.patterns[t[4]],
      positions = [];
    let last = 0;
    for (const stop of p[0]) {
      let best = Infinity,
        idx = last;
      const s = this.n.stops[stop];
      for (let k = last; k < shape.coords.length; k++) {
        const c = shape.coords[k],
          dd =
            (c[0] - s.lon) ** 2 * Math.cos((s.lat * Math.PI) / 180) ** 2 +
            (c[1] - s.lat) ** 2;
        if (dd < best) {
          best = dd;
          idx = k;
        }
      }
      positions.push(shape.d[idx]);
      last = idx;
    }
    const path = { ...shape, positions };
    this.cache.set(key, path);
    return path;
  }
  features(trips, time) {
    const features = [];
    for (const trip of trips) {
      const t = trip.t,
        p = this.s.patterns[t[4]],
        local = time - trip.start;
      if (local < p[1][0] || local > p[2].at(-1)) continue;
      let k = 0;
      while (k < p[0].length - 1 && local > p[1][k + 1]) k++;
      const path = this.path(trip),
        next = Math.min(k + 1, p[0].length - 1),
        a = p[2][k],
        b = p[1][next],
        mix = local <= a ? 0 : Math.min(1, (local - a) / Math.max(1, b - a)),
        d =
          path.positions[k] + (path.positions[next] - path.positions[k]) * mix;
      let lo = 0,
        hi = path.d.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (path.d[mid] < d) lo = mid + 1;
        else hi = mid;
      }
      const idx = Math.max(1, lo),
        c1 = path.coords[idx - 1],
        c2 = path.coords[idx] || c1,
        progress =
          (d - path.d[idx - 1]) /
          Math.max(0.01, (path.d[idx] || d) - path.d[idx - 1]);
      const r = this.n.routes[t[0]];
      features.push({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [
            c1[0] + (c2[0] - c1[0]) * progress,
            c1[1] + (c2[1] - c1[1]) * progress,
          ],
        },
        properties: {
          id: trip.id,
          route: t[0],
          color: r.color,
          mode: transportGroup(r),
          next: p[0][next],
          head: this.s.heads[t[3]],
        },
      });
    }
    return features;
  }
}
