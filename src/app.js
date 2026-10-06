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
document.title = APP_NAME + " · Transporte por descubrir";
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
  mode = "rail",
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
  `<header class="header"><a class="brand" href="./" aria-label="${esc(APP_NAME)}, inicio"><span class="brand-symbol">${icon("route")}</span><span>${esc(APP_NAME)}</span><sup>TRANSPORTE POR DESCUBRIR</sup></a><label class="city-picker"><span>EXPLORAR</span><select id="city-selector" aria-label="Ciudad o red de transporte"></select></label><button class="source-state" id="source-state">${icon("radio")} <span>Fuentes y cobertura</span><span class="status-dot"></span></button></header>
<div class="workspace"><nav class="rail" aria-label="Secciones"><button class="rail-btn active" data-tab="explore" title="Explorar la red" aria-label="Explorar la red">${icon("layers-2")}<span>Explorar</span></button><button class="rail-btn" data-tab="journey" title="Planificar un viaje" aria-label="Planificar un viaje">${icon("route")}<span>Viajar</span></button><button class="rail-btn" data-tab="stories" title="Historias del transporte" aria-label="Historias del transporte">${icon("book-open")}<span>Historias</span></button><button class="rail-btn" data-tab="favorites" title="Tus paradas" aria-label="Tus paradas">${icon("bookmark")}<span>Guardadas</span></button><div class="rail-spacer"></div><button class="rail-btn" data-tab="data" title="Fuentes y conexión" aria-label="Fuentes y conexión">${icon("database")}<span>Datos</span></button><a class="rail-btn github" href="https://github.com/AlejandroPico/TMB" target="_blank" rel="noopener" aria-label="Ver proyecto en GitHub">${icon("github")}</a></nav>
<aside class="sidebar"><button id="sheet-toggle" class="sheet-toggle" aria-expanded="false" aria-label="Abrir o cerrar explorador"><span></span></button><div id="panel"></div><div class="sidebar-foot"><span class="tiny-pulse"></span><span>Redes y horarios publicados</span><button id="about" aria-label="Información sobre los datos">${icon("info")}</button></div></aside>
<main class="map-area"><div id="map" aria-label="Mapa interactivo del transporte público"></div><div class="map-vignette"></div><div class="map-intro"><div class="eyebrow"><span class="small-line"></span> ESPAÑA, EN MOVIMIENTO</div><h1>Tu ciudad.<br>Tu próxima <em>ruta.</em></h1><p>Explora sus líneas. Descubre nuevos destinos.</p><div class="intro-tags"><span>${icon("train-front")} Metro</span><span>${icon("bus-front")} Bus</span><span>${icon("landmark")} Ciudad</span></div></div>
<div class="map-tools"><button id="home-map" title="Vista general" aria-label="Vista general">${icon("scan")}</button><button id="zoom-in" title="Acercar" aria-label="Acercar">${icon("plus")}</button><button id="zoom-out" title="Alejar" aria-label="Alejar">${icon("minus")}</button><div class="tool-divider"></div><button id="tilt" title="Alternar vista 3D" aria-label="Alternar vista 3D">3D</button><button id="locate" title="Paradas cerca de mí" aria-label="Paradas cerca de mí">${icon("locate-fixed")}</button></div>
<div class="map-caption"><span class="live-dot"></span><span id="movement-label">MOVIMIENTO POR HORARIOS PUBLICADOS</span></div><div id="detail" class="detail" hidden></div>
<div class="map-layers"><label><input id="layer-stops" type="checkbox" checked><span>Paradas</span></label><label><input id="layer-stories" type="checkbox" checked><span>Historias</span></label><label><input id="layer-vehicles" type="checkbox" checked><span>Movimiento</span></label></div>
<div class="timeline"><div class="timeline-top"><div class="time-title">${icon("clock-3")}<span>El tiempo de tu viaje<small id="clock-note">Ahora · Europe/Madrid</small></span></div><div class="timeline-date"><input id="date" type="date" value="${simDate}" aria-label="Fecha del horario"><span id="time-readout">${clock(simTime)}</span></div><div class="playback"><button id="reset-time" title="Volver a la hora actual" aria-label="Volver a la hora actual">${icon("rotate-ccw")}</button><button id="play" title="Pausar" aria-label="Pausar">${icon("pause")}</button><button id="speed" aria-label="Cambiar velocidad de reproducción">1×</button></div></div><input id="time-slider" type="range" min="0" max="86399" step="60" value="${simTime}" aria-label="Hora del servicio"><div class="time-ticks"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span></div></div>
<div class="map-bottom"><span><span class="legend-dot metro"></span> Raíles <span class="legend-dot bus"></span> Bus <span class="legend-dot gps"></span> GPS FGC</span><span id="moving-count">Preparando el horario…</span></div></main></div>
<div id="loading" class="loading"><span class="loading-symbol">${icon("activity")}</span><h2>Tu próxima ruta empieza aquí.</h2><p>Conectando redes, horarios e historias…</p><div class="loading-line"></div></div><div id="toast" role="status" class="toast" hidden></div><dialog id="data-dialog"></dialog>`;
refreshIcons();
$("#source-state").setAttribute("aria-label", "Fuentes y cobertura");
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
  return `<div class="panel-head"><div class="eyebrow">${esc(city.name.toUpperCase())} · ${esc(city.region.toUpperCase())}</div><h2>${title}</h2><p>${subtitle}</p></div>`;
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
      `<div class="network-stats"><div><strong>${n.routes.filter((r) => transportGroup(r) === "rail").length}</strong><span>líneas sobre raíles¹</span></div><div><strong>${n.routes.filter((r) => transportGroup(r) === "bus").length}</strong><span>líneas de bus</span></div><div><strong>${num(n.meta.stops)}</strong><span>paradas²</span></div></div><div class="segmented" role="group" aria-label="Modo de transporte">${[
        ["rail", "Raíles"],
        ["bus", "Bus"],
        ["all", "Todo"],
      ]
        .map(
          ([id, name]) =>
            `<button data-mode="${id}" class="${mode === id ? "active" : ""}">${name}</button>`,
        )
        .join(
          "",
        )}</div><label class="search-box">${icon("search")}<input id="search" placeholder="Busca una línea o una parada" value="${esc(query)}" aria-label="Buscar líneas y paradas"><kbd>/</kbd></label><div class="list-heading"><span>${query ? "RESULTADOS" : "LÍNEAS DE LA RED"}</span><button id="clear-route" title="Mostrar todas las líneas">${selectedRoute != null ? "Ver todas" : "↓"}</button></div><div class="network-list" id="network-list">${networkList()}</div><div class="editorial-card"><span>UN PAÍS DE CONEXIONES</span><h3>Tu siguiente viaje<br>puede empezar aquí.</h3><button id="story-invite">${stories.length ? "Descubre sus historias" : "Explora la cobertura"} ${icon("arrow-up-right")}</button><div class="editorial-art">${esc(city.name.split(" · ")[0])}<span>↗</span></div></div>${coverageNotice()}<p class="footnote">¹ Metro, tren, tranvía y funicular. ² Puntos de embarque; una estación puede tener varios.</p>`;
  }
  if (tab === "stories") {
    html =
      header(
        "La ciudad que no ves.",
        "Historias reales, escondidas a lo largo de la red.",
      ) +
      `<div class="story-list">${stories.length ? "" : `<div class="empty"><h3>Historias en camino.</h3><p>Las redes nacionales ya se pueden explorar. Aquí aparecerán relatos con fuentes verificadas.</p></div>`}${stories.map((st) => `<button class="story-card" data-story="${st.id}"><div class="story-meta"><span>${esc(st.tag)}</span><b>${st.year}</b></div><h3>${st.title}</h3><p>${st.subtitle}</p><span class="story-cta">Descubrir en el mapa ${icon("arrow-up-right")}</span></button>`).join("")}</div><div class="list-heading">RECORRIDOS PARA DEJARSE LLEVAR</div><div class="tour-list">${tours.map((t, i) => `<button class="tour" data-tour="${i}">${icon("compass")}<span><b>${t.title}</b><small>${t.description}</small></span>${icon("chevron-right")}</button>`).join("")}</div>`;
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
          `<option value="${st.index}">${esc(st.name)} · ${esc(modeLabel(st.mode))} · ${esc(st.feed)}</option>`,
      )
      .join("");
    html =
      header(
        "Tu próximo destino.",
        "Encuentra un viaje con los horarios oficiales.",
      ) +
      `<form id="journey-form"><label class="field-label">ORIGEN<select id="from" required>${options}</select></label><div class="swap-row"><span class="route-dots">⋮</span><button type="button" id="swap" aria-label="Intercambiar origen y destino">${icon("arrow-down-up")}</button></div><label class="field-label">DESTINO<select id="to" required>${options}</select></label><div class="journey-options"><label>Transporte<select id="journey-mode"><option value="all">Todos los transportes</option><option value="rail">Metro, tren y tranvía</option><option value="bus">Solo bus</option></select></label><label class="check-label"><input id="accessible" type="checkbox"> Solo paradas accesibles³</label></div><button class="primary" id="plan-button" type="submit">${icon("route")} Encontrar mi viaje ${icon("arrow-right")}</button></form><div class="plan-notice">${icon("info")}<p>Salida a las <b id="departure-note">${clock(simTime)}</b> del día del reloj. Cambia la fecha y hora en el mapa.</p></div><div id="journey-result"></div><p class="footnote">³ Filtro según el campo de accesibilidad del GTFS. No verifica ascensores en servicio ni todo el itinerario peatonal. La planificación local usa transbordos aproximados y no incluye incidencias.</p>`;
  }
  const expired = n.meta.feeds.filter((f) => !feedCurrent(f));
  if (expired.length && (tab === "explore" || tab === "journey"))
    html = html.replace(
      "</div>",
      `</div><div class="calendar-warning">${icon("info")}<span>${expired.map((f) => esc(f.publisher)).join(", ")}: calendario archivado hasta ${expired.map((f) => formatDate(f.end)).join(", ")}. No hay servicio publicado para hoy en esos archivos.</span></div>`,
    );
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
    `<div class="eyebrow">${esc(modeLabel(st.mode).toUpperCase())} · ${esc(st.feed.toUpperCase())} · ${esc(st.code)}</div><h2>${esc(st.name)}</h2><div class="detail-badges">${rs.map(badge).join("")}</div><div class="detail-actions"><button id="save-stop">${icon(favorites.includes(st.id) ? "bookmark-check" : "bookmark")} ${favorites.includes(st.id) ? "Guardada" : "Guardar"}</button><button id="route-from">${icon("route")} Salir de aquí</button></div><div class="access-note">${icon("accessibility")} ${st.accessible === 1 ? "Embarque accesible según GTFS" : st.accessible === 2 ? "Embarque no accesible según GTFS" : "Accesibilidad sin especificar"}</div><div class="list-heading"><span>PRÓXIMAS SALIDAS</span><span id="arrival-label">HORARIO</span></div><div id="arrivals"><p class="muted">Consultando el horario…</p></div><small class="detail-note">Predicción por horario publicado. El movimiento del mapa es una interpolación; no representa posiciones GPS. Las horas intermedias sin dato se estiman entre las salidas publicadas.</small>`,
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
  mode = transportGroup(r);
  applyFilters();
  if (tab === "explore") renderPanel();
  $(".sidebar").classList.remove("open");
  map.focusRoute(i);
  detailToken++;
  const d = r.directions[0];
  showDetail(
    `<div class="eyebrow">${esc(r.operator)} · ${esc(modeLabel(r.mode))}</div><div class="route-detail-title">${badge(r)}<h2>${esc(r.name)}</h2></div><p class="route-description">${esc(r.description)}</p>${r.directions.some((d) => d.approximate) ? `<p class="footnote">Esquema entre estaciones: el operador no publica la geometría de este recorrido.</p>` : ""}<div class="direction-switch">${r.directions.map((d, k) => `<button data-direction="${k}" class="${k === 0 ? "active" : ""}">Sentido ${k + 1}</button>`).join("")}</div><div class="line-stations" id="line-stations">${lineStations(d, r)}</div><a class="text-link" href="${esc(r.url)}" target="_blank" rel="noopener">Ver la fuente de la línea ${icon("arrow-up-right")}</a>`,
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
  const f = lastFeatures.find((x) => x.properties.id === id);
  if (!f) return;
  const r = n.routes[f.properties.route];
  toast(
    `${r.name} → ${f.properties.head} · Próxima parada: ${n.stops[f.properties.next].name}. Posición interpolada del horario.`,
  );
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
  dialog.innerHTML = `<button id="close-data" class="close-detail" aria-label="Cerrar datos">${icon("x")}</button><div class="eyebrow">DATOS CON PROCEDENCIA</div><h2>Un país.<br>Muchas redes.</h2><p>${esc(APP_NAME)} reúne redes publicadas por sus operadores. La cobertura crece ciudad a ciudad; cada calendario tiene su propia vigencia.</p><div class="coverage-grid">${cities.map((c) => `<button data-city="${c.id}" class="coverage-city ${city.id === c.id ? "selected" : ""}"><b>${esc(c.name)}</b><span>${num(c.routes)} líneas · ${num(c.stops)} embarques</span><small>${esc(c.coverage)}</small></button>`).join("")}</div><h3>${esc(city.name)} · archivos publicados</h3>${n.meta.feeds.map((f) => `<div class="data-source"><span class="data-status ${feedCurrent(f) ? "ready" : "waiting"}">${feedCurrent(f) ? "CALENDARIO VIGENTE" : "FUERA DEL CALENDARIO"}</span><h3>${esc(f.publisher)}</h3><p>${num(f.routes)} líneas · ${num(f.trips)} viajes en el archivo.</p><small>Calendario ${formatDate(f.start)} — ${formatDate(f.end)}<br>Normalizado ${new Date(f.fetchedAt).toLocaleString("es-ES", { timeZone: "Europe/Madrid" })}${f.skippedTrips ? `<br>${num(f.skippedTrips)} viajes omitidos por tiempos incompletos o inválidos.` : ""}${f.approximateShapes ? "<br>Algunos recorridos son esquemas entre estaciones, sin trazado ferroviario publicado." : ""}</small><a href="${esc(f.source)}" target="_blank" rel="noopener">Archivo utilizado ↗</a> · <a href="${esc(f.website)}" target="_blank" rel="noopener">Operador ↗</a> · <a href="${esc(f.license)}" target="_blank" rel="noopener">Licencia ↗</a></div>`).join("")}<div class="data-source"><span class="data-status ready">API PÚBLICA · BARCELONA</span><h3>FGC · Posiciones y ocupación</h3><p>Puntos azules: coordenadas publicadas por FGC. Se consultan cada 30 segundos al explorar la hora actual. La ocupación, cuando existe, es la media de los coches con información. Se ocultan las publicaciones con más de tres minutos de antigüedad.</p><a href="${FGC_SOURCE}" target="_blank" rel="noopener">FGC · CC BY 4.0 ↗</a></div><div class="data-source"><span class="data-status ${serverConfigured ? "ready" : "waiting"}">${serverConfigured ? "SERVIDOR CONECTADO" : "REQUIERE SERVIDOR"}</span><h3>TMB · Transit, iBus y Planner</h3><p>Las claves de GitHub actualizan el archivo de horarios. Para consultar iBus, detalles Transit y el planificador oficial desde esta web, conecta el servidor incluido con esas claves. El resto de ciudades utiliza sus propios horarios.</p></div><div class="data-source"><h3>Mapa e historias</h3><p>OpenStreetMap vía OpenFreeMap. Historias con fuentes enlazadas. Los vehículos por horario son interpolaciones; los esquemas sin geometría no muestran el trazado real. En «Viajar», los transbordos son aproximados y no se incorporan incidencias.</p><a href="https://www.transportes.gob.es" target="_blank" rel="noopener">Powered by MIMTRANS ↗</a> · <a href="https://mobilitydatabase.org" target="_blank" rel="noopener">Archivos de Mobility Database ↗</a></div><form id="connection-form"><label class="field-label">SERVIDOR TMB PARA DATOS EN DIRECTO<input type="url" id="api-url" placeholder="https://tu-servidor.example" value="${esc(apiBase)}"></label><p class="footnote">Opcional. Las claves permanecen en el servidor.</p><button class="primary" type="submit">Guardar conexión</button><span id="connection-state"></span></form><a class="text-link" href="https://nap.transportes.gob.es/" target="_blank" rel="noopener">Más redes españolas: Punto de Acceso Nacional ↗</a>`;
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
          "Estás lejos de esta red. Puedes explorar cualquier parada en el mapa.",
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
    $("#detail").hidden = true;
    $(".map-intro").classList.remove("subtle");
  }
});
let lastFeatures = [],
  last = performance.now(),
  lastDraw = 0;
