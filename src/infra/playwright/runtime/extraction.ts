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
};

type NormalizedExtractFieldRecipe = {
  selector: string | null;
  attr: string | null;
  multiple: boolean;
};

type NormalizedExtractRecipe = {
  kind: "list" | "article";
  itemSelector: string | null;
  containerSelector: string | null;
  fields: Record<string, NormalizedExtractFieldRecipe>;
  limit: number;
  runtimeGlobal: string | null;
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
    typeof recipe.runtimeGlobal === "string" && recipe.runtimeGlobal.trim().length > 0
      ? recipe.runtimeGlobal.trim()
      : null;
  if (
    runtimeGlobal &&
    !/^[A-Za-z_$][A-Za-z0-9_$]*(\.[A-Za-z_$][A-Za-z0-9_$]*)*$/.test(runtimeGlobal)
  ) {
    throw new Error("EXTRACT_RUNTIME_GLOBAL_INVALID");
  }

  const itemSelector =
    typeof recipe.itemSelector === "string" && recipe.itemSelector.trim().length > 0
      ? recipe.itemSelector.trim()
      : null;
  const containerSelector =
    typeof recipe.containerSelector === "string" && recipe.containerSelector.trim().length > 0
      ? recipe.containerSelector.trim()
      : null;

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
  };
}

function buildExtractionSource(recipe: NormalizedExtractRecipe) {
  return `async page => {
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

      return JSON.stringify({
        page: {
          url: location.href,
          title: document.title,
        },
        format: 'json',
        recipe,
        recordCount: records.length,
        records,
        ...(runtimeProbe ? { runtimeProbe } : {}),
      });
    }, ${JSON.stringify(recipe)});
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

async function writeArtifact(path: string, payload: ExtractArtifactPayload) {
  const resolved = resolve(path);
  await mkdir(dirname(resolved), { recursive: true });
  await writeFile(resolved, JSON.stringify(payload, null, 2), "utf8");
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
  const artifact = buildArtifact({
    recipe,
    page: page ?? {},
    records: payload.records,
    runtimeProbe,
  });
  const artifactPayload = buildArtifactPayload({
    recipe,
    artifact,
  });
  const artifactPath = options.out ? await writeArtifact(options.out, artifactPayload) : undefined;

  return {
    session: result.session,
    page: page ?? result.page,
    data: {
      format: "json",
      recipePath,
      ...artifactPayload,
      ...(artifactPath ? { artifactPath } : {}),
    },
  };
}
