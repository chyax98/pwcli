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
  scrollSteps?: number;
  scrollStepsUsed?: number;
  maxPages?: number;
  maxScrollSteps?: number;
  dedupedBlockCount?: number;
};

type ExtractDocumentBlock =
  | {
      kind: "heading";
      text: string;
      level: number;
      sectionPath: string[];
    }
  | {
      kind: "paragraph";
      text: string;
      sectionPath: string[];
    }
  | {
      kind: "link";
      url: string;
      text?: string;
      sectionPath: string[];
    }
  | ExtractDocumentImage
  | ExtractDocumentVideo
  | {
      kind: "list";
      ordered: boolean;
      items: string[];
      sectionPath: string[];
    }
  | {
      kind: "quote";
      text: string;
      sectionPath: string[];
    }
  | {
      kind: "code";
      text: string;
      language?: string;
      languageHint?: string;
      sectionPath: string[];
    }
  | {
      kind: "table";
      headers: string[];
      rows: string[][];
      caption?: string;
      sectionPath: string[];
    };

type ExtractDocumentImage = {
  kind: "image";
  url: string;
  currentSrc?: string;
  srcset?: string;
  caption?: string;
  sectionPath: string[];
};

type ExtractDocumentVideo = {
  kind: "video";
  url: string;
  currentSrc?: string;
  poster?: string;
  sources?: string[];
  caption?: string;
  sectionPath: string[];
};

type ExtractDocumentMedia = ExtractDocumentImage | ExtractDocumentVideo;

type ExtractDocument = {
  blocks: ExtractDocumentBlock[];
  media: ExtractDocumentMedia[];
};

type ExtractLimitation = string;

type ExtractRunPayload = {
  page?: {
    url?: string;
    title?: string;
  };
  format: "json";
  recipe: NormalizedExtractRecipe;
  recordCount: number;
  records: unknown[];
  document?: unknown;
  limitation?: unknown;
  limitations?: unknown;
  runtimeProbe?: RuntimeProbeResult;
  traversal?: ExtractTraversalFacts;
};

