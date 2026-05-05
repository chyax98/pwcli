import { managedRunCode } from "#engine/shared.js";

export type ExtractFieldSpec = {
  key: string;
  selector: string;
  type?: "text" | "html" | "attr";
  attr?: string;
};

export async function managedExtract(options: {
  sessionName?: string;
  selector?: string;
  schema: {
    multiple?: boolean;
    fields: ExtractFieldSpec[];
  };
}) {
  const result = await managedRunCode({
    sessionName: options.sessionName,
    source: `async page => {
      return await page.evaluate((config) => {
        const rootNodes = config.selector
          ? Array.from(document.querySelectorAll(config.selector))
          : [document.body];

        const readField = (root, field) => {
          const node = root.querySelector(field.selector);
          if (!node) return null;
          if (field.type === "html") return node.innerHTML;
          if (field.type === "attr") return field.attr ? node.getAttribute(field.attr) : null;
          return node.textContent?.trim() ?? "";
        };

        const items = rootNodes.map((root) => {
          const entry = {};
          for (const field of config.schema.fields) {
            entry[field.key] = readField(root, field);
          }
          return entry;
        });

        return {
          selector: config.selector,
          multiple: config.schema.multiple === true,
          count: items.length,
          items: config.schema.multiple === true ? items : items.slice(0, 1),
        };
      }, ${JSON.stringify({
        selector: options.selector ?? null,
        schema: options.schema,
      })});
    }`,
  });

  return {
    session: result.session,
    page: result.page,
    data: result.data.result as Record<string, unknown>,
  };
}
