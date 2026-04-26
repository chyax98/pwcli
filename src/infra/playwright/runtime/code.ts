import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { runManagedSessionCommand } from "../cli-client.js";
import {
  parseErrorText,
  parseJsonStringLiteral,
  parsePageSummary,
  parseResultText,
  parseSnapshotYaml,
} from "../output-parsers.js";
import { isModalStateBlockedMessage, maybeRawOutput } from "./shared.js";

export async function managedSnapshot(options?: { depth?: number; sessionName?: string }) {
  const args = ["snapshot"];
  if (options?.depth) {
    args.push(`--depth=${options.depth}`);
  }
  const result = await runManagedSessionCommand(
    {
      _: args,
    },
    {
      sessionName: options?.sessionName,
    },
  );
  return {
    session: {
      scope: "managed",
      name: result.sessionName,
      default: result.sessionName === "default",
    },
    page: parsePageSummary(result.text),
    data: {
      mode: "ai",
      snapshot: parseSnapshotYaml(result.text),
      ...maybeRawOutput(result.text),
    },
  };
}

export async function managedRunCode(options: {
  source?: string;
  file?: string;
  sessionName?: string;
}) {
  const args = ["run-code"];
  let source = options.source;
  let filename: string | undefined;
  if (options.file) {
    filename = resolve(options.file);
    source = await readFile(filename, "utf8");
  }
  if (source) {
    args.push(source);
  }
  const result = await runManagedSessionCommand(
    {
      _: args,
      ...(filename ? { filename } : {}),
    },
    {
      sessionName: options.sessionName,
    },
  );
  const errorText = parseErrorText(result.text);
  if (errorText) {
    throw new Error(isModalStateBlockedMessage(errorText) ? "MODAL_STATE_BLOCKED" : errorText);
  }
  const resultText = parseResultText(result.text);
  return {
    session: {
      scope: "managed",
      name: result.sessionName,
      default: result.sessionName === "default",
    },
    page: parsePageSummary(result.text),
    rawText: result.text,
    data: {
      resultText,
      result: parseJsonStringLiteral(resultText),
      ...maybeRawOutput(result.text),
    },
  };
}
