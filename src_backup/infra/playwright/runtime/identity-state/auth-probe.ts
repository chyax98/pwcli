import { managedRunCode } from "../code.js";
import { maybeRawOutput } from "../shared.js";

export type AuthProbeStatus = "authenticated" | "anonymous" | "uncertain";
export type AuthProbeConfidence = "high" | "medium" | "low";
export type AuthProbeBlockedState =
  | "none"
  | "challenge"
  | "two_factor"
  | "interstitial"
  | "unknown";
export type AuthProbeRecommendedAction =
  | "continue"
  | "save_state"
  | "inspect"
  | "reauth"
  | "human_handoff";

export type AuthProbeCapability = {
  capability: "auth-state-probe";
  supported: true;
  available: boolean;
  blocked: boolean;
  reusableStateLikely: boolean;
  status: AuthProbeStatus;
  confidence: AuthProbeConfidence;
  recommendedAction: AuthProbeRecommendedAction;
};

export type AuthProbeOptions = {
  sessionName?: string;
  url?: string;
};

function buildAuthProbeCapability(
  status: AuthProbeStatus,
  blockedState: AuthProbeBlockedState,
  confidence: AuthProbeConfidence,
  recommendedAction: AuthProbeRecommendedAction,
): AuthProbeCapability {
  const available = status === "authenticated" && blockedState === "none";
  return {
    capability: "auth-state-probe",
    supported: true,
    available,
    blocked: blockedState !== "none",
    reusableStateLikely: available,
    status,
    confidence,
    recommendedAction,
  };
}

