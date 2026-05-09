import { networkInterfaces } from "node:os";
import type { AuthProviderSpec } from "./registry.js";

type DcAuthRoute = {
  fetch(): Promise<{
    text(): Promise<string>;
    status(): number;
  }>;
  fulfill(options: { response: unknown; body: string }): Promise<void>;
};

type DcAuthPage = {
  url(): string;
  route(pattern: string, handler: (route: DcAuthRoute) => Promise<void>): Promise<void>;
  unroute(pattern: string): Promise<void>;
  goto(url: string): Promise<unknown>;
  waitForTimeout(ms: number): Promise<void>;
  waitForLoadState(state: string): Promise<unknown>;
  waitForURL(predicate: (url: URL) => boolean, options?: { timeout: number }): Promise<unknown>;
  evaluate<TResult>(fn: () => TResult | Promise<TResult>): Promise<TResult>;
  evaluate<TArg, TResult>(
    fn: (arg: TArg) => TResult | Promise<TResult>,
    arg: TArg,
  ): Promise<TResult>;
};

type LoginUrlPayload = {
  status: number;
  body: {
    url?: string;
    data?: {
      url?: string;
    };
  } | null;
  text: string;
};

const DEFAULT_PHONE = "19545672859";
const DEFAULT_SMS_CODE = "000000";
const DEVELOPER_SUBDOMAIN = "developer";
const DEFAULT_DC_APP_PATH = "/v3";

