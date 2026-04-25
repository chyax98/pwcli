import { createServer } from 'node:net';
import { chromium } from 'playwright-core';

const targetUrl = process.argv[2] ?? 'about:blank';

function reservePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => {
          reject(new Error('Failed to reserve a localhost port'));
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
        return;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for CDP endpoint at ${browserURL}`);
}

const cdpPort = await reservePort();
const browserURL = `http://127.0.0.1:${cdpPort}`;

const server = await chromium.launchServer({
  headless: true,
  _sharedBrowser: true,
  args: [`--remote-debugging-port=${cdpPort}`],
});

await waitForCdp(browserURL);

const browser = await chromium.connect(server.wsEndpoint());
const context = await browser.newContext();
const page = await context.newPage();

if (targetUrl === 'about:blank') {
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
    waitUntil: 'domcontentloaded',
  });
}

process.stdout.write(
  `${JSON.stringify(
    {
      wsEndpoint: server.wsEndpoint(),
      browserURL,
      cdpPort,
      url: page.url(),
      title: await page.title(),
      pid: server.process()?.pid ?? null,
    },
    null,
    2,
  )}\n`,
);

const shutdown = async () => {
  await browser.close().catch(() => {});
  await server.close().catch(() => {});
  process.exit(0);
};

process.on('SIGINT', () => {
  void shutdown();
});

process.on('SIGTERM', () => {
  void shutdown();
});

await new Promise(() => {});
