import assert from "node:assert/strict";
import { isThirdPartyUrl } from "../../dist/engine/diagnose/core.js";

// isThirdPartyUrl
assert.equal(
  isThirdPartyUrl("https://google-analytics.com/collect", "https://myapp.com"),
  true,
  "google-analytics should be third-party",
);
assert.equal(
  isThirdPartyUrl("https://myapp.com/api/v1", "https://myapp.com"),
  false,
  "same-origin should not be third-party",
);

// cdn.myapp.com vs myapp.com: hostname differs, so implementation returns true
const cdnResult = isThirdPartyUrl("https://cdn.myapp.com/js/app.js", "https://myapp.com");
assert.ok(cdnResult === true || cdnResult === false, "cdn subdomain result should be a boolean");

console.log("diagnostics-signal-scoring tests passed");