function drawMovement() {
  if (!movement || !map?.ready || loadingCity) return;
  lastFeatures = movement
    .features(trips, simTime)
    .filter(
      (f) =>
        !(
          syncClock &&
          gps?.vehicles.length &&
          Date.now() - gps.timestamp <= 180000 &&
          n.routes[f.properties.route].feed === "fgc"
        ),
    );
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
    `<div class="reach-card"><div class="eyebrow">TU RADIO DE CIUDAD</div><p>¿Hasta dónde llegas desde aquí?</p><div class="reach-buttons">${[15, 30, 45].map((m) => `<button data-reach="${m}">${m} min</button>`).join("")}<button id="clear-reach" aria-label="Quitar alcance">×</button></div><small id="reach-summary">Descubre las paradas alcanzables por horario.</small></div>${st.feed !== "tmb" || st.mode !== "bus" ? "" : `<button class="transit-button" id="stop-transit">${icon("database")} Mobiliario y correspondencias TMB</button><div id="stop-transit-result"></div>`}`,
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
  return `<p class="coverage-note">${esc(city.coverage)}${expired.length ? `<br><strong>${expired.map((f) => esc(f.publisher)).join(", ")}: archivo fuera del calendario actual. Consulta sus fechas en Datos.</strong>` : ""}</p>`;
}
function showGPS(id) {
  const v = gps?.vehicles.find((v) => v.id === id);
  if (!v || Date.now() - v.timestamp > 180000 || !syncClock) return;
  detailToken++;
  showDetail(
    `<div class="eyebrow gps-text">POSICIÓN PUBLICADA · FGC</div><h2>Línea ${esc(v.line)}</h2><p class="story-subtitle">Unidad ${esc(v.id)} · Destino ${esc(v.destination)}</p><div class="gps-card"><strong>${v.occupancy === null ? "Sin dato" : v.occupancy + "%"}</strong><span>Ocupación media de coches con dato</span></div><p class="story-body">${v.onTime === true ? "El operador indica circulación en hora." : v.onTime === false ? "El operador indica circulación fuera de hora." : "Puntualidad sin especificar."}${v.station ? " Código de estación: " + esc(v.station) + "." : ""}</p><small class="detail-note">Publicación del conjunto FGC: ${new Date(v.timestamp).toLocaleTimeString("es-ES", { timeZone: "Europe/Madrid" })}. Esta hora corresponde a la actualización del conjunto, no a una medición individual del tren. Los códigos de destino son los del operador.</small><a class="text-link" href="${FGC_SOURCE}" target="_blank" rel="noopener">Fuente FGC · CC BY 4.0 ↗</a>`,
  );
}
function drawGPS() {
  if (!map?.ready) return;
  const visible =
    city?.id === "barcelona" &&
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
    label.hidden = city?.id !== "barcelona";
    label.textContent = !syncClock
      ? "FGC GPS · vuelve a «Ahora» para verlo"
      : visible
        ? `${features.length} posiciones FGC · ${new Date(gps.timestamp).toLocaleTimeString("es-ES", { timeZone: "Europe/Madrid" })}`
        : gpsMessage;
  }
}
async function refreshGPS() {
  if (
    gpsBusy ||
    city?.id !== "barcelona" ||
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
  $("#loading h2").textContent = next.name + " está en ruta.";
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
    city = next;
    stories = cityStories[id] || [];
    tours = cityTours[id] || [];
    selectedStop = selectedRoute = null;
    detailToken++;
    query = "";
    mode = "all";
    $("#detail").hidden = true;
    $(".map-intro").classList.remove("subtle");
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
    $(".map-intro .eyebrow").innerHTML =
      `<span class="small-line"></span> ${esc(city.name.toUpperCase())}, EN MOVIMIENTO`;
    $(".sidebar-foot > span:nth-child(2)").textContent =
      city.name + " · " + n.meta.feeds.length + " fuentes";
    const types = [...new Set(n.routes.map((r) => r.mode))].filter(
      (m) => m !== "other",
    );
    $(".intro-tags").innerHTML = types
      .slice(0, 3)
      .map(
        (m) =>
          `<span>${icon(m === "bus" ? "bus-front" : "train-front")} ${esc(modeLabel(m))}</span>`,
      )
      .join("");
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
    trips = (await ready).trips;
    $("#loading").classList.add("gone");
    setTimeout(() => {
      if (epoch === cityEpoch) $("#loading").hidden = true;
    }, 700);
    if (!trips.length)
      toast(
        "No hay servicio publicado para hoy. Consulta el calendario en Datos.",
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
    $(".map-caption").insertAdjacentHTML(
      "afterend",
      '<button id="gps-status" class="gps-status" hidden>Conectando con FGC…</button>',
    );
    $("#gps-status").onclick = () => {
      if (gps?.vehicles.length) showGPS(gps.vehicles[0].id);
      else toast(gpsMessage);
    };
    let saved;
    try {
      saved = localStorage.getItem("enruta-city");
    } catch {}
    const requested =
      new URL(location.href).searchParams.get("city") || saved || DEFAULT_CITY;
    await loadCity(
      cities.some((c) => c.id === requested) ? requested : DEFAULT_CITY,
    );
    checkServer();
    requestAnimationFrame(tick);
  } catch (e) {
    $("#loading").innerHTML =
      `<h2>No pudimos cargar las redes.</h2><p>${esc(e.message)}</p><button id="retry" class="primary">Volver a intentar</button>`;
    $("#retry").onclick = () => location.reload();
  }
}
init();
