import { defineCommand } from "citty";
import { sharedArgs } from "#cli/args.js";
import {
  managedMouseClick,
  managedMouseDblclick,
  managedMouseDrag,
  managedMouseMove,
  managedMouseWheel,
} from "#engine/act/page.js";
import { type CliArgs, num, positionals, print, session, withCliError } from "./_helpers.js";

function xy(a: CliArgs) {
  const p = positionals(a);
  return { x: num(p[0], 0) as number, y: num(p[1], 0) as number, p };
}

const move = defineCommand({
  meta: {
    name: "move",
    description:
      "Purpose: move the mouse to coordinates.\nExamples:\n  pw mouse move -s task-a 120 240\nNotes: prefer semantic locators unless coordinates are required.",
  },
  args: sharedArgs,
  async run({ args }) {
    const a = args as CliArgs;
    try {
      const v = xy(a);
      print("mouse move", await managedMouseMove({ sessionName: session(a), x: v.x, y: v.y }), a);
    } catch (e) {
      withCliError("mouse move", a, e);
    }
  },
});
const click = defineCommand({
  meta: {
    name: "click",
    description:
      "Purpose: click page coordinates.\nExamples:\n  pw mouse click -s task-a 120 240\nNotes: prefer `pw click` with a locator when possible.",
  },
  args: {
    ...sharedArgs,
    button: {
      type: "enum",
      options: ["left", "right", "middle"],
      description: "Mouse button",
      default: "left",
    },
  },
  async run({ args }) {
    const a = args as CliArgs;
    try {
      const v = xy(a);
      print(
        "mouse click",
        await managedMouseClick({
          sessionName: session(a),
          x: v.x,
          y: v.y,
          button: a.button as "left" | "right" | "middle",
        }),
        a,
      );
    } catch (e) {
      withCliError("mouse click", a, e);
    }
  },
});
const dblclick = defineCommand({
  meta: {
    name: "dblclick",
    description:
      "Purpose: double-click page coordinates.\nExamples:\n  pw mouse dblclick -s task-a 120 240\nNotes: verify the resulting page state after the gesture.",
  },
  args: sharedArgs,
  async run({ args }) {
    const a = args as CliArgs;
    try {
      const v = xy(a);
      print(
        "mouse dblclick",
        await managedMouseDblclick({ sessionName: session(a), x: v.x, y: v.y }),
        a,
      );
    } catch (e) {
      withCliError("mouse dblclick", a, e);
    }
  },
});
const wheel = defineCommand({
  meta: {
    name: "wheel",
    description:
      "Purpose: send mouse wheel deltas.\nExamples:\n  pw mouse wheel -s task-a 0 800\nNotes: verify newly revealed content after scrolling.",
  },
  args: sharedArgs,
  async run({ args }) {
    const a = args as CliArgs;
    try {
      const p = positionals(a);
      print(
        "mouse wheel",
        await managedMouseWheel({
          sessionName: session(a),
          deltaX: num(p[0], 0) as number,
          deltaY: num(p[1], 0) as number,
        }),
        a,
      );
    } catch (e) {
      withCliError("mouse wheel", a, e);
    }
  },
});
const drag = defineCommand({
  meta: {
    name: "drag",
    description:
      "Purpose: drag by coordinates.\nExamples:\n  pw mouse drag -s task-a 10 10 200 200\nNotes: prefer element drag when stable locators exist.",
  },
  args: sharedArgs,
  async run({ args }) {
    const a = args as CliArgs;
    try {
      const p = positionals(a);
      print(
        "mouse drag",
        await managedMouseDrag({
          sessionName: session(a),
          fromX: num(p[0], 0) as number,
          fromY: num(p[1], 0) as number,
          toX: num(p[2], 0) as number,
          toY: num(p[3], 0) as number,
        }),
        a,
      );
    } catch (e) {
      withCliError("mouse drag", a, e);
    }
  },
});

export default defineCommand({
  meta: {
    name: "mouse",
    description:
      "Purpose: perform coordinate-based mouse actions in a managed session.\nExamples:\n  pw mouse click -s task-a 120 240\n  pw mouse wheel -s task-a 0 800\nNotes: prefer semantic locators first; coordinate actions are for canvas, maps, drag surfaces, or layout debugging.",
  },
  subCommands: { move, click, dblclick, wheel, drag },
});
