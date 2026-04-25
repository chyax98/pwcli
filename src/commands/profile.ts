import { accessSync, constants, existsSync, lstatSync } from "node:fs";
import { homedir } from "node:os";
import { basename, resolve } from "node:path";
import type { Command } from "commander";
import { managedOpen } from "../core/managed.js";
import { printCommandError, printCommandResult } from "../utils/output.js";

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
  const profile = program.command("profile").description("Inspect or use browser profiles");

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

  profile
    .command("open <path> <url>")
    .description("Open a URL with a persistent browser profile")
    .action(async (path: string, url: string) => {
      try {
        const profile = inspectProfilePath(path);
        if (profile.type === "file") {
          throw new Error(`profile path '${profile.resolvedPath}' points to a file`);
        }
        if (!profile.writable) {
          throw new Error(`profile path '${profile.resolvedPath}' is not writable`);
        }

        const result = await managedOpen(url, {
          profile: profile.resolvedPath,
          persistent: true,
          reset: true,
        });

        printCommandResult("profile open", {
          session: result.session,
          page: result.page,
          data: {
            opened: true,
            persistent: true,
            url,
            profile: inspectProfilePath(profile.resolvedPath),
          },
        });
      } catch (error) {
        printCommandError("profile open", {
          code: "PROFILE_OPEN_FAILED",
          message: error instanceof Error ? error.message : "profile open failed",
          suggestions: ["Pass an existing writable browser profile path"],
        });
        process.exitCode = 1;
      }
    });
}
