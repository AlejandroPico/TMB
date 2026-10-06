import { defineConfig } from "vite";
import { readFileSync } from "node:fs";
const config = JSON.parse(
  readFileSync(new URL("./app.config.json", import.meta.url)),
);
const escape = (text) =>
  text.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export default defineConfig({
  plugins: [
    {
      name: "application-identity",
      transformIndexHtml: {
        order: "pre",
        handler: (html) =>
          html
            .replaceAll(
              "%APP_NAME%",
              escape(process.env.VITE_APP_NAME || config.name),
            )
            .replaceAll("%APP_DESCRIPTION%", escape(config.description)),
      },
      generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "favicon.svg",
          source: readFileSync(new URL("./favicon.svg", import.meta.url)),
        });
      },
    },
  ],
  base: process.env.BASE_PATH || "./",
  server: { proxy: { "/api": "http://127.0.0.1:8787" } },
  build: { chunkSizeWarningLimit: 1200 },
});
