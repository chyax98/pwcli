import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  managedBootstrapApply,
  managedClick,
  managedErrors,
  managedFill,
  managedGetFact,
  managedIsState,
  managedLocate,
  managedObserveStatus,
  managedOpen,
  managedPageCurrent,
  managedPageDialogs,
  managedPageFrames,
  managedPageList,
  managedPress,
  managedReadText,
  managedRoute,
  managedRunCode,
  managedScreenshot,
  managedScroll,
  managedSnapshot,
  managedStateLoad,
  managedStateSave,
  managedType,
  managedVerify,
  managedWait,
} from "../../infra/playwright/runtime.js";

const SUPPORTED_BATCH_TOP_LEVEL = [
  "bootstrap",
  "click",
  "code",
  "errors",
  "fill",
  "get",
  "is",
  "locate",
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
  "verify",
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

function findInvalidBatchStep(commands: string[][]) {
  for (const [index, tokens] of commands.entries()) {
    const [command] = tokens;
    if (!command) {
      return { index, tokens, message: "batch step is empty" };
    }
    if (
      !SUPPORTED_BATCH_TOP_LEVEL.includes(command as (typeof SUPPORTED_BATCH_TOP_LEVEL)[number])
    ) {
      return { index, tokens, message: unsupportedBatchStepMessage(tokens) };
    }
  }
  return null;
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

function extractReasonCode(message: string) {
  const matched = message.match(/^([A-Z][A-Z0-9_]+)(?::|$)/);
  if (!matched) {
    return undefined;
  }
  return matched[1];
}

function buildBatchStepSuggestions(message: string) {
  if (message === "MODAL_STATE_BLOCKED") {
    return [
      "Recover the dialog outside batch with `pw dialog accept --session <name>` or `pw dialog dismiss --session <name>`",
      "Then rerun the batch from the blocked step",
    ];
  }
  if (message.includes("session lifecycle")) {
    return [
      "Create or attach the session first with `pw session create|attach`",
      "Keep batch for dependent steps inside one existing session only",
    ];
  }
  if (message.includes("environment mutation")) {
    return [
      "Run environment commands directly before batch",
      "Keep batch for deterministic page/read/action steps",
    ];
  }
  return undefined;
}

function parseBatchClickArgs(args: string[]) {
  let ref: string | undefined;
  let selector: string | undefined;
  let text: string | undefined;
  let role: string | undefined;
  let name: string | undefined;
  let nth: number | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--selector") {
      selector = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--text") {
      text = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--role") {
      role = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--name") {
      name = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--nth") {
      nth = args[index + 1] ? Number(args[index + 1]) : undefined;
      index += 1;
      continue;
    }
    if (!arg.startsWith("--") && !ref) {
      ref = arg;
      continue;
    }
    throw new Error(
      `unsupported click batch argument '${arg}'; run the single pw click command outside batch for unsupported flags`,
    );
  }

  const targetCount = [ref, selector, text, role].filter(Boolean).length;
  if (targetCount > 1) {
    throw new Error("batch click accepts exactly one target: ref, --selector, --text, or --role");
  }
  if (args.includes("--selector") && !selector) {
    throw new Error("batch click requires a selector after --selector");
  }
  if (args.includes("--text") && !text) {
    throw new Error("batch click requires text after --text");
  }
  if (args.includes("--role") && !role) {
    throw new Error("batch click requires a role after --role");
  }
  if (args.includes("--name") && !name) {
    throw new Error("batch click requires a name after --name");
  }
  if (args.includes("--nth") && (!Number.isInteger(nth) || nth < 1)) {
    throw new Error("batch click requires a positive integer after --nth");
  }
  if (name && !role) {
    throw new Error("batch click supports --name only with --role");
  }
  if (nth && !text && !role) {
    throw new Error("batch click supports --nth only with --text or --role");
  }

  if (text) {
    return { semantic: { kind: "text" as const, text, ...(nth ? { nth } : {}) } };
  }
  if (role) {
    return {
      semantic: { kind: "role" as const, role, ...(name ? { name } : {}), ...(nth ? { nth } : {}) },
    };
  }
  if (selector) {
    return { selector };
  }
  if (ref) {
    return { ref };
  }
  throw new Error("batch click requires a ref, --selector, --text, or --role");
}

