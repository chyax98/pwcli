import { createServer } from "node:http";

const host = "127.0.0.1";
const port = Number(process.env.PWCLI_FIXTURE_PORT ?? process.argv[2] ?? 4179);
const maxHits = 100;
const hits = [];

function now() {
  return new Date().toISOString();
}

function rememberHit(request, pathname, searchParams) {
  hits.push({
    at: now(),
    method: request.method ?? "GET",
    pathname,
    query: Object.fromEntries(searchParams.entries()),
    headerEcho: request.headers["x-pwcli-header"] ?? "",
  });
  if (hits.length > maxHits) {
    hits.splice(0, hits.length - maxHits);
  }
}

function writeText(response, statusCode, body, headers = {}) {
  response.writeHead(statusCode, {
    "cache-control": "no-store",
    "content-type": "text/plain; charset=utf-8",
    ...headers,
  });
  response.end(body);
}

function writeJson(response, statusCode, payload, headers = {}) {
  response.writeHead(statusCode, {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
    ...headers,
  });
  response.end(JSON.stringify(payload, null, 2));
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://${host}:${port}`);
  const pathname = url.pathname;
  rememberHit(request, pathname, url.searchParams);

  if (pathname === "/" || pathname === "/blank") {
    response.writeHead(200, {
      "cache-control": "no-store",
      "content-type": "text/html; charset=utf-8",
    });
    response.end(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>pwcli deterministic fixture</title>
  </head>
  <body>
    <main>
      <h1>pwcli deterministic fixture</h1>
      <p id="status">ready</p>
      <label><input id="smoke-checkbox" type="checkbox" /> Smoke checkbox</label>
      <select id="smoke-select">
        <option value="a">Alpha</option>
        <option value="b">Beta</option>
      </select>
    </main>
  </body>
</html>`);
    return;
  }

  if (pathname === "/__pwcli__/diagnostics/fetch") {
    writeText(response, 200, `fetch:${url.searchParams.get("run") ?? "0"}`);
    return;
  }

  if (pathname === "/__pwcli__/diagnostics/xhr") {
    writeText(response, 201, `xhr:${url.searchParams.get("run") ?? "0"}`);
    return;
  }

  if (pathname === "/__pwcli__/diagnostics/json") {
    writeJson(response, 200, {
      ok: true,
      run: url.searchParams.get("run") ?? "0",
      severity: "high",
      meta: {
        source: "server",
        patched: false,
      },
    });
    return;
  }

  if (pathname === "/__pwcli__/diagnostics/route-hit") {
    const injectedMode = String(request.headers["x-pwcli-route-mode"] ?? "");
    if (injectedMode) {
      writeText(
        response,
        206,
        `server-route-injected:${url.searchParams.get("run") ?? "0"}:${injectedMode}`,
        {
          "x-pwcli-route": "server-injected",
        },
      );
      return;
    }
    writeText(response, 207, `server-route-fallback:${url.searchParams.get("run") ?? "0"}`, {
      "x-pwcli-route": "server-fallback",
    });
    return;
  }

  if (pathname === "/__pwcli__/wait/request") {
    writeText(response, 202, `wait-request:${url.searchParams.get("token") ?? "none"}`);
    return;
  }

  if (pathname === "/__pwcli__/wait/response") {
    writeText(response, 203, `wait-response:${url.searchParams.get("token") ?? "none"}`);
    return;
  }

  if (pathname === "/__pwcli__/bootstrap/echo") {
    const headerEcho = String(request.headers["x-pwcli-header"] ?? "");
    writeJson(
      response,
      200,
      {
        ok: true,
        token: url.searchParams.get("token") ?? "",
        headerEcho,
        pathname,
      },
      {
        "x-pwcli-header": headerEcho,
        "x-pwcli-route": "server-echo",
      },
    );
    return;
  }

  if (pathname === "/__pwcli__/state") {
    writeJson(response, 200, {
      ok: true,
      hits,
      count: hits.length,
    });
    return;
  }

  writeText(response, 404, `not-found:${pathname}`);
});

server.listen(port, host, () => {
  process.stdout.write(
    `${JSON.stringify(
      {
        host,
        port,
        origin: `http://${host}:${port}`,
        blankUrl: `http://${host}:${port}/blank`,
        pid: process.pid,
      },
      null,
      2,
    )}\n`,
  );
});

const shutdown = () => {
  server.close(() => {
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
