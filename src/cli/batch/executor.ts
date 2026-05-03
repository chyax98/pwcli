import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  managedCheck,
  managedClick,
  managedFill,
  managedHover,
  managedPress,
  managedSelect,
  managedType,
  managedUncheck,
} from "#engine/act/element.js";
import { managedReadText, managedScreenshot, managedScroll, managedWait } from "#engine/act/page.js";
import { managedErrors, managedObserveStatus } from "#engine/diagnose/core.js";
import { managedRoute } from "#engine/diagnose/route.js";
import { managedStateLoad, managedStateSave } from "#engine/identity.js";
import type { VerifyAssertion } from "#engine/observe.js";
import { managedGetFact, managedIsState, managedLocate, managedSnapshot, managedVerify } from "#engine/observe.js";
import { managedRunCode } from "#engine/shared.js";
import { managedBootstrapApply, managedOpen } from "#engine/session.js";
import { managedPageCurrent, managedPageDialogs, managedPageFrames, managedPageList } from "#engine/workspace.js";
import { parseBatchSemanticArgs, parseBatchStateTarget } from "../parsers/batch.js";
import {
  analyzeBatchPlan,
  findInvalidBatchStep,
  formatBatchArgv,
  unsupportedBatchStepMessage,
} from "./plan.js";

const VERIFY_ASSERTIONS = [
  "text",
  "text-absent",
  "url",
  "visible",
  "hidden",
  "enabled",
  "disabled",
  "checked",
  "unchecked",
  "count",
] as const satisfies readonly VerifyAssertion[];

function isVerifyAssertion(value: string | undefined): value is VerifyAssertion {
  return Boolean(value && (VERIFY_ASSERTIONS as readonly string[]).includes(value));
}

function extractReasonCode(message: string) {
  const matched = message.match(/^([A-Z][A-Z0-9_]+)(?::|$)/);
  return matched?.[1];
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
    return ["Run environment commands directly before batch", "Keep batch for deterministic page/read/action steps"];
  }
  return undefined;
}

function errorSuggestions(error: unknown): string[] | undefined {
  const suggestions = (error as { suggestions?: unknown } | null)?.suggestions;
  return Array.isArray(suggestions) ? suggestions.map(String) : undefined;
}

