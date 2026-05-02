import {
  type NormalizedSemanticTarget,
  type SelectorTarget,
  semanticLocatorExpression,
} from "../../../domain/interaction/model.js";

export type { SelectorTarget };

export function selectorActionSource(
  errorPrefix: string,
  target: SelectorTarget,
  actionSource: (locatorExpression: string) => string,
) {
  const nthIndex = target.nth - 1;
  const targetJson = JSON.stringify(target);
  const locatorExpression = `page.locator(${JSON.stringify(target.selector)})`;
  const action = actionSource(`locator.nth(${nthIndex})`);

  return `async page => {
    const target = ${targetJson};
    const locator = ${locatorExpression};
    const count = await locator.count();
    if (count === 0) {
      throw new Error(
        '${errorPrefix}_SELECTOR_NOT_FOUND:' +
          JSON.stringify({ target })
      );
    }
    if (${nthIndex} >= count) {
      throw new Error(
        '${errorPrefix}_SELECTOR_INDEX_OUT_OF_RANGE:' +
          JSON.stringify({ target, count, nth: ${target.nth} })
      );
    }
    ${action}
    return JSON.stringify({
      acted: true,
      selected: ${errorPrefix === "SELECT" ? "true" : "undefined"},
      values: typeof values === 'undefined' ? undefined : values,
      target,
      count,
      nth: ${target.nth},
    });
  }`;
}

export function semanticClickSource(target: NormalizedSemanticTarget, button?: string) {
  const clickOptions = button ? JSON.stringify({ button }) : "undefined";
  const nthIndex = target.nth - 1;
  const targetJson = JSON.stringify(target);
  const locatorExpression = semanticLocatorExpression(target);

  return `async page => {
    const target = ${targetJson};
    const locator = ${locatorExpression};
    const count = await locator.count();
    if (count === 0) {
      let candidates = [];
      if (target.kind === 'text') {
        candidates = await page.getByText(target.text, { exact: false }).evaluateAll(nodes =>
          nodes.slice(0, 8).map(node => (node.textContent || '').trim()).filter(Boolean)
        ).catch(() => []);
      }
      throw new Error(
        'CLICK_SEMANTIC_NOT_FOUND:' +
          JSON.stringify({ target, ...(candidates.length ? { candidates } : {}) })
      );
    }
    if (${nthIndex} >= count) {
      throw new Error(
        'CLICK_SEMANTIC_INDEX_OUT_OF_RANGE:' +
          JSON.stringify({ target, count, nth: ${target.nth} })
      );
    }
    await locator.nth(${nthIndex}).click(${clickOptions});
    return JSON.stringify({ clicked: true, target, count, nth: ${target.nth} });
  }`;
}

export function semanticBooleanControlSource(
  command: "check" | "uncheck",
  target: NormalizedSemanticTarget,
) {
  const nthIndex = target.nth - 1;
  const targetJson = JSON.stringify(target);
  const locatorExpression = semanticLocatorExpression(target);
  const errorPrefix = command.toUpperCase();

  return `async page => {
    const target = ${targetJson};
    const locator = ${locatorExpression};
    const count = await locator.count();
    if (count === 0) {
      throw new Error(
        '${errorPrefix}_SEMANTIC_NOT_FOUND:' +
          JSON.stringify({ target })
      );
    }
    if (${nthIndex} >= count) {
      throw new Error(
        '${errorPrefix}_SEMANTIC_INDEX_OUT_OF_RANGE:' +
          JSON.stringify({ target, count, nth: ${target.nth} })
      );
    }
    await locator.nth(${nthIndex}).${command}();
    return JSON.stringify({ ${command === "check" ? "checked" : "unchecked"}: true, target, count, nth: ${target.nth} });
  }`;
}

export function semanticInputSource(
  errorPrefix: "FILL" | "TYPE",
  target: NormalizedSemanticTarget,
  action: "fill" | "type",
  value: string,
) {
  const nthIndex = target.nth - 1;
  const targetJson = JSON.stringify(target);
  const locatorExpression = semanticLocatorExpression(target);

  return `async page => {
    const target = ${targetJson};
    const locator = ${locatorExpression};
    const count = await locator.count();
    if (count === 0) {
      throw new Error(
        '${errorPrefix}_SEMANTIC_NOT_FOUND:' +
          JSON.stringify({ target })
      );
    }
    if (${nthIndex} >= count) {
      throw new Error(
        '${errorPrefix}_SEMANTIC_INDEX_OUT_OF_RANGE:' +
          JSON.stringify({ target, count, nth: ${target.nth} })
      );
    }
    await locator.nth(${nthIndex}).${action}(${JSON.stringify(value)});
    return JSON.stringify({ ${action === "fill" ? "filled" : "typed"}: true });
  }`;
}

export function semanticHoverSource(target: NormalizedSemanticTarget) {
  const nthIndex = target.nth - 1;
  const targetJson = JSON.stringify(target);
  const locatorExpression = semanticLocatorExpression(target);

  return `async page => {
    const target = ${targetJson};
    const locator = ${locatorExpression};
    const count = await locator.count();
    if (count === 0) {
      throw new Error(
        'HOVER_SEMANTIC_NOT_FOUND:' +
          JSON.stringify({ target })
      );
    }
    if (${nthIndex} >= count) {
      throw new Error(
        'HOVER_SEMANTIC_INDEX_OUT_OF_RANGE:' +
          JSON.stringify({ target, count, nth: ${target.nth} })
      );
    }
    await locator.nth(${nthIndex}).hover();
    return JSON.stringify({ hovered: true, target, count, nth: ${target.nth} });
  }`;
}

export function semanticSelectSource(target: NormalizedSemanticTarget, value: string) {
  const nthIndex = target.nth - 1;
  const targetJson = JSON.stringify(target);
  const locatorExpression = semanticLocatorExpression(target);
  const valueJson = JSON.stringify(value);

  return `async page => {
    const target = ${targetJson};
    const locator = ${locatorExpression};
    const count = await locator.count();
    if (count === 0) {
      throw new Error(
        'SELECT_SEMANTIC_NOT_FOUND:' +
          JSON.stringify({ target })
      );
    }
    if (${nthIndex} >= count) {
      throw new Error(
        'SELECT_SEMANTIC_INDEX_OUT_OF_RANGE:' +
          JSON.stringify({ target, count, nth: ${target.nth} })
      );
    }
    const values = await locator.nth(${nthIndex}).selectOption(${valueJson});
    return JSON.stringify({ selected: true, target, count, nth: ${target.nth}, values });
  }`;
}