type ExtractArtifact = {
  recipeId: string;
  url: string;
  generatedAt: string;
  items: Array<Record<string, unknown>>;
  document: ExtractDocument;
  limitation?: ExtractLimitation;
  limitations?: ExtractLimitation[];
  stats: {
    kind: "list" | "article";
    itemCount: number;
    fieldCount: number;
    limit: number;
    pageCount?: number;
    paginationMode?: "next-page" | "load-more";
    scrollMode?: "until-stable";
    scrollSteps?: number;
    scrollStepsUsed?: number;
    maxPages?: number;
    maxScrollSteps?: number;
    dedupedBlockCount: number;
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
    const collectIframeContexts = async () => {
      return await page.evaluate(() => {
        const normalizeText = value => String(value ?? '').replace(/\\s+/g, ' ').trim();
        const readDirectHeadingText = element => {
          const heading = element.querySelector(
            ':scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6'
          );
          return heading instanceof HTMLElement
            ? normalizeText(heading.innerText || heading.textContent || '')
            : '';
        };
        const toSectionPath = (node, boundaryRoot) => {
          const path = [];
          let current = node.parentElement;
          while (current && current !== boundaryRoot && path.length < 4) {
            const headingText = readDirectHeadingText(current);
            if (headingText && path[0] !== headingText)
              path.unshift(headingText);
            current = current.parentElement;
          }
          return path;
        };
        return Array.from(document.querySelectorAll('iframe, frame')).map(node => ({
          url:
            typeof node.src === 'string' && node.src.trim().length > 0
              ? node.src
              : typeof node.getAttribute === 'function'
                ? normalizeText(node.getAttribute('src') ?? '')
                : '',
          sectionPath: toSectionPath(node, document.body || document.documentElement),
        }));
      });
    };

    const collectSameOriginFrameDocument = async (frame, inheritedSectionPath) => {
      return await frame.evaluate((inheritedSectionPath) => {
        const normalizeText = value => String(value ?? '').replace(/\\s+/g, ' ').trim();
        const isElementNode = node =>
          Boolean(node) && typeof node === 'object' && node.nodeType === Node.ELEMENT_NODE;
        const isHtmlLikeElement = node =>
          isElementNode(node)
          && typeof node.getBoundingClientRect === 'function'
          && typeof node.getClientRects === 'function';
        const isVisible = node => {
          if (!isHtmlLikeElement(node))
            return false;
          const ownerView = node.ownerDocument?.defaultView || window;
          const style = ownerView.getComputedStyle(node);
          if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0')
            return false;
          return true;
        };
        const readDirectHeadingText = element => {
          const heading = Array.from(element.children).find((child) => /^H[1-6]$/.test(child.tagName));
          if (!isElementNode(heading))
            return '';
          return normalizeText(heading.innerText || heading.textContent || '');
        };
        const mergeSectionPath = (prefix, suffix) => {
          const merged = [...prefix, ...suffix]
            .filter(item => typeof item === 'string' && item.trim().length > 0)
            .map(item => item.trim());
          const deduped = [];
          for (const item of merged) {
            if (deduped[deduped.length - 1] !== item)
              deduped.push(item);
          }
          return deduped.slice(0, 4);
        };
        const toSectionPath = (node, boundaryRoot) => {
          const path = [];
          let current = node.parentElement;
          while (current && current !== boundaryRoot && path.length < 4) {
            const headingText = readDirectHeadingText(current);
            if (headingText && path[0] !== headingText)
              path.unshift(headingText);
            current = current.parentElement;
          }
          return path;
        };
        const collectVideoUrl = element => {
          if (!isElementNode(element) || element.tagName?.toLowerCase() !== 'video')
            return '';
          if (typeof element.currentSrc === 'string' && element.currentSrc.trim())
            return normalizeText(element.currentSrc);
          if (typeof element.src === 'string' && element.src.trim())
            return normalizeText(element.src);
          const source = element.querySelector('source[src]');
          if (source && typeof source.src === 'string')
            return normalizeText(source.src);
          return '';
        };
        const readCodeText = element =>
          String(
            isHtmlLikeElement(element)
              ? element.innerText || element.textContent || ''
              : element.textContent || ''
          ).trim();
        const readCodeLanguage = element => {
          const languageSource =
            element.tagName.toLowerCase() === 'pre'
              ? element.querySelector('code')
              : element;
          const className =
            typeof languageSource?.getAttribute === 'function'
              ? (languageSource.getAttribute('class') ?? '')
              : '';
          const classTokens = className.split(/\\s+/).filter(Boolean);
          const token = classTokens.find(item => item.startsWith('language-'));
          return token ? token.slice('language-'.length) : undefined;
        };
        const collectDirectListItems = element =>
          Array.from(element.children)
            .filter(child => child.tagName.toLowerCase() === 'li')
            .map(child => normalizeText(child.innerText || child.textContent || ''))
            .filter(Boolean);
        const collectTableRows = rows =>
          rows
            .map(row =>
              Array.from(row.children)
                .filter(cell => ['td', 'th'].includes(cell.tagName.toLowerCase()))
                .map(cell => normalizeText(cell.innerText || cell.textContent || '')),
            )
            .filter(cells => cells.length > 0);
        const blocks = [];
        const media = [];
        const selectors = 'h1, h2, h3, h4, h5, h6, p, a[href], img[src], video, ul, ol, blockquote, pre, code, table';
        const nodes = Array.from((document.body || document.documentElement).querySelectorAll(selectors));
        for (const node of nodes) {
          if (!(node instanceof Element))
            continue;
          const tagName = node.tagName.toLowerCase();
          const sectionPath = mergeSectionPath(inheritedSectionPath, toSectionPath(node, document.body || document.documentElement));
          if (/^h[1-6]$/.test(tagName)) {
            const text = normalizeText(node.textContent || '');
            if (text) blocks.push({ kind: 'heading', text, level: Number.parseInt(tagName.slice(1), 10), sectionPath });
            continue;
          }
          if (tagName === 'p') {
            const text = normalizeText(node.textContent || '');
            if (text) blocks.push({ kind: 'paragraph', text, sectionPath });
            continue;
          }
          if (tagName === 'a') {
            const url = typeof node.href === 'string' ? normalizeText(node.href) : '';
            const text = normalizeText(node.textContent || '');
            if (url) blocks.push({ kind: 'link', url, ...(text ? { text } : {}), sectionPath });
            continue;
          }
          if (tagName === 'img') {
            const url = typeof node.currentSrc === 'string' || typeof node.src === 'string'
              ? normalizeText(node.currentSrc || node.src)
              : '';
            if (url) {
              const block = { kind: 'image', url, sectionPath };
              blocks.push(block);
              media.push(block);
            }
            continue;
          }
          if (tagName === 'video') {
            const url = collectVideoUrl(node);
            if (url) {
              const block = { kind: 'video', url, sectionPath };
              blocks.push(block);
              media.push(block);
            }
            continue;
          }
          if (tagName === 'ul' || tagName === 'ol') {
            const items = collectDirectListItems(node);
            if (items.length) blocks.push({ kind: 'list', ordered: tagName === 'ol', items, sectionPath });
            continue;
          }
          if (tagName === 'blockquote') {
            const text = normalizeText(node.textContent || '');
            if (text) blocks.push({ kind: 'quote', text, sectionPath });
            continue;
          }
          if (tagName === 'pre' || tagName === 'code') {
            const text = readCodeText(node);
            if (text) {
              const language = readCodeLanguage(node);
              blocks.push({ kind: 'code', text, ...(language ? { language } : {}), sectionPath });
            }
            continue;
          }
          if (tagName === 'table') {
            const headers = collectTableRows(Array.from(node.querySelectorAll('thead tr')))[0] ?? [];
            const rows = collectTableRows(Array.from(node.querySelectorAll('tbody tr')));
            if (headers.length || rows.length) blocks.push({ kind: 'table', headers, rows, sectionPath });
          }
        }
        return { blocks, media };
      }, inheritedSectionPath);
    };

    const collectSameOriginFrameDocumentFallback = async (frame, inheritedSectionPath) => {
      return await frame.evaluate((inheritedSectionPath) => {
        const normalizeText = value => String(value ?? '').replace(/\\s+/g, ' ').trim();
        const mergeSectionPath = (prefix, suffix) => {
          const merged = [...prefix, ...suffix]
            .filter(item => typeof item === 'string' && item.trim().length > 0)
            .map(item => item.trim());
          const deduped = [];
          for (const item of merged) {
            if (deduped[deduped.length - 1] !== item)
              deduped.push(item);
          }
          return deduped.slice(0, 4);
        };
        const readDirectHeadingText = element => {
          const heading = element.querySelector(
            ':scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6'
          );
          return heading instanceof HTMLElement
            ? normalizeText(heading.innerText || heading.textContent || '')
            : '';
        };
        const toSectionPath = (node, boundaryRoot) => {
          const path = [];
          let current = node.parentElement;
          while (current && current !== boundaryRoot && path.length < 4) {
            const headingText = readDirectHeadingText(current);
            if (headingText && path[0] !== headingText)
              path.unshift(headingText);
            current = current.parentElement;
          }
          return path;
        };
        const root = document.body || document.documentElement;
        const blocks = [];
        const media = [];
        for (const node of Array.from(root.querySelectorAll('h1,h2,h3,h4,h5,h6,p,a[href],img[src]'))) {
          const tagName = node.tagName.toLowerCase();
          const sectionPath = mergeSectionPath(inheritedSectionPath, toSectionPath(node, root));
          if (/^h[1-6]$/.test(tagName)) {
            const text = normalizeText(node.textContent || '');
            if (text) blocks.push({ kind: 'heading', text, level: Number.parseInt(tagName.slice(1), 10), sectionPath });
            continue;
          }
          if (tagName === 'p') {
            const text = normalizeText(node.textContent || '');
            if (text) blocks.push({ kind: 'paragraph', text, sectionPath });
            continue;
          }
          if (tagName === 'a') {
            const url = typeof node.href === 'string' ? normalizeText(node.href) : '';
            const text = normalizeText(node.textContent || '');
            if (url) blocks.push({ kind: 'link', url, ...(text ? { text } : {}), sectionPath });
            continue;
          }
          if (tagName === 'img') {
            const url = typeof node.currentSrc === 'string' || typeof node.src === 'string'
              ? normalizeText(node.currentSrc || node.src)
              : '';
            if (url) {
              const block = { kind: 'image', url, sectionPath };
              blocks.push(block);
              media.push(block);
            }
          }
        }
        return { blocks, media };
      }, inheritedSectionPath);
    };

    const extractPage = async () => {
      return await page.evaluate((recipe) => {
        const normalizeText = value => String(value ?? '').replace(/\\s+/g, ' ').trim();
        const isElementNode = node =>
          Boolean(node) && typeof node === 'object' && node.nodeType === Node.ELEMENT_NODE;
        const isHtmlLikeElement = node =>
          isElementNode(node)
          && typeof node.getBoundingClientRect === 'function'
          && typeof node.getClientRects === 'function';
        const isVisible = node => {
          if (!isHtmlLikeElement(node))
            return false;
          const ownerView = node.ownerDocument?.defaultView || window;
          const style = ownerView.getComputedStyle(node);
          if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0')
            return false;
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && node.getClientRects().length > 0;
        };
        const visibleNodes = (root, selector) => {
          const nodes = selector ? Array.from(root.querySelectorAll(selector)) : [root];
          return nodes.filter(node => {
            if (isHtmlLikeElement(node))
              return isVisible(node);
            if (typeof SVGElement !== 'undefined' && node instanceof SVGElement)
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
          if (isHtmlLikeElement(node))
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
        const collectVideoUrl = element => {
          if (!isElementNode(element) || element.tagName?.toLowerCase() !== 'video')
            return '';
          if (typeof element.currentSrc === 'string' && element.currentSrc.trim())
            return normalizeText(element.currentSrc);
          if (typeof element.src === 'string' && element.src.trim())
            return normalizeText(element.src);
          const source = element.querySelector('source[src]');
          if (source instanceof HTMLSourceElement && typeof source.src === 'string')
            return normalizeText(source.src);
          return '';
        };
        const readFigureCaption = element => {
          if (!(element instanceof Element))
            return undefined;
          const figure = element.closest('figure');
          if (!(figure instanceof HTMLElement))
            return undefined;
          const caption = Array.from(figure.children).find(child => child.tagName?.toLowerCase() === 'figcaption');
          if (!isHtmlLikeElement(caption) || !isVisible(caption))
            return undefined;
          const text = normalizeText(caption.innerText || caption.textContent || '');
          return text || undefined;
        };
        const collectVideoSources = element => {
          if (!(element instanceof HTMLVideoElement))
            return [];
          const sources = Array.from(element.querySelectorAll('source[src]'))
            .map(source =>
              typeof source.src === 'string'
                ? normalizeText(source.src)
                : normalizeText(source.getAttribute('src') ?? ''),
            )
            .filter(Boolean);
          return [...new Set(sources)];
        };
        const readImageDetails = element => {
          if (!isElementNode(element) || element.tagName?.toLowerCase() !== 'img')
            return null;
          const currentSrc =
            typeof element.currentSrc === 'string' ? normalizeText(element.currentSrc) : '';
          const src = typeof element.src === 'string' ? normalizeText(element.src) : '';
          const url = currentSrc || src;
          if (!url)
            return null;
          const srcset =
            typeof element.srcset === 'string' ? normalizeText(element.srcset) : '';
          const caption = readFigureCaption(element);
          return {
            url,
            ...(currentSrc ? { currentSrc } : {}),
            ...(srcset ? { srcset } : {}),
            ...(caption ? { caption } : {}),
          };
        };
        const readVideoDetails = element => {
          if (!isElementNode(element) || element.tagName?.toLowerCase() !== 'video')
            return null;
          const currentSrc =
            typeof element.currentSrc === 'string' ? normalizeText(element.currentSrc) : '';
          const src =
            typeof element.src === 'string' ? normalizeText(element.src) : '';
          const sources = collectVideoSources(element);
          const poster =
            typeof element.poster === 'string' ? normalizeText(element.poster) : '';
          const caption = readFigureCaption(element);
          const url = currentSrc || src || sources[0] || '';
          if (!url)
            return null;
          return {
            url,
            ...(currentSrc ? { currentSrc } : {}),
            ...(poster ? { poster } : {}),
            ...(sources.length > 0 ? { sources } : {}),
            ...(caption ? { caption } : {}),
          };
        };
        const shouldSkipParagraph = element =>
          Boolean(element.closest('blockquote, li, td, th, figcaption'));
        const shouldSkipStandaloneCode = element =>
          element.tagName.toLowerCase() === 'code' && Boolean(element.closest('pre'));
        const readDirectHeadingText = element => {
          if (!(element instanceof Element))
            return '';
          const heading = element.querySelector(
            ':scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6'
          );
          if (!isHtmlLikeElement(heading) || !isVisible(heading))
            return '';
          return normalizeText(heading.innerText || heading.textContent || '');
        };
        const toSectionPath = (node, boundaryRoot) => {
          const path = [];
          let current = node.parentElement;
          while (current && current !== boundaryRoot && path.length < 4) {
            const headingText = readDirectHeadingText(current);
            if (headingText && path[0] !== headingText)
              path.unshift(headingText);
            current = current.parentElement;
          }
          return path;
        };
        const readCodeText = element =>
          String(
            isHtmlLikeElement(element)
              ? element.innerText || element.textContent || ''
              : element.textContent || ''
          ).trim();
        const readCodeLanguage = element => {
          const languageSource =
            element.tagName.toLowerCase() === 'pre'
              ? element.querySelector('code')
              : element;
          const className =
            typeof languageSource?.getAttribute === 'function'
              ? (languageSource.getAttribute('class') ?? '')
              : '';
          const classTokens = className.split(/\\s+/).filter(Boolean);
          const token = classTokens.find(item => item.startsWith('language-'));
          if (token)
            return token.slice('language-'.length);
          const datasetLanguage =
            typeof languageSource?.getAttribute === 'function'
              ? normalizeText(languageSource.getAttribute('data-language') ?? '')
              : '';
          return datasetLanguage || undefined;
        };
        const readTableCaption = table => {
          if (!isElementNode(table) || table.tagName?.toLowerCase() !== 'table')
            return undefined;
          const caption = table.caption;
          if (!caption)
            return undefined;
          if (!isVisible(caption))
            return undefined;
          const text = normalizeText(caption.innerText || caption.textContent || '');
          return text || undefined;
        };
        const collectDirectListItems = element =>
          Array.from(element.children)
            .filter(child => child.tagName.toLowerCase() === 'li' && isVisible(child))
            .map(child => normalizeText(child.innerText || child.textContent || ''))
            .filter(Boolean);
        const collectTableRows = rows =>
          rows
            .map(row =>
              Array.from(row.children)
                .filter(cell => {
                  const tagName = cell.tagName.toLowerCase();
                  return (tagName === 'td' || tagName === 'th') && isVisible(cell);
                })
                .map(cell => normalizeText(cell.innerText || cell.textContent || '')),
            )
            .filter(cells => cells.length > 0);
        const collectDocument = roots => {
          const blocks = [];
          const media = [];
          const limitations = [];
          const seenMedia = new Set();
          const seenFrameDocuments = new WeakSet();
          const selectors =
            'h1, h2, h3, h4, h5, h6, p, a[href], img[src], video, ul, ol, blockquote, pre, code, table, iframe, frame';

          const pushLimitation = limitation => {
            if (typeof limitation !== 'string' || !limitation || limitations.includes(limitation))
              return;
            limitations.push(limitation);
          };

          const mergeSectionPath = (prefix, suffix) => {
            const merged = [...prefix, ...suffix]
              .filter(item => typeof item === 'string' && item.trim().length > 0)
              .map(item => item.trim());
            const deduped = [];
            for (const item of merged) {
              if (deduped[deduped.length - 1] !== item)
                deduped.push(item);
            }
            return deduped.slice(0, 4);
          };

          const pushMedia = entry => {
            const key = entry.kind + ':' + entry.url;
            if (seenMedia.has(key))
              return;
            seenMedia.add(key);
            media.push(entry);
          };

          const pushBlock = block => {
            blocks.push(block);
            if (block.kind === 'image' || block.kind === 'video')
              pushMedia(block);
          };

          const collectFrameRoot = (node, boundaryRoot, inheritedSectionPath) => {
            let frameDocument = null;
            try {
              frameDocument = node.contentDocument || node.contentWindow?.document || null;
            } catch {
              pushLimitation('cross-origin iframe content is not extracted');
              return;
            }
            if (!frameDocument || !frameDocument.documentElement)
              return;
            if (seenFrameDocuments.has(frameDocument))
              return;
            seenFrameDocuments.add(frameDocument);

            const frameRoot = frameDocument.body || frameDocument.documentElement;
            if (!frameRoot)
              return;
            collectRoot(
              frameRoot,
              frameRoot,
              mergeSectionPath(inheritedSectionPath, toSectionPath(node, boundaryRoot)),
              true,
            );
          };

          const collectRoot = (root, boundaryRoot, inheritedSectionPath, relaxedVisibility = false) => {
            const nodes = [
              ...(isElementNode(root) && typeof root.matches === 'function' && root.matches(selectors) ? [root] : []),
              ...Array.from(root.querySelectorAll(selectors)),
            ];
            for (const node of nodes) {
              if (!isElementNode(node))
                continue;
              const tagName = node.tagName.toLowerCase();

              if (!relaxedVisibility && isHtmlLikeElement(node) && !isVisible(node))
                continue;

              if (tagName === 'iframe' || tagName === 'frame') {
                collectFrameRoot(node, boundaryRoot, inheritedSectionPath);
                continue;
              }

              const sectionPath = mergeSectionPath(
                inheritedSectionPath,
                toSectionPath(node, boundaryRoot),
              );

              if (/^h[1-6]$/.test(tagName)) {
                const text = normalizeText(node.textContent || '');
                if (!text)
                  continue;
                pushBlock({
                  kind: 'heading',
                  text,
                  level: Number.parseInt(tagName.slice(1), 10),
                  sectionPath,
                });
                continue;
              }

              if (tagName === 'p') {
                if (shouldSkipParagraph(node))
                  continue;
                const text = normalizeText(node.textContent || '');
                if (!text)
                  continue;
                pushBlock({
                  kind: 'paragraph',
                  text,
                  sectionPath,
                });
                continue;
              }

              if (tagName === 'a') {
                const url =
                  typeof node.href === 'string' ? normalizeText(node.href) : '';
                if (!url)
                  continue;
                const text = normalizeText(node.textContent || '');
                pushBlock({
                  kind: 'link',
                  url,
                  ...(text ? { text } : {}),
                  sectionPath,
                });
                continue;
              }

              if (tagName === 'img') {
                const mediaEntry = readImageDetails(node);
                if (!mediaEntry)
                  continue;
                pushBlock({
                  kind: 'image',
                  ...mediaEntry,
                  sectionPath,
                });
                continue;
              }

              if (tagName === 'video') {
                const mediaEntry = readVideoDetails(node);
                if (!mediaEntry)
                  continue;
                pushBlock({
                  kind: 'video',
                  ...mediaEntry,
                  sectionPath,
                });
                continue;
              }

              if (tagName === 'ul' || tagName === 'ol') {
                const items = collectDirectListItems(node).filter(Boolean);
                if (items.length === 0)
                  continue;
                pushBlock({
                  kind: 'list',
                  ordered: tagName === 'ol',
                  items,
                  sectionPath,
                });
                continue;
              }

              if (tagName === 'blockquote') {
                const text = normalizeText(node.textContent || '');
                if (!text)
                  continue;
                pushBlock({
                  kind: 'quote',
                  text,
                  sectionPath,
                });
                continue;
              }

              if (tagName === 'pre' || tagName === 'code') {
                if (shouldSkipStandaloneCode(node))
                  continue;
                const text = readCodeText(node);
                if (!text)
                  continue;
                const language = readCodeLanguage(node);
                const languageHint = language;
                pushBlock({
                  kind: 'code',
                  text,
                  ...(language ? { language } : {}),
                  ...(languageHint ? { languageHint } : {}),
                  sectionPath,
                });
                continue;
              }

              if (tagName === 'table') {
                const table = node.tagName?.toLowerCase() === 'table' ? node : null;
                if (!table)
                  continue;
                const headerRows = collectTableRows(Array.from(table.tHead?.rows ?? []));
                const headers =
                  headerRows[0]
                  ?? collectTableRows(Array.from(table.querySelectorAll('tr')))
                    .find(row => row.length > 0)
                  ?? [];
                const bodyRows = collectTableRows(Array.from(table.tBodies).flatMap(section => Array.from(section.rows)));
                const fallbackRows =
                  bodyRows.length > 0
                    ? bodyRows
                    : collectTableRows(Array.from(table.querySelectorAll('tr'))).slice(headerRows.length > 0 ? 1 : 0);
                if (headers.length === 0 && fallbackRows.length === 0)
                  continue;
                const caption = readTableCaption(table);
                pushBlock({
                  kind: 'table',
                  headers,
                  rows: fallbackRows,
                  ...(caption ? { caption } : {}),
                  sectionPath,
                });
              }
            }
          };

          for (const root of roots) {
            collectRoot(root, root, []);
          }

          return { blocks, media, limitations };
        };
        const flattenDocuments = documents => {
          const flattened = {
            blocks: [],
            media: [],
            limitations: [],
          };
          for (const documentEntry of documents) {
            if (!documentEntry || typeof documentEntry !== 'object')
              continue;
            if (Array.isArray(documentEntry.blocks))
              flattened.blocks.push(...documentEntry.blocks);
            if (Array.isArray(documentEntry.media))
              flattened.media.push(...documentEntry.media);
            if (Array.isArray(documentEntry.limitations))
              flattened.limitations.push(...documentEntry.limitations);
          }
          return flattened;
        };
        const listRoots = recipe.kind === 'list'
          ? visibleNodes(document, recipe.itemSelector)
          : [];
        const articleRoot =
          recipe.kind === 'article'
            ? visibleNodes(document, recipe.containerSelector)[0] ?? null
            : null;
        const recordDocuments = recipe.kind === 'list'
          ? listRoots.map(root => collectDocument([root]))
          : [];
        const documentPayload = recipe.kind === 'list'
          ? flattenDocuments(recordDocuments)
          : collectDocument(articleRoot ? [articleRoot] : []);
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
          document: documentPayload,
          ...(recordDocuments.length > 0 ? { recordDocuments } : {}),
          ...(runtimeProbe ? { runtimeProbe } : {}),
        };
      }, recipe);
    };

    const aggregatedRecords = [];
    const aggregatedDocument = {
      blocks: [],
      media: [],
    };
    const aggregatedLimitations = new Set();
    const seenSnapshots = new Set();
    const seenRecordFingerprints = new Set();
    const seenBlockFingerprints = new Set();
    const seenMediaFingerprints = new Set();
    const selectedRecordDocuments = new Map();
    let lastPayload;
    let pageCount = 0;
    let scrollStepsUsed = 0;
    let dedupedBlockCount = 0;
    let currentPageUrl = null;
    let currentPageDocument = {
      blocks: [],
      media: [],
    };
    let currentPageDedupedBlockCount = 0;

    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => null);
    await page.waitForTimeout(200).catch(() => null);

    const fingerprintValue = value => JSON.stringify(value);
    const flattenDocuments = documents => {
      const flattened = {
        blocks: [],
        media: [],
      };
      for (const documentEntry of documents) {
        if (!documentEntry || typeof documentEntry !== 'object')
          continue;
        if (Array.isArray(documentEntry.blocks))
          flattened.blocks.push(...documentEntry.blocks);
        if (Array.isArray(documentEntry.media))
          flattened.media.push(...documentEntry.media);
      }
      return flattened;
    };

    const documentForRecordCount = (payload, recordCount) => {
      if (Array.isArray(payload.recordDocuments) && payload.recordDocuments.length > 0) {
        return flattenDocuments(payload.recordDocuments.slice(0, recordCount));
      }
      return {
        blocks: Array.isArray(payload.document?.blocks) ? payload.document.blocks : [],
        media: Array.isArray(payload.document?.media) ? payload.document.media : [],
      };
    };

    const appendUniqueEntries = (target, entries, seenFingerprints) => {
      let duplicates = 0;
      for (const entry of entries) {
        const fingerprint = fingerprintValue(entry);
        if (seenFingerprints.has(fingerprint)) {
          duplicates += 1;
          continue;
        }
        seenFingerprints.add(fingerprint);
        target.push(entry);
      }
      return duplicates;
    };

    const dedupeEntries = entries => {
      const deduped = [];
      const seenFingerprints = new Set();
      let duplicates = 0;
      for (const entry of entries) {
        const fingerprint = fingerprintValue(entry);
        if (seenFingerprints.has(fingerprint)) {
          duplicates += 1;
          continue;
        }
        seenFingerprints.add(fingerprint);
        deduped.push(entry);
      }
      return {
        entries: deduped,
        duplicates,
      };
    };

    const buildSelectedPageDocument = (payload, selectedRecordFingerprints) => {
      if (Array.isArray(payload.recordDocuments) && payload.recordDocuments.length > 0) {
        const blocks = [];
        const media = [];
        const recordCount = Math.min(payload.records.length, payload.recordDocuments.length);
        for (let index = 0; index < recordCount; index += 1) {
          const record = payload.records[index];
          const fingerprint = fingerprintValue(record);
          if (!selectedRecordFingerprints.has(fingerprint))
            continue;
          const documentEntry = flattenDocuments([payload.recordDocuments[index]]);
          if (documentEntry.blocks.length > 0)
            blocks.push(...documentEntry.blocks);
          if (documentEntry.media.length > 0)
            media.push(...documentEntry.media);
        }
        const dedupedBlocks = dedupeEntries(blocks);
        const dedupedMedia = dedupeEntries(media);
        return {
          document: {
            blocks: dedupedBlocks.entries,
            media: dedupedMedia.entries,
          },
          dedupedBlockCount: dedupedBlocks.duplicates,
        };
      }

      const nextDocument = documentForRecordCount(payload, aggregatedRecords.length);
      const dedupedBlocks = dedupeEntries(nextDocument.blocks);
      const dedupedMedia = dedupeEntries(nextDocument.media);
      return {
        document: {
          blocks: dedupedBlocks.entries,
          media: dedupedMedia.entries,
        },
        dedupedBlockCount: dedupedBlocks.duplicates,
      };
    };

    const flushCurrentPageDocument = () => {
      if (currentPageDocument.blocks.length === 0 && currentPageDocument.media.length === 0)
        return;
      dedupedBlockCount += currentPageDedupedBlockCount;
      dedupedBlockCount += appendUniqueEntries(
        aggregatedDocument.blocks,
        currentPageDocument.blocks,
        seenBlockFingerprints,
      );
      appendUniqueEntries(aggregatedDocument.media, currentPageDocument.media, seenMediaFingerprints);
      currentPageDocument = {
        blocks: [],
        media: [],
      };
      currentPageDedupedBlockCount = 0;
    };

    const dedupePayloadRecords = payload => {
      if (!Array.isArray(payload.records) || payload.records.length === 0)
        return [];
      const deduped = [];
      const seenPayloadFingerprints = new Set();
      for (const record of payload.records) {
        const fingerprint = fingerprintValue(record);
        if (seenPayloadFingerprints.has(fingerprint))
          continue;
        seenPayloadFingerprints.add(fingerprint);
        deduped.push({
          fingerprint,
          record,
        });
      }
      return deduped;
    };

    const appendNewRecords = payload => {
      if (!Array.isArray(payload.records) || payload.records.length === 0)
        return;
      const remainingSlots = Math.max(recipe.limit - aggregatedRecords.length, 0);
      if (remainingSlots <= 0)
        return;
      const nextRecords = [];
      for (const entry of dedupePayloadRecords(payload)) {
        if (seenRecordFingerprints.has(entry.fingerprint))
          continue;
        nextRecords.push(entry);
        if (nextRecords.length >= remainingSlots)
          break;
      }
      for (const entry of nextRecords) {
        seenRecordFingerprints.add(entry.fingerprint);
        aggregatedRecords.push(entry.record);
      }
    };

    const updateSelectedRecordDocuments = payload => {
      if (!Array.isArray(payload.recordDocuments) || payload.recordDocuments.length === 0)
        return;
      const recordCount = Math.min(payload.records.length, payload.recordDocuments.length);
      for (let index = 0; index < recordCount; index += 1) {
        const record = payload.records[index];
        const fingerprint = fingerprintValue(record);
        if (!seenRecordFingerprints.has(fingerprint))
          continue;
        selectedRecordDocuments.set(
          fingerprint,
          flattenDocuments([payload.recordDocuments[index]]),
        );
      }
    };

    const buildAggregatedSelectedDocument = () => {
      const flattened = flattenDocuments(Array.from(selectedRecordDocuments.values()));
      const dedupedBlocks = dedupeEntries(flattened.blocks);
      const dedupedMedia = dedupeEntries(flattened.media);
      return {
        document: {
          blocks: dedupedBlocks.entries,
          media: dedupedMedia.entries,
        },
        dedupedBlockCount: dedupedBlocks.duplicates,
      };
    };

    const canScrollFurther = async () => {
      if (
        recipe.kind !== 'list' ||
        !recipe.scroll ||
        recipe.scroll.mode !== 'until-stable' ||
        scrollStepsUsed >= recipe.scroll.maxSteps ||
        aggregatedRecords.length >= recipe.limit
      ) {
        return false;
      }
      if (recipe.pagination?.mode === 'load-more')
        return true;
      return page.evaluate(() => {
        const root = document.scrollingElement || document.documentElement || document.body;
        if (!root)
          return false;
        const maxScrollTop = Math.max(root.scrollHeight - window.innerHeight, 0);
        return window.scrollY + 1 < maxScrollTop;
      });
    };

    while (true) {
      if (recipe.kind === 'list' && aggregatedRecords.length >= recipe.limit)
        break;

      const payload = await extractPage();
      if (currentPageUrl && payload.page?.url && currentPageUrl !== payload.page.url)
        flushCurrentPageDocument();
      currentPageUrl = payload.page?.url ?? currentPageUrl;
      const fingerprint = JSON.stringify({
        page: payload.page,
        records: payload.records,
        document: payload.document,
      });
      const isNewSnapshot = !seenSnapshots.has(fingerprint);
      lastPayload = payload;
      if (isNewSnapshot) {
        seenSnapshots.add(fingerprint);
        pageCount += 1;
        for (const limitation of Array.isArray(payload.document?.limitations) ? payload.document.limitations : []) {
          if (typeof limitation === 'string' && limitation)
            aggregatedLimitations.add(limitation);
        }
        if (recipe.kind === 'list') {
          appendNewRecords(payload);
          updateSelectedRecordDocuments(payload);
          const nextPageDocument =
            recipe.pagination?.mode === 'next-page'
              ? buildSelectedPageDocument(payload, seenRecordFingerprints)
              : buildAggregatedSelectedDocument();
          currentPageDocument = nextPageDocument.document;
          currentPageDedupedBlockCount = nextPageDocument.dedupedBlockCount;
        } else {
          aggregatedRecords.splice(0, aggregatedRecords.length, ...payload.records.slice(0, recipe.limit));
          aggregatedDocument.blocks.splice(0, aggregatedDocument.blocks.length, ...payload.document.blocks);
          aggregatedDocument.media.splice(0, aggregatedDocument.media.length, ...payload.document.media);
        }
      }

      if (recipe.kind === 'list' && aggregatedRecords.length >= recipe.limit)
        break;

      const scrollPossible = await canScrollFurther();

      const canTraverseNextPage =
        recipe.kind === 'list' &&
        recipe.pagination &&
        recipe.pagination.mode === 'next-page' &&
        pageCount < recipe.pagination.maxPages &&
        aggregatedRecords.length < recipe.limit &&
        !scrollPossible;

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
        if ((await loadMoreButton.count()) < 1) {
          if (!scrollPossible)
            break;
        } else {
          const isVisible = await loadMoreButton.isVisible().catch(() => false);
          const isEnabled = await loadMoreButton.isEnabled().catch(() => false);
          if (isVisible && isEnabled) {
            await loadMoreButton.click();
            await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => null);
            await page.waitForTimeout(250);
            continue;
          }
          if (!scrollPossible)
            break;
        }
      }

      const canScroll =
        recipe.kind === 'list' &&
        recipe.scroll &&
        recipe.scroll.mode === 'until-stable' &&
        scrollStepsUsed < recipe.scroll.maxSteps &&
        aggregatedRecords.length < recipe.limit &&
        scrollPossible;
      if (canScroll) {
        await page.evaluate((stepPx) => {
          window.scrollBy(0, stepPx);
          window.dispatchEvent(new Event('scroll'));
        }, recipe.scroll.stepPx);
        scrollStepsUsed += 1;
        const settleMs = Math.max(recipe.scroll.settleMs, 700);
        if (settleMs > 0)
          await page.waitForTimeout(settleMs);
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => null);
        continue;
      }

      break;
    }

    flushCurrentPageDocument();

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
      traversal.scrollSteps = scrollStepsUsed;
      traversal.scrollStepsUsed = scrollStepsUsed;
      traversal.maxScrollSteps = recipe.scroll.maxSteps;
    }
    traversal.dedupedBlockCount = dedupedBlockCount;

    return JSON.stringify({
      page: currentPage,
      format: 'json',
      recipe,
      recordCount: aggregatedRecords.length,
      records: aggregatedRecords,
      document: aggregatedDocument,
      ...(aggregatedLimitations.size > 0
        ? {
            limitation: Array.from(aggregatedLimitations).join('; '),
            limitations: Array.from(aggregatedLimitations),
          }
        : {}),
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
    const scrollStepsValue =
      typeof traversal.scrollSteps === "number" ? traversal.scrollSteps : traversal.scrollStepsUsed;
    if (
      typeof scrollStepsValue !== "number" ||
      !Number.isFinite(scrollStepsValue) ||
      scrollStepsValue < 0
    ) {
      return undefined;
    }
    normalized.scrollMode = traversal.scrollMode;
    normalized.scrollSteps = Math.floor(scrollStepsValue);
    normalized.scrollStepsUsed = Math.floor(scrollStepsValue);
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

  if (traversal.dedupedBlockCount != null) {
    if (
      typeof traversal.dedupedBlockCount !== "number" ||
      !Number.isFinite(traversal.dedupedBlockCount) ||
      traversal.dedupedBlockCount < 0
    ) {
      return undefined;
    }
    normalized.dedupedBlockCount = Math.floor(traversal.dedupedBlockCount);
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

function normalizeSectionPath(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 4);
}

function normalizeStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const values = value.filter((entry): entry is string => typeof entry === "string");
  return values.length === value.length ? values : null;
}

function normalizeTableRows(value: unknown): string[][] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const rows = value.map((row) => normalizeStringArray(row));
  if (rows.some((row) => row == null)) {
    return null;
  }
  return rows as string[][];
}

