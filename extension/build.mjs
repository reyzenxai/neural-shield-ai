/**
 * esbuild script for the Neural Shield Chrome extension (MV3).
 *
 * Usage:
 *   node build.mjs          — one-shot build to dist/
 *   node build.mjs --watch  — rebuild on file changes (dev mode)
 *
 * Output:
 *   dist/
 *     manifest.json
 *     background.js        ← service worker (ESM)
 *     content.js           ← content script (IIFE, no imports at runtime)
 *     popup/popup.html
 *     popup/popup.js
 *     options/options.html
 *     options/options.js
 *     icons/               ← copied as-is
 */

import esbuild from "esbuild";
import { cpSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "dist");
const watch = process.argv.includes("--watch");

// Ensure output directories exist
["dist", "dist/popup", "dist/options", "dist/icons"].forEach((d) =>
  mkdirSync(join(__dirname, d), { recursive: true }),
);

// Copy static assets
cpSync(join(__dirname, "manifest.json"), join(OUT, "manifest.json"));
cpSync(join(__dirname, "popup/popup.html"), join(OUT, "popup/popup.html"));
cpSync(join(__dirname, "options/options.html"), join(OUT, "options/options.html"));

// Copy icons if they exist
const iconsDir = join(__dirname, "icons");
if (existsSync(iconsDir)) {
  cpSync(iconsDir, join(OUT, "icons"), { recursive: true });
}

const sharedOpts = {
  bundle: true,
  target: "chrome120",
  logLevel: "info",
  sourcemap: watch ? "inline" : false,
};

const entryPoints = [
  // Service worker — must be ESM for MV3 with "type": "module"
  {
    in: join(__dirname, "background/worker.ts"),
    out: join(OUT, "background"),
    opts: { ...sharedOpts, format: "esm", outfile: join(OUT, "background.js") },
  },
  // Content script — IIFE so it can run without import/export at runtime
  {
    in: join(__dirname, "content/content.ts"),
    out: join(OUT, "content"),
    opts: { ...sharedOpts, format: "iife", outfile: join(OUT, "content.js") },
  },
  // Popup — ESM (loaded via <script type="module">)
  {
    in: join(__dirname, "popup/popup.ts"),
    out: join(OUT, "popup/popup"),
    opts: { ...sharedOpts, format: "esm", outfile: join(OUT, "popup/popup.js") },
  },
  // Options — ESM
  {
    in: join(__dirname, "options/options.ts"),
    out: join(OUT, "options/options"),
    opts: { ...sharedOpts, format: "esm", outfile: join(OUT, "options/options.js") },
  },
];

if (watch) {
  console.log("Watching for changes…");
  await Promise.all(
    entryPoints.map(async ({ in: entry, opts }) => {
      const ctx = await esbuild.context({ ...opts, entryPoints: [entry] });
      await ctx.watch();
    }),
  );
} else {
  await Promise.all(
    entryPoints.map(({ in: entry, opts }) =>
      esbuild.build({ ...opts, entryPoints: [entry] }),
    ),
  );
  console.log("Build complete → dist/");
}
