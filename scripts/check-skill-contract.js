#!/usr/bin/env node
/**
 * check-skill-contract.js
 *
 * Checks that executable `pw <command>` references in skills/pwcli/**\/*.md
 * match the top-level commands reported by `node dist/cli.js --help`.
 *
 * Coverage also counts backtick-wrapped top-level command names in the skill
 * route table. The skill is intentionally a router rather than an exhaustive
 * command reference with runnable examples for every command.
 *
 * Usage:
 *   node scripts/check-skill-contract.js
 *
 * Exit codes:
 *   0 — no stale references found
 *   1 — at least one stale reference (command in skill but not in CLI)
 *
 * Requires dist/cli.js to exist (run `pnpm build` first).
 */

import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');

// ── 1. Parse CLI top-level commands ────────────────────────────────────────

function parseCLICommands() {
  let helpOutput;
  try {
    helpOutput = execSync('node dist/cli.js --help', {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (err) {
    // Help should normally exit 0; keep stderr fallback for CLI library drift.
    helpOutput = err.stdout || '';
    if (!helpOutput.includes('COMMANDS') && !helpOutput.includes('Commands:')) {
      console.error('ERROR: Could not run `node dist/cli.js --help`. Run `pnpm build` first.');
      console.error(err.message);
      process.exit(2);
    }
  }

  helpOutput = stripAnsi(helpOutput);
  const commands = new Set();

  const usageMatch = helpOutput.match(/\bUSAGE\s+pw\s+([^\n]+)/);
  if (usageMatch) {
    for (const item of usageMatch[1].trim().split('|')) {
      const cmd = item.trim().match(/^([a-z][-a-z]+)/)?.[1];
      if (cmd) commands.add(cmd);
    }
    if (commands.size > 0) return commands;
  }

  let inCommands = false;

  for (const line of helpOutput.split('\n')) {
    if (/^COMMANDS\b/.test(line.trim()) || /^Commands:/.test(line)) {
      inCommands = true;
      continue;
    }
    if (inCommands) {
      // A command line starts with 2+ spaces then the command word
      const m = line.match(/^\s{2,}([a-z][-a-z]+)/);
      if (m) {
        commands.add(m[1]);
      } else if (line.trim() === '' || /^\s*$/.test(line)) {
        // blank line inside commands block — keep scanning
      } else if (/^[A-Z]/.test(line.trim())) {
        // new top-level section heading — stop
        break;
      }
    }
  }

  return commands;
}

function stripAnsi(value) {
  return value.replace(/\x1b\[[0-9;]*m/g, '');
}

// ── 2. Collect skill markdown files ────────────────────────────────────────

function collectMarkdownFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      results.push(...collectMarkdownFiles(full));
    } else if (entry.endsWith('.md')) {
      results.push(full);
    }
  }
  return results;
}

// ── 3. Extract `pw <command>` references from a markdown file ───────────────
//
// Only match patterns that are clearly command usage, not prose:
//   a) Inside backtick spans:  `pw <word>`
//   b) At start of a code-block line:  ^pw <word>   (in fenced code blocks)
//
// We intentionally skip plain prose like "use pw session …" to avoid false
// positives — we only flag what looks like an executable command reference.

// Words that are valid in `pw X` context but are NOT real user-facing commands
// (meta commands, flags, or descriptive words that should be excluded from both
// stale detection and the uncovered report).
const KNOWN_NOT_COMMANDS = new Set([
  'help',     // meta command, not a skill topic
  'version',  // flag alias, not a standalone command
]);

function extractCommandRefs(filePath, cliCommands) {
  const src = readFileSync(filePath, 'utf8');
  const lines = src.split('\n');

  /** @type {Array<{cmd: string, line: number, executable: boolean}>} */
  const refs = [];

  let inFencedBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = i + 1;

    // Track fenced code block boundaries
    if (/^```/.test(line)) {
      inFencedBlock = !inFencedBlock;
      continue;
    }

    if (inFencedBlock) {
      // Inside a fenced block: match lines that start with `pw <word>`
      const m = line.match(/^pw\s+([a-z][-a-z]+)/);
      if (m) {
        refs.push({ cmd: m[1], line: lineNo, executable: true });
      }
    } else {
      // Outside fenced blocks: match backtick-wrapped `pw <word>` or `pw <word> ...`
      const backtickRe = /`pw\s+([a-z][-a-z]+)[^`]*`/g;
      let m;
      // biome-ignore lint/suspicious/noAssignInExpressions: standard regex loop
      while ((m = backtickRe.exec(line)) !== null) {
        refs.push({ cmd: m[1], line: lineNo, executable: true });
      }

      // Coverage-only: route tables list commands as backtick-wrapped names
      // (`click` / `fill`) without spelling every one as `pw click`.
      // Count current top-level command tokens as covered, but do not use them
      // for stale-reference failures.
      const tokenRe = /`([a-z][-a-z]+)`/g;
      while ((m = tokenRe.exec(line)) !== null) {
        if (cliCommands.has(m[1])) {
          refs.push({ cmd: m[1], line: lineNo, executable: false });
        }
      }
    }
  }

  return refs;
}

// ── 4. Main ─────────────────────────────────────────────────────────────────

const skillsDir = join(ROOT, 'skills', 'pwcli');

console.log('Checking skill contract against dist/cli.js...');

const cliCommands = parseCLICommands();
console.log(`CLI commands (${cliCommands.size}): ${[...cliCommands].sort().join(', ')}`);
console.log();

const mdFiles = collectMarkdownFiles(skillsDir);

// Map: cmd -> [{file, line}]
/** @type {Map<string, Array<{file: string, line: number}>>} */
const staleRefs = new Map();
/** @type {Set<string>} */
const coveredCmds = new Set();

for (const filePath of mdFiles) {
  const refs = extractCommandRefs(filePath, cliCommands);
  const relPath = relative(ROOT, filePath);

  for (const { cmd, line, executable } of refs) {
    if (KNOWN_NOT_COMMANDS.has(cmd)) continue;

    if (cliCommands.has(cmd)) {
      coveredCmds.add(cmd);
    } else if (executable) {
      // Not in CLI — stale reference
      if (!staleRefs.has(cmd)) {
        staleRefs.set(cmd, []);
      }
      staleRefs.get(cmd).push({ file: relPath, line });
    }
  }
}

// ── 5. Report ────────────────────────────────────────────────────────────────

let hasErrors = false;

if (staleRefs.size === 0) {
  console.log('✅ No stale skill references found.');
} else {
  hasErrors = true;
  console.log('❌ Stale references in skill (commands no longer in CLI):');
  for (const [cmd, locations] of [...staleRefs.entries()].sort()) {
    for (const { file, line } of locations) {
      console.log(`   - ${cmd}  (found in ${file}:${line})`);
    }
  }
}

console.log();

const uncovered = [...cliCommands].filter(c => !coveredCmds.has(c) && !KNOWN_NOT_COMMANDS.has(c)).sort();
if (uncovered.length > 0) {
  console.log(`ℹ️  Uncovered commands (not mentioned in skill): ${uncovered.join(', ')}`);
}

if (hasErrors) {
  console.log();
  console.log('Exit code: 1');
  process.exit(1);
}
