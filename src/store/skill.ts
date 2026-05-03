import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function resolvePackagedSkillRoot(): string {
  return fileURLToPath(new URL("../../../skills/pwcli", import.meta.url));
}

export function getPackagedSkillInfo() {
  const root = resolvePackagedSkillRoot();
  return {
    root,
    entry: resolve(root, "SKILL.md"),
    readme: resolve(root, "README.md"),
    rulesDir: resolve(root, "rules"),
    referencesDir: resolve(root, "references"),
    exists: existsSync(root),
  };
}

export function installPackagedSkill(targetParentDir: string) {
  const sourceRoot = resolvePackagedSkillRoot();
  const targetRoot = resolve(targetParentDir, "pwcli");

  if (targetRoot === sourceRoot || targetRoot.startsWith(`${sourceRoot}/`)) {
    throw new Error("target directory cannot point to the packaged skill itself");
  }

  mkdirSync(dirname(targetRoot), { recursive: true });
  const overwritten = existsSync(targetRoot);
  if (overwritten) rmSync(targetRoot, { recursive: true, force: true });
  cpSync(sourceRoot, targetRoot, { recursive: true });

  return { sourceRoot, targetRoot, installed: true, overwritten };
}