function jsonObject(value: unknown, label: string): Record<string, string> | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object`);
  }
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, String(item)]));
}

async function readJsonMaybeFile(spec: Record<string, unknown>, inlineKey: string, fileKey: string, dir: string) {
  if (typeof spec[fileKey] === "string") {
    return JSON.parse(await readFile(resolve(dir, spec[fileKey]), "utf8"));
  }
  return spec[inlineKey] !== undefined ? spec[inlineKey] : undefined;
}

async function readTextMaybeFile(spec: Record<string, unknown>, inlineKey: string, fileKey: string, dir: string) {
  if (typeof spec[fileKey] === "string") return await readFile(resolve(dir, spec[fileKey]), "utf8");
  return typeof spec[inlineKey] === "string" ? spec[inlineKey] : undefined;
}

async function readHeadersMaybeFile(spec: Record<string, unknown>, inlineKey: string, fileKey: string, dir: string) {
  const raw = await readJsonMaybeFile(spec, inlineKey, fileKey, dir);
  return jsonObject(raw, inlineKey);
}

async function loadRouteSpecs(file: string, sessionName: string, rawStep: string) {
  const path = resolve(file);
  const dir = dirname(path);
  const specs = JSON.parse(await readFile(path, "utf8")) as Array<Record<string, unknown>>;
  const loaded = [];
  for (const spec of specs) {
    if (typeof spec.pattern !== "string" || !spec.pattern) {
      throw new Error(`batch step '${rawStep}' requires every route spec to include a non-empty pattern`);
    }
    const body = await readTextMaybeFile(spec, "body", "bodyFile", dir);
    const patchJson = await readJsonMaybeFile(spec, "patchJson", "patchJsonFile", dir);
    const matchJson = await readJsonMaybeFile(spec, "matchJson", "matchJsonFile", dir);
    const headers = await readHeadersMaybeFile(spec, "headers", "headersFile", dir);
    const injectHeaders = await readHeadersMaybeFile(spec, "injectHeaders", "injectHeadersFile", dir);
    const matchQuery = await readHeadersMaybeFile(spec, "matchQuery", "matchQueryFile", dir);
    const matchHeaders = await readHeadersMaybeFile(spec, "matchHeaders", "matchHeadersFile", dir);
    const patchText = await readHeadersMaybeFile(spec, "patchText", "patchTextFile", dir);
    const mergeHeaders = await readHeadersMaybeFile(spec, "mergeHeaders", "mergeHeadersFile", dir);
    const result = await managedRoute("add", {
      sessionName,
      pattern: spec.pattern,
      abort: Boolean(spec.abort),
      matchBody: typeof spec.matchBody === "string" ? spec.matchBody : undefined,
      matchQuery,
      matchHeaders,
      matchJson,
      patchJson,
      patchText,
      patchStatus: spec.patchStatus !== undefined ? Number(spec.patchStatus) : undefined,
      body,
      status: spec.status !== undefined ? Number(spec.status) : undefined,
      contentType: typeof spec.contentType === "string" ? spec.contentType : undefined,
      headers,
      mergeHeaders,
      injectHeaders,
      method: typeof spec.method === "string" ? spec.method : undefined,
    });
    loaded.push(result.data.route ?? { pattern: spec.pattern });
  }
  return loaded;
}

export async function executeBatchStep(tokens: string[], sessionName: string) {
  const [command, ...args] = tokens;
  const rawStep = formatBatchArgv(tokens);
  if (!command) throw new Error("batch step is empty");

  switch (command) {
    case "open":
      if (args.length !== 1) throw new Error(`batch step '${rawStep}' requires exactly one URL`);
      return { ok: true, command: "open", data: await managedOpen(args[0], { sessionName, reset: false }) };
    case "code": {
      const source = args.join(" ").trim();
      if (!source) throw new Error(`batch step '${rawStep}' requires inline code`);
      return { ok: true, command: "code", data: await managedRunCode({ source, sessionName }) };
    }
    case "snapshot": {
      let interactive = false;
      let compact = false;
      for (const arg of args) {
        if (arg === "-i" || arg === "--interactive") interactive = true;
        else if (arg === "-c" || arg === "--compact") compact = true;
        else throw new Error(`unsupported snapshot batch argument '${arg}'`);
      }
      return { ok: true, command: "snapshot", data: await managedSnapshot({ sessionName, interactive, compact }) };
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
        } else if (arg === "--path") {
          path = args[index + 1];
          index += 1;
        } else if (arg === "--full-page") fullPage = true;
        else if (!ref) ref = arg;
        else throw new Error(`unsupported screenshot batch argument '${arg}'`);
      }
      if (args.includes("--selector") && !selector) throw new Error(`batch step '${rawStep}' requires a selector after --selector`);
      if (args.includes("--path") && !path) throw new Error(`batch step '${rawStep}' requires a path after --path`);
      return { ok: true, command: "screenshot", data: await managedScreenshot({ sessionName, ref, selector, path, fullPage }) };
    }
    case "read-text":
    case "text": {
      let selector: string | undefined;
      let includeOverlay = true;
      let maxChars: number | undefined;
      for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        if (arg === "--selector") {
          selector = args[index + 1];
          index += 1;
        } else if (arg === "--no-include-overlay") includeOverlay = false;
        else if (arg === "--max-chars") {
          maxChars = args[index + 1] ? Number(args[index + 1]) : undefined;
          index += 1;
        } else throw new Error(`unsupported read-text batch argument '${arg}'`);
      }
      return { ok: true, command: "read-text", data: await managedReadText({ sessionName, selector, includeOverlay, maxChars }) };
    }
    case "page":
      if (args[0] === "current") return { ok: true, command: "page current", data: await managedPageCurrent({ sessionName }) };
      if (args[0] === "list") return { ok: true, command: "page list", data: await managedPageList({ sessionName }) };
      if (args[0] === "frames") return { ok: true, command: "page frames", data: await managedPageFrames({ sessionName }) };
      if (args[0] === "dialogs") return { ok: true, command: "page dialogs", data: await managedPageDialogs({ sessionName }) };
      throw new Error(`unsupported page batch step '${rawStep}'`);
    case "observe":
    case "status":
      if (command === "observe" && args[0] !== "status") throw new Error(`unsupported observe batch step '${rawStep}'`);
      return { ok: true, command: "status", data: await managedObserveStatus({ sessionName }) };
    case "errors":
      if (args[0] !== "recent" && args[0] !== "clear") throw new Error(`unsupported errors batch step '${rawStep}'`);
      return { ok: true, command: `errors ${args[0]}`, data: await managedErrors(args[0], { sessionName }) };
    case "route":
      if (args[0] === "list") return { ok: true, command: "route list", data: await managedRoute("list", { sessionName }) };
      if (args[0] === "load") {
        const file = args[1];
        if (!file) throw new Error(`batch step '${rawStep}' requires a file after route load`);
        const routes = await loadRouteSpecs(file, sessionName, rawStep);
        return { ok: true, command: "route load", data: { loadedCount: routes.length, routes } };
      }
      if (args[0] === "remove") return { ok: true, command: "route remove", data: await managedRoute("remove", { sessionName, pattern: args[1] }) };
      if (args[0] === "add") {
        const pattern = args[1];
        if (!pattern) throw new Error(`batch step '${rawStep}' requires a pattern after route add`);
        return { ok: true, command: "route add", data: await managedRoute("add", { sessionName, pattern }) };
      }
      throw new Error(`unsupported route batch step '${rawStep}'`);
    case "bootstrap": {
      if (args[0] !== "apply") throw new Error(`unsupported bootstrap batch step '${rawStep}'`);
      const initScripts: string[] = [];
      let headersFile: string | undefined;
      for (let index = 1; index < args.length; index += 1) {
        const arg = args[index];
        if (arg === "--init-script") {
          const file = args[index + 1];
          if (!file) throw new Error(`batch step '${rawStep}' requires a file after --init-script`);
          initScripts.push(file);
          index += 1;
        } else if (arg === "--headers-file") {
          headersFile = args[index + 1];
          if (!headersFile) throw new Error(`batch step '${rawStep}' requires a file after --headers-file`);
          index += 1;
        } else throw new Error(`unsupported bootstrap batch argument '${arg}'`);
      }
      return { ok: true, command: "bootstrap apply", data: await managedBootstrapApply({ sessionName, initScripts, headersFile }) };
    }
    case "click":
    case "check":
    case "uncheck":
    case "hover": {
      const target = parseBatchSemanticArgs(args, command);
      const { trailingValues: _trailingValues, ...targetRest } = target;
      if (!targetRest.semantic && !targetRest.selector && !targetRest.ref) {
        throw new Error(`batch ${command} requires a ref, --selector, or semantic locator`);
      }
      const data =
        command === "click"
          ? await managedClick({ sessionName, ...targetRest })
          : command === "check"
            ? await managedCheck({ sessionName, ...targetRest })
            : command === "uncheck"
              ? await managedUncheck({ sessionName, ...targetRest })
              : await managedHover({ sessionName, ...targetRest });
      return { ok: true, command, data };
    }
    case "fill":
    case "type":
    case "select": {
      const target = parseBatchSemanticArgs(args, command);
      const { trailingValues, ...targetRest } = target;
      const value = trailingValues.join(" ");
      if (targetRest.semantic || targetRest.selector) {
        if (!value) throw new Error(`batch step '${rawStep}' requires a value after the target`);
        const data =
          command === "fill"
            ? await managedFill({ ...targetRest, value, sessionName })
            : command === "type"
              ? await managedType({ ...targetRest, value, sessionName })
              : await managedSelect({ ...targetRest, value, sessionName });
        return { ok: true, command, data };
      }
      if (command === "type" && args.length === 1) {
        return { ok: true, command, data: await managedType({ value: args[0], sessionName }) };
      }
      if (args.length < 2) throw new Error(`batch step '${rawStep}' requires ref/target and value`);
      const data =
        command === "fill"
          ? await managedFill({ ref: args[0], value: args.slice(1).join(" "), sessionName })
          : command === "type"
            ? await managedType({ ref: args[0], value: args.slice(1).join(" "), sessionName })
            : await managedSelect({ ref: args[0], value: args.slice(1).join(" "), sessionName });
      return { ok: true, command, data };
    }
    case "press": {
      const key = args.join(" ");
      if (!key) throw new Error(`batch step '${rawStep}' requires a key`);
      return { ok: true, command: "press", data: await managedPress(key, { sessionName }) };
    }
    case "scroll":
      if (!args.length) throw new Error(`batch step '${rawStep}' requires direction`);
      return { ok: true, command: "scroll", data: await managedScroll({ direction: args[0] as "up" | "down" | "left" | "right", distance: args[1] ? Number(args[1]) : undefined, sessionName }) };
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
        if (/^network[-_]?idle$/i.test(arg) || arg === "--networkidle" || arg === "--network-idle") networkidle = true;
        else if (arg === "--text") {
          text = args[index + 1];
          index += 1;
        } else if (arg === "--selector") {
          selector = args[index + 1];
          index += 1;
        } else if (arg === "--request") {
          request = args[index + 1];
          index += 1;
        } else if (arg === "--response") {
          response = args[index + 1];
          index += 1;
        } else if (arg === "--method") {
          method = args[index + 1];
          index += 1;
        } else if (arg === "--status") {
          status = args[index + 1];
          index += 1;
        } else if (!arg.startsWith("--") && !target) target = arg;
        else throw new Error(`unsupported wait batch argument '${arg}'`);
      }
      return { ok: true, command: "wait", data: await managedWait({ target: networkidle ? undefined : target, text, selector, request, response, method, status, networkidle: networkidle || (target ? /^network[-_]?idle$/i.test(target) : false), sessionName }) };
    }
    case "state":
      if (args[0] === "save") return { ok: true, command: "state save", data: await managedStateSave(args[1], { sessionName }) };
      if (args[0] === "load" && args[1]) return { ok: true, command: "state load", data: await managedStateLoad(args[1], { sessionName }) };
      throw new Error(`unsupported state batch step '${rawStep}'`);
    case "locate": {
      const target = parseBatchStateTarget(args);
      if (!target) throw new Error(`batch step '${rawStep}' requires a target (--selector, --text, --role, --label, --placeholder, --test-id)`);
      return { ok: true, command: "locate", data: await managedLocate({ sessionName, target }) };
    }
    case "get": {
      const fact = args[0] as "text" | "value" | "count" | undefined;
      if (!fact || !["text", "value", "count"].includes(fact)) throw new Error(`batch step '${rawStep}' requires fact: text, value, or count`);
      const target = parseBatchStateTarget(args.slice(1));
      if (!target) throw new Error(`batch step '${rawStep}' requires a target after fact`);
      return { ok: true, command: `get ${fact}`, data: await managedGetFact({ sessionName, target, fact }) };
    }
    case "is": {
      const state = args[0] as "visible" | "enabled" | "checked" | undefined;
      if (!state || !["visible", "enabled", "checked"].includes(state)) throw new Error(`batch step '${rawStep}' requires state: visible, enabled, or checked`);
      const target = parseBatchStateTarget(args.slice(1));
      if (!target) throw new Error(`batch step '${rawStep}' requires a target after state`);
      return { ok: true, command: `is ${state}`, data: await managedIsState({ sessionName, target, state }) };
    }
    case "verify": {
      const assertion = args[0];
      if (!isVerifyAssertion(assertion)) {
        throw new Error(
          `batch step '${rawStep}' requires assertion: ${VERIFY_ASSERTIONS.join(", ")}`,
        );
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
        } else if (arg === "--equals" && assertion === "url") {
          url = { equals: remaining[index + 1] };
          index += 1;
        } else if (arg === "--matches") {
          url = { matches: remaining[index + 1] };
          index += 1;
        } else if (arg === "--equals" && assertion === "count") {
          count = { equals: Number(remaining[index + 1]) };
          index += 1;
        } else if (arg === "--min") {
          count = { min: Number(remaining[index + 1]) };
          index += 1;
        } else if (arg === "--max") {
          count = { max: Number(remaining[index + 1]) };
          index += 1;
        } else targetArgs.push(arg);
      }
      const target = parseBatchStateTarget(targetArgs);
      const needsTarget = assertion !== "url";
      const data = await managedVerify({
        sessionName,
        assertion,
        target: needsTarget ? target : undefined,
        url,
        count,
      });
      if (data.data.passed === false) {
        const error = new Error(`VERIFY_FAILED:verify ${assertion} failed`);
        (error as Error & { suggestions?: unknown }).suggestions = data.data.suggestions;
        throw error;
      }
      return { ok: true, command: `verify ${assertion}`, data };
    }
    default:
      throw new Error(unsupportedBatchStepMessage(tokens));
  }
}

function compactBatchSuccessResult(stepResult: Record<string, unknown>) {
  const commandResult =
    stepResult.data && typeof stepResult.data === "object" && !Array.isArray(stepResult.data)
      ? (stepResult.data as Record<string, unknown>)
      : {};
  const page =
    commandResult.page && typeof commandResult.page === "object" && !Array.isArray(commandResult.page)
      ? (commandResult.page as Record<string, unknown>)
      : undefined;
  const nestedData =
    commandResult.data && typeof commandResult.data === "object" && !Array.isArray(commandResult.data)
      ? (commandResult.data as Record<string, unknown>)
      : {};
  return {
    index: stepResult.index,
    argv: stepResult.argv,
    step: stepResult.step,
    ok: stepResult.ok,
    command: stepResult.command,
    ...(page
      ? { page: { pageId: page.pageId ?? null, navigationId: page.navigationId ?? null, url: page.url ?? null, title: page.title ?? null } }
      : {}),
    ...(nestedData.summary ? { summary: nestedData.summary } : {}),
  };
}

export async function runBatch(options: {
  sessionName: string;
  commands: string[][];
  continueOnError?: boolean;
  includeResults?: boolean;
  summaryOnly?: boolean;
}) {
  if (!options.commands.length) throw new Error("batch requires at least one step");
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
        failedSteps: [{ step: invalidStep.index + 1, command: invalidStep.tokens[0] ?? null, reasonCode: reasonCode ?? null }],
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
                error: { code: "BATCH_STEP_FAILED", message: invalidStep.message, ...(reasonCode ? { reasonCode } : {}), ...(suggestions ? { suggestions } : {}) },
              },
            ],
          }
        : {}),
    };
  }

  const results = [];
  const failedSteps: Array<{ step: number; command: string | null; reasonCode: string | null }> = [];
  let successCount = 0;
  let failedCount = 0;
  let firstFailedStep: number | null = null;
  let firstFailedCommand: string | null = null;
  let firstFailureReasonCode: string | null = null;
  let firstFailureMessage: string | null = null;
  let firstFailureSuggestions: string[] | null = null;

  for (const [index, argv] of options.commands.entries()) {
    try {
      const stepResult = { index, argv, step: formatBatchArgv(argv), ...(await executeBatchStep(argv, options.sessionName)) };
      if (!options.summaryOnly) {
        results.push(options.includeResults ? stepResult : compactBatchSuccessResult(stepResult as Record<string, unknown>));
      }
      successCount += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "batch step failed";
      const reasonCode = extractReasonCode(message);
      const suggestions = errorSuggestions(error) ?? buildBatchStepSuggestions(message);
      failedCount += 1;
      if (firstFailedStep === null) {
        firstFailedStep = index + 1;
        firstFailedCommand = argv[0] ?? null;
        firstFailureReasonCode = reasonCode ?? null;
        firstFailureMessage = message;
        firstFailureSuggestions = suggestions ?? null;
      }
      failedSteps.push({ step: index + 1, command: argv[0] ?? null, reasonCode: reasonCode ?? null });
      if (!options.summaryOnly) {
        results.push({
          ok: false,
          index,
          argv,
          step: formatBatchArgv(argv),
          error: { code: "BATCH_STEP_FAILED", message, ...(reasonCode ? { reasonCode } : {}), ...(suggestions ? { suggestions } : {}) },
        });
      }
      if (!options.continueOnError) break;
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
