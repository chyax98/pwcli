import { createServer } from "node:http";

const PORT = 7778;
const SESSION_COOKIE = "session=demo-session; HttpOnly; Path=/";

function redirect(res, location, statusCode = 302) {
  res.writeHead(statusCode, { Location: location });
  res.end();
}

function html(res, content, statusCode = 200) {
  res.writeHead(statusCode, { "Content-Type": "text/html; charset=utf-8" });
  res.end(content);
}

function json(res, data, statusCode = 200) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function hasSession(req) {
  const cookie = req.headers.cookie || "";
  return cookie.includes("session=demo-session");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const loginPage = `<!DOCTYPE html>
<html>
<head><title>Login</title></head>
<body>
  <h1>Login</h1>
  <form method="POST" action="/login">
    <label>Username: <input type="text" name="username" id="username"></label><br><br>
    <label>Password: <input type="password" name="password" id="password"></label><br><br>
    <button type="submit">Submit</button>
  </form>
  <p><a href="/tab2" target="_blank">Open in new tab</a></p>
</body>
</html>`;

const dashboardPage = `<!DOCTYPE html>
<html>
<head><title>Dashboard</title></head>
<body>
  <h1>Dashboard</h1>
  <p>Current time: <span id="time"></span></p>
  <script>document.getElementById('time').textContent = new Date().toLocaleString();</script>
  <p><a href="/tab2" target="_blank">打开新窗口</a></p>
  <p><button id="modal-trigger" onclick="alert('Hello from modal')">Show Alert</button></p>
  <p>
    <label>Role:
      <select id="role">
        <option value="user">User</option>
        <option value="admin">Admin</option>
        <option value="guest">Guest</option>
      </select>
    </label>
  </p>
  <p><label><input type="checkbox" id="agree"> I agree</label></p>
  <iframe src="/iframe-content" width="300" height="100"></iframe>
  <p><button id="api-call" onclick="callApi()">Call API</button></p>
  <p id="api-result"></p>
  <script>
    async function callApi() {
      const res = await fetch('/api/user');
      const data = await res.json();
      document.getElementById('api-result').textContent = JSON.stringify(data);
    }
  </script>
</body>
</html>`;

const tab2Page = `<!DOCTYPE html>
<html>
<head><title>Second Tab</title></head>
<body>
  <h1>Second Tab</h1>
  <p><a href="/dashboard">Back to Dashboard</a></p>
</body>
</html>`;

const iframeContent = `<!DOCTYPE html>
<html>
<head><title>Iframe</title></head>
<body>
  <p>Iframe Content Here</p>
</body>
</html>`;

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === "/" && req.method === "GET") {
    return redirect(res, "/login");
  }

  if (url.pathname === "/login" && req.method === "GET") {
    return html(res, loginPage);
  }

  if (url.pathname === "/login" && req.method === "POST") {
    let body = "";
    for await (const chunk of req) body += chunk;
    const params = new URLSearchParams(body);
    if (params.get("username") === "demo" && params.get("password") === "demo123") {
      res.writeHead(302, {
        Location: "/dashboard",
        "Set-Cookie": SESSION_COOKIE,
      });
      return res.end();
    }
    return html(res, `<p>Invalid credentials</p>${loginPage}`, 401);
  }

  if (url.pathname === "/dashboard" && req.method === "GET") {
    if (!hasSession(req)) {
      return redirect(res, "/login");
    }
    return html(res, dashboardPage);
  }

  if (url.pathname === "/tab2" && req.method === "GET") {
    return html(res, tab2Page);
  }

  if (url.pathname === "/iframe-content" && req.method === "GET") {
    return html(res, iframeContent);
  }

  if (url.pathname === "/api/user" && req.method === "GET") {
    return json(res, { id: 1, name: "Demo User", role: "admin" });
  }

  if (url.pathname === "/api/slow" && req.method === "GET") {
    await sleep(2000);
    return json(res, { status: "ok", delayed: true });
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not Found");
});

export function startFixtureServer(port = PORT) {
  return new Promise((resolve) => {
    server.listen(port, () => {
      console.log(`Fixture server listening on http://localhost:${port}`);
      resolve(server);
    });
  });
}

export function stopFixtureServer() {
  return new Promise((resolve) => {
    server.close(resolve);
  });
}

// Allow running directly: node test/fixtures/servers/realistic-app.mjs
if (import.meta.url === `file://${process.argv[1]}`) {
  startFixtureServer();
}
