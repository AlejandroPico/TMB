import {
  createIcons,
  Activity,
  Accessibility,
  ArrowDownUp,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Bookmark,
  BookmarkCheck,
  BusFront,
  ChevronRight,
  Clock3,
  Compass,
  Database,
  Footprints,
  Github,
  Info,
  Landmark,
  Layers2,
  LocateFixed,
  MapPin,
  Menu,
  SlidersHorizontal,
  Minus,
  Pause,
  Play,
  Plus,
  Radio,
  RotateCcw,
  Route,
  Scan,
  Search,
  TrainFront,
  X,
} from "lucide";
import { NetworkFilters, typeNames } from "./filters.js";
import { stationPlatforms, departureGroups, countdown } from "./boards.js";
import { Schematic } from "./schematic.js";
import { themes, applyTheme } from "./themes.js";
import { CityMap } from "./map.js";
import { Movement, applyRouteColors } from "./geometry.js";
import project from "../package.json";
import favicon from "../favicon.svg";
import {
  clock,
  madridNow,
  distance,
  transportGroup,
  matchesTransport,
} from "./transit.js";
import { cityStories, cityTours } from "./city-stories.js";
import { APP_NAME, APP_DESCRIPTION, DEFAULT_CITY } from "./config.js";
import { fetchFGC, FGC_SOURCE } from "./realtime.js";
document.title = APP_NAME;
document.querySelector('meta[name="description"]').content = APP_DESCRIPTION;
let cities = [],
  city,
  stories = [],
  tours = [],
  cityEpoch = 0,
  loadingCity = false;
let gps = null,
  gpsBusy = false,
  gpsNext = 0,
  gpsMessage = "Conectando con FGC…";
import "./style.css";
import "./layout.css";
import "./features.css";
let themeId = "night";
try {
  themeId = localStorage.getItem("enruta-theme") || "night";
} catch {}
if (!themes[themeId]) themeId = "night";
applyTheme(themeId);
let networkFilters,
  schematic,
  linearView = false,
  detailContext = null,
  vehicleDetail = null,
  stationBoard = null,
  boardBusy = false;
const $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const icon = (name, extra = "") => `<i data-lucide="${name}" ${extra}></i>`;
const refreshIcons = () =>
  createIcons({
    icons: {
      Activity,
      Accessibility,
      ArrowDownUp,
      ArrowRight,
      ArrowUpRight,
      BookOpen,
      Bookmark,
      BookmarkCheck,
      BusFront,
      ChevronRight,
      Clock3,
      Compass,
      Database,
      Footprints,
      Github,
      Info,
      Landmark,
      Layers2,
      LocateFixed,
      MapPin,
      Menu,
      SlidersHorizontal,
      Minus,
      Pause,
      Play,
      Plus,
      Radio,
      RotateCcw,
      Route,
      Scan,
      Search,
      TrainFront,
      X,
    },
    attrs: { "stroke-width": 1.65 },
  });
const initial = madridNow();
let n,
  s,
  map,
  movement,
  trips = [],
  selectedStop = null,
  selectedRoute = null,
  tab = "explore",
  mode = "rail",
  playing = true,
  speed = 1,
  simTime = initial.time,
  simDate = initial.date,
  syncClock = true,
  query = "",
  stopsVisible = true,
  storiesVisible = false,
  routesVisible = true,
  railStopsVisible = true,
  busStopsVisible = true,
  otherStopsVisible = true,
  railMovement = true,
  busMovement = false,
  otherMovement = false,
  gpsVisible = true,
  vehiclesVisible = true,
  detailToken = 0;
let favorites = [];
try {
  favorites = JSON.parse(localStorage.getItem("latido-favorites") || "[]");
} catch {}
let serverConfigured = false;
let apiBase = "";
try {
  apiBase = localStorage.getItem("latido-api") || "";
} catch {}
const worker = new Worker(new URL("./transit-worker.js", import.meta.url), {
  type: "module",
});
let requestId = 0,
  pending = new Map();
worker.onmessage = ({ data: m }) => {
  const p = pending.get(m.id);
  if (p) {
    pending.delete(m.id);
    m.error ? p.reject(new Error(m.error)) : p.resolve(m.result);
  }
};
const ask = (type, data = {}) =>
  new Promise((resolve, reject) => {
    const id = ++requestId;
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, type, date: simDate, ...data });
  });
