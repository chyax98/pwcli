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
  meta: { name: "move", description: "Move mouse" },
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
  meta: { name: "click", description: "Click coordinates" },
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
  meta: { name: "dblclick", description: "Double-click coordinates" },
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
  meta: { name: "wheel", description: "Mouse wheel" },
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
  meta: { name: "drag", description: "Mouse drag coordinates" },
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
  meta: { name: "mouse", description: "Mouse coordinate actions" },
  subCommands: { move, click, dblclick, wheel, drag },
});
