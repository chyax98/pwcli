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

type ErrorEnvelope = {
  ok: false;
  error: {
    code: string;
    message: string;
    suggestions: string[];
  };
};

type ExtractArtifact = {
  recipeId: string;
  url: string;
  generatedAt: string;
  items: Array<Record<string, unknown>>;
  stats: {
    kind: "list" | "article";
    itemCount: number;
    fieldCount: number;
    limit: number;
    pageCount?: number;
    paginationMode?: "next-page" | "load-more";
    runtimeProbePath?: string;
    runtimeProbeFound?: boolean;
  };
};

const repoRoot = resolve(import.meta.dirname, "..", "..");
const cliPath = resolve(repoRoot, "dist", "cli.js");
const workspaceDir = await mkdtemp(join(tmpdir(), "pwcli-extract-pagination-"));
const recipeDir = resolve(workspaceDir, "recipes");
const artifactDir = resolve(workspaceDir, "artifacts");
const sessionName = `paginate${Date.now().toString(36).slice(-5)}`;

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

function assertInvalidRecipe(
  result: CliResult,
  messagePattern: RegExp,
  requiredSuggestionPatterns: RegExp[],
) {
  assert.equal(result.code, 1, `expected extract run to fail: ${JSON.stringify(result)}`);
  const envelope = result.json as ErrorEnvelope;
  assert.equal(envelope.ok, false);
  assert.equal(envelope.error.code, "EXTRACT_RECIPE_INVALID");
  assert.match(envelope.error.message, messagePattern);
  for (const pattern of requiredSuggestionPatterns) {
    assert.ok(
      envelope.error.suggestions.some((suggestion) => pattern.test(suggestion)),
      `expected suggestions to match ${pattern}, got ${JSON.stringify(envelope.error.suggestions)}`,
    );
  }
}

await mkdir(recipeDir, { recursive: true });
await mkdir(artifactDir, { recursive: true });

