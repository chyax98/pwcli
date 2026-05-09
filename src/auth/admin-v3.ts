import type { AuthProviderSpec } from "./registry.js";

type AdminV3AuthPage = {
  url(): string;
  goto(url: string): Promise<unknown>;
  waitForTimeout(ms: number): Promise<void>;
  waitForLoadState(state: string): Promise<unknown>;
  evaluate<TResult>(fn: () => TResult | Promise<TResult>): Promise<TResult>;
  evaluate<TArg, TResult>(
    fn: (arg: TArg) => TResult | Promise<TResult>,
    arg: TArg,
  ): Promise<TResult>;
};

const DEFAULT_PHONE = "19545672859";
const DEFAULT_SMS_CODE = "000000";
const DEFAULT_BASE_URL = "https://www.xdrnd.cn";
const DEFAULT_TARGET_PATH = "/admin-v3";

const adminV3ProviderSource = String(
  async (page: AdminV3AuthPage, args: Record<string, string | undefined>) => {
    const phone = String(args.phone ?? DEFAULT_PHONE).trim();
    const smsCode = String(args.smsCode ?? DEFAULT_SMS_CODE).trim();
    const baseURL = String(args.baseURL ?? DEFAULT_BASE_URL)
      .trim()
      .replace(/\/$/, "");
    const targetUrl = String(args.targetUrl ?? "").trim() || `${baseURL}${DEFAULT_TARGET_PATH}`;

    if (!phone) {
      throw new Error("admin-v3 auth requires phone");
    }
    if (!baseURL || !targetUrl) {
      throw new Error("ADMIN_V3_AUTH_URL_REQUIRED: admin-v3 auth requires baseURL and targetUrl");
    }

    // ── 步骤 1：在 accounts 登录页执行 phone login API ──
    const accountsLoginUrl = "https://accounts.xdrnd.cn/login";
    await page.goto(accountsLoginUrl);
    await page.waitForTimeout(2000);

    const phoneResult = await page.evaluate(
      async ({ p, s }: { p: string; s: string }) => {
        const uid = crypto.randomUUID();
        const baseXua = `V=1&PN=Accounts&LANG=zh_CN&VN_CODE=10&LOC=CN&PLT=PC&DS=Android&UID=${uid}&OS=MacOS&OSV=10.15.7&DT=PC`;

        const resp = await fetch(`/api/phone/login?X-UA=${encodeURIComponent(baseXua)}`, {
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
        const body = await resp.json().catch(() => undefined);
        if (!resp.ok) {
          throw new Error(
            `PHONE_LOGIN_FAILED:status=${resp.status}:errorCode=${body?.error || "unknown"}`,
          );
        }
        return { ok: true };
      },
      { p: phone, s: smsCode },
    );

    if (!phoneResult?.ok) {
      throw new Error("ADMIN_V3_PHONE_LOGIN_FAILED: phone login did not return ok");
    }

    // ── 步骤 2：触发 www.xdrnd.cn 的 OAuth 自动完成 ──
    const authLoginUrl = `${baseURL}/auth/login?referer=${encodeURIComponent(targetUrl)}`;
    await page.goto(authLoginUrl).catch(() => {});
    await page.waitForTimeout(3000);

    // 检查点：如果已直接落在目标页或首页，都算成功
    const urlAfterAuth = page.url();
    const isLoggedIn =
      urlAfterAuth.includes("/admin-v3") ||
      urlAfterAuth === `${baseURL}/` ||
      urlAfterAuth === baseURL;

    if (isLoggedIn) {
      // 如果落在首页，手动导航到目标页
      if (!urlAfterAuth.includes("/admin-v3")) {
        await page.goto(targetUrl).catch(() => {});
        await page.waitForTimeout(2000);
      }
      return {
        ok: true,
        resolvedTargetUrl: targetUrl,
        baseURL,
        pageState: await page.evaluate(() => ({
          url: window.location.href,
          title: document.title,
          readyState: document.readyState,
          heading: document.querySelector("h1")?.textContent ?? "",
        })),
      };
    }

    // ── 步骤 3：兜底，直接导航到目标页 ──
    await page.goto(targetUrl).catch(() => {});
    await page.waitForTimeout(2000);
    await page.waitForLoadState("networkidle").catch(() => {});

    const finalUrl = page.url();
    if (finalUrl.includes("/login")) {
      throw new Error(`ADMIN_V3_AUTH_FAILED: still on login page after full flow. url=${finalUrl}`);
    }

    return {
      ok: true,
      resolvedTargetUrl: targetUrl,
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

export const adminV3AuthProvider: AuthProviderSpec = {
  name: "admin-v3",
  summary: "TapTap Admin V3 登录 provider",
  description:
    "在现有 session 内执行 TapTap Admin V3 登录。使用 accounts 站点的 phone login API + /auth/login OAuth 自动完成。",
  source: adminV3ProviderSource,
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
      description: "最终想落到的 admin-v3 页面 URL；默认从 baseURL 推导。",
    },
    {
      name: "baseURL",
      defaultValue: DEFAULT_BASE_URL,
      description: "admin-v3 基础域名。默认 https://www.xdrnd.cn。",
    },
  ],
  examples: [
    "pw auth admin-v3 -s admin-main",
    "pw auth admin-v3 -s admin-main --arg targetUrl='https://www.xdrnd.cn/admin-v3/app-manage/app-list'",
    "pw auth admin-v3 -s admin-main --arg baseURL='https://www.xdrnd.cn'",
  ],
  notes: [
    "`targetUrl` 是业务目标 URL；不传时默认 `${baseURL}/admin-v3`。",
    "`phone`、`smsCode` 是 accounts 站点的登录参数。",
    "`auth admin-v3` 只在现有 session 内执行登录，不创建 session。",
  ],
  resolveArgs: resolveAdminV3Args,
};

async function resolveAdminV3Args(
  providerArgs: Record<string, string>,
): Promise<Record<string, string>> {
  const phone = pickFirst(providerArgs.phone) ?? DEFAULT_PHONE;
  const smsCode = pickFirst(providerArgs.smsCode) ?? DEFAULT_SMS_CODE;
  const explicitTargetUrl = pickFirst(providerArgs.targetUrl);
  const explicitBaseURL = pickFirst(providerArgs.baseURL);

  const resolved: Record<string, string> = {
    ...providerArgs,
    phone,
    smsCode,
  };

  if (explicitBaseURL) {
    resolved.baseURL = explicitBaseURL.replace(/\/$/, "");
  } else {
    resolved.baseURL = DEFAULT_BASE_URL;
  }

  if (explicitTargetUrl) {
    resolved.targetUrl = explicitTargetUrl;
  } else {
    resolved.targetUrl = `${resolved.baseURL}${DEFAULT_TARGET_PATH}`;
  }

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
