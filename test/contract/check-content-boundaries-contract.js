import { runPw } from "./_helpers.js";

const session = `bound${Date.now().toString(36).slice(-5)}`;

try {
  const create = await runPw(
    ["session", "create", session, "--headless", "--open", "about:blank", "--output", "json"],
    { env: { ...process.env, PWCLI_CONTENT_BOUNDARIES: "1" } },
  );
  if (create.code !== 0) throw new Error(`session create failed: ${create.stderr}`);

  const seed = await runPw(
    [
      "code",
      `async page => { await page.setContent('<main><h1>Boundary Title</h1><p>boundary text</p></main>'); return { ready: true }; }`,
      "--session",
      session,
      "--output",
      "json",
    ],
    { env: { ...process.env, PWCLI_CONTENT_BOUNDARIES: "1" } },
  );
  if (seed.code !== 0) throw new Error(`seed failed: ${seed.stderr}`);

  const text = await runPw(["read-text", "--session", session], {
    env: { ...process.env, PWCLI_CONTENT_BOUNDARIES: "1" },
  });
  if (text.code !== 0) throw new Error(`read-text failed: ${text.stderr}`);
  if (!text.stdout.includes("--- PWCLI_PAGE_CONTENT nonce=")) {
    throw new Error(`missing text boundary start\n${text.stdout}`);
  }
  if (!text.stdout.includes("--- END_PWCLI_PAGE_CONTENT nonce=")) {
    throw new Error(`missing text boundary end\n${text.stdout}`);
  }

  const json = await runPw(["read-text", "--session", session, "--output", "json"], {
    env: { ...process.env, PWCLI_CONTENT_BOUNDARIES: "1" },
  });
  if (json.code !== 0) throw new Error(`read-text json failed: ${json.stderr}`);
  const payload = JSON.parse(json.stdout);
  if (payload.ok !== true || typeof payload._boundary?.nonce !== "string") {
    throw new Error(`missing json boundary metadata\n${json.stdout}`);
  }
} finally {
  await runPw(["session", "close", session, "--output", "json"], {
    env: { ...process.env, PWCLI_CONTENT_BOUNDARIES: "1" },
  }).catch(() => undefined);
}
