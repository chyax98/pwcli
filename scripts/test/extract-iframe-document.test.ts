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

type ExtractBlock = {
  kind: string;
  text?: string;
  url?: string;
  sectionPath?: string[];
};

type ExtractMedia = {
  kind: string;
  url?: string;
  sectionPath?: string[];
};

const repoRoot = resolve(import.meta.dirname, "..", "..");
const cliPath = resolve(repoRoot, "dist", "cli.js");
const workspaceDir = await mkdtemp(join(tmpdir(), "pwcli-extract-iframe-"));
const recipeDir = resolve(workspaceDir, "recipes");
const sessionName = `ifrm${Date.now().toString(36).slice(-5)}`;

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

const crossOriginServer = createServer((request, response) => {
  if (request.url === "/cross-frame") {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(`<!doctype html>
      <html lang="en">
        <head><title>Cross Origin Frame</title></head>
        <body>
          <article>
            <h2>Cross Origin Title</h2>
            <p>Cross-origin marker</p>
          </article>
        </body>
      </html>`);
    return;
  }

  response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
  response.end("not found");
});

await new Promise<void>((resolveStart) => {
  crossOriginServer.listen(0, "127.0.0.1", () => resolveStart());
});

const crossOriginAddress = crossOriginServer.address();
if (!crossOriginAddress || typeof crossOriginAddress === "string") {
  throw new Error("failed to bind cross-origin fixture server");
}

const crossOriginBaseUrl = `http://127.0.0.1:${crossOriginAddress.port}`;

const mainServer = createServer((request, response) => {
  if (request.url === "/same-frame") {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(`<!doctype html>
      <html lang="en">
        <head><title>Same Origin Frame</title></head>
        <body>
          <section class="embed-body">
            <h3>Iframe Section</h3>
            <p>Iframe body marker</p>
            <img src="/media/iframe.png" alt="Iframe image" />
          </section>
        </body>
      </html>`);
    return;
  }

  if (request.url === "/media/iframe.png") {
    response.writeHead(200, { "content-type": "image/png" });
    response.end("not-a-real-png");
    return;
  }

  if (request.url === "/article") {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(`<!doctype html>
      <html lang="en">
        <head><title>Iframe Document Article</title></head>
        <body>
          <main>
            <article data-kind="doc">
              <section class="content">
                <h1>Host Title</h1>
                <p class="lede">Host paragraph.</p>
                <section class="embeds">
                  <h2>Embedded Content</h2>
                  <iframe src="/same-frame" title="same-origin-frame"></iframe>
                  <iframe src="${crossOriginBaseUrl}/cross-frame" title="cross-origin-frame"></iframe>
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
  mainServer.listen(0, "127.0.0.1", () => resolveStart());
});

const mainAddress = mainServer.address();
if (!mainAddress || typeof mainAddress === "string") {
  throw new Error("failed to bind main fixture server");
}

const baseUrl = `http://127.0.0.1:${mainAddress.port}`;
const articleUrl = `${baseUrl}/article`;
const recipePath = resolve(recipeDir, "iframe-article.json");

await mkdir(recipeDir, { recursive: true });
await writeFile(
  recipePath,
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
    recipePath,
    "--output",
    "json",
  ]);
  assert.equal(extractResult.code, 0, `extract run failed: ${JSON.stringify(extractResult)}`);

  const envelope = extractResult.json as {
    ok: boolean;
    data: {
      limitation?: string;
      limitations?: string[];
      document: {
        blocks: ExtractBlock[];
        media: ExtractMedia[];
      };
    };
  };
  assert.equal(envelope.ok, true);

  assert.equal(envelope.data.limitations?.includes("cross-origin iframe content is not extracted"), true);
  assert.equal(envelope.data.limitation?.includes("cross-origin iframe content is not extracted"), true);

  const iframeParagraph = envelope.data.document.blocks.find(
    (block) => block.kind === "paragraph" && block.text === "Iframe body marker",
  );
  assert.deepEqual(iframeParagraph, {
    kind: "paragraph",
    text: "Iframe body marker",
    sectionPath: ["Host Title", "Embedded Content"],
  });

  const iframeImage = envelope.data.document.blocks.find(
    (block) => block.kind === "image" && block.url === `${baseUrl}/media/iframe.png`,
  );
  assert.deepEqual(iframeImage, {
    kind: "image",
    url: `${baseUrl}/media/iframe.png`,
    currentSrc: `${baseUrl}/media/iframe.png`,
    sectionPath: ["Host Title", "Embedded Content"],
  });

  assert.deepEqual(
    envelope.data.document.media.find(
      (entry) => entry.kind === "image" && entry.url === `${baseUrl}/media/iframe.png`,
    ),
    {
      kind: "image",
      url: `${baseUrl}/media/iframe.png`,
      currentSrc: `${baseUrl}/media/iframe.png`,
      sectionPath: ["Host Title", "Embedded Content"],
    },
  );

  assert.equal(
    envelope.data.document.blocks.some((block) => block.text === "Cross-origin marker"),
    false,
  );

  const closeResult = await runPw(["session", "close", sessionName, "--output", "json"]);
  assert.equal(closeResult.code, 0, `session close failed: ${JSON.stringify(closeResult)}`);
} finally {
  mainServer.closeAllConnections();
  crossOriginServer.closeAllConnections();
  await new Promise<void>((resolveClose, reject) => {
    mainServer.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolveClose();
    });
  });
  await new Promise<void>((resolveClose, reject) => {
    crossOriginServer.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolveClose();
    });
  });
  await rm(workspaceDir, { recursive: true, force: true });
}
