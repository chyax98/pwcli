import assert from "node:assert/strict";
import test from "node:test";
import { normalizeRunCodeSource } from "../../src/engine/shared.js";

test("normalizeRunCodeSource preserves function expressions", () => {
	assert.equal(
		normalizeRunCodeSource("async (page) => await page.title()"),
		"async (page) => await page.title()",
	);
	assert.equal(
		normalizeRunCodeSource("async (page) => await page.title();"),
		"async (page) => await page.title()",
	);
	assert.equal(
		normalizeRunCodeSource("page => page.url()"),
		"page => page.url()",
	);
});

test("normalizeRunCodeSource wraps statement bodies", () => {
	assert.equal(
		normalizeRunCodeSource("return await page.title()"),
		"async (page) => {\nreturn await page.title()\n}",
	);
});

test("normalizeRunCodeSource wraps expressions with implicit return", () => {
	assert.equal(
		normalizeRunCodeSource("await page.title()"),
		"async (page) => (await page.title())",
	);
	assert.equal(
		normalizeRunCodeSource("await page.title();"),
		"async (page) => (await page.title())",
	);
	assert.equal(normalizeRunCodeSource("1 + 1;"), "async (page) => (1 + 1)");
});
