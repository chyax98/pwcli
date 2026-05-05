import { defineCommand } from "citty";
import { sharedArgs } from "#cli/args.js";
import { managedCookiesList, managedCookiesSet } from "#engine/identity.js";
import { type CliArgs, firstPos, print, session, str, withCliError } from "./_helpers.js";

const list = defineCommand({
  meta: { name: "list", description: "List cookies" },
  args: {
    ...sharedArgs,
    domain: { type: "string", description: "Domain filter", valueHint: "domain" },
  },
  async run({ args }) {
    const a = args as CliArgs;
    try {
      print(
        "cookies list",
        await managedCookiesList({ sessionName: session(a), domain: str(a.domain) }),
        a,
      );
    } catch (e) {
      withCliError("cookies list", a, e);
    }
  },
});
const set = defineCommand({
  meta: { name: "set", description: "Set a cookie" },
  args: {
    ...sharedArgs,
    name: { type: "string", description: "Cookie name", valueHint: "name" },
    value: { type: "string", description: "Cookie value", valueHint: "value" },
    domain: { type: "string", description: "Cookie domain", valueHint: "domain" },
    path: { type: "string", description: "Cookie path", default: "/" },
  },
  async run({ args }) {
    const a = args as CliArgs;
    try {
      const domain = str(a.domain);
      if (!domain) throw new Error("cookies set requires --domain");
      print(
        "cookies set",
        await managedCookiesSet({
          sessionName: session(a),
          name: str(a.name) ?? firstPos(a) ?? "",
          value: str(a.value) ?? String((a._ as string[] | undefined)?.[1] ?? ""),
          domain,
          path: str(a.path) ?? "/",
        }),
        a,
      );
    } catch (e) {
      withCliError("cookies set", a, e);
    }
  },
});
export default defineCommand({
  meta: {
    name: "cookies",
    description:
      "Purpose: inspect or set browser cookies in a managed session.\nExamples:\n  pw cookies list -s task-a\n  pw cookies set -s task-a token demo --domain localhost\nNotes: `set` mutates session cookies; use `list` for read-only diagnosis.",
  },
  subCommands: { list, set },
});