function buildAuthProbeSource(targetUrl?: string) {
  const keywordSets = {
    account: [
      "sign out",
      "log out",
      "logout",
      "my account",
      "account settings",
      "profile",
      "workspace",
      "dashboard",
    ],
    login: ["sign in", "log in", "login", "continue with", "forgot password", "password"],
    challenge: [
      "verify you are human",
      "security check",
      "security challenge",
      "robot check",
      "captcha",
      "cloudflare",
      "access denied",
    ],
    twoFactor: [
      "two-factor",
      "2fa",
      "two step verification",
      "verification code",
      "one-time code",
      "authenticator app",
    ],
    interstitial: [
      "before you continue",
      "continue to site",
      "additional verification",
      "confirm your identity",
      "approve sign in",
      "forbidden",
      "not authorized",
    ],
  };
  return `async page => {
    const requestedUrl = ${JSON.stringify(targetUrl ?? null)};
    if (requestedUrl)
      await page.goto(requestedUrl, { waitUntil: 'domcontentloaded' });
    const keywordSets = ${JSON.stringify(keywordSets)};
    const currentUrl = page.url();
    const title = await page.title().catch(() => '');
    const pageInspection = await page.evaluate((input) => {
      const href = globalThis.location?.href ?? '';
      const origin = globalThis.location?.origin ?? '';
      const title = globalThis.document?.title ?? '';
      const bodyText = globalThis.document?.body?.innerText ?? '';
      const normalized = [title, href, bodyText].join('\\n').toLowerCase();
      const findHits = (values) => values.filter(value => normalized.includes(value.toLowerCase()));
      const selectorCount = (selector) => {
        try {
          return globalThis.document?.querySelectorAll(selector)?.length ?? 0;
        } catch {
          return 0;
        }
      };
      const localStorageKeys = (() => {
        try {
          return Object.keys(localStorage);
        } catch {
          return [];
        }
      })();
      const sessionStorageKeys = (() => {
        try {
          return Object.keys(sessionStorage);
        } catch {
          return [];
        }
      })();
      return {
        href,
        origin,
        title,
        loginKeywordHits: findHits(input.login),
        accountKeywordHits: findHits(input.account),
        challengeKeywordHits: findHits(input.challenge),
        twoFactorKeywordHits: findHits(input.twoFactor),
        interstitialKeywordHits: findHits(input.interstitial),
        passwordInputCount: selectorCount('input[type="password"], input[autocomplete*="password"], input[name*="pass" i], input[id*="pass" i]'),
        otpInputCount: selectorCount('input[autocomplete="one-time-code"], input[name*="otp" i], input[name*="code" i], input[id*="otp" i], input[id*="code" i]'),
        accountUiCount: selectorCount('[aria-label*="account" i], [aria-label*="profile" i], [data-testid*="avatar" i], img[alt*="avatar" i], button[aria-label*="account" i], button[aria-label*="profile" i], [data-testid*="profile" i]'),
        loginActionCount: selectorCount('form input[type="password"], button[type="submit"], button[aria-label*="sign in" i], a[href*="login" i], a[href*="signin" i]'),
        localStorageKeys,
        sessionStorageKeys,
      };
    }, keywordSets);

    const cookieScope = currentUrl && /^https?:/i.test(currentUrl) ? [currentUrl] : undefined;
    const cookies = await page.context().cookies(cookieScope).catch(() => []);
    const interestingCookies = cookies
      .filter(cookie => /session|auth|token|sid|user|identity/i.test(cookie.name))
      .slice(0, 8)
      .map(cookie => ({
        name: cookie.name,
        domain: cookie.domain,
      }));

    const interestingLocalKeys = pageInspection.localStorageKeys
      .filter(key => /session|auth|token|user|tenant|workspace|profile/i.test(key))
      .slice(0, 8);
    const interestingSessionKeys = pageInspection.sessionStorageKeys
      .filter(key => /session|auth|token|user|tenant|workspace|profile|otp|code/i.test(key))
      .slice(0, 8);

    const isLoginRoute = /\\/login|\\/signin|\\/sign-in|\\/auth/i.test(pageInspection.href);
    const hasLoginForm = pageInspection.passwordInputCount > 0 || pageInspection.loginActionCount > 0;
    const hasAccountUi = pageInspection.accountUiCount > 0 || pageInspection.accountKeywordHits.length > 0;
    const hasStorageSignal =
      interestingCookies.length > 0 || interestingLocalKeys.length > 0 || interestingSessionKeys.length > 0;
    const blockedState =
      pageInspection.challengeKeywordHits.length > 0
        ? 'challenge'
        : pageInspection.twoFactorKeywordHits.length > 0 || pageInspection.otpInputCount > 0
          ? 'two_factor'
          : pageInspection.interstitialKeywordHits.length > 0
            ? 'interstitial'
            : 'none';

    const pageIdentitySignals = [
      {
        kind: 'login_form',
        matched: hasLoginForm || isLoginRoute,
        detail: hasLoginForm
          ? 'password input or login submission UI detected'
          : isLoginRoute
            ? 'current URL matches a login/auth route'
            : 'no login UI detected',
      },
      {
        kind: 'account_ui',
        matched: hasAccountUi,
        detail: hasAccountUi
          ? 'account/profile/logout markers detected on the page'
          : 'no account/profile/logout markers detected',
      },
    ];

    const protectedResourceSignals = [
      {
        kind: 'blocked_gate',
        matched: blockedState === 'none',
        detail:
          blockedState === 'none'
            ? 'no challenge, two-factor, or interstitial gate detected'
            : 'page appears blocked by a challenge or verification gate',
      },
      {
        kind: 'current_page_access',
        matched: !isLoginRoute && !hasLoginForm && blockedState === 'none',
        detail:
          !isLoginRoute && !hasLoginForm && blockedState === 'none'
            ? 'current page does not look like a login or verification entrypoint'
            : 'current page still looks like a login or verification entrypoint',
      },
    ];

    const storageSignals = [
      {
        kind: 'cookie',
        matched: interestingCookies.length > 0,
        detail:
          interestingCookies.length > 0
            ? 'auth/session-like cookies are present'
            : 'no auth/session-like cookies detected',
        matches: interestingCookies,
      },
      {
        kind: 'localStorage',
        matched: interestingLocalKeys.length > 0,
        detail:
          interestingLocalKeys.length > 0
            ? 'auth/session-like localStorage keys are present'
            : 'no auth/session-like localStorage keys detected',
        matches: interestingLocalKeys,
      },
      {
        kind: 'sessionStorage',
        matched: interestingSessionKeys.length > 0,
        detail:
          interestingSessionKeys.length > 0
            ? 'auth/session-like sessionStorage keys are present'
            : 'no auth/session-like sessionStorage keys detected',
        matches: interestingSessionKeys,
      },
    ];

    const matchedPageIdentitySignals = pageIdentitySignals.filter(signal => signal.matched).length;
    const matchedProtectedSignals = protectedResourceSignals.filter(signal => signal.matched).length;
    const matchedStorageSignals = storageSignals.filter(signal => signal.matched).length;

    let status = 'uncertain';
    let confidence = 'low';
    let recommendedAction = 'inspect';

    if (blockedState !== 'none') {
      status = 'uncertain';
      confidence = blockedState === 'unknown' ? 'low' : 'medium';
      recommendedAction = 'human_handoff';
    } else if (hasAccountUi && matchedProtectedSignals === 2 && hasStorageSignal) {
      status = 'authenticated';
      confidence = 'high';
      recommendedAction = 'continue';
    } else if (hasAccountUi && matchedProtectedSignals >= 1) {
      status = 'authenticated';
      confidence = hasStorageSignal ? 'medium' : 'low';
      recommendedAction = hasStorageSignal ? 'continue' : 'inspect';
    } else if ((hasLoginForm || isLoginRoute) && !hasStorageSignal) {
      status = 'anonymous';
      confidence = 'high';
      recommendedAction = 'reauth';
    } else if (hasLoginForm || isLoginRoute) {
      status = 'anonymous';
      confidence = 'medium';
      recommendedAction = 'reauth';
    } else if (hasStorageSignal) {
      status = 'uncertain';
      confidence = 'medium';
      recommendedAction = 'inspect';
    }

    return {
      status,
      confidence,
      blockedState,
      recommendedAction,
      signals: {
        pageIdentity: pageIdentitySignals,
        protectedResource: protectedResourceSignals,
        storage: storageSignals,
      },
      summary: {
        matchedPageIdentitySignals,
        matchedProtectedSignals,
        matchedStorageSignals,
      },
      hints: {
        requestedUrl,
        currentUrl: pageInspection.href,
        currentTitle: title,
        hasLoginForm,
        hasAccountUi,
        hasStorageSignal,
      },
    };
  }`;
}

