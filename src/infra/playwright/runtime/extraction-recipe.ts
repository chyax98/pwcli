import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type {
  ExtractRecipeInput,
  NormalizedExtractFieldRecipe,
  NormalizedExtractOutput,
  NormalizedExtractPagination,
  NormalizedExtractRecipe,
  NormalizedExtractScroll,
} from "./extraction-types.js";

function invalidRecipe(message: string): never {
  throw new Error(`EXTRACT_RECIPE_INVALID: ${message}`);
}

function asObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    invalidRecipe(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function readNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizePositiveInteger(value: unknown, label: string): number {
  const normalized =
    typeof value === "number" && Number.isFinite(value)
      ? Math.floor(value)
      : typeof value === "string" && value.trim().length > 0
        ? Math.floor(Number(value))
        : Number.NaN;
  if (!Number.isFinite(normalized) || normalized <= 0) {
    invalidRecipe(`${label} must be a positive integer`);
  }
  return normalized;
}

function normalizeNonNegativeInteger(value: unknown, label: string): number {
  const normalized =
    typeof value === "number" && Number.isFinite(value)
      ? Math.floor(value)
      : typeof value === "string" && value.trim().length > 0
        ? Math.floor(Number(value))
        : Number.NaN;
  if (!Number.isFinite(normalized) || normalized < 0) {
    invalidRecipe(`${label} must be a non-negative integer`);
  }
  return normalized;
}

function normalizeFieldRecipe(value: unknown, fieldName: string): NormalizedExtractFieldRecipe {
  if (typeof value === "string") {
    const selector = value.trim();
    if (!selector) {
      invalidRecipe(`field "${fieldName}" requires a non-empty selector`);
    }
    return {
      selector,
      attr: null,
      source: "item",
      multiple: false,
    };
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    invalidRecipe(`field "${fieldName}" must be a selector string or object`);
  }

  const record = value as Record<string, unknown>;
  const selector =
    typeof record.selector === "string" && record.selector.trim().length > 0
      ? record.selector.trim()
      : null;
  const attr =
    typeof record.attr === "string" && record.attr.trim().length > 0
      ? record.attr.trim()
      : null;
  const source = record.source === "companion" ? "companion" : "item";
  const multiple = Boolean(record.multiple);

  if (!selector && !attr) {
    invalidRecipe(`field "${fieldName}" requires selector or attr`);
  }

  return {
    selector,
    attr,
    source,
    multiple,
  };
}

function normalizePagination(value: unknown): NormalizedExtractPagination {
  if (value == null) {
    return null;
  }
  const record = asObject(value, "pagination");
  const mode = record.mode;
  if (mode !== "next-page" && mode !== "load-more") {
    invalidRecipe('pagination.mode must be "next-page" or "load-more"');
  }
  const selector = readNonEmptyString(record.selector);
  if (!selector) {
    invalidRecipe("pagination.selector must be a non-empty string");
  }
  return {
    mode,
    selector,
    maxPages: normalizePositiveInteger(record.maxPages, "pagination.maxPages"),
  };
}

function normalizeScroll(value: unknown): NormalizedExtractScroll {
  if (value == null) {
    return null;
  }
  const record = asObject(value, "scroll");
  if (record.mode !== "until-stable") {
    invalidRecipe('scroll.mode must be "until-stable"');
  }
  return {
    mode: "until-stable",
    stepPx: normalizePositiveInteger(record.stepPx, "scroll.stepPx"),
    settleMs: normalizeNonNegativeInteger(record.settleMs, "scroll.settleMs"),
    maxSteps: normalizePositiveInteger(record.maxSteps, "scroll.maxSteps"),
  };
}

function normalizeOutput(value: unknown): NormalizedExtractOutput {
  if (value == null) {
    return {
      format: "json",
      columns: null,
    };
  }
  const record = asObject(value, "output");
  const formatRaw = record.format;
  const format =
    formatRaw == null
      ? "json"
      : formatRaw === "json" || formatRaw === "csv" || formatRaw === "markdown"
        ? formatRaw
        : null;
  if (!format) {
    invalidRecipe('output.format must be "json", "csv", or "markdown"');
  }

  let columns: string[] | null = null;
  if (record.columns != null) {
    if (!Array.isArray(record.columns) || record.columns.length === 0) {
      invalidRecipe("output.columns must be a non-empty string array");
    }
    columns = record.columns.map((column, index) => {
      const normalized = readNonEmptyString(column);
      if (!normalized) {
        invalidRecipe(`output.columns[${index}] must be a non-empty string`);
      }
      return normalized;
    });
  }

  return {
    format,
    columns,
  };
}

function normalizeExcludeSelectors(value: unknown): string[] {
  if (value == null) {
    return [];
  }
  if (!Array.isArray(value)) {
    invalidRecipe("excludeSelectors must be a string array");
  }
  return value.map((entry, index) => {
    const normalized = readNonEmptyString(entry);
    if (!normalized) {
      invalidRecipe(`excludeSelectors[${index}] must be a non-empty string`);
    }
    return normalized;
  });
}

export function normalizeRecipe(value: unknown): NormalizedExtractRecipe {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    invalidRecipe("recipe file must contain a JSON object");
  }

  const recipe = value as ExtractRecipeInput;
  const kind = recipe.kind === "list" || recipe.kind === "article" ? recipe.kind : null;
  if (!kind) {
    invalidRecipe('recipe kind must be "list" or "article"');
  }

  const fieldsRecord =
    recipe.fields && typeof recipe.fields === "object" && !Array.isArray(recipe.fields)
      ? (recipe.fields as Record<string, unknown>)
      : null;
  if (!fieldsRecord || Object.keys(fieldsRecord).length === 0) {
    invalidRecipe("recipe fields must contain at least one field");
  }

  const fields = Object.fromEntries(
    Object.entries(fieldsRecord).map(([fieldName, fieldRecipe]) => [
      fieldName,
      normalizeFieldRecipe(fieldRecipe, fieldName),
    ]),
  );
  const pagination = normalizePagination(recipe.pagination);
  const scroll = normalizeScroll(recipe.scroll);
  const output = normalizeOutput(recipe.output);
  const excludeSelectors = normalizeExcludeSelectors(recipe.excludeSelectors);

  const limitRaw = recipe.limit;
  const limit =
    typeof limitRaw === "number" && Number.isFinite(limitRaw)
      ? Math.floor(limitRaw)
      : typeof limitRaw === "string" && limitRaw.trim()
        ? Number(limitRaw)
        : kind === "list"
          ? 50
          : 1;
  if (!Number.isFinite(limit) || limit <= 0) {
    invalidRecipe("recipe limit must be a positive integer");
  }

  const runtimeGlobal = readNonEmptyString(recipe.runtimeGlobal);
  if (
    runtimeGlobal &&
    !/^[A-Za-z_$][A-Za-z0-9_$]*(\.[A-Za-z_$][A-Za-z0-9_$]*)*$/.test(runtimeGlobal)
  ) {
    invalidRecipe("runtimeGlobal must be a dotted global path like __NEXT_DATA__ or app.state");
  }

  const itemSelector = readNonEmptyString(recipe.itemSelector);
  const companionSelector = readNonEmptyString(recipe.companionSelector);
  const containerSelector = readNonEmptyString(recipe.containerSelector);

  if (kind === "list" && !itemSelector) {
    invalidRecipe('list recipe requires "itemSelector"');
  }
  if (kind === "article" && !containerSelector) {
    invalidRecipe('article recipe requires "containerSelector"');
  }

  return {
    kind,
    itemSelector,
    companionSelector,
    containerSelector,
    excludeSelectors,
    fields,
    limit: Math.min(Math.floor(limit), kind === "list" ? 200 : 1),
    runtimeGlobal,
    pagination,
    scroll,
    output,
  };
}

export async function loadRecipe(path: string) {
  const resolved = resolve(path);
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(resolved, "utf8")) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`EXTRACT_RECIPE_INVALID: unable to read recipe file (${message})`);
  }
  return {
    path: resolved,
    recipe: normalizeRecipe(parsed),
  };
}

export function recipeIdFor(recipe: NormalizedExtractRecipe) {
  const hash = createHash("sha256").update(JSON.stringify(recipe)).digest("hex").slice(0, 12);
  return `extract:${recipe.kind}:${hash}`;
}
