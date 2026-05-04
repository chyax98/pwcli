import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function resolvePackagedSkillRoot(): string {
  return fileURLToPath(new URL("../../skills/pwcli", import.meta.url));
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

export function listPackagedSkillReferences() {
  const root = resolvePackagedSkillRoot();
  return [
    {
      key: "main",
      path: resolve(root, "SKILL.md"),
      kind: "entry",
    },
    {
      key: "workflows",
      path: resolve(root, "references", "workflows.md"),
      kind: "reference",
    },
    {
      key: "failure-recovery",
      path: resolve(root, "references", "failure-recovery.md"),
      kind: "reference",
    },
    {
      key: "forge-dc-auth",
      path: resolve(root, "references", "forge-dc-auth.md"),
      kind: "reference",
    },
  ].map((item) => ({ ...item, exists: existsSync(item.path) }));
}

export function readPackagedSkillSection(section?: string) {
  const refs = listPackagedSkillReferences();
  const key = section?.trim() || "main";
  const match = refs.find((item) => item.key === key);
  if (!match) {
    throw new Error(`unknown skill section: ${key}`);
  }
  if (!match.exists) {
    throw new Error(`missing packaged skill file: ${match.path}`);
  }
  return {
    key: match.key,
    kind: match.kind,
    path: match.path,
    content: readFileSync(match.path, "utf8"),
  };
}

export function readPackagedSkillBundle() {
  const refs = listPackagedSkillReferences().filter((item) => item.exists);
  return refs.map((item) => ({
    key: item.key,
    kind: item.kind,
    path: item.path,
    content: readFileSync(item.path, "utf8"),
  }));
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
