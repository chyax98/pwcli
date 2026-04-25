async (page, args) => {
  const phone = String(args.phone ?? "").trim();
  const smsCode = String(args.smsCode ?? "000000").trim();
  const baseURL = String(args.baseURL ?? "")
    .trim()
    .replace(/\/$/, "");
  const targetUrl = String(args.targetUrl ?? `${baseURL}/forge`).trim();

  if (!phone) {
    throw new Error("dc-login requires phone");
  }
  if (!baseURL) {
    throw new Error("dc-login requires baseURL");
  }

  const loginPageUrl = `${baseURL}/forge/auth/login?refer=${encodeURIComponent(targetUrl)}`;
  let interceptedLoginUrlPayload = null;

  await page.route("**/api/auth/login/url**", async (route) => {
    const response = await route.fetch();
    const text = await response.text();
    let body = null;
    try {
      body = JSON.parse(text);
    } catch {}
    interceptedLoginUrlPayload = { status: response.status(), body, text };
    await route.fulfill({ response, body: text });
  });

  await page.goto(loginPageUrl);
  await page.waitForTimeout(2000);

  const payload = interceptedLoginUrlPayload;
  if (!payload) {
    throw new Error("dc-login failed to intercept /api/auth/login/url");
  }

  const loginEntryUrl = payload.body?.url || payload.body?.data?.url || "";

  if (!loginEntryUrl) {
    throw new Error("dc-login response did not include a business login URL");
  }

  await page.goto(loginEntryUrl);

  const authResult = await page.evaluate(
    async ({ phone: p, smsCode: s, loginEntryUrl: entry }) => {
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
          `DC_LOGIN_PHONE_LOGIN_FAILED:status=${phoneResp.status}:errorCode=${phoneBody?.error || "unknown"}`,
        );
      }

      const getVid = () => {
        const match = (globalThis.document?.cookie ?? "").match(
          /(?:^|;\s*)ACCOUNTS_USER_ID=([^;]+)/,
        );
        return match?.[1] || "0";
      };

      const buildAuthRequest = (vid) => {
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

  if (!authResult?.redirectUri) {
    throw new Error("dc-login did not receive redirectUri");
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
    pageState: await page.evaluate(() => ({
      url: window.location.href,
      title: document.title,
      readyState: document.readyState,
      heading: document.querySelector("h1")?.textContent ?? "",
    })),
  };
};
