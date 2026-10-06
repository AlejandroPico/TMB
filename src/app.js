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
import { CityMap, Movement } from "./map.js";
import { clock, madridNow, distance } from "./transit.js";
import { stories, tours } from "./stories.js";
import "./style.css";
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
  mode = "metro",
  playing = true,
  speed = 1,
  simTime = initial.time,
  simDate = initial.date,
  syncClock = true,
  query = "",
  stopsVisible = true,
  storiesVisible = true,
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
$("#app").innerHTML =
  `<header class="header"><a class="brand" href="./" aria-label="Barcelona Latido, inicio"><span class="brand-symbol">${icon("activity")}</span><span>barcelona<span class="brand-light">latido</span></span><sup>ATLAS URBANO</sup></a><div class="header-middle"><span class="coordinate">41°23′ N &nbsp; 2°10′ E</span><span class="divider"></span>Una ciudad. Miles de conexiones.</div><button class="source-state" id="source-state">${icon("radio")} <span>Horarios TMB</span><span class="status-dot"></span></button></header>
<div class="workspace"><nav class="rail" aria-label="Secciones"><button class="rail-btn active" data-tab="explore" title="Explorar la red" aria-label="Explorar la red">${icon("layers-2")}<span>Explorar</span></button><button class="rail-btn" data-tab="journey" title="Planificar un viaje" aria-label="Planificar un viaje">${icon("route")}<span>Viajar</span></button><button class="rail-btn" data-tab="stories" title="Historias de Barcelona" aria-label="Historias de Barcelona">${icon("book-open")}<span>Historias</span></button><button class="rail-btn" data-tab="favorites" title="Tus paradas" aria-label="Tus paradas">${icon("bookmark")}<span>Guardadas</span></button><div class="rail-spacer"></div><button class="rail-btn" data-tab="data" title="Fuentes y conexión" aria-label="Fuentes y conexión">${icon("database")}<span>Datos</span></button><a class="rail-btn github" href="https://github.com/AlejandroPico/TMB" target="_blank" rel="noopener" aria-label="Ver proyecto en GitHub">${icon("github")}</a></nav>
<aside class="sidebar"><button id="sheet-toggle" class="sheet-toggle" aria-expanded="false" aria-label="Abrir o cerrar explorador"><span></span></button><div id="panel"></div><div class="sidebar-foot"><span class="tiny-pulse"></span><span>Red oficial · TMB</span><button id="about" aria-label="Información sobre los datos">${icon("info")}</button></div></aside>
<main class="map-area"><div id="map" aria-label="Mapa interactivo del transporte de Barcelona"></div><div class="map-vignette"></div><div class="map-intro"><div class="eyebrow"><span class="small-line"></span> BARCELONA, EN MOVIMIENTO</div><h1>La ciudad tiene<br>su propio <em>latido.</em></h1><p>Entra en su red. Descubre sus historias.</p><div class="intro-tags"><span>${icon("train-front")} Metro</span><span>${icon("bus-front")} Bus</span><span>${icon("landmark")} Ciudad</span></div></div>
<div class="map-tools"><button id="home-map" title="Vista general" aria-label="Vista general">${icon("scan")}</button><button id="zoom-in" title="Acercar" aria-label="Acercar">${icon("plus")}</button><button id="zoom-out" title="Alejar" aria-label="Alejar">${icon("minus")}</button><div class="tool-divider"></div><button id="tilt" title="Alternar vista 3D" aria-label="Alternar vista 3D">3D</button><button id="locate" title="Paradas cerca de mí" aria-label="Paradas cerca de mí">${icon("locate-fixed")}</button></div>
<div class="map-caption"><span class="live-dot"></span><span>UNA RECREACIÓN DEL SERVICIO PROGRAMADO</span></div><div id="detail" class="detail" hidden></div>
<div class="map-layers"><label><input id="layer-stops" type="checkbox" checked><span>Paradas</span></label><label><input id="layer-stories" type="checkbox" checked><span>Historias</span></label><label><input id="layer-vehicles" type="checkbox" checked><span>Movimiento</span></label></div>
<div class="timeline"><div class="timeline-top"><div class="time-title">${icon("clock-3")}<span>El pulso de la ciudad<small id="clock-note">Ahora · Europe/Madrid</small></span></div><div class="timeline-date"><input id="date" type="date" value="${simDate}" aria-label="Fecha del horario"><span id="time-readout">${clock(simTime)}</span></div><div class="playback"><button id="reset-time" title="Volver a la hora actual" aria-label="Volver a la hora actual">${icon("rotate-ccw")}</button><button id="play" title="Pausar" aria-label="Pausar">${icon("pause")}</button><button id="speed" aria-label="Cambiar velocidad de reproducción">1×</button></div></div><input id="time-slider" type="range" min="0" max="86399" step="60" value="${simTime}" aria-label="Hora del servicio"><div class="time-ticks"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span></div></div>
<div class="map-bottom"><span><span class="legend-dot metro"></span> Metro <span class="legend-dot bus"></span> Bus <span class="legend-dot story"></span> Historias</span><span id="moving-count">Preparando el horario…</span></div></main></div>
<div id="loading" class="loading"><span class="loading-symbol">${icon("activity")}</span><h2>Una ciudad está despertando.</h2><p>Conectando líneas, paradas e historias de Barcelona…</p><div class="loading-line"></div></div><div id="toast" role="status" class="toast" hidden></div><dialog id="data-dialog"></dialog>`;
refreshIcons();
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => ($("#toast").hidden = true), 5500);
}
const badge = (r) =>
  `<span class="line-badge" style="--line:${r.color}">${esc(r.name)}</span>`;
