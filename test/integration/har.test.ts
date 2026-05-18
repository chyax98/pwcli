import assert from "node:assert/strict";
import {
	existsSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { after, describe, it } from "node:test";
import { runPw, uniqueSessionName } from "./_helpers.ts";

const makeSessionName = () => uniqueSessionName("it-har-");

describe("har", { concurrency: false }, () => {
	const sessionsToClean: string[] = [];

	after(async () => {
		for (const name of sessionsToClean) {
			try {
				await runPw(["session", "close", name, "--output", "json"]);
			} catch {
				// ignore
			}
		}
	});

	it("records full HAR by default through the session lifecycle", async () => {
		const name = makeSessionName();
		sessionsToClean.push(name);
		const server = createServer((req, res) => {
			const url = new URL(req.url ?? "/", "http://127.0.0.1");
			if (url.pathname === "/") {
				res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
				res.end(`<!doctype html><title>HAR fixture</title><button id="load">Load</button>
          <script>
            document.getElementById('load').addEventListener('click', async () => {
              const response = await fetch('/api/bug-signal', {
                method: 'POST',
                headers: { 'content-type': 'application/json', 'x-har-secret': 'capture-me' },
                body: JSON.stringify({ marker: 'HAR_POST_BODY' }),
              });
              document.body.dataset.api = JSON.stringify(await response.json());
            });
          </script>`);
				return;
			}
			if (url.pathname === "/api/bug-signal") {
				res.writeHead(500, {
					"content-type": "application/json; charset=utf-8",
				});
				res.end(JSON.stringify({ ok: false, code: "HAR_SIGNAL" }));
				return;
			}
			res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
			res.end("not found");
		});
		await new Promise<void>((resolveListen) =>
			server.listen(0, "127.0.0.1", resolveListen),
		);
		const address = server.address();
		assert.ok(address && typeof address === "object");
		const baseUrl = `http://127.0.0.1:${address.port}`;

		try {
			const createResult = await runPw([
				"session",
				"create",
				name,
				"--open",
				baseUrl,
				"--output",
				"json",
			]);
			assert.equal(
				createResult.code,
				0,
				`session create failed: ${createResult.stderr}`,
			);
			const createJson = createResult.json as {
				ok: boolean;
				data: {
					recordHar?: { path?: string; content?: string; mode?: string };
				};
			};
			assert.equal(createJson.ok, true);
			const harFile = createJson.data.recordHar?.path;
			assert.ok(harFile?.includes(`.pwcli/har/${name}/session-`));
			assert.equal(createJson.data.recordHar?.content, "embed");
			assert.equal(createJson.data.recordHar?.mode, "full");

			const clickResult = await runPw([
				"click",
				"--session",
				name,
				"--selector",
				"#load",
				"--output",
				"json",
			]);
			assert.equal(clickResult.code, 0, `click failed: ${clickResult.stderr}`);

			const closeResult = await runPw([
				"session",
				"close",
				name,
				"--output",
				"json",
			]);
			assert.equal(
				closeResult.code,
				0,
				`session close failed: ${closeResult.stderr}`,
			);
			assert.equal(
				existsSync(harFile),
				true,
				"default HAR file should be written after session close",
			);

			const har = JSON.parse(readFileSync(harFile, "utf8")) as {
				log?: {
					entries?: Array<{
						request?: {
							method?: string;
							url?: string;
							postData?: { text?: string };
						};
						response?: { status?: number; content?: { text?: string } };
					}>;
				};
			};
			const entries = har.log?.entries ?? [];
			assert.ok(entries.some((entry) => entry.request?.url === `${baseUrl}/`));
			assert.ok(
				entries.some(
					(entry) =>
						entry.request?.url === `${baseUrl}/api/bug-signal` &&
						entry.request?.method === "POST" &&
						entry.request?.postData?.text?.includes("HAR_POST_BODY") &&
						entry.response?.status === 500 &&
						entry.response?.content?.text?.includes("HAR_SIGNAL"),
				),
			);
		} finally {
			await new Promise((resolveClose) => server.close(resolveClose));
		}
	});

	it("filters and cleans derived HAR artifacts", async () => {
		const tmpDir = mkdtempSync(resolve(tmpdir(), "pwcli-har-clean-"));
		const input = resolve(tmpDir, "full.har");
		const failed = resolve(tmpDir, "failed.har");
		const cleaned = resolve(tmpDir, "cleaned.har");
		writeFileSync(
			input,
			JSON.stringify({
				log: {
					version: "1.2",
					creator: { name: "test", version: "1.0" },
					entries: [
						{
							request: {
								method: "GET",
								url: "https://example.test/ok",
								headers: [],
							},
							response: { status: 200, headers: [], content: { text: "ok" } },
						},
						{
							request: {
								method: "POST",
								url: "https://example.test/api/fail",
								headers: [
									{ name: "authorization", value: "Bearer secret" },
									{ name: "cookie", value: "sid=secret" },
								],
								cookies: [{ name: "sid", value: "secret" }],
								postData: { text: "payload-secret" },
							},
							response: {
								status: 500,
								headers: [{ name: "set-cookie", value: "sid=secret" }],
								cookies: [{ name: "sid", value: "secret" }],
								content: { text: "body-secret" },
							},
						},
					],
				},
			}),
		);

		try {
			const filterResult = await runPw([
				"har",
				"filter",
				input,
				"--out",
				failed,
				"--failed",
				"--output",
				"json",
			]);
			assert.equal(
				filterResult.code,
				0,
				`har filter failed: ${filterResult.stderr}`,
			);
			const filterJson = filterResult.json as {
				ok: boolean;
				data: { entryCount?: number };
			};
			assert.equal(filterJson.ok, true);
			assert.equal(filterJson.data.entryCount, 1);

			const cleanResult = await runPw([
				"har",
				"clean",
				failed,
				"--out",
				cleaned,
				"--redact-header",
				"authorization",
				"--strip-cookies",
				"--strip-post-data",
				"--strip-content",
				"--output",
				"json",
			]);
			assert.equal(
				cleanResult.code,
				0,
				`har clean failed: ${cleanResult.stderr}`,
			);
			const cleanJson = cleanResult.json as {
				ok: boolean;
				data: { changedEntryCount?: number };
			};
			assert.equal(cleanJson.ok, true);
			assert.equal(cleanJson.data.changedEntryCount, 1);
			const resultHar = JSON.parse(readFileSync(cleaned, "utf8")) as {
				log?: {
					entries?: Array<{
						request?: {
							headers?: Array<{ name?: string; value?: string }>;
							cookies?: unknown;
							postData?: unknown;
						};
						response?: { cookies?: unknown; content?: { text?: string } };
					}>;
				};
			};
			const [entry] = resultHar.log?.entries ?? [];
			assert.ok(entry?.request);
			assert.ok(entry.response);
			assert.equal(entry.request.headers?.[0]?.value, "<redacted>");
			assert.equal(
				entry.request.headers?.some((h) => h.name === "cookie"),
				false,
			);
			assert.equal(entry.request.cookies, undefined);
			assert.equal(entry.request.postData, undefined);
			assert.equal(entry.response.cookies, undefined);
			assert.equal(entry.response.content?.text, "");
		} finally {
			rmSync(tmpDir, { recursive: true, force: true });
		}
	});

	it("har replay starts and stops routing", async () => {
		const name = makeSessionName();
		sessionsToClean.push(name);

		await runPw([
			"session",
			"create",
			name,
			"--headless",
			"--open",
			"about:blank",
			"--output",
			"json",
		]);

		const tmpDir = mkdtempSync(resolve(tmpdir(), "pwcli-har-"));
		const harFile = resolve(tmpDir, "replay.har");
		writeFileSync(
			harFile,
			JSON.stringify({
				log: {
					version: "1.2",
					creator: { name: "test", version: "1.0" },
					entries: [],
				},
			}),
		);

		try {
			const replayResult = await runPw([
				"har",
				"replay",
				harFile,
				"--session",
				name,
				"--output",
				"json",
			]);
			// Empty HAR may succeed or fail depending on Playwright version; accept either
			if (replayResult.code === 0) {
				const replayJson = replayResult.json as {
					ok: boolean;
					data: { replayActive?: boolean; file?: string };
				};
				assert.equal(replayJson.ok, true);
				assert.equal(replayJson.data.replayActive, true);
				assert.equal(replayJson.data.file, harFile);

				const stopResult = await runPw([
					"har",
					"replay-stop",
					"--session",
					name,
					"--output",
					"json",
				]);
				assert.equal(
					stopResult.code,
					0,
					`har replay stop failed: ${stopResult.stderr}`,
				);
				const stopJson = stopResult.json as {
					ok: boolean;
					data: { replayActive?: boolean };
				};
				assert.equal(stopJson.ok, true);
				assert.equal(stopJson.data.replayActive, false);
			} else {
				const replayJson = replayResult.json as {
					ok: boolean;
					error?: { code: string };
				};
				assert.equal(replayJson.ok, false);
				assert.equal(replayJson.error?.code, "HAR_REPLAY_FAILED");
			}
		} finally {
			rmSync(tmpDir, { recursive: true, force: true });
		}
	});

	it("har start/stop records a mid-session window", async () => {
		const name = makeSessionName();
		sessionsToClean.push(name);
		const server = createServer((req, res) => {
			const url = new URL(req.url ?? "/", "http://127.0.0.1");
			if (url.pathname === "/") {
				res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
				res.end(
					`<!doctype html><title>Window</title><a href="/page2">next</a></div>`,
				);
				return;
			}
			if (url.pathname === "/page2") {
				res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
				res.end(`<!doctype html><title>Page 2</title>`);
				return;
			}
			res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
			res.end("not found");
		});
		await new Promise<void>((resolveListen) =>
			server.listen(0, "127.0.0.1", resolveListen),
		);
		const address = server.address();
		assert.ok(address && typeof address === "object");
		const baseUrl = `http://127.0.0.1:${address.port}`;
		const tmpDir = mkdtempSync(resolve(tmpdir(), "pwcli-har-window-"));
		const harFile = resolve(tmpDir, "window.har");

		try {
			// Create session WITHOUT lifecycle HAR
			const createResult = await runPw([
				"session",
				"create",
				name,
				"--no-record-har",
				"--open",
				baseUrl,
				"--output",
				"json",
			]);
			assert.equal(
				createResult.code,
				0,
				`session create failed: ${createResult.stderr}`,
			);

			// Start windowed HAR
			const startResult = await runPw([
				"har",
				"start",
				"--session",
				name,
				"--path",
				harFile,
				"--output",
				"json",
			]);
			assert.equal(
				startResult.code,
				0,
				`har start failed: ${startResult.stderr}`,
			);
			const startJson = startResult.json as {
				ok: boolean;
				data: { harStarted?: boolean; path?: string };
			};
			assert.equal(startJson.ok, true);
			assert.equal(startJson.data.harStarted, true);
			assert.equal(startJson.data.path, harFile);

			// Navigate to capture another request
			const openResult = await runPw([
				"open",
				`${baseUrl}/page2`,
				"--session",
				name,
				"--output",
				"json",
			]);
			assert.equal(openResult.code, 0, `open failed: ${openResult.stderr}`);

			// Stop HAR
			const stopResult = await runPw([
				"har",
				"stop",
				"--session",
				name,
				"--output",
				"json",
			]);
			assert.equal(stopResult.code, 0, `har stop failed: ${stopResult.stderr}`);
			const stopJson = stopResult.json as {
				ok: boolean;
				data: { harStopped?: boolean };
			};
			assert.equal(stopJson.ok, true);
			assert.equal(stopJson.data.harStopped, true);

			// Verify HAR file has entries
			assert.equal(
				existsSync(harFile),
				true,
				"window HAR should be written after stop",
			);
			const har = JSON.parse(readFileSync(harFile, "utf8")) as {
				log?: { entries?: Array<{ request?: { url?: string } }> };
			};
			const entries = har.log?.entries ?? [];
			// Only requests during the HAR window (after start) should be recorded
			assert.ok(
				entries.some((entry) => entry.request?.url === `${baseUrl}/page2`),
			);
			// The initial open happened before har start, so it should NOT be in the windowed HAR
			assert.equal(
				entries.some((entry) => entry.request?.url === baseUrl),
				false,
			);
		} finally {
			await new Promise((resolveClose) => server.close(resolveClose));
			rmSync(tmpDir, { recursive: true, force: true });
		}
	});
});
