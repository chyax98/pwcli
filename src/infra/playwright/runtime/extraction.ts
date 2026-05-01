import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { managedRunCode } from "./code.js";

type ExtractFieldRecipe =
  | string
  | {
      selector?: string;
      attr?: string;
      multiple?: boolean;
    };

type ExtractRecipeInput = {
  kind?: unknown;
  itemSelector?: unknown;
  containerSelector?: unknown;
  fields?: unknown;
  limit?: unknown;
  runtimeGlobal?: unknown;
  pagination?: unknown;
  scroll?: unknown;
  output?: unknown;
};

type NormalizedExtractFieldRecipe = {
  selector: string | null;
  attr: string | null;
  multiple: boolean;
};

type NormalizedExtractPagination =
  | {
      mode: "next-page";
      selector: string;
      maxPages: number;
    }
  | {
      mode: "load-more";
      selector: string;
      maxPages: number;
    }
  | null;

type NormalizedExtractScroll =
  | {
      mode: "until-stable";
      stepPx: number;
      settleMs: number;
      maxSteps: number;
    }
  | null;

type NormalizedExtractOutput = {
  format: "json" | "csv" | "markdown";
  columns: string[] | null;
};

type ExtractArtifactFormat = NormalizedExtractOutput["format"];

type NormalizedExtractRecipe = {
  kind: "list" | "article";
  itemSelector: string | null;
  containerSelector: string | null;
  fields: Record<string, NormalizedExtractFieldRecipe>;
  limit: number;
  runtimeGlobal: string | null;
  pagination: NormalizedExtractPagination;
  scroll: NormalizedExtractScroll;
  output: NormalizedExtractOutput;
};

type ManagedExtractRunOptions = {
  sessionName?: string;
  recipePath: string;
  out?: string;
};

type RuntimeProbeResult = {
  path: string;
  found: boolean;
  value?: unknown;
};

type ExtractTraversalFacts = {
  pageCount?: number;
  paginationMode?: "next-page" | "load-more";
  scrollMode?: "until-stable";
  scrollStepsUsed?: number;
  maxPages?: number;
  maxScrollSteps?: number;
};

type ExtractRunPayload = {
  page?: {
    url?: string;
    title?: string;
  };
  format: "json";
  recipe: NormalizedExtractRecipe;
  recordCount: number;
  records: unknown[];
  runtimeProbe?: RuntimeProbeResult;
  traversal?: ExtractTraversalFacts;
};

type ExtractArtifact = {
  recipeId: string;
  url: string;
  generatedAt: string;
  items: Array<Record<string, unknown>>;
  stats: {
    kind: "list" | "article";
    itemCount: number;
    fieldCount: number;
    limit: number;
    pageCount?: number;
    paginationMode?: "next-page" | "load-more";
    scrollMode?: "until-stable";
    scrollStepsUsed?: number;
    maxPages?: number;
    maxScrollSteps?: number;
    runtimeProbePath?: string;
    runtimeProbeFound?: boolean;
  };
  runtimeProbe?: RuntimeProbeResult;
};

type ExtractArtifactPayload = ExtractArtifact & {
  recipe: NormalizedExtractRecipe;
  recordCount: number;
  records: Array<Record<string, unknown>>;
};

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
  const multiple = Boolean(record.multiple);

  if (!selector && !attr) {
    invalidRecipe(`field "${fieldName}" requires selector or attr`);
  }

  return {
    selector,
    attr,
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

function normalizeRecipe(value: unknown): NormalizedExtractRecipe {
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

  const runtimeGlobal =
    readNonEmptyString(recipe.runtimeGlobal);
  if (
    runtimeGlobal &&
    !/^[A-Za-z_$][A-Za-z0-9_$]*(\.[A-Za-z_$][A-Za-z0-9_$]*)*$/.test(runtimeGlobal)
  ) {
    invalidRecipe("runtimeGlobal must be a dotted global path like __NEXT_DATA__ or app.state");
  }

  const itemSelector = readNonEmptyString(recipe.itemSelector);
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
    containerSelector,
    fields,
    limit: Math.min(Math.floor(limit), kind === "list" ? 200 : 1),
    runtimeGlobal,
    pagination,
    scroll,
    output,
  };
}

