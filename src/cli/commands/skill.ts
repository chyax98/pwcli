import { defineCommand } from "citty";
import {
  getPackagedSkillInfo,
  installPackagedSkill,
  listPackagedSkillReferences,
  readPackagedSkillBundle,
  readPackagedSkillSection,
  resolvePackagedSkillRoot,
} from "#store/skill.js";
import { printSuccess } from "../output.js";
import { type CliArgs, firstPos, output, printError } from "./_helpers.js";

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

const refs = defineCommand({
  meta: { name: "refs", description: "List packaged skill sections and references" },
  args: { output: { type: "string", description: "Output format: text|json", default: "text" } },
  run({ args }) {
    const data = { references: listPackagedSkillReferences() };
    if (output(args as CliArgs) === "json") {
      printSuccess("skill refs", data);
      return;
    }
    process.stdout.write(
      `${data.references
        .map((item) => `${item.key}\t${item.kind}\t${item.path}${item.exists ? "" : "\tmissing"}`)
        .join("\n")}\n`,
    );
  },
});

const show = defineCommand({
  meta: { name: "show", description: "Print packaged skill content from the installed version" },
  args: {
    output: { type: "string", description: "Output format: text|json", default: "text" },
    full: { type: "boolean", description: "Include main skill and all reference files" },
  },
  run({ args }) {
    const a = args as CliArgs;
    try {
      if (a.full === true) {
        const sections = readPackagedSkillBundle();
        if (output(a) === "json") {
          printSuccess("skill show", { full: true, sections });
          return;
        }
        process.stdout.write(
          `${sections
            .map((item) => `# ${item.key}\n\n${item.content.trim()}`)
            .join("\n\n---\n\n")}\n`,
        );
        return;
      }

      const section = readPackagedSkillSection(firstPos(a));
      if (output(a) === "json") {
        printSuccess("skill show", section);
        return;
      }
      process.stdout.write(section.content);
      if (!section.content.endsWith("\n")) {
        process.stdout.write("\n");
      }
    } catch (e) {
      printError("skill show", a, {
        code: "SKILL_SHOW_FAILED",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  },
});
export default defineCommand({
  meta: {
    name: "skill",
    description:
      "Purpose: inspect, show, and install the packaged pwcli skill that matches this CLI version.\nExamples:\n  pw skill path\n  pw skill show --full\n  pw skill install\nNotes: use CLI help for parameter truth and skill content for Agent workflow routing.",
  },
  subCommands: { path, install, refs, show },
});
