import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";

test("Render can load its own application while foreign origins remain blocked", async (t) => {
  const ownOrigin = "https://enruta-directo.onrender.com";
  const pagesOrigin = "https://alejandropico.github.io";
  const child = spawn(process.execPath, ["tools/server.mjs"], {
    cwd: new URL("../", import.meta.url),
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: "0",
      TMB_APP_ID: "",
      TMB_APP_KEY: "",
      ALLOWED_ORIGINS: " " + pagesOrigin + " , ",
      RENDER_EXTERNAL_URL: ownOrigin + "/",
      RENDER_GIT_COMMIT: "test-revision",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(async () => {
    if (child.exitCode === null) {
      const exited = once(child, "exit");
      child.kill();
      await exited;
    }
  });
  const base = await new Promise((resolve, reject) => {
    let output = "";
    const timeout = setTimeout(
      () => reject(new Error("Server startup timed out")),
      10000,
    );
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("exit", () => {
      clearTimeout(timeout);
      reject(new Error("Server exited before startup"));
    });
    child.stdout.on("data", (chunk) => {
      output += chunk;
      const match = output.match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) {
        clearTimeout(timeout);
        resolve(match[0]);
      }
    });
  });
  const request = (resource, origin, extra = {}) =>
    fetch(base + resource, {
      headers: { ...(origin ? { Origin: origin } : {}), ...extra },
      signal: AbortSignal.timeout(5000),
    });
  for (const origin of [ownOrigin, pagesOrigin]) {
    const response = await request("/api/status", origin);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin);
    const status = await response.json();
    assert.equal(status.revision, "test-revision");
    assert.match(status.version, /^\d+\.\d+\.\d+$/);
    assert.equal(status.configured, false);
  }
  // A missing static file should reach the file handler, not be rejected by CORS.
  const asset = await request("/assets/test-module.js", ownOrigin);
  assert.equal(asset.status, 404);
  assert.equal(
    (await asset.json()).error.startsWith("Archivo no encontrado"),
    true,
  );
  for (const origin of [
    "https://other.onrender.com",
    ownOrigin + ".example",
    "null",
  ]) {
    const denied = await request("/api/status", origin, {
      "X-Forwarded-Host": "other.onrender.com",
    });
    assert.equal(denied.status, 403);
    assert.equal(denied.headers.get("Access-Control-Allow-Origin"), null);
  }
  assert.equal((await request("/api/status")).status, 200);
  const preflight = await fetch(base + "/api/status", {
    method: "OPTIONS",
    headers: { Origin: ownOrigin, "Access-Control-Request-Method": "GET" },
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("Access-Control-Allow-Origin"), ownOrigin);
});
