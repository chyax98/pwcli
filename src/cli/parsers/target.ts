import type { SemanticTarget } from "#engine/act/element.js";
import type { StateTarget } from "#engine/observe.js";

export type StateTargetOptions = {
  selector?: string;
  text?: string;
  role?: string;
  name?: string;
  label?: string;
  placeholder?: string;
  testId?: string;
  testid?: string;
  "test-id"?: string;
  nth?: string | number;
};

export function parseNth(value?: string | number): number | undefined {
  if (value === undefined || value === "") return undefined;
  const nth = Number(value);
  if (!Number.isInteger(nth) || nth < 1) {
    throw new Error("--nth requires a positive integer");
  }
  return nth;
}

export function buildSemanticTarget(args: StateTargetOptions): SemanticTarget | undefined {
  const nth = parseNth(args.nth);
  const testid = args["test-id"] ?? args.testId ?? args.testid;
  const semanticTargets = [args.text, args.role, args.label, args.placeholder, testid].filter(
    Boolean,
  );
  if (semanticTargets.length === 0) return undefined;
  if (semanticTargets.length > 1) {
    throw new Error(
      "provide at most one semantic locator: --text, --role, --label, --placeholder, or --test-id",
    );
  }
  if (args.name && !args.role) {
    throw new Error("--name is only valid with --role");
  }
  if (args.text) return { kind: "text", text: args.text, ...(nth ? { nth } : {}) };
  if (args.role) {
    return {
      kind: "role",
      role: args.role,
      ...(args.name ? { name: args.name } : {}),
      ...(nth ? { nth } : {}),
    };
  }
  if (args.label) return { kind: "label", label: args.label, ...(nth ? { nth } : {}) };
  if (args.placeholder) {
    return { kind: "placeholder", placeholder: args.placeholder, ...(nth ? { nth } : {}) };
  }
  return { kind: "testid", testid: testid as string, ...(nth ? { nth } : {}) };
}

export function parseStateTarget(options: StateTargetOptions): StateTarget {
  const testid = options["test-id"] ?? options.testId ?? options.testid;
  const targets = [
    options.selector,
    options.text,
    options.role,
    options.label,
    options.placeholder,
    testid,
  ].filter(Boolean);
  if (targets.length !== 1) {
    throw new Error(
      "provide exactly one target: --selector, --text, --role, --label, --placeholder, or --test-id",
    );
  }
  const nth = parseNth(options.nth);
  if (options.selector) return { selector: options.selector, ...(nth ? { nth } : {}) };
  if (options.text) return { text: options.text, ...(nth ? { nth } : {}) };
  if (options.role) {
    return {
      role: options.role,
      ...(options.name ? { name: options.name } : {}),
      ...(nth ? { nth } : {}),
    };
  }
  if (options.label) return { label: options.label, ...(nth ? { nth } : {}) };
  if (options.placeholder) return { placeholder: options.placeholder, ...(nth ? { nth } : {}) };
  return { testid: testid as string, ...(nth ? { nth } : {}) };
}
