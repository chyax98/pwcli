import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { managedBootstrapApply } from "../../domain/bootstrap/service.js";
import {
  managedErrors,
  managedObserveStatus,
  managedRoute,
} from "../../domain/diagnostics/service.js";
import { managedStateLoad, managedStateSave } from "../../domain/identity-state/service.js";
import {
  managedClick,
  managedFill,
  managedPress,
  managedReadText,
  managedRunCode,
  managedScreenshot,
  managedScroll,
  managedSnapshot,
  managedType,
  managedWait,
} from "../../domain/interaction/service.js";
import { managedOpen } from "../../domain/session/service.js";
import {
  managedPageCurrent,
  managedPageDialogs,
  managedPageFrames,
  managedPageList,
} from "../../domain/workspace/service.js";

const SUPPORTED_BATCH_TOP_LEVEL = [
  "bootstrap",
  "click",
  "code",
  "errors",
  "fill",
  "observe",
  "open",
  "page",
  "press",
  "read-text",
  "route",
  "screenshot",
  "scroll",
  "snapshot",
  "state",
  "type",
  "wait",
] as const;

type BatchStepKind = "mutation" | "read" | "recovery" | "session-shape" | "transition" | "wait";

function formatBatchArgv(argv: string[]) {
  return argv.map((part) => (/[\s"'\\]/.test(part) ? JSON.stringify(part) : part)).join(" ");
}

function classifyBatchStep(tokens: string[]): BatchStepKind {
  const [command, subcommand] = tokens;
  if (command === "wait") {
    return "wait";
  }
  if (command === "open" || command === "click" || command === "press") {
    return "transition";
  }
  if (
    command === "fill" ||
    command === "type" ||
    command === "scroll" ||
    command === "route" ||
    command === "bootstrap" ||
    (command === "state" && subcommand === "load") ||
    command === "code"
  ) {
    return command === "code" ? "session-shape" : "mutation";
  }
  if (command === "errors" && subcommand === "clear") {
    return "recovery";
  }
  return "read";
}

function unsupportedBatchStepMessage(tokens: string[]) {
  const [command] = tokens;
  if (!command) {
    return "batch step is empty";
  }
  if (command === "session") {
    return "batch does not support session lifecycle; run `session create|attach|recreate` before batch";
  }
  if (command === "environment") {
    return "batch does not support environment mutation in the stable subset; run environment commands directly before batch";
  }
  if (command === "auth") {
    return "batch does not support auth provider execution; run `auth` directly before batch";
  }
  if (command === "dialog") {
    return "batch does not support dialog recovery; recover the modal first with `dialog accept|dismiss`";
  }
  if (command === "diagnostics" || command === "network" || command === "console") {
    return "batch does not support diagnostics query commands; run diagnostics directly after the dependent batch flow";
  }
  return `unsupported batch step '${command}'`;
}

function validateBatchPlan(commands: string[][]) {
  for (const tokens of commands) {
    const [command] = tokens;
    if (!command) {
      throw new Error("batch step is empty");
    }
    if (
      !SUPPORTED_BATCH_TOP_LEVEL.includes(command as (typeof SUPPORTED_BATCH_TOP_LEVEL)[number])
    ) {
      throw new Error(unsupportedBatchStepMessage(tokens));
    }
  }
}

function analyzeBatchPlan(commands: string[][], continueOnError?: boolean) {
  const warnings: string[] = [];

  commands.forEach((tokens, index) => {
    const kind = classifyBatchStep(tokens);
    const next = commands[index + 1];
    const nextKind = next ? classifyBatchStep(next) : null;
    const rawStep = formatBatchArgv(tokens);
    const nextRawStep = next ? formatBatchArgv(next) : null;

    if (
      (tokens[0] === "open" || tokens[0] === "click" || tokens[0] === "press") &&
      next &&
      nextKind !== "wait"
    ) {
      warnings.push(
        `step ${index + 1} (${rawStep}) changes page state; if step ${index + 2} (${nextRawStep}) depends on navigation or network completion, insert an explicit wait first`,
      );
    }

    if (tokens[0] === "code" && commands.length > 1) {
      warnings.push(
        `step ${index + 1} (${rawStep}) uses opaque code; isolate it or keep it at the end of the serial flow when possible`,
      );
    }

    if (
      continueOnError &&
      (kind === "mutation" || kind === "transition" || kind === "session-shape") &&
      next
    ) {
      warnings.push(
        `step ${index + 1} (${rawStep}) mutates session state; --continue-on-error can make later steps consume stale state`,
      );
    }
  });

  return {
    serialOnly: true,
    requiresExistingSession: true,
    stepCount: commands.length,
    continueOnError: Boolean(continueOnError),
    supportedTopLevel: [...SUPPORTED_BATCH_TOP_LEVEL],
    warnings,
  };
}

async function executeBatchStep(tokens: string[], sessionName: string) {
  const [command, ...args] = tokens;
  const rawStep = formatBatchArgv(tokens);

  if (!command) {
    throw new Error("batch step is empty");
  }

  switch (command) {
    case "open":
      if (args.length !== 1) {
        throw new Error(`batch step '${rawStep}' requires exactly one URL`);
      }
      return {
        ok: true,
        command: "open",
        data: await managedOpen(args[0], { sessionName, reset: false }),
      };
    case "code": {
      const source = rawStep.slice(rawStep.indexOf("code") + 4).trim();
      if (!source) {
        throw new Error(`batch step '${rawStep}' requires inline code`);
      }
      return {
        ok: true,
        command: "code",
        data: await managedRunCode({ source, sessionName }),
      };
    }
    case "snapshot":
      return {
        ok: true,
        command: "snapshot",
        data: await managedSnapshot({ sessionName }),
      };
    case "screenshot": {
      let ref: string | undefined;
      let selector: string | undefined;
      let path: string | undefined;
      let fullPage = false;

      for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        if (arg === "--selector") {
          selector = args[index + 1];
          index += 1;
          continue;
        }
        if (arg === "--path") {
          path = args[index + 1];
          index += 1;
          continue;
        }
        if (arg === "--full-page") {
          fullPage = true;
          continue;
        }
        if (!ref) {
          ref = arg;
          continue;
        }
        throw new Error(`unsupported screenshot batch argument '${arg}'`);
      }

      if (args.includes("--selector") && !selector) {
        throw new Error(`batch step '${rawStep}' requires a selector after --selector`);
      }
      if (args.includes("--path") && !path) {
        throw new Error(`batch step '${rawStep}' requires a path after --path`);
      }

      return {
        ok: true,
        command: "screenshot",
        data: await managedScreenshot({
          sessionName,
          ref,
          selector,
          path,
          fullPage,
        }),
      };
    }
    case "read-text":
      return {
        ok: true,
        command: "read-text",
        data: await managedReadText({ sessionName }),
      };
    case "page":
      if (args[0] === "current") {
        return {
          ok: true,
          command: "page current",
          data: await managedPageCurrent({ sessionName }),
        };
      }
      if (args[0] === "list") {
        return { ok: true, command: "page list", data: await managedPageList({ sessionName }) };
      }
      if (args[0] === "frames") {
        return { ok: true, command: "page frames", data: await managedPageFrames({ sessionName }) };
      }
      if (args[0] === "dialogs") {
        return {
          ok: true,
          command: "page dialogs",
          data: await managedPageDialogs({ sessionName }),
        };
      }
      throw new Error(`unsupported page batch step '${rawStep}'`);
    case "observe":
      if (args[0] !== "status") {
        throw new Error(`unsupported observe batch step '${rawStep}'`);
      }
      return {
        ok: true,
        command: "observe status",
        data: await managedObserveStatus({ sessionName }),
      };
    case "errors":
      if (args[0] !== "recent" && args[0] !== "clear") {
        throw new Error(`unsupported errors batch step '${rawStep}'`);
      }
      return {
        ok: true,
        command: `errors ${args[0]}`,
        data: await managedErrors(args[0], { sessionName }),
      };
    case "route":
      if (args[0] === "list") {
        return {
          ok: true,
          command: "route list",
          data: await managedRoute("list", {
            sessionName,
          }),
        };
      }
      if (args[0] === "load") {
        const file = args[1];
        if (!file) {
          throw new Error(`batch step '${rawStep}' requires a file after route load`);
        }
        const path = resolve(file);
        const dir = dirname(path);
        const specs = JSON.parse(await readFile(path, "utf8")) as Array<Record<string, unknown>>;
        const loaded = [];
        for (const spec of specs) {
          if (typeof spec.pattern !== "string" || !spec.pattern) {
            throw new Error(
              `batch step '${rawStep}' requires every route spec to include a non-empty pattern`,
            );
          }
          const body =
            typeof spec.bodyFile === "string"
              ? await readFile(resolve(dir, spec.bodyFile), "utf8")
              : typeof spec.body === "string"
                ? spec.body
                : undefined;
          const patchJson =
            typeof spec.patchJsonFile === "string"
              ? JSON.parse(await readFile(resolve(dir, spec.patchJsonFile), "utf8"))
              : spec.patchJson !== undefined
                ? spec.patchJson
                : undefined;
          const headers =
            typeof spec.headersFile === "string"
              ? (JSON.parse(await readFile(resolve(dir, spec.headersFile), "utf8")) as Record<
                  string,
                  string
                >)
              : spec.headers && typeof spec.headers === "object"
                ? (spec.headers as Record<string, string>)
                : undefined;
          const injectHeaders =
            typeof spec.injectHeadersFile === "string"
              ? (JSON.parse(await readFile(resolve(dir, spec.injectHeadersFile), "utf8")) as Record<
                  string,
                  string
                >)
              : spec.injectHeaders && typeof spec.injectHeaders === "object"
                ? (spec.injectHeaders as Record<string, string>)
                : undefined;
          const result = await managedRoute("add", {
            sessionName,
            pattern: spec.pattern,
            abort: Boolean(spec.abort),
            matchBody: typeof spec.matchBody === "string" ? spec.matchBody : undefined,
            patchJson,
            patchStatus: spec.patchStatus !== undefined ? Number(spec.patchStatus) : undefined,
            body,
            status: spec.status !== undefined ? Number(spec.status) : undefined,
            contentType: typeof spec.contentType === "string" ? spec.contentType : undefined,
            headers,
            injectHeaders,
            method: typeof spec.method === "string" ? spec.method : undefined,
          });
          loaded.push(result.data.route ?? { pattern: spec.pattern });
        }
        return {
          ok: true,
          command: "route load",
          data: {
            loadedCount: loaded.length,
            routes: loaded,
          },
        };
      }
      if (args[0] === "add") {
        const pattern = args[1];
        if (!pattern) {
          throw new Error(`batch step '${rawStep}' requires a pattern after route add`);
        }
        let abort = false;
        let body: string | undefined;
        let bodyFile: string | undefined;
        let patchJsonText: string | undefined;
        let patchJsonFile: string | undefined;
        let patchJson: unknown;
        let patchStatus: number | undefined;
        let headersFile: string | undefined;
        let headers: Record<string, string> | undefined;
        let injectHeadersFile: string | undefined;
        let injectHeaders: Record<string, string> | undefined;
        let matchBody: string | undefined;
        let method: string | undefined;
        let status: number | undefined;
        let contentType: string | undefined;

        for (let index = 2; index < args.length; index += 1) {
          const arg = args[index];
          if (arg === "--abort") {
            abort = true;
            continue;
          }
          if (arg === "--body") {
            body = args[index + 1];
            index += 1;
            continue;
          }
          if (arg === "--body-file") {
            bodyFile = args[index + 1];
            index += 1;
            continue;
          }
          if (arg === "--patch-json") {
            patchJsonText = args[index + 1];
            index += 1;
            continue;
          }
          if (arg === "--patch-json-file") {
            patchJsonFile = args[index + 1];
            index += 1;
            continue;
          }
          if (arg === "--patch-status") {
            patchStatus = args[index + 1] ? Number(args[index + 1]) : undefined;
            index += 1;
            continue;
          }
          if (arg === "--headers-file") {
            headersFile = args[index + 1];
            index += 1;
            continue;
          }
          if (arg === "--inject-headers-file") {
            injectHeadersFile = args[index + 1];
            index += 1;
            continue;
          }
          if (arg === "--match-body") {
            matchBody = args[index + 1];
            index += 1;
            continue;
          }
          if (arg === "--method") {
            method = args[index + 1];
            index += 1;
            continue;
          }
          if (arg === "--status") {
            status = args[index + 1] ? Number(args[index + 1]) : undefined;
            index += 1;
            continue;
          }
          if (arg === "--content-type") {
            contentType = args[index + 1];
            index += 1;
            continue;
          }
          throw new Error(`unsupported route batch argument '${arg}'`);
        }
        if (bodyFile) {
          body = await readFile(resolve(bodyFile), "utf8");
        }
        if (patchJsonFile) {
          patchJson = JSON.parse(await readFile(resolve(patchJsonFile), "utf8"));
        } else if (patchJsonText !== undefined) {
          patchJson = JSON.parse(patchJsonText);
        }
        if (headersFile) {
          headers = JSON.parse(await readFile(resolve(headersFile), "utf8")) as Record<
            string,
            string
          >;
        }
        if (injectHeadersFile) {
          injectHeaders = JSON.parse(await readFile(resolve(injectHeadersFile), "utf8")) as Record<
            string,
            string
          >;
        }

        return {
          ok: true,
          command: "route add",
          data: await managedRoute("add", {
            sessionName,
            pattern,
            abort,
            matchBody,
            patchJson,
            patchStatus,
            body,
            headers,
            injectHeaders,
            method,
            status,
            contentType,
          }),
        };
      }
      if (args[0] === "remove") {
        return {
          ok: true,
          command: "route remove",
          data: await managedRoute("remove", {
            sessionName,
            pattern: args[1],
          }),
        };
      }
      throw new Error(`unsupported route batch step '${rawStep}'`);
    case "bootstrap": {
      if (args[0] !== "apply") {
        throw new Error(`unsupported bootstrap batch step '${rawStep}'`);
      }
      const initScripts: string[] = [];
      let headersFile: string | undefined;
      for (let index = 1; index < args.length; index += 1) {
        const arg = args[index];
        if (arg === "--init-script") {
          const file = args[index + 1];
          if (!file) {
            throw new Error(`batch step '${rawStep}' requires a file after --init-script`);
          }
          initScripts.push(file);
          index += 1;
          continue;
        }
        if (arg === "--headers-file") {
          headersFile = args[index + 1];
          if (!headersFile) {
            throw new Error(`batch step '${rawStep}' requires a file after --headers-file`);
          }
          index += 1;
          continue;
        }
        throw new Error(`unsupported bootstrap batch argument '${arg}'`);
      }
      return {
        ok: true,
        command: "bootstrap apply",
        data: await managedBootstrapApply({
          sessionName,
          initScripts,
          headersFile,
        }),
      };
    }
    case "click":
      if (args[0] === "--selector") {
        const selector = args[1];
        if (!selector) {
          throw new Error(`batch step '${rawStep}' requires a selector after --selector`);
        }
        return {
          ok: true,
          command: "click",
          data: await managedClick({ selector, sessionName }),
        };
      }
      if (args.length !== 1) {
        throw new Error(
          `batch step '${rawStep}' requires exactly one ref or --selector <selector>`,
        );
      }
      return {
        ok: true,
        command: "click",
        data: await managedClick({ ref: args[0], sessionName }),
      };
    case "fill":
      if (args.length < 2) {
        throw new Error(`batch step '${rawStep}' requires ref/selector and value`);
      }
      return {
        ok: true,
        command: "fill",
        data: await managedFill({
          ref: args[0],
          value: args.slice(1).join(" "),
          sessionName,
        }),
      };
    case "type":
      if (args.length < 1) {
        throw new Error(`batch step '${rawStep}' requires a value`);
      }
      return {
        ok: true,
        command: "type",
        data: await managedType({
          ref: args.length > 1 ? args[0] : undefined,
          value: args.length > 1 ? args.slice(1).join(" ") : args[0],
          sessionName,
        }),
      };
    case "press":
      if (args.length !== 1) {
        throw new Error(`batch step '${rawStep}' requires exactly one key`);
      }
      return {
        ok: true,
        command: "press",
        data: await managedPress(args[0], { sessionName }),
      };
    case "scroll":
      if (!args.length) {
        throw new Error(`batch step '${rawStep}' requires direction`);
      }
      return {
        ok: true,
        command: "scroll",
        data: await managedScroll({
          direction: args[0] as "up" | "down" | "left" | "right",
          distance: args[1] ? Number(args[1]) : undefined,
          sessionName,
        }),
      };
    case "wait": {
      let target: string | undefined;
      let text: string | undefined;
      let selector: string | undefined;
      let request: string | undefined;
      let response: string | undefined;
      let method: string | undefined;
      let status: string | undefined;
      let networkidle = false;

      for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        if (
          arg === "networkIdle" ||
          arg === "networkidle" ||
          arg === "network-idle" ||
          arg === "--networkidle" ||
          arg === "--network-idle"
        ) {
          networkidle = true;
          continue;
        }
        if (arg === "--text") {
          text = args[index + 1];
          index += 1;
          continue;
        }
        if (arg === "--selector") {
          selector = args[index + 1];
          index += 1;
          continue;
        }
        if (arg === "--request") {
          request = args[index + 1];
          index += 1;
          continue;
        }
        if (arg === "--response") {
          response = args[index + 1];
          index += 1;
          continue;
        }
        if (arg === "--method") {
          method = args[index + 1];
          index += 1;
          continue;
        }
        if (arg === "--status") {
          status = args[index + 1];
          index += 1;
          continue;
        }
        if (!arg.startsWith("--") && !target) {
          target = arg;
          continue;
        }
        throw new Error(`unsupported wait batch argument '${arg}'`);
      }
      return {
        ok: true,
        command: "wait",
        data: await managedWait({
          target: networkidle ? undefined : target,
          text,
          selector,
          request,
          response,
          method,
          status,
          networkidle:
            networkidle ||
            target === "networkIdle" ||
            target === "networkidle" ||
            target === "network-idle",
          sessionName,
        }),
      };
    }
    case "state":
      if (args[0] === "save") {
        return {
          ok: true,
          command: "state save",
          data: await managedStateSave(args[1], { sessionName }),
        };
      }
      if (args[0] === "load" && args[1]) {
        return {
          ok: true,
          command: "state load",
          data: await managedStateLoad(args[1], { sessionName }),
        };
      }
      throw new Error(`unsupported state batch step '${rawStep}'`);
    default:
      throw new Error(unsupportedBatchStepMessage(tokens));
  }
}

export async function runBatch(options: {
  sessionName: string;
  commands: string[][];
  continueOnError?: boolean;
}) {
  if (!options.commands.length) {
    throw new Error("batch requires at least one step");
  }
  validateBatchPlan(options.commands);
  const analysis = analyzeBatchPlan(options.commands, options.continueOnError);

  const results = [];

  for (const [index, argv] of options.commands.entries()) {
    try {
      results.push({
        index,
        argv,
        step: formatBatchArgv(argv),
        ...(await executeBatchStep(argv, options.sessionName)),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "batch step failed";
      results.push({
        ok: false,
        index,
        argv,
        step: formatBatchArgv(argv),
        error: {
          code: "BATCH_STEP_FAILED",
          message,
          suggestions:
            message === "MODAL_STATE_BLOCKED"
              ? [
                  "Recover the dialog outside batch with `pw dialog accept --session <name>` or `pw dialog dismiss --session <name>`",
                  "Then rerun the batch from the blocked step",
                ]
              : message.includes("session lifecycle")
                ? [
                    "Create or attach the session first with `pw session create|attach`",
                    "Keep batch for dependent steps inside one existing session only",
                  ]
                : message.includes("environment mutation")
                  ? [
                      "Run environment commands directly before batch",
                      "Keep batch for deterministic page/read/action steps",
                    ]
                  : undefined,
        },
      });

      if (!options.continueOnError) {
        break;
      }
    }
  }

  return {
    completed: true,
    analysis,
    results,
  };
}
