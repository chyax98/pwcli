import { managedRunCode } from "./code.js";

export type StateTarget =
  | { selector: string }
  | { text: string }
  | { role: string; name?: string }
  | { testid: string };

type StateCandidate = {
  index: number;
  text: string;
  tagName: string;
  visible: boolean;
};

function targetExpression(target: StateTarget) {
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
        };
      })
    : [];
}

export async function managedLocate(options: { sessionName?: string; target: StateTarget }) {
  const result = await managedRunCode({
    sessionName: options.sessionName,
    source: `async page => {
      const locator = ${targetExpression(options.target)};
      const count = await locator.count();
      const candidates = await locator.evaluateAll(nodes => nodes.slice(0, 10).map((node, index) => ({
        index: index + 1,
        text: (node.textContent || '').trim().slice(0, 160),
        tagName: node.tagName.toLowerCase(),
        visible: !!(node.offsetWidth || node.offsetHeight || node.getClientRects().length),
      })));
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
      const count = await locator.count();
      if (${JSON.stringify(options.fact)} === 'count') {
        return JSON.stringify({ value: count, count });
      }
      if (count === 0) {
        throw new Error('STATE_TARGET_NOT_FOUND:' + JSON.stringify({ target }));
      }
      const first = locator.first();
      if (${JSON.stringify(options.fact)} === 'text') {
        return JSON.stringify({ value: await first.textContent(), count });
      }
      return JSON.stringify({ value: await first.inputValue(), count });
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
      const locator = ${targetExpression(options.target)}.first();
      const count = await locator.count();
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
