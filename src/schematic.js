import {
  schematicStopPositions,
  schematicDirections,
  stationName,
  stationConnections,
  transferGroups,
  calendarNotice,
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
  destroy() {
    this.observer?.disconnect();
  }
  view() {
    return {
      top: this.container.scrollTop,
      lines: [...this.container.querySelectorAll("[data-schematic-line]")].map(
        (el) => ({
          id: +el.dataset.schematicLine,
          open: el.open,
          left:
            el.querySelector(".schematic-scroll")?.scrollLeft ??
            (+el.dataset.scrollLeft || 0),
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
      el.dataset.scrollLeft = state.left;
    }
    this.container.scrollTop = view.top;
    for (const state of view.lines) {
      const el = this.container.querySelector(
        `[data-schematic-line="${state.id}"]`,
      );
      if (el && state.open) {
        this.populate(el);
        const scroller = el.querySelector(".schematic-scroll");
        if (scroller) scroller.scrollLeft = state.left;
        else el.dataset.scrollLeft = state.left;
      }
    }
  }
  render(network, schedule, ids, { date } = {}) {
    this.observer?.disconnect();
    if (this.n !== network) this.connections = stationConnections(network);
    this.n = network;
    this.s = schedule;
    this.date = date;
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
    this.container.innerHTML = `<div class="schematic-heading"><h1>Vista lineal</h1><span>${routes.length} ${routes.length === 1 ? "línea" : "líneas"} · posiciones publicadas</span><small>Arrastra para recorrer la línea o desliza con el dedo. Las etiquetas bajo las paradas indican transbordos.</small></div><div class="schematic-lines">${
      routes
        .map((i) => {
          const r = network.routes[i];
          return `<details class="schematic-line" data-schematic-line="${i}" ${routes.filter((i) => transportGroup(network.routes[i]) === "rail").length <= 60 && transportGroup(r) === "rail" ? "open" : ""}><summary>${this.callbacks.badge(r)}<span>${escape(r.description || r.name)}<small>${escape(r.operator)}</small></span></summary><p class="schematic-calendar" hidden></p><div class="schematic-tracks"></div></details>`;
        })
        .join("") ||
      '<p class="empty">No hay líneas seleccionadas. Actívalas en Filtros → Recorridos.</p>'
    }</div>`;
    this.updateCalendar(date);
    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) this.populate(entry.target);
        if (this.lastFeatures) this.update(this.lastFeatures);
      },
      { root: this.container, rootMargin: "120px 0px" },
    );
    for (const el of this.container.querySelectorAll("[data-schematic-line]")) {
      el.querySelector("summary").onclick = (e) => {
        e.preventDefault();
        el.open = !el.open;
      };
      el.addEventListener("toggle", () => this.populate(el));
      this.observer.observe(el);
      this.populate(el);
    }
  }
  populate(el) {
    if (
      !this.container.contains(el) ||
      !el.open ||
      el.dataset.built ||
      !this.container.clientHeight
    )
      return;
    const box = el.getBoundingClientRect(),
      root = this.container.getBoundingClientRect();
    if (box.bottom < root.top - 120 || box.top > root.bottom + 120) return;
    this.build(el, +el.dataset.schematicLine);
    el.dataset.built = "true";
    el.querySelector(".schematic-scroll").scrollLeft =
      +el.dataset.scrollLeft || 0;
    // Opening a collapsed line must show its vehicles even with the clock paused.
    if (this.lastFeatures) this.update(this.lastFeatures);
  }
  updateCalendar(date) {
    if (!date) return;
    this.date = date;
    for (const el of this.container.querySelectorAll("[data-schematic-line]")) {
      const r = this.n.routes[+el.dataset.schematicLine],
        feed = this.n.meta.feeds.find((f) => f.id === r.feed),
        note = el.querySelector(".schematic-calendar");
      note.textContent = calendarNotice(feed, date);
      note.hidden = !note.textContent;
    }
  }
  station(st, k, route) {
    // Stations describe the line itself; map point visibility cannot truncate it.
    const name = escape(this.n.stops[st].name),
      connections = transferGroups(this.n, this.connections[st], route).sort(
        (a, b) =>
          (typeOrder[this.n.routes[a[0]].mode] ?? 5) -
            (typeOrder[this.n.routes[b[0]].mode] ?? 5) ||
          this.n.routes[a[0]].name.localeCompare(
            this.n.routes[b[0]].name,
            "es",
            {
              numeric: true,
            },
          ),
      );
    return `<button class="schematic-station" data-schematic-stop="${st}" style="left:${70 + k * 112}px" title="${name}"><span></span><b>${name}</b></button>${
      connections.length
        ? `<div class="schematic-connections" style="left:${70 + k * 112}px" aria-label="Transbordos en ${name}">${connections
            .map((indices) => {
              const i = indices[0],
                r = this.n.routes[i];
              const button = (index) =>
                `<button data-connection="${index}" aria-label="Transbordo a ${escape(this.n.routes[index].name)} · ${escape(this.n.routes[index].description)}" title="${escape(this.n.routes[index].operator)} · ${escape(this.n.routes[index].description || this.n.routes[index].name)}">${indices.length > 1 ? escape(this.n.routes[index].description) : this.callbacks.badge(r)}</button>`;
              return indices.length === 1
                ? button(i)
                : `<details class="schematic-transfer-group"><summary title="${escape(r.name)} · ${indices.length} recorridos">${this.callbacks.badge(r)}<small>${indices.length}</small></summary><div>${indices.map(button).join("")}</div></details>`;
            })
            .join("")}</div>`
        : ""
    }`;
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
      r.feed === "cercanias",
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
    const width = Math.max(500, ...rows.map((d) => 140 + d.stops.length * 112));
    el.querySelector(".schematic-tracks").innerHTML =
      `<button class="schematic-route-info" data-info="${id}">Ficha de la línea</button><div class="schematic-scroll" tabindex="0" role="group" aria-label="${escape(r.name)}: sentidos y ramales"><div class="schematic-strip" style="width:${width}px">${rows.map((d, j) => `<div class="schematic-direction" style="width:${Math.max(500, 140 + d.stops.length * 112)}px;--line:${r.color}" data-track-route="${id}" data-track-direction="${j}" data-reverse="${this.reverse(rows, j)}"><div class="schematic-direction-title">${this.reverse(rows, j) ? "←" : "→"} ${escape(this.n.stops[d.stops.at(-1)]?.name)} <small>Sentido ${j + 1}</small></div><div class="schematic-wire" style="width:${Math.max(0, (d.stops.length - 1) * 112)}px"></div>${(this.reverse(rows, j) ? [...d.stops].reverse() : d.stops).map((st, k) => this.station(st, k, id)).join("")}<div class="schematic-vehicles"></div></div>`).join("")}</div></div>`;
    this.bindDrag(el.querySelector(".schematic-scroll"));
    for (const track of el.querySelectorAll(".schematic-direction")) {
      const height = Math.max(
        0,
        ...[...track.querySelectorAll(".schematic-connections")].map(
          (c) => c.offsetHeight,
        ),
      );
      track.style.setProperty(
        "--track-height",
        Math.max(215, 136 + height + 24) + "px",
      );
    }
    el.querySelector("[data-info]").onclick = () => this.callbacks.onRoute(id);
    el.querySelectorAll("[data-schematic-stop]").forEach(
      (b) =>
        (b.onclick = () => this.callbacks.onStop(+b.dataset.schematicStop)),
    );
    el.querySelectorAll("[data-connection]").forEach(
      (b) => (b.onclick = () => this.callbacks.onRoute(+b.dataset.connection)),
    );
  }
  bindDrag(scroller) {
    let drag = null,
      suppressClick = false;
    scroller.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      const box = scroller.getBoundingClientRect();
      if (e.clientY >= box.top + scroller.clientHeight) return;
      suppressClick = false;
      drag = {
        id: e.pointerId,
        x: e.clientX,
        left: scroller.scrollLeft,
        moved: false,
      };
    });
    scroller.addEventListener("pointermove", (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const delta = e.clientX - drag.x;
      if (!drag.moved && Math.abs(delta) < 6) return;
      drag.moved = true;
      scroller.setPointerCapture(e.pointerId);
      scroller.classList.add("dragging");
      scroller.scrollLeft = drag.left - delta;
      e.preventDefault();
    });
    const release = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      suppressClick = drag.moved;
      drag = null;
      scroller.classList.remove("dragging");
      if (scroller.hasPointerCapture(e.pointerId))
        scroller.releasePointerCapture(e.pointerId);
    };
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
      scroller.addEventListener(type, release);
    scroller.addEventListener("pointerleave", (e) => {
      if (drag && !drag.moved) release(e);
    });
    scroller.addEventListener(
      "click",
      (e) => {
        if (!suppressClick || e.detail === 0) return;
        e.preventDefault();
        e.stopPropagation();
        suppressClick = false;
      },
      true,
    );
    scroller.addEventListener("dragstart", (e) => e.preventDefault());
  }
  update(features, date) {
    this.lastFeatures = features;
    if (date && this.date !== date) this.updateCalendar(date);
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
        b.classList.toggle("published-position", !!f.properties.actual);
        b.classList.toggle("in-station", !!f.properties.stopped);
        b.title = `${this.n.routes[id].name} → ${f.properties.head} · ${this.n.stops[f.properties.stopped ? f.properties.current : f.properties.next]?.name || ""} · ${f.properties.actual ? "posición publicada" : f.properties.stopped ? (f.properties.dwellSource === "simulated" ? "en parada · pausa simulada" : "en parada · horario") : "estimado"}`;
        b.setAttribute("aria-label", b.title);
      }
      for (const b of existing.values()) b.remove();
    }
  }
}
