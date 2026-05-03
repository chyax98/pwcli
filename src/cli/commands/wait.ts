import { defineCommand } from "citty";
import { managedWait } from "#engine/act/page.js";
import { sharedArgs } from "#cli/args.js";
import { bool, firstPos, print, session, str, withCliError, type CliArgs } from "./_helpers.js";

export default defineCommand({
  meta: { name: "wait", description: "Wait for page, network, or element state" },
  args: {
    ...sharedArgs,
    text: { type: "string", description: "Wait for text", valueHint: "text" },
    selector: { type: "string", description: "Wait for selector", valueHint: "css" },
    networkidle: { type: "boolean", description: "Wait for network idle", alias: ["network-idle"] },
    request: { type: "string", description: "Wait for request URL", valueHint: "url" },
    response: { type: "string", description: "Wait for response URL", valueHint: "url" },
    method: { type: "string", description: "HTTP method", valueHint: "method" },
    status: { type: "string", description: "HTTP status", valueHint: "code" },
    state: { type: "enum", options: ["visible", "hidden", "stable", "attached", "detached"], description: "Wait for element state", valueHint: "visible|hidden|stable|attached|detached" },
  },
  async run({ args }) {
    const a = args as CliArgs;
    try {
      const target = firstPos(a);
      print("wait", await managedWait({ sessionName: session(a), target: bool(a.networkidle) ? undefined : target, text: str(a.text), selector: str(a.selector), request: str(a.request), response: str(a.response), method: str(a.method), status: str(a.status), networkidle: bool(a.networkidle) || (target ? /^network[-_]?idle$/i.test(target) : false) }), a);
    } catch (error) {
      withCliError("wait", a, error, "wait failed");
    }
  },
});
