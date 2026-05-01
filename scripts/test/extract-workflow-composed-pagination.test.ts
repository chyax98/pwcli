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
  scrollSteps?: number;
  maxPages?: number;
  maxScrollSteps?: number;
  dedupedBlockCount: number;
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
const workspaceDir = await mkdtemp(join(tmpdir(), "pwcli-extract-composed-"));
const recipeDir = resolve(workspaceDir, "recipes");
const artifactDir = resolve(workspaceDir, "artifacts");
const sessionName = `cmp${Date.now().toString(36).slice(-6)}`;

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
  if (request.url !== "/composed") {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("not found");
    return;
  }

  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(`<!doctype html>
    <html lang="en">
      <head>
        <title>Composed Extraction Fixture</title>
        <style>
          body { font-family: sans-serif; margin: 0; }
          main { padding: 16px; }
          .post-card { margin-bottom: 12px; }
          .spacer { height: 4000px; }
        </style>
      </head>
      <body>
        <main>
          <section data-testid="feed"></section>
          <button class="load-more" type="button">Load more</button>
          <div class="spacer"></div>
        </main>
        <script>
          const feed = document.querySelector('[data-testid="feed"]');
          const button = document.querySelector('button.load-more');
          const spacer = document.querySelector('.spacer');
          const initialBatch = [
            {
              title: "Composed Alpha",
              href: "/posts/composed-alpha",
              summary: "Composed Alpha Summary",
              imageUrl: "/media/composed-alpha.png"
            },
            {
              title: "Composed Beta",
              href: "/posts/composed-beta",
              summary: "Composed Beta Summary",
              imageUrl: "/media/composed-beta.png"
            }
          ];
          const loadMoreBatch = [
            {
              title: "Composed Alpha",
              href: "/posts/composed-alpha",
              summary: "Composed Alpha Summary",
              imageUrl: "/media/composed-alpha.png"
            },
            {
              title: "Composed Beta",
              href: "/posts/composed-beta",
              summary: "Composed Beta Summary",
              imageUrl: "/media/composed-beta.png"
            }
          ];
          const scrollBatch = [
            {
              title: "Composed Gamma",
              href: "/posts/composed-gamma",
              summary: "Composed Gamma Summary",
              imageUrl: "/media/composed-gamma.png"
            },
            {
              title: "Composed Delta",
              href: "/posts/composed-delta",
              summary: "Composed Delta Summary",
              imageUrl: "/media/composed-delta.png"
            }
          ];
          let didLoadMore = false;
          let didScrollAppend = false;
          let pendingScrollAppend = false;
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
          renderBatch(initialBatch);
          button.addEventListener('click', () => {
            if (didLoadMore)
              return;
            didLoadMore = true;
            window.setTimeout(() => {
              renderBatch(loadMoreBatch);
              button.disabled = true;
              button.hidden = true;
            }, 50);
          });
          const maybeAppendOnScroll = () => {
            if (!didLoadMore || didScrollAppend || pendingScrollAppend)
              return;
            if (window.scrollY <= 0)
              return;
            pendingScrollAppend = true;
            window.setTimeout(() => {
              renderBatch(scrollBatch);
              didScrollAppend = true;
              pendingScrollAppend = false;
              spacer.style.height = '180px';
            }, 50);
          };
          window.addEventListener('scroll', maybeAppendOnScroll, { passive: true });
        </script>
      </body>
    </html>`);
});

await mkdir(recipeDir, { recursive: true });
await mkdir(artifactDir, { recursive: true });

