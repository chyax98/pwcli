import assert from "node:assert/strict";
import test from "node:test";
import { resolveAttachTarget } from "../../src/cli/parsers/session.js";

test("resolveAttachTarget maps --cdp port to raw CDP endpoint", async () => {
	const target = await resolveAttachTarget(undefined, { cdp: "9333" });

	assert.deepEqual(target, {
		endpoint: "http://127.0.0.1:9333",
		resolvedVia: "cdp",
		connectVia: "cdp",
		browserURL: undefined,
		cdpEndpoint: "http://127.0.0.1:9333",
	});
});

test("resolveAttachTarget maps --cdp http URL to raw CDP endpoint", async () => {
	const target = await resolveAttachTarget(undefined, {
		cdp: "http://localhost:9333/",
	});

	assert.deepEqual(target, {
		endpoint: "http://127.0.0.1:9333",
		resolvedVia: "cdp",
		connectVia: "cdp",
		browserURL: undefined,
		cdpEndpoint: "http://127.0.0.1:9333",
	});
});

test("resolveAttachTarget maps --cdp host:port to raw CDP endpoint", async () => {
	const target = await resolveAttachTarget(undefined, {
		cdp: "localhost:9333",
	});

	assert.deepEqual(target, {
		endpoint: "http://127.0.0.1:9333",
		resolvedVia: "cdp",
		connectVia: "cdp",
		browserURL: undefined,
		cdpEndpoint: "http://127.0.0.1:9333",
	});
});

test("resolveAttachTarget maps --cdp websocket URL to raw CDP endpoint", async () => {
	const target = await resolveAttachTarget(undefined, {
		cdp: "ws://localhost:9333/devtools/browser/abc",
	});

	assert.deepEqual(target, {
		endpoint: "ws://127.0.0.1:9333/devtools/browser/abc",
		resolvedVia: "cdp",
		connectVia: "cdp",
		browserURL: undefined,
		cdpEndpoint: "ws://127.0.0.1:9333/devtools/browser/abc",
	});
});

test("resolveAttachTarget maps --browser-url to raw CDP endpoint", async () => {
	const target = await resolveAttachTarget(undefined, {
		browserUrl: "http://localhost:9333/",
	});

	assert.deepEqual(target, {
		endpoint: "http://127.0.0.1:9333",
		resolvedVia: "browser-url",
		connectVia: "cdp",
		browserURL: "http://127.0.0.1:9333",
		cdpEndpoint: "http://127.0.0.1:9333",
	});
});

test("resolveAttachTarget preserves --ws-endpoint as Playwright endpoint", async () => {
	const target = await resolveAttachTarget(undefined, {
		wsEndpoint: "ws://127.0.0.1:1234/playwright",
	});

	assert.deepEqual(target, {
		endpoint: "ws://127.0.0.1:1234/playwright",
		resolvedVia: "ws-endpoint",
		connectVia: "endpoint",
	});
});

test("resolveAttachTarget auto-detects positional HTTP as CDP", async () => {
	const target = await resolveAttachTarget("http://localhost:9333", {});

	assert.deepEqual(target, {
		endpoint: "http://127.0.0.1:9333",
		resolvedVia: "argument",
		connectVia: "cdp",
		cdpEndpoint: "http://127.0.0.1:9333",
	});
});

test("resolveAttachTarget auto-detects positional devtools websocket as CDP", async () => {
	const target = await resolveAttachTarget(
		"ws://localhost:9333/devtools/browser/abc",
		{},
	);

	assert.deepEqual(target, {
		endpoint: "ws://127.0.0.1:9333/devtools/browser/abc",
		resolvedVia: "argument",
		connectVia: "cdp",
		cdpEndpoint: "ws://127.0.0.1:9333/devtools/browser/abc",
	});
});

test("resolveAttachTarget keeps positional non-devtools websocket as Playwright endpoint", async () => {
	const target = await resolveAttachTarget(
		"ws://localhost:3333/playwright",
		{},
	);

	assert.deepEqual(target, {
		endpoint: "ws://127.0.0.1:3333/playwright",
		resolvedVia: "argument",
		connectVia: "endpoint",
	});
});
