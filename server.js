/**
 * SuperUser Proxy — server.js
 *
 * Single Node.js process that:
 *   1. Serves all static proxy assets (index.html, scramjet/, controller/, sw.js)
 *   2. Runs a built-in Wisp WebSocket server at /wisp/
 *
 * Usage:
 *   node server.js              (default port 8080)
 *   PORT=3000 node server.js
 */

import { createServer } from "node:http";
import { readFile }     from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// wisp-js exposes its server handler from this sub-path
import { server as wisp } from "@mercuryworkshop/wisp-js/server";

/* ── paths ──────────────────────────────────────────────── */
const __dirname = fileURLToPath(new URL(".", import.meta.url));
const PUBLIC    = resolve(__dirname);           // files live at project root

/* ── MIME types ─────────────────────────────────────────── */
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".mjs":  "application/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".wasm": "application/wasm",
  ".ico":  "image/x-icon",
  ".png":  "image/png",
  ".svg":  "image/svg+xml",
  ".txt":  "text/plain; charset=utf-8",
};

/* ── static file handler ────────────────────────────────── */
async function serveStatic(req, res) {
  let urlPath = req.url.split("?")[0];

  // directory → index.html
  if (urlPath.endsWith("/")) urlPath += "index.html";

  const filePath = join(PUBLIC, urlPath);

  // safety check: don't escape the public dir
  if (!filePath.startsWith(PUBLIC)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const data = await readFile(filePath);
    const mime = MIME[extname(filePath)] ?? "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": mime,
      // service workers need this header to control the whole origin
      "Service-Worker-Allowed": "/",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(data);
  } catch (err) {
    if (err.code === "ENOENT") {
      // For SPA fallback: any non-asset 404 → index.html
      if (!extname(urlPath)) {
        try {
          const data = await readFile(join(PUBLIC, "index.html"));
          res.writeHead(200, {
            "Content-Type": "text/html; charset=utf-8",
            "Service-Worker-Allowed": "/",
            "Access-Control-Allow-Origin": "*",
          });
          res.end(data);
          return;
        } catch (_) {}
      }
      res.writeHead(404);
      res.end("Not Found: " + urlPath);
    } else {
      console.error("Static error:", err);
      res.writeHead(500);
      res.end("Internal Server Error");
    }
  }
}

/* ── HTTP server ────────────────────────────────────────── */
const server = createServer((req, res) => {
  // health check
  if (req.url === "/health") {
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(JSON.stringify({ status: "ok", wisp: true, scramjet: true }));
    return;
  }

  serveStatic(req, res);
});

/* ── WebSocket upgrade → Wisp ───────────────────────────── */
server.on("upgrade", (req, socket, head) => {
  const upgradePath = req.url.split("?")[0];
  // Route /wisp and /wisp/* WebSocket connections to wisp-js
  if (upgradePath.endsWith("/wisp/") || upgradePath.endsWith("/wisp")) {
    wisp.routeRequest(req, socket, head);
  } else {
    socket.destroy();
  }
});

/* ── start ──────────────────────────────────────────────── */
const PORT = parseInt(process.env.PORT ?? "8080", 10);
const HOST = process.env.HOST ?? "0.0.0.0";

server.listen(PORT, HOST, () => {
  console.log("");
  console.log("  ██████╗ ██████╗  ██████╗ ██╗  ██╗██╗   ██╗");
  console.log("  ██╔══██╗██╔══██╗██╔═══██╗╚██╗██╔╝╚██╗ ██╔╝");
  console.log("  ██████╔╝██████╔╝██║   ██║ ╚███╔╝  ╚████╔╝ ");
  console.log("  ██╔═══╝ ██╔══██╗██║   ██║ ██╔██╗   ╚██╔╝  ");
  console.log("  ██║     ██║  ██║╚██████╔╝██╔╝ ██╗   ██║   ");
  console.log("  ╚═╝     ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝   ╚═╝  ");
  console.log("");
  console.log(`  ✓ SuperUser Proxy online`);
  console.log(`  ✓ Static files  → http://${HOST}:${PORT}/`);
  console.log(`  ✓ Wisp server   → ws://${HOST}:${PORT}/wisp/`);
  console.log(`  ✓ Health check  → http://${HOST}:${PORT}/health`);
  console.log("");
});
