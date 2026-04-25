import {
  managedClick,
  managedFill,
  managedOpen,
  managedPageCurrent,
  managedPageFrames,
  managedPageList,
  managedPress,
  managedReadText,
  managedRunCode,
  managedScroll,
  managedSnapshot,
  managedStateLoad,
  managedStateSave,
  managedType,
  managedWait,
} from "./managed.js";

function splitBatchStep(input: string) {
  const tokens = [];
  let current = "";
  let quote = null;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (quote) {
      if (char === quote) {
        quote = null;
      } else if (char === "\\" && index + 1 < input.length) {
        current += input[index + 1];
        index += 1;
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

async function executeBatchStep(rawStep: string, sessionName: string) {
  const tokens = splitBatchStep(rawStep);
  const [command, ...args] = tokens;

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
      throw new Error(`unsupported page batch step '${rawStep}'`);
    case "click":
      if (args.length !== 1) {
        throw new Error(`batch step '${rawStep}' requires exactly one ref`);
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
      const target = args[0];
      return {
        ok: true,
        command: "wait",
        data: await managedWait({
          target: target === "networkIdle" || target === "networkidle" ? undefined : target,
          networkidle: target === "networkIdle" || target === "networkidle",
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
      throw new Error(`unsupported batch step '${command}'`);
  }
}

export async function runBatch(options: {
  sessionName: string;
  steps: string[];
  continueOnError?: boolean;
}) {
  if (!options.steps.length) {
    throw new Error("batch requires at least one step");
  }

  const results = [];

  for (const rawStep of options.steps) {
    try {
      results.push(await executeBatchStep(rawStep, options.sessionName));
    } catch (error) {
      results.push({
        ok: false,
        command: rawStep,
        error: {
          code: "BATCH_STEP_FAILED",
          message: error instanceof Error ? error.message : "batch step failed",
        },
      });

      if (!options.continueOnError) {
        break;
      }
    }
  }

  return {
    completed: true,
    results,
  };
}
