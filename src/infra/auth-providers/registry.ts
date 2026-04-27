import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dcAuthProvider } from "./dc.js";

export type AuthProviderArgSpec = {
  name: string;
  required?: boolean;
  defaultValue?: string;
  description: string;
};

export type AuthProviderSpec = {
  name: string;
  summary: string;
  description: string;
  bundledSourcePath?: string;
  source?: string;
  args: AuthProviderArgSpec[];
  examples: string[];
  notes?: string[];
  resolveArgs?: (args: Record<string, string>) => Promise<Record<string, string>>;
};

const bundledFixtureAuthPath = fileURLToPath(
  new URL("../../../plugins/fixture-auth.js", import.meta.url),
);

const AUTH_PROVIDERS: AuthProviderSpec[] = [
  dcAuthProvider,
  {
    name: "fixture-auth",
    summary: "内部测试 provider，仅用于 auth contract 回归验证",
    description:
      "在当前页面 origin 上写入 cookie 和 localStorage，用于验证 auth provider 执行链与 save-state 行为。",
    bundledSourcePath: bundledFixtureAuthPath,
    args: [
      {
        name: "marker",
        defaultValue: "fixture-auth",
        description: "写入 cookie/localStorage 的标记值。",
      },
      {
        name: "path",
        defaultValue: "/",
        description: "写入 cookie 时使用的 path。",
      },
    ],
    examples: [
      "pw auth fixture-auth --session bug-a --arg marker=smoke-auth",
      "pw auth fixture-auth --session bug-a --arg marker=smoke-auth --save-state ./auth.json",
    ],
    notes: ["仅用于本地 smoke / e2e / contract 回归，不是业务登录能力。"],
  },
];

export function listAuthProviders() {
  return AUTH_PROVIDERS.map((provider) => ({
    name: provider.name,
    summary: provider.summary,
  }));
}

export function getAuthProvider(name: string) {
  return AUTH_PROVIDERS.find((provider) => provider.name === name) ?? null;
}

export function loadAuthProviderSource(provider: AuthProviderSpec) {
  if (provider.source) {
    return provider.source;
  }
  if (!provider.bundledSourcePath) {
    throw new Error(`auth provider '${provider.name}' has no source`);
  }
  return readFileSync(provider.bundledSourcePath, "utf8");
}

export function parseKeyValueArgs(values?: string[]) {
  const args: Record<string, string> = {};
  for (const item of values ?? []) {
    const index = item.indexOf("=");
    if (index <= 0) {
      throw new Error(`expected key=value, got '${item}'`);
    }
    args[item.slice(0, index)] = item.slice(index + 1);
  }
  return args;
}