const num = (x) => new Intl.NumberFormat("es-ES").format(x);
function header(title, subtitle) {
  return `<div class="panel-head"><div class="eyebrow">TU ATLAS DE BARCELONA</div><h2>${title}</h2><p>${subtitle}</p></div>`;
}
function renderPanel() {
  if (!n) return;
  let html = "";
  if (tab === "explore") {
    html =
      header(
        "Cada línea, un mundo.",
        "Explora las conexiones que mueven la ciudad.",
      ) +
      `<div class="network-stats"><div><strong>${n.routes.filter((r) => r.type !== 3).length}</strong><span>líneas de metro¹</span></div><div><strong>${n.routes.filter((r) => r.type === 3).length}</strong><span>líneas de bus</span></div><div><strong>${num(n.meta.stops)}</strong><span>paradas²</span></div></div><div class="segmented" role="group" aria-label="Modo de transporte">${[
        ["metro", "Metro"],
        ["bus", "Bus"],
        ["all", "Todo"],
      ]
        .map(
          ([id, name]) =>
            `<button data-mode="${id}" class="${mode === id ? "active" : ""}">${name}</button>`,
        )
        .join(
          "",
        )}</div><label class="search-box">${icon("search")}<input id="search" placeholder="Busca una línea o una parada" value="${esc(query)}" aria-label="Buscar líneas y paradas"><kbd>/</kbd></label><div class="list-heading"><span>${query ? "RESULTADOS" : "LÍNEAS DE LA RED"}</span><button id="clear-route" title="Mostrar todas las líneas">${selectedRoute != null ? "Ver todas" : "↓"}</button></div><div class="network-list" id="network-list">${networkList()}</div><div class="editorial-card"><span>UN SIGLO BAJO TUS PIES</span><h3>El viaje empezó<br>con cuatro estaciones.</h3><button id="story-invite">Descubre su historia ${icon("arrow-up-right")}</button><div class="editorial-art">1924<span>→</span>2026</div></div><p class="footnote">¹ Incluye el funicular. ² Puntos de embarque del GTFS; una estación puede tener varios.</p>`;
  }
  if (tab === "stories") {
    html =
      header(
        "La ciudad que no ves.",
        "Historias reales, escondidas a lo largo de la red.",
      ) +
      `<div class="story-list">${stories.map((st) => `<button class="story-card" data-story="${st.id}"><div class="story-meta"><span>${esc(st.tag)}</span><b>${st.year}</b></div><h3>${st.title}</h3><p>${st.subtitle}</p><span class="story-cta">Descubrir en el mapa ${icon("arrow-up-right")}</span></button>`).join("")}</div><div class="list-heading">RECORRIDOS PARA DEJARSE LLEVAR</div><div class="tour-list">${tours.map((t, i) => `<button class="tour" data-tour="${i}">${icon("compass")}<span><b>${t.title}</b><small>${t.description}</small></span>${icon("chevron-right")}</button>`).join("")}</div>`;
  }
  if (tab === "favorites") {
    const saved = n.stops
      .map((st, i) => ({ ...st, index: i }))
      .filter((st) => favorites.includes(st.id));
    html =
      header(
        "Tus lugares habituales.",
        "Guarda paradas y vuelve a ellas con un toque.",
      ) +
      `<div class="saved-list">${saved.length ? saved.map((st) => stopRow(st, st.index)).join("") : `<div class="empty">${icon("bookmark")}<h3>El mapa se vuelve tuyo.</h3><p>Abre una parada y pulsa «Guardar». Tus favoritos se conservan en este navegador.</p><button id="go-explore" class="primary">Explorar paradas</button></div>`}</div>`;
  }
  if (tab === "journey") {
    const opts = n.stops
      .map((st, i) => ({ ...st, index: i }))
      .filter((st) => st.kind === 0)
      .sort((a, b) => a.name.localeCompare(b.name));
    const options = opts
      .map(
        (st) =>
          `<option value="${st.index}">${esc(st.name)} · ${st.id.startsWith("1.") ? "Metro" : "Bus " + esc(st.code)}</option>`,
      )
      .join("");
    html =
      header(
        "Tu próximo destino.",
        "Encuentra un viaje con los horarios oficiales.",
      ) +
      `<form id="journey-form"><label class="field-label">ORIGEN<select id="from" required>${options}</select></label><div class="swap-row"><span class="route-dots">⋮</span><button type="button" id="swap" aria-label="Intercambiar origen y destino">${icon("arrow-down-up")}</button></div><label class="field-label">DESTINO<select id="to" required>${options}</select></label><div class="journey-options"><label>Transporte<select id="journey-mode"><option value="all">Metro + Bus</option><option value="metro">Solo metro</option><option value="bus">Solo bus</option></select></label><label class="check-label"><input id="accessible" type="checkbox"> Solo paradas accesibles³</label></div><button class="primary" id="plan-button" type="submit">${icon("route")} Encontrar mi viaje ${icon("arrow-right")}</button></form><div class="plan-notice">${icon("info")}<p>Salida a las <b id="departure-note">${clock(simTime)}</b> del día del reloj. Cambia la fecha y hora en el mapa.</p></div><div id="journey-result"></div><p class="footnote">³ Filtro según el campo de accesibilidad del GTFS. No verifica ascensores en servicio ni todo el itinerario peatonal. La planificación local usa transbordos aproximados y no incluye incidencias.</p>`;
  }
  $("#panel").innerHTML = html;
  refreshIcons();
  bindPanel();
  if (tab === "journey") {
    const find = (name) =>
      n.stops.findIndex((st) => st.kind === 0 && st.name === name);
    $("#from").value = selectedStop ?? find("Catalunya");
    $("#to").value = find("Sagrada Família");
  }
}
function stopRow(st, i) {
  const rs = n.routes.filter((r) => r.stops.includes(i));
  return `<button class="stop-row" data-stop="${i}"><span class="stop-type">${icon(st.id.startsWith("1.") ? "train-front" : "bus-front")}</span><span><b>${esc(st.name)}</b><small>${st.id.startsWith("1.") ? "Estación de metro" : "Parada " + esc(st.code)} ${rs.slice(0, 4).map(badge).join("")}</small></span>${icon("chevron-right")}</button>`;
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
        (mode === "all" || (r.type === 3 ? "bus" : "metro") === mode) &&
        (!q || normalize(r.name + " " + r.description).includes(q)),
    );
  let html = rs
    .map(
      (r) =>
        `<button class="route-row ${selectedRoute === r.index ? "selected" : ""}" data-route="${r.index}">${badge(r)}<span><b>${esc(r.description.split(/ - | \/ /)[0])}</b><small>↔ ${esc(
          r.description
            .split(/ - | \/ /)
            .slice(1)
            .join(" - ") || r.description,
        )}</small></span><span class="route-size">${r.stops.length}<small>paradas</small></span></button>`,
    )
    .join("");
  if (q) {
    const ss = n.stops
      .map((st, i) => ({ ...st, index: i }))
      .filter(
        (st) =>
          st.kind === 0 &&
          (mode === "all" ||
            (st.id.startsWith("1.") ? "metro" : "bus") === mode) &&
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
function bindPanel() {
  bindList();
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
  if ($("#story-invite")) $("#story-invite").onclick = () => setTab("stories");
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
function setTab(next) {
  if (next === "data") {
    showData();
    return;
  }
  tab = next;
  $(".sidebar").classList.add("open");
  $("#sheet-toggle").setAttribute("aria-expanded", "true");
  $$("[data-tab]").forEach((b) =>
    b.classList.toggle("active", b.dataset.tab === tab),
  );
  renderPanel();
}
function applyFilters() {
  map?.filters({
    mode,
    route: selectedRoute,
    stops: stopsVisible,
    stories: storiesVisible,
    vehicles: vehiclesVisible,
  });
}
function showDetail(html) {
  $("#detail").innerHTML =
    `<button class="close-detail" aria-label="Cerrar detalle">${icon("x")}</button>${html}`;
  $("#detail").hidden = false;
  $(".map-intro").classList.add("subtle");
  refreshIcons();
  $(".close-detail").onclick = () => {
    detailToken++;
    $("#detail").hidden = true;
    $(".map-intro").classList.remove("subtle");
    map.set("selection", []);
  };
}
async function showStop(i) {
  selectedStop = i;
  const token = ++detailToken,
    st = n.stops[i],
    rs = n.routes.filter((r) => r.stops.includes(i));
  $(".sidebar").classList.remove("open");
  map.focusStop(i);
  showDetail(
    `<div class="eyebrow">${st.id.startsWith("1.") ? "ESTACIÓN DE METRO" : "PARADA DE AUTOBÚS · " + esc(st.code)}</div><h2>${esc(st.name)}</h2><div class="detail-badges">${rs.map(badge).join("")}</div><div class="detail-actions"><button id="save-stop">${icon(favorites.includes(st.id) ? "bookmark-check" : "bookmark")} ${favorites.includes(st.id) ? "Guardada" : "Guardar"}</button><button id="route-from">${icon("route")} Salir de aquí</button></div><div class="access-note">${icon("accessibility")} ${st.accessible === 1 ? "Embarque accesible según GTFS" : st.accessible === 2 ? "Embarque no accesible según GTFS" : "Accesibilidad sin especificar"}</div><div class="list-heading"><span>PRÓXIMAS SALIDAS</span><span id="arrival-label">HORARIO</span></div><div id="arrivals"><p class="muted">Consultando el horario…</p></div><small class="detail-note">Predicción por horario publicado. El movimiento del mapa es una interpolación; no representa posiciones GPS. Las horas intermedias sin dato se estiman entre las salidas publicadas.</small>`,
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
    const deps = await ask("departures", { stop: i, time: simTime });
    if (token !== detailToken) return;
    $("#arrivals").innerHTML = deps.length
      ? deps
          .slice(0, 8)
          .map(
            (d) =>
              `<div class="arrival">${badge(n.routes[d.trip.t[0]])}<span>${esc(s.heads[d.trip.t[3]])}<small>${d.trip.frequency ? "Intervalo estimado GTFS" : "Salida programada"}</small></span><b>${Math.max(0, Math.ceil((d.time - simTime) / 60))}<small>min</small></b></div>`,
          )
          .join("")
      : '<p class="muted">No hay más salidas en este día de servicio. Prueba otra hora o fecha.</p>';
    if (!st.id.startsWith("1.") && syncClock) loadLive(st, token);
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
          })),
        ),
      )
      .sort((a, b) => a.time - b.time);
    if (token !== detailToken || !arrivals.length) return;
    $("#arrival-label").textContent = "iBUS · EN DIRECTO";
    $("#arrivals").innerHTML = arrivals
      .slice(0, 8)
      .map(
        (a) =>
          `<div class="arrival"><span class="line-badge" style="--line:#62877a">${esc(a.name)}</span><span>${esc(a.destination)}<small>Predicción TMB · ${new Date(data.timestamp).toLocaleTimeString("es-ES", { timeZone: "Europe/Madrid" })}</small></span><b>${Math.max(0, Math.ceil((a.time - Date.now()) / 60000))}<small>min</small></b></div>`,
      )
      .join("");
    $(".detail-note").textContent =
      "Previsión iBus consultada en directo. La animación del mapa sigue basada en el horario GTFS.";
  } catch {}
}
function showRoute(i) {
  selectedRoute = i;
  const r = n.routes[i];
  mode = r.type === 3 ? "bus" : "metro";
  applyFilters();
  if (tab === "explore") renderPanel();
  $(".sidebar").classList.remove("open");
  map.focusRoute(i);
  detailToken++;
  const d = r.directions[0];
  showDetail(
    `<div class="eyebrow">${r.type === 3 ? "RED DE AUTOBUSES" : "RED DE METRO"}</div><div class="route-detail-title">${badge(r)}<h2>${esc(r.name)}</h2></div><p class="route-description">${esc(r.description)}</p><div class="direction-switch">${r.directions.map((d, k) => `<button data-direction="${k}" class="${k === 0 ? "active" : ""}">Sentido ${k + 1}</button>`).join("")}</div><div class="line-stations" id="line-stations">${lineStations(d, r)}</div><a class="text-link" href="${esc(r.url)}" target="_blank" rel="noopener">Ver la línea en TMB ${icon("arrow-up-right")}</a>`,
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
    `<div class="eyebrow">${esc(st.tag)}</div><div class="story-year">${st.year}<span>BARCELONA</span></div><h2>${st.title}</h2><p class="story-subtitle">${st.subtitle}</p><p class="story-body">${st.body}</p><a class="text-link" href="${st.source}" target="_blank" rel="noopener">Leer la historia en TMB ${icon("arrow-up-right")}</a><button id="story-near" class="primary">${icon("train-front")} Explorar la estación</button>`,
  );
  $("#story-near").onclick = () => {
    const near = n.stops
      .map((s, i) => ({ s, i, d: distance(s, st) }))
      .filter((x) => x.s.kind === 0 && x.s.id.startsWith("1."))
      .sort((a, b) => a.d - b.d)[0];
    if (near) showStop(near.i);
  };
}
function showTour(i) {
  const t = tours[i];
  mode = "metro";
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
          (s) => s.kind === 0 && s.id.startsWith("1.") && s.name === name,
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
  const f = lastFeatures.find((x) => x.properties.id === id);
  if (!f) return;
  const r = n.routes[f.properties.route];
  toast(
    `${r.name} → ${f.properties.head} · Próxima parada: ${n.stops[f.properties.next].name}. Posición interpolada del horario.`,
  );
}
async function plan(e) {
  e.preventDefault();
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
  };
  try {
    if (await tryOfficialPlan(from, to, options)) return;
    const result = await ask("plan", { from, to, time: simTime, options });
    if (tab !== "journey") return;
    map.journey(result);
    $("#journey-result").innerHTML = result
      ? `<div class="journey-summary"><strong>${Math.ceil(result.duration / 60)}<small> min</small></strong><span>${clock(result.departure)} → ${clock(result.arrival)}<small>${result.legs.filter((l) => !l.walk).length} tramos de transporte · por horario</small></span></div><div class="journey-legs">${result.legs.map((l) => `<div class="journey-leg"><div>${l.walk ? icon("footprints") : badge(n.routes[l.route])}</div><span><b>${esc(n.stops[l.from].name)}</b><p>${l.walk ? "Camina hasta" : esc(l.head) + " · " + l.stops + " paradas"}<br><b>${esc(n.stops[l.to].name)}</b></p><small>${clock(l.start)} → ${clock(l.end)} · ${Math.ceil((l.end - l.start) / 60)} min</small></span></div>`).join("")}</div>`
      : `<div class="empty"><h3>No encontramos una conexión.</h3><p>Prueba otra hora, fecha o modo de transporte. La búsqueda cubre tres horas desde la salida.</p></div>`;
    refreshIcons();
  } catch {
    toast("No se pudo calcular el viaje.");
  } finally {
    if (tab === "journey") {
      button.disabled = false;
      button.innerHTML = `${icon("route")} Encontrar mi viaje ${icon("arrow-right")}`;
      refreshIcons();
    }
  }
}
function showData() {
  const dialog = $("#data-dialog");
  dialog.innerHTML = `<button id="close-data" class="close-detail" aria-label="Cerrar datos">${icon("x")}</button><div class="eyebrow">TRANSPARENCIA, ANTES QUE MAGIA</div><h2>Lo que ves.<br>De dónde viene.</h2><p>Barcelona Latido combina la red oficial con una recreación del servicio. Cada capa tiene una procedencia distinta.</p><div class="data-source"><span class="data-status ready">DISPONIBLE</span><h3>GTFS · La red y sus horarios</h3><p>${num(n.meta.routes)} líneas · ${num(n.meta.stops)} puntos de embarque · ${num(n.meta.trips)} viajes en el archivo.</p><small>Versión ${n.meta.version}<br>Calendario ${formatDate(n.meta.start)} — ${formatDate(n.meta.end)}<br>Importado ${new Date(n.meta.fetchedAt).toLocaleString("es-ES", { timeZone: "Europe/Madrid" })}</small><a href="${n.meta.source}" target="_blank" rel="noopener">Archivo público de Mobility Database ↗</a></div><div class="data-source"><span class="data-status waiting">REQUIERE CREDENCIALES</span><h3>Transit · Detalles de la red</h3><p>Adaptador preparado para líneas, accesos, mobiliario, correspondencias, recorridos y horarios. El mapa usa el GTFS disponible.</p></div><div class="data-source"><span class="data-status waiting">REQUIERE CREDENCIALES</span><h3>iBus · Próximos autobuses</h3><p>Consulta por parada, con fecha de respuesta y control de antigüedad. Se activa con un servidor conectado a TMB. El portal documenta tiempos de paso de bus; no ofrece aquí posiciones GPS de trenes.</p></div><div class="data-source"><span class="data-status waiting">REQUIERE CREDENCIALES</span><h3>Planner · Rutas multimodales</h3><p>Adaptador al planificador oficial. «Viajar» funciona con un cálculo local por horarios, con tiempos de transbordo aproximados.</p></div><div class="data-source"><span class="data-status ready">FUENTES ABIERTAS</span><h3>Ciudad e historias</h3><p>Cartografía OpenStreetMap vía OpenFreeMap. Edificios donde existen datos. Historias editoriales basadas en el archivo de TMB, enlazadas en cada ficha.</p></div><form id="connection-form"><label class="field-label">SERVIDOR PARA DATOS EN DIRECTO<input type="url" id="api-url" placeholder="https://tu-servidor.example" value="${esc(apiBase)}"></label><p class="footnote">Opcional. Debe alojar el servidor incluido en este proyecto. Las claves permanecen en el servidor.</p><button class="primary" type="submit">Guardar conexión</button><span id="connection-state"></span></form><a class="text-link" href="https://developer.tmb.cat/" target="_blank" rel="noopener">Portal de desarrolladores de TMB ↗</a>`;
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
  if (!serverConfigured || options.accessible) return false;
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
        options.mode === "metro"
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
    if (!it || tab !== "journey") return false;
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
$("#about").onclick = showData;
$("#source-state").onclick = showData;
$("#home-map").onclick = () => {
  selectedRoute = null;
  applyFilters();
  map.home();
  $("#detail").hidden = true;
  $(".map-intro").classList.remove("subtle");
};
$("#zoom-in").onclick = () => map.map.zoomIn();
$("#zoom-out").onclick = () => map.map.zoomOut();
$("#tilt").onclick = () => {
  const active = map.map.getPitch() < 15;
  map.map.easeTo({
    pitch: active ? 60 : 0,
    bearing: active ? -20 : 0,
    duration: 800,
  });
  $("#tilt").classList.toggle("active", active);
};
$("#locate").onclick = () => {
  if (!navigator.geolocation) {
    toast("Este navegador no ofrece geolocalización.");
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const here = { lat: pos.coords.latitude, lon: pos.coords.longitude },
        nearest = n.stops
          .map((s, i) => ({ s, i, d: distance(s, here) }))
          .filter((x) => x.s.kind === 0)
          .sort((a, b) => a.d - b.d)[0];
      if (nearest.d > 20000) {
        toast(
          "Estás lejos de la red de TMB. Puedes explorar cualquier parada en el mapa.",
        );
        return;
      }
      showStop(nearest.i);
      toast(
        `Parada más cercana: ${nearest.s.name}, a unos ${Math.round(nearest.d)} m en línea recta.`,
      );
    },
    () =>
      toast(
        "No se pudo obtener tu ubicación. Puedes buscar una parada por su nombre.",
      ),
    { timeout: 10000 },
  );
};
for (const [id, key] of [
  ["layer-stops", "stops"],
  ["layer-stories", "stories"],
  ["layer-vehicles", "vehicles"],
])
  $("#" + id).onchange = (e) => {
    if (key === "stops") stopsVisible = e.target.checked;
    if (key === "stories") storiesVisible = e.target.checked;
    if (key === "vehicles") vehiclesVisible = e.target.checked;
    applyFilters();
  };
