import type { StateTarget } from "../../domain/interaction/service.js";

export type StateTargetOptions = {
  selector?: string;
  text?: string;
  role?: string;
  name?: string;
  testid?: string;
};

export function parseStateTarget(options: StateTargetOptions): StateTarget {
  const targets = [options.selector, options.text, options.role, options.testid].filter(Boolean);
  if (targets.length !== 1) {
    throw new Error("provide exactly one target: --selector, --text, --role, or --testid");
  }
  if (options.selector) {
    return { selector: options.selector };
  }
  if (options.text) {
    return { text: options.text };
  }
  if (options.role) {
    return { role: options.role, ...(options.name ? { name: options.name } : {}) };
  }
  return { testid: options.testid as string };
}