type BatchStateTarget = {
  selector?: string;
  semantic?: {
    kind: "text" | "role" | "label" | "placeholder" | "testid";
    text?: string;
    role?: string;
    name?: string;
    label?: string;
    placeholder?: string;
    testid?: string;
    nth?: number;
  };
};

function parseBatchStateTarget(args: string[]): BatchStateTarget {
  let selector: string | undefined;
  let text: string | undefined;
  let role: string | undefined;
  let name: string | undefined;
  let label: string | undefined;
  let placeholder: string | undefined;
  let testId: string | undefined;
  let nth: number | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--selector") {
      selector = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--text") {
      text = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--role") {
      role = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--name") {
      name = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--label") {
      label = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--placeholder") {
      placeholder = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--test-id" || arg === "--testid") {
      testId = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--nth") {
      nth = args[index + 1] ? Number(args[index + 1]) : undefined;
      index += 1;
      continue;
    }
    throw new Error(`unsupported batch argument '${arg}'`);
  }

  if (selector) {
    return { selector };
  }
  if (role) {
    return { semantic: { kind: "role", role, ...(name ? { name } : {}), ...(nth ? { nth } : {}) } };
  }
  if (text) {
    return { semantic: { kind: "text", text, ...(nth ? { nth } : {}) } };
  }
  if (label) {
    return { semantic: { kind: "label", label, ...(nth ? { nth } : {}) } };
  }
  if (placeholder) {
    return { semantic: { kind: "placeholder", placeholder, ...(nth ? { nth } : {}) } };
  }
  if (testId) {
    return { semantic: { kind: "testid", testid: testId, ...(nth ? { nth } : {}) } };
  }
  return {};
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
      const source = args.join(" ").trim();
      if (!source) {
        throw new Error(`batch step '${rawStep}' requires inline code`);
      }
      return {
        ok: true,
        command: "code",
        data: await managedRunCode({ source, sessionName }),
      };
    }
    case "snapshot": {
      let interactive = false;
      let compact = false;
      for (const arg of args) {
        if (arg === "-i" || arg === "--interactive") {
          interactive = true;
        } else if (arg === "-c" || arg === "--compact") {
          compact = true;
        } else {
          throw new Error(`unsupported snapshot batch argument '${arg}'`);
        }
      }
      return {
        ok: true,
        command: "snapshot",
        data: await managedSnapshot({ sessionName, interactive, compact }),
      };
    }
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
    case "read-text": {
      let selector: string | undefined;
      let includeOverlay = true;
      let maxChars: number | undefined;
      for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        if (arg === "--selector") {
          selector = args[index + 1];
          index += 1;
        } else if (arg === "--no-include-overlay") {
          includeOverlay = false;
        } else if (arg === "--max-chars") {
          maxChars = args[index + 1] ? Number(args[index + 1]) : undefined;
          index += 1;
        } else {
          throw new Error(`unsupported read-text batch argument '${arg}'`);
        }
      }
      return {
        ok: true,
        command: "read-text",
        data: await managedReadText({ sessionName, selector, includeOverlay, maxChars }),
      };
    }
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
    case "click": {
      const target = parseBatchClickArgs(args);
      return {
        ok: true,
        command: "click",
        data: await managedClick({ sessionName, ...target }),
      };
    }
    case "fill": {
      if (args[0] === "--selector") {
        const selector = args[1];
        const value = args.slice(2).join(" ");
        if (!selector) {
          throw new Error(`batch step '${rawStep}' requires a selector after --selector`);
        }
        if (!value) {
          throw new Error(`batch step '${rawStep}' requires a value after the selector`);
        }
        return {
          ok: true,
          command: "fill",
          data: await managedFill({ selector, value, sessionName }),
        };
      }
      if (args.length < 2) {
        throw new Error(`batch step '${rawStep}' requires ref/--selector and value`);
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
    }
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
        if (arg === "networkidle" || arg === "--networkidle") {
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
          networkidle: networkidle || target === "networkidle",
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
    case "locate": {
      const target = parseBatchStateTarget(args);
      if (!target.selector && !target.semantic) {
        throw new Error(`batch step '${rawStep}' requires a target (--selector, --text, --role, --label, --placeholder, --test-id)`);
      }
      return {
        ok: true,
        command: "locate",
        data: await managedLocate({
          sessionName,
          target: (target.semantic ?? { selector: target.selector }) as any,
        }),
      };
    }
    case "get": {
      const fact = args[0] as "text" | "value" | "count" | undefined;
      if (!fact || !["text", "value", "count"].includes(fact)) {
        throw new Error(`batch step '${rawStep}' requires fact: text, value, or count`);
      }
      const target = parseBatchStateTarget(args.slice(1));
      if (!target.selector && !target.semantic) {
        throw new Error(`batch step '${rawStep}' requires a target after fact`);
      }
      return {
        ok: true,
        command: `get ${fact}`,
        data: await managedGetFact({
          sessionName,
          target: (target.semantic ?? { selector: target.selector }) as any,
          fact,
        }),
      };
    }
    case "is": {
      const state = args[0] as "visible" | "enabled" | "checked" | undefined;
      if (!state || !["visible", "enabled", "checked"].includes(state)) {
        throw new Error(`batch step '${rawStep}' requires state: visible, enabled, or checked`);
      }
      const target = parseBatchStateTarget(args.slice(1));
      if (!target.selector && !target.semantic) {
        throw new Error(`batch step '${rawStep}' requires a target after state`);
      }
      return {
        ok: true,
        command: `is ${state}`,
        data: await managedIsState({
          sessionName,
          target: (target.semantic ?? { selector: target.selector }) as any,
          state,
        }),
      };
    }
    case "verify": {
      const assertion = args[0] as any;
      if (!assertion) {
        throw new Error(`batch step '${rawStep}' requires an assertion (text, text-absent, url, visible, hidden, enabled, disabled, checked, unchecked, count)`);
      }
      const remaining = args.slice(1);
      let url: { contains?: string; equals?: string; matches?: string } | undefined;
      let count: { equals?: number; min?: number; max?: number } | undefined;
      const targetArgs: string[] = [];

      for (let index = 0; index < remaining.length; index += 1) {
        const arg = remaining[index];
        if (arg === "--contains") {
          url = { contains: remaining[index + 1] };
          index += 1;
          continue;
        }
        if (arg === "--equals" && assertion === "url") {
          url = { equals: remaining[index + 1] };
          index += 1;
          continue;
        }
        if (arg === "--matches") {
          url = { matches: remaining[index + 1] };
          index += 1;
          continue;
        }
        if (arg === "--equals" && assertion === "count") {
          count = { equals: Number(remaining[index + 1]) };
          index += 1;
          continue;
        }
        if (arg === "--min") {
          count = { min: Number(remaining[index + 1]) };
          index += 1;
          continue;
        }
        if (arg === "--max") {
          count = { max: Number(remaining[index + 1]) };
          index += 1;
          continue;
        }
        targetArgs.push(arg);
      }

      const target = parseBatchStateTarget(targetArgs);
      const needsTarget = !["url"].includes(assertion);

      return {
        ok: true,
        command: `verify ${assertion}`,
        data: await managedVerify({
          sessionName,
          assertion,
          target: needsTarget ? (target.semantic ?? (target.selector ? { selector: target.selector } : undefined)) as any : undefined,
          url,
          count,
        }),
      };
    }
    default:
      throw new Error(unsupportedBatchStepMessage(tokens));
  }
}