try {
  await new Promise<void>((resolveStart) => {
    server.listen(0, "127.0.0.1", () => resolveStart());
  });

  let sessionCreated = false;
  try {
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("failed to bind composed extraction fixture server");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const composedUrl = `${baseUrl}/composed`;
    const outFile = resolve(artifactDir, "composed.json");
    const recipePath = await writeRecipe("composed.json", {
      kind: "list",
      itemSelector: ".post-card",
      fields: {
        title: "h2 a",
        url: { selector: "h2 a", attr: "href" },
      },
      limit: 4,
      pagination: {
        mode: "load-more",
        selector: "button.load-more",
        maxPages: 2,
      },
      scroll: {
        mode: "until-stable",
        stepPx: 1600,
        settleMs: 150,
        maxSteps: 3,
      },
    });

    const createResult = await runPw([
      "session",
      "create",
      sessionName,
      "--headless",
      "--open",
      composedUrl,
      "--output",
      "json",
    ]);
    assert.equal(createResult.code, 0, `composed session create failed: ${JSON.stringify(createResult)}`);
    sessionCreated = true;

    const extractResult = await runPw([
      "extract",
      "run",
      "--session",
      sessionName,
      "--recipe",
      recipePath,
      "--out",
      outFile,
      "--output",
      "json",
    ]);
    assert.equal(extractResult.code, 0, `composed extract failed: ${JSON.stringify(extractResult)}`);

    const envelope = extractResult.json as {
      ok: boolean;
      page: { url: string; title: string };
      data: {
        recipePath: string;
        artifactPath?: string;
        recordCount: number;
        items: Array<{ title: string; url: string }>;
        records: Array<{ title: string; url: string }>;
        document: ExtractDocument;
        stats: ExtractStats;
      };
    };

    assert.equal(envelope.ok, true);
    assert.equal(envelope.page.url, composedUrl);
    assert.equal(envelope.page.title, "Composed Extraction Fixture");
    assert.equal(envelope.data.recipePath, recipePath);
    assert.equal(envelope.data.recordCount, 4);
    assert.deepEqual(envelope.data.items, [
      { title: "Composed Alpha", url: `${baseUrl}/posts/composed-alpha` },
      { title: "Composed Beta", url: `${baseUrl}/posts/composed-beta` },
      { title: "Composed Gamma", url: `${baseUrl}/posts/composed-gamma` },
      { title: "Composed Delta", url: `${baseUrl}/posts/composed-delta` },
    ]);
    assert.deepEqual(envelope.data.records, envelope.data.items);
    assert.deepEqual(envelope.data.document, {
      blocks: [
        {
          kind: "heading",
          text: "Composed Alpha",
          level: 2,
          sectionPath: ["Composed Alpha"],
        },
        {
          kind: "link",
          text: "Composed Alpha",
          url: `${baseUrl}/posts/composed-alpha`,
          sectionPath: ["Composed Alpha"],
        },
        {
          kind: "paragraph",
          text: "Composed Alpha Summary",
          sectionPath: ["Composed Alpha"],
        },
        {
          ...imageEntry(`${baseUrl}/media/composed-alpha.png`, ["Composed Alpha"]),
        },
        {
          kind: "heading",
          text: "Composed Beta",
          level: 2,
          sectionPath: ["Composed Beta"],
        },
        {
          kind: "link",
          text: "Composed Beta",
          url: `${baseUrl}/posts/composed-beta`,
          sectionPath: ["Composed Beta"],
        },
        {
          kind: "paragraph",
          text: "Composed Beta Summary",
          sectionPath: ["Composed Beta"],
        },
        {
          ...imageEntry(`${baseUrl}/media/composed-beta.png`, ["Composed Beta"]),
        },
        {
          kind: "heading",
          text: "Composed Gamma",
          level: 2,
          sectionPath: ["Composed Gamma"],
        },
        {
          kind: "link",
          text: "Composed Gamma",
          url: `${baseUrl}/posts/composed-gamma`,
          sectionPath: ["Composed Gamma"],
        },
        {
          kind: "paragraph",
          text: "Composed Gamma Summary",
          sectionPath: ["Composed Gamma"],
        },
        {
          ...imageEntry(`${baseUrl}/media/composed-gamma.png`, ["Composed Gamma"]),
        },
        {
          kind: "heading",
          text: "Composed Delta",
          level: 2,
          sectionPath: ["Composed Delta"],
        },
        {
          kind: "link",
          text: "Composed Delta",
          url: `${baseUrl}/posts/composed-delta`,
          sectionPath: ["Composed Delta"],
        },
        {
          kind: "paragraph",
          text: "Composed Delta Summary",
          sectionPath: ["Composed Delta"],
        },
        {
          ...imageEntry(`${baseUrl}/media/composed-delta.png`, ["Composed Delta"]),
        },
      ],
      media: [
        imageEntry(`${baseUrl}/media/composed-alpha.png`, ["Composed Alpha"]),
        imageEntry(`${baseUrl}/media/composed-beta.png`, ["Composed Beta"]),
        imageEntry(`${baseUrl}/media/composed-gamma.png`, ["Composed Gamma"]),
        imageEntry(`${baseUrl}/media/composed-delta.png`, ["Composed Delta"]),
      ],
    });
    assert.deepEqual(envelope.data.stats, {
      kind: "list",
      itemCount: 4,
      fieldCount: 2,
      limit: 4,
      pageCount: 3,
      paginationMode: "load-more",
      scrollMode: "until-stable",
      scrollSteps: 1,
      scrollStepsUsed: 1,
      maxPages: 2,
      maxScrollSteps: 3,
      dedupedBlockCount: 0,
    });
    assert.equal(envelope.data.artifactPath, outFile);

    const writtenArtifact = JSON.parse(await readFile(outFile, "utf8")) as ExtractArtifact & {
      recordCount: number;
      records: Array<{ title: string; url: string }>;
    };
    assert.equal(writtenArtifact.recordCount, 4);
    assert.deepEqual(writtenArtifact.items, envelope.data.items);
    assert.deepEqual(writtenArtifact.records, envelope.data.records);
    assert.deepEqual(writtenArtifact.document, envelope.data.document);
    assert.deepEqual(writtenArtifact.stats, envelope.data.stats);
  } finally {
    if (sessionCreated) {
      await runPw(["session", "close", sessionName, "--output", "json"]).catch(() => undefined);
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
