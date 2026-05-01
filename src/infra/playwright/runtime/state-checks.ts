import { managedRunCode } from "./code.js";

export type StateTarget =
  | { selector: string; nth?: number }
  | { text: string; nth?: number }
  | { role: string; name?: string; nth?: number }
  | { label: string; nth?: number }
  | { placeholder: string; nth?: number }
  | { testid: string; nth?: number };

export type VerifyAssertion =
  | "text"
  | "text-absent"
  | "url"
  | "visible"
  | "hidden"
  | "enabled"
  | "disabled"
  | "checked"
  | "unchecked"
  | "count";

export type VerifyOptions = {
  sessionName?: string;
  assertion: VerifyAssertion;
  target?: StateTarget;
  url?: {
    contains?: string;
    equals?: string;
    matches?: string;
  };
  count?: {
    equals?: number;
    min?: number;
    max?: number;
  };
};

type StateCandidate = {
  index: number;
  text: string;
  tagName: string;
  visible: boolean;
  href?: string;
  role?: string;
  name?: string;
  ancestor?: string;
  region?: string;
  selectorHint?: string;
};

function targetExpression(target: StateTarget) {
  const nth = "nth" in target && target.nth ? Math.max(1, Math.floor(Number(target.nth))) : 1;
  return `${targetBaseExpression(target)}.nth(${nth - 1})`;
}

function targetBaseExpression(target: StateTarget) {
  if ("selector" in target) {
    return `page.locator(${JSON.stringify(target.selector)})`;
  }
  if ("text" in target) {
    return `page.getByText(${JSON.stringify(target.text)}, { exact: true })`;
  }
  if ("role" in target) {
    return `page.getByRole(${JSON.stringify(target.role)}, ${
      target.name ? `{ name: ${JSON.stringify(target.name)}, exact: true }` : "undefined"
    })`;
  }
  if ("label" in target) {
    return `page.getByLabel(${JSON.stringify(target.label)}, { exact: true })`;
  }
  if ("placeholder" in target) {
    return `page.getByPlaceholder(${JSON.stringify(target.placeholder)}, { exact: true })`;
  }
  return `page.getByTestId(${JSON.stringify(target.testid)})`;
}

function parsedObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parsedCandidates(value: unknown): StateCandidate[] {
  return Array.isArray(value)
    ? value.map((item, index) => {
        const record = parsedObject(item);
        return {
          index: typeof record.index === "number" ? record.index : index + 1,
          text: typeof record.text === "string" ? record.text : "",
          tagName: typeof record.tagName === "string" ? record.tagName : "",
          visible: Boolean(record.visible),
          href: typeof record.href === "string" ? record.href : undefined,
          role: typeof record.role === "string" ? record.role : undefined,
          name: typeof record.name === "string" ? record.name : undefined,
          ancestor: typeof record.ancestor === "string" ? record.ancestor : undefined,
          region: typeof record.region === "string" ? record.region : undefined,
          selectorHint: typeof record.selectorHint === "string" ? record.selectorHint : undefined,
        };
      })
    : [];
}

