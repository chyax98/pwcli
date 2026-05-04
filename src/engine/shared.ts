import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  parseErrorText,
  parseJsonStringLiteral,
  parsePageSummary,
  parseResultText,
  runManagedSessionCommand,
} from "./session.js";

export const DIAGNOSTICS_STATE_KEY = "__pwcliDiagnostics";
export const MODAL_STATE_BLOCKED_MARKER =
  'Tool "browser_run_code" does not handle the modal state.';

/**
 * Returns a browser-side JS string fragment that initializes `context` and `state`
 * from the current page. Use `readonly: true` for read-only access (no `||=`).
 */
export function stateAccessPrelude(options?: { readonly?: boolean }) {
  const op = options?.readonly ? "||" : "||=";
  return `
      const context = page.context();
      const state = context[${JSON.stringify(DIAGNOSTICS_STATE_KEY)}] ${op} {};`;
}

export function maybeRawOutput(text: string) {
  return process.env.PWCLI_RAW_OUTPUT === "1" ? { output: text } : {};
}

export function normalizeRef(ref: string) {
  return ref.startsWith("@") ? ref.slice(1) : ref;
}

export function isModalStateBlockedMessage(message: string) {
  return message === "MODAL_STATE_BLOCKED" || message.includes(MODAL_STATE_BLOCKED_MARKER);
}

/** Default timeout for managedRunCode calls.
 *  Protects against Playwright-core's waitForCompletion hanging
 *  on network/navigation waits. 25s gives waitForCompletion's 10s load
 *  timeout + 500ms fixed wait + overhead room. */
const DEFAULT_RUN_CODE_TIMEOUT_MS = 25_000;

export async function managedRunCode(options: {
  source?: string;
  file?: string;
  sessionName?: string;
  retry?: number;
  /** Timeout in ms for the daemon command. Protects against waitForCompletion
   *  hanging on network/navigation waits in Playwright-core. */
  timeoutMs?: number;
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
  const attempts = Math.max(1, Math.floor(Number(options.retry ?? 0)) + 1);
  let result: Awaited<ReturnType<typeof runManagedSessionCommand>> | undefined;
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      result = await runManagedSessionCommand(
        {
          _: args,
          ...(filename ? { filename } : {}),
        },
        {
          sessionName: options.sessionName,
          timeoutMs: options.timeoutMs ?? DEFAULT_RUN_CODE_TIMEOUT_MS,
          timeoutMessage: `Code execution exceeded the ${(options.timeoutMs ?? DEFAULT_RUN_CODE_TIMEOUT_MS) / 1000}s guard timeout. Split long flows into first-class pw commands + explicit pw wait steps.`,
          timeoutCode: "RUN_CODE_TIMEOUT",
        },
      );
      const errorText = parseErrorText(result.text);
      if (errorText) {
        throw new Error(enrichRunCodeError(errorText));
      }
      break;
    } catch (error) {
      lastError = error;
      if (attempt >= attempts) {
        throw error;
      }
    }
  }
  if (!result) {
    throw lastError instanceof Error
      ? lastError
      : new Error(String(lastError ?? "run-code failed"));
  }
  const errorText = parseErrorText(result.text);
  if (errorText) {
    throw new Error(enrichRunCodeError(errorText));
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

function enrichRunCodeError(errorText: string) {
  if (isModalStateBlockedMessage(errorText)) {
    return "MODAL_STATE_BLOCKED";
  }
  const hints: string[] = [];
  if (/not visible|element is not visible/i.test(errorText)) {
    hints.push(
      "PWCLI_HINT: element exists but is not visible; check hidden submenu, closed dropdown, CSS display/visibility, offscreen position, or covered overlay.",
    );
  }
  if (/Timeout \d+ms exceeded|timed out/i.test(errorText)) {
    hints.push(
      "PWCLI_HINT: operation timed out; verify selector uniqueness, wait for the trigger state, or use `pw snapshot -i` / screenshot before retrying.",
    );
  }
  if (/strict mode violation/i.test(errorText)) {
    hints.push(
      "PWCLI_HINT: locator matched multiple elements; add --nth, a narrower selector, or role/name constraints.",
    );
  }
  if (/intercepts pointer events|element.*covered|receives pointer events/i.test(errorText)) {
    hints.push(
      "PWCLI_HINT: click target is covered; inspect active overlay/modal or click the visible parent trigger.",
    );
  }
  return hints.length > 0 ? `${errorText}\n${hints.join("\n")}` : errorText;
}
