import { managedClick, type SemanticTarget } from "#engine/act/element.js";
import { managedLocate, type StateTarget } from "#engine/observe.js";

export type IntentName =
  | "submit_form"
  | "close_dialog"
  | "auth_action"
  | "accept_cookies"
  | "back_navigation"
  | "pagination_next"
  | "primary_cta";

type IntentRule = {
  strategy: string;
  weight: number;
  target: StateTarget;
};

type IntentDefinition = {
  intent: IntentName;
  action: "click";
  rules: IntentRule[];
};

export type IntentCandidate = {
  score: number;
  strategy: string;
  target: StateTarget;
  ref?: string;
  text: string;
  tagName: string;
  visible: boolean;
  href?: string;
  role?: string;
  name?: string;
  region?: string;
  selectorHint?: string;
};

function textRule(text: string, weight: number, strategy = `text:${text}`): IntentRule {
  return { strategy, weight, target: { text } };
}

function roleRule(
  role: string,
  name: string,
  weight: number,
  strategy = `role:${role}:${name}`,
): IntentRule {
  return { strategy, weight, target: { role, name } };
}

function selectorRule(
  selector: string,
  weight: number,
  strategy = `selector:${selector}`,
): IntentRule {
  return { strategy, weight, target: { selector } };
}

const INTENT_DEFINITIONS: Record<IntentName, IntentDefinition> = {
  submit_form: {
    intent: "submit_form",
    action: "click",
    rules: [
      selectorRule("button[type='submit'], input[type='submit']", 100, "submit-selector"),
      roleRule("button", "Submit", 95),
      roleRule("button", "Continue", 94),
      roleRule("button", "Sign in", 93),
      roleRule("button", "Log in", 92),
      roleRule("button", "Save", 91),
      textRule("Submit", 85),
      textRule("Continue", 84),
      textRule("Sign in", 83),
      textRule("Save", 82),
    ],
  },
  close_dialog: {
    intent: "close_dialog",
    action: "click",
    rules: [
      roleRule("button", "Close", 100),
      roleRule("button", "Dismiss", 95),
      roleRule("button", "Cancel", 94),
      textRule("Close", 90),
      textRule("Dismiss", 89),
      textRule("Cancel", 88),
      selectorRule("[aria-label='Close'], [data-testid*='close'], .close, .modal-close", 80),
    ],
  },
  auth_action: {
    intent: "auth_action",
    action: "click",
    rules: [
      roleRule("button", "Sign in", 100),
      roleRule("button", "Log in", 99),
      roleRule("button", "Continue with email", 98),
      textRule("Sign in", 94),
      textRule("Log in", 93),
      textRule("Continue with email", 92),
      selectorRule("button[type='submit']", 80),
    ],
  },
  accept_cookies: {
    intent: "accept_cookies",
    action: "click",
    rules: [
      roleRule("button", "Accept", 100),
      roleRule("button", "Accept all", 99),
      roleRule("button", "Agree", 98),
      textRule("Accept", 94),
      textRule("Accept all", 93),
      textRule("Agree", 92),
      selectorRule("[id*='cookie'] button, [class*='cookie'] button", 80, "cookie-banner"),
    ],
  },
  back_navigation: {
    intent: "back_navigation",
    action: "click",
    rules: [
      roleRule("button", "Back", 100),
      roleRule("link", "Back", 99),
      roleRule("button", "Previous", 98),
      textRule("Back", 94),
      textRule("Previous", 93),
      selectorRule("a[rel='prev'], button[aria-label='Back']", 85, "prev-selector"),
    ],
  },
  pagination_next: {
    intent: "pagination_next",
    action: "click",
    rules: [
      roleRule("button", "Next", 100),
      roleRule("link", "Next", 99),
      roleRule("button", "Next page", 98),
      textRule("Next", 94),
      textRule("Next page", 93),
      selectorRule("a[rel='next'], button[aria-label='Next']", 85, "next-selector"),
    ],
  },
  primary_cta: {
    intent: "primary_cta",
    action: "click",
    rules: [
      roleRule("button", "Get started", 100),
      roleRule("button", "Continue", 99),
      roleRule("button", "Open", 98),
      roleRule("button", "Start", 97),
      textRule("Get started", 94),
      textRule("Continue", 93),
      textRule("Open", 92),
      textRule("Start", 91),
      selectorRule("[data-primary], button.primary, a.primary", 82, "primary-selector"),
    ],
  },
};

