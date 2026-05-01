import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
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
  const targetRoot = resolve(resolve(targetParentDir), "pwcli");

  if (targetRoot === sourceRoot || targetRoot.startsWith(`${sourceRoot}/`)) {
    throw new Error("target directory cannot point to the packaged skill itself");
  }

  mkdirSync(dirname(targetRoot), { recursive: true });
  const overwritten = existsSync(targetRoot);
  if (overwritten) {
    rmSync(targetRoot, { recursive: true, force: true });
  }
  cpSync(sourceRoot, targetRoot, { recursive: true });

  return {
    sourceRoot,
    targetRoot,
    installed: true,
    overwritten,
  };
}

export function resolvePackagedExtractRecipeRoot(): string {
  return resolve(resolvePackagedSkillRoot(), "references", "extract-recipes");
}

export function listPackagedExtractRecipes() {
  const root = resolvePackagedExtractRecipeRoot();
  if (!existsSync(root)) {
    return [];
  }
  return readdirSync(root)
    .filter((entry) => entry.endsWith(".json"))
    .sort()
    .map((entry) => ({
      name: entry.replace(/\.json$/i, ""),
      path: resolve(root, entry),
    }));
}

export function resolvePackagedExtractRecipe(name: string) {
  const normalized = name.trim();
  if (!normalized) {
    throw new Error("extract recipe name is required");
  }
  const root = resolvePackagedExtractRecipeRoot();
  const path = resolve(root, `${normalized}.json`);
  if (!existsSync(path)) {
    throw new Error(`packaged extract recipe '${normalized}' not found`);
  }
  return {
    name: normalized,
    path,
  };
}