export async function managedLocate(options: { sessionName?: string; target: StateTarget }) {
  const result = await managedRunCode({
    sessionName: options.sessionName,
    source: `async page => {
      const locator = ${targetBaseExpression(options.target)};
      const target = ${JSON.stringify(options.target)};
      const nth = typeof target.nth === 'number' ? Math.max(1, Math.floor(target.nth)) : null;
      const count = await locator.count();
      const candidates = await locator.evaluateAll((nodes, nth) => {
        const cleanText = value => (value || '').replace(/\\s+/g, ' ').trim();
        const cssEscape = value =>
          globalThis.CSS && typeof globalThis.CSS.escape === 'function'
            ? globalThis.CSS.escape(value)
            : String(value).replace(/[^a-zA-Z0-9_-]/g, '\\\\$&');
        const attr = (node, name) => node.getAttribute(name) || '';
        const roleOf = node => {
          const explicit = attr(node, 'role');
          if (explicit) return explicit;
          const tag = node.tagName.toLowerCase();
          if (tag === 'a' && attr(node, 'href')) return 'link';
          if (tag === 'button') return 'button';
          if (tag === 'select') return 'combobox';
          if (tag === 'textarea') return 'textbox';
          if (tag === 'img') return 'img';
          if (tag === 'input') {
            const type = attr(node, 'type').toLowerCase() || 'text';
            if (type === 'checkbox' || type === 'radio') return type;
            if (['button', 'submit', 'reset'].includes(type)) return 'button';
            if (type === 'range') return 'slider';
            if (type === 'number') return 'spinbutton';
            if (type === 'search') return 'searchbox';
            return 'textbox';
          }
          if (tag === 'main') return 'main';
          if (tag === 'nav') return 'navigation';
          if (tag === 'form') return 'form';
          return '';
        };
        const labelledByName = node =>
          attr(node, 'aria-labelledby')
            .split(/\\s+/)
            .map(id => cleanText(node.ownerDocument.getElementById(id)?.textContent || ''))
            .filter(Boolean)
            .join(' ');
        const nameOf = node =>
          cleanText(
            attr(node, 'aria-label') ||
              labelledByName(node) ||
              attr(node, 'alt') ||
              attr(node, 'title') ||
              (node instanceof HTMLInputElement ? node.value : '') ||
              node.textContent ||
              '',
          ).slice(0, 120);
        const selectorPart = node => {
          const tag = node.tagName.toLowerCase();
          if (node.id) return '#' + cssEscape(node.id);
          for (const name of ['data-testid', 'data-test-id', 'name', 'aria-label']) {
            const value = attr(node, name);
            if (value) return tag + '[' + name + '="' + value.replace(/"/g, '\\\\"') + '"]';
          }
          const classHint = [...node.classList]
            .filter(item => /^[a-zA-Z0-9_-]+$/.test(item))
            .slice(0, 2)
            .map(item => '.' + cssEscape(item))
            .join('');
          if (classHint) return tag + classHint;
          if (!node.parentElement) return tag;
          const siblings = [...node.parentElement.children].filter(
            item => item.tagName === node.tagName,
          );
          const position = siblings.indexOf(node) + 1;
          return siblings.length > 1 ? tag + ':nth-of-type(' + position + ')' : tag;
        };
        const selectorHintOf = node => {
          const parts = [];
          let current = node;
          while (current && current.nodeType === Node.ELEMENT_NODE && parts.length < 4) {
            parts.unshift(selectorPart(current));
            if (current.id) break;
            current = current.parentElement;
          }
          return parts.join(' > ');
        };
        const describe = node => {
          const role = roleOf(node);
          const name = nameOf(node);
          const selector = selectorPart(node);
          return [
            node.tagName.toLowerCase(),
            role ? 'role=' + JSON.stringify(role) : '',
            name ? 'name=' + JSON.stringify(name) : '',
            selector ? 'selector=' + JSON.stringify(selector) : '',
          ].filter(Boolean).join(' ');
        };
        const regionOf = node => {
          const region = node.closest(
            '[role="region"], [role="banner"], [role="main"], [role="navigation"], [role="complementary"], [role="contentinfo"], [role="search"], main, nav, aside, header, footer, section[aria-label], form[aria-label]',
          );
          return region && region !== node ? describe(region) : '';
        };
        const selected = nth ? nodes.slice(nth - 1, nth) : nodes.slice(0, 10);
        return selected.map((node, index) => {
          const anchor = node.closest('a[href]');
          return {
            index: nth ? nth : index + 1,
            text: cleanText(node.textContent).slice(0, 160),
            tagName: node.tagName.toLowerCase(),
            visible: !!(node.offsetWidth || node.offsetHeight || node.getClientRects().length),
            href: anchor ? anchor.href : '',
            role: roleOf(node),
            name: nameOf(node),
            ancestor: node.parentElement ? describe(node.parentElement) : '',
            region: regionOf(node),
            selectorHint: selectorHintOf(node),
          };
        });
      }, nth);
      return JSON.stringify({ count, candidates });
    }`,
  });
  const parsed = parsedObject(result.data.result);
  return {
    session: result.session,
    page: result.page,
    data: {
      target: options.target,
      count: Number(parsed.count ?? 0),
      candidates: parsedCandidates(parsed.candidates),
    },
  };
}

