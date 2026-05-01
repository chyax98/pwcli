import type {
  ExtractDocument,
  ExtractDocumentBlock,
  ExtractDocumentMedia,
  ExtractLimitation,
  ExtractTraversalFacts,
  RuntimeProbeResult,
} from "./extraction-types.js";

export function normalizeRuntimeProbe(value: unknown): RuntimeProbeResult | undefined {
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

export function normalizeTraversal(value: unknown): ExtractTraversalFacts | undefined {
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

export function normalizePage(
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

export function normalizeItems(items: unknown[]) {
  return items.filter(
    (item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === "object" && !Array.isArray(item),
  );
}

export function normalizeSectionPath(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 4);
}

export function normalizeStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const values = value.filter((entry): entry is string => typeof entry === "string");
  return values.length === value.length ? values : null;
}

export function normalizeTableRows(value: unknown): string[][] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const rows = value.map((row) => normalizeStringArray(row));
  if (rows.some((row) => row == null)) {
    return null;
  }
  return rows as string[][];
}

export function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function normalizeDocumentBlock(value: unknown): ExtractDocumentBlock | null {
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
    const languageHint = normalizeOptionalString(block.languageHint);
    return {
      kind: "code",
      text: block.text,
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

export function normalizeDocumentMedia(value: unknown): ExtractDocumentMedia | null {
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

export function normalizeDocument(value: unknown): ExtractDocument {
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

export function normalizeLimitations(value: unknown, fallback?: unknown): ExtractLimitation[] {
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
