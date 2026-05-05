import { createServer } from "node:http";

const host = "127.0.0.1";
const port = Number(process.env.PWCLI_DOGFOOD_PORT ?? process.argv[2] ?? 43279);
const origin = `http://${host}:${port}`;

function now() {
  return new Date().toISOString();
}

function parseCookies(header = "") {
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        if (index < 0) {
          return [part, ""];
        }
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      }),
  );
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function writeHtml(response, statusCode, html, headers = {}) {
  response.writeHead(statusCode, {
    "cache-control": "no-store",
    "content-type": "text/html; charset=utf-8",
    ...headers,
  });
  response.end(html);
}

function writeJson(response, statusCode, payload, headers = {}) {
  response.writeHead(statusCode, {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
    ...headers,
  });
  response.end(JSON.stringify(payload, null, 2));
}

function writeText(response, statusCode, body, headers = {}) {
  response.writeHead(statusCode, {
    "cache-control": "no-store",
    "content-type": "text/plain; charset=utf-8",
    ...headers,
  });
  response.end(body);
}

function redirect(response, location) {
  response.writeHead(302, {
    location,
    "cache-control": "no-store",
  });
  response.end();
}

function pageShell(title, body, script = "") {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <style>
      :root {
        color-scheme: light;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }
      body {
        margin: 0;
        background: #f5f7fb;
        color: #0f172a;
      }
      a { color: #1d4ed8; text-decoration: none; }
      a:hover { text-decoration: underline; }
      header, main, section {
        box-sizing: border-box;
      }
      .shell {
        max-width: 1120px;
        margin: 0 auto;
        padding: 24px;
      }
      .topbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 24px;
      }
      .crumbs {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        font-size: 14px;
      }
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border-radius: 999px;
        background: #dbeafe;
        color: #1e3a8a;
        font-size: 12px;
      }
      .danger {
        background: #fee2e2;
        color: #991b1b;
      }
      .grid {
        display: grid;
        gap: 16px;
      }
      .grid.two {
        grid-template-columns: minmax(0, 1.5fr) minmax(320px, 1fr);
      }
      .panel {
        background: #ffffff;
        border: 1px solid #dbe3f0;
        border-radius: 8px;
        padding: 16px;
      }
      .panel h2, .panel h3 {
        margin: 0 0 12px;
      }
      .stack {
        display: grid;
        gap: 12px;
      }
      .row {
        display: flex;
        gap: 12px;
        align-items: center;
        flex-wrap: wrap;
      }
      label {
        display: grid;
        gap: 6px;
        font-size: 14px;
      }
      input[type="text"], input[type="email"], input[type="password"] {
        min-width: 240px;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        padding: 8px 10px;
        font-size: 14px;
      }
      button {
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        padding: 8px 12px;
        background: #f8fafc;
        cursor: pointer;
      }
      button.primary {
        background: #2563eb;
        border-color: #2563eb;
        color: white;
      }
      .note {
        margin: 0;
        font-size: 13px;
        color: #475569;
      }
      .mono {
        font-family: ui-monospace, SFMono-Regular, monospace;
        white-space: pre-wrap;
      }
      .status {
        min-height: 24px;
        padding: 10px 12px;
        border-radius: 6px;
        background: #eff6ff;
      }
      .list {
        display: grid;
        gap: 8px;
      }
      .item {
        border: 1px solid #dbe3f0;
        border-radius: 6px;
        padding: 10px 12px;
        background: #f8fafc;
      }
      .dropzone {
        min-height: 72px;
        border: 1px dashed #94a3b8;
        border-radius: 6px;
        padding: 12px;
        display: grid;
        gap: 8px;
      }
      .draggable {
        padding: 8px 10px;
        border-radius: 6px;
        background: #e0f2fe;
        border: 1px solid #7dd3fc;
      }
      iframe {
        width: 100%;
        height: 140px;
        border: 1px solid #dbe3f0;
        border-radius: 6px;
      }
    </style>
  </head>
  <body>
    ${body}
    <script>
      const ORIGIN = ${JSON.stringify(origin)};
      const authState = {
        cookie: document.cookie.includes("pwcli_auth=1"),
        local: localStorage.getItem("pwcli-auth") || "",
        session: sessionStorage.getItem("pwcli-session") || "",
      };
      const authBadge = document.querySelector("#auth-badge");
      if (authBadge) {
        authBadge.textContent = authState.cookie ? "authenticated" : "anonymous";
        authBadge.className = authState.cookie ? "badge" : "badge danger";
      }
      ${script}
    </script>
  </body>
