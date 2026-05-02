import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
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
  scrollSteps?: number;
  scrollStepsUsed?: number;
  maxPages?: number;
  maxScrollSteps?: number;
  dedupedBlockCount: number;
  runtimeProbePath?: string;
  runtimeProbeFound?: boolean;
};

type ExtractArtifact = {
  recipeId: string;
  url: string;
  generatedAt: string;
  items: Array<Record<string, unknown>>;
  document: ExtractDocument;
  stats: ExtractStats;
};

type ExtractDocument = {
  blocks: Array<
    | { kind: "heading"; text: string; level: number; sectionPath: string[] }
    | { kind: "paragraph"; text: string; sectionPath: string[] }
    | { kind: "link"; text?: string; url: string; sectionPath: string[] }
    | { kind: "image"; url: string; currentSrc?: string; sectionPath: string[] }
  >;
  media: Array<{ kind: "image"; url: string; currentSrc?: string; sectionPath: string[] }>;
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

function imageEntry(url: string, sectionPath: string[]) {
  return {
    kind: "image" as const,
    url,
    currentSrc: url,
    sectionPath,
  };
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
                {
                  title: "Alpha Title",
                  href: "/posts/alpha",
                  summary: "Alpha Summary",
                  imageUrl: "/media/alpha.png"
                },
                {
                  title: "Beta Title",
                  href: "/posts/beta",
                  summary: "Beta Summary",
                  imageUrl: "/media/beta.png"
                }
              ],
              [
                {
                  title: "Gamma Title",
                  href: "/posts/gamma",
                  summary: "Gamma Summary",
                  imageUrl: "/media/gamma.png"
                },
                {
                  title: "Delta Title",
                  href: "/posts/delta",
                  summary: "Delta Summary",
                  imageUrl: "/media/delta.png"
                }
              ],
              [
                {
                  title: "Epsilon Title",
                  href: "/posts/epsilon",
                  summary: "Epsilon Summary",
                  imageUrl: "/media/epsilon.png"
                }
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
                    post =>
                      '<article class="post-card">' +
                      '<section class="entry">' +
                      '<h2><a href="' + post.href + '">' + post.title + '</a></h2>' +
                      '<p class="summary">' + post.summary + '</p>' +
                      '<img class="thumb" src="' + post.imageUrl + '" alt="' + post.title + '" />' +
                      '</section>' +
                      '</article>',
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
                {
                  title: "Scroll Alpha",
                  href: "/posts/scroll-alpha",
                  summary: "Scroll Alpha Summary",
                  imageUrl: "/media/scroll-alpha.png"
                },
                {
                  title: "Scroll Beta",
                  href: "/posts/scroll-beta",
                  summary: "Scroll Beta Summary",
                  imageUrl: "/media/scroll-beta.png"
                }
              ],
              [
                {
                  title: "Scroll Gamma",
                  href: "/posts/scroll-gamma",
                  summary: "Scroll Gamma Summary",
                  imageUrl: "/media/scroll-gamma.png"
                },
                {
                  title: "Scroll Delta",
                  href: "/posts/scroll-delta",
                  summary: "Scroll Delta Summary",
                  imageUrl: "/media/scroll-delta.png"
                }
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
                    post =>
                      '<article class="post-card">' +
                      '<section class="entry">' +
                      '<h2><a href="' + post.href + '">' + post.title + '</a></h2>' +
                      '<p class="summary">' + post.summary + '</p>' +
                      '<img class="thumb" src="' + post.imageUrl + '" alt="' + post.title + '" />' +
                      '</section>' +
                      '</article>',
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
    limit: 3,
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
    limit: 3,
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
    limit: 3,
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
    assert.equal(
      createLoadMore.code,
      0,
      `load-more session create failed: ${JSON.stringify(createLoadMore)}`,
    );
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
    assert.equal(
      loadMoreExtract.code,
      0,
      `load-more extract failed: ${JSON.stringify(loadMoreExtract)}`,
    );

    const loadMoreEnvelope = loadMoreExtract.json as {
      ok: boolean;
      page: { url: string; title: string };
      data: {
        recipePath: string;
        artifactPath?: string;
        items: Array<{ title: string; url: string }>;
        document: ExtractDocument;
        stats: ExtractStats;
      };
    };
    assert.equal(loadMoreEnvelope.ok, true);
    assert.equal(loadMoreEnvelope.page.url, loadMoreUrl);
    assert.equal(loadMoreEnvelope.page.title, "Load More Fixture");
    assert.equal(loadMoreEnvelope.data.recipePath, loadMoreRecipePath);
    assert.equal(loadMoreEnvelope.data.stats.itemCount, 3);
    assert.deepEqual(loadMoreEnvelope.data.items, [
      { title: "Alpha Title", url: `${baseUrl}/posts/alpha` },
      { title: "Beta Title", url: `${baseUrl}/posts/beta` },
      { title: "Gamma Title", url: `${baseUrl}/posts/gamma` },
    ]);
    assert.deepEqual(loadMoreEnvelope.data.document, {
      blocks: [
        {
          kind: "heading",
          text: "Alpha Title",
          level: 2,
          sectionPath: ["Alpha Title"],
        },
        {
          kind: "link",
          text: "Alpha Title",
          url: `${baseUrl}/posts/alpha`,
          sectionPath: ["Alpha Title"],
        },
        {
          kind: "paragraph",
          text: "Alpha Summary",
          sectionPath: ["Alpha Title"],
        },
        {
          ...imageEntry(`${baseUrl}/media/alpha.png`, ["Alpha Title"]),
        },
        {
          kind: "heading",
          text: "Beta Title",
          level: 2,
          sectionPath: ["Beta Title"],
        },
        {
          kind: "link",
          text: "Beta Title",
          url: `${baseUrl}/posts/beta`,
          sectionPath: ["Beta Title"],
        },
        {
          kind: "paragraph",
          text: "Beta Summary",
          sectionPath: ["Beta Title"],
        },
        {
          ...imageEntry(`${baseUrl}/media/beta.png`, ["Beta Title"]),
        },
        {
          kind: "heading",
          text: "Gamma Title",
          level: 2,
          sectionPath: ["Gamma Title"],
        },
        {
          kind: "link",
          text: "Gamma Title",
          url: `${baseUrl}/posts/gamma`,
          sectionPath: ["Gamma Title"],
        },
        {
          kind: "paragraph",
          text: "Gamma Summary",
          sectionPath: ["Gamma Title"],
        },
        {
          ...imageEntry(`${baseUrl}/media/gamma.png`, ["Gamma Title"]),
        },
      ],
      media: [
        imageEntry(`${baseUrl}/media/alpha.png`, ["Alpha Title"]),
        imageEntry(`${baseUrl}/media/beta.png`, ["Beta Title"]),
        imageEntry(`${baseUrl}/media/gamma.png`, ["Gamma Title"]),
      ],
    });
    assert.deepEqual(loadMoreEnvelope.data.stats, {
      kind: "list",
      itemCount: 3,
      fieldCount: 2,
      limit: 3,
      pageCount: 2,
      paginationMode: "load-more",
      maxPages: 2,
      dedupedBlockCount: 0,
    });
    assert.equal(loadMoreEnvelope.data.artifactPath, loadMoreOutFile);

    const writtenLoadMoreArtifact = JSON.parse(
      await readFile(loadMoreOutFile, "utf8"),
    ) as ExtractArtifact;
    assert.deepEqual(writtenLoadMoreArtifact.items, loadMoreEnvelope.data.items);
    assert.deepEqual(writtenLoadMoreArtifact.document, loadMoreEnvelope.data.document);
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
        artifactFormat?: string;
        recipePath: string;
        artifactPath?: string;
        items: Array<{ title: string; url: string }>;
        document: ExtractDocument;
      };
    };
    assert.equal(loadMoreMarkdownEnvelope.ok, true);
    assert.equal(loadMoreMarkdownEnvelope.data.artifactFormat, "markdown");
    assert.equal(loadMoreMarkdownEnvelope.data.recipePath, loadMoreMarkdownRecipePath);
    assert.equal(loadMoreMarkdownEnvelope.data.artifactPath, loadMoreMarkdownOutFile);
    assert.deepEqual(loadMoreMarkdownEnvelope.data.document, loadMoreEnvelope.data.document);
    assert.equal(
      await readFile(loadMoreMarkdownOutFile, "utf8"),
      [
        "| title | url |",
        "| --- | --- |",
        `| Alpha Title | ${baseUrl}/posts/alpha |`,
        `| Beta Title | ${baseUrl}/posts/beta |`,
        `| Gamma Title | ${baseUrl}/posts/gamma |`,
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
    assert.equal(
      createScroll.code,
      0,
      `scroll session create failed: ${JSON.stringify(createScroll)}`,
    );
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
        items: Array<{ title: string; url: string }>;
        document: ExtractDocument;
        stats: ExtractStats;
      };
    };
    assert.equal(scrollEnvelope.ok, true);
    assert.equal(scrollEnvelope.page.url, scrollUrl);
    assert.equal(scrollEnvelope.page.title, "Scroll Fixture");
    assert.equal(scrollEnvelope.data.recipePath, scrollRecipePath);
    assert.equal(scrollEnvelope.data.stats.itemCount, 3);
    assert.deepEqual(scrollEnvelope.data.items, [
      { title: "Scroll Alpha", url: `${baseUrl}/posts/scroll-alpha` },
      { title: "Scroll Beta", url: `${baseUrl}/posts/scroll-beta` },
      { title: "Scroll Gamma", url: `${baseUrl}/posts/scroll-gamma` },
    ]);
    assert.deepEqual(scrollEnvelope.data.document, {
      blocks: [
        {
          kind: "heading",
          text: "Scroll Alpha",
          level: 2,
          sectionPath: ["Scroll Alpha"],
        },
        {
          kind: "link",
          text: "Scroll Alpha",
          url: `${baseUrl}/posts/scroll-alpha`,
          sectionPath: ["Scroll Alpha"],
        },
        {
          kind: "paragraph",
          text: "Scroll Alpha Summary",
          sectionPath: ["Scroll Alpha"],
        },
        {
          ...imageEntry(`${baseUrl}/media/scroll-alpha.png`, ["Scroll Alpha"]),
        },
        {
          kind: "heading",
          text: "Scroll Beta",
          level: 2,
          sectionPath: ["Scroll Beta"],
        },
        {
          kind: "link",
          text: "Scroll Beta",
          url: `${baseUrl}/posts/scroll-beta`,
          sectionPath: ["Scroll Beta"],
        },
        {
          kind: "paragraph",
          text: "Scroll Beta Summary",
          sectionPath: ["Scroll Beta"],
        },
        {
          ...imageEntry(`${baseUrl}/media/scroll-beta.png`, ["Scroll Beta"]),
        },
        {
          kind: "heading",
          text: "Scroll Gamma",
          level: 2,
          sectionPath: ["Scroll Gamma"],
        },
        {
          kind: "link",
          text: "Scroll Gamma",
          url: `${baseUrl}/posts/scroll-gamma`,
          sectionPath: ["Scroll Gamma"],
        },
        {
          kind: "paragraph",
          text: "Scroll Gamma Summary",
          sectionPath: ["Scroll Gamma"],
        },
        {
          ...imageEntry(`${baseUrl}/media/scroll-gamma.png`, ["Scroll Gamma"]),
        },
      ],
      media: [
        imageEntry(`${baseUrl}/media/scroll-alpha.png`, ["Scroll Alpha"]),
        imageEntry(`${baseUrl}/media/scroll-beta.png`, ["Scroll Beta"]),
        imageEntry(`${baseUrl}/media/scroll-gamma.png`, ["Scroll Gamma"]),
      ],
    });
    assert.deepEqual(scrollEnvelope.data.stats, {
      kind: "list",
      itemCount: 3,
      fieldCount: 2,
      limit: 3,
      scrollMode: "until-stable",
      scrollSteps: 1,
      scrollStepsUsed: 1,
      maxScrollSteps: 4,
      dedupedBlockCount: 0,
    });
    assert.equal(scrollEnvelope.data.artifactPath, scrollOutFile);

    const writtenScrollArtifact = JSON.parse(
      await readFile(scrollOutFile, "utf8"),
    ) as ExtractArtifact;
    assert.deepEqual(writtenScrollArtifact.items, scrollEnvelope.data.items);
    assert.deepEqual(writtenScrollArtifact.document, scrollEnvelope.data.document);
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
