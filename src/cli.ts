#!/usr/bin/env node
import { defineCommand, runMain } from "citty";
import subCommands from "#cli/commands/index.js";
import { CLI_VERSION } from "./version.js";

const main = defineCommand({
  meta: { name: "pw", version: CLI_VERSION, description: "Agent-first Playwright CLI" },
  subCommands,
});

await runMain(main);
