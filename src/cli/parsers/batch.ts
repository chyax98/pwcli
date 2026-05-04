import type { SemanticTarget } from "#engine/act/element.js";
import type { StateTarget } from "#engine/observe.js";

export type BatchActionTarget = {
  ref?: string;
  selector?: string;
  semantic?: SemanticTarget;
  trailingValues: string[];
};

export function parseBatchSemanticArgs(args: string[], commandName: string): BatchActionTarget {
  let ref: string | undefined;
  let selector: string | undefined;
  let text: string | undefined;
  let role: string | undefined;
  let name: string | undefined;
  let label: string | undefined;
  let placeholder: string | undefined;
  let testId: string | undefined;
  let nth: number | undefined;
  const trailingValues: string[] = [];

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
    if (!arg.startsWith("--")) {
      trailingValues.push(arg);
      continue;
    }
    throw new Error(
      `unsupported ${commandName} batch argument '${arg}'; run the single pw ${commandName} command outside batch for unsupported flags`,
    );
  }

  const semanticTargets = [text, role, label, placeholder, testId].filter(Boolean).length;
  const hasSemanticOrSelector = selector || semanticTargets > 0;
  if (!hasSemanticOrSelector && trailingValues.length > 0) {
    ref = trailingValues.shift();
  }

  const targetCount = [ref, selector].filter(Boolean).length + semanticTargets;
  if (targetCount > 1) {
    throw new Error(
      `batch ${commandName} accepts exactly one target: ref, --selector, --text, --role, --label, --placeholder, or --test-id`,
    );
  }
  if (args.includes("--selector") && !selector)
    throw new Error(`batch ${commandName} requires a selector after --selector`);
  if (args.includes("--text") && !text)
    throw new Error(`batch ${commandName} requires text after --text`);
  if (args.includes("--role") && !role)
    throw new Error(`batch ${commandName} requires a role after --role`);
  if (args.includes("--name") && !name)
    throw new Error(`batch ${commandName} requires a name after --name`);
  if (args.includes("--label") && !label)
    throw new Error(`batch ${commandName} requires a label after --label`);
  if (args.includes("--placeholder") && !placeholder)
    throw new Error(`batch ${commandName} requires text after --placeholder`);
  if ((args.includes("--test-id") || args.includes("--testid")) && !testId) {
    throw new Error(`batch ${commandName} requires an id after --test-id`);
  }
  if (args.includes("--nth") && (!Number.isInteger(nth) || (nth ?? 0) < 1)) {
    throw new Error(`batch ${commandName} requires a positive integer after --nth`);
  }
  if (name && !role) throw new Error(`batch ${commandName} supports --name only with --role`);
  if (nth && !text && !role && !label && !placeholder && !testId) {
    throw new Error(`batch ${commandName} supports --nth only with a semantic locator`);
  }

  if (text) return { semantic: { kind: "text", text, ...(nth ? { nth } : {}) }, trailingValues };
  if (role) {
    return {
      semantic: { kind: "role", role, ...(name ? { name } : {}), ...(nth ? { nth } : {}) },
      trailingValues,
    };
  }
  if (label) return { semantic: { kind: "label", label, ...(nth ? { nth } : {}) }, trailingValues };
  if (placeholder) {
    return {
      semantic: { kind: "placeholder", placeholder, ...(nth ? { nth } : {}) },
      trailingValues,
    };
  }
  if (testId)
    return {
      semantic: { kind: "testid", testid: testId, ...(nth ? { nth } : {}) },
      trailingValues,
    };
  if (selector) return { selector, trailingValues };
  if (ref) return { ref, trailingValues };
  return { trailingValues };
}

export function parseBatchStateTarget(args: string[]): StateTarget | undefined {
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
      const raw = args[index + 1];
      const parsed = raw ? Number(raw) : NaN;
      if (!Number.isInteger(parsed) || parsed < 1) {
        throw new Error("batch --nth requires a positive integer");
      }
      nth = parsed;
      index += 1;
      continue;
    }
    throw new Error(`unsupported batch argument '${arg}'`);
  }

  if (selector) return { selector };
  if (role) return { role, ...(name ? { name } : {}), ...(nth ? { nth } : {}) };
  if (text) return { text, ...(nth ? { nth } : {}) };
  if (label) return { label, ...(nth ? { nth } : {}) };
  if (placeholder) return { placeholder, ...(nth ? { nth } : {}) };
  if (testId) return { testid: testId, ...(nth ? { nth } : {}) };
  return undefined;
}
