import { defineCommand } from "citty";
import { sharedArgs } from "#cli/args.js";
import {
  managedStorageIndexedDbExport,
  managedStorageMutation,
  managedStorageRead,
} from "#engine/identity.js";
import {
  bool,
  type CliArgs,
  num,
  positionals,
  print,
  printError,
  session,
  str,
  withCliError,
} from "./_helpers.js";

export default defineCommand({
  meta: {
    name: "storage",
    description:
      "Purpose: inspect or mutate localStorage, sessionStorage, or export IndexedDB.\nExamples:\n  pw storage -s task-a local\n  pw storage -s task-a local set token demo\n  pw storage -s task-a indexeddb export --include-records\nNotes: set/delete/clear are write operations; prefer read/export for diagnosis.",
  },
  args: {
    ...sharedArgs,
    database: { type: "string", description: "IndexedDB database", valueHint: "name" },
    store: { type: "string", description: "IndexedDB object store", valueHint: "name" },
    limit: { type: "string", description: "Record limit", default: "20", valueHint: "n" },
    "include-records": { type: "boolean", description: "Include IndexedDB records" },
  },
  async run({ args }) {
    const a = args as CliArgs;
    try {
      const [kind, action, key, value] = positionals(a);
      if (kind === "indexeddb" && (!action || action === "export")) {
        print(
          "storage indexeddb export",
          await managedStorageIndexedDbExport({
            sessionName: session(a),
            database: str(a.database),
            store: str(a.store),
            limit: num(a.limit),
            includeRecords: bool(a["include-records"]),
          }),
          a,
        );
        return;
      }
      if (!action)
        print(
          "storage",
          await managedStorageRead(kind as "local" | "session", { sessionName: session(a) }),
          a,
        );
      else if (["get", "set", "delete", "clear"].includes(action))
        print(
          "storage",
          await managedStorageMutation(
            kind as "local" | "session",
            action as "get" | "set" | "delete" | "clear",
            { sessionName: session(a), key, value },
          ),
          a,
        );
      else
        printError("storage", a, {
          code: "STORAGE_ACTION_UNSUPPORTED",
          message: `unsupported storage action '${action}'`,
        });
    } catch (e) {
      withCliError("storage", a, e);
    }
  },
});
