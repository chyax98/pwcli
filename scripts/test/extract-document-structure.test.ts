import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

type CliResult = {
  code: number | null;
  stdout: string;
  stderr: string;
  json: unknown;
};

type ExtractDocument = {
  blocks: Array<
    | { kind: "heading"; text: string; level: number; sectionPath: string[] }
    | { kind: "paragraph"; text: string; sectionPath: string[] }
    | { kind: "link"; url: string; text?: string; sectionPath: string[] }
    | {
        kind: "image";
        url: string;
        currentSrc?: string;
        srcset?: string;
        caption?: string;
        sectionPath: string[];
      }
    | {
        kind: "video";
        url: string;
        currentSrc?: string;
        poster?: string;
        sources?: string[];
        caption?: string;
        sectionPath: string[];
      }
    | { kind: "list"; ordered: boolean; items: string[]; sectionPath: string[] }
    | { kind: "quote"; text: string; sectionPath: string[] }
    | { kind: "code"; text: string; language?: string; languageHint?: string; sectionPath: string[] }
    | { kind: "table"; headers: string[]; rows: string[][]; caption?: string; sectionPath: string[] }
  >;
  media: Array<
    | {
        kind: "image";
        url: string;
        currentSrc?: string;
        srcset?: string;
        caption?: string;
        sectionPath: string[];
      }
    | {
        kind: "video";
        url: string;
        currentSrc?: string;
        poster?: string;
        sources?: string[];
        caption?: string;
        sectionPath: string[];
      }
  >;
};

