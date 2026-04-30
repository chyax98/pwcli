import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

function replacePlaceholders(value, replacements) {
  if (typeof value === "string") {
    return value.replace(/<([^>]+)>/g, (_, key) => {
      const replacement = replacements[key];
      return replacement === undefined ? `<${key}>` : String(replacement);
    });
  }
  if (Array.isArray(value)) {
    return value.map((item) => replacePlaceholders(item, replacements));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [key, replacePlaceholders(inner, replacements)]),
    );
  }
  return value;
}

export async function loadTask(taskPath, options = {}) {
  const absolutePath = resolve(taskPath);
  const raw = await readFile(absolutePath, "utf8");
  const task = JSON.parse(raw);
  const replacements = {};
  if (options.port !== undefined) {
    replacements.port = options.port;
  }
  return {
    taskPath: absolutePath,
    task: replacePlaceholders(task, replacements),
  };
}

export async function loadTaskList(taskPaths, options = {}) {
  const resolved = [];
  for (const taskPath of taskPaths) {
    const result = await loadTask(taskPath, options);
    resolved.push(result);
  }
  return resolved;
}

export async function discoverTaskPaths(inputPaths) {
  const results = [];
  for (const inputPath of inputPaths) {
    const absolutePath = resolve(inputPath);
    if (absolutePath.endsWith(".json")) {
      results.push(absolutePath);
      continue;
    }
    await collectTaskPaths(absolutePath, results);
  }
  return results.sort();
}

async function collectTaskPaths(directoryPath, results) {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = resolve(directoryPath, entry.name);
    if (entry.isDirectory()) {
      await collectTaskPaths(absolutePath, results);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".json")) {
      results.push(absolutePath);
    }
  }
}
