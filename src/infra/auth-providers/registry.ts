import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolveDcLoginArgs } from "../plugins/dc-login-config.js";

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
  bundledSourcePath: string;
  args: AuthProviderArgSpec[];
  examples: string[];
  notes?: string[];
  resolveArgs?: (args: Record<string, string>) => Promise<Record<string, string>>;
};

const bundledDcLoginPath = fileURLToPath(new URL("../../../plugins/dc-login.js", import.meta.url));
const bundledFixtureAuthPath = fileURLToPath(
  new URL("../../../plugins/fixture-auth.js", import.meta.url),
);

const AUTH_PROVIDERS: AuthProviderSpec[] = [
  {
    name: "dc-login",
    summary: "TapTap/Forge 开发环境登录 provider",
    description:
      "在现有 session 内执行 DC 登录链，适用于 Forge / DC 任务。优先使用运行时参数，`smsCode` 默认 `000000`。",
    bundledSourcePath: bundledDcLoginPath,
    args: [
      {
        name: "phone",
        required: true,
        description: "登录手机号。",
      },
      {
        name: "smsCode",
        defaultValue: "000000",
        description: "短信验证码，默认使用开发环境常见万能码。",
      },
      {
        name: "targetUrl",
        description: "最终想落到的业务页面 URL；传了它就会自动推导 baseURL。",
      },
      {
        name: "baseURL",
        description: "Forge / DC 基础域名，例如 https://developer-192-168-5-18.tap.dev。",
      },
      {
        name: "instance",
        description: "本地 Forge dev 实例编号 0|1|2；会探测本地端口后推导 baseURL。",
      },
    ],
    examples: [
      "pw auth dc-login --session dc-forge --arg phone=13800138000 --arg targetUrl='https://developer-192-168-5-18.tap.dev/forge'",
      "pw auth dc-login --session dc-forge --arg phone=13800138000 --arg instance=0",
    ],
    notes: [
      "如果提供了 targetUrl，会直接从 targetUrl 推导 baseURL。",
      "如果没有提供 targetUrl/baseURL，但只探测到一个本地 Forge dev instance，会自动推导 baseURL。",
      "如果同时存在多个本地 Forge dev instance，需要显式传 instance 或 baseURL。",
    ],
    resolveArgs: resolveDcLoginArgs,
  },
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