function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function normalizeDocumentBlock(value: unknown): ExtractDocumentBlock | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const block = value as Record<string, unknown>;
  const sectionPath = normalizeSectionPath(block.sectionPath);

  if (block.kind === "heading" && typeof block.text === "string" && typeof block.level === "number") {
    return {
      kind: "heading",
      text: block.text,
      level: Math.max(1, Math.floor(block.level)),
      sectionPath,
    };
  }

  if (block.kind === "paragraph" && typeof block.text === "string") {
    return {
      kind: "paragraph",
      text: block.text,
      sectionPath,
    };
  }

  if (block.kind === "link" && typeof block.url === "string") {
    return {
      kind: "link",
      url: block.url,
      ...(typeof block.text === "string" ? { text: block.text } : {}),
      sectionPath,
    };
  }

  if ((block.kind === "image" || block.kind === "video") && typeof block.url === "string") {
    const currentSrc = normalizeOptionalString(block.currentSrc);
    const caption = normalizeOptionalString(block.caption);
    return {
      kind: block.kind,
      url: block.url,
      ...(currentSrc ? { currentSrc } : {}),
      ...(block.kind === "image"
        ? (() => {
            const srcset = normalizeOptionalString(block.srcset);
            return srcset ? { srcset } : {};
          })()
        : (() => {
            const poster = normalizeOptionalString(block.poster);
            const sources = normalizeStringArray(block.sources) ?? undefined;
            return {
              ...(poster ? { poster } : {}),
              ...(sources?.length ? { sources } : {}),
            };
          })()),
      ...(caption ? { caption } : {}),
      sectionPath,
    };
  }

  if (block.kind === "list" && typeof block.ordered === "boolean") {
    const items = normalizeStringArray(block.items);
    if (!items) {
      return null;
    }
    return {
      kind: "list",
      ordered: block.ordered,
      items,
      sectionPath,
    };
  }

  if (block.kind === "quote" && typeof block.text === "string") {
    return {
      kind: "quote",
      text: block.text,
      sectionPath,
    };
  }

  if (block.kind === "code" && typeof block.text === "string") {
    const languageHint =
      typeof block.languageHint === "string"
        ? block.languageHint
        : typeof block.language === "string"
          ? block.language
          : undefined;
    const language =
      typeof block.language === "string"
        ? block.language
        : languageHint;
    return {
      kind: "code",
      text: block.text,
      ...(language ? { language } : {}),
      ...(languageHint ? { languageHint } : {}),
      sectionPath,
    };
  }

  if (block.kind === "table") {
    const headers = normalizeStringArray(block.headers);
    const rows = normalizeTableRows(block.rows);
    if (!headers || !rows) {
      return null;
    }
    const caption = normalizeOptionalString(block.caption);
    return {
      kind: "table",
      headers,
      rows,
      ...(caption ? { caption } : {}),
      sectionPath,
    };
  }

  return null;
}

