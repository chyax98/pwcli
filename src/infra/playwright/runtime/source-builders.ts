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
  const isClick = errorPrefix === "CLICK";
  const popupPre = isClick ? `const popupPromise = page.waitForEvent('popup', { timeout: 1500 }).catch(() => null);\n    ` : "";
  const popupPost = isClick ? `\n    const popup = await popupPromise;\n    let openedPage = null;\n    if (popup) {\n      const newPageId = popup.__pwcliPageId || (() => {\n        const id = 'p' + Math.random().toString(36).slice(2, 6);\n        popup.__pwcliPageId = id;\n        return id;\n      })();\n      openedPage = { pageId: newPageId, url: popup.url(), title: await popup.title().catch(() => '') };\n    }` : "";
  const openedPageField = isClick ? `,\n      openedPage` : "";

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
    ${popupPre}${action}${popupPost}
    return JSON.stringify({
      acted: true,
      selected: ${errorPrefix === "SELECT" ? "true" : "undefined"},
      values: typeof values === 'undefined' ? undefined : values,
      target,
      count,
      nth: ${target.nth}${openedPageField},
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
    const popupPromise = page.waitForEvent('popup', { timeout: 1500 }).catch(() => null);
    await locator.nth(${nthIndex}).click(${clickOptions});
    const popup = await popupPromise;
    let openedPage = null;
    if (popup) {
      const newPageId = popup.__pwcliPageId || (() => {
        const id = 'p' + Math.random().toString(36).slice(2, 6);
        popup.__pwcliPageId = id;
        return id;
      })();
      openedPage = { pageId: newPageId, url: popup.url(), title: await popup.title().catch(() => '') };
    }
    return JSON.stringify({ clicked: true, target, count, nth: ${target.nth}, openedPage });
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

export function semanticPressSource(target: NormalizedSemanticTarget, key: string) {
  const nthIndex = target.nth - 1;
  const targetJson = JSON.stringify(target);
  const locatorExpression = semanticLocatorExpression(target);
  const keyJson = JSON.stringify(key);

  return `async page => {
    const target = ${targetJson};
    const locator = ${locatorExpression};
    const count = await locator.count();
    if (count === 0) {
      throw new Error(
        'PRESS_SEMANTIC_NOT_FOUND:' +
          JSON.stringify({ target })
      );
    }
    if (${nthIndex} >= count) {
      throw new Error(
        'PRESS_SEMANTIC_INDEX_OUT_OF_RANGE:' +
          JSON.stringify({ target, count, nth: ${target.nth} })
      );
    }
    await locator.nth(${nthIndex}).press(${keyJson});
    return JSON.stringify({ pressed: true, target, count, nth: ${target.nth} });
  }`;
}
