import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

type CliResult = {
  code: number | null;
  stdout: string;
  stderr: string;
  json: unknown;
};

type ExtractStats = {
  kind: "list" | "article";
  itemCount: number;
  fieldCount: number;
  limit: number;
  pageCount?: number;
  paginationMode?: "next-page" | "load-more";
  scrollMode?: "until-stable";
  scrollStepsUsed?: number;
  maxPages?: number;
  maxScrollSteps?: number;
  runtimeProbePath?: string;
  runtimeProbeFound?: boolean;
};

type ExtractArtifact = {
  recipeId: string;
  url: string;
  generatedAt: string;
  items: Array<Record<string, unknown>>;
  stats: ExtractStats;
};

const repoRoot = resolve(import.meta.dirname, "..", "..");
const cliPath = resolve(repoRoot, "dist", "cli.js");
const workspaceDir = await mkdtemp(join(tmpdir(), "pwcli-extract-scroll-"));
const recipeDir = resolve(workspaceDir, "recipes");
const artifactDir = resolve(workspaceDir, "artifacts");
const loadMoreSession = `lm${Date.now().toString(36).slice(-6)}`;
const scrollSession = `sc${Date.now().toString(36).slice(-6)}`;

function runPw(args: string[]) {
  return new Promise<CliResult>((resolveResult, reject) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      cwd: workspaceDir,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      const trimmed = stdout.trim();
      let json: unknown = null;
      if (trimmed) {
        try {
          json = JSON.parse(trimmed);
        } catch (error) {
          reject(
            new Error(
              `Failed to parse JSON output for ${args.join(" ")}: ${
                error instanceof Error ? error.message : String(error)
              }\nstdout=${stdout}\nstderr=${stderr}`,
            ),
          );
          return;
        }
      }
      resolveResult({ code, stdout, stderr, json });
    });
  });
}

async function writeRecipe(name: string, recipe: Record<string, unknown>) {
  const path = resolve(recipeDir, name);
  await writeFile(path, JSON.stringify(recipe, null, 2), "utf8");
  return path;
}

const server = createServer((request, response) => {
  if (request.url === "/load-more") {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(`<!doctype html>
      <html lang="en">
        <head>
          <title>Load More Fixture</title>
          <style>
            body { font-family: sans-serif; }
            .post-card { margin-bottom: 12px; }
          </style>
        </head>
        <body>
          <main>
            <section data-testid="feed"></section>
            <button class="load-more" type="button">Load more</button>
          </main>
          <script>
            const batches = [
              [
                { title: "Alpha Title", href: "/posts/alpha" },
                { title: "Beta Title", href: "/posts/beta" }
              ],
              [
                { title: "Gamma Title", href: "/posts/gamma" },
                { title: "Delta Title", href: "/posts/delta" }
              ],
              [
                { title: "Epsilon Title", href: "/posts/epsilon" }
              ]
            ];
            const feed = document.querySelector('[data-testid="feed"]');
            const button = document.querySelector('button.load-more');
            let nextBatchIndex = 0;
            const renderBatch = batch => {
              feed.insertAdjacentHTML(
                'beforeend',
                batch
                  .map(
                    post => '<article class="post-card"><h2><a href="' + post.href + '">' + post.title + '</a></h2></article>',
                  )
                  .join(''),
              );
            };
            const updateButton = () => {
              if (nextBatchIndex >= batches.length) {
                button.disabled = true;
                button.hidden = true;
              }
            };
            renderBatch(batches[nextBatchIndex]);
            nextBatchIndex += 1;
            updateButton();
            button.addEventListener('click', () => {
              if (nextBatchIndex >= batches.length)
                return;
              window.setTimeout(() => {
                renderBatch(batches[nextBatchIndex]);
                nextBatchIndex += 1;
                updateButton();
              }, 50);
            });
          </script>
        </body>
      </html>`);
    return;
  }

  if (request.url === "/scroll") {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(`<!doctype html>
      <html lang="en">
        <head>
          <title>Scroll Fixture</title>
          <style>
            body { font-family: sans-serif; margin: 0; }
            main { padding: 16px; }
            .post-card { margin-bottom: 12px; }
            .spacer { height: 1200px; }
          </style>
        </head>
        <body>
          <main>
            <section data-testid="feed"></section>
            <div class="spacer"></div>
          </main>
          <script>
            const batches = [
              [
                { title: "Scroll Alpha", href: "/posts/scroll-alpha" },
                { title: "Scroll Beta", href: "/posts/scroll-beta" }
              ],
              [
                { title: "Scroll Gamma", href: "/posts/scroll-gamma" },
                { title: "Scroll Delta", href: "/posts/scroll-delta" }
              ]
            ];
            const feed = document.querySelector('[data-testid="feed"]');
            const spacer = document.querySelector('.spacer');
            let nextBatchIndex = 0;
            let pending = false;
            const renderBatch = batch => {
              feed.insertAdjacentHTML(
                'beforeend',
                batch
                  .map(
                    post => '<article class="post-card"><h2><a href="' + post.href + '">' + post.title + '</a></h2></article>',
                  )
                  .join(''),
              );
            };
            const updateSpacer = () => {
              spacer.style.height = nextBatchIndex >= batches.length ? '240px' : '1200px';
            };
            const maybeAppend = () => {
              if (pending || nextBatchIndex >= batches.length)
                return;
              const nearBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 100;
              if (!nearBottom)
                return;
              pending = true;
              window.setTimeout(() => {
                renderBatch(batches[nextBatchIndex]);
                nextBatchIndex += 1;
                updateSpacer();
                pending = false;
              }, 50);
            };
            renderBatch(batches[nextBatchIndex]);
            nextBatchIndex += 1;
            updateSpacer();
            window.addEventListener('scroll', maybeAppend, { passive: true });
          </script>
        </body>
      </html>`);
    return;
  }

  response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
  response.end("not found");
});

