import { defineCommand } from "citty";
import { sharedArgs } from "#cli/args.js";
import { managedCookiesDelete, managedCookiesList, managedCookiesSet } from "#engine/identity.js";
import { type CliArgs, firstPos, print, session, str, withCliError } from "./_helpers.js";

const list = defineCommand({
  meta: {
    name: "list",
    description:
      "Purpose: list cookies for a managed session.\nExamples:\n  pw cookies list -s task-a\n  pw cookies list -s task-a --domain localhost\nNotes: this is read-only and useful for auth diagnosis.",
  },
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
  meta: {
    name: "set",
    description:
      "Purpose: set a cookie in a managed session.\nExamples:\n  pw cookies set -s task-a token demo --domain localhost\nNotes: this mutates session cookies; verify page behavior afterward.",
  },
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
const del = defineCommand({
  meta: {
    name: "delete",
    description:
      "Purpose: delete a cookie by name/domain/path in a managed session.\nExamples:\n  pw cookies delete -s task-a token --domain localhost\nNotes: this mutates session cookies; verify page behavior afterward.",
  },
  args: {
    ...sharedArgs,
    name: { type: "string", description: "Cookie name", valueHint: "name" },
    domain: { type: "string", description: "Cookie domain", valueHint: "domain" },
    path: { type: "string", description: "Cookie path", default: "/" },
  },
  async run({ args }) {
    const a = args as CliArgs;
    try {
      const domain = str(a.domain);
      if (!domain) throw new Error("cookies delete requires --domain");
      print(
        "cookies delete",
        await managedCookiesDelete({
          sessionName: session(a),
          name: str(a.name) ?? firstPos(a) ?? "",
          domain,
          path: str(a.path) ?? "/",
        }),
        a,
      );
    } catch (e) {
      withCliError("cookies delete", a, e);
    }
  },
});
export default defineCommand({
  meta: {
    name: "cookies",
    description:
      "Purpose: inspect, set, or delete browser cookies in a managed session.\nExamples:\n  pw cookies list -s task-a\n  pw cookies set -s task-a token demo --domain localhost\n  pw cookies delete -s task-a token --domain localhost\nNotes: `set` and `delete` mutate session cookies; use `list` for read-only diagnosis.",
  },
  subCommands: { list, set, delete: del },
});