</html>`;
}

function renderLogin() {
  return pageShell(
    "pwcli dogfood login",
    `<main class="shell">
      <div class="topbar">
        <div>
          <h1>pwcli dogfood login</h1>
          <p class="note">This page writes cookie, localStorage, and sessionStorage so state reuse can be verified.</p>
        </div>
        <span id="auth-badge" class="badge danger">anonymous</span>
      </div>
      <section class="panel stack">
        <label>Email
          <input id="email" type="email" value="qa@example.com" />
        </label>
        <label>Password
          <input id="password" type="password" value="pwcli-secret" />
        </label>
        <label class="row">
          <input id="remember-me" type="checkbox" checked />
          <span>Remember me</span>
        </label>
        <div class="row">
          <button id="login-submit" class="primary">Sign in</button>
          <span id="login-status" class="status">ready</span>
        </div>
      </section>
    </main>`,
    `
      const loginStatus = document.querySelector("#login-status");
      const loginButton = document.querySelector("#login-submit");
      loginButton?.addEventListener("click", async () => {
        const email = String(document.querySelector("#email")?.value || "");
        const remember = Boolean(document.querySelector("#remember-me")?.checked);
        document.cookie = "pwcli_auth=1; path=/";
        document.cookie = "pwcli_role=qa; path=/";
        localStorage.setItem("pwcli-auth", email);
        localStorage.setItem("pwcli-role", "qa");
        sessionStorage.setItem("pwcli-session", "live");
        if (loginStatus) {
          loginStatus.textContent = remember ? "authenticated + remembered" : "authenticated";
        }
        console.info("login-success", { email, remember });
        location.href = "/app/projects?from=login";
      });
    `,
  );
}

function withAppLayout(title, crumbs, body, script = "") {
  return pageShell(
    title,
    `<main class="shell">
      <div class="topbar">
        <div>
          <div class="crumbs">${crumbs
            .map((crumb) => `<a href="${crumb.href}">${crumb.label}</a>`)
            .join("<span>/</span>")}</div>
          <h1>${title}</h1>
        </div>
        <span id="auth-badge" class="badge danger">anonymous</span>
      </div>
      ${body}
    </main>`,
    script,
  );
}

function renderProjects() {
  return withAppLayout(
    "Projects",
    [
      { href: "/app", label: "App" },
      { href: "/app/projects", label: "Projects" },
    ],
    `<section class="panel stack">
      <label>Search
        <input id="project-search" type="text" value="alpha" />
      </label>
      <div class="list">
        <a id="project-alpha" class="item" href="/app/projects/alpha">alpha / checkout platform</a>
        <a id="project-beta" class="item" href="/app/projects/beta">beta / unused fixture row</a>
      </div>
    </section>`,
  );
}

function renderProjectOverview() {
  return withAppLayout(
    "Project Alpha",
    [
      { href: "/app", label: "App" },
      { href: "/app/projects", label: "Projects" },
      { href: "/app/projects/alpha", label: "Alpha" },
    ],
    `<section class="panel stack">
      <p class="note">This page is intentionally simple. The real exercise starts under incidents.</p>
      <a id="alpha-incidents" class="item" href="/app/projects/alpha/incidents">Open incidents</a>
    </section>`,
  );
}

function renderIncidents() {
  return withAppLayout(
    "Incidents",
    [
      { href: "/app", label: "App" },
      { href: "/app/projects", label: "Projects" },
      { href: "/app/projects/alpha", label: "Alpha" },
      { href: "/app/projects/alpha/incidents", label: "Incidents" },
    ],
    `<section class="panel stack">
      <div class="item">
        <div class="row" style="justify-content: space-between">
          <strong>checkout-timeout</strong>
          <a id="incident-checkout-timeout" href="/app/projects/alpha/incidents/checkout-timeout">Inspect</a>
        </div>
        <p class="note">Intermittent checkout failures under geolocation and flaky backend conditions.</p>
      </div>
    </section>`,
  );
}

function renderIncidentDetails() {
  return withAppLayout(
    "checkout-timeout",
    [
      { href: "/app", label: "App" },
      { href: "/app/projects", label: "Projects" },
      { href: "/app/projects/alpha", label: "Alpha" },
      { href: "/app/projects/alpha/incidents", label: "Incidents" },
      {
        href: "/app/projects/alpha/incidents/checkout-timeout",
        label: "checkout-timeout",
      },
    ],
    `<section class="grid two">
      <section class="panel stack">
        <h2>Incident Summary</h2>
        <p class="note">Users see a checkout timeout after several deep navigation steps. Reproduction is more likely on flaky network, missing geolocation permission, or when the backend returns malformed responses.</p>
        <div class="row">
          <a id="open-reproduce" class="primary" href="/app/projects/alpha/incidents/checkout-timeout/reproduce">Open reproduce workspace</a>
        </div>
      </section>
      <aside class="panel stack">
        <h3>Hints</h3>
        <p class="note">Use deep navigation, diagnostics digest, route mocking, and environment controls.</p>
        <p class="note">One modal path intentionally blocks page-context-backed reads.</p>
      </aside>
    </section>`,
  );
}

function renderEmbeddedNotes() {
  return pageShell(
    "pwcli dogfood notes frame",
    `<main class="shell">
      <h2>Embedded diagnostics notes</h2>
      <p id="embedded-note">frame ready with nested context</p>
    </main>`,
  );
}

function renderReproduce() {
  return withAppLayout(
    "checkout-timeout reproduce",
    [
      { href: "/app", label: "App" },
      { href: "/app/projects", label: "Projects" },
      { href: "/app/projects/alpha", label: "Alpha" },
      { href: "/app/projects/alpha/incidents", label: "Incidents" },
      {
        href: "/app/projects/alpha/incidents/checkout-timeout",
        label: "checkout-timeout",
      },
      {
        href: "/app/projects/alpha/incidents/checkout-timeout/reproduce",
        label: "reproduce",
      },
    ],
    `<div class="grid two">
      <section class="panel stack">
        <h2>Reproduce workspace</h2>
        <div class="row">
          <button id="load-summary">Load summary</button>
          <button id="trigger-bug" class="primary">Start failing reproduce</button>
          <button id="route-target">Run mock target</button>
          <button id="throw-console-warning">Console warning</button>
          <button id="throw-console-error">Console error</button>
          <button id="throw-page-error">Page error</button>
          <button id="open-alert">Open alert</button>
        </div>
        <div class="row">
          <button id="offline-probe">Offline probe</button>
          <button id="geo-probe">Geolocation probe</button>
          <button id="clock-probe">Clock probe</button>
          <a id="download-report" href="/api/download/report.txt?token=dogfood-1" download>Download report</a>
        </div>
        <div id="diagnostic-hint" class="status">ready</div>
        <div id="summary-result" class="mono">summary: pending</div>
        <div id="bug-result" class="mono">bug-result: pending</div>
        <div id="mock-result" class="mono">mock-result: pending</div>
        <div id="offline-result" class="mono">offline-result: pending</div>
        <div id="geo-result" class="mono">geo-result: pending</div>
        <div id="clock-result" class="mono">clock-result: pending</div>
        <div class="panel">
          <h3>Upload</h3>
          <input id="upload-input" type="file" />
          <div id="upload-result" class="mono">upload-result: pending</div>
        </div>
        <div class="panel stack">
          <h3>Drag and drop</h3>
          <div class="dropzone" id="drag-lane-todo">
            <div id="drag-card-a" class="draggable" draggable="true">triage customer report</div>
            <div id="drag-card-b" class="draggable" draggable="true">reproduce checkout timeout</div>
          </div>
          <div class="dropzone" id="drag-lane-done"></div>
          <div id="drag-status" class="mono">drag-status: pending</div>
        </div>
      </section>
      <aside class="panel stack">
        <h2>Context</h2>
        <p id="auth-state" class="mono">auth: pending</p>
        <p id="storage-state" class="mono">storage: pending</p>
        <p id="route-state" class="mono">route-state: pending</p>
        <iframe id="notes-frame" src="/app/projects/alpha/incidents/checkout-timeout/reproduce/notes" title="embedded notes"></iframe>
      </aside>
    </div>`,
    `
      const authStateNode = document.querySelector("#auth-state");
      const storageStateNode = document.querySelector("#storage-state");
      const routeStateNode = document.querySelector("#route-state");
      const diagnosticHint = document.querySelector("#diagnostic-hint");
      const setText = (selector, text) => {
        const node = document.querySelector(selector);
        if (node) {
          node.textContent = text;
        }
      };
      const updateAuthState = () => {
        const auth = document.cookie.includes("pwcli_auth=1");
        setText("#auth-state", "auth: " + (auth ? "cookie-present" : "missing"));
        setText(
          "#storage-state",
          "storage: local=" + (localStorage.getItem("pwcli-auth") || "missing") +
            " session=" + (sessionStorage.getItem("pwcli-session") || "missing"),
        );
      };
      const withHint = (text) => {
        if (diagnosticHint) {
          diagnosticHint.textContent = text;
        }
      };
      updateAuthState();
      setText("#route-state", "route-state: server");

      document.querySelector("#load-summary")?.addEventListener("click", async () => {
        withHint("loading summary");
        const response = await fetch("/api/incidents/alpha/checkout-timeout/summary");
        const payload = await response.json();
        console.info("summary-loaded", payload);
        setText("#summary-result", "summary-result: " + payload.title + " / " + payload.severity);
        withHint("summary loaded");
      });

      document.querySelector("#trigger-bug")?.addEventListener("click", async () => {
        withHint("running reproduce");
        const response = await fetch("/api/incidents/alpha/checkout-timeout/start", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            mode: "fail500",
            source: "ui",
          }),
        });
        const payload = await response.json();
        if (!response.ok) {
          console.error("checkout-timeout", payload);
          setText("#bug-result", "bug-result: " + payload.errorCode + " / " + payload.message);
          withHint("reproduce failed");
          return;
        }
        setText("#bug-result", "bug-result: success");
        withHint("reproduce succeeded");
      });

      document.querySelector("#route-target")?.addEventListener("click", async () => {
        const response = await fetch("/api/incidents/alpha/checkout-timeout/mock-target?mode=server");
        const text = await response.text();
        console.log("fixture-route-hit-run-1", text);
        setText("#mock-result", "mock-result: " + response.status + ":" + text);
        setText("#route-state", "route-state: " + response.headers.get("x-pwcli-route"));
      });

      document.querySelector("#throw-console-warning")?.addEventListener("click", () => {
        console.warn("dogfood-warning", { surface: "warning-button" });
        withHint("warning emitted");
      });

      document.querySelector("#throw-console-error")?.addEventListener("click", () => {
        console.error("dogfood-console-error", { surface: "error-button" });
        withHint("console error emitted");
      });

      document.querySelector("#throw-page-error")?.addEventListener("click", () => {
        setTimeout(() => {
          throw new Error("dogfood-page-error");
        }, 0);
      });

      document.querySelector("#open-alert")?.addEventListener("click", () => {
        alert("dogfood-modal");
      });

      document.querySelector("#offline-probe")?.addEventListener("click", async () => {
        try {
          const response = await fetch("/api/offline/ping?token=offline-1");
          const text = await response.text();
          setText("#offline-result", "offline-result: " + response.status + ":" + text);
          withHint("offline probe returned");
        } catch (error) {
          setText("#offline-result", "offline-result: " + String(error));
          withHint("offline probe failed");
        }
      });

      document.querySelector("#geo-probe")?.addEventListener("click", async () => {
        if (!navigator.geolocation) {
          setText("#geo-result", "geo-result: unsupported");
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setText(
              "#geo-result",
              "geo-result: " +
                position.coords.latitude.toFixed(4) +
                "," +
                position.coords.longitude.toFixed(4),
            );
          },
          (error) => {
            setText("#geo-result", "geo-result: " + error.message);
          },
          { enableHighAccuracy: true, timeout: 2000 },
        );
      });

      document.querySelector("#clock-probe")?.addEventListener("click", () => {
        setText("#clock-result", "clock-result: " + new Date().toISOString());
      });

      document.querySelector("#upload-input")?.addEventListener("change", (event) => {
        const files = Array.from(event.target.files || []).map((file) => file.name);
        setText("#upload-result", "upload-result: " + files.join(", "));
      });

      const dragItems = document.querySelectorAll("[draggable='true']");
      let activeDragId = "";
      dragItems.forEach((item) => {
        item.addEventListener("dragstart", () => {
          activeDragId = item.id;
        });
      });
      const doneLane = document.querySelector("#drag-lane-done");
      doneLane?.addEventListener("dragover", (event) => event.preventDefault());
      doneLane?.addEventListener("drop", (event) => {
        event.preventDefault();
        const item = document.getElementById(activeDragId);
        if (item && doneLane) {
          doneLane.appendChild(item);
          setText("#drag-status", "drag-status: moved " + item.textContent);
        }
      });
    `,
  );
}

async function handleApi(request, response, pathname, url, cookies) {
  if (pathname === "/api/auth/login" && request.method === "POST") {
    const body = await readBody(request);
    const payload = body ? JSON.parse(body) : {};
    writeJson(
      response,
      200,
      {
        ok: true,
        email: payload.email ?? "unknown",
      },
      {
        "set-cookie": ["pwcli_auth=1; Path=/", "pwcli_role=qa; Path=/"],
      },
    );
    return true;
  }

  if (!cookies.pwcli_auth && pathname.startsWith("/api/incidents")) {
    writeJson(response, 401, {
      ok: false,
      errorCode: "AUTH_REQUIRED",
      message: "Missing pwcli_auth cookie",
    });
    return true;
  }

  if (pathname === "/api/incidents/alpha/checkout-timeout/summary") {
    writeJson(response, 200, {
      ok: true,
      title: "checkout-timeout",
      severity: "high",
      hint: "reproduce under flaky network or bad backend response",
    });
    return true;
  }

  if (pathname === "/api/incidents/alpha/checkout-timeout/start" && request.method === "POST") {
    await readBody(request);
    writeJson(response, 500, {
      ok: false,
      errorCode: "CHECKOUT_TIMEOUT",
      message: "checkout request timed out after gateway retry",
    });
    return true;
  }

  if (pathname === "/api/incidents/alpha/checkout-timeout/mock-target") {
    const injectedMode = String(request.headers["x-pwcli-route-inject"] ?? "");
    if (injectedMode) {
      writeText(response, 206, `server-route-injected:${injectedMode}`, {
        "x-pwcli-route": "server-injected",
      });
      return true;
    }
    writeText(response, 207, `server-route-fallback:${url.searchParams.get("mode") ?? "server"}`, {
      "x-pwcli-route": "server-fallback",
    });
    return true;
  }

  if (pathname === "/api/offline/ping") {
    writeText(response, 200, `pong:${url.searchParams.get("token") ?? "none"}`);
    return true;
  }

  if (pathname === "/api/bootstrap/echo") {
    const headerEcho = String(request.headers["x-pwcli-header"] ?? "");
    writeJson(
      response,
      200,
      {
        ok: true,
        headerEcho,
        token: url.searchParams.get("token") ?? "none",
      },
      {
        "x-pwcli-header": headerEcho,
      },
    );
    return true;
  }

  if (pathname === "/api/download/report.txt") {
    response.writeHead(200, {
      "cache-control": "no-store",
      "content-type": "text/plain; charset=utf-8",
      "content-disposition": 'attachment; filename="dogfood-report.txt"',
    });
    response.end(`dogfood-report:${url.searchParams.get("token") ?? "none"}\n${now()}\n`);
    return true;
  }

  return false;
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", origin);
  const pathname = url.pathname;
  const cookies = parseCookies(request.headers.cookie);

  if (pathname.startsWith("/api/")) {
    const handled = await handleApi(request, response, pathname, url, cookies);
    if (!handled) {
      writeJson(response, 404, {
        ok: false,
        errorCode: "NOT_FOUND",
        pathname,
      });
    }
    return;
  }

  if (pathname === "/" || pathname === "/login") {
    writeHtml(response, 200, renderLogin());
    return;
  }

  if (pathname === "/favicon.ico") {
    response.writeHead(204, {
      "cache-control": "no-store",
    });
    response.end();
    return;
  }

  if (!cookies.pwcli_auth && pathname.startsWith("/app")) {
    redirect(response, "/login");
    return;
  }

  if (pathname === "/app" || pathname === "/app/projects") {
    writeHtml(response, 200, renderProjects());
    return;
  }

  if (pathname === "/app/projects/alpha") {
    writeHtml(response, 200, renderProjectOverview());
    return;
  }

  if (pathname === "/app/projects/alpha/incidents") {
    writeHtml(response, 200, renderIncidents());
    return;
  }

  if (pathname === "/app/projects/alpha/incidents/checkout-timeout") {
    writeHtml(response, 200, renderIncidentDetails());
    return;
  }

  if (pathname === "/app/projects/alpha/incidents/checkout-timeout/reproduce") {
    writeHtml(response, 200, renderReproduce());
    return;
  }

  if (pathname === "/app/projects/alpha/incidents/checkout-timeout/reproduce/notes") {
    writeHtml(response, 200, renderEmbeddedNotes());
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
        origin,
        loginUrl: `${origin}/login`,
        reproduceUrl: `${origin}/app/projects/alpha/incidents/checkout-timeout/reproduce`,
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
