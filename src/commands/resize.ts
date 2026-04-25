import type { Command } from "commander";
import { managedResize } from "../core/managed.js";
import { printCommandResult } from "../utils/output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
} from "./session-options.js";

const VIEW_PRESETS: Record<string, { width: number; height: number }> = {
  desktop: { width: 1440, height: 900 },
  ipad: { width: 820, height: 1180 },
  iphone: { width: 390, height: 844 },
};

function parseView(view: string) {
  const match = view.trim().match(/^(\d+)[x_](\d+)$/i);
  if (!match) {
    throw new Error("resize requires --view <width>x<height> or <width>_<height>");
  }
  return {
    width: Number(match[1]),
    height: Number(match[2]),
  };
}

export function registerResizeCommand(program: Command): void {
  addSessionOption(
    program
      .command("resize")
      .description("Resize the browser window for a named managed session")
      .option("--view <size>", "Window size, for example 390x844 or 390_844")
      .option("--preset <name>", "Preset window size: desktop|ipad|iphone"),
  ).action(async (options: { session?: string; view?: string; preset?: string }) => {
    try {
      const sessionName = requireSessionName(options);
      if (options.view && options.preset) {
        throw new Error("resize accepts either --view or --preset, not both");
      }
      if (!options.view && !options.preset) {
        throw new Error("resize requires --view or --preset");
      }

      const preset = options.preset?.trim();
      const fromPreset = preset ? VIEW_PRESETS[preset] : undefined;
      if (preset && !fromPreset) {
        throw new Error(`Unknown resize preset '${preset}'`);
      }

      const size = options.view ? parseView(options.view) : fromPreset;
      if (!size) {
        throw new Error("resize requires a valid preset");
      }

      printCommandResult(
        "resize",
        await managedResize({
          sessionName,
          width: size.width,
          height: size.height,
          ...(options.view ? { view: options.view } : {}),
          ...(preset ? { preset } : {}),
        }),
      );
    } catch (error) {
      printSessionAwareCommandError("resize", error, {
        code: "RESIZE_FAILED",
        message: "resize failed",
        suggestions: [
          "Use `pw resize --session bug-a --view 390x844`",
          "Or `pw resize --session bug-a --preset iphone`",
        ],
      });
      process.exitCode = 1;
    }
  });
}
