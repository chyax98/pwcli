import { defineCommand } from "citty";
import { streamStartCommand, streamStatusCommand, streamStopCommand } from "./stream.js";

export default defineCommand({
  meta: { name: "view", description: "Open or inspect the local session preview workbench" },
  subCommands: {
    open: streamStartCommand,
    status: streamStatusCommand,
    close: streamStopCommand,
  },
});