function normalizeDocumentMedia(value: unknown): ExtractDocumentMedia | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const media = value as Record<string, unknown>;
  if ((media.kind !== "image" && media.kind !== "video") || typeof media.url !== "string") {
    return null;
  }
  return {
    kind: media.kind,
    url: media.url,
    ...(typeof media.currentSrc === "string" ? { currentSrc: media.currentSrc } : {}),
    ...(typeof media.caption === "string" ? { caption: media.caption } : {}),
    ...(media.kind === "image"
      ? typeof media.srcset === "string"
        ? { srcset: media.srcset }
        : {}
      : {
          ...(typeof media.poster === "string" ? { poster: media.poster } : {}),
          ...(() => {
            const sources = normalizeStringArray(media.sources) ?? undefined;
            return sources?.length ? { sources } : {};
          })(),
        }),
    sectionPath: normalizeSectionPath(media.sectionPath),
  };
}

function normalizeDocument(value: unknown): ExtractDocument {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      blocks: [],
      media: [],
    };
  }

  const documentValue = value as Record<string, unknown>;
  const blocks = Array.isArray(documentValue.blocks)
    ? documentValue.blocks
        .map((block) => normalizeDocumentBlock(block))
        .filter((block): block is ExtractDocumentBlock => block != null)
    : [];
  const media = Array.isArray(documentValue.media)
    ? documentValue.media
        .map((entry) => normalizeDocumentMedia(entry))
        .filter((entry): entry is ExtractDocumentMedia => entry != null)
    : [];

  return {
    blocks,
    media,
  };
}

