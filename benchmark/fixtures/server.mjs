import { createServer } from "node:http";

function html(body, title = "pwcli benchmark fixture") {
  return `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <title>${title}</title>
    </head>
    <body>${body}</body>
  </html>`;
}

function getInt(searchParams, key, fallback) {
  const value = Number(searchParams.get(key) ?? fallback);
  return Number.isFinite(value) ? value : fallback;
}

function getString(searchParams, key, fallback) {
  const value = searchParams.get(key);
  return value && value.trim().length > 0 ? value.trim() : fallback;
}

function articlePage(url) {
  const variant = getString(url.searchParams, "variant", "article-00");
  const title = getString(url.searchParams, "title", `Fixture Article ${variant}`);
  const body = getString(url.searchParams, "body", `Stable body marker for ${variant}.`);
  const cta = getString(url.searchParams, "cta", `Primary CTA ${variant}`);
  return html(
    `<main>
      <article data-variant="${variant}">
        <h1>${title}</h1>
        <p>${body}</p>
        <p>Secondary visible paragraph for ${variant}.</p>
        <a href="/next?variant=${encodeURIComponent(variant)}">${cta}</a>
      </article>
    </main>`,
    title,
  );
}

function authPage(url) {
  const variant = getString(url.searchParams, "variant", "auth-00");
  const mode = getString(url.searchParams, "mode", "authenticated");
  const marker = getString(url.searchParams, "marker", `${variant}-token`);
  const isAuthenticated = mode === "authenticated";
  const heading = isAuthenticated ? `Welcome ${variant}` : `Login required ${variant}`;
  const navText = isAuthenticated ? "Sign out" : "Sign in";
  const script = isAuthenticated
    ? `<script>
        localStorage.setItem("auth.token", ${JSON.stringify(marker)});
        sessionStorage.setItem("auth.session", ${JSON.stringify(`${marker}-session`)});
        document.cookie = "fixture_auth=${encodeURIComponent(marker)}; path=/";
      </script>`
    : `<script>
        localStorage.removeItem("auth.token");
        sessionStorage.removeItem("auth.session");
      </script>`;
  return html(
    `<main data-auth-mode="${mode}">
      <header><h1>${heading}</h1></header>
      <nav><a href="/profile">${navText}</a></nav>
      <section>
        ${
          isAuthenticated
            ? `<p>Protected dashboard marker ${variant}</p>`
            : `<form><label>Email <input type="email" /></label></form>`
        }
      </section>
      ${script}
    </main>`,
    heading,
  );
}

function api500Page(url) {
  const variant = getString(url.searchParams, "variant", "api-500-00");
  const status = getInt(url.searchParams, "status", 500);
  return html(
    `<main>
      <h1>API failure fixture ${variant}</h1>
      <p id="status">loading</p>
      <script>
        (async () => {
          const statusNode = document.getElementById("status");
          try {
            const response = await fetch(${JSON.stringify(
              `/fixture-api/fail?variant=${encodeURIComponent(variant)}&status=${status}`,
            )});
            statusNode.textContent = "api status " + response.status;
          } catch (error) {
            statusNode.textContent = "api failure " + String(error);
          }
          const ready = document.createElement("div");
          ready.id = "api-ready";
          ready.textContent = "API ready ${variant}";
          document.body.appendChild(ready);
        })();
      </script>
    </main>`,
    `API failure ${variant}`,
  );
}

function extractionPage(url) {
  const variant = getString(url.searchParams, "variant", "extract-00");
  const count = Math.max(1, Math.min(6, getInt(url.searchParams, "count", 3)));
  const mode = getString(url.searchParams, "mode", "dom");
  const cards = Array.from({ length: count }, (_, index) => {
    const itemIndex = index + 1;
    return {
      title: `${variant} title ${itemIndex}`,
      href: `/items/${variant}/${itemIndex}`,
      summary: `${variant} summary ${itemIndex}`,
    };
  });
  const cardsMarkup = cards
    .map(
      (item) => `<article class="card">
        <h2>${item.title}</h2>
        <a href="${item.href}">Open ${item.title}</a>
        <p>${item.summary}</p>
      </article>`,
    )
    .join("\n");
  const runtimeScript =
    mode === "runtime"
      ? `<script>window.__PWCLI_FIXTURE__ = ${JSON.stringify({ variant, items: cards })};</script>`
      : "";
  return html(
    `<main>
      <section data-extract-variant="${variant}" data-mode="${mode}">
        ${cardsMarkup}
      </section>
      ${runtimeScript}
    </main>`,
    `Extraction fixture ${variant}`,
  );
}

function notFound(response) {
  response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
  response.end("not found");
}

export async function startFixtureServer() {
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (url.pathname === "/article") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(articlePage(url));
      return;
    }
    if (url.pathname === "/auth") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(authPage(url));
      return;
    }
    if (url.pathname === "/api-500") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(api500Page(url));
      return;
    }
    if (url.pathname === "/extract-list") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(extractionPage(url));
      return;
    }
    if (url.pathname === "/fixture-api/fail") {
      const status = Math.max(400, Math.min(599, getInt(url.searchParams, "status", 500)));
      response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
      response.end(
        JSON.stringify({
          ok: false,
          status,
          variant: getString(url.searchParams, "variant", "api-500-00"),
        }),
      );
      return;
    }
    notFound(response);
  });

  await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("failed to bind benchmark fixture server");
  }
  return {
    server,
    port: address.port,
    async close() {
      server.closeAllConnections();
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
  };
}