const dcProviderSource = String(
  async (page: DcAuthPage, args: Record<string, string | undefined>) => {
    const normalizeAppPath = (raw: unknown) => {
      const value = String(raw || "/v3").trim() || "/v3";
      return value.startsWith("/")
        ? value.replace(/\/$/, "") || "/"
        : `/${value.replace(/\/$/, "")}`;
    };
    const dcAppPath = normalizeAppPath(args.appPath);
    const dcLoginPath = `${dcAppPath}/auth/login`;

    const originFromUrl = (raw: unknown) => {
      const match = String(raw || "").match(/^(https?:\/\/[^/]+)(?:\/.*)?$/);
      return match?.[1] || "";
    };

    const phone = String(args.phone ?? "19545672859").trim();
    const smsCode = String(args.smsCode ?? "000000").trim();
    const baseURL = String(args.baseURL ?? "")
      .trim()
      .replace(/\/$/, "");
    const targetUrl = String(args.targetUrl ?? "").trim();
    const resolvedBy = String(args.resolvedBy ?? "arg").trim();

    if (!phone) {
      throw new Error("dc auth requires phone");
    }
    if (!baseURL || !targetUrl) {
      throw new Error(
        "DC_AUTH_URL_REQUIRED: dc auth could not resolve DC target URL. Pass --arg targetUrl=<url> or run from an existing DC page.",
      );
    }

    const loginPageUrl = `${baseURL}${dcLoginPath}?refer=${encodeURIComponent(targetUrl)}`;

    let interceptedLoginUrlPayload: LoginUrlPayload | null = null;

    await page.route("**/api/auth/login/url**", async (route: DcAuthRoute) => {
      const response = await route.fetch();
      const text = await response.text();
      let body = null;
      try {
        body = JSON.parse(text);
      } catch {}
      interceptedLoginUrlPayload = { status: response.status(), body, text };
      await route.fulfill({ response, body: text });
    });

    try {
      await page.goto(loginPageUrl);
    } catch (error) {
      throw new Error(
        `DC_AUTH_URL_UNREACHABLE: failed to open ${loginPageUrl}. ${resolvedBy ? `resolvedBy=${resolvedBy}. ` : ""}Pass --arg targetUrl=<target-url>. cause=${error instanceof Error ? error.message : String(error)}`,
      );
    }
    await page.waitForTimeout(2000);

    const payload = interceptedLoginUrlPayload as LoginUrlPayload | null;
    if (!payload) {
      throw new Error(
        `DC_AUTH_LOGIN_URL_NOT_FOUND: dc auth failed to intercept /api/auth/login/url at ${loginPageUrl}. Pass --arg targetUrl=<target-url>.`,
      );
    }

    const loginEntryUrl = payload.body?.url || payload.body?.data?.url || "";

    if (!loginEntryUrl) {
      throw new Error("dc auth response did not include a business login URL");
    }

    await page.unroute("**/api/auth/login/url**");
    await page.goto(loginEntryUrl).catch(() => {});

    // authorize 可能检测到已登录态并自动跳转到 callback
    await page.waitForTimeout(3000);
    const currentUrl = page.url();
    if (!currentUrl.includes("/login") && !currentUrl.includes("authorize")) {
      return {
        ok: true,
        resolvedTargetUrl: targetUrl,
        resolvedBy,
        baseURL,
        pageState: await page.evaluate(() => ({
          url: window.location.href,
          title: document.title,
          readyState: document.readyState,
          heading: document.querySelector("h1")?.textContent ?? "",
        })),
      };
    }

    // 等页面稳定后再执行 evaluate
    await page.waitForTimeout(3000);

    let authResult: { redirectUri?: string } | undefined;
    try {
      authResult = await page.evaluate(
        async ({
          phone: p,
          smsCode: s,
          loginEntryUrl: entry,
        }: {
          phone: string;
          smsCode: string;
          loginEntryUrl: string;
        }) => {
          const authorizeUrl = new URL(entry);
          const callbackUrl = authorizeUrl.searchParams.get("redirect_uri");
          const clientId = authorizeUrl.searchParams.get("client_id");
          const state = authorizeUrl.searchParams.get("state");
          const scope = authorizeUrl.searchParams.get("scope") || "public_profile";
          const uid = crypto.randomUUID();
          const baseXua = `V=1&PN=Accounts&LANG=zh_CN&VN_CODE=10&LOC=CN&PLT=PC&DS=Android&UID=${uid}&OS=MacOS&OSV=10.15.7&DT=PC`;

          const phoneResp = await fetch(`/api/phone/login?X-UA=${encodeURIComponent(baseXua)}`, {
            method: "POST",
            headers: {
              Accept: "application/json, text/plain, */*",
              "Content-Type": "application/x-www-form-urlencoded",
              "X-Requested-With": "XMLHttpRequest",
              "X-UA": baseXua,
            },
            body: new URLSearchParams({
              phone_code: s,
              phone_number: `+86${p}`,
              session_id: "",
              session_type: "",
            }).toString(),
          });
          const phoneBody = await phoneResp.json().catch(() => undefined);
          if (!phoneResp.ok) {
            throw new Error(
              `DC_AUTH_PHONE_LOGIN_FAILED:status=${phoneResp.status}:errorCode=${phoneBody?.error || "unknown"}`,
            );
          }

          const getVid = () => {
            const match = (globalThis.document?.cookie ?? "").match(
              /(?:^|;\s*)ACCOUNTS_USER_ID=([^;]+)/,
            );
            return match?.[1] || "0";
          };

          const buildAuthRequest = (vid: string) => {
            const xua = `${baseXua.replace("&DT=PC", "")}&VID=${vid}&DT=PC`;
            const parameters = new URLSearchParams({
              client_id: clientId || "",
              redirect_uri: callbackUrl || "",
              response_type: "code",
              state: state || "",
              scope,
              session_id: "",
              session_type: "",
            }).toString();
            return {
              xua,
              url: `/api/oauth2/auth/v2?parameters=${encodeURIComponent(parameters)}&X-UA=${encodeURIComponent(xua)}`,
            };
          };

          let authInfo = buildAuthRequest(getVid());
          let authResp = await fetch(authInfo.url, {
            headers: {
              Accept: "application/json, text/plain, */*",
              "X-Requested-With": "XMLHttpRequest",
              "X-UA": authInfo.xua,
            },
          });
          let authBody = await authResp.json().catch(() => undefined);

          if (authBody?.data?.error === "invalid_xua") {
            authInfo = buildAuthRequest(getVid());
            authResp = await fetch(authInfo.url, {
              headers: {
                Accept: "application/json, text/plain, */*",
                "X-Requested-With": "XMLHttpRequest",
                "X-UA": authInfo.xua,
              },
            });
            authBody = await authResp.json().catch(() => undefined);
          }

          return {
            redirectUri: authBody?.data?.redirect_uri || "",
          };
        },
        {
          phone,
          smsCode,
          loginEntryUrl,
        },
      );
    } catch (evaluateError) {
      const fallbackUrl = page.url();
      if (!fallbackUrl.includes("/login") && !fallbackUrl.includes("authorize")) {
        return {
          ok: true,
          resolvedTargetUrl: targetUrl,
          resolvedBy,
          baseURL,
          pageState: await page.evaluate(() => ({
            url: window.location.href,
            title: document.title,
            readyState: document.readyState,
            heading: document.querySelector("h1")?.textContent ?? "",
          })),
        };
      }
      throw evaluateError;
    }

    if (!authResult?.redirectUri) {
      throw new Error("dc auth did not receive redirectUri");
    }

    const redirectUri = authResult.redirectUri.replace(/^http:\/\//, "https://");
    await page.goto(redirectUri);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page
      .waitForURL((url) => !url.href.includes("/auth/callback/taptap"), {
        timeout: 20000,
      })
      .catch(() => {});

    return {
      ok: true,
      resolvedTargetUrl: targetUrl,
      resolvedBy,
      baseURL,
      pageState: await page.evaluate(() => ({
        url: window.location.href,
        title: document.title,
        readyState: document.readyState,
        heading: document.querySelector("h1")?.textContent ?? "",
      })),
    };
  },
);

export const dcAuthProvider: AuthProviderSpec = {
  name: "dc",
  summary: "TapTap/DC 登录 provider",
  description: "在现有 session 内执行 DC 登录链。provider 参数统一使用 --arg key=value。",
  source: dcProviderSource,
  args: [
    {
      name: "phone",
      defaultValue: DEFAULT_PHONE,
      description: "登录手机号，默认测试账号。",
    },
    {
      name: "smsCode",
      defaultValue: DEFAULT_SMS_CODE,
      description: "短信验证码，默认使用开发环境万能码。",
    },
    {
      name: "targetUrl",
      description: "最终想落到的业务页面 URL；传了它就会自动推导 baseURL。",
    },
    {
      name: "baseURL",
      description: "DC 基础域名。通常不需要传，优先从当前页面或 targetUrl 推导。",
    },
    {
      name: "appPath",
      defaultValue: DEFAULT_DC_APP_PATH,
      description: "DC 应用路径后缀，默认 /v3；后续 DCNext 路径变更时可覆盖。",
    },
  ],
  examples: [
    "pw auth dc --session dc2",
    "pw auth dc --session dc2 --arg targetUrl='<target-url>'",
    "pw auth dc --session dc2 --arg baseURL='<base-url>' --arg appPath=/v3",
    "pw auth dc --session dc2 --arg phone=19545672859",
  ],
  notes: [
    "`targetUrl` 是业务目标 URL；传入后 provider 会推导 `baseURL` 。",
    "`phone`、`smsCode`、`baseURL`、`appPath` 都是普通 provider 参数。",
    "`auth dc` 只在现有 session 内执行登录，不创建 session。",
  ],
  resolveArgs: resolveDcArgs,
};

async function resolveDcArgs(
  providerArgs: Record<string, string>,
): Promise<Record<string, string>> {
  if (providerArgs.instance) {
    throw new Error("dc auth no longer accepts --arg instance. Pass --arg targetUrl=<url>.");
  }

  const phone = pickFirst(providerArgs.phone) ?? DEFAULT_PHONE;
  const smsCode = pickFirst(providerArgs.smsCode) ?? DEFAULT_SMS_CODE;
  const explicitTargetUrl = pickFirst(providerArgs.targetUrl);
  const explicitBaseURL = pickFirst(providerArgs.baseURL);

  const resolved: Record<string, string> = {
    ...providerArgs,
    phone,
    smsCode,
  };

  if (explicitTargetUrl) {
    resolved.targetUrl = explicitTargetUrl;
    resolved.baseURL = normalizeBaseURL(explicitTargetUrl);
    resolved.resolvedBy = "targetUrl";
    return resolved;
  }

  if (explicitBaseURL) {
    resolved.baseURL = normalizeBaseURL(explicitBaseURL);
    resolved.targetUrl = `${resolved.baseURL}${String(providerArgs.appPath || DEFAULT_DC_APP_PATH)}`;
    resolved.resolvedBy = "baseURL";
    return resolved;
  }

  const localBaseURL = buildLocalDcBaseURL(getLocalIp());
  resolved.baseURL = localBaseURL;
  resolved.targetUrl = `${localBaseURL}${String(providerArgs.appPath || DEFAULT_DC_APP_PATH)}`;
  resolved.resolvedBy = "local-ip";
  return resolved;
}

function pickFirst(...values: Array<string | undefined>) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function normalizeBaseURL(raw: string) {
  const normalized = new URL(raw);
  return `${normalized.protocol}//${normalized.host}`;
}

function buildLocalDcTargetUrl(appPath = DEFAULT_DC_APP_PATH) {
  return `${buildLocalDcBaseURL(getLocalIp())}${appPath}`;
}

function buildLocalDcBaseURL(localIp: string) {
  const label = localIp.replace(/\./g, "-");
  return `https://${DEVELOPER_SUBDOMAIN}-${label}.tap.dev`;
}

function isPrivateIpv4(address: string) {
  return (
    /^10\./.test(address) ||
    /^192\.168\./.test(address) ||
    /^172\.(?:1[6-9]|2\d|3[01])\./.test(address)
  );
}

function getLocalIp() {
  const candidates = Object.entries(networkInterfaces()).flatMap(([name, addresses]) =>
    (addresses ?? [])
      .filter((address) => address.family === "IPv4" && !address.internal)
      .map((address) => ({ name, address: address.address })),
  );

  const preferred = candidates.find(
    (candidate) => /^(?:en|eth|wlan)/.test(candidate.name) && isPrivateIpv4(candidate.address),
  );

  return (
    preferred?.address ??
    candidates.find((candidate) => isPrivateIpv4(candidate.address))?.address ??
    "127.0.0.1"
  );
}