export async function runBatch(options: {
  sessionName: string;
  commands: string[][];
  continueOnError?: boolean;
  includeResults?: boolean;
  summaryOnly?: boolean;
}) {
  if (!options.commands.length) {
    throw new Error("batch requires at least one step");
  }
  const analysis = analyzeBatchPlan(options.commands, options.continueOnError);
  const invalidStep = findInvalidBatchStep(options.commands);

  if (invalidStep) {
    const reasonCode = extractReasonCode(invalidStep.message);
    const suggestions = buildBatchStepSuggestions(invalidStep.message);
    return {
      completed: true,
      analysis,
      summary: {
        stepCount: options.commands.length,
        successCount: 0,
        failedCount: 1,
        firstFailedStep: invalidStep.index + 1,
        firstFailedCommand: invalidStep.tokens[0] ?? null,
        firstFailureReasonCode: reasonCode ?? null,
        firstFailureMessage: invalidStep.message,
        firstFailureSuggestions: suggestions ?? null,
        failedSteps: [
          {
            step: invalidStep.index + 1,
            command: invalidStep.tokens[0] ?? null,
            reasonCode: reasonCode ?? null,
          },
        ],
        continueOnError: Boolean(options.continueOnError),
      },
      ...(!options.summaryOnly
        ? {
            results: [
              {
                ok: false,
                index: invalidStep.index,
                argv: invalidStep.tokens,
                step: formatBatchArgv(invalidStep.tokens),
                error: {
                  code: "BATCH_STEP_FAILED",
                  message: invalidStep.message,
                  ...(reasonCode ? { reasonCode } : {}),
                  ...(suggestions ? { suggestions } : {}),
                },
              },
            ],
          }
        : {}),
    };
  }

  const results = [];
  const failedSteps: Array<{
    step: number;
    command: string | null;
    reasonCode: string | null;
  }> = [];
  let successCount = 0;
  let failedCount = 0;
  let firstFailedStep: number | null = null;
  let firstFailedCommand: string | null = null;
  let firstFailureReasonCode: string | null = null;
  let firstFailureMessage: string | null = null;
  let firstFailureSuggestions: string[] | null = null;

  for (const [index, argv] of options.commands.entries()) {
    try {
      const stepResult = {
        index,
        argv,
        step: formatBatchArgv(argv),
        ...(await executeBatchStep(argv, options.sessionName)),
      };
      if (!options.summaryOnly) {
        results.push(stepResult);
      }
      successCount += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "batch step failed";
      const reasonCode = extractReasonCode(message);
      const suggestions = buildBatchStepSuggestions(message);
      failedCount += 1;
      if (firstFailedStep === null) {
        firstFailedStep = index + 1;
        firstFailedCommand = argv[0] ?? null;
        firstFailureReasonCode = reasonCode ?? null;
        firstFailureMessage = message;
        firstFailureSuggestions = suggestions ?? null;
      }
      failedSteps.push({
        step: index + 1,
        command: argv[0] ?? null,
        reasonCode: reasonCode ?? null,
      });
      if (!options.summaryOnly) {
        results.push({
          ok: false,
          index,
          argv,
          step: formatBatchArgv(argv),
          error: {
            code: "BATCH_STEP_FAILED",
            message,
            ...(reasonCode ? { reasonCode } : {}),
            ...(suggestions ? { suggestions } : {}),
          },
        });
      }

      if (!options.continueOnError) {
        break;
      }
    }
  }

  return {
    completed: true,
    analysis,
    summary: {
      stepCount: options.commands.length,
      successCount,
      failedCount,
      firstFailedStep,
      firstFailedCommand,
      firstFailureReasonCode,
      firstFailureMessage,
      firstFailureSuggestions,
      failedSteps,
      continueOnError: Boolean(options.continueOnError),
    },
    ...(!options.summaryOnly ? { results } : {}),
  };
}