function normalizeLimitations(value: unknown, fallback?: unknown): ExtractLimitation[] {
  const normalized = new Set<string>();

  const push = (entry: unknown) => {
    if (typeof entry !== "string") {
      return;
    }
    const limitation = entry.trim();
    if (!limitation) {
      return;
    }
    normalized.add(limitation);
  };

  if (Array.isArray(value)) {
    value.forEach(push);
  }
  push(fallback);

  return [...normalized];
}

function buildArtifact(options: {
  recipe: NormalizedExtractRecipe;
  page: {
    url?: string;
    title?: string;
  };
  records: unknown[];
  document: ExtractDocument;
  limitations?: ExtractLimitation[];
  runtimeProbe?: RuntimeProbeResult;
  traversal?: ExtractTraversalFacts;
}): ExtractArtifact {
  const items = normalizeItems(options.records);
  return {
    recipeId: recipeIdFor(options.recipe),
    url: options.page.url ?? "",
    generatedAt: new Date().toISOString(),
    items,
    document: options.document,
    ...(options.limitations && options.limitations.length > 0
      ? {
          limitation: options.limitations.join("; "),
          limitations: options.limitations,
        }
      : {}),
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
            scrollSteps: options.traversal.scrollSteps,
            scrollStepsUsed: options.traversal.scrollStepsUsed,
          }
        : {}),
      ...(typeof options.traversal?.maxScrollSteps === "number"
        ? {
            maxScrollSteps: options.traversal.maxScrollSteps,
          }
        : {}),
      dedupedBlockCount: options.traversal?.dedupedBlockCount ?? 0,
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
  const document = normalizeDocument(payload.document);
  const limitations = normalizeLimitations(payload.limitations, payload.limitation);
  const artifact = buildArtifact({
    recipe,
    page: page ?? {},
    records: payload.records,
    document,
    limitations,
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
