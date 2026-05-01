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
    | { kind: "code"; text: string; languageHint?: string; sectionPath: string[] }
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
const workspaceDir = await mkdtemp(join(tmpdir(), "pwcli-extract-media-"));
const recipeDir = resolve(workspaceDir, "recipes");
const sessionName = `media${Date.now().toString(36).slice(-5)}`;

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
  if (request.url === "/article") {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(`<!doctype html>
      <html lang="en">
        <head><title>Document Media Richness</title></head>
        <body>
          <main>
            <article data-kind="doc">
              <h1>Media Richness</h1>
              <figure class="image-figure">
                <img
                  class="hero"
                  src="/media/hero-1x.png"
                  srcset="/media/hero-1x.png 1x, /media/hero-2x.png 2x"
                  alt="Hero image"
                />
                <figcaption>Hero caption.</figcaption>
              </figure>
              <figure class="video-figure">
                <video class="clip" poster="/media/clip-poster.jpg" controls>
                  <source src="/media/clip.mp4" type="video/mp4" />
                </video>
                <figcaption>Clip caption.</figcaption>
              </figure>
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
const articleUrl = `${baseUrl}/article`;
const articleRecipePath = resolve(recipeDir, "article.json");

await mkdir(recipeDir, { recursive: true });

await writeFile(
  articleRecipePath,
  JSON.stringify(
    {
      kind: "article",
      containerSelector: "article[data-kind='doc']",
      fields: {
        marker: "h1",
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
    articleUrl,
    "--output",
    "json",
  ]);
  assert.equal(createResult.code, 0, `session create failed: ${JSON.stringify(createResult)}`);

  const extractResult = await runPw([
    "extract",
    "run",
    "--session",
    sessionName,
    "--recipe",
    articleRecipePath,
    "--output",
    "json",
  ]);
  assert.equal(extractResult.code, 0, `extract run failed: ${JSON.stringify(extractResult)}`);

  const envelope = extractResult.json as {
    ok: boolean;
    data: {
      document: ExtractDocument;
    };
  };
  assert.equal(envelope.ok, true);
  assert.deepEqual(envelope.data.document, {
    blocks: [
      {
        kind: "heading",
        text: "Media Richness",
        level: 1,
        sectionPath: [],
      },
      {
        kind: "image",
        url: `${baseUrl}/media/hero-1x.png`,
        currentSrc: `${baseUrl}/media/hero-1x.png`,
        srcset: "/media/hero-1x.png 1x, /media/hero-2x.png 2x",
        caption: "Hero caption.",
        sectionPath: [],
      },
      {
        kind: "video",
        url: `${baseUrl}/media/clip.mp4`,
        currentSrc: `${baseUrl}/media/clip.mp4`,
        poster: `${baseUrl}/media/clip-poster.jpg`,
        sources: [`${baseUrl}/media/clip.mp4`],
        caption: "Clip caption.",
        sectionPath: [],
      },
    ],
    media: [
      {
        kind: "image",
        url: `${baseUrl}/media/hero-1x.png`,
        currentSrc: `${baseUrl}/media/hero-1x.png`,
        srcset: "/media/hero-1x.png 1x, /media/hero-2x.png 2x",
        caption: "Hero caption.",
        sectionPath: [],
      },
      {
        kind: "video",
        url: `${baseUrl}/media/clip.mp4`,
        currentSrc: `${baseUrl}/media/clip.mp4`,
        poster: `${baseUrl}/media/clip-poster.jpg`,
        sources: [`${baseUrl}/media/clip.mp4`],
        caption: "Clip caption.",
        sectionPath: [],
      },
    ],
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
