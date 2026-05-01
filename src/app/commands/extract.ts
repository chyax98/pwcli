import type { Command } from "commander";
import { managedExtractRun } from "../../domain/extraction/service.js";
import {
  listPackagedExtractRecipes,
  resolvePackagedExtractRecipe,
} from "../../infra/fs/skill-path.js";
import { printCommandError, printCommandResult } from "../output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
} from "./session-options.js";

export function registerExtractCommand(program: Command): void {
  const extract = addSessionOption(
    program.command("extract").description("Run bounded structured extraction in a managed session"),
  );

  extract
    .command("recipes")
    .description("List bundled extraction recipe templates")
    .action(() => {
      printCommandResult("extract recipes", {
        data: {
          count: listPackagedExtractRecipes().length,
          recipes: listPackagedExtractRecipes(),
        },
      });
    });

  extract
    .command("recipe-path <name>")
    .description("Show the absolute path of one bundled extraction recipe")
    .action((name: string) => {
      try {
        printCommandResult("extract recipe-path", {
          data: resolvePackagedExtractRecipe(name),
        });
      } catch (error) {
        printCommandError("extract recipe-path", {
          code: "EXTRACT_RECIPE_NOT_FOUND",
          message: error instanceof Error ? error.message : "extract recipe-path failed",
          suggestions: [
            "Run `pw extract recipes` to inspect bundled recipe names",
          ],
        });
        process.exitCode = 1;
      }
    });

  addSessionOption(
    extract
      .command("run")
      .description("Run one JSON extraction recipe against the active page")
      .requiredOption("--recipe <file>", "Extraction recipe JSON file")
      .option("--out <file>", "Optional output artifact path"),
  ).action(
    async (
      options: { session?: string; recipe?: string; out?: string },
      command: Command,
    ) => {
      try {
        const sessionName = requireSessionName(options, command);
        const recipePath = options.recipe?.trim();
        if (!recipePath) {
          throw new Error("EXTRACT_RECIPE_REQUIRED");
        }
        printCommandResult(
          "extract run",
          await managedExtractRun({
            sessionName,
            recipePath,
            out: options.out?.trim() || undefined,
          }),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message === "EXTRACT_RECIPE_REQUIRED") {
          printCommandError("extract run", {
            code: "EXTRACT_RECIPE_REQUIRED",
            message: "extract run requires --recipe <file>",
            suggestions: [
              "Pass a JSON recipe file with `--recipe <file>`",
              'Use a bounded recipe with `kind`, selectors, and optional `runtimeGlobal` only',
            ],
          });
          process.exitCode = 1;
          return;
        }
        if (message.startsWith("EXTRACT_RECIPE_INVALID:")) {
          printCommandError("extract run", {
            code: "EXTRACT_RECIPE_INVALID",
            message: message.replace(/^EXTRACT_RECIPE_INVALID:\s*/, ""),
            suggestions: [
              'Use `kind: "list"` with `itemSelector` or `kind: "article"` with `containerSelector`',
              "Keep field specs to selector strings or `{ selector?, attr?, multiple? }` objects",
              'Use `pagination.mode: "next-page" | "load-more"` with a non-empty `selector` and positive `maxPages`',
              'Use `scroll.mode: "until-stable"` with bounded `stepPx`, `settleMs`, and `maxSteps` values',
              'Use `output.format: "json" | "csv" | "markdown"` and optional string `columns` only',
              "Use only dotted `runtimeGlobal` paths; do not pass function calls, brackets, or arbitrary expressions",
            ],
          });
          process.exitCode = 1;
          return;
        }
        if (message === "EXTRACT_RESULT_INVALID") {
          printCommandError("extract run", {
            code: "EXTRACT_RESULT_INVALID",
            message: "extract run returned an invalid extraction payload",
            suggestions: [
              "Retry the extraction on a stable page after navigation settles",
              "Narrow the recipe selectors so the extraction lane stays bounded",
            ],
          });
          process.exitCode = 1;
          return;
        }
        printSessionAwareCommandError("extract run", error, {
          code: "EXTRACT_RUN_FAILED",
          message: "extract run failed",
          suggestions: [
            "Create or attach a session first with `pw session create|attach`",
            "Use a bounded JSON recipe file and avoid arbitrary scripting in extract run",
            "Use `pw code --session <name>` only for ad-hoc debugging outside this structured lane",
          ],
        });
        process.exitCode = 1;
      }
    },
  );
}
