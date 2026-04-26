import { readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";

const targetUrl = process.argv[2] ?? "about:blank";
const attachBridgeRegistryPath = join(tmpdir(), "pwcli-attach-target-registry.json");

function reservePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => {
          reject(new Error("Failed to reserve a localhost port"));
        });
        return;
      }
      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
}

async function waitForCdp(browserURL) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${browserURL}/json/version`);
      if (response.ok) {
        return await response.json();
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for CDP endpoint at ${browserURL}`);
}

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function readAttachBridgeRegistry() {
  try {
    const text = await readFile(attachBridgeRegistryPath, "utf8");
    const parsed = JSON.parse(text);
    return Array.isArray(parsed.targets) ? parsed.targets : [];
  } catch {
    return [];
  }
}

async function writeAttachBridgeEntry(entry) {
  const targets = await readAttachBridgeRegistry();
  const nextTargets = targets
    .filter((target) => target.browserURL !== entry.browserURL)
    .filter((target) => !target.pid || isProcessAlive(target.pid));
  nextTargets.push(entry);
  await writeFile(
    attachBridgeRegistryPath,
    `${JSON.stringify({ version: 1, targets: nextTargets }, null, 2)}\n`,
    "utf8",
  );
}

async function removeAttachBridgeEntry(browserURL) {
  const targets = await readAttachBridgeRegistry();
  const nextTargets = targets.filter((target) => target.browserURL !== browserURL);
  await writeFile(
    attachBridgeRegistryPath,
    `${JSON.stringify({ version: 1, targets: nextTargets }, null, 2)}\n`,
    "utf8",
  ).catch(() => {});
}

const cdpPort = await reservePort();
const browserURL = `http://127.0.0.1:${cdpPort}`;

const server = await chromium.launchServer({
  headless: true,
  _sharedBrowser: true,
  args: [`--remote-debugging-port=${cdpPort}`],
});

const browserVersion = await waitForCdp(browserURL);

const browser = await chromium.connect(server.wsEndpoint());
const context = await browser.newContext();
const page = await context.newPage();

if (targetUrl === "about:blank") {
  await page.setContent(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>pwcli attach target</title>
      </head>
      <body>
        <main>
          <h1>pwcli attach target</h1>
          <p id="status">ready</p>
        </main>
      </body>
    </html>
  `);
} else {
  await page.goto(targetUrl, {
    waitUntil: "domcontentloaded",
  });
}

await writeAttachBridgeEntry({
  browserURL,
  cdpPort,
  wsEndpoint: server.wsEndpoint(),
  cdpWebSocketDebuggerUrl:
    typeof browserVersion.webSocketDebuggerUrl === "string"
      ? browserVersion.webSocketDebuggerUrl
      : undefined,
  pid: server.process()?.pid ?? null,
  createdAt: new Date().toISOString(),
});

process.stdout.write(
  `${JSON.stringify(
    {
      wsEndpoint: server.wsEndpoint(),
      browserURL,
      cdpPort,
      url: page.url(),
      title: await page.title(),
      pid: server.process()?.pid ?? null,
      attachBridgeRegistryPath,
    },
    null,
    2,
  )}\n`,
);

const shutdown = async () => {
  await removeAttachBridgeEntry(browserURL);
  await browser.close().catch(() => {});
  await server.close().catch(() => {});
  process.exit(0);
};

process.on("SIGINT", () => {
  void shutdown();
});

process.on("SIGTERM", () => {
  void shutdown();
});

await new Promise(() => {});
