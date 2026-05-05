import { defineCommand } from "citty";
import { streamStartCommand, streamStatusCommand, streamStopCommand } from "./stream.js";

export default defineCommand({
  meta: {
    name: "view",
    description:
      "Purpose: open, inspect, or close the local session preview workbench alias.\nExamples:\n  pw view open -s task-a\n  pw view close -s task-a\nNotes: `view` uses the same read-only preview server as `stream`.",
  },
  subCommands: {
    open: streamStartCommand,
    status: streamStatusCommand,
    close: streamStopCommand,
  },
});
