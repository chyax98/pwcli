import assert from "node:assert/strict";
import { createWorkspace, removeWorkspace, runPw, uniqueSessionName } from "./_helpers.ts";

const workspaceDir = await createWorkspace("pwcli-extract-");
const sessionName = uniqueSessionName("extract");

try {
  const create = await runPw(
    ["session", "create", sessionName, "--headless", "--open", "about:blank", "--output", "json"],
    { cwd: workspaceDir },
  );
  assert.equal(create.code, 0, `session create failed: ${create.stderr}`);

  const seed = await runPw(
    [
      "code",
      `async page => {
        await page.setContent(\`
          <main>
            <article class="card">
              <h2>Alpha</h2>
              <a href="/alpha">Open Alpha</a>
            </article>
            <article class="card">
              <h2>Beta</h2>
              <a href="/beta">Open Beta</a>
            </article>
          </main>
        \`);
        return { ready: true };
      }`,
      "--session",
      sessionName,
      "--output",
      "json",
    ],
    { cwd: workspaceDir },
  );
  assert.equal(seed.code, 0, `seed failed: ${seed.stderr}`);

  const schema =
    '{"multiple":true,"fields":[{"key":"title","selector":"h2"},{"key":"href","selector":"a","type":"attr","attr":"href"}]}';
  const extract = await runPw(
    ["extract", "--session", sessionName, "--selector", ".card", schema, "--output", "json"],
    { cwd: workspaceDir },
  );
  assert.equal(extract.code, 0, `extract failed: ${extract.stderr}`);
  const payload = extract.json as {
    ok: boolean;
    data: {
      multiple: boolean;
      count: number;
      items: Array<{ title: string; href: string }>;
    };
  };
  assert.equal(payload.ok, true);
  assert.equal(payload.data.multiple, true);
  assert.equal(payload.data.count, 2);
  assert.deepEqual(payload.data.items, [
    { title: "Alpha", href: "/alpha" },
    { title: "Beta", href: "/beta" },
  ]);
} finally {
  await runPw(["session", "close", sessionName, "--output", "json"], {
    cwd: workspaceDir,
  }).catch(() => undefined);
  await removeWorkspace(workspaceDir);
}