export async function managedGetFact(options: {
  sessionName?: string;
  target: StateTarget;
  fact: "text" | "value" | "count";
}) {
  const result = await managedRunCode({
    sessionName: options.sessionName,
    source: `async page => {
      const target = ${JSON.stringify(options.target)};
      const locator = ${targetExpression(options.target)};
      const baseLocator = ${targetBaseExpression(options.target)};
      const count = await baseLocator.count();
      if (${JSON.stringify(options.fact)} === 'count') {
        return JSON.stringify({ value: count, count });
      }
      if (count === 0) {
        throw new Error('STATE_TARGET_NOT_FOUND:' + JSON.stringify({ target }));
      }
      if (typeof target.nth === 'number' && target.nth > count) {
        throw new Error('STATE_TARGET_NOT_FOUND:' + JSON.stringify({ target, count }));
      }
      if (${JSON.stringify(options.fact)} === 'text') {
        return JSON.stringify({ value: await locator.textContent(), count });
      }
      return JSON.stringify({ value: await locator.inputValue(), count });
    }`,
  });
  const parsed = parsedObject(result.data.result);
  return {
    session: result.session,
    page: result.page,
    data: {
      target: options.target,
      fact: options.fact,
      value: parsed.value,
      count: Number(parsed.count ?? 0),
    },
  };
}

export async function managedIsState(options: {
  sessionName?: string;
  target: StateTarget;
  state: "visible" | "enabled" | "checked";
}) {
  const result = await managedRunCode({
    sessionName: options.sessionName,
    source: `async page => {
      const locator = ${targetExpression(options.target)};
      const baseLocator = ${targetBaseExpression(options.target)};
      const count = await baseLocator.count();
      if (count === 0) {
        return JSON.stringify({ value: false, count });
      }
      const state = ${JSON.stringify(options.state)};
      const value = state === 'visible'
        ? await locator.isVisible()
        : state === 'enabled'
          ? await locator.isEnabled()
          : await locator.isChecked();
      return JSON.stringify({ value, count });
    }`,
  });
  const parsed = parsedObject(result.data.result);
  return {
    session: result.session,
    page: result.page,
    data: {
      target: options.target,
      state: options.state,
      value: Boolean(parsed.value),
      count: Number(parsed.count ?? 0),
    },
  };
}

function verifySuggestions(assertion: VerifyAssertion): string[] {
  if (assertion === "url") {
    return [
      "Run `pw page current --session <name>` to inspect the active URL",
      "Run `pw wait --networkidle --session <name>` before retrying the assertion",
    ];
  }
  if (assertion === "text" || assertion === "text-absent") {
    return [
      "Run `pw read-text --session <name> --max-chars 4000` to inspect visible text",
      "Run `pw locate --session <name> --text '<text>'` to inspect text candidates",
      "Run `pw diagnostics bundle --session <name> --out .pwcli/bundles/verify-failure --limit 20` if the missing text follows an action",
    ];
  }
  return [
    "Run `pw locate --session <name> --selector '<selector>'` to inspect candidates",
    "Run `pw snapshot -i --session <name>` when you need fresh refs",
    "Run `pw diagnostics bundle --session <name> --out .pwcli/bundles/verify-failure --limit 20` if the failed assertion follows an action",
  ];
}