export async function managedAuthProbe(options?: AuthProbeOptions) {
  const result = await managedRunCode({
    sessionName: options?.sessionName,
    source: buildAuthProbeSource(options?.url),
  });
  const parsed =
    typeof result.data.result === "object" && result.data.result ? result.data.result : {};
  const signals =
    parsed.signals && typeof parsed.signals === "object" && !Array.isArray(parsed.signals)
      ? parsed.signals
      : {};
  const summary =
    parsed.summary && typeof parsed.summary === "object" && !Array.isArray(parsed.summary)
      ? parsed.summary
      : {};
  const hints =
    parsed.hints && typeof parsed.hints === "object" && !Array.isArray(parsed.hints)
      ? parsed.hints
      : {};

  const status =
    parsed.status === "authenticated" ||
    parsed.status === "anonymous" ||
    parsed.status === "uncertain"
      ? (parsed.status as AuthProbeStatus)
      : "uncertain";
  const confidence =
    parsed.confidence === "high" || parsed.confidence === "medium" || parsed.confidence === "low"
      ? (parsed.confidence as AuthProbeConfidence)
      : "low";
  const blockedState =
    parsed.blockedState === "none" ||
    parsed.blockedState === "challenge" ||
    parsed.blockedState === "two_factor" ||
    parsed.blockedState === "interstitial" ||
    parsed.blockedState === "unknown"
      ? (parsed.blockedState as AuthProbeBlockedState)
      : "unknown";
  const recommendedAction =
    parsed.recommendedAction === "continue" ||
    parsed.recommendedAction === "save_state" ||
    parsed.recommendedAction === "inspect" ||
    parsed.recommendedAction === "reauth" ||
    parsed.recommendedAction === "human_handoff"
      ? (parsed.recommendedAction as AuthProbeRecommendedAction)
      : "inspect";

  return {
    session: result.session,
    page: result.page,
    data: {
      status,
      confidence,
      blockedState,
      recommendedAction,
      capability: buildAuthProbeCapability(status, blockedState, confidence, recommendedAction),
      signals: {
        pageIdentity: Array.isArray((signals as Record<string, unknown>).pageIdentity)
          ? (signals as Record<string, unknown>).pageIdentity
          : [],
        protectedResource: Array.isArray((signals as Record<string, unknown>).protectedResource)
          ? (signals as Record<string, unknown>).protectedResource
          : [],
        storage: Array.isArray((signals as Record<string, unknown>).storage)
          ? (signals as Record<string, unknown>).storage
          : [],
      },
      summary: {
        matchedPageIdentitySignals: Number(
          (summary as Record<string, unknown>).matchedPageIdentitySignals ?? 0,
        ),
        matchedProtectedSignals: Number(
          (summary as Record<string, unknown>).matchedProtectedSignals ?? 0,
        ),
        matchedStorageSignals: Number(
          (summary as Record<string, unknown>).matchedStorageSignals ?? 0,
        ),
      },
      hints,
      ...(typeof options?.url === "string" ? { requestedUrl: options.url } : {}),
      ...maybeRawOutput(result.rawText ?? ""),
    },
  };
}
