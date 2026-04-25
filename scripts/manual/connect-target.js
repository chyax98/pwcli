import { chromium } from "playwright-core";

const url = process.argv[2] ?? "about:blank";

const server = await chromium.launchServer({
  headless: true,
  _sharedBrowser: true,
});

const browser = await chromium.connect(server.wsEndpoint());
const context = await browser.newContext();
const page = await context.newPage();

if (url === "about:blank") {
  await page.setContent(`
    <html>
      <head>
        <title>pwcli connect target</title>
      </head>
      <body>
        <main>
          <h1>pwcli connect target</h1>
          <p id="status">ready</p>
        </main>
      </body>
    </html>
  `);
} else {
  await page.goto(url);
}

process.stdout.write(
  `${JSON.stringify(
    {
      wsEndpoint: server.wsEndpoint(),
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

process.on("SIGINT", () => {
  void shutdown();
});

process.on("SIGTERM", () => {
  void shutdown();
});

await new Promise(() => {});