function parseVerifyPayload(value: unknown): {
  passed: boolean;
  actual?: unknown;
  expected?: unknown;
  count?: number;
} {
  const parsed = parsedObject(value);
  return {
    passed: Boolean(parsed.passed),
    actual: parsed.actual,
    expected: parsed.expected,
    count: typeof parsed.count === "number" ? parsed.count : undefined,
  };
}

export async function managedVerify(options: VerifyOptions) {
  const suggestions = verifySuggestions(options.assertion);
  if (options.assertion === "url") {
    const result = await managedRunCode({
      sessionName: options.sessionName,
      source: `async page => {
        const actual = page.url();
        const expectation = ${JSON.stringify(options.url ?? {})};
        let passed = false;
        let expected = expectation;
        if (typeof expectation.contains === 'string') {
          passed = actual.includes(expectation.contains);
          expected = { contains: expectation.contains };
        } else if (typeof expectation.equals === 'string') {
          passed = actual === expectation.equals;
          expected = { equals: expectation.equals };
        } else if (typeof expectation.matches === 'string') {
          passed = new RegExp(expectation.matches).test(actual);
          expected = { matches: expectation.matches };
        }
        return JSON.stringify({ passed, actual, expected });
      }`,
    });
    const parsed = parseVerifyPayload(result.data.result);
    return {
      session: result.session,
      page: result.page,
      data: {
        assertion: options.assertion,
        passed: parsed.passed,
        expected: parsed.expected,
        actual: parsed.actual,
        retryable: !parsed.passed,
        suggestions: parsed.passed ? [] : suggestions,
      },
    };
  }

  if (!options.target) {
    throw new Error("verify assertion requires a target");
  }

  const result = await managedRunCode({
    sessionName: options.sessionName,
    source: `async page => {
      const assertion = ${JSON.stringify(options.assertion)};
      const target = ${JSON.stringify(options.target)};
      const countExpectation = ${JSON.stringify(options.count ?? {})};
      const locator = ${targetExpression(options.target)};
      const baseLocator = ${targetBaseExpression(options.target)};
      const count = await baseLocator.count();
      if (assertion === 'text' || assertion === 'text-absent') {
        const nth = typeof target.nth === 'number' ? target.nth : 1;
        const matched = count > 0 && nth <= count;
        const passed = assertion === 'text' ? matched : !matched;
        return JSON.stringify({ passed, actual: { count, nth, matched }, expected: target, count });
      }
      if (assertion === 'count') {
        let passed = true;
        if (typeof countExpectation.equals === 'number') passed = passed && count === countExpectation.equals;
        if (typeof countExpectation.min === 'number') passed = passed && count >= countExpectation.min;
        if (typeof countExpectation.max === 'number') passed = passed && count <= countExpectation.max;
        return JSON.stringify({ passed, actual: count, expected: countExpectation, count });
      }
      if (count === 0) {
        const hiddenPass = assertion === 'hidden';
        return JSON.stringify({ passed: hiddenPass, actual: false, expected: assertion, count });
      }
      const value =
        assertion === 'visible' || assertion === 'hidden'
          ? await locator.isVisible()
          : assertion === 'enabled' || assertion === 'disabled'
            ? await locator.isEnabled()
            : await locator.isChecked();
      const passed =
        assertion === 'hidden' || assertion === 'disabled' || assertion === 'unchecked'
          ? !value
          : value;
      return JSON.stringify({ passed, actual: value, expected: assertion, count });
    }`,
  });
  const parsed = parseVerifyPayload(result.data.result);
  return {
    session: result.session,
    page: result.page,
    data: {
      assertion: options.assertion,
      passed: parsed.passed,
      target: options.target,
      expected: parsed.expected,
      actual: parsed.actual,
      ...(typeof parsed.count === "number" ? { count: parsed.count } : {}),
      retryable: !parsed.passed,
      suggestions: parsed.passed ? [] : suggestions,
    },
  };
}
