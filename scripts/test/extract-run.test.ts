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

const repoRoot = resolve(import.meta.dirname, "..", "..");
const cliPath = resolve(repoRoot, "dist", "cli.js");
const workspaceDir = await mkdtemp(join(tmpdir(), "pwcli-extract-run-"));
const sessionName = `extract${Date.now().toString(36).slice(-5)}`;

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

const server = createServer((request, response) => {
  if (request.url === "/list") {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(`<!doctype html>
      <html lang="en">
        <head>
          <title>Extraction Fixture List</title>
          <script>
            window.__PWCLI_RUNTIME__ = {
              source: "fixture",
              topics: ["agents", "playwright"],
              meta: { ready: true, visibleCount: 2 }
            };
          </script>
        </head>
        <body>
          <main>
            <section data-testid="feed">
              <article class="post-card">
                <h2><a href="/posts/alpha">Alpha Title</a></h2>
                <p class="summary">Alpha Summary</p>
              </article>
              <article class="post-card">
                <h2><a href="/posts/beta">Beta Title</a></h2>
                <p class="summary">Beta Summary</p>
              </article>
              <article class="post-card" style="display:none">
                <h2><a href="/posts/hidden">Hidden Title</a></h2>
                <p class="summary">Hidden Summary</p>
              </article>
            </section>
          </main>
        </body>
      </html>`);
    return;
  }

  if (request.url === "/article") {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(`<!doctype html>
      <html lang="en">
        <head><title>Extraction Fixture Article</title></head>
        <body>
          <main>
            <article data-kind="doc">
              <h1>Article Marker</h1>
              <p class="lede">Visible body marker paragraph.</p>
              <a class="canonical" href="/docs/article-marker">Read more</a>
            </article>
          </main>
        </body>
      </html>`);
    return;
  }

  response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
  response.end("not found");
});

await new Promise<void>((resolveStart) => {
  server.listen(0, "127.0.0.1", () => resolveStart());
});

const address = server.address();
if (!address || typeof address === "string") {
  throw new Error("failed to bind fixture server");
}
const baseUrl = `http://127.0.0.1:${address.port}`;
const listUrl = `${baseUrl}/list`;
const articleUrl = `${baseUrl}/article`;
const recipeDir = resolve(workspaceDir, "recipes");
const outFile = resolve(workspaceDir, "artifacts", "list.json");
const listRecipePath = resolve(recipeDir, "list.json");
const articleRecipePath = resolve(recipeDir, "article.json");

await mkdir(recipeDir, { recursive: true });

await writeFile(
  listRecipePath,
  JSON.stringify(
    {
      kind: "list",
      itemSelector: ".post-card",
      fields: {
        title: "h2 a",
        url: { selector: "h2 a", attr: "href" },
        summary: ".summary",
      },
      runtimeGlobal: "__PWCLI_RUNTIME__",
    },
    null,
    2,
  ),
  "utf8",
);
await mkdir(resolve(workspaceDir, "artifacts"), { recursive: true });

await writeFile(
  articleRecipePath,
  JSON.stringify(
    {
      kind: "article",
      containerSelector: "article[data-kind='doc']",
      fields: {
        title: "h1",
        body: ".lede",
        url: { selector: "a.canonical", attr: "href" },
      },
    },
    null,
    2,
  ),
  "utf8",
);

try {
  const createResult = await runPw([
    "session",
    "create",
    sessionName,
    "--headless",
    "--open",
    listUrl,
    "--output",
    "json",
  ]);
  assert.equal(createResult.code, 0, `session create failed: ${JSON.stringify(createResult)}`);

  const listExtract = await runPw([
    "extract",
    "run",
    "--session",
    sessionName,
    "--recipe",
    listRecipePath,
    "--out",
    outFile,
    "--output",
    "json",
  ]);
  assert.equal(listExtract.code, 0, `extract run list failed: ${JSON.stringify(listExtract)}`);
  const listEnvelope = listExtract.json as {
    ok: boolean;
    page: { url: string; title: string };
    data: {
      format: string;
      recordCount: number;
      records: Array<{ title: string; url: string; summary: string }>;
      artifactPath?: string;
      runtimeProbe?: {
        path: string;
        found: boolean;
        value: {
          source: string;
          topics: string[];
          meta: { ready: boolean; visibleCount: number };
        };
      };
    };
  };
  assert.equal(listEnvelope.ok, true);
  assert.equal(listEnvelope.page.url, listUrl);
  assert.equal(listEnvelope.page.title, "Extraction Fixture List");
  assert.equal(listEnvelope.data.format, "json");
  assert.equal(listEnvelope.data.recordCount, 2);
  assert.deepEqual(listEnvelope.data.records, [
    { title: "Alpha Title", url: `${baseUrl}/posts/alpha`, summary: "Alpha Summary" },
    { title: "Beta Title", url: `${baseUrl}/posts/beta`, summary: "Beta Summary" },
  ]);
  assert.equal(listEnvelope.data.runtimeProbe?.path, "__PWCLI_RUNTIME__");
  assert.equal(listEnvelope.data.runtimeProbe?.found, true);
  assert.deepEqual(listEnvelope.data.runtimeProbe?.value, {
    source: "fixture",
    topics: ["agents", "playwright"],
    meta: { ready: true, visibleCount: 2 },
  });
  assert.equal(listEnvelope.data.artifactPath, outFile);

  const writtenArtifact = JSON.parse(await readFile(outFile, "utf8")) as {
    recordCount: number;
    runtimeProbe?: { path: string; found: boolean };
  };
  assert.equal(writtenArtifact.recordCount, 2);
  assert.equal(writtenArtifact.runtimeProbe?.path, "__PWCLI_RUNTIME__");
  assert.equal(writtenArtifact.runtimeProbe?.found, true);

  const openArticle = await runPw(["open", articleUrl, "--session", sessionName, "--output", "json"]);
  assert.equal(openArticle.code, 0, `open article failed: ${JSON.stringify(openArticle)}`);

  const articleExtract = await runPw([
    "extract",
    "run",
    "--session",
    sessionName,
    "--recipe",
    articleRecipePath,
    "--output",
    "json",
  ]);
  assert.equal(articleExtract.code, 0, `extract run article failed: ${JSON.stringify(articleExtract)}`);
  const articleEnvelope = articleExtract.json as {
    ok: boolean;
    page: { url: string; title: string };
    data: {
      recordCount: number;
      records: Array<{ title: string; body: string; url: string }>;
      runtimeProbe?: unknown;
    };
  };
  assert.equal(articleEnvelope.ok, true);
  assert.equal(articleEnvelope.page.url, articleUrl);
  assert.equal(articleEnvelope.page.title, "Extraction Fixture Article");
  assert.equal(articleEnvelope.data.recordCount, 1);
  assert.deepEqual(articleEnvelope.data.records, [
    {
      title: "Article Marker",
      body: "Visible body marker paragraph.",
      url: `${baseUrl}/docs/article-marker`,
    },
  ]);
  assert.equal(articleEnvelope.data.runtimeProbe, undefined);

  const closeResult = await runPw(["session", "close", sessionName, "--output", "json"]);
  assert.equal(closeResult.code, 0, `session close failed: ${JSON.stringify(closeResult)}`);
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