function buildExtractionSource(recipe: NormalizedExtractRecipe) {
  return `async page => {
    const recipe = ${JSON.stringify(recipe)};
    const extractPage = async () => {
      return await page.evaluate((recipe) => {
        const normalizeText = value => String(value ?? '').replace(/\\s+/g, ' ').trim();
        const isVisible = node => {
          if (!(node instanceof HTMLElement))
            return false;
          const style = window.getComputedStyle(node);
          if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0')
            return false;
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && node.getClientRects().length > 0;
        };
        const visibleNodes = (root, selector) => {
          const nodes = selector ? Array.from(root.querySelectorAll(selector)) : [root];
          return nodes.filter(node => {
            if (node instanceof HTMLElement)
              return isVisible(node);
            if (node instanceof SVGElement)
              return true;
            return false;
          });
        };
        const readNodeValue = (node, attr) => {
          if (attr) {
            if ((attr === 'href' || attr === 'src') && typeof node[attr] === 'string')
              return normalizeText(node[attr]);
            if (typeof node.getAttribute === 'function')
              return normalizeText(node.getAttribute(attr) ?? '');
            return '';
          }
          if (node instanceof HTMLElement)
            return normalizeText(node.innerText || node.textContent || '');
          return normalizeText(node.textContent || '');
        };
        const extractField = (root, spec) => {
          const values = visibleNodes(root, spec.selector)
            .map(node => readNodeValue(node, spec.attr))
            .filter(Boolean);
          if (spec.multiple)
            return values;
          return values[0] ?? null;
        };
        const extractRecord = root => {
          const record = {};
          for (const [fieldName, spec] of Object.entries(recipe.fields))
            record[fieldName] = extractField(root, spec);
          return record;
        };
        const listRoots = recipe.kind === 'list'
          ? visibleNodes(document, recipe.itemSelector).slice(0, recipe.limit)
          : [];
        const articleRoot =
          recipe.kind === 'article'
            ? visibleNodes(document, recipe.containerSelector)[0] ?? null
            : null;
        const records = recipe.kind === 'list'
          ? listRoots.map(extractRecord)
          : articleRoot
            ? [extractRecord(articleRoot)]
            : [];

        const sanitize = (value, depth, seen) => {
          if (value == null || typeof value === 'boolean' || typeof value === 'number')
            return value;
          if (typeof value === 'string')
            return value.length > 1000 ? value.slice(0, 1000) : value;
          if (depth >= 4)
            return Array.isArray(value) ? '[truncated-array]' : '[truncated-object]';
          if (typeof value === 'function')
            return '[function]';
          if (typeof value !== 'object')
            return String(value);
          if (seen.has(value))
            return '[circular]';
          seen.add(value);
          if (Array.isArray(value))
            return value.slice(0, 20).map(item => sanitize(item, depth + 1, seen));
          const entries = Object.entries(value).slice(0, 20);
          const output = {};
          for (const [key, item] of entries)
            output[key] = sanitize(item, depth + 1, seen);
          return output;
        };

        let runtimeProbe;
        if (recipe.runtimeGlobal) {
          const segments = recipe.runtimeGlobal.split('.');
          let current = window;
          let found = true;
          for (const segment of segments) {
            if (current == null || !(segment in current)) {
              found = false;
              break;
            }
            current = current[segment];
          }
          runtimeProbe = {
            path: recipe.runtimeGlobal,
            found,
            ...(found ? { value: sanitize(current, 0, new WeakSet()) } : {}),
          };
        }

        return {
          page: {
            url: location.href,
            title: document.title,
          },
          recordCount: records.length,
          records,
          ...(runtimeProbe ? { runtimeProbe } : {}),
        };
      }, recipe);
    };

    const aggregatedRecords = [];
    const seenSnapshots = new Set();
    let lastPayload;
    let pageCount = 0;
    let scrollStepsUsed = 0;

    while (true) {
      if (recipe.kind === 'list' && aggregatedRecords.length >= recipe.limit)
        break;

      const payload = await extractPage();
      const fingerprint = JSON.stringify({
        page: payload.page,
        records: payload.records,
      });
      if (seenSnapshots.has(fingerprint))
        break;

      seenSnapshots.add(fingerprint);
      lastPayload = payload;
      pageCount += 1;
      if (
        recipe.kind === 'list' &&
        (recipe.pagination?.mode === 'load-more' ||
          (!recipe.pagination && recipe.scroll?.mode === 'until-stable'))
      ) {
        aggregatedRecords.splice(0, aggregatedRecords.length, ...payload.records.slice(0, recipe.limit));
      } else if (recipe.kind === 'list') {
        const remainingSlots = Math.max(recipe.limit - aggregatedRecords.length, 0);
        if (remainingSlots > 0)
          aggregatedRecords.push(...payload.records.slice(0, remainingSlots));
      } else {
        aggregatedRecords.splice(0, aggregatedRecords.length, ...payload.records.slice(0, recipe.limit));
      }

      if (recipe.kind === 'list' && aggregatedRecords.length >= recipe.limit)
        break;

      const canTraverseNextPage =
        recipe.kind === 'list' &&
        recipe.pagination &&
        recipe.pagination.mode === 'next-page' &&
        pageCount < recipe.pagination.maxPages &&
        aggregatedRecords.length < recipe.limit;

      if (canTraverseNextPage) {
        const nextPageLink = page.locator(recipe.pagination.selector).first();
        if ((await nextPageLink.count()) < 1)
          break;
        const isVisible = await nextPageLink.isVisible().catch(() => false);
        const isEnabled = await nextPageLink.isEnabled().catch(() => false);
        if (!isVisible || !isEnabled)
          break;

        await Promise.all([
          page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 5000 }).catch(() => null),
          nextPageLink.click(),
        ]);
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => null);
        continue;
      }

      const canLoadMore =
        recipe.kind === 'list' &&
        recipe.pagination &&
        recipe.pagination.mode === 'load-more' &&
        pageCount < recipe.pagination.maxPages &&
        aggregatedRecords.length < recipe.limit;
      if (canLoadMore) {
        const loadMoreButton = page.locator(recipe.pagination.selector).first();
        if ((await loadMoreButton.count()) < 1)
          break;
        const isVisible = await loadMoreButton.isVisible().catch(() => false);
        const isEnabled = await loadMoreButton.isEnabled().catch(() => false);
        if (!isVisible || !isEnabled)
          break;

        await loadMoreButton.click();
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => null);
        await page.waitForTimeout(250);
        continue;
      }

      const canScroll =
        recipe.kind === 'list' &&
        !recipe.pagination &&
        recipe.scroll &&
        recipe.scroll.mode === 'until-stable' &&
        scrollStepsUsed < recipe.scroll.maxSteps &&
        aggregatedRecords.length < recipe.limit;
      if (canScroll) {
        await page.evaluate((stepPx) => {
          window.scrollBy(0, stepPx);
        }, recipe.scroll.stepPx);
        scrollStepsUsed += 1;
        if (recipe.scroll.settleMs > 0)
          await page.waitForTimeout(recipe.scroll.settleMs);
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => null);
        continue;
      }

      break;
    }

    const currentPage =
      lastPayload?.page ?? {
        url: page.url(),
        title: await page.title(),
      };
    const traversal = {};
    if (recipe.pagination) {
      traversal.pageCount = pageCount;
      traversal.paginationMode = recipe.pagination.mode;
      traversal.maxPages = recipe.pagination.maxPages;
    }
    if (recipe.scroll) {
      traversal.scrollMode = recipe.scroll.mode;
      traversal.scrollStepsUsed = scrollStepsUsed;
      traversal.maxScrollSteps = recipe.scroll.maxSteps;
    }

    return JSON.stringify({
      page: currentPage,
      format: 'json',
      recipe,
      recordCount: aggregatedRecords.length,
      records: aggregatedRecords,
      ...(lastPayload?.runtimeProbe ? { runtimeProbe: lastPayload.runtimeProbe } : {}),
      ...(Object.keys(traversal).length > 0 ? { traversal } : {}),
    });
  }`;
}