await mkdir(recipeDir, { recursive: true });
await mkdir(artifactDir, { recursive: true });

await new Promise<void>((resolveStart) => {
  server.listen(0, "127.0.0.1", () => resolveStart());
});

try {
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("failed to bind extract scroll fixture server");
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;
  const loadMoreUrl = `${baseUrl}/load-more`;
  const scrollUrl = `${baseUrl}/scroll`;
  const loadMoreRecipePath = await writeRecipe("load-more.json", {
    kind: "list",
    itemSelector: ".post-card",
    fields: {
      title: "h2 a",
      url: { selector: "h2 a", attr: "href" },
    },
    limit: 10,
    pagination: {
      mode: "load-more",
      selector: "button.load-more",
      maxPages: 2,
    },
  });
  const loadMoreMarkdownRecipePath = await writeRecipe("load-more-markdown.json", {
    kind: "list",
    itemSelector: ".post-card",
    fields: {
      title: "h2 a",
      url: { selector: "h2 a", attr: "href" },
    },
    limit: 10,
    pagination: {
      mode: "load-more",
      selector: "button.load-more",
      maxPages: 2,
    },
    output: {
      format: "markdown",
    },
  });
  const scrollRecipePath = await writeRecipe("scroll.json", {
    kind: "list",
    itemSelector: ".post-card",
    fields: {
      title: "h2 a",
      url: { selector: "h2 a", attr: "href" },
    },
    limit: 10,
    scroll: {
      mode: "until-stable",
      stepPx: 900,
      settleMs: 150,
      maxSteps: 4,
    },
  });

  let loadMoreCreated = false;
  let scrollCreated = false;
  try {
    const createLoadMore = await runPw([
      "session",
      "create",
      loadMoreSession,
      "--headless",
      "--open",
      loadMoreUrl,
      "--output",
      "json",
    ]);
    assert.equal(createLoadMore.code, 0, `load-more session create failed: ${JSON.stringify(createLoadMore)}`);
    loadMoreCreated = true;

    const loadMoreOutFile = resolve(artifactDir, "load-more.json");
    const loadMoreExtract = await runPw([
      "extract",
      "run",
      "--session",
      loadMoreSession,
      "--recipe",
      loadMoreRecipePath,
      "--out",
      loadMoreOutFile,
      "--output",
      "json",
    ]);
    assert.equal(loadMoreExtract.code, 0, `load-more extract failed: ${JSON.stringify(loadMoreExtract)}`);

    const loadMoreEnvelope = loadMoreExtract.json as {
      ok: boolean;
      page: { url: string; title: string };
      data: {
        recipePath: string;
        artifactPath?: string;
        recordCount: number;
        items: Array<{ title: string; url: string }>;
        records: Array<{ title: string; url: string }>;
        stats: ExtractStats;
      };
    };
    assert.equal(loadMoreEnvelope.ok, true);
    assert.equal(loadMoreEnvelope.page.url, loadMoreUrl);
    assert.equal(loadMoreEnvelope.page.title, "Load More Fixture");
    assert.equal(loadMoreEnvelope.data.recipePath, loadMoreRecipePath);
    assert.equal(loadMoreEnvelope.data.recordCount, 4);
    assert.deepEqual(loadMoreEnvelope.data.items, [
      { title: "Alpha Title", url: `${baseUrl}/posts/alpha` },
      { title: "Beta Title", url: `${baseUrl}/posts/beta` },
      { title: "Gamma Title", url: `${baseUrl}/posts/gamma` },
      { title: "Delta Title", url: `${baseUrl}/posts/delta` },
    ]);
    assert.deepEqual(loadMoreEnvelope.data.records, loadMoreEnvelope.data.items);
    assert.deepEqual(loadMoreEnvelope.data.stats, {
      kind: "list",
      itemCount: 4,
      fieldCount: 2,
      limit: 10,
      pageCount: 2,
      paginationMode: "load-more",
      maxPages: 2,
    });
    assert.equal(loadMoreEnvelope.data.artifactPath, loadMoreOutFile);

    const writtenLoadMoreArtifact = JSON.parse(await readFile(loadMoreOutFile, "utf8")) as ExtractArtifact & {
      recordCount: number;
      records: Array<{ title: string; url: string }>;
    };
    assert.equal(writtenLoadMoreArtifact.recordCount, 4);
    assert.deepEqual(writtenLoadMoreArtifact.items, loadMoreEnvelope.data.items);
    assert.deepEqual(writtenLoadMoreArtifact.records, loadMoreEnvelope.data.records);
    assert.deepEqual(writtenLoadMoreArtifact.stats, loadMoreEnvelope.data.stats);

    const loadMoreMarkdownOutFile = resolve(artifactDir, "load-more.md");
    const reopenLoadMore = await runPw([
      "open",
      loadMoreUrl,
      "--session",
      loadMoreSession,
      "--output",
      "json",
    ]);
    assert.equal(
      reopenLoadMore.code,
      0,
      `reopen load-more page failed: ${JSON.stringify(reopenLoadMore)}`,
    );
    const loadMoreMarkdownExtract = await runPw([
      "extract",
      "run",
      "--session",
      loadMoreSession,
      "--recipe",
      loadMoreMarkdownRecipePath,
      "--out",
      loadMoreMarkdownOutFile,
      "--output",
      "json",
    ]);
    assert.equal(
      loadMoreMarkdownExtract.code,
      0,
      `load-more markdown extract failed: ${JSON.stringify(loadMoreMarkdownExtract)}`,
    );

    const loadMoreMarkdownEnvelope = loadMoreMarkdownExtract.json as {
      ok: boolean;
      data: {
        format: string;
        artifactFormat?: string;
        recipePath: string;
        artifactPath?: string;
        items: Array<{ title: string; url: string }>;
        records: Array<{ title: string; url: string }>;
      };
    };
    assert.equal(loadMoreMarkdownEnvelope.ok, true);
    assert.equal(loadMoreMarkdownEnvelope.data.format, "json");
    assert.equal(loadMoreMarkdownEnvelope.data.artifactFormat, "markdown");
    assert.equal(loadMoreMarkdownEnvelope.data.recipePath, loadMoreMarkdownRecipePath);
    assert.equal(loadMoreMarkdownEnvelope.data.artifactPath, loadMoreMarkdownOutFile);
    assert.deepEqual(loadMoreMarkdownEnvelope.data.records, loadMoreMarkdownEnvelope.data.items);
    assert.equal(
      await readFile(loadMoreMarkdownOutFile, "utf8"),
      [
        "| title | url |",
        "| --- | --- |",
        `| Alpha Title | ${baseUrl}/posts/alpha |`,
        `| Beta Title | ${baseUrl}/posts/beta |`,
        `| Gamma Title | ${baseUrl}/posts/gamma |`,
        `| Delta Title | ${baseUrl}/posts/delta |`,
        "",
      ].join("\n"),
    );

    const createScroll = await runPw([
      "session",
      "create",
      scrollSession,
      "--headless",
      "--open",
      scrollUrl,
      "--output",
      "json",
    ]);
    assert.equal(createScroll.code, 0, `scroll session create failed: ${JSON.stringify(createScroll)}`);
    scrollCreated = true;

    const scrollOutFile = resolve(artifactDir, "scroll.json");
    const scrollExtract = await runPw([
      "extract",
      "run",
      "--session",
      scrollSession,
      "--recipe",
      scrollRecipePath,
      "--out",
      scrollOutFile,
      "--output",
      "json",
    ]);
    assert.equal(scrollExtract.code, 0, `scroll extract failed: ${JSON.stringify(scrollExtract)}`);

    const scrollEnvelope = scrollExtract.json as {
      ok: boolean;
      page: { url: string; title: string };
      data: {
        recipePath: string;
        artifactPath?: string;
        recordCount: number;
        items: Array<{ title: string; url: string }>;
        records: Array<{ title: string; url: string }>;
        stats: ExtractStats;
      };
    };
    assert.equal(scrollEnvelope.ok, true);
    assert.equal(scrollEnvelope.page.url, scrollUrl);
    assert.equal(scrollEnvelope.page.title, "Scroll Fixture");
    assert.equal(scrollEnvelope.data.recipePath, scrollRecipePath);
    assert.equal(scrollEnvelope.data.recordCount, 4);
    assert.deepEqual(scrollEnvelope.data.items, [
      { title: "Scroll Alpha", url: `${baseUrl}/posts/scroll-alpha` },
      { title: "Scroll Beta", url: `${baseUrl}/posts/scroll-beta` },
      { title: "Scroll Gamma", url: `${baseUrl}/posts/scroll-gamma` },
      { title: "Scroll Delta", url: `${baseUrl}/posts/scroll-delta` },
    ]);
    assert.deepEqual(scrollEnvelope.data.records, scrollEnvelope.data.items);
    assert.deepEqual(scrollEnvelope.data.stats, {
      kind: "list",
      itemCount: 4,
      fieldCount: 2,
      limit: 10,
      scrollMode: "until-stable",
      scrollStepsUsed: 2,
      maxScrollSteps: 4,
    });
    assert.equal(scrollEnvelope.data.artifactPath, scrollOutFile);

    const writtenScrollArtifact = JSON.parse(await readFile(scrollOutFile, "utf8")) as ExtractArtifact & {
      recordCount: number;
      records: Array<{ title: string; url: string }>;
    };
    assert.equal(writtenScrollArtifact.recordCount, 4);
    assert.deepEqual(writtenScrollArtifact.items, scrollEnvelope.data.items);
    assert.deepEqual(writtenScrollArtifact.records, scrollEnvelope.data.records);
    assert.deepEqual(writtenScrollArtifact.stats, scrollEnvelope.data.stats);
  } finally {
    if (loadMoreCreated) {
      await runPw(["session", "close", loadMoreSession, "--output", "json"]).catch(() => undefined);
    }
    if (scrollCreated) {
      await runPw(["session", "close", scrollSession, "--output", "json"]).catch(() => undefined);
    }
  }
} finally {
  server.closeAllConnections();
  await new Promise<void>((resolveClose, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolveClose();
    });
  });
  await rm(workspaceDir, { recursive: true, force: true });
}
