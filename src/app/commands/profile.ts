import { accessSync, constants, existsSync, lstatSync } from "node:fs";
import { homedir } from "node:os";
import { basename, resolve } from "node:path";
import type { Command } from "commander";
import { listChromeProfiles } from "../../infra/system-chrome/profiles.js";
import { printCommandResult } from "../output.js";

function expandPath(input: string) {
  if (input === "~") {
    return homedir();
  }
  if (input.startsWith("~/")) {
    return resolve(homedir(), input.slice(2));
  }
  return resolve(input);
}

function canWritePath(path: string) {
  try {
    accessSync(path, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function inspectProfilePath(input: string) {
  const resolvedPath = expandPath(input);
  const exists = existsSync(resolvedPath);
  const type = exists ? (lstatSync(resolvedPath).isDirectory() ? "directory" : "file") : "missing";
  const writable = exists ? canWritePath(resolvedPath) : canWritePath(resolve(resolvedPath, ".."));
  return {
    requestedPath: input,
    resolvedPath,
    displayName: basename(resolvedPath) || resolvedPath,
    exists,
    type,
    writable,
    usable: type !== "file" && writable,
    ...(exists ? {} : { willCreateOnOpen: true }),
  };
}

export function registerProfileCommand(program: Command): void {
  const profile = program.command("profile").description("Inspect browser profile paths");

  profile
    .command("list-chrome")
    .description("List local Chrome profiles available for session create --from-system-chrome")
    .action(async () => {
      const profiles = await listChromeProfiles();
      printCommandResult("profile list-chrome", {
        data: {
          count: profiles.length,
          profiles,
        },
      });
    });

  profile
    .command("inspect <path>")
    .description("Inspect a profile path")
    .action((path: string) => {
      const info = inspectProfilePath(path);
      printCommandResult("profile inspect", {
        data: {
          profile: info,
        },
      });
    });
}
