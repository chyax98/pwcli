import { defineCommand } from "citty";
import {
  createStreamStartCommand,
  createStreamStatusCommand,
  createStreamStopCommand,
} from "./stream.js";

const viewOpenCommand = createStreamStartCommand({
  name: "open",
  commandName: "view open",
  failureMessage: "view open failed",
  description:
    "Purpose: open the local read-only preview workbench for one session.\nExamples:\n  pw view open -s task-a\n  pw view open -s task-a --port 4110\nNotes: `view open` uses the same preview server as `stream start`.",
});

const viewStatusCommand = createStreamStatusCommand({
  name: "status",
  commandName: "view status",
  description:
    "Purpose: show local preview workbench status for a session.\nExamples:\n  pw view status -s task-a\nNotes: status reports the registered preview URL and health.",
});

const viewCloseCommand = createStreamStopCommand({
  name: "close",
  commandName: "view close",
  description:
    "Purpose: close the local preview workbench for a session.\nExamples:\n  pw view close -s task-a\nNotes: closing preview does not close the browser session.",
});

export default defineCommand({
  meta: {
    name: "view",
    description:
      "Purpose: open, inspect, or close the local session preview workbench alias.\nExamples:\n  pw view open -s task-a\n  pw view close -s task-a\nNotes: `view` uses the same read-only preview server as `stream`.",
  },
  subCommands: {
    open: viewOpenCommand,
    status: viewStatusCommand,
    close: viewCloseCommand,
  },
});