async function loadRecipe(path: string) {
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

function resolveArtifactColumns(
  recipe: NormalizedExtractRecipe,
  items: Array<Record<string, unknown>>,
): string[] {
  if (recipe.output.columns?.length) {
    return recipe.output.columns;
  }

  const columns: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    for (const key of Object.keys(item)) {
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      columns.push(key);
    }
  }

  if (columns.length > 0) {
    return columns;
  }

  return Object.keys(recipe.fields);
}

function renderArtifactCell(value: unknown): string {
  if (value == null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  return JSON.stringify(value);
}

function escapeCsvCell(value: string): string {
  if (!/[",\n\r]/.test(value)) {
    return value;
  }
  return `"${value.replaceAll('"', '""')}"`;
}

function renderCsvArtifact(
  recipe: NormalizedExtractRecipe,
  payload: ExtractArtifactPayload,
): string {
  const columns = resolveArtifactColumns(recipe, payload.items);
  const lines = [
    columns.map((column) => escapeCsvCell(column)).join(","),
    ...payload.items.map((item) =>
      columns
        .map((column) => escapeCsvCell(renderArtifactCell(item[column])))
        .join(","),
    ),
  ];
  return `${lines.join("\n")}\n`;
}

function escapeMarkdownCell(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("|", "\\|").replaceAll("\n", "<br />");
}

function renderMarkdownArtifact(
  recipe: NormalizedExtractRecipe,
  payload: ExtractArtifactPayload,
): string {
  const columns = resolveArtifactColumns(recipe, payload.items);
  const lines = [
    `| ${columns.map((column) => escapeMarkdownCell(column)).join(" | ")} |`,
    `| ${columns.map(() => "---").join(" | ")} |`,
    ...payload.items.map((item) =>
      `| ${columns
        .map((column) => escapeMarkdownCell(renderArtifactCell(item[column])))
        .join(" | ")} |`,
    ),
  ];
  return `${lines.join("\n")}\n`;
}

function serializeArtifact(
  recipe: NormalizedExtractRecipe,
  payload: ExtractArtifactPayload,
): string {
  const artifactFormat: ExtractArtifactFormat = recipe.output.format;
  if (artifactFormat === "csv") {
    return renderCsvArtifact(recipe, payload);
  }
  if (artifactFormat === "markdown") {
    return renderMarkdownArtifact(recipe, payload);
  }
  return JSON.stringify(payload, null, 2);
}

async function writeArtifact(
  path: string,
  recipe: NormalizedExtractRecipe,
  payload: ExtractArtifactPayload,
) {
  const resolved = resolve(path);
  await mkdir(dirname(resolved), { recursive: true });
  await writeFile(resolved, serializeArtifact(recipe, payload), "utf8");
  return resolved;
}

function recipeIdFor(recipe: NormalizedExtractRecipe) {
  const hash = createHash("sha256").update(JSON.stringify(recipe)).digest("hex").slice(0, 12);
  return `extract:${recipe.kind}:${hash}`;
}

function normalizeRuntimeProbe(value: unknown): RuntimeProbeResult | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const probe = value as Record<string, unknown>;
  if (typeof probe.path !== "string" || typeof probe.found !== "boolean") {
    return undefined;
  }
  return {
    path: probe.path,
    found: probe.found,
    ...(Object.prototype.hasOwnProperty.call(probe, "value") ? { value: probe.value } : {}),
  };
}

function normalizeTraversal(value: unknown): ExtractTraversalFacts | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const traversal = value as Record<string, unknown>;
  const normalized: ExtractTraversalFacts = {};

  if (traversal.paginationMode === "next-page" || traversal.paginationMode === "load-more") {
    if (
      typeof traversal.pageCount !== "number" ||
      !Number.isFinite(traversal.pageCount) ||
      traversal.pageCount <= 0
    ) {
      return undefined;
    }
    normalized.pageCount = Math.floor(traversal.pageCount);
    normalized.paginationMode = traversal.paginationMode;
  }

  if (traversal.scrollMode === "until-stable") {
    if (
      typeof traversal.scrollStepsUsed !== "number" ||
      !Number.isFinite(traversal.scrollStepsUsed) ||
      traversal.scrollStepsUsed < 0
    ) {
      return undefined;
    }
    normalized.scrollMode = traversal.scrollMode;
    normalized.scrollStepsUsed = Math.floor(traversal.scrollStepsUsed);
  }

  if (traversal.maxPages != null) {
    if (
      typeof traversal.maxPages !== "number" ||
      !Number.isFinite(traversal.maxPages) ||
      traversal.maxPages <= 0
    ) {
      return undefined;
    }
    normalized.maxPages = Math.floor(traversal.maxPages);
  }

  if (traversal.maxScrollSteps != null) {
    if (
      typeof traversal.maxScrollSteps !== "number" ||
      !Number.isFinite(traversal.maxScrollSteps) ||
      traversal.maxScrollSteps <= 0
    ) {
      return undefined;
    }
    normalized.maxScrollSteps = Math.floor(traversal.maxScrollSteps);
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizePage(
  value: unknown,
  fallback:
    | {
        url?: string;
        title?: string;
      }
    | undefined,
) {
  const page =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  const url =
    typeof page?.url === "string"
      ? page.url
      : typeof fallback?.url === "string"
        ? fallback.url
        : "";
  const title =
    typeof page?.title === "string"
      ? page.title
      : typeof fallback?.title === "string"
        ? fallback.title
        : "";
  return url || title ? { url, title } : undefined;
}

function normalizeItems(records: unknown[]) {
  return records.filter(
    (record): record is Record<string, unknown> =>
      Boolean(record) && typeof record === "object" && !Array.isArray(record),
  );
}

function buildArtifact(options: {
  recipe: NormalizedExtractRecipe;
  page: {
    url?: string;
    title?: string;
  };
  records: unknown[];
  runtimeProbe?: RuntimeProbeResult;
  traversal?: ExtractTraversalFacts;
}): ExtractArtifact {
  const items = normalizeItems(options.records);
  return {
    recipeId: recipeIdFor(options.recipe),
    url: options.page.url ?? "",
    generatedAt: new Date().toISOString(),
    items,
    stats: {
      kind: options.recipe.kind,
      itemCount: items.length,
      fieldCount: Object.keys(options.recipe.fields).length,
      limit: options.recipe.limit,
      ...(options.traversal?.paginationMode
        ? {
            pageCount: options.traversal.pageCount,
            paginationMode: options.traversal.paginationMode,
          }
        : {}),
      ...(typeof options.traversal?.maxPages === "number"
        ? {
            maxPages: options.traversal.maxPages,
          }
        : {}),
      ...(options.traversal?.scrollMode
        ? {
            scrollMode: options.traversal.scrollMode,
            scrollStepsUsed: options.traversal.scrollStepsUsed,
          }
        : {}),
      ...(typeof options.traversal?.maxScrollSteps === "number"
        ? {
            maxScrollSteps: options.traversal.maxScrollSteps,
          }
        : {}),
      ...(options.runtimeProbe
        ? {
            runtimeProbePath: options.runtimeProbe.path,
            runtimeProbeFound: options.runtimeProbe.found,
          }
        : {}),
    },
    ...(options.runtimeProbe ? { runtimeProbe: options.runtimeProbe } : {}),
  };
}

function buildArtifactPayload(options: {
  recipe: NormalizedExtractRecipe;
  artifact: ExtractArtifact;
}): ExtractArtifactPayload {
  return {
    ...options.artifact,
    recipe: options.recipe,
    recordCount: options.artifact.stats.itemCount,
    records: options.artifact.items,
  };
}

export async function managedExtractRun(options: ManagedExtractRunOptions) {
  const { path: recipePath, recipe } = await loadRecipe(options.recipePath);
  const result = await managedRunCode({
    sessionName: options.sessionName,
    source: buildExtractionSource(recipe),
  });
  const payload =
    typeof result.data.result === "object" && result.data.result
      ? (result.data.result as Partial<ExtractRunPayload>)
      : null;
  if (!payload || !Array.isArray(payload.records) || typeof payload.recordCount !== "number") {
    throw new Error("EXTRACT_RESULT_INVALID");
  }
  const page = normalizePage(payload.page, result.page);
  const runtimeProbe = normalizeRuntimeProbe(payload.runtimeProbe);
  const traversal = normalizeTraversal(payload.traversal);
  const artifact = buildArtifact({
    recipe,
    page: page ?? {},
    records: payload.records,
    runtimeProbe,
    traversal,
  });
  const artifactPayload = buildArtifactPayload({
    recipe,
    artifact,
  });
  const artifactPath = options.out ? await writeArtifact(options.out, recipe, artifactPayload) : undefined;

  return {
    session: result.session,
    page: page ?? result.page,
    data: {
      format: "json",
      recipePath,
      ...artifactPayload,
      ...(artifactPath
        ? {
            artifactPath,
            ...(recipe.output.format !== "json" ? { artifactFormat: recipe.output.format } : {}),
          }
        : {}),
    },
  };
}
