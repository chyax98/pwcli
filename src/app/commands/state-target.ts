import type { StateTarget } from "../../infra/playwright/runtime.js";

export type StateTargetOptions = {
  selector?: string;
  text?: string;
  role?: string;
  name?: string;
  label?: string;
  placeholder?: string;
  testid?: string;
  nth?: string;
};

function parseNth(value?: string): number | undefined {
  if (!value) {
    return undefined;
  }
  const nth = Number(value);
  if (!Number.isInteger(nth) || nth < 1) {
    throw new Error("--nth requires a positive integer");
  }
  return nth;
}

export function parseStateTarget(options: StateTargetOptions): StateTarget {
  const targets = [
    options.selector,
    options.text,
    options.role,
    options.label,
    options.placeholder,
    options.testid,
  ].filter(Boolean);
  if (targets.length !== 1) {
    throw new Error(
      "provide exactly one target: --selector, --text, --role, --label, --placeholder, or --testid",
    );
  }
  const nth = parseNth(options.nth);
  if (options.selector) {
    return { selector: options.selector, ...(nth ? { nth } : {}) };
  }
  if (options.text) {
    return { text: options.text, ...(nth ? { nth } : {}) };
  }
  if (options.role) {
    return {
      role: options.role,
      ...(options.name ? { name: options.name } : {}),
      ...(nth ? { nth } : {}),
    };
  }
  if (options.label) {
    return { label: options.label, ...(nth ? { nth } : {}) };
  }
  if (options.placeholder) {
    return { placeholder: options.placeholder, ...(nth ? { nth } : {}) };
  }
  return { testid: options.testid as string, ...(nth ? { nth } : {}) };
}