function updateClock() {
  $("#time-readout").textContent = clock(simTime);
  $("#time-slider").value = Math.floor(simTime);
  $("#clock-note").textContent = syncClock
    ? "Ahora · Europe/Madrid"
    : "Explorando el horario · Europe/Madrid";
  if ($("#departure-note")) $("#departure-note").textContent = clock(simTime);
}
$("#time-slider").oninput = (e) => {
  syncClock = false;
  simTime = +e.target.value;
  updateClock();
  drawMovement();
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
    updateClock();
    if (!trips.length)
      toast("El archivo GTFS no contiene servicio para esta fecha.");
  } catch {
    toast("No se pudo cargar el calendario.");
  }
};
$("#play").onclick = () => {
  playing = !playing;
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
    $("#detail").hidden = true;
    $(".map-intro").classList.remove("subtle");
  }
});
let lastFeatures = [],
  last = performance.now(),
  lastDraw = 0;
function drawMovement() {
  if (!movement || !map?.ready) return;
  lastFeatures = movement.features(trips, simTime);
  map.set("vehicles", lastFeatures);
  const filtered = lastFeatures.filter(
    (f) =>
      (mode === "all" || f.properties.mode === mode) &&
      (selectedRoute == null || f.properties.route === selectedRoute),
  );
  $("#moving-count").textContent =
    num(filtered.length) + " vehículos por horario";
}
$("#sheet-toggle").onclick = () => {
  const open = $(".sidebar").classList.toggle("open");
  $("#sheet-toggle").setAttribute("aria-expanded", String(open));
};
function attachStopTools(i) {
  const st = n.stops[i];
  $(".access-note").insertAdjacentHTML(
    "afterend",
    `<div class="reach-card"><div class="eyebrow">TU RADIO DE CIUDAD</div><p>¿Hasta dónde llegas desde aquí?</p><div class="reach-buttons">${[15, 30, 45].map((m) => `<button data-reach="${m}">${m} min</button>`).join("")}<button id="clear-reach" aria-label="Quitar alcance">×</button></div><small id="reach-summary">Descubre las paradas alcanzables por horario.</small></div>${st.id.startsWith("1.") ? "" : `<button class="transit-button" id="stop-transit">${icon("database")} Mobiliario y correspondencias TMB</button><div id="stop-transit-result"></div>`}`,
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
  $(".route-description").insertAdjacentHTML(
    "afterend",
    `<button class="transit-button" id="line-transit">${icon("database")} Más información de TMB</button><div id="line-transit-result"></div>`,
  );
  $("#line-transit").onclick = () => {
    const base = `/linies/${r.type === 3 ? "bus" : "metro"}/${r.id.split(".")[1]}`;
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
  if (playing) {
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
      updateClock();
      lastDraw = now;
    }
  }
  requestAnimationFrame(tick);
}
async function init() {
  try {
    const responses = await Promise.all([
      fetch("./data/network.json"),
      fetch("./data/schedule.json"),
    ]);
    if (responses.some((r) => !r.ok))
      throw new Error("No se encontraron los datos de la red.");
    [n, s] = await Promise.all(responses.map((r) => r.json()));
    renderPanel();
    $("#date").min = n.meta.start.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
    $("#date").max = n.meta.end.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
    movement = new Movement(n, s);
    const ready = ask("init", { network: n, schedule: s });
    map = new CityMap(n, {
      onStop: showStop,
      onRoute: showRoute,
      onStory: showStory,
      onVehicle: showVehicle,
      onReady: () => {
        applyFilters();
        map.set(
          "stories",
          stories.map((st) => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: [st.lon, st.lat] },
            properties: { id: st.id },
          })),
        );
        drawMovement();
      },
      onError: () =>
        toast(
          "La cartografía no se pudo cargar. Los listados y horarios siguen disponibles.",
        ),
    });
    trips = (await ready).trips;
    checkServer();
    $("#loading").classList.add("gone");
    setTimeout(() => ($("#loading").hidden = true), 700);
    if (!trips.length)
      toast(
        "No hay servicio en el GTFS para hoy. Elige una fecha del calendario publicado.",
      );
    requestAnimationFrame(tick);
  } catch (e) {
    $("#loading").innerHTML =
      `<h2>No pudimos despertar la ciudad.</h2><p>${esc(e.message)}</p><button id="retry" class="primary">Volver a intentar</button>`;
    $("#retry").onclick = () => location.reload();
  }
}
init();