try {
  const invalidPaginationRecipePath = await writeRecipe("invalid-pagination.json", {
    kind: "list",
    itemSelector: ".post-card",
    fields: { title: "h2 a" },
    pagination: {
      mode: "next-page",
      selector: "a.next",
      maxPages: 0,
    },
  });
  const invalidPagination = await runPw([
    "extract",
    "run",
    "--session",
    "schema-invalid",
    "--recipe",
    invalidPaginationRecipePath,
    "--output",
    "json",
  ]);
  assertInvalidRecipe(invalidPagination, /pagination\.maxPages/i, [
    /pagination\.mode/,
    /output\.format/,
  ]);

  const invalidScrollRecipePath = await writeRecipe("invalid-scroll.json", {
    kind: "list",
    itemSelector: ".post-card",
    fields: { title: "h2 a" },
    scroll: {
      mode: "until-stable",
      stepPx: 0,
      settleMs: 250,
      maxSteps: 5,
    },
  });
  const invalidScroll = await runPw([
    "extract",
    "run",
    "--session",
    "schema-invalid",
    "--recipe",
    invalidScrollRecipePath,
    "--output",
    "json",
  ]);
  assertInvalidRecipe(invalidScroll, /scroll\.stepPx/i, [/scroll\.mode/, /maxSteps/]);

  const invalidOutputRecipePath = await writeRecipe("invalid-output.json", {
    kind: "list",
    itemSelector: ".post-card",
    fields: { title: "h2 a" },
    output: {
      format: "xml",
    },
  });
  const invalidOutput = await runPw([
    "extract",
    "run",
    "--session",
    "schema-invalid",
    "--recipe",
    invalidOutputRecipePath,
    "--output",
    "json",
  ]);
  assertInvalidRecipe(invalidOutput, /output\.format/i, [/output\.format/, /pagination\.mode/]);

  const invalidRuntimeGlobalRecipePath = await writeRecipe("invalid-runtime-global.json", {
    kind: "list",
    itemSelector: ".post-card",
    fields: { title: "h2 a" },
    runtimeGlobal: "__NEXT_DATA__()",
  });
  const invalidRuntimeGlobal = await runPw([
    "extract",
    "run",
    "--session",
    "schema-invalid",
    "--recipe",
    invalidRuntimeGlobalRecipePath,
    "--output",
    "json",
  ]);
  assertInvalidRecipe(invalidRuntimeGlobal, /runtimeGlobal/i, [/runtimeGlobal/, /output\.format/]);

  const server = createServer((request, response) => {
    const pageFixtures: Record<
      string,
      {
        title: string;
        posts: Array<{ title: string; href: string }>;
        nextHref?: string;
      }
    > = {
      "/page/1": {
        title: "Pagination Fixture Page 1",
        posts: [
          { title: "Alpha Title", href: "/posts/alpha" },
          { title: "Beta Title", href: "/posts/beta" },
        ],
        nextHref: "/page/2",
      },
      "/page/2": {
        title: "Pagination Fixture Page 2",
        posts: [
          { title: "Gamma Title", href: "/posts/gamma" },
          { title: "Delta Title", href: "/posts/delta" },
        ],
        nextHref: "/page/3",
      },
      "/page/3": {
        title: "Pagination Fixture Page 3",
        posts: [
          { title: "Epsilon Title", href: "/posts/epsilon" },
        ],
      },
    };

    const fixture = request.url ? pageFixtures[request.url] : undefined;
    if (!fixture) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("not found");
      return;
    }

    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(`<!doctype html>
      <html lang="en">
        <head><title>${fixture.title}</title></head>
        <body>
          <main>
            <section data-testid="feed">
              ${fixture.posts
                .map(
                  (post) => `<article class="post-card">
                <h2><a href="${post.href}">${post.title}</a></h2>
              </article>`,
                )
                .join("")}
            </section>
            ${
              fixture.nextHref
                ? `<nav><a class="next" href="${fixture.nextHref}">Next page</a></nav>`
                : ""
            }
          </main>
        </body>
      </html>`);
  });

  await new Promise<void>((resolveStart) => {
    server.listen(0, "127.0.0.1", () => resolveStart());
  });

  let sessionCreated = false;
  try {
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("failed to bind pagination fixture server");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const startUrl = `${baseUrl}/page/1`;
    const outFile = resolve(artifactDir, "next-page.json");
    const paginatedRecipePath = await writeRecipe("next-page.json", {
      kind: "list",
      itemSelector: ".post-card",
      fields: {
        title: "h2 a",
        url: { selector: "h2 a", attr: "href" },
      },
      limit: 10,
      pagination: {
        mode: "next-page",
        selector: "a.next",
        maxPages: 2,
      },
    });

    const createResult = await runPw([
      "session",
      "create",
      sessionName,
      "--headless",
      "--open",
      startUrl,
      "--output",
      "json",
    ]);
    assert.equal(createResult.code, 0, `session create failed: ${JSON.stringify(createResult)}`);
    sessionCreated = true;

    const paginatedExtract = await runPw([
      "extract",
      "run",
      "--session",
      sessionName,
      "--recipe",
      paginatedRecipePath,
      "--out",
      outFile,
      "--output",
      "json",
    ]);
    assert.equal(
      paginatedExtract.code,
      0,
      `extract run with next-page pagination failed: ${JSON.stringify(paginatedExtract)}`,
    );

    const paginatedEnvelope = paginatedExtract.json as {
      ok: boolean;
      page: { url: string; title: string };
      data: {
        recipePath: string;
        artifactPath?: string;
        recordCount: number;
        items: Array<{ title: string; url: string }>;
        records: Array<{ title: string; url: string }>;
        stats: ExtractArtifact["stats"];
      };
    };
    assert.equal(paginatedEnvelope.ok, true);
    assert.equal(paginatedEnvelope.page.url, `${baseUrl}/page/2`);
    assert.equal(paginatedEnvelope.page.title, "Pagination Fixture Page 2");
    assert.equal(paginatedEnvelope.data.recipePath, paginatedRecipePath);
    assert.equal(paginatedEnvelope.data.recordCount, 4);
    assert.deepEqual(paginatedEnvelope.data.items, [
      { title: "Alpha Title", url: `${baseUrl}/posts/alpha` },
      { title: "Beta Title", url: `${baseUrl}/posts/beta` },
      { title: "Gamma Title", url: `${baseUrl}/posts/gamma` },
      { title: "Delta Title", url: `${baseUrl}/posts/delta` },
    ]);
    assert.deepEqual(paginatedEnvelope.data.records, paginatedEnvelope.data.items);
    assert.deepEqual(paginatedEnvelope.data.stats, {
      kind: "list",
      itemCount: 4,
      fieldCount: 2,
      limit: 10,
      pageCount: 2,
      paginationMode: "next-page",
      maxPages: 2,
    });
    assert.equal(paginatedEnvelope.data.artifactPath, outFile);

    const writtenArtifact = JSON.parse(await readFile(outFile, "utf8")) as ExtractArtifact & {
      recordCount: number;
      records: Array<{ title: string; url: string }>;
    };
    assert.equal(writtenArtifact.recordCount, 4);
    assert.deepEqual(writtenArtifact.records, paginatedEnvelope.data.records);
    assert.deepEqual(writtenArtifact.items, paginatedEnvelope.data.items);
    assert.deepEqual(writtenArtifact.stats, paginatedEnvelope.data.stats);
  } finally {
    if (sessionCreated) {
      await runPw(["session", "close", sessionName, "--output", "json"]).catch(() => undefined);
    }
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
  }
} finally {
  await rm(workspaceDir, { recursive: true, force: true });
}
