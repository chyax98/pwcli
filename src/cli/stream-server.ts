#!/usr/bin/env node
import { createServer } from "node:http";
import { managedPreviewFrame, managedPreviewStatus } from "#engine/preview.js";
import { writeStreamRecord } from "#store/stream.js";

const [, , sessionName, portArg] = process.argv;

if (!sessionName) {
  throw new Error("sessionName is required");
}

const port = Number(portArg || "0");

const server = createServer(async (req, res) => {
  try {
    if (req.url?.startsWith("/status.json")) {
      const status = await managedPreviewStatus({ sessionName });
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(status.data));
      return;
    }

    if (req.url?.startsWith("/frame.jpg")) {
      const frame = await managedPreviewFrame({ sessionName });
      const bytes = Buffer.from(frame.data.jpegBase64, "base64");
      res.writeHead(200, {
        "content-type": frame.data.mimeType,
        "cache-control": "no-store",
      });
      res.end(bytes);
      return;
    }

    if (req.url?.startsWith("/_health")) {
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: true, sessionName }));
      return;
    }

    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>pwcli stream ${sessionName}</title>
    <style>
      body { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; margin: 0; background: #0f1115; color: #e7eaf0; }
      header { padding: 12px 16px; border-bottom: 1px solid #2b313c; display: flex; justify-content: space-between; }
      main { display: grid; grid-template-columns: minmax(0, 2fr) minmax(320px, 1fr); gap: 16px; padding: 16px; }
      img { width: 100%; border: 1px solid #2b313c; border-radius: 8px; background: #090b0f; }
      pre { white-space: pre-wrap; word-break: break-word; background: #090b0f; border: 1px solid #2b313c; border-radius: 8px; padding: 12px; }
    </style>
  </head>
  <body>
    <header>
      <div>pwcli preview</div>
      <div>session=${sessionName}</div>
    </header>
    <main>
      <section><img id="frame" src="/frame.jpg" alt="pwcli preview frame"></section>
      <section><pre id="status">loading…</pre></section>
    </main>
    <script>
      async function refresh() {
        document.getElementById("frame").src = "/frame.jpg?ts=" + Date.now();
        const response = await fetch("/status.json?ts=" + Date.now());
        const data = await response.json();
        document.getElementById("status").textContent = JSON.stringify(data, null, 2);
      }
      refresh();
      setInterval(refresh, 2000);
    </script>
  </body>
</html>`);
  } catch (error) {
    res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
    res.end(
      JSON.stringify({
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      }),
    );
  }
});

await new Promise<void>((resolve) => {
  server.listen(port, "127.0.0.1", resolve);
});

const address = server.address();
if (!address || typeof address === "string") {
  throw new Error("failed to bind preview server");
}

await writeStreamRecord({
  sessionName,
  pid: process.pid,
  url: `http://127.0.0.1:${address.port}/`,
  port: address.port,
  startedAt: new Date().toISOString(),
});
