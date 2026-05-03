import { readFile } from "node:fs/promises";
import { defineCommand } from "citty";
import { managedRoute } from "#engine/diagnose/route.js";
import { sharedArgs } from "#cli/args.js";
import { firstPos, num, print, session, str, withCliError, type CliArgs } from "./_helpers.js";

async function jsonFile(path?: string) {
  return path ? JSON.parse(await readFile(path, "utf8")) : undefined;
}

async function textFile(path?: string) {
  return path ? await readFile(path, "utf8") : undefined;
}

const add = defineCommand({
  meta: { name: "add", description: "Add a route rule" },
  args: { ...sharedArgs, abort: { type: "boolean", description: "Abort requests" }, body: { type: "string", description: "Fulfill body", valueHint: "text" }, "body-file": { type: "string", description: "Fulfill body file", valueHint: "path" }, status: { type: "string", description: "Fulfill status", valueHint: "code" }, "content-type": { type: "string", description: "Fulfill content type", valueHint: "mime" }, "headers-file": { type: "string", description: "Headers JSON file", valueHint: "path" }, "merge-headers-file": { type: "string", description: "Merge headers JSON file", valueHint: "path" }, "inject-headers-file": { type: "string", description: "Inject headers JSON file", valueHint: "path" }, "match-body": { type: "string", description: "Request body substring", valueHint: "text" }, "match-query-file": { type: "string", description: "Match query JSON file", valueHint: "path" }, "match-headers-file": { type: "string", description: "Match headers JSON file", valueHint: "path" }, "match-json-file": { type: "string", description: "Match JSON body file", valueHint: "path" }, "patch-json": { type: "string", description: "Merge patch JSON", valueHint: "json" }, "patch-json-file": { type: "string", description: "Merge patch JSON file", valueHint: "path" }, "patch-text-file": { type: "string", description: "Text replacement JSON file", valueHint: "path" }, "patch-status": { type: "string", description: "Patch response status", valueHint: "code" }, method: { type: "string", description: "HTTP method", valueHint: "method" } },
  async run({ args }) {
    const a = args as CliArgs;
    try {
      const patchJson = str(a["patch-json"]) ? JSON.parse(str(a["patch-json"]) as string) : await jsonFile(str(a["patch-json-file"]));
      print("route add", await managedRoute("add", { sessionName: session(a), pattern: firstPos(a), abort: a.abort === true, body: str(a.body) ?? await textFile(str(a["body-file"])), status: num(a.status), contentType: str(a["content-type"]), headers: await jsonFile(str(a["headers-file"])), mergeHeaders: await jsonFile(str(a["merge-headers-file"])), injectHeaders: await jsonFile(str(a["inject-headers-file"])), matchBody: str(a["match-body"]), matchQuery: await jsonFile(str(a["match-query-file"])), matchHeaders: await jsonFile(str(a["match-headers-file"])), matchJson: await jsonFile(str(a["match-json-file"])), patchJson, patchText: await jsonFile(str(a["patch-text-file"])), patchStatus: num(a["patch-status"]), method: str(a.method) }), a);
    } catch (e) { withCliError("route add", a, e); }
  },
});
const remove = defineCommand({ meta: { name: "remove", description: "Remove a route" }, args: sharedArgs, async run({ args }) { const a = args as CliArgs; try { print("route remove", await managedRoute("remove", { sessionName: session(a), pattern: firstPos(a) }), a); } catch (e) { withCliError("route remove", a, e); } } });
const list = defineCommand({ meta: { name: "list", description: "List routes" }, args: sharedArgs, async run({ args }) { const a = args as CliArgs; try { print("route list", await managedRoute("list", { sessionName: session(a) }), a); } catch (e) { withCliError("route list", a, e); } } });

export default defineCommand({ meta: { name: "route", description: "Request route controls" }, subCommands: { add, remove, list } });
