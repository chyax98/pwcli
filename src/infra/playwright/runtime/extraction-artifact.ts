import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { recipeIdFor } from "./extraction-recipe.js";
import { normalizeItems } from "./extraction-normalize.js";
import type {
  ExtractArtifact,
  ExtractArtifactFormat,
  ExtractDocument,
  ExtractLimitation,
  ExtractTraversalFacts,
  NormalizedExtractRecipe,
  RuntimeProbeResult,
} from "./extraction-types.js";

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

function renderCsvArtifact(recipe: NormalizedExtractRecipe, artifact: ExtractArtifact): string {
  const columns = resolveArtifactColumns(recipe, artifact.items);
  const lines = [
    columns.map((column) => escapeCsvCell(column)).join(","),
    ...artifact.items.map((item) =>
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

function renderMarkdownArtifact(recipe: NormalizedExtractRecipe, artifact: ExtractArtifact): string {
  const columns = resolveArtifactColumns(recipe, artifact.items);
  const lines = [
    `| ${columns.map((column) => escapeMarkdownCell(column)).join(" | ")} |`,
    `| ${columns.map(() => "---").join(" | ")} |`,
    ...artifact.items.map((item) =>
      `| ${columns
        .map((column) => escapeMarkdownCell(renderArtifactCell(item[column])))
        .join(" | ")} |`,
    ),
  ];
  return `${lines.join("\n")}\n`;
}

function serializeArtifact(recipe: NormalizedExtractRecipe, artifact: ExtractArtifact): string {
  const artifactFormat: ExtractArtifactFormat = recipe.output.format;
  if (artifactFormat === "csv") {
    return renderCsvArtifact(recipe, artifact);
  }
  if (artifactFormat === "markdown") {
    return renderMarkdownArtifact(recipe, artifact);
  }
  return JSON.stringify(artifact, null, 2);
}

export async function writeArtifact(
  path: string,
  recipe: NormalizedExtractRecipe,
  artifact: ExtractArtifact,
) {
  const resolved = resolve(path);
  await mkdir(dirname(resolved), { recursive: true });
  await writeFile(resolved, serializeArtifact(recipe, artifact), "utf8");
  return resolved;
}

export function buildArtifact(options: {
  recipe: NormalizedExtractRecipe;
  recipePath: string;
  page: {
    url?: string;
    title?: string;
  };
  items: unknown[];
  document: ExtractDocument;
  limitations?: ExtractLimitation[];
  runtimeProbe?: RuntimeProbeResult;
  traversal?: ExtractTraversalFacts;
}): ExtractArtifact {
  const items = normalizeItems(options.items);
  return {
    recipeId: recipeIdFor(options.recipe),
    recipePath: options.recipePath,
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
