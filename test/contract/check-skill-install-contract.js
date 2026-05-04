import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseJson, runPwSync } from "./_helpers.js";

const targetParent = mkdtempSync(join(tmpdir(), "pwcli-skill-install-"));

try {
  const pathResult = runPwSync(["skill", "path", "--output", "json"]);
  if (pathResult.status !== 0) {
    throw new Error(`skill path failed\n${pathResult.stdout}\n${pathResult.stderr}`);
  }
  const pathPayload = parseJson(pathResult.stdout, "skill path");
  const root = pathPayload.data?.path;
  if (typeof root !== "string" || !root.endsWith("/skills/pwcli")) {
    throw new Error(`unexpected skill path: ${JSON.stringify(pathPayload, null, 2)}`);
  }
  if (pathPayload.data?.info?.exists !== true || !existsSync(join(root, "SKILL.md"))) {
    throw new Error(`packaged skill root is not usable: ${JSON.stringify(pathPayload, null, 2)}`);
  }

  const install = runPwSync(["skill", "install", targetParent, "--output", "json"]);
  if (install.status !== 0) {
    throw new Error(`skill install failed\n${install.stdout}\n${install.stderr}`);
  }
  const installPayload = parseJson(install.stdout, "skill install");
  if (installPayload.data?.installed !== true) {
    throw new Error(`unexpected skill install payload: ${JSON.stringify(installPayload, null, 2)}`);
  }
  const installedSkill = join(targetParent, "pwcli", "SKILL.md");
  if (!existsSync(installedSkill)) {
    throw new Error(`installed skill missing: ${installedSkill}`);
  }
} finally {
  rmSync(targetParent, { recursive: true, force: true });
}
