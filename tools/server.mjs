import http from "node:http";
import { existsSync, createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchAMB } from "./amb-realtime.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appName = JSON.parse(
  await readFile(path.join(root, "app.config.json"), "utf8"),
).name;
const appVersion = JSON.parse(
  await readFile(path.join(root, "package.json"), "utf8"),
).version;
if (existsSync(path.join(root, ".env")))
  process.loadEnvFile(path.join(root, ".env"));
const transitPaths = JSON.parse(
  await readFile(path.join(root, "docs/api-catalog.json"), "utf8"),
).transit;
const expressions = transitPaths.map(
  (p) => new RegExp("^" + p.replace(/\{[^}]+\}/g, "[0-9.-]+") + "$"),
);
const cache = new Map(),
  inflight = new Map(),
  limits = new Map();
const origins = new Set(
  (
    process.env.ALLOWED_ORIGINS ||
    "http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:8787,http://localhost:8787,https://alejandropico.github.io"
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);
// Module scripts send Origin even when served by this same Render service.
// Trust Render's configured URL, never the request Host or forwarded headers.
if (process.env.RENDER_EXTERNAL_URL) {
  const external = new URL(process.env.RENDER_EXTERNAL_URL);
  if (["https:", "http:"].includes(external.protocol))
    origins.add(external.origin);
}
const configured = () => !!(process.env.TMB_APP_ID && process.env.TMB_APP_KEY);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
};
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const json = (status, data) => {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(data));
  };
  try {
    if (req.headers.origin) {
      if (!origins.has(req.headers.origin)) {
        json(403, { error: "Origen no permitido" });
        return;
      }
      res.setHeader("Access-Control-Allow-Origin", req.headers.origin);
      res.setHeader("Vary", "Origin");
    }
    if (req.method === "OPTIONS") {
      res.writeHead(204, { "Access-Control-Allow-Methods": "GET, OPTIONS" });
      res.end();
      return;
    }
    if (req.method !== "GET") {
      json(405, { error: "Método no permitido" });
      return;
    }
    if (url.pathname === "/api/status") {
      json(200, {
        version: appVersion,
        revision: process.env.RENDER_GIT_COMMIT || null,
        configured: configured(),
        services: [
          "transit",
          "ibus",
          "planner",
          "static",
          "renfe",
          "amb",
          "malaga",
        ],
        time: new Date().toISOString(),
      });
      return;
    }
    if (url.pathname.startsWith("/api/")) {
      const address = req.socket.remoteAddress,
        now = Date.now(),
        bucket = limits.get(address) || { start: now, count: 0 };
      if (now - bucket.start > 60000) {
        bucket.start = now;
        bucket.count = 0;
      }
      limits.set(address, bucket);
      if (++bucket.count > 60) {
        json(429, { error: "Demasiadas consultas. Inténtalo en un minuto." });
        return;
      }
      if (
        ["/api/amb/arrivals", "/api/malaga/positions"].includes(url.pathname)
      ) {
        const key = url.pathname,
          saved = cache.get(key);
        if (
          saved &&
          now - saved.time < (key.includes("malaga") ? 30000 : 10000)
        ) {
          json(200, saved.data);
          return;
        }
        if (!inflight.has(key))
          inflight.set(
            key,
            (key.includes("malaga")
              ? (async () => {
                  const response = await fetch(
                    "https://datosabiertos.malaga.eu/recursos/transporte/EMT/EMTlineasUbicaciones/lineasyubicaciones.geojson",
                    { signal: AbortSignal.timeout(10000) },
                  );
                  if (!response.ok) throw new Error("EMT Málaga no disponible");
                  return response.json();
                })()
              : fetchAMB()
            ).then((data) => {
              cache.set(key, { time: Date.now(), data });
              return data;
            }),
          );
        try {
          json(200, await inflight.get(key));
        } finally {
          inflight.delete(key);
        }
        return;
      }
      if (
        ["/api/renfe/positions", "/api/renfe/long-distance"].includes(
          url.pathname,
        )
      ) {
        const key = url.pathname,
          saved = cache.get(key);
        if (saved && now - saved.time < 15000) {
          json(200, saved.data);
          return;
        }
        if (!inflight.has(key))
          inflight.set(
            key,
            (async () => {
              const response = await fetch(
                url.pathname === "/api/renfe/positions"
                  ? "https://gtfsrt.renfe.com/vehicle_positions.json"
                  : "https://tiempo-real.largorecorrido.renfe.com/renfe-visor/flotaLD.json",
                { signal: AbortSignal.timeout(10000) },
              );
              if (!response.ok) throw new Error("Renfe no disponible");
              const data = await response.json();
              cache.set(key, { time: Date.now(), data });
              return data;
            })(),
          );
        try {
          json(200, await inflight.get(key));
        } finally {
          inflight.delete(key);
        }
        return;
      }
      if (!configured()) {
        json(503, {
          error: "Configura TMB_APP_ID y TMB_APP_KEY en el servidor.",
        });
        return;
      }
      let upstream,
        ttl = 300000;
      if (/^\/api\/ibus\/\d{1,8}$/.test(url.pathname)) {
        upstream = new URL(
          "https://api.tmb.cat/v1/itransit/bus/parades/" +
            url.pathname.split("/").at(-1),
        );
        ttl = 10000;
      } else if (url.pathname.startsWith("/api/transit/")) {
        const p = url.pathname.slice("/api/transit".length);
        if (!expressions.some((x) => x.test(p))) {
          json(400, { error: "Recurso Transit no permitido" });
          return;
        }
        upstream = new URL("https://api.tmb.cat/v1/transit" + p);
        for (const name of ["filter", "sort", "srsName", "format"]) {
          if (url.searchParams.has(name))
            upstream.searchParams.set(
              name,
              url.searchParams.get(name).slice(0, 500),
            );
        }
        upstream.searchParams.set("srsName", "EPSG:4326");
      } else if (url.pathname === "/api/planner") {
        upstream = new URL("https://api.tmb.cat/v1/planner/plan");
        for (const name of [
          "fromPlace",
          "toPlace",
          "date",
          "time",
          "arriveBy",
          "mode",
          "maxWalkDistance",
          "showIntermediateStops",
        ]) {
          if (url.searchParams.has(name))
            upstream.searchParams.set(
              name,
              url.searchParams.get(name).slice(0, 100),
            );
        }
        for (const name of ["fromPlace", "toPlace"])
          if (
            !/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(
              upstream.searchParams.get(name) || "",
            )
          ) {
            json(400, { error: "Coordenadas inválidas" });
            return;
          }
        ttl = 30000;
      } else {
        json(404, { error: "Servicio desconocido" });
        return;
      }
      const key = upstream.pathname + "?" + upstream.searchParams.toString(),
        saved = cache.get(key);
      if (saved && now - saved.time < ttl) {
        json(200, saved.data);
        return;
      }
      if (!inflight.has(key)) {
        upstream.searchParams.set("app_id", process.env.TMB_APP_ID);
        upstream.searchParams.set("app_key", process.env.TMB_APP_KEY);
        inflight.set(
          key,
          (async () => {
            const response = await fetch(upstream, {
              signal: AbortSignal.timeout(12000),
            });
            if (!response.ok)
              throw Object.assign(
                new Error("TMB no pudo completar la consulta"),
                { status: response.status },
              );
            const data = await response.json();
            if (cache.size > 500) cache.delete(cache.keys().next().value);
            cache.set(key, { time: Date.now(), data });
            return data;
          })(),
        );
      }
      try {
        json(200, await inflight.get(key));
      } finally {
        inflight.delete(key);
      }
      return;
    }
    const base = path.join(root, "dist"),
      relative = decodeURIComponent(url.pathname),
      file = path.resolve(
        base,
        "." + (relative === "/" ? "/index.html" : relative),
      );
    if (!file.startsWith(base + path.sep)) {
      json(403, { error: "Ruta no permitida" });
      return;
    }
    if (!existsSync(file) || (await stat(file)).isDirectory()) {
      json(404, {
        error:
          "Archivo no encontrado. Ejecuta pnpm build antes de iniciar el servidor.",
      });
      return;
    }
    res.writeHead(200, {
      "Content-Type": mime[path.extname(file)] || "application/octet-stream",
      "Cache-Control":
        path.extname(file) === ".json" ? "public, max-age=300" : "no-cache",
    });
    createReadStream(file).pipe(res);
  } catch (e) {
    if (!res.headersSent)
      json(e.status === 401 || e.status === 403 ? 502 : 503, {
        error:
          e.status === 401 || e.status === 403
            ? "TMB ha rechazado las credenciales del servidor."
            : "El servicio en directo no está disponible. No se sustituyen sus datos por estimaciones.",
      });
    else res.end();
  }
});
server.listen(
  Number(process.env.PORT || 8787),
  process.env.HOST || "127.0.0.1",
  () =>
    console.log(
      appName +
        " · http://" +
        (process.env.HOST || "127.0.0.1") +
        ":" +
        server.address().port +
        " · APIs " +
        (configured() ? "configuradas" : "pendientes de credenciales"),
    ),
);
setInterval(() => {
  for (const [key, value] of limits)
    if (Date.now() - value.start > 120000) limits.delete(key);
}, 60000).unref();
