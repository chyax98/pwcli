import { managedRunCode } from "./code.js";
import { buildArtifact, writeArtifact } from "./extraction-artifact.js";
import { loadRecipe } from "./extraction-recipe.js";
import {
  normalizeDocument,
  normalizeLimitations,
  normalizePage,
  normalizeRuntimeProbe,
  normalizeTraversal,
} from "./extraction-normalize.js";
import { buildExtractionSource } from "./extraction-source.js";
import type { ExtractSourcePayload, ManagedExtractRunOptions } from "./extraction-types.js";

export async function managedExtractRun(options: ManagedExtractRunOptions) {
  const { path: recipePath, recipe } = await loadRecipe(options.recipePath);
  const result = await managedRunCode({
    sessionName: options.sessionName,
    source: buildExtractionSource(recipe),
  });

  const payload =
    typeof result.data.result === "object" && result.data.result
      ? (result.data.result as Partial<ExtractSourcePayload>)
      : null;
  if (!payload || !Array.isArray(payload.items)) {
    throw new Error("EXTRACT_RESULT_INVALID");
  }

  const page = normalizePage(payload.page, result.page);
  const runtimeProbe = normalizeRuntimeProbe(payload.runtimeProbe);
  const traversal = normalizeTraversal(payload.traversal);
  const document = normalizeDocument(payload.document);
  const limitations = normalizeLimitations(payload.limitations, payload.limitation);

  const artifact = buildArtifact({
    recipe,
    recipePath,
    page: page ?? {},
    items: payload.items,
    document,
    limitations,
    runtimeProbe,
    traversal,
  });

  const artifactPath = options.out ? await writeArtifact(options.out, recipe, artifact) : undefined;

  return {
    session: result.session,
    page: page ?? result.page,
    data: {
      ...artifact,
      ...(artifactPath
        ? {
            artifactPath,
            ...(recipe.output.format !== "json" ? { artifactFormat: recipe.output.format } : {}),
          }
        : {}),
    },
  };
}
