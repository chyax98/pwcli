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
  meta: {
    name: "path",
    description:
      "Purpose: print the packaged pwcli skill path.\nExamples:\n  pw skill path\nNotes: use this to inspect the skill bundled with the current CLI version.",
  },
  args: { output: { type: "string", description: "Output format: text|json", default: "text" } },
  run() {
    printSuccess("skill path", { path: resolvePackagedSkillRoot(), info: getPackagedSkillInfo() });
  },
});
const install = defineCommand({
  meta: {
    name: "install",
    description:
      "Purpose: install the packaged pwcli skill into a skills directory.\nExamples:\n  pw skill install\n  pw skill install ~/.codex/skills\nNotes: installation copies current packaged content; update CLI to update the packaged skill.",
  },
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
  meta: {
    name: "refs",
    description:
      "Purpose: list packaged skill sections and reference files.\nExamples:\n  pw skill refs\nNotes: use this before `pw skill show <ref>` when selecting a reference section.",
  },
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
  meta: {
    name: "show",
    description:
      "Purpose: print packaged skill content from the installed CLI version.\nExamples:\n  pw skill show\n  pw skill show --full\nNotes: use skill content for workflow routing; use CLI help for exact parameters.",
  },
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
