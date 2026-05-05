import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export type ActionCategory =
  | "navigate"
  | "interact"
  | "fill"
  | "code"
  | "download"
  | "upload"
  | "network"
  | "state"
  | "environment"
  | "storage"
  | "auth";

type ActionPolicy = {
  default?: "allow" | "deny";
  allow?: ActionCategory[];
  deny?: ActionCategory[];
};

function policyPath() {
  const env = process.env.PWCLI_ACTION_POLICY?.trim();
  return env ? resolve(env) : null;
}

async function loadPolicy(): Promise<ActionPolicy | null> {
  const path = policyPath();
  if (!path) return null;
  const text = await readFile(path, "utf8");
  return JSON.parse(text) as ActionPolicy;
}
export async function assertActionAllowed(category: ActionCategory, command: string) {
  const policy = await loadPolicy();
  if (!policy) return;
  const allow = Array.isArray(policy.allow) ? new Set(policy.allow) : null;
  const deny = Array.isArray(policy.deny) ? new Set(policy.deny) : null;
  const defaultMode = policy.default ?? "allow";

  let blocked = false;
  if (deny?.has(category)) blocked = true;
  else if (allow) blocked = !allow.has(category);
  else if (defaultMode === "deny") blocked = true;

  if (blocked) {
    throw new Error(`ACTION_POLICY_DENY:${category}:${command}:${policyPath() ?? ""}`);
  }
}
