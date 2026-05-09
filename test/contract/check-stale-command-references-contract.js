#!/usr/bin/env node
import { globSync, readFileSync } from "node:fs";
import commands from "../../dist/cli/commands/index.js";

async function loadCommand(value) {
  return typeof value === "function" ? await value() : value;
}

async function collectValidPaths(registry, prefix = []) {
  const paths = new Set();
  for (const [name, value] of Object.entries(registry)) {
    const cmd = await loadCommand(value);
    const path = [...prefix, name];
    paths.add(path.join(" "));
    if (cmd?.subCommands) {
      const subPaths = await collectValidPaths(cmd.subCommands, path);
      for (const p of subPaths) paths.add(p);
    }
  }
  return paths;
}

const validPaths = await collectValidPaths(commands);

// Only scan engine/ for hardcoded CLI command strings in recovery/suggestions.
const files = globSync("src/engine/**/*.{ts,js}");

const stale = [];

// Match "pw <command> [<subcommand> ...]" but stop at flags (--xxx or -x).
const pwCommandRe = /pw\s+((?:[^-\s][\w-]*(?:\s+[^-\s][\w-]*)*))/g;

// Skip tokens that contain placeholders, variables, or prose
function isProseToken(token) {
  if (!token) return true;
  // Placeholders: <name>, $var, …
  if (/[<|$…]/.test(token)) return true;
  // Sentence words that are not subcommands
  const proseWords = new Set([
    "to",
    "with",
    "for",
    "from",
    "via",
    "using",
    "through",
    "into",
    "onto",
    "mocks",
    "steps",
    "commands",
    "explicit",
    "frameLocator",
    "fully",
  ]);
  if (proseWords.has(token)) return true;
  return false;
}

// Valid patterns that are positional args, not subcommands
const argPatterns = new Set(["storage local", "storage session"]);

for (const file of files) {
  const content = readFileSync(file, "utf8");
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const match of line.matchAll(pwCommandRe)) {
      const raw = match[1].trim();
      // Split into tokens and drop trailing prose/placeholders
      const tokens = raw.split(/\s+/);
      const commandTokens = [];
      for (const t of tokens) {
        if (isProseToken(t)) break;
        commandTokens.push(t);
      }
      if (commandTokens.length === 0) continue;
      const cmd = commandTokens.join(" ");
      if (argPatterns.has(cmd)) continue;
      if (!validPaths.has(cmd)) {
        stale.push({ file, line: i + 1, command: cmd, raw });
      }
    }
  }
}

if (stale.length > 0) {
  console.error("Stale command references found in engine recovery/suggestions:");
  for (const s of stale) {
    console.error(`  ${s.file}:${s.line} -> "pw ${s.command}" (raw: "pw ${s.raw}")`);
  }
  process.exit(1);
}

console.log("No stale command references found in engine/");
