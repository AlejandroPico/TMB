import {
  schematicStopPositions,
  schematicDirections,
  stationName,
} from "./boards.js";
import { transportGroup } from "./transit.js";
const typeOrder = {
  metro: 0,
  tram: 1,
  rail: 2,
  funicular: 3,
  bus: 4,
  other: 5,
};
const escape = (text) =>
  String(text ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const vehicleIcon =
  '<svg viewBox="0 0 36 22" aria-hidden="true"><path d="M3 3h23l7 16H2Z" fill="currentColor" stroke="var(--ui-bg)" stroke-width="2"/><path d="M7 7h5v6H7Zm8 0h5v6h-5Zm8 0h4l3 6h-7Z" fill="var(--ui-bg)"/></svg>';
export class Schematic {
  constructor(container, { onStop, onVehicle, onRoute, badge }) {
    this.container = container;
    this.callbacks = { onStop, onVehicle, onRoute, badge };
  }
  view() {
    return {
      top: this.container.scrollTop,
      lines: [...this.container.querySelectorAll("[data-schematic-line]")].map(
        (el) => ({
          id: +el.dataset.schematicLine,
          open: el.open,
          left: el.querySelector(".schematic-scroll")?.scrollLeft || 0,
        }),
      ),
    };
  }
  restore(view) {
    if (!view) return;
    for (const state of view.lines) {
      const el = this.container.querySelector(
        `[data-schematic-line="${state.id}"]`,
      );
      if (!el) continue;
      el.open = state.open;
      if (state.open && !el.dataset.built) {
        this.build(el, state.id);
        el.dataset.built = "true";
      }
      for (const scroller of el.querySelectorAll(".schematic-scroll"))
        scroller.scrollLeft = state.left;
    }
    this.container.scrollTop = view.top;
  }
  render(network, schedule, ids) {
    this.n = network;
    this.s = schedule;
    this.patterns = new Map();
    this.rows = new Map();
    this.assignments = new Map();
    for (const trip of schedule.trips) {
      if (!this.patterns.has(trip[0])) this.patterns.set(trip[0], new Set());
      this.patterns.get(trip[0]).add(trip[4]);
    }
    const routes = [...ids]
      .filter((i) => network.routes[i].directions.length)
      .sort(
        (a, b) =>
          (typeOrder[network.routes[a].mode] ?? 5) -
            (typeOrder[network.routes[b].mode] ?? 5) ||
          network.routes[a].name.localeCompare(network.routes[b].name, "es", {
            numeric: true,
          }),
      );
    this.container.innerHTML = `<div class="schematic-heading"><h1>Vista lineal</h1><span>${routes.length} líneas · posiciones estimadas por horario</span><small>Abre una línea, desplázate horizontalmente y selecciona una parada o un vehículo. Los ramales se muestran por separado.</small></div><div class="schematic-lines">${
      routes
        .map((i) => {
          const r = network.routes[i];
          return `<details class="schematic-line" data-schematic-line="${i}" ${routes.filter((i) => transportGroup(network.routes[i]) === "rail").length <= 60 && transportGroup(r) === "rail" ? "open" : ""}><summary>${this.callbacks.badge(r)}<span>${escape(r.description || r.name)}<small>${escape(r.operator)}</small></span></summary><div class="schematic-tracks"></div></details>`;
        })
        .join("") ||
      '<p class="empty">No hay líneas seleccionadas. Actívalas en Filtros → Recorridos.</p>'
    }</div>`;
    for (const el of this.container.querySelectorAll("[data-schematic-line]")) {
      el.querySelector("summary").onclick = (e) => {
        e.preventDefault();
        el.open = !el.open;
      };
      const populate = () => {
        if (this.container.contains(el) && el.open && !el.dataset.built) {
          this.build(el, +el.dataset.schematicLine);
          el.dataset.built = "true";
        }
      };
      el.addEventListener("toggle", populate);
      populate();
    }
  }
  reverse(rows, j) {
    const first = rows[0].stops.map((i) => stationName(this.n.stops[i].name)),
      d = rows[j].stops;
    return (
      j > 0 &&
      first.indexOf(stationName(this.n.stops[d[0]].name)) >
        first.indexOf(stationName(this.n.stops[d.at(-1)].name))
    );
  }
  build(el, id) {
    const r = this.n.routes[id];
    const rows = schematicDirections(
      r.directions,
      [...(this.patterns.get(id) || [])].map((i) => this.s.patterns[i]),
    );
    this.rows.set(id, rows);
    const assignments = new Map();
    for (const patternId of this.patterns.get(id) || []) {
      for (let j = 0; j < rows.length; j++) {
        const positions = schematicStopPositions(
          rows[j],
          this.s.patterns[patternId],
        );
        if (positions) {
          assignments.set(patternId, { row: j, positions });
          break;
        }
      }
    }
    this.assignments.set(id, assignments);
    el.querySelector(".schematic-tracks").innerHTML =
      `<button class="schematic-route-info" data-info="${id}">Ficha de la línea</button>${rows.map((d, j) => `<div class="schematic-scroll" tabindex="0" aria-label="${escape(r.name)} sentido ${j + 1}"><div class="schematic-direction" style="width:${Math.max(500, 140 + d.stops.length * 112)}px;--line:${r.color}" data-track-route="${id}" data-track-direction="${j}" data-reverse="${this.reverse(rows, j)}"><div class="schematic-direction-title">${this.reverse(rows, j) ? "←" : "→"} ${escape(this.n.stops[d.stops.at(-1)]?.name)} <small>Sentido ${j + 1}</small></div><div class="schematic-wire" style="width:${Math.max(0, (d.stops.length - 1) * 112)}px"></div>${(this.reverse(rows, j) ? [...d.stops].reverse() : d.stops).map((st, k) => `<button class="schematic-station" data-schematic-stop="${st}" style="left:${70 + k * 112}px" title="${escape(this.n.stops[st].name)}"><span></span><b>${escape(this.n.stops[st].name)}</b></button>`).join("")}<div class="schematic-vehicles"></div></div></div>`).join("")}`;
    const scrollers = [...el.querySelectorAll(".schematic-scroll")];
    scrollers.forEach((scroller) =>
      scroller.addEventListener("scroll", () => {
        for (const other of scrollers)
          if (
            other !== scroller &&
            Math.abs(other.scrollLeft - scroller.scrollLeft) > 1
          )
            other.scrollLeft = scroller.scrollLeft;
      }),
    );
    el.querySelector("[data-info]").onclick = () => this.callbacks.onRoute(id);
    el.querySelectorAll("[data-schematic-stop]").forEach(
      (b) =>
        (b.onclick = () => this.callbacks.onStop(+b.dataset.schematicStop)),
    );
  }
  update(features) {
    const groups = new Map();
    for (const f of features) {
      const i = f.properties.route;
      if (!groups.has(i)) groups.set(i, []);
      groups.get(i).push(f);
    }
    for (const track of this.container.querySelectorAll("[data-track-route]")) {
      const id = +track.dataset.trackRoute,
        d = this.rows.get(id)[+track.dataset.trackDirection];
      const matched = (groups.get(id) || []).flatMap((f) => {
        const match = this.assignments.get(id)?.get(f.properties.pattern);
        if (!match || match.row !== +track.dataset.trackDirection) return [];
        const positions = match.positions,
          k = f.properties.segment;
        const at =
          positions[k] +
          (positions[Math.min(k + 1, positions.length - 1)] - positions[k]) *
            f.properties.fraction;
        return at === null
          ? []
          : [
              {
                f,
                at:
                  track.dataset.reverse === "true"
                    ? d.stops.length - 1 - at
                    : at,
              },
            ];
      });
      const host = track.querySelector(".schematic-vehicles"),
        existing = new Map(
          [...host.children].map((el) => [el.dataset.vehicle, el]),
        );
      for (const { f, at } of matched) {
        let b = existing.get(f.properties.id);
        if (!b) {
          b = document.createElement("button");
          b.className = "schematic-vehicle";
          b.dataset.vehicle = f.properties.id;
          b.innerHTML = vehicleIcon;
          b.onclick = () => this.callbacks.onVehicle(b.dataset.vehicle);
          host.append(b);
        }
        existing.delete(f.properties.id);
        b.style.left = 70 + at * 112 + "px";
        b.querySelector("svg").style.transform =
          track.dataset.reverse === "true" ? "scaleX(-1)" : "";
        b.title = `${this.n.routes[id].name} → ${f.properties.head} · ${this.n.stops[f.properties.next].name} · estimado`;
        b.setAttribute("aria-label", b.title);
      }
      for (const b of existing.values()) b.remove();
    }
  }
}