$("#app").innerHTML = `
<div class="workspace">
<button id="menu-toggle" class="menu-toggle" aria-label="Abrir menú" aria-expanded="false">${icon("menu")}</button>
<nav class="rail" aria-label="Menú principal">
  <button class="rail-brand" id="brand-menu" aria-label="${esc(APP_NAME)} · Explorar" title="${esc(APP_NAME)}"><img src="${favicon}" alt="" width="28" height="28"><span>${esc(APP_NAME)}</span></button>
  <button class="rail-btn" data-tab="explore" aria-label="Explorar" title="Explorar">${icon("layers-2")}<span>Explorar</span></button>
  <button class="rail-btn" data-tab="journey" aria-label="Viajar" title="Viajar">${icon("route")}<span>Viajar</span></button>
  <button class="rail-btn" data-tab="stories" aria-label="Historias" title="Historias">${icon("book-open")}<span>Historias</span></button>
  <button class="rail-btn" data-tab="favorites" aria-label="Guardados" title="Guardados">${icon("bookmark")}<span>Guardados</span></button>
  <button class="rail-btn" data-tab="filters" aria-label="Filtros" title="Filtros">${icon("sliders-horizontal")}<span>Filtros</span></button>
  <button class="rail-btn" id="linear-toggle" aria-label="Vista lineal" aria-pressed="false">${icon("arrow-down-up")}<span>Lineal</span></button>
  <button class="rail-btn" data-tab="appearance" aria-label="Temas">${icon("compass")}<span>Temas</span></button>
  <div class="rail-spacer"></div>
  <button class="rail-btn" id="home-map" aria-label="Vista general" title="Vista general">${icon("scan")}<span>Vista</span></button>
  <button class="rail-btn" id="tilt" aria-label="Alternar vista 3D" title="Alternar vista 3D"><b>3D</b></button>
  <button class="rail-btn" data-tab="data" aria-label="Fuentes y cobertura" title="Fuentes y cobertura">${icon("database")}<span>Fuentes</span></button>
  <button class="rail-btn" id="about" aria-label="Acerca de ${esc(APP_NAME)}" title="Acerca de">${icon("info")}<span>Acerca de</span></button>
</nav>
<aside class="sidebar" aria-label="Explorador" inert>
 <div class="drawer-head"><span>${esc(APP_NAME)}</span><button id="drawer-close" aria-label="Contraer menú">${icon("x")}</button></div>
 <div class="explore-tools"><label class="city-picker"><span>CIUDAD O RED</span><select id="city-selector" aria-label="Ciudad o red de transporte"></select></label><button id="locate" class="nearby">${icon("locate-fixed")} Paradas cerca de mí</button><button id="source-state" class="text-link">${icon("database")} Fuentes y cobertura</button></div>
 <div id="panel"></div>
</aside>
<main class="map-area"><div id="map" aria-label="Mapa interactivo del transporte público"></div><section id="schematic" class="schematic" aria-label="Diagrama lineal del transporte" hidden></section><div id="detail" class="detail" hidden></div>
 <div class="timeline" aria-label="Reloj del transporte">
  <div class="clock-row"><button id="play" aria-label="Pausar" title="Pausar">${icon("pause")}</button><time id="time-readout">${clock(simTime)}</time><button id="time-options" aria-label="Cambiar fecha y velocidad" aria-expanded="false">${icon("clock-3")}</button><button id="reset-time" aria-label="Volver a ahora" title="Volver a ahora">${icon("rotate-ccw")}</button><span id="clock-note">Ahora</span></div>
  <input id="time-slider" type="range" min="0" max="86399" step="60" value="${simTime}" aria-label="Hora del servicio">
  <div id="clock-options" hidden><label>Fecha <input id="date" type="date" value="${simDate}" aria-label="Fecha del horario"></label><button id="speed" aria-label="Cambiar velocidad de reproducción">1×</button><small>Hora peninsular · movimiento estimado por horario</small></div>
 </div>
 <div class="map-bottom"><span id="moving-count">Cargando horario…</span><button id="gps-status" class="gps-status" hidden>FGC GPS</button><span id="movement-label" hidden></span></div>
</main></div>
<div id="loading" class="loading"><img src="${favicon}" alt="" width="44" height="44"><h2>Cargando la red</h2><p>Preparando mapa y horarios…</p><div class="loading-line"></div></div><div id="toast" role="status" class="toast" hidden></div><dialog id="data-dialog"></dialog><dialog id="about-dialog" aria-labelledby="about-title"></dialog>`;
refreshIcons();
$("#linear-toggle").onclick = () => {
  linearView = !linearView;
  $("#schematic").hidden = !linearView;
  $("#map").hidden = linearView;
  $("#linear-toggle").classList.toggle("active", linearView);
  $("#linear-toggle").setAttribute("aria-pressed", String(linearView));
  $("#linear-toggle").setAttribute(
    "aria-label",
    linearView ? "Volver al mapa" : "Vista lineal",
  );
  closePanel();
  $("#app").classList.remove("menu-open");
  $("#menu-toggle").setAttribute("aria-expanded", "false");
  $("#menu-toggle").setAttribute("aria-label", "Abrir menú");
  if (linearView) {
    refreshSchematic();
  } else {
    map?.map.resize();
  }
};
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => ($("#toast").hidden = true), 5500);
}
const badge = (r) => {
  const color = r.sourceColor || r.color || "#596c68",
    hex = color.slice(1),
    rgb = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)),
    textColor =
      r.textColor ||
      (rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114 > 175
        ? "#151515"
        : "#ffffff");
  return `<span class="line-badge" style="--line:${color};--line-text:${textColor}">${esc(r.name)}</span>`;
};
const num = (x) => new Intl.NumberFormat("es-ES").format(x);
function header(title, subtitle) {
  return `<div class="panel-head"><div class="eyebrow">${esc(city.name.toUpperCase())} · ${esc(city.region.toUpperCase())}</div><h2>${title}</h2><p>${subtitle}</p></div>`;
}
function renderPanel() {
  if (!n) return;
  let html = "";
  if (tab === "explore") {
    html = `<div class="segmented" role="group" aria-label="Modo de transporte">${[
      ["all", "Todo"],
      ["rail", "Raíles"],
      ["bus", "Bus"],
    ]
      .map(
        ([id, label]) =>
          `<button data-mode="${id}" class="${mode === id ? "active" : ""}">${label}</button>`,
      )
      .join("")}</div>
    <label class="search-box">${icon("search")}<input id="search" placeholder="Línea o parada" value="${esc(query)}" aria-label="Buscar líneas y paradas"><kbd>/</kbd></label>
    <div class="list-heading"><span>${query ? "RESULTADOS" : "LÍNEAS"}</span><button id="clear-route">${selectedRoute != null ? "Ver todas" : n.routes.length}</button></div>
    <div class="network-list" id="network-list">${networkList()}</div>${coverageNotice()}`;
  }
  if (tab === "filters") {
    html =
      header("Filtros", "Por tipo, operador y línea.") +
      `<div class="filter-toolbar"><button id="filters-reset">Restablecer</button><button id="filters-none">Ocultar todo</button></div>` +
      filterTree() +
      `<fieldset class="filter-section"><legend>Otros datos</legend><label class="filter-check"><input id="filter-gps" type="checkbox" ${gpsVisible ? "checked" : ""}><span>GPS de FGC<small>Solo en la hora actual; respeta las líneas seleccionadas en Vehículos.</small></span></label><label class="filter-check"><input id="filter-stories" type="checkbox" ${storiesVisible ? "checked" : ""}><span>Historias</span></label></fieldset>`;
  }
  if (tab === "appearance")
    html =
      header("Temas", "Elige la luz y los colores de la interfaz.") +
      `<div class="theme-options">${Object.entries(themes)
        .map(
          ([id, t]) =>
            `<button data-theme="${id}" aria-pressed="${themeId === id}" class="theme-option ${themeId === id ? "active" : ""}" style="--sample-bg:${t.surface};--sample-accent:${t.accent}"><span></span><b>${t.name}</b><small>${id === "operator" ? "Colores identificativos de " + esc(city.name) : id === "morning" ? "Claro y fresco" : id === "afternoon" ? "Cálido" : "Oscuro"}</small></button>`,
        )
        .join(
          "",
        )}</div><p class="footnote">Las líneas conservan sus colores para reconocerlas en cualquier tema. El tema Ciudad se inspira en los operadores; esta aplicación es independiente.</p>`;
  if (tab === "stories") {
    html =
      header(
        "Historias",
        "Lugares y relatos con fuentes para seguir leyendo.",
      ) +
      `<div class="story-list">${stories.length ? "" : `<div class="empty"><h3>Sin historias en esta red.</h3><p>Las redes nacionales ya se pueden explorar. Aquí aparecerán relatos con fuentes verificadas.</p></div>`}${stories.map((st) => `<button class="story-card" data-story="${st.id}"><div class="story-meta"><span>${esc(st.tag)}</span><b>${st.year}</b></div><h3>${st.title}</h3><p>${st.subtitle}</p><span class="story-cta">Descubrir en el mapa ${icon("arrow-up-right")}</span></button>`).join("")}</div><div class="list-heading">RECORRIDOS PARA DEJARSE LLEVAR</div><div class="tour-list">${tours.map((t, i) => `<button class="tour" data-tour="${i}">${icon("compass")}<span><b>${t.title}</b><small>${t.description}</small></span>${icon("chevron-right")}</button>`).join("")}</div>`;
  }
  if (tab === "favorites") {
    const saved = n.stops
      .map((st, i) => ({ ...st, index: i }))
      .filter((st) => favorites.includes(st.id));
    html =
      header("Guardados", "Guarda paradas y vuelve a ellas con un toque.") +
      `<div class="saved-list">${saved.length ? saved.map((st) => stopRow(st, st.index)).join("") : `<div class="empty">${icon("bookmark")}<h3>No hay paradas guardadas.</h3><p>Abre una parada y pulsa «Guardar». Tus favoritos se conservan en este navegador.</p><button id="go-explore" class="primary">Explorar paradas</button></div>`}</div>`;
  }
  if (tab === "journey") {
    const opts = n.stops
      .map((st, i) => ({ ...st, index: i }))
      .filter((st) => st.kind === 0)
      .sort((a, b) => a.name.localeCompare(b.name));
    const options = opts
      .map(
        (st) =>
          `<option value="${st.index}">${esc(st.name)} · ${esc(modeLabel(st.mode))} · ${esc(st.feed)}</option>`,
      )
      .join("");
    html =
      header("Viajar", "Encuentra un viaje con los horarios oficiales.") +
      `<form id="journey-form"><label class="field-label">ORIGEN<select id="from" required>${options}</select></label><div class="swap-row"><span class="route-dots">⋮</span><button type="button" id="swap" aria-label="Intercambiar origen y destino">${icon("arrow-down-up")}</button></div><label class="field-label">DESTINO<select id="to" required>${options}</select></label><div class="journey-options"><label>Transporte<select id="journey-mode"><option value="all">Todos los transportes</option><option value="rail">Metro, tren y tranvía</option><option value="bus">Solo bus</option></select></label><label class="check-label"><input id="accessible" type="checkbox"> Solo paradas accesibles³</label></div><button class="primary" id="plan-button" type="submit">${icon("route")} Encontrar mi viaje ${icon("arrow-right")}</button></form><div class="plan-notice">${icon("info")}<p>Salida a las <b id="departure-note">${clock(simTime)}</b> del día del reloj. Cambia la fecha y hora en el mapa.</p></div><div id="journey-result"></div><p class="footnote">³ Filtro según el campo de accesibilidad del GTFS. No verifica ascensores en servicio ni todo el itinerario peatonal. La planificación local usa transbordos aproximados y no incluye incidencias.</p>`;
  }
  const expired = n.meta.feeds.filter((f) => !feedCurrent(f));
  if (expired.length && (tab === "explore" || tab === "journey"))
    html = html.replace(
      "</div>",
      `</div><div class="calendar-warning">${icon("info")}<span>${expired.map((f) => esc(f.publisher)).join(", ")}: calendario archivado hasta ${expired.map((f) => formatDate(f.end)).join(", ")}. No hay servicio publicado para hoy en esos archivos.</span></div>`,
    );
  $(".sidebar").dataset.tab = tab;
  $("#panel").innerHTML = html;
  refreshIcons();
  bindPanel();
  if (tab === "journey") {
    const find = (name) => {
      const normalize = (v) =>
        v
          .toLocaleLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");
      const exact = n.stops.findIndex(
        (st) => st.kind === 0 && normalize(st.name) === normalize(name),
      );
      return exact >= 0
        ? exact
        : n.stops.findIndex(
            (st) =>
              st.kind === 0 && normalize(st.name).includes(normalize(name)),
          );
    };
    const from = find(city.journey[0]),
      to = find(city.journey[1]);
    const fallback = n.stops.flatMap((st, i) => (st.kind === 0 ? [i] : []));
    $("#from").value = selectedStop ?? (from >= 0 ? from : fallback[0]);
    $("#to").value = to >= 0 ? to : fallback[1];
  }
}
function stopRow(st, i) {
  const rs = n.routes.filter((r) => r.stops.includes(i));
  return `<button class="stop-row" data-stop="${i}"><span class="stop-type">${icon(transportGroup(st) === "rail" ? "train-front" : "bus-front")}</span><span><b>${esc(st.name)}</b><small>${esc(modeLabel(st.mode)) + " · " + esc(st.feed)} ${rs.slice(0, 4).map(badge).join("")}</small></span>${icon("chevron-right")}</button>`;
}
function networkList() {
  const normalize = (v) =>
    v
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  const q = normalize(query);
  const rs = n.routes
    .map((r, i) => ({ ...r, index: i }))
    .filter(
      (r) =>
        r.stops.length > 0 &&
        matchesTransport(r, mode) &&
        (!q || normalize(r.name + " " + r.description).includes(q)),
    );
  let html = rs
    .slice(0, 150)
    .map(
      (r) =>
        `<button class="route-row ${selectedRoute === r.index ? "selected" : ""}" data-route="${r.index}">${badge(r)}<span><b>${esc(r.description.split(/ - | \/ /)[0])}</b><small>↔ ${esc(
          r.description
            .split(/ - | \/ /)
            .slice(1)
            .join(" - ") || r.description,
        )} · ${esc(r.operator)}</small></span><span class="route-size">${r.stops.length}<small>paradas</small></span></button>`,
    )
    .join("");
  if (rs.length > 150)
    html += `<p class="footnote">Mostrando 150 de ${rs.length} líneas. Busca un destino o número de línea para afinar.</p>`;
  if (q) {
    const ss = n.stops
      .map((st, i) => ({ ...st, index: i }))
      .filter(
        (st) =>
          st.kind === 0 &&
          matchesTransport(st, mode) &&
          normalize(st.name + " " + st.code).includes(q),
      )
      .slice(0, 35);
    html += ss.map((st) => stopRow(st, st.index)).join("");
  }
  return (
    html ||
    '<div class="no-results">No hay coincidencias. Prueba otro nombre o cambia el filtro.</div>'
  );
}
function bindList() {
  $$("[data-route]").forEach(
    (b) => (b.onclick = () => showRoute(+b.dataset.route)),
  );
  $$("[data-stop]").forEach(
    (b) => (b.onclick = () => showStop(+b.dataset.stop)),
  );
}
const $$ = (s) => [...document.querySelectorAll(s)];
function filterTree() {
  const groups = networkFilters.groups(),
    all = groups.flatMap((g) => g.ids);
  const check = (layer, ids, label, key) => {
    const state = networkFilters.state(layer, ids);
    return `<label class="filter-check"><input type="checkbox" data-filter-layer="${layer}" data-filter-key="${esc(key)}" ${state.checked ? "checked" : ""} ${state.mixed ? 'data-mixed="true"' : ""}><span>${label}</span></label>`;
  };
  return [
    ["routes", "Recorridos"],
    ["stops", "Paradas"],
    ["motion", "Vehículos"],
  ]
    .map(
      ([layer, label]) =>
        `<details class="filter-tree"><summary>${label}<small>${networkFilters.ids(layer).length} líneas</small></summary>${check(layer, all, "Todos", "all")}${groups.map((g) => `<details class="filter-group"><summary>${typeNames[g.type]}<small>${esc(g.operator)}</small></summary>${check(layer, g.ids, "Todo este grupo", g.key)}${g.ids.map((i) => `<div class="filter-line">${check(layer, [i], badge(n.routes[i]) + `<span>${esc(n.routes[i].description)}</span>`, "line:" + i)}<button data-only-line="${i}" title="Mostrar solo ${esc(n.routes[i].name)}" aria-label="Mostrar solo ${esc(n.routes[i].name)}">Solo</button></div>`).join("")}</details>`).join("")}</details>`,
    )
    .join("");
}
function refreshFilterChecks() {
  const groups = networkFilters.groups(),
    all = groups.flatMap((g) => g.ids);
  $$("[data-filter-layer]").forEach((input) => {
    const key = input.dataset.filterKey,
      ids =
        key === "all"
          ? all
          : key.startsWith("line:")
            ? [+key.slice(5)]
            : groups.find((g) => g.key === key).ids;
    const state = networkFilters.state(input.dataset.filterLayer, ids);
    input.checked = state.checked;
    input.indeterminate = state.mixed;
    input.setAttribute(
      "aria-checked",
      state.mixed ? "mixed" : String(state.checked),
    );
  });
  $$(".filter-tree > summary > small").forEach(
    (label, i) =>
      (label.textContent =
        networkFilters.ids(["routes", "stops", "motion"][i]).length +
        " líneas"),
  );
}
function refreshSchematic() {
  if (!schematic || !n) return;
  const ids = networkFilters
    .ids("routes")
    .filter(
      (i) =>
        (mode === "all" || transportGroup(n.routes[i]) === mode) &&
        (selectedRoute == null || selectedRoute === i),
    );
  schematic.render(n, s, ids);
  schematic.update(
    rawMovementFeatures.filter((f) =>
      networkFilters.layers.motion.has(f.properties.route),
    ),
  );
}
function rememberDetail() {
  if (!detailContext && map)
    detailContext = {
      view: map.view(),
      linear: schematic?.view(),
      mode,
      route: selectedRoute,
    };
}
function closeDetail(restore = true) {
  detailToken++;
  stationBoard = null;
  vehicleDetail = null;
  selectedStop = null;
  $("#detail").hidden = true;
  map?.set("selection", []);
  map?.set("reach", []);
  const previousLinear = detailContext?.linear;
  if (detailContext) {
    mode = detailContext.mode;
    selectedRoute = detailContext.route;
    if (restore) map?.restore(detailContext.view);
    detailContext = null;
  } else selectedRoute = null;
  applyFilters();
  if (linearView) {
    refreshSchematic();
    schematic.restore(previousLinear);
  }
  if (n) renderPanel();
}
function bindPanel() {
  bindList();
  if (networkFilters && tab === "filters") {
    $$(".filter-tree > summary,.filter-group > summary").forEach(
      (summary) =>
        (summary.onclick = (e) => {
          e.preventDefault();
          summary.parentElement.open = !summary.parentElement.open;
        }),
    );
    refreshFilterChecks();
    $$("[data-filter-layer]").forEach(
      (input) =>
        (input.onchange = () => {
          const key = input.dataset.filterKey,
            groups = networkFilters.groups(),
            ids =
              key === "all"
                ? groups.flatMap((g) => g.ids)
                : key.startsWith("line:")
                  ? [+key.slice(5)]
                  : groups.find((g) => g.key === key).ids;
          networkFilters.set(input.dataset.filterLayer, ids, input.checked);
          routesVisible = true;
          refreshFilterChecks();
          applyFilters();
          drawMovement();
          if (linearView) refreshSchematic();
        }),
    );
    $$("[data-only-line]").forEach(
      (b) =>
        (b.onclick = () => {
          networkFilters.only([+b.dataset.onlyLine]);
          mode = "all";
          selectedRoute = null;
          refreshFilterChecks();
          applyFilters();
          drawMovement();
          if (linearView) refreshSchematic();
        }),
    );
    $("#filters-reset").onclick = () => {
      networkFilters = new NetworkFilters(n);
      routesVisible = stopsVisible = vehiclesVisible = true;
      mode = "all";
      selectedRoute = null;
      railMovement = busMovement = otherMovement = true;
      storiesVisible = false;
      renderPanel();
      applyFilters();
      drawMovement();
      if (linearView) refreshSchematic();
    };
    $("#filters-none").onclick = () => {
      for (const layer of Object.keys(networkFilters.layers))
        networkFilters.layers[layer].clear();
      refreshFilterChecks();
      applyFilters();
      drawMovement();
      if (linearView) refreshSchematic();
    };
  }
  $$("button[data-theme]").forEach(
    (b) =>
      (b.onclick = () => {
        themeId = b.dataset.theme;
        try {
          localStorage.setItem("enruta-theme", themeId);
        } catch {}
        const style = applyTheme(themeId, city.id);
        map?.theme(style);
        renderPanel();
      }),
  );
  for (const id of [
    "routes",
    "rail-stops",
    "bus-stops",
    "other-stops",
    "rail-motion",
    "bus-motion",
    "other-motion",
    "gps",
    "stories",
  ]) {
    const input = $("#filter-" + id);
    if (!input) continue;
    input.onchange = () => {
      const value = input.checked;
      if (id === "routes") routesVisible = value;
      if (id === "rail-stops") railStopsVisible = value;
      if (id === "bus-stops") busStopsVisible = value;
      if (id === "other-stops") otherStopsVisible = value;
      if (id === "rail-motion") railMovement = value;
      if (id === "bus-motion") busMovement = value;
      if (id === "other-motion") otherMovement = value;
      if (id === "gps") gpsVisible = value;
      if (id === "stories") storiesVisible = value;
      applyFilters();
      drawMovement();
      drawGPS();
    };
  }
  $$("[data-mode]").forEach(
    (b) =>
      (b.onclick = () => {
        mode = b.dataset.mode;
        selectedRoute = null;
        query = "";
        renderPanel();
        applyFilters();
      }),
  );
  if ($("#search"))
    $("#search").oninput = (e) => {
      query = e.target.value;
      $("#network-list").innerHTML = networkList();
      refreshIcons();
      bindList();
    };
  if ($("#clear-route"))
    $("#clear-route").onclick = () => {
      selectedRoute = null;
      applyFilters();
      renderPanel();
      map.home();
    };
  if ($("#story-invite"))
    $("#story-invite").onclick = () =>
      stories.length ? setTab("stories") : showData();
  if ($("#go-explore")) $("#go-explore").onclick = () => setTab("explore");
  $$("[data-story]").forEach(
    (b) => (b.onclick = () => showStory(b.dataset.story)),
  );
  $$("[data-tour]").forEach(
    (b) => (b.onclick = () => showTour(+b.dataset.tour)),
  );
  if ($("#swap"))
    $("#swap").onclick = () => {
      const v = $("#from").value;
      $("#from").value = $("#to").value;
      $("#to").value = v;
    };
  if ($("#journey-form")) $("#journey-form").onsubmit = plan;
}
function closePanel() {
  $(".sidebar").classList.remove("open");
  $(".sidebar").inert = true;
  $$("[data-tab]").forEach((b) => {
    b.classList.remove("active");
    b.setAttribute("aria-expanded", "false");
  });
}
function setTab(next, force = false) {
  if (next === "data") {
    closePanel();
    showData();
    return;
  }
  if (!force && tab === next && $(".sidebar").classList.contains("open")) {
    closePanel();
    return;
  }
  tab = next;
  $("#app").classList.add("menu-open");
  $("#menu-toggle").setAttribute("aria-expanded", "true");
  $("#menu-toggle").setAttribute("aria-label", "Cerrar menú");
  $(".sidebar").inert = false;
  $(".sidebar").classList.add("open");
  $$("[data-tab]").forEach((b) => {
    const active = b.dataset.tab === tab;
    b.classList.toggle("active", active);
    b.setAttribute("aria-expanded", String(active));
  });
  renderPanel();
}
function applyFilters() {
  map?.filters({
    mode,
    routeIds: networkFilters?.ids("routes"),
    stopIds: networkFilters
      ?.stops()
      .filter(
        (i) =>
          selectedRoute == null || n.routes[selectedRoute].stops.includes(i),
      ),
    motionIds: networkFilters?.ids("motion"),
    route: selectedRoute,
    stops: stopsVisible,
    railStops: railStopsVisible,
    busStops: busStopsVisible,
    otherStops: otherStopsVisible,
    routes: routesVisible,
    railMovement,
    busMovement,
    otherMovement,
    gps: gpsVisible,
    stories: storiesVisible,
    vehicles: vehiclesVisible,
  });
}
function showDetail(html) {
  closePanel();
  $("#app").classList.remove("menu-open");
  $("#menu-toggle").setAttribute("aria-expanded", "false");
  $("#menu-toggle").setAttribute("aria-label", "Abrir menú");
  $("#detail").innerHTML =
    `<button class="close-detail" aria-label="Cerrar detalle">${icon("x")}</button>${html}`;
  $("#detail").hidden = false;
  refreshIcons();
  $(".close-detail").onclick = () => closeDetail();
}
async function showStop(i) {
  if (i < 0 || !n.stops[i]) return;
  rememberDetail();
  vehicleDetail = null;
  selectedStop = i;
  const token = ++detailToken,
    st = n.stops[i],
    platforms = stationPlatforms(n, i),
    rs = n.routes.filter((r) => r.stops.some((st) => platforms.includes(st)));
  closePanel();
  map.focusStop(i);
  showDetail(
    `<div class="eyebrow">${esc(modeLabel(st.mode).toUpperCase())} · ${esc(st.feed.toUpperCase())} · ${esc(st.code)}</div><h2>${esc(st.name)}</h2><div class="detail-badges">${rs.map((r) => operatorSymbol(r) + badge(r)).join("")}</div><div class="detail-actions"><button id="save-stop">${icon(favorites.includes(st.id) ? "bookmark-check" : "bookmark")} ${favorites.includes(st.id) ? "Guardada" : "Guardar"}</button><button id="route-from">${icon("route")} Salir de aquí</button></div><div class="access-note">${icon("accessibility")} ${st.accessible === 1 ? "Embarque accesible según GTFS" : st.accessible === 2 ? "Embarque no accesible según GTFS" : "Accesibilidad sin especificar"}</div><div class="list-heading"><span>PRÓXIMAS LLEGADAS</span><span id="arrival-label">HORARIO</span></div><div id="arrivals"><p class="muted">Consultando el horario…</p></div><small class="detail-note">Predicción por horario publicado. El movimiento del mapa es una interpolación; no representa posiciones GPS. Las horas intermedias sin dato se estiman entre las salidas publicadas.</small>`,
  );
  attachStopTools(i);
  showStationAccess(i);
  $("#save-stop").onclick = () => {
    favorites = favorites.includes(st.id)
      ? favorites.filter((id) => id !== st.id)
      : [...favorites, st.id];
    try {
      localStorage.setItem("latido-favorites", JSON.stringify(favorites));
    } catch {}
    showStop(i);
    if (tab === "favorites") renderPanel();
  };
  $("#route-from").onclick = () => {
    setTab("journey");
    $("#from").value = i;
  };
  try {
    const deps = await ask("station", { stops: platforms, time: simTime });
    if (token !== detailToken) return;
    stationBoard = {
      index: i,
      token,
      platforms,
      deps,
      source: "schedule",
      refresh: Date.now() + 30000,
    };
    renderStationBoard();
    if (st.feed === "tmb" && st.mode === "bus" && syncClock)
      loadLive(st, token);
  } catch (e) {
    if (token === detailToken)
      $("#arrivals").textContent = "No se pudo consultar el horario.";
  }
}
async function loadLive(st, token) {
  if (!serverConfigured) return;
  try {
    const r = await fetch(
      `${apiBase}/api/ibus/${encodeURIComponent(st.code)}`,
      { signal: AbortSignal.timeout(7000) },
    );
    if (!r.ok) return;
    const data = await r.json();
    const age = Date.now() - data.timestamp;
    if (!Number.isFinite(age) || age > 90000 || age < -30000) return;
    const arrivals = (data.parades || [])
      .flatMap((p) =>
        (p.linies_trajectes || []).flatMap((l) =>
          (l.propers_busos || []).map((b) => ({
            name: l.nom_linia,
            destination: l.desti_trajecte,
            time: b.temps_arribada,
            vehicle: b.id_bus,
          })),
        ),
      )
      .sort((a, b) => a.time - b.time);
    if (token !== detailToken || !arrivals.length) return;
    if (!stationBoard || stationBoard.token !== token) return;
    stationBoard = {
      ...stationBoard,
      source: "live",
      arrivals,
      timestamp: data.timestamp,
      refresh: Date.now() + 20000,
    };
    renderStationBoard();
  } catch {}
}
function renderStationBoard() {
  if (!stationBoard || stationBoard.token !== detailToken || !$("#arrivals"))
    return;
  const board = stationBoard;
  if (board.source === "live" && Date.now() - board.timestamp > 90000) {
    board.source = "schedule";
    board.arrivals = [];
  }
  $("#arrival-label").textContent =
    board.source === "live" ? "iBUS · EN DIRECTO" : "HORARIO · ESTIMADO";
  let groups =
    board.source === "live"
      ? [
          ...new Set(board.arrivals.map((a) => a.name + ":" + a.destination)),
        ].map((key) => {
          const first = board.arrivals.find(
              (a) => a.name + ":" + a.destination === key,
            ),
            r = n.routes.find((r) => r.feed === "tmb" && r.name === first.name);
          return {
            r: r || {
              name: first.name,
              color: "#da001b",
              feed: "tmb",
              mode: "bus",
            },
            head: first.destination,
            values: board.arrivals
              .filter((a) => a.name + ":" + a.destination === key)
              .slice(0, 2)
              .map((a) => ({
                remaining: (a.time - Date.now()) / 1000,
                label: a.vehicle ? "Bus " + a.vehicle : "Previsión iBus",
              })),
          };
        })
      : departureGroups(
          board.deps.filter((d) => d.time >= simTime),
          s,
        )
          .map((g) => ({
            r: n.routes[g.route],
            head: g.head,
            values: g.departures
              .filter((d) => d.time >= simTime)
              .map((d) => ({
                remaining:
                  d.trip.start + s.patterns[d.trip.t[4]][1][d.k] - simTime,
                label: d.trip.frequency
                  ? "Intervalo GTFS"
                  : "Horario " +
                    clock(d.trip.start + s.patterns[d.trip.t[4]][1][d.k]),
              })),
          }))
          .filter((g) => g.values.length);
  $("#arrivals").innerHTML = groups.length
    ? groups
        .map(
          (g) =>
            `<section class="departure-display" data-operator="${esc(g.r.feed)}"><div class="departure-direction">${operatorSymbol(g.r)}${badge(g.r)}<span><small>Dirección</small><b>${esc(g.head)}</b></span></div><div class="departure-times">${g.values.map((v, j) => `<div class="${j ? "following" : ""}"><time>${countdown(v.remaining)}</time><small>${esc(v.label)}</small></div>`).join("")}</div></section>`,
        )
        .join("")
    : '<p class="muted">No hay salidas publicadas para esta fecha y hora. Comprueba el calendario en Fuentes.</p>';
  $(".detail-note").textContent =
    board.source === "live"
      ? "Cuenta atrás de la previsión publicada por TMB. Se actualiza cada 20 segundos."
      : "Cuenta atrás calculada con el horario publicado; no incluye retrasos ni confirma la llegada real. Todas las líneas y sentidos de esta estación se muestran juntos.";
}
async function refreshStationBoard() {
  if (
    boardBusy ||
    !stationBoard ||
    Date.now() < stationBoard.refresh ||
    loadingCity ||
    $("#detail").hidden
  )
    return;
  const board = stationBoard;
  board.refresh = Date.now() + 30000;
  boardBusy = true;
  try {
    const deps = await ask("station", {
      stops: board.platforms,
      time: simTime,
    });
    if (stationBoard !== board) return;
    board.deps = deps;
    const st = n.stops[board.index];
    if (st.feed === "tmb" && st.mode === "bus" && syncClock)
      await loadLive(st, board.token);
    renderStationBoard();
  } catch {
  } finally {
    boardBusy = false;
  }
}
function operatorSymbol(r) {
  if (r.feed === "tmb" && r.mode === "metro")
    return '<img class="operator-symbol" src="./brands/metro-barcelona.svg" alt="Metro de Barcelona">';
  if (r.feed?.startsWith("tram-"))
    return '<img class="operator-symbol operator-logo" src="./brands/tram.png" alt="TRAM">';
  if (r.feed === "fgc")
    return '<img class="operator-symbol operator-logo" src="./brands/fgc.png" alt="FGC">';
  const logo = r.feed?.startsWith("euskotren-")
    ? ["euskotren.svg", "Euskotren"]
    : {
        "metro-madrid": ["metro-madrid.svg", "Metro de Madrid"],
        "metro-sevilla": ["metro-sevilla.png", "Metro de Sevilla"],
        tussam: ["tussam.png", "TUSSAM"],
      }[r.feed];
  if (logo)
    return `<img class="operator-symbol operator-logo ${r.feed === "metro-sevilla" ? "logo-dark" : ""}" src="./brands/${logo[0]}" alt="${logo[1]}">`;
  return `<span class="operator-name">${esc(r.operator || r.feed || "")}</span>`;
}
function showRoute(i) {
  rememberDetail();
  stationBoard = null;
  vehicleDetail = null;
  selectedStop = null;
  selectedRoute = i;
  const r = n.routes[i];
  mode = transportGroup(r);
  applyFilters();
  if (tab === "explore") renderPanel();
  $(".sidebar").classList.remove("open");
  map.focusRoute(i);
  detailToken++;
  const d = r.directions[0];
  showDetail(
    `<div class="eyebrow">${esc(r.operator)} · ${esc(modeLabel(r.mode))}</div><div class="route-detail-title">${badge(r)}<h2>${esc(r.name)}</h2></div><p class="route-description">${esc(r.description)}</p>${r.directions.some((d) => n.shapeInfo[d.shape]?.kind === "rail-network") ? `<p class="footnote">Recorrido reconstruido sobre vías del IGN a través de las estaciones publicadas. El corredor se estima; Renfe no confirma en este archivo qué vías usa cada servicio.</p>` : ""}${r.directions.some((d) => d.approximate) ? `<p class="footnote">Trazado no disponible. Se conservan las paradas y los horarios, pero este recorrido no se dibuja ni se anima.</p>` : ""}<div class="direction-switch">${r.directions.map((d, k) => `<button data-direction="${k}" class="${k === 0 ? "active" : ""}">Sentido ${k + 1}</button>`).join("")}</div><div class="line-stations" id="line-stations">${lineStations(d, r)}</div><a class="text-link" href="${esc(r.url)}" target="_blank" rel="noopener">Ver la fuente de la línea ${icon("arrow-up-right")}</a>`,
  );
  attachTransitTools(r);
  bindDetailStops();
  $$("[data-direction]").forEach(
    (b) =>
      (b.onclick = () => {
        $$("[data-direction]").forEach((x) =>
          x.classList.toggle("active", x === b),
        );
        $("#line-stations").innerHTML = lineStations(
          r.directions[+b.dataset.direction],
          r,
        );
        bindDetailStops();
        refreshIcons();
      }),
  );
}
function lineStations(d, r) {
  return d
    ? d.stops
        .map(
          (i, k) =>
            `<button class="line-station" data-detail-stop="${i}" style="--line:${r.color}"><span class="station-node"></span><span>${esc(n.stops[i].name)}</span><small>${k + 1}</small></button>`,
        )
        .join("")
    : "";
}
function bindDetailStops() {
  $$("[data-detail-stop]").forEach(
    (b) => (b.onclick = () => showStop(+b.dataset.detailStop)),
  );
}
function showStory(id) {
  rememberDetail();
  stationBoard = null;
  vehicleDetail = null;
  const st = stories.find((x) => x.id === id);
  if (!st) return;
  $(".sidebar").classList.remove("open");
  detailToken++;
  map.map.flyTo({
    center: [st.lon, st.lat],
    zoom: 15.2,
    pitch: 55,
    bearing: 20,
    duration: 1800,
  });
  showDetail(
    `<div class="eyebrow">${esc(st.tag)}</div><div class="story-year">${st.year}<span>${esc(city.name.toUpperCase())}</span></div><h2>${st.title}</h2><p class="story-subtitle">${st.subtitle}</p><p class="story-body">${st.body}</p><a class="text-link" href="${st.source}" target="_blank" rel="noopener">Leer la fuente de esta historia ${icon("arrow-up-right")}</a><button id="story-near" class="primary">${icon("train-front")} Explorar la estación</button>`,
  );
  $("#story-near").onclick = () => {
    const near = n.stops
      .map((s, i) => ({ s, i, d: distance(s, st) }))
      .filter((x) => x.s.kind === 0 && transportGroup(x.s) === "rail")
      .sort((a, b) => a.d - b.d)[0];
    if (near) showStop(near.i);
  };
}
function showTour(i) {
  rememberDetail();
  stationBoard = null;
  vehicleDetail = null;
  const t = tours[i];
  mode = "rail";
  selectedRoute = null;
  applyFilters();
  map.map.flyTo({
    center: t.center,
    zoom: t.zoom,
    pitch: 50,
    bearing: t.bearing,
    duration: 2000,
  });
  showDetail(
    `<div class="eyebrow">UN RECORRIDO POR BARCELONA</div><h2>${t.title}</h2><p class="story-body">${t.description}</p><div class="tour-stops">${t.stops
      .map((name) => {
        const i = n.stops.findIndex(
          (s) =>
            s.kind === 0 &&
            s.feed === "tmb" &&
            s.mode === "metro" &&
            s.name === name,
        );
        return `<button data-detail-stop="${i}">${icon("map-pin")} ${name} ${icon("arrow-up-right")}</button>`;
      })
      .join(
        "",
      )}</div><small class="detail-note">Recorrido editorial. Planifica cada tramo en «Viajar» para obtener horarios.</small>`,
  );
  bindDetailStops();
}
function showVehicle(id) {
  const f = rawMovementFeatures.find((x) => x.properties.id === id);
  if (!f) return;
  rememberDetail();
  stationBoard = null;
  selectedStop = null;
  vehicleDetail = id;
  const r = n.routes[f.properties.route];
  detailToken++;
  showDetail(
    `<div class="vehicle-heading">${operatorSymbol(r)}${badge(r)}<span class="vehicle-number">${esc(s.tripIds[+id.split("-")[0]] || id)}</span></div><p class="eyebrow">${esc(typeNames[r.mode] || "Vehículo")} · ${esc(r.operator)}</p><div id="vehicle-live-detail"></div><div class="detail-actions"><button id="vehicle-stop">Ver próxima parada</button><button id="vehicle-route">Ver línea</button></div><small class="detail-note">Posición y llegada estimadas por horario. El identificador corresponde al viaje GTFS, no al número de convoy. El operador no publica aquí ocupación, vía ni serie.</small>`,
  );
  $("#vehicle-stop").onclick = () => {
    const current = rawMovementFeatures.find((x) => x.properties.id === id);
    if (current) showStop(current.properties.next);
  };
  $("#vehicle-route").onclick = () => showRoute(f.properties.route);
  updateVehicleDetail();
}
function updateVehicleDetail() {
  if (!vehicleDetail || !$("#vehicle-live-detail")) return;
  const f = rawMovementFeatures.find((x) => x.properties.id === vehicleDetail);
  $("#vehicle-live-detail").innerHTML = f
    ? `<p class="eyebrow">Próxima parada</p><h2>${esc(n.stops[f.properties.next].name)}</h2><p class="eyebrow">Llegada estimada</p><time class="vehicle-countdown">${countdown(f.properties.arrival - simTime)}</time><dl class="vehicle-facts"><div><dt>Destino</dt><dd>${esc(f.properties.head)}</dd></div><div><dt>Última parada</dt><dd>${esc(n.stops[f.properties.current].name)}</dd></div><div><dt>Hora prevista</dt><dd>${clock(f.properties.arrival)}</dd></div><div><dt>Fuente</dt><dd>${f.properties.frequency ? "Intervalo GTFS" : "Horario GTFS"}</dd></div></dl>`
    : '<p class="muted">Este viaje ya ha terminado en el horario seleccionado.</p>';
}
async function plan(e) {
  e.preventDefault();
  const epoch = cityEpoch;
  const from = +$("#from").value,
    to = +$("#to").value;
  if (from === to) {
    toast("Elige dos paradas diferentes.");
    return;
  }
  const button = $("#plan-button");
  button.disabled = true;
  button.textContent = "Buscando conexiones…";
  const options = {
    accessible: $("#accessible").checked,
    mode: $("#journey-mode").value,
    minutes: city.id === "espana" ? 1440 : 180,
  };
  try {
    if (await tryOfficialPlan(from, to, options)) return;
    const result = await ask("plan", { from, to, time: simTime, options });
    if (tab !== "journey" || epoch !== cityEpoch) return;
    map.journey(result);
    $("#journey-result").innerHTML = result
      ? `<div class="journey-summary"><strong>${Math.ceil(result.duration / 60)}<small> min</small></strong><span>${clock(result.departure)} → ${clock(result.arrival)}<small>${result.legs.filter((l) => !l.walk).length} tramos de transporte · por horario</small></span></div><div class="journey-legs">${result.legs.map((l) => `<div class="journey-leg"><div>${l.walk ? icon("footprints") : badge(n.routes[l.route])}</div><span><b>${esc(n.stops[l.from].name)}</b><p>${l.walk ? "Camina hasta" : esc(l.head) + " · " + l.stops + " paradas"}<br><b>${esc(n.stops[l.to].name)}</b></p><small>${clock(l.start)} → ${clock(l.end)} · ${Math.ceil((l.end - l.start) / 60)} min</small></span></div>`).join("")}</div>`
      : `<div class="empty"><h3>No encontramos una conexión.</h3><p>Prueba otra hora, fecha o modo de transporte. La búsqueda cubre ${city.id === "espana" ? "24" : "tres"} horas desde la salida.</p></div>`;
    refreshIcons();
  } catch {
    toast("No se pudo calcular el viaje.");
  } finally {
    if (tab === "journey" && epoch === cityEpoch) {
      button.disabled = false;
      button.innerHTML = `${icon("route")} Encontrar mi viaje ${icon("arrow-right")}`;
      refreshIcons();
    }
  }
}
function showData() {
  const dialog = $("#data-dialog");
  dialog.innerHTML = `<button id="close-data" class="close-detail" aria-label="Cerrar datos">${icon("x")}</button><div class="eyebrow">DATOS CON PROCEDENCIA</div><h2>Fuentes y cobertura</h2><p>${esc(APP_NAME)} reúne redes publicadas por sus operadores. La cobertura crece ciudad a ciudad; cada calendario tiene su propia vigencia.</p><div class="coverage-grid">${cities.map((c) => `<button data-city="${c.id}" class="coverage-city ${city.id === c.id ? "selected" : ""}"><b>${esc(c.name)}</b><span>${num(c.routes)} líneas · ${num(c.stops)} embarques</span><small>${esc(c.coverage)}</small></button>`).join("")}</div><h3>${esc(city.name)} · archivos publicados</h3>${n.meta.feeds.map((f) => `<div class="data-source"><span class="data-status ${feedCurrent(f) ? "ready" : "waiting"}">${feedCurrent(f) ? "CALENDARIO VIGENTE" : "FUERA DEL CALENDARIO"}</span><h3>${esc(f.publisher)}</h3><p>${num(f.routes)} líneas · ${num(f.trips)} viajes en el archivo.</p><small>Calendario ${formatDate(f.start)} — ${formatDate(f.end)}<br>Normalizado ${new Date(f.fetchedAt).toLocaleString("es-ES", { timeZone: "Europe/Madrid" })}${f.skippedTrips ? `<br>${num(f.skippedTrips)} viajes omitidos por tiempos incompletos o inválidos.` : ""}${f.approximateShapes ? "<br>Hay recorridos sin geometría verificable: sus líneas y vehículos se ocultan en el mapa." : ""}</small><a href="${esc(f.source)}" target="_blank" rel="noopener">Archivo utilizado ↗</a> · <a href="${esc(f.website)}" target="_blank" rel="noopener">Operador ↗</a> · <a href="${esc(f.license)}" target="_blank" rel="noopener">Licencia ↗</a></div>`).join("")}<div class="data-source"><span class="data-status ready">API PÚBLICA · BARCELONA</span><h3>FGC · Posiciones y ocupación</h3><p>Puntos azules: coordenadas publicadas por FGC. Se consultan cada 30 segundos al explorar la hora actual. La ocupación, cuando existe, es la media de los coches con información. Se ocultan las publicaciones con más de tres minutos de antigüedad.</p><a href="${FGC_SOURCE}" target="_blank" rel="noopener">FGC · CC BY 4.0 ↗</a></div><div class="data-source"><span class="data-status ${serverConfigured ? "ready" : "waiting"}">${serverConfigured ? "SERVIDOR CONECTADO" : "REQUIERE SERVIDOR"}</span><h3>TMB · Transit, iBus y Planner</h3><p>Las claves de GitHub actualizan el archivo de horarios. Para consultar iBus, detalles Transit y el planificador oficial desde esta web, conecta el servidor incluido con esas claves. El resto de ciudades utiliza sus propios horarios.</p></div><div class="data-source"><h3>Trazados y cartografía</h3><p>OpenStreetMap vía OpenFreeMap. Historias con fuentes enlazadas. Los vehículos por horario son interpolaciones sobre geometrías publicadas. Renfe sin shapes: corredores reconstruidos sobre vías del IGN pasando por las estaciones GTFS, con preferencia por ancho estándar en AVE; no son itinerarios confirmados por el operador. Las geometrías desconectadas se omiten. TUSSAM: recorridos municipales. Metro de Sevilla: relación cartográfica de OpenStreetMap. En «Viajar», los transbordos son aproximados y no se incorporan incidencias.</p><a href="https://api-features.idee.es/collections/railwaylink?f=html" target="_blank" rel="noopener">© IGN · vías ferroviarias ↗</a> · <a href="https://www.ign.es/resources/licencia/Condiciones_licenciaUso_IGN.pdf" target="_blank" rel="noopener">Licencia IGN ↗</a> · <a href="https://www.arcgis.com/home/item.html?id=c5e6ecf63aa944c8a09eb1e65e72d8f4" target="_blank" rel="noopener">Ayuntamiento de Sevilla · TUSSAM ↗</a> · <a href="https://www.openstreetmap.org/relation/255088" target="_blank" rel="noopener">Metro de Sevilla · OSM/ODbL ↗</a> · <a href="https://www.transportes.gob.es" target="_blank" rel="noopener">Powered by MIMTRANS ↗</a> · <a href="https://mobilitydatabase.org" target="_blank" rel="noopener">Archivos de Mobility Database ↗</a></div><form id="connection-form"><label class="field-label">SERVIDOR TMB PARA DATOS EN DIRECTO<input type="url" id="api-url" placeholder="https://tu-servidor.example" value="${esc(apiBase)}"></label><p class="footnote">Opcional. Las claves permanecen en el servidor.</p><button class="primary" type="submit">Guardar conexión</button><span id="connection-state"></span></form><a class="text-link" href="https://nap.transportes.gob.es/" target="_blank" rel="noopener">Más redes españolas: Punto de Acceso Nacional ↗</a>`;
  $$("[data-city]").forEach(
    (b) =>
      (b.onclick = () => {
        dialog.close();
        loadCity(b.dataset.city);
      }),
  );
  refreshIcons();
  dialog.showModal();
  $("#close-data").onclick = () => dialog.close();
  $("#connection-form").onsubmit = async (e) => {
    e.preventDefault();
    apiBase = $("#api-url").value.trim().replace(/\/$/, "");
    try {
      localStorage.setItem("latido-api", apiBase);
    } catch {}
    $("#connection-state").textContent = "Comprobando…";
    try {
      const r = await fetch(apiBase + "/api/status", {
        signal: AbortSignal.timeout(7000),
      });
      const data = await r.json();
      serverConfigured = !!data.configured;
      $("#connection-state").textContent = data.configured
        ? "Conectado. Credenciales configuradas."
        : "Servidor disponible. Faltan las credenciales TMB.";
    } catch {
      $("#connection-state").textContent =
        "No se pudo conectar. Comprueba la dirección y el permiso de acceso.";
    }
  };
}
const formatDate = (v) => `${v.slice(6, 8)}/${v.slice(4, 6)}/${v.slice(0, 4)}`;
async function checkServer() {
  if (!apiBase && location.hostname.endsWith("github.io")) return;
  try {
    const r = await fetch(apiBase + "/api/status", {
      signal: AbortSignal.timeout(5000),
    });
    if (r.ok) serverConfigured = !!(await r.json()).configured;
  } catch {}
}
function showStationAccess(i) {
  const st = n.stops[i];
  if (!st.parent || !$("#detail .detail-note")) return;
  const entrances = n.stops
    .map((s, j) => ({ ...s, index: j }))
    .filter((s) => s.kind === 2 && s.parent === st.parent);
  if (!entrances.length) return;
  $("#detail .detail-note").insertAdjacentHTML(
    "beforebegin",
    `<details class="station-access"><summary>Accesos de la estación · ${entrances.length}</summary>${entrances.map((e) => `<button data-entrance="${e.index}">${icon(e.accessible === 1 ? "accessibility" : "map-pin")}<span>${esc(e.name)}<small>${e.accessible === 1 ? "Acceso accesible según GTFS" : e.accessible === 2 ? "No accesible según GTFS" : "Accesibilidad sin especificar"}</small></span>${icon("arrow-up-right")}</button>`).join("")}</details>`,
  );
  $$("[data-entrance]").forEach(
    (b) =>
      (b.onclick = () => {
        const e = n.stops[+b.dataset.entrance];
        map.map.flyTo({
          center: [e.lon, e.lat],
          zoom: 17,
          pitch: 55,
          duration: 1000,
        });
        map.set("selection", [
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [e.lon, e.lat] },
          },
        ]);
        toast(
          `${e.name} · Acceso publicado en GTFS. No se verifica su estado en directo.`,
        );
      }),
  );
  refreshIcons();
}
async function tryOfficialPlan(from, to, options) {
  if (
    !serverConfigured ||
    options.accessible ||
    city.id !== "barcelona" ||
    n.stops[from].feed !== "tmb" ||
    n.stops[to].feed !== "tmb"
  )
    return false;
  const epoch = cityEpoch;
  try {
    const a = n.stops[from],
      b = n.stops[to],
      [year, month, day] = simDate.split("-"),
      h = Math.floor(simTime / 3600),
      min = Math.floor(simTime / 60) % 60;
    const params = new URLSearchParams({
      fromPlace: `${a.lat},${a.lon}`,
      toPlace: `${b.lat},${b.lon}`,
      date: `${month}-${day}-${year}`,
      time: `${String(h % 12 || 12).padStart(2, "0")}:${String(min).padStart(2, "0")}${h >= 12 ? "pm" : "am"}`,
      arriveBy: "false",
      mode:
        options.mode === "rail"
          ? "SUBWAY,WALK"
          : options.mode === "bus"
            ? "BUS,WALK"
            : "TRANSIT,WALK",
      showIntermediateStops: "true",
    });
    const response = await fetch(apiBase + "/api/planner?" + params, {
      signal: AbortSignal.timeout(14000),
    });
    if (!response.ok) return false;
    const data = await response.json(),
      it = data.plan?.itineraries?.[0];
    if (!it || tab !== "journey" || epoch !== cityEpoch) return false;
    const time = (t) =>
      new Date(t).toLocaleTimeString("es-ES", {
        timeZone: "Europe/Madrid",
        hour: "2-digit",
        minute: "2-digit",
      });
    $("#journey-result").innerHTML =
      `<div class="journey-summary"><strong>${Math.ceil(it.duration / 60)}<small> min</small></strong><span>${time(it.startTime)} → ${time(it.endTime)}<small>Planificador oficial TMB</small></span></div><div class="journey-legs">${it.legs.map((l) => `<div class="journey-leg"><div>${l.mode === "WALK" ? icon("footprints") : badge({ name: l.routeShortName || l.route || l.mode, color: /^[0-9a-f]{6}$/i.test(l.routeColor || "") ? "#" + l.routeColor : "#709774" })}</div><span><b>${esc(l.from.name)}</b><p>${l.mode === "WALK" ? "Camina hasta" : esc(l.headsign || l.mode)}<br><b>${esc(l.to.name)}</b></p><small>${time(l.startTime)} → ${time(l.endTime)}</small></span></div>`).join("")}</div>`;
    map.journeyOfficial(it);
    refreshIcons();
    return true;
  } catch {
    return false;
  }
}
$$("[data-tab]").forEach((b) => (b.onclick = () => setTab(b.dataset.tab)));
$("#about").onclick = () => {
  closePanel();
  const dialog = $("#about-dialog");
  dialog.innerHTML = `<div class="dialog-head"><span>ACERCA DEL PROYECTO</span><button id="close-about" aria-label="Cerrar Acerca de">${icon("x")}</button></div><div class="about-brand"><img src="${favicon}" alt="" width="56" height="56"><h1 id="about-title">${esc(APP_NAME)}</h1></div><p class="about-lead">${esc(APP_DESCRIPTION)}</p><p>Un mapa para consultar líneas y paradas, preparar viajes y explorar las redes de transporte de España. Reúne horarios publicados y datos en directo donde están disponibles.</p><dl class="project-meta"><div><dt>Autor</dt><dd>Alejandro Pico</dd></div><div><dt>Versión</dt><dd>${esc(project.version)}</dd></div><div><dt>Proyecto</dt><dd>Personal · no comercial</dd></div></dl><nav class="about-links" aria-label="Enlaces del proyecto"><a href="https://alejandropico.github.io/Portfolio/" target="_blank" rel="noopener noreferrer">Portfolio ${icon("arrow-up-right")}</a><a href="https://github.com/AlejandroPico/TMB" target="_blank" rel="noopener noreferrer">Repositorio ${icon("github")}</a></nav>`;
  refreshIcons();
  dialog.showModal();
  $("#close-about").onclick = () => dialog.close();
};
$("#source-state").onclick = showData;
$("#home-map").onclick = () => {
  closeDetail(false);
  selectedRoute = null;
  mode = "all";
  applyFilters();
  map.home();
};
$("#tilt").onclick = () => {
  const active = map.map.getPitch() < 15;
  map.map.easeTo({
    pitch: active ? 60 : 0,
    bearing: active ? -20 : 0,
    duration: 800,
  });
  $("#tilt").classList.toggle("active", active);
};
async function locate(automatic = false) {
  if (!navigator.geolocation) {
    if (!automatic) toast("Este navegador no ofrece geolocalización.");
    return;
  }
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const here = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      const nearestCity = cities
        .filter((c) => c.id !== "espana")
        .map((c) => ({
          c,
          d: distance(here, { lon: c.center[0], lat: c.center[1] }),
        }))
        .sort((a, b) => a.d - b.d)[0];
      if (loadingCity) return;
      if (nearestCity?.d <= 80000 && city?.id !== nearestCity.c.id)
        await loadCity(nearestCity.c.id);
      else if (nearestCity?.d > 80000) {
        if (city?.id !== "espana") await loadCity("espana");
        map.map.flyTo({
          center: [here.lon, here.lat],
          zoom: 11,
          bearing: 0,
          pitch: 0,
        });
        if (automatic) {
          toast(
            "En tu zona está conectada Renfe; todavía no hay una red urbana disponible.",
          );
          return;
        }
      }
      const nearest = n.stops
        .map((s, i) => ({ s, i, d: distance(s, here) }))
        .filter((x) => x.s.kind === 0)
        .sort((a, b) => a.d - b.d)[0];
      if (!nearest || nearest.d > 20000) {
        if (!automatic)
          toast(
            "No hay paradas conectadas a menos de 20 km. Consulta la cobertura en Fuentes.",
          );
        return;
      }
      if (!automatic) {
        showStop(nearest.i);
        toast(
          `${nearest.s.name}, a unos ${Math.round(nearest.d)} m en línea recta.`,
        );
      } else
        map.map.flyTo({
          center: [here.lon, here.lat],
          zoom: 13.5,
          bearing: 0,
          pitch: 0,
        });
    },
    () => {
      if (!automatic)
        toast(
          "No se pudo obtener tu ubicación. Puedes elegir la red en Explorar.",
        );
    },
    { timeout: 10000, maximumAge: 300000 },
  );
}
$("#locate").onclick = () => locate();
$("#drawer-close").onclick = closePanel;
$("#brand-menu").onclick = () => setTab("explore");
$("#menu-toggle").onclick = () => {
  const open = $("#app").classList.toggle("menu-open");
  $("#menu-toggle").setAttribute("aria-expanded", String(open));
  $("#menu-toggle").setAttribute(
    "aria-label",
    open ? "Cerrar menú" : "Abrir menú",
  );
  if (!open) closePanel();
};
$("#time-options").onclick = () => {
  const open = $("#clock-options").hidden;
  $("#clock-options").hidden = !open;
  $("#time-options").setAttribute("aria-expanded", String(open));
};
function updateClock() {
  $("#time-readout").textContent = clock(simTime);
  $("#time-slider").value = Math.floor(simTime);
  $("#clock-note").textContent = syncClock ? "Ahora" : "Horario";
  if ($("#departure-note")) $("#departure-note").textContent = clock(simTime);
}
$("#time-slider").oninput = (e) => {
  syncClock = false;
  simTime = +e.target.value;
  updateClock();
  drawMovement();
  drawGPS();
};
$("#time-slider").onchange = () => {
  if (selectedStop != null && !$("#detail").hidden) showStop(selectedStop);
};
$("#date").onchange = async (e) => {
  if (!e.target.value) return;
  syncClock = false;
  simDate = e.target.value;
  toast("Cargando el calendario de servicio…");
  try {
    trips = (await ask("day")).trips;
    drawMovement();
    drawGPS();
    updateClock();
    if (!trips.length)
      toast("El archivo GTFS no contiene servicio para esta fecha.");
  } catch {
    toast("No se pudo cargar el calendario.");
  }
};
$("#play").onclick = () => {
  playing = !playing;
  if (!playing) syncClock = false;
  drawGPS();
  updateClock();
  $("#play").innerHTML = icon(playing ? "pause" : "play");
  $("#play").setAttribute("aria-label", playing ? "Pausar" : "Reproducir");
  refreshIcons();
};
$("#speed").onclick = () => {
  speed = speed === 1 ? 10 : speed === 10 ? 60 : 1;
  if (speed !== 1) syncClock = false;
  $("#speed").textContent = speed + "×";
};
$("#reset-time").onclick = async () => {
  const now = madridNow();
  simTime = now.time;
  speed = 1;
  playing = true;
  syncClock = true;
  $("#speed").textContent = "1×";
  $("#play").innerHTML = icon("pause");
  if (simDate !== now.date) {
    simDate = now.date;
    $("#date").value = simDate;
    trips = (await ask("day")).trips;
  }
  updateClock();
  drawMovement();
  refreshIcons();
};
document.addEventListener("keydown", (e) => {
  if (
    e.key === "/" &&
    !["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName)
  ) {
    e.preventDefault();
    setTab("explore");
    $("#search").focus();
  }
  if (e.key === "Escape") {
    closeDetail();
    closePanel();
    $("#app").classList.remove("menu-open");
    $("#menu-toggle").setAttribute("aria-expanded", "false");
    $("#menu-toggle").setAttribute("aria-label", "Abrir menú");
  }
});
let rawMovementFeatures = [],
  lastFeatures = [],
  last = performance.now(),
  lastDraw = 0;
function drawMovement() {
  if (!movement || !map?.ready || loadingCity) return;
  rawMovementFeatures = movement.features(trips, simTime);
  lastFeatures = rawMovementFeatures.filter(
    (f) =>
      !(
        syncClock &&
        gpsVisible &&
        gps?.vehicles.length &&
        Date.now() - gps.timestamp <= 180000 &&
        n.routes[f.properties.route].feed === "fgc"
      ),
  );
  map.set("vehicles", lastFeatures);
  const filtered = (linearView ? rawMovementFeatures : lastFeatures).filter(
    (f) =>
      (mode === "all" || f.properties.mode === mode) &&
      (selectedRoute == null || f.properties.route === selectedRoute),
  );
  $("#moving-count").textContent =
    num(
      filtered
        .filter((f) => networkFilters.layers.motion.has(f.properties.route))
        .filter((f) =>
          f.properties.mode === "rail"
            ? railMovement
            : f.properties.mode === "bus"
              ? busMovement
              : otherMovement,
        ).length,
    ) + " estimados";
  if (linearView)
    schematic.update(
      rawMovementFeatures.filter((f) =>
        networkFilters.layers.motion.has(f.properties.route),
      ),
    );
}
function attachStopTools(i) {
  const st = n.stops[i];
  $(".access-note").insertAdjacentHTML(
    "afterend",
    `<details class="station-extras"><summary>Conexiones y alcance</summary><div class="reach-card"><p>Paradas alcanzables desde aquí</p><div class="reach-buttons">${[15, 30, 45].map((m) => `<button data-reach="${m}">${m} min</button>`).join("")}<button id="clear-reach" aria-label="Quitar alcance">×</button></div><small id="reach-summary">Descubre las paradas alcanzables por horario.</small></div>${st.feed !== "tmb" || st.mode !== "bus" ? "" : `<button class="transit-button" id="stop-transit">${icon("database")} Mobiliario y correspondencias TMB</button><div id="stop-transit-result"></div>`}</details>`,
  );
  $$("[data-reach]").forEach(
    (b) =>
      (b.onclick = async () => {
        const token = detailToken;
        b.disabled = true;
        $("#reach-summary").textContent = "Buscando conexiones…";
        try {
          const reachable = await ask("reach", {
            from: i,
            time: simTime,
            minutes: +b.dataset.reach,
          });
          if (token !== detailToken) return;
          map.set(
            "reach",
            reachable.map((x) => ({
              type: "Feature",
              geometry: {
                type: "Point",
                coordinates: [n.stops[x.stop].lon, n.stops[x.stop].lat],
              },
              properties: { minutes: x.minutes },
            })),
          );
          $("#reach-summary").textContent =
            `${reachable.length} puntos de embarque en ${b.dataset.reach} minutos, incluyendo la salida. Horarios y transbordos aproximados; sin incidencias.`;
          $$("[data-reach]").forEach((x) =>
            x.classList.toggle("active", x === b),
          );
        } catch {
          if (token === detailToken)
            $("#reach-summary").textContent = "No se pudo calcular el alcance.";
        } finally {
          b.disabled = false;
        }
      }),
  );
  $("#clear-reach").onclick = () => {
    map.set("reach", []);
    $("#reach-summary").textContent =
      "Descubre las paradas alcanzables por horario.";
    $$("[data-reach]").forEach((x) => x.classList.remove("active"));
  };
  if ($("#stop-transit"))
    $("#stop-transit").onclick = () =>
      loadTransit(
        [
          ["Mobiliario", `/parades/${st.code}/mobiliari`],
          ["Correspondencias", `/parades/${st.code}/corresp`],
        ],
        $("#stop-transit-result"),
      );
}
function attachTransitTools(r) {
  if (r.feed !== "tmb") return;
  $(".route-description").insertAdjacentHTML(
    "afterend",
    `<button class="transit-button" id="line-transit">${icon("database")} Más información de TMB</button><div id="line-transit-result"></div>`,
  );
  $("#line-transit").onclick = () => {
    const base = `/linies/${r.type === 3 ? "bus" : "metro"}/${r.sourceId.split(".")[1]}`;
    loadTransit(
      [
        ["Horarios", base + "/horaris"],
        ["Recorridos", base + "/recs"],
        [
          r.type === 3 ? "Paradas" : "Estaciones",
          base + (r.type === 3 ? "/parades" : "/estacions"),
        ],
      ],
      $("#line-transit-result"),
    );
  };
}
async function loadTransit(resources, target) {
  if (!serverConfigured) {
    target.innerHTML =
      '<p class="footnote">Conecta un servidor con las credenciales TMB desde el panel Datos para consultar esta información.</p>';
    return;
  }
  target.innerHTML = '<p class="muted">Consultando Transit…</p>';
  const results = await Promise.allSettled(
    resources.map(async ([label, path]) => {
      const response = await fetch(apiBase + "/api/transit" + path, {
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok)
        throw new Error(
          "Transit necesita un servidor con credenciales TMB válidas.",
        );
      return { label, data: await response.json() };
    }),
  );
  if (!target.isConnected) return;
  target.innerHTML = results
    .map((result) => {
      if (result.status === "rejected")
        return `<p class="footnote">${esc(result.reason.message)}</p>`;
      const { label, data } = result.value,
        features = data.features || [],
        objects = features.length
          ? features.slice(0, 3).map((f) => f.properties)
          : [data];
      return `<details class="api-info"><summary>${label}${features.length ? " · " + features.length + " elementos" : ""}</summary>${
        objects
          .map((o) =>
            Object.entries(o || {})
              .filter(([, v]) => typeof v === "string" || typeof v === "number")
              .slice(0, 18)
              .map(
                ([k, v]) =>
                  `<div><span>${esc(k.replaceAll("_", " ").toLowerCase())}</span><b>${esc(v)}</b></div>`,
              )
              .join(""),
          )
          .join("") ||
        "<p>Respuesta recibida. Sin campos simples para mostrar.</p>"
      }</details>`;
    })
    .join("");
}
function tick(now) {
  const dt = Math.min(2, (now - last) / 1000);
  last = now;
  if (playing && !loadingCity && n) {
    if (syncClock) {
      const current = madridNow();
      simTime = current.time;
      if (simDate !== current.date) {
        simDate = current.date;
        $("#date").value = simDate;
        ask("day")
          .then((result) => {
            if (simDate === current.date) trips = result.trips;
          })
          .catch(() =>
            toast("No se pudo actualizar el calendario de servicio."),
          );
      }
    } else simTime = Math.min(86399, simTime + dt * speed);
    if (simTime >= 86399 && !syncClock) {
      playing = false;
      $("#play").innerHTML = icon("play");
      refreshIcons();
    }
    if (now - lastDraw > 800) {
      drawMovement();
      drawGPS();
      refreshGPS();
      updateClock();
      renderStationBoard();
      refreshStationBoard();
      updateVehicleDetail();
      lastDraw = now;
    }
  }
  requestAnimationFrame(tick);
}
const modeLabel = (m) =>
  ({
    bus: "Bus",
    metro: "Metro",
    rail: "Tren",
    tram: "Tranvía",
    funicular: "Funicular",
    ferry: "Ferry",
  })[m] || "Transporte";
const feedCurrent = (f) => {
  const today = madridNow().date.replaceAll("-", "");
  return f.start <= today && today <= f.end;
};
function coverageNotice() {
  const expired = n.meta.feeds.filter((f) => !feedCurrent(f));
  return `<p class="coverage-note">${esc(city.coverage)}${expired.length ? `<br><strong>${expired.map((f) => esc(f.publisher)).join(", ")}: archivo fuera del calendario actual. Consulta sus fechas en Fuentes.</strong>` : ""}</p>`;
}
function showGPS(id) {
  rememberDetail();
  stationBoard = null;
  vehicleDetail = null;
  selectedStop = null;
  const v = gps?.vehicles.find((v) => v.id === id);
  if (!v || Date.now() - v.timestamp > 180000 || !syncClock) return;
  detailToken++;
  showDetail(
    `<div class="eyebrow gps-text">POSICIÓN PUBLICADA · FGC</div><div class="detail-badges">${operatorSymbol({ feed: "fgc" })}${n.routes.find((r) => r.feed === "fgc" && r.name === v.line) ? badge(n.routes.find((r) => r.feed === "fgc" && r.name === v.line)) : ""}</div><h2>Línea ${esc(v.line)}</h2><p class="story-subtitle">${v.trainType ? "Serie " + esc(v.trainType) + " · " : ""}Destino ${esc(v.destination)}</p><div class="gps-card"><strong>${v.occupancy === null ? "Sin dato" : v.occupancy + "%"}</strong><span>Ocupación media de coches con dato</span></div><p class="story-body">${v.onTime === true ? "El operador indica circulación en hora." : v.onTime === false ? "El operador indica circulación fuera de hora." : "Puntualidad sin especificar."}${v.station ? " Código de estación: " + esc(v.station) + "." : ""}</p><small class="detail-note">Publicación del conjunto FGC: ${new Date(v.timestamp).toLocaleTimeString("es-ES", { timeZone: "Europe/Madrid" })}. Esta hora corresponde a la actualización del conjunto, no a una medición individual del tren. Los códigos de destino son los del operador.</small><details class="raw-vehicle-data"><summary>Todos los campos publicados</summary><dl>${Object.entries(
      v.details || {},
    )
      .map(
        ([key, value]) =>
          `<div><dt>${esc(key)}</dt><dd>${esc(typeof value === "object" ? JSON.stringify(value) : value)}</dd></div>`,
      )
      .join(
        "",
      )}</dl></details><a class="text-link" href="${FGC_SOURCE}" target="_blank" rel="noopener">Fuente FGC · CC BY 4.0 ↗</a>`,
  );
}
function drawGPS() {
  if (!map?.ready) return;
  const visible =
    city?.id === "barcelona" &&
    gpsVisible &&
    syncClock &&
    vehiclesVisible &&
    gps &&
    Date.now() - gps.timestamp <= 180000;
  const features = visible
    ? gps.vehicles.map((v) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [v.lon, v.lat] },
        properties: {
          id: v.id,
          line: v.line,
          route: n.routes.findIndex(
            (r) => r.feed === "fgc" && r.name === v.line,
          ),
          mode: "rail",
        },
      }))
    : [];
  map.set("gps", features);
  let label = $("#gps-status");
  if (label) {
    label.hidden = linearView || city?.id !== "barcelona" || !gpsVisible;
    label.textContent = !syncClock
      ? "FGC GPS · vuelve a «Ahora» para verlo"
      : visible
        ? `${features.filter((f) => networkFilters.layers.motion.has(f.properties.route) && (mode === "all" || mode === "rail") && (selectedRoute == null || selectedRoute === f.properties.route)).length} posiciones FGC · ${new Date(gps.timestamp).toLocaleTimeString("es-ES", { timeZone: "Europe/Madrid" })}`
        : gpsMessage;
  }
}
async function refreshGPS() {
  if (
    gpsBusy ||
    city?.id !== "barcelona" ||
    !gpsVisible ||
    !syncClock ||
    !vehiclesVisible ||
    document.hidden ||
    loadingCity ||
    Date.now() < gpsNext
  )
    return;
  const epoch = cityEpoch;
  gpsBusy = true;
  gpsNext = Date.now() + 30000;
  try {
    const snapshot = await fetchFGC();
    if (epoch !== cityEpoch) return;
    gps = snapshot;
    gpsMessage = "FGC GPS · conectado";
  } catch (e) {
    if (epoch === cityEpoch) {
      gps = null;
      gpsMessage = "FGC GPS · no disponible ahora";
    }
  } finally {
    gpsBusy = false;
    drawGPS();
  }
}
async function loadCity(id) {
  if (loadingCity) return;
  const next = cities.find((c) => c.id === id);
  if (!next) return;
  const epoch = ++cityEpoch;
  loadingCity = true;
  $("#city-selector").disabled = true;
  $("#loading").hidden = false;
  $("#loading").classList.remove("gone");
  $("#loading h2").textContent = "Cargando " + next.name;
  $("#loading p").textContent = "Cargando solo los datos de esta red…";
  try {
    const responses = await Promise.all([
      fetch(next.network),
      fetch(next.schedule),
    ]);
    if (responses.some((r) => !r.ok))
      throw new Error("No se encontraron los datos de esta red.");
    const data = await Promise.all(responses.map((r) => r.json()));
    map?.map.remove();
    map = null;
    movement = null;
    trips = [];
    gps = null;
    gpsNext = 0;
    [n, s] = data;
    detailContext = stationBoard = vehicleDetail = null;
    networkFilters = new NetworkFilters(n);
    railMovement = busMovement = otherMovement = true;
    const mapTheme = applyTheme(themeId, next.id);
    applyRouteColors(n);
    city = next;
    stories = cityStories[id] || [];
    tours = cityTours[id] || [];
    selectedStop = selectedRoute = null;
    detailToken++;
    query = "";
    mode = "all";
    $("#detail").hidden = true;
    const now = madridNow();
    simDate = now.date;
    simTime = now.time;
    syncClock = true;
    speed = 1;
    playing = true;
    $("#date").value = simDate;
    $("#speed").textContent = "1×";
    $("#play").innerHTML = icon("pause");
    $("#date").min = n.meta.start.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
    $("#date").max = n.meta.end.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
    $("#city-selector").value = id;
    try {
      localStorage.setItem("enruta-city", id);
    } catch {}
    const url = new URL(location.href);
    url.searchParams.set("city", id);
    history.replaceState(null, "", url);
    renderPanel();
    updateClock();
    movement = new Movement(n, s);
    const ready = ask("init", { network: n, schedule: s });
    const currentMap = new CityMap(n, {
      movement,
      theme: mapTheme,
      onStop: showStop,
      onRoute: showRoute,
      onStory: showStory,
      onVehicle: showVehicle,
      onGPS: showGPS,
      onReady: () => {
        if (epoch !== cityEpoch) return;
        applyFilters();
        currentMap.set(
          "stories",
          stories.map((st) => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: [st.lon, st.lat] },
            properties: { id: st.id },
          })),
        );
        drawMovement();
        drawGPS();
      },
      onError: () =>
        toast(
          "La cartografía no se pudo cargar. Los listados y horarios siguen disponibles.",
        ),
    });
    map = currentMap;
    const reflectView = () => {
      const active = currentMap.map.getPitch() > 15;
      $("#tilt").classList.toggle("active", active);
      $("#tilt").setAttribute("aria-pressed", String(active));
    };
    currentMap.map.on("moveend", reflectView);
    reflectView();
    trips = (await ready).trips;
    schematic = new Schematic($("#schematic"), {
      onStop: showStop,
      onVehicle: showVehicle,
      onRoute: showRoute,
      badge,
    });
    refreshSchematic();
    $("#loading").classList.add("gone");
    setTimeout(() => {
      if (epoch === cityEpoch) $("#loading").hidden = true;
    }, 700);
    if (!trips.length)
      toast(
        "No hay servicio publicado para hoy. Consulta el calendario en Fuentes.",
      );
  } catch (e) {
    toast(e.message);
    $("#loading").hidden = true;
  } finally {
    loadingCity = false;
    $("#city-selector").disabled = false;
    if (city) $("#city-selector").value = city.id;
    refreshGPS();
  }
}
async function init() {
  try {
    const response = await fetch("./data/cities.json");
    if (!response.ok) throw new Error("No se encontró el catálogo de redes.");
    cities = (await response.json()).cities;
    $("#city-selector").innerHTML = cities
      .map((c) => `<option value="${c.id}">${esc(c.name)}</option>`)
      .join("");
    $("#city-selector").onchange = (e) => loadCity(e.target.value);
    $("#gps-status").onclick = () => {
      if (gps?.vehicles.length) showGPS(gps.vehicles[0].id);
      else toast(gpsMessage);
    };
    let saved;
    try {
      saved = localStorage.getItem("enruta-city");
    } catch {}
    const explicitCity = new URL(location.href).searchParams.get("city");
    const requested = explicitCity || saved || DEFAULT_CITY;
    await loadCity(
      cities.some((c) => c.id === requested) ? requested : DEFAULT_CITY,
    );
    if (!explicitCity) locate(true);
    checkServer();
    requestAnimationFrame(tick);
  } catch (e) {
    $("#loading").innerHTML =
      `<h2>No pudimos cargar las redes.</h2><p>${esc(e.message)}</p><button id="retry" class="primary">Volver a intentar</button>`;
    $("#retry").onclick = () => location.reload();
  }
}
init();
