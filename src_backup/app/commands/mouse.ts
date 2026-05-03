import { type Command, Option } from "commander";
import {
  managedMouseClick,
  managedMouseDblclick,
  managedMouseDrag,
  managedMouseMove,
  managedMouseWheel,
} from "../../infra/playwright/runtime.js";
import { printCommandResult } from "../output.js";
import {
  addSessionOption,
  printSessionAwareCommandError,
  requireSessionName,
  withActionFailureScreenshot,
} from "./session-options.js";

function parseNumber(value: string, name: string): number {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new Error(`${name} requires a valid number`);
  }
  return n;
}

export function registerMouseCommand(program: Command): void {
  const mouse = program.command("mouse").description("Mouse interactions by coordinates");

  addSessionOption(
    mouse
      .command("move")
      .description("Move mouse to coordinates")
      .requiredOption("--x <number>", "X coordinate", (v) => parseNumber(v, "--x"))
      .requiredOption("--y <number>", "Y coordinate", (v) => parseNumber(v, "--y")),
  ).action(
    async (options: { x: string; y: string; session?: string }) => {
      try {
        const sessionName = requireSessionName(options);
        const result = await withActionFailureScreenshot(
          sessionName,
          () =>
            managedMouseMove({
              x: Number(options.x),
              y: Number(options.y),
              sessionName,
            }),
          "mouse move",
        );
        printCommandResult("mouse move", result);
      } catch (error) {
        printSessionAwareCommandError("mouse move", error, {
          code: "MOUSE_MOVE_FAILED",
          message: "mouse move failed",
          suggestions: ["Use `pw mouse move --x 100 --y 200 --session <name>`"],
        });
        process.exitCode = 1;
      }
    },
  );

  addSessionOption(
    mouse
      .command("click")
      .description("Click at coordinates")
      .requiredOption("--x <number>", "X coordinate", (v) => parseNumber(v, "--x"))
      .requiredOption("--y <number>", "Y coordinate", (v) => parseNumber(v, "--y"))
      .addOption(
        new Option("--button <name>", "Mouse button").choices(["left", "right", "middle"]).default("left"),
      ),
  ).action(
    async (options: {
      x: string;
      y: string;
      button: "left" | "right" | "middle";
      session?: string;
    }) => {
      try {
        const sessionName = requireSessionName(options);
        const result = await withActionFailureScreenshot(
          sessionName,
          () =>
            managedMouseClick({
              x: Number(options.x),
              y: Number(options.y),
              button: options.button,
              sessionName,
            }),
          "mouse click",
        );
        printCommandResult("mouse click", result);
      } catch (error) {
        printSessionAwareCommandError("mouse click", error, {
          code: "MOUSE_CLICK_FAILED",
          message: "mouse click failed",
          suggestions: [
            "Use `pw mouse click --x 100 --y 200 --session <name>`",
            "Or `pw mouse click --x 100 --y 200 --button right --session <name>`",
          ],
        });
        process.exitCode = 1;
      }
    },
  );

  addSessionOption(
    mouse
      .command("dblclick")
      .description("Double-click at coordinates")
      .requiredOption("--x <number>", "X coordinate", (v) => parseNumber(v, "--x"))
      .requiredOption("--y <number>", "Y coordinate", (v) => parseNumber(v, "--y")),
  ).action(
    async (options: { x: string; y: string; session?: string }) => {
      try {
        const sessionName = requireSessionName(options);
        const result = await withActionFailureScreenshot(
          sessionName,
          () =>
            managedMouseDblclick({
              x: Number(options.x),
              y: Number(options.y),
              sessionName,
            }),
          "mouse dblclick",
        );
        printCommandResult("mouse dblclick", result);
      } catch (error) {
        printSessionAwareCommandError("mouse dblclick", error, {
          code: "MOUSE_DBLCLICK_FAILED",
          message: "mouse double-click failed",
          suggestions: ["Use `pw mouse dblclick --x 100 --y 200 --session <name>`"],
        });
        process.exitCode = 1;
      }
    },
  );

  addSessionOption(
    mouse
      .command("wheel")
      .description("Scroll mouse wheel")
      .requiredOption("--delta-x <number>", "Horizontal scroll delta", (v) => parseNumber(v, "--delta-x"))
      .requiredOption("--delta-y <number>", "Vertical scroll delta", (v) => parseNumber(v, "--delta-y")),
  ).action(
    async (options: {
      deltaX: string;
      deltaY: string;
      session?: string;
    }) => {
      try {
        const sessionName = requireSessionName(options);
        const result = await withActionFailureScreenshot(
          sessionName,
          () =>
            managedMouseWheel({
              deltaX: Number(options.deltaX),
              deltaY: Number(options.deltaY),
              sessionName,
            }),
          "mouse wheel",
        );
        printCommandResult("mouse wheel", result);
      } catch (error) {
        printSessionAwareCommandError("mouse wheel", error, {
          code: "MOUSE_WHEEL_FAILED",
          message: "mouse wheel failed",
          suggestions: ["Use `pw mouse wheel --delta-x 0 --delta-y 200 --session <name>`"],
        });
        process.exitCode = 1;
      }
    },
  );

  addSessionOption(
    mouse
      .command("drag")
      .description("Drag mouse from one point to another")
      .requiredOption("--from-x <number>", "Start X coordinate", (v) => parseNumber(v, "--from-x"))
      .requiredOption("--from-y <number>", "Start Y coordinate", (v) => parseNumber(v, "--from-y"))
      .requiredOption("--to-x <number>", "End X coordinate", (v) => parseNumber(v, "--to-x"))
      .requiredOption("--to-y <number>", "End Y coordinate", (v) => parseNumber(v, "--to-y")),
  ).action(
    async (options: {
      fromX: string;
      fromY: string;
      toX: string;
      toY: string;
      session?: string;
    }) => {
      try {
        const sessionName = requireSessionName(options);
        const result = await withActionFailureScreenshot(
          sessionName,
          () =>
            managedMouseDrag({
              fromX: Number(options.fromX),
              fromY: Number(options.fromY),
              toX: Number(options.toX),
              toY: Number(options.toY),
              sessionName,
            }),
          "mouse drag",
        );
        printCommandResult("mouse drag", result);
      } catch (error) {
        printSessionAwareCommandError("mouse drag", error, {
          code: "MOUSE_DRAG_FAILED",
          message: "mouse drag failed",
          suggestions: [
            "Use `pw mouse drag --from-x 100 --from-y 200 --to-x 300 --to-y 400 --session <name>`",
          ],
        });
        process.exitCode = 1;
      }
    },
  );
}
