import * as maplibregl from "maplibre-gl";
import mapWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import { transportGroup } from "./transit.js";
import { trustedShape } from "./geometry.js";
maplibregl.setWorkerUrl(mapWorkerUrl);
export class CityMap {
  constructor(
    network,
    {
      onStop,
      onRoute,
      onStory,
      onVehicle,
      onGPS,
      onReady,
      onError,
      movement,
      theme = "dark",
    },
  ) {
    this.network = network;
    this.movement = movement;
    this.callbacks = { onStop, onRoute, onStory, onVehicle };
    this.onReady = onReady;
    this.ready = false;
    this.savedSources = {};
    this.themeStyle = theme;
    this.map = new maplibregl.Map({
      container: "map",
      style: "https://tiles.openfreemap.org/styles/" + theme,
      center: network.meta.center || [2.165, 41.391],
      zoom: network.meta.zoom || 12.5,
      pitch: 35,
      bearing: 0,
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
      const attribution = this.map
        .getContainer()
        .querySelector(".maplibregl-ctrl-attrib");
      attribution?.classList.remove("maplibregl-compact-show");
      attribution?.removeAttribute("open");
      onReady();
    });
    this.map.on("click", (e) => {
      if (!this.ready) return;
      for (const [layer, cb, field] of [
        ["gps", onGPS, "id"],
        ["vehicles", onVehicle, "id"],
        ["stops", onStop, "index"],
        ["stories", onStory, "id"],
        ["routes", onRoute, "index"],
      ]) {
        const target = ["gps", "vehicles"].includes(layer)
          ? [
              [e.point.x - 8, e.point.y - 8],
              [e.point.x + 8, e.point.y + 8],
            ]
          : e.point;
        const features = this.map.queryRenderedFeatures(target, {
          layers: [layer],
        });
        if (features.length) {
          cb(features[0].properties[field]);
          return;
        }
      }
    });
    let rightClick = null;
    const canvas = this.map.getCanvas();
    const describeView = () =>
      canvas.setAttribute(
        "aria-label",
        `Mapa del transporte. Orientación ${Math.round(this.map.getBearing())}°; inclinación ${Math.round(this.map.getPitch())}°.`,
      );
    describeView();
    this.map.on("moveend", describeView);
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    canvas.addEventListener("pointerup", (e) => {
      if (e.button !== 2) return;
      const now = performance.now();
      if (
        rightClick &&
        now - rightClick.time < 450 &&
        Math.hypot(e.clientX - rightClick.x, e.clientY - rightClick.y) < 12
      ) {
        this.map.easeTo({ bearing: 0, pitch: 0, duration: 400 });
        rightClick = null;
      } else rightClick = { time: now, x: e.clientX, y: e.clientY };
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
  source(name, features = this.savedSources[name] || []) {
    this.map.addSource(name, {
      type: "geojson",
      data: { type: "FeatureCollection", features },
    });
  }
  setup() {
    const n = this.network;
    const routeShapes = n.routes.map(() => new Set());
    for (const t of this.movement.s.trips) routeShapes[t[0]].add(t[2]);
    const routeFeatures = n.routes.flatMap((r, i) =>
      [...routeShapes[i]]
        .filter((id) => trustedShape(n, id))
        .map((id) => ({
          type: "Feature",
          geometry: { type: "LineString", coordinates: n.shapes[id] },
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
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          5,
          2,
          10,
          7,
          15,
          10,
        ],
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
          5,
          0.55,
          8,
          1,
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
      id: "selected-vehicle",
      type: "circle",
      source: "selection",
      filter: ["has", "id"],
      paint: {
        "circle-radius": 6,
        "circle-color": ["coalesce", ["get", "color"], "#039be5"],
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2,
      },
    });
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
    this.savedSources[name] = features;
    if (this.ready)
      this.map
        .getSource(name)
        ?.setData({ type: "FeatureCollection", features });
  }
  filters({
    mode,
    route,
    stops,
    stories,
    vehicles,
    routes = true,
    railStops = true,
    busStops = true,
    otherStops = true,
    railMovement = true,
    busMovement = false,
    otherMovement = false,
    gps = true,
    routeIds = this.network.routes.map((_, i) => i),
    stopIds = this.network.stops.map((_, i) => i),
    motionIds = this.network.routes.map((_, i) => i),
  }) {
    if (!this.ready) return;
    const routeFilter = [
      "all",
      ["in", ["get", "index"], ["literal", routeIds]],
      ...(mode === "all" ? [] : [["==", ["get", "mode"], mode]]),
      ...(route == null ? [] : [["==", ["get", "index"], route]]),
    ];
    for (const id of ["routes", "route-glow"]) {
      this.map.setFilter(id, routeFilter);
      this.map.setLayoutProperty(id, "visibility", routes ? "visible" : "none");
    }
    const stopModes = [
      ...(railStops ? ["rail"] : []),
      ...(busStops ? ["bus"] : []),
      ...(otherStops ? ["ferry", "other"] : []),
    ];
    for (const id of ["stops", "stop-labels"]) {
      this.map.setFilter(id, [
        "all",
        ["in", ["get", "index"], ["literal", stopIds]],
        ["in", ["get", "mode"], ["literal", stopModes]],
        ...(mode === "all" ? [] : [["==", ["get", "mode"], mode]]),
      ]);
      this.map.setLayoutProperty(id, "visibility", stops ? "visible" : "none");
    }
    this.map.setLayoutProperty(
      "stories",
      "visibility",
      stories ? "visible" : "none",
    );
    for (const id of ["vehicles", "vehicle-glow", "gps", "gps-glow"]) {
      this.map.setLayoutProperty(
        id,
        "visibility",
        (
          id.startsWith("gps")
            ? gps
            : vehicles && (railMovement || busMovement || otherMovement)
        )
          ? "visible"
          : "none",
      );
      this.map.setFilter(id, [
        "all",
        ["in", ["get", "route"], ["literal", motionIds]],
        ...(id.startsWith("gps")
          ? []
          : [
              [
                "in",
                ["get", "mode"],
                [
                  "literal",
                  [
                    ...(railMovement ? ["rail"] : []),
                    ...(busMovement ? ["bus"] : []),
                    ...(otherMovement ? ["ferry", "other"] : []),
                  ],
                ],
              ],
            ]),
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
  view() {
    return {
      center: this.map.getCenter().toArray(),
      zoom: this.map.getZoom(),
      bearing: this.map.getBearing(),
      pitch: this.map.getPitch(),
      padding: this.map.getPadding(),
    };
  }
  restore(view) {
    if (view) this.map.easeTo({ ...view, duration: 650 });
  }
  theme(style) {
    if (this.themeStyle === style) return;
    this.themeStyle = style;
    this.ready = false;
    const epoch = (this.styleEpoch = (this.styleEpoch || 0) + 1);
    this.map.once("style.load", () => {
      if (epoch !== this.styleEpoch) return;
      this.setup();
      this.ready = true;
      this.onReady();
    });
    this.map.setStyle("https://tiles.openfreemap.org/styles/" + style);
  }
  focusRoute(i) {
    const points = this.network.routes[i].directions.flatMap((d) =>
      trustedShape(this.network, d.shape) ? this.network.shapes[d.shape] : [],
    );
    if (!points.length) {
      for (const stopId of this.network.routes[i].stops) {
        const s = this.network.stops[stopId];
        points.push([s.lon, s.lat]);
      }
    }
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
      bearing: 0,
      duration: 1200,
    });
  }
  userPosition(position) {
    if (!position) return;
    if (!this.locationMarker) {
      const element = document.createElement("div");
      element.className = "user-location";
      element.setAttribute("role", "img");
      element.setAttribute("aria-label", "Tu ubicación");
      element.title = "Tu ubicación";
      element.innerHTML = '<span class="location-dot"></span>';
      this.locationMarker = new maplibregl.Marker({ element })
        .setLngLat([position.lon, position.lat])
        .addTo(this.map);
    } else this.locationMarker.setLngLat([position.lon, position.lat]);
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
    const features = it.legs
      .filter((l) => l.legGeometry?.points)
      .map((l) => ({
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
    if (!features.length) return;
    const b = new maplibregl.LngLatBounds();
    features.flatMap((f) => f.geometry.coordinates).forEach((c) => b.extend(c));
    this.map.fitBounds(b, { padding: 100, duration: 1200, maxZoom: 15 });
  }
  journey(result) {
    const features = (result?.legs || []).flatMap((l) => {
      const coords = this.movement.leg(l);
      return coords
        ? [
            {
              type: "Feature",
              geometry: { type: "LineString", coordinates: coords },
              properties: { color: this.network.routes[l.route].color },
            },
          ]
        : [];
    });
    this.set("journey", features);
    if (result?.legs.length) {
      const ids = result.legs.flatMap((l) => [l.from, l.to]),
        pts = ids.map((i) => this.network.stops[i]);
      const b = new maplibregl.LngLatBounds();
      pts.forEach((s) => b.extend([s.lon, s.lat]));
      this.map.fitBounds(b, { padding: 100, duration: 1000, maxZoom: 15 });
    }
  }
}
