import { managedCheck, managedFill, managedSelect } from "#engine/act/element.js";
import { managedRunCode } from "#engine/shared.js";

export type FormField = {
  index: number;
  tagName: string;
  inputType: string | null;
  name: string | null;
  id: string | null;
  label: string | null;
  placeholder: string | null;
  required: boolean;
  disabled: boolean;
  checked: boolean | null;
  multiple: boolean;
  options: string[];
  selectorHint: string | null;
};

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeField(raw: Record<string, unknown>, index: number): FormField {
  return {
    index,
    tagName: normalizeString(raw.tagName) ?? "input",
    inputType: normalizeString(raw.inputType),
    name: normalizeString(raw.name),
    id: normalizeString(raw.id),
    label: normalizeString(raw.label),
    placeholder: normalizeString(raw.placeholder),
    required: raw.required === true,
    disabled: raw.disabled === true,
    checked: typeof raw.checked === "boolean" ? raw.checked : null,
    multiple: raw.multiple === true,
    options: Array.isArray(raw.options) ? raw.options.map(String) : [],
    selectorHint: normalizeString(raw.selectorHint),
  };
}

export async function managedAnalyzeForm(options: { sessionName?: string; selector?: string }) {
  const result = await managedRunCode({
    sessionName: options.sessionName,
    source: `async page => {
      return await page.evaluate((selector) => {
        const form = selector
          ? document.querySelector(selector)
          : document.querySelector("form");
        if (!(form instanceof HTMLFormElement)) {
          throw new Error("FORM_NOT_FOUND");
        }
        const clean = (value) => {
          if (typeof value !== "string") return null;
          const trimmed = value.trim();
          return trimmed.length > 0 ? trimmed : null;
        };
        const selectorHint = (node) => {
          const id = clean(node.id);
          if (id) return \`#\${id}\`;
          const name = clean(node.getAttribute("name"));
          if (name) return \`\${node.tagName.toLowerCase()}[name="\${name}"]\`;
          return node.tagName.toLowerCase();
        };
        const labelFor = (node) => {
          const direct = node.closest("label");
          if (direct) return clean(direct.textContent);
          const id = clean(node.id);
          if (!id) return null;
          const explicit = form.querySelector(\`label[for="\${id}"]\`);
          return explicit ? clean(explicit.textContent) : null;
        };
        const fields = Array.from(form.querySelectorAll("input, textarea, select")).map((node, index) => {
          const tagName = node.tagName.toLowerCase();
          const inputType = tagName === "input" ? clean(node.getAttribute("type")) ?? "text" : null;
          const options = tagName === "select"
            ? Array.from(node.querySelectorAll("option")).map((option) => clean(option.textContent) ?? clean(option.getAttribute("value")) ?? "")
            : [];
          return {
            index: index + 1,
            tagName,
            inputType,
            name: clean(node.getAttribute("name")),
            id: clean(node.id),
            label: labelFor(node),
            placeholder: clean(node.getAttribute("placeholder")),
            required: node.hasAttribute("required"),
            disabled: node.hasAttribute("disabled"),
            checked: typeof node.checked === "boolean" ? node.checked : null,
            multiple: node.multiple === true,
            options,
            selectorHint: selectorHint(node),
          };
        });
        return {
          action: clean(form.getAttribute("action")),
          method: clean(form.getAttribute("method")) ?? "get",
          fieldCount: fields.length,
          fields,
        };
      }, ${JSON.stringify(options.selector ?? null)});
    }`,
  });

  const parsed = result.data.result as Record<string, unknown>;
  const fields = Array.isArray(parsed.fields)
    ? parsed.fields.map((item, index) => normalizeField(item as Record<string, unknown>, index + 1))
    : [];

  return {
    session: result.session,
    page: result.page,
    data: {
      selector: options.selector ?? null,
      action: normalizeString(parsed.action),
      method: normalizeString(parsed.method) ?? "get",
      fieldCount: fields.length,
      fields,
    },
  };
}

function lookupField(fields: FormField[], key: string) {
  const normalized = key.trim().toLowerCase();
  return (
    fields.find((field) => field.label?.toLowerCase() === normalized) ??
    fields.find((field) => field.name?.toLowerCase() === normalized) ??
    fields.find((field) => field.placeholder?.toLowerCase() === normalized) ??
    fields.find((field) => field.id?.toLowerCase() === normalized)
  );
}

export async function managedFillForm(options: {
  sessionName?: string;
  selector?: string;
  values: Record<string, string | boolean | string[]>;
}) {
  const analyzed = await managedAnalyzeForm({
    sessionName: options.sessionName,
    selector: options.selector,
  });
  const fields = analyzed.data.fields as FormField[];
  const filled: Array<{ key: string; selectorHint: string | null; kind: string }> = [];

  for (const [key, rawValue] of Object.entries(options.values)) {
    const field = lookupField(fields, key);
    if (!field) {
      throw new Error(`FORM_FIELD_NOT_FOUND:${key}`);
    }
    const selector = field.selectorHint;
    if (!selector) {
      throw new Error(`FORM_FIELD_SELECTOR_UNAVAILABLE:${key}`);
    }

    if (field.tagName === "select") {
      await managedSelect({
        sessionName: options.sessionName,
        selector,
        nth: 1,
        value: Array.isArray(rawValue) ? (rawValue[0] ?? "") : String(rawValue),
      });
      filled.push({ key, selectorHint: selector, kind: "select" });
      continue;
    }

    if (field.inputType === "checkbox" || field.inputType === "radio") {
      if (rawValue === true || rawValue === "true") {
        await managedCheck({ sessionName: options.sessionName, selector, nth: 1 });
      }
      filled.push({ key, selectorHint: selector, kind: "check" });
      continue;
    }

    await managedFill({
      sessionName: options.sessionName,
      selector,
      nth: 1,
      value: Array.isArray(rawValue) ? rawValue.join(", ") : String(rawValue),
    });
    filled.push({ key, selectorHint: selector, kind: "fill" });
  }

  return {
    session: analyzed.session,
    page: analyzed.page,
    data: {
      selector: options.selector ?? null,
      fieldCount: fields.length,
      filledCount: filled.length,
      filled,
    },
  };
}
