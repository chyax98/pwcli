import { before, after, describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { startFixtureServer, stopFixtureServer } from "../fixtures/realistic-app.mjs";
import { checkNodeVersion } from "../../dist/infra/environment/health-probes.js";
import { isThirdPartyUrl } from "../../dist/domain/diagnostics/signals.js";
import { SUPPORTED_BATCH_TOP_LEVEL } from "../../dist/app/batch/run-batch.js";

let fixtureServer: unknown;

describe("fixture server", async () => {
  before(async () => {
    fixtureServer = await startFixtureServer(7778);
  });

  after(async () => {
    await stopFixtureServer();
  });

  it("GET /login returns 200 and contains form", async () => {
    const res = await fetch("http://localhost:7778/login");
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.ok(text.includes("<form"), "should contain form");
    assert.ok(text.includes("username"), "should contain username field");
    assert.ok(text.includes("password"), "should contain password field");
  });

  it("POST /login with correct credentials returns 302 and Set-Cookie", async () => {
    const res = await fetch("http://localhost:7778/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "username=demo&password=demo123",
      redirect: "manual",
    });
    assert.equal(res.status, 302);
    const setCookie = res.headers.get("set-cookie") || "";
    assert.ok(setCookie.includes("session=demo-session"), "should set session cookie");
    const location = res.headers.get("location") || "";
    assert.equal(location, "/dashboard");
  });

  it("GET /dashboard without cookie returns 302 to /login", async () => {
    const res = await fetch("http://localhost:7778/dashboard", { redirect: "manual" });
    assert.equal(res.status, 302);
    assert.equal(res.headers.get("location"), "/login");
  });

  it("GET /api/user returns correct JSON", async () => {
    const res = await fetch("http://localhost:7778/api/user");
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.deepEqual(data, { id: 1, name: "Demo User", role: "admin" });
  });

});

describe("checkNodeVersion", () => {
  it("returns ok for current environment", async () => {
    const result = await checkNodeVersion();
    assert.equal(result.ok, true);
    assert.ok(result.version.startsWith("v"));
    assert.equal(result.minimum, "18.15.0");
  });
});

describe("isThirdPartyUrl", () => {
  it("returns false for same-origin URLs", () => {
    assert.equal(isThirdPartyUrl("https://example.com/path", "https://example.com"), false);
    assert.equal(isThirdPartyUrl("https://example.com:443/path", "https://example.com"), false);
  });

  it("returns true for different-origin URLs", () => {
    assert.equal(isThirdPartyUrl("https://other.com/path", "https://example.com"), true);
    assert.equal(isThirdPartyUrl("https://sub.other.com/path", "https://example.com"), true);
  });

  it("returns false when pageOrigin is undefined and domain is not a tracker", () => {
    assert.equal(isThirdPartyUrl("https://example.com"), false);
  });

  it("returns true for known tracking domains without pageOrigin", () => {
    assert.equal(isThirdPartyUrl("https://google-analytics.com/collect"), true);
  });
});

describe("SUPPORTED_BATCH_TOP_LEVEL", () => {
  it("contains all expected batch commands", () => {
    const expected = [
      "bootstrap",
      "check",
      "click",
      "code",
      "errors",
      "fill",
      "get",
      "hover",
      "is",
      "locate",
      "observe",
      "open",
      "page",
      "press",
      "read-text",
      "route",
      "screenshot",
      "scroll",
      "select",
      "snapshot",
      "state",
      "type",
      "uncheck",
      "verify",
      "wait",
    ];
    for (const cmd of expected) {
      assert.ok(
        SUPPORTED_BATCH_TOP_LEVEL.includes(cmd as (typeof SUPPORTED_BATCH_TOP_LEVEL)[number]),
        `expected ${cmd} to be supported`,
      );
    }
  });
});
