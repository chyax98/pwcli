export type ExtractFieldRecipe =
  | string
  | {
      selector?: string;
      attr?: string;
      multiple?: boolean;
    };

export type ExtractRecipeInput = {
  kind?: unknown;
  itemSelector?: unknown;
  containerSelector?: unknown;
  excludeSelectors?: unknown;
  fields?: unknown;
  limit?: unknown;
  runtimeGlobal?: unknown;
  pagination?: unknown;
  scroll?: unknown;
  output?: unknown;
};

export type NormalizedExtractFieldRecipe = {
  selector: string | null;
  attr: string | null;
  multiple: boolean;
};

export type NormalizedExtractPagination =
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

export type NormalizedExtractScroll =
  | {
      mode: "until-stable";
      stepPx: number;
      settleMs: number;
      maxSteps: number;
    }
  | null;

export type NormalizedExtractOutput = {
  format: "json" | "csv" | "markdown";
  columns: string[] | null;
};

export type ExtractArtifactFormat = NormalizedExtractOutput["format"];

export type NormalizedExtractRecipe = {
  kind: "list" | "article";
  itemSelector: string | null;
  containerSelector: string | null;
  excludeSelectors: string[];
  fields: Record<string, NormalizedExtractFieldRecipe>;
  limit: number;
  runtimeGlobal: string | null;
  pagination: NormalizedExtractPagination;
  scroll: NormalizedExtractScroll;
  output: NormalizedExtractOutput;
};

export type ManagedExtractRunOptions = {
  sessionName?: string;
  recipePath: string;
  out?: string;
};

export type RuntimeProbeResult = {
  path: string;
  found: boolean;
  value?: unknown;
};

export type ExtractTraversalFacts = {
  pageCount?: number;
  paginationMode?: "next-page" | "load-more";
  scrollMode?: "until-stable";
  scrollSteps?: number;
  scrollStepsUsed?: number;
  maxPages?: number;
  maxScrollSteps?: number;
  dedupedBlockCount?: number;
};

export type ExtractDocumentBlock =
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

export type ExtractDocumentImage = {
  kind: "image";
  url: string;
  currentSrc?: string;
  srcset?: string;
  caption?: string;
  sectionPath: string[];
};

export type ExtractDocumentVideo = {
  kind: "video";
  url: string;
  currentSrc?: string;
  poster?: string;
  sources?: string[];
  caption?: string;
  sectionPath: string[];
};

export type ExtractDocumentMedia = ExtractDocumentImage | ExtractDocumentVideo;

export type ExtractDocument = {
  blocks: ExtractDocumentBlock[];
  media: ExtractDocumentMedia[];
};

export type ExtractLimitation = string;

export type ExtractSourcePayload = {
  page?: {
    url?: string;
    title?: string;
  };
  items: unknown[];
  document?: unknown;
  limitation?: unknown;
  limitations?: unknown;
  runtimeProbe?: RuntimeProbeResult;
  traversal?: ExtractTraversalFacts;
};

export type ExtractArtifact = {
  recipeId: string;
  recipePath: string;
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