function normalizeSemanticTarget(target: StateTarget): SemanticTarget | undefined {
  if ("text" in target)
    return { kind: "text", text: target.text, ...(target.nth ? { nth: target.nth } : {}) };
  if ("role" in target) {
    return {
      kind: "role",
      role: target.role,
      ...(target.name ? { name: target.name } : {}),
      ...(target.nth ? { nth: target.nth } : {}),
    };
  }
  if ("label" in target)
    return { kind: "label", label: target.label, ...(target.nth ? { nth: target.nth } : {}) };
  if ("placeholder" in target) {
    return {
      kind: "placeholder",
      placeholder: target.placeholder,
      ...(target.nth ? { nth: target.nth } : {}),
    };
  }
  if ("testid" in target)
    return { kind: "testid", testid: target.testid, ...(target.nth ? { nth: target.nth } : {}) };
  return undefined;
}

function candidateKey(candidate: IntentCandidate) {
  return [candidate.ref, candidate.selectorHint, candidate.role, candidate.name, candidate.text]
    .filter(Boolean)
    .join("|");
}

export async function managedFindBest(options: {
  sessionName?: string;
  intent: IntentName;
  limit?: number;
}) {
  const definition = INTENT_DEFINITIONS[options.intent];
  const seen = new Set<string>();
  const candidates: IntentCandidate[] = [];

  for (const [ruleIndex, rule] of definition.rules.entries()) {
    const located = await managedLocate({
      sessionName: options.sessionName,
      target: rule.target,
      returnRef: true,
    });
    const ref = typeof located.data.ref === "string" ? located.data.ref : undefined;
    const locatedCandidates = Array.isArray(located.data.candidates) ? located.data.candidates : [];
    for (const [candidateIndex, raw] of locatedCandidates.entries()) {
      const record = raw as Record<string, unknown>;
      const candidate: IntentCandidate = {
        score: rule.weight - ruleIndex * 3 - candidateIndex,
        strategy: rule.strategy,
        target: rule.target,
        ...(candidateIndex === 0 && ref ? { ref } : {}),
        text: typeof record.text === "string" ? record.text : "",
        tagName: typeof record.tagName === "string" ? record.tagName : "",
        visible: Boolean(record.visible),
        href: typeof record.href === "string" ? record.href : undefined,
        role: typeof record.role === "string" ? record.role : undefined,
        name: typeof record.name === "string" ? record.name : undefined,
        region: typeof record.region === "string" ? record.region : undefined,
        selectorHint: typeof record.selectorHint === "string" ? record.selectorHint : undefined,
      };
      const key = candidateKey(candidate);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      candidates.push(candidate);
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const limit = Math.max(1, options.limit ?? 5);
  const top = candidates.slice(0, limit);

  return {
    data: {
      intent: options.intent,
      action: definition.action,
      count: candidates.length,
      candidates: top,
      best: top[0] ?? null,
    },
  };
}

export async function managedAct(options: {
  sessionName?: string;
  intent: IntentName;
  limit?: number;
  button?: string;
}) {
  const found = await managedFindBest(options);
  const best = found.data.best as IntentCandidate | null;
  if (!best) {
    throw new Error(`ACT_INTENT_NOT_FOUND:${options.intent}`);
  }

  const semantic = normalizeSemanticTarget(best.target);
  const result = await managedClick({
    sessionName: options.sessionName,
    ...("selector" in best.target
      ? { selector: best.target.selector, nth: best.target.nth ?? 1 }
      : semantic
        ? { semantic }
        : best.ref
          ? { ref: best.ref }
          : {}),
    ...(options.button ? { button: options.button } : {}),
  });

  return {
    ...result,
    data: {
      ...result.data,
      intent: options.intent,
      matched: {
        score: best.score,
        strategy: best.strategy,
        ref: best.ref ?? null,
        text: best.text,
        role: best.role ?? null,
        name: best.name ?? null,
        selectorHint: best.selectorHint ?? null,
      },
    },
  };
}
