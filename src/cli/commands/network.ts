import { defineCommand } from "citty";
import { managedNetwork } from "#engine/diagnose/core.js";
import { sharedArgs } from "#cli/args.js";
import { bool, num, print, session, str, withCliError, type CliArgs } from "./_helpers.js";

export default defineCommand({
  meta: { name: "network", description: "Inspect captured network records" },
  args: { ...sharedArgs, "request-id": { type: "string", description: "Request id", valueHint: "id" }, method: { type: "string", description: "HTTP method", valueHint: "method" }, status: { type: "string", description: "HTTP status", valueHint: "code" }, "resource-type": { type: "string", description: "Resource type", valueHint: "type" }, text: { type: "string", description: "Text filter", valueHint: "text" }, url: { type: "string", description: "URL filter", valueHint: "url" }, kind: { type: "enum", options: ["request", "response", "requestfailed", "console-resource-error"], description: "Record kind" }, since: { type: "string", description: "Since ISO time", valueHint: "iso" }, current: { type: "boolean", description: "Current page only" }, "include-body": { type: "boolean", description: "Include captured bodies" }, limit: { type: "string", description: "Limit", valueHint: "n" } },
  async run({ args }) { const a = args as CliArgs; try { print("network", await managedNetwork({ sessionName: session(a), requestId: str(a["request-id"]), method: str(a.method), status: str(a.status), resourceType: str(a["resource-type"]), text: str(a.text), url: str(a.url), kind: str(a.kind) as "request" | "response" | "requestfailed" | "console-resource-error" | undefined, since: str(a.since), current: bool(a.current), includeBody: bool(a["include-body"]), limit: num(a.limit) }), a); } catch (e) { withCliError("network", a, e); } },
});