const repoRoot = resolve(import.meta.dirname, "..", "..");
const cliPath = resolve(repoRoot, "dist", "cli.js");
const workspaceDir = await mkdtemp(join(tmpdir(), "pwcli-extract-document-"));
const recipeDir = resolve(workspaceDir, "recipes");
const sessionName = `doc${Date.now().toString(36).slice(-5)}`;

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
        <head><title>Document Structure List</title></head>
        <body>
          <main>
            <article class="post-card">
              <section class="entry">
                <h2><a href="/posts/alpha">Alpha Title</a></h2>
                <p class="summary">Alpha Summary</p>
                <section class="gallery">
                  <h3>Gallery</h3>
                  <figure class="thumb-figure">
                    <img
                      class="thumb"
                      src="/media/alpha-1x.png"
                      srcset="/media/alpha-1x.png 1x, /media/alpha-2x.png 2x"
                      alt="Alpha thumbnail"
                    />
                    <figcaption>Alpha thumbnail caption.</figcaption>
                  </figure>
                  <figure class="clip-figure">
                    <video class="clip" poster="/media/alpha-poster.jpg" controls>
                      <source src="/media/alpha.mp4" type="video/mp4" />
                    </video>
                    <figcaption>Alpha clip caption.</figcaption>
                  </figure>
                </section>
                <section class="details">
                  <h3>Details</h3>
                  <ul class="facts">
                    <li>First point</li>
                    <li>Second point</li>
                  </ul>
                  <blockquote>Quoted line.</blockquote>
                  <pre><code class="language-ts">const answer = 42;</code></pre>
                  <table>
                    <caption>Alpha metrics</caption>
                    <thead>
                      <tr><th>Name</th><th>Value</th></tr>
                    </thead>
                    <tbody>
                      <tr><td>Alpha</td><td>42</td></tr>
                    </tbody>
                  </table>
                </section>
              </section>
            </article>
          </main>
        </body>
      </html>`);
    return;
  }

  if (request.url === "/article") {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(`<!doctype html>
      <html lang="en">
        <head><title>Document Structure Article</title></head>
        <body>
          <main>
            <article data-kind="doc">
              <section class="content">
                <h1>Article Title</h1>
                <p class="lede">Article paragraph.</p>
                <section class="resources">
                  <h2>Resources</h2>
                  <a class="canonical" href="/docs/article-title">Canonical link</a>
                </section>
              </section>
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
        primaryText: "h2 a",
        primaryTarget: { selector: "h2 a", attr: "href" },
        deck: ".summary",
        mediaOne: { selector: "img.thumb", attr: "src" },
        mediaTwo: { selector: "video.clip", attr: "src" },
      },
    },
    null,
    2,
  ),
  "utf8",
);

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
    "--output",
    "json",
  ]);
  assert.equal(listExtract.code, 0, `extract run list failed: ${JSON.stringify(listExtract)}`);
  const listEnvelope = listExtract.json as {
    ok: boolean;
    data: {
      document: ExtractDocument;
    };
  };
  assert.equal(listEnvelope.ok, true);
  assert.deepEqual(listEnvelope.data.document, {
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
        kind: "heading",
        text: "Gallery",
        level: 3,
        sectionPath: ["Alpha Title", "Gallery"],
      },
      {
        kind: "image",
        url: `${baseUrl}/media/alpha-1x.png`,
        currentSrc: `${baseUrl}/media/alpha-1x.png`,
        srcset: "/media/alpha-1x.png 1x, /media/alpha-2x.png 2x",
        caption: "Alpha thumbnail caption.",
        sectionPath: ["Alpha Title", "Gallery"],
      },
      {
        kind: "video",
        url: `${baseUrl}/media/alpha.mp4`,
        currentSrc: `${baseUrl}/media/alpha.mp4`,
        poster: `${baseUrl}/media/alpha-poster.jpg`,
        sources: [`${baseUrl}/media/alpha.mp4`],
        caption: "Alpha clip caption.",
        sectionPath: ["Alpha Title", "Gallery"],
      },
      {
        kind: "heading",
        text: "Details",
        level: 3,
        sectionPath: ["Alpha Title", "Details"],
      },
      {
        kind: "list",
        ordered: false,
        items: ["First point", "Second point"],
        sectionPath: ["Alpha Title", "Details"],
      },
      {
        kind: "quote",
        text: "Quoted line.",
        sectionPath: ["Alpha Title", "Details"],
      },
      {
        kind: "code",
        text: "const answer = 42;",
        language: "ts",
        languageHint: "ts",
        sectionPath: ["Alpha Title", "Details"],
      },
      {
        kind: "table",
        headers: ["Name", "Value"],
        rows: [["Alpha", "42"]],
        caption: "Alpha metrics",
        sectionPath: ["Alpha Title", "Details"],
      },
    ],
    media: [
      {
        kind: "image",
        url: `${baseUrl}/media/alpha-1x.png`,
        currentSrc: `${baseUrl}/media/alpha-1x.png`,
        srcset: "/media/alpha-1x.png 1x, /media/alpha-2x.png 2x",
        caption: "Alpha thumbnail caption.",
        sectionPath: ["Alpha Title", "Gallery"],
      },
      {
        kind: "video",
        url: `${baseUrl}/media/alpha.mp4`,
        currentSrc: `${baseUrl}/media/alpha.mp4`,
        poster: `${baseUrl}/media/alpha-poster.jpg`,
        sources: [`${baseUrl}/media/alpha.mp4`],
        caption: "Alpha clip caption.",
        sectionPath: ["Alpha Title", "Gallery"],
      },
    ],
  });

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
    data: {
      document: ExtractDocument;
    };
  };
  assert.equal(articleEnvelope.ok, true);
  assert.deepEqual(articleEnvelope.data.document, {
    blocks: [
      {
        kind: "heading",
        text: "Article Title",
        level: 1,
        sectionPath: ["Article Title"],
      },
      {
        kind: "paragraph",
        text: "Article paragraph.",
        sectionPath: ["Article Title"],
      },
      {
        kind: "heading",
        text: "Resources",
        level: 2,
        sectionPath: ["Article Title", "Resources"],
      },
      {
        kind: "link",
        url: `${baseUrl}/docs/article-title`,
        text: "Canonical link",
        sectionPath: ["Article Title", "Resources"],
      },
    ],
    media: [],
  });

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
