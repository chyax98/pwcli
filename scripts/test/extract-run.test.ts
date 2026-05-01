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

type ExtractArtifact = {
  recipeId: string;
  url: string;
  generatedAt: string;
  items: Array<Record<string, unknown>>;
  document: {
    blocks: Array<
      | { kind: "heading"; text: string; level: number; sectionPath: string[] }
      | { kind: "paragraph"; text: string; sectionPath: string[] }
      | { kind: "link"; url: string; text?: string; sectionPath: string[] }
      | { kind: "image"; url: string; sectionPath: string[] }
      | { kind: "video"; url: string; sectionPath: string[] }
      | { kind: "list"; ordered: boolean; items: string[]; sectionPath: string[] }
      | { kind: "quote"; text: string; sectionPath: string[] }
      | { kind: "code"; text: string; language?: string; sectionPath: string[] }
      | { kind: "table"; headers: string[]; rows: string[][]; sectionPath: string[] }
    >;
    media: Array<
      | { kind: "image"; url: string; sectionPath: string[] }
      | { kind: "video"; url: string; sectionPath: string[] }
    >;
  };
  stats: {
    kind: "list" | "article";
    itemCount: number;
    fieldCount: number;
    limit: number;
    runtimeProbePath?: string;
    runtimeProbeFound?: boolean;
  };
  runtimeProbe?: {
    path: string;
    found: boolean;
    value?: unknown;
  };
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
const csvOutFile = resolve(workspaceDir, "artifacts", "list.csv");
const listRecipePath = resolve(recipeDir, "list.json");
const articleRecipePath = resolve(recipeDir, "article.json");
const csvRecipePath = resolve(recipeDir, "list-csv.json");

await mkdir(recipeDir, { recursive: true });

await writeFile(
  listRecipePath,
  JSON.stringify(
    {
      kind: "list",
      itemSelector: ".post-card",
      fields: {
        primaryText: "h2 a",
        primaryTarget: { selector: "h2 a", attr: "href" },
        deck: ".summary",
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
        marker: "h1",
        detail: ".lede",
        canonicalTarget: { selector: "a.canonical", attr: "href" },
      },
    },
    null,
    2,
  ),
  "utf8",
);

await writeFile(
  csvRecipePath,
  JSON.stringify(
    {
      kind: "list",
      itemSelector: ".post-card",
      fields: {
        primaryText: "h2 a",
        primaryTarget: { selector: "h2 a", attr: "href" },
        deck: ".summary",
      },
      output: {
        format: "csv",
        columns: ["deck", "primaryText", "primaryTarget"],
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
      recipePath: string;
      recipeId: string;
      url: string;
      generatedAt: string;
      items: Array<{ primaryText: string; primaryTarget: string; deck: string }>;
      document: ExtractArtifact["document"];
      stats: ExtractArtifact["stats"];
      recordCount: number;
      records: Array<{ primaryText: string; primaryTarget: string; deck: string }>;
      artifactPath?: string;
      runtimeProbe?: ExtractArtifact["runtimeProbe"];
      recipe: { kind: string };
    };
  };
  assert.equal(listEnvelope.ok, true);
  assert.equal(listEnvelope.page.url, listUrl);
  assert.equal(listEnvelope.page.title, "Extraction Fixture List");
  assert.equal(listEnvelope.data.format, "json");
  assert.equal(listEnvelope.data.recipePath, listRecipePath);
  assert.match(listEnvelope.data.recipeId, /^extract:list:[0-9a-f]{12}$/);
  assert.equal(listEnvelope.data.recipe.kind, "list");
  assert.equal(listEnvelope.data.url, listUrl);
  assert.equal(Number.isNaN(Date.parse(listEnvelope.data.generatedAt)), false);
  assert.deepEqual(listEnvelope.data.items, [
    {
      primaryText: "Alpha Title",
      primaryTarget: `${baseUrl}/posts/alpha`,
      deck: "Alpha Summary",
    },
    {
      primaryText: "Beta Title",
      primaryTarget: `${baseUrl}/posts/beta`,
      deck: "Beta Summary",
    },
  ]);
  assert.deepEqual(listEnvelope.data.document, {
    blocks: [
      {
        kind: "heading",
        text: "Alpha Title",
        level: 2,
        sectionPath: [],
      },
      {
        kind: "link",
        text: "Alpha Title",
        url: `${baseUrl}/posts/alpha`,
        sectionPath: [],
      },
      {
        kind: "paragraph",
        text: "Alpha Summary",
        sectionPath: [],
      },
      {
        kind: "heading",
        text: "Beta Title",
        level: 2,
        sectionPath: [],
      },
      {
        kind: "link",
        text: "Beta Title",
        url: `${baseUrl}/posts/beta`,
        sectionPath: [],
      },
      {
        kind: "paragraph",
        text: "Beta Summary",
        sectionPath: [],
      },
    ],
    media: [],
  });
  assert.deepEqual(listEnvelope.data.stats, {
    kind: "list",
    itemCount: 2,
    fieldCount: 3,
    limit: 50,
    runtimeProbePath: "__PWCLI_RUNTIME__",
    runtimeProbeFound: true,
  });
  assert.equal(listEnvelope.data.recordCount, 2);
  assert.deepEqual(listEnvelope.data.records, [
    {
      primaryText: "Alpha Title",
      primaryTarget: `${baseUrl}/posts/alpha`,
      deck: "Alpha Summary",
    },
    {
      primaryText: "Beta Title",
      primaryTarget: `${baseUrl}/posts/beta`,
      deck: "Beta Summary",
    },
  ]);
  assert.equal(listEnvelope.data.runtimeProbe?.path, "__PWCLI_RUNTIME__");
  assert.equal(listEnvelope.data.runtimeProbe?.found, true);
  assert.deepEqual(listEnvelope.data.runtimeProbe?.value, {
    source: "fixture",
    topics: ["agents", "playwright"],
    meta: { ready: true, visibleCount: 2 },
  });
  assert.equal(listEnvelope.data.artifactPath, outFile);

  const writtenArtifact = JSON.parse(await readFile(outFile, "utf8")) as ExtractArtifact;
  assert.equal((writtenArtifact as ExtractArtifact & { recipe: { kind: string } }).recipe.kind, "list");
  assert.equal(
    (writtenArtifact as ExtractArtifact & { recordCount: number }).recordCount,
    listEnvelope.data.recordCount,
  );
  assert.deepEqual(
    (writtenArtifact as ExtractArtifact & { records: Array<Record<string, unknown>> }).records,
    listEnvelope.data.records,
  );
  assert.equal(writtenArtifact.recipeId, listEnvelope.data.recipeId);
  assert.equal(writtenArtifact.url, listUrl);
  assert.equal(writtenArtifact.generatedAt, listEnvelope.data.generatedAt);
  assert.deepEqual(writtenArtifact.items, listEnvelope.data.items);
  assert.deepEqual(writtenArtifact.document, listEnvelope.data.document);
  assert.deepEqual(writtenArtifact.stats, listEnvelope.data.stats);
  assert.equal(writtenArtifact.runtimeProbe?.path, "__PWCLI_RUNTIME__");
  assert.equal(writtenArtifact.runtimeProbe?.found, true);

  const csvExtract = await runPw([
    "extract",
    "run",
    "--session",
    sessionName,
    "--recipe",
    csvRecipePath,
    "--out",
    csvOutFile,
    "--output",
    "json",
  ]);
  assert.equal(csvExtract.code, 0, `extract run csv failed: ${JSON.stringify(csvExtract)}`);
  const csvEnvelope = csvExtract.json as {
    ok: boolean;
    page: { url: string; title: string };
    data: {
      format: string;
      artifactFormat?: string;
      recipePath: string;
      artifactPath?: string;
      recordCount: number;
      items: Array<{ primaryText: string; primaryTarget: string; deck: string }>;
      records: Array<{ primaryText: string; primaryTarget: string; deck: string }>;
    };
  };
  assert.equal(csvEnvelope.ok, true);
  assert.equal(csvEnvelope.page.url, listUrl);
  assert.equal(csvEnvelope.page.title, "Extraction Fixture List");
  assert.equal(csvEnvelope.data.format, "json");
  assert.equal(csvEnvelope.data.artifactFormat, "csv");
  assert.equal(csvEnvelope.data.recipePath, csvRecipePath);
  assert.equal(csvEnvelope.data.artifactPath, csvOutFile);
  assert.equal(csvEnvelope.data.recordCount, 2);
  assert.deepEqual(csvEnvelope.data.items, [
    {
      primaryText: "Alpha Title",
      primaryTarget: `${baseUrl}/posts/alpha`,
      deck: "Alpha Summary",
    },
    {
      primaryText: "Beta Title",
      primaryTarget: `${baseUrl}/posts/beta`,
      deck: "Beta Summary",
    },
  ]);
  assert.deepEqual(csvEnvelope.data.records, csvEnvelope.data.items);
  assert.equal(
    await readFile(csvOutFile, "utf8"),
    [
      "deck,primaryText,primaryTarget",
      `Alpha Summary,Alpha Title,${baseUrl}/posts/alpha`,
      `Beta Summary,Beta Title,${baseUrl}/posts/beta`,
      "",
    ].join("\n"),
  );

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
      format: string;
      recipePath: string;
      recipeId: string;
      url: string;
      generatedAt: string;
      items: Array<{ marker: string; detail: string; canonicalTarget: string }>;
      document: ExtractArtifact["document"];
      stats: ExtractArtifact["stats"];
      recordCount: number;
      records: Array<{ marker: string; detail: string; canonicalTarget: string }>;
      runtimeProbe?: unknown;
      recipe: { kind: string };
    };
  };
  assert.equal(articleEnvelope.ok, true);
  assert.equal(articleEnvelope.page.url, articleUrl);
  assert.equal(articleEnvelope.page.title, "Extraction Fixture Article");
  assert.equal(articleEnvelope.data.format, "json");
  assert.equal(articleEnvelope.data.recipePath, articleRecipePath);
  assert.match(articleEnvelope.data.recipeId, /^extract:article:[0-9a-f]{12}$/);
  assert.equal((articleEnvelope.data as typeof articleEnvelope.data & { recipe: { kind: string } }).recipe.kind, "article");
  assert.equal(articleEnvelope.data.url, articleUrl);
  assert.equal(Number.isNaN(Date.parse(articleEnvelope.data.generatedAt)), false);
  assert.deepEqual(articleEnvelope.data.items, [
    {
      marker: "Article Marker",
      detail: "Visible body marker paragraph.",
      canonicalTarget: `${baseUrl}/docs/article-marker`,
    },
  ]);
  assert.deepEqual(articleEnvelope.data.document, {
    blocks: [
      {
        kind: "heading",
        text: "Article Marker",
        level: 1,
        sectionPath: [],
      },
      {
        kind: "paragraph",
        text: "Visible body marker paragraph.",
        sectionPath: [],
      },
      {
        kind: "link",
        url: `${baseUrl}/docs/article-marker`,
        text: "Read more",
        sectionPath: [],
      },
    ],
    media: [],
  });
  assert.deepEqual(articleEnvelope.data.stats, {
    kind: "article",
    itemCount: 1,
    fieldCount: 3,
    limit: 1,
  });
  assert.equal(articleEnvelope.data.recordCount, 1);
  assert.deepEqual(articleEnvelope.data.records, [
    {
      marker: "Article Marker",
      detail: "Visible body marker paragraph.",
      canonicalTarget: `${baseUrl}/docs/article-marker`,
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
