import { readFile } from "node:fs/promises";
import { buildSemanticTarget, parseNth, parseStateTarget } from "#cli/parsers/target.js";
import type { SemanticTarget } from "#engine/act/element.js";
import { printCommandError, printCommandResult } from "../output.js";
import { printSessionAwareCommandError, requireSessionName } from "../parsers/session.js";

export type CliArgs = Record<string, unknown>;

export function output(args: CliArgs) {
  return args.output;
}

export function positionals(args: CliArgs): string[] {
  const raw = args._;
  return Array.isArray(raw) ? raw.map(String) : [];
}

export function firstPos(args: CliArgs): string | undefined {
  return positionals(args)[0];
}

export function num(value: unknown, fallback?: number): number | undefined {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function bool(value: unknown): boolean {
  return value === true;
}

export function str(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") return [value];
  return [];
}

export function session(args: CliArgs): string {
  return requireSessionName(str(args.session));
}

export function actionTarget(args: CliArgs, positionalRef?: string) {
  const semantic = buildSemanticTarget(args as Parameters<typeof buildSemanticTarget>[0]);
  const nth = parseNth(args.nth as string | number | undefined) ?? 1;
  return {
    ref: str(args.ref) ?? positionalRef,
    selector: str(args.selector),
    nth,
    semantic,
  };
}

export function stateTarget(args: CliArgs) {
  return parseStateTarget(args as Parameters<typeof parseStateTarget>[0]);
}

export function withCliError(command: string, args: CliArgs, error: unknown, message?: string) {
  printSessionAwareCommandError(
    command,
    error,
    {
      code: `${command.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_FAILED`,
      message: message ?? `${command} failed`,
    },
    output(args),
  );
  process.exitCode = 1;
}

export function print(
  command: string,
  result: Parameters<typeof printCommandResult>[1],
  args: CliArgs,
) {
  printCommandResult(command, result, output(args));
}

export function printError(
  command: string,
  args: CliArgs,
  error: Parameters<typeof printCommandError>[1],
) {
  printCommandError(command, error, output(args));
  process.exitCode = 1;
}

export async function sourceFromArgs(source: string | undefined, file: string | undefined) {
  if (file) return await readFile(file, "utf8");
  return source;
}

export function semanticOnly(args: CliArgs): SemanticTarget | undefined {
  return buildSemanticTarget(args as Parameters<typeof buildSemanticTarget>[0]);
}
