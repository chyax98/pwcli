import { defineCommand } from "citty";
import {
  getPackagedSkillInfo,
  installPackagedSkill,
  resolvePackagedSkillRoot,
} from "#store/skill.js";
import { printSuccess } from "../output.js";
import { type CliArgs, firstPos, printError } from "./_helpers.js";

const path = defineCommand({
  meta: { name: "path", description: "Print packaged skill path" },
  args: { output: { type: "string", description: "Output format: text|json", default: "text" } },
  run() {
    printSuccess("skill path", { path: resolvePackagedSkillRoot(), info: getPackagedSkillInfo() });
  },
});
const install = defineCommand({
  meta: { name: "install", description: "Install packaged skill into a skills dir" },
  args: { output: { type: "string", description: "Output format: text|json", default: "text" } },
  run({ args }) {
    const a = args as CliArgs;
    try {
      printSuccess("skill install", installPackagedSkill(firstPos(a) as string));
    } catch (e) {
      printError("skill install", a, {
        code: "SKILL_INSTALL_FAILED",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  },
});
export default defineCommand({
  meta: { name: "skill", description: "Inspect and install packaged pwcli skills" },
  subCommands: { path, install },
});
