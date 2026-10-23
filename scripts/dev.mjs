// Server locale senza Netlify CLI: file statici da public/ e /api/* sulla funzione,
// con un emulatore di Netlify Blobs su disco (.netlify/local-blobs).
// Uso: npm run dev:local  (richiede Node 22.18+ per eseguire TypeScript)
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { BlobsServer } from "@netlify/blobs/server";

const PORT = Number(process.env.PORT ?? 8888);
const BLOBS_PORT = PORT + 1;
const root = new URL("../public/", import.meta.url).pathname;

const blobs = new BlobsServer({ directory: ".netlify/local-blobs", port: BLOBS_PORT, token: "local" });
await blobs.start();
process.env.NETLIFY_BLOBS_CONTEXT = Buffer.from(
  JSON.stringify({
    edgeURL: `http://localhost:${BLOBS_PORT}`,
    uncachedEdgeURL: `http://localhost:${BLOBS_PORT}`,
    siteID: "local",
    token: "local",
  }),
).toString("base64");

const { default: handler } = await import("../netlify/functions/api.mts");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
};

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith("/api/")) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const response = await handler(
      new Request(url, { method: req.method, headers: req.headers, body: req.method === "POST" ? Buffer.concat(chunks) : undefined }),
    );
    res.writeHead(response.status, Object.fromEntries(response.headers));
    return res.end(Buffer.from(await response.arrayBuffer()));
  }
  const path = normalize(join(root, url.pathname === "/" ? "index.html" : url.pathname));
  if (!path.startsWith(root)) return res.writeHead(403).end();
  try {
    const body = await readFile(path);
    res.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end("Not found");
  }
}).listen(PORT, () => console.log(`Manhunt Roma in locale: http://localhost:${PORT}`));
