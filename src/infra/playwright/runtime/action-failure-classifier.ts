import { ActionFailure } from "../../../domain/interaction/action-failure.js";
import { parseErrorText } from "../output-parsers.js";

type ManagedActionErrorContext = {
  command: string;
  sessionName?: string;
};

function isTargetNotFoundError(errorText: string) {
  if (
    /No element matches selector/i.test(errorText) ||
    /Unable to find/i.test(errorText) ||
    /(CLICK|FILL|TYPE)_SEMANTIC_NOT_FOUND/i.test(errorText) ||
    /(CLICK|FILL|TYPE|HOVER|CHECK|UNCHECK|SELECT)_SELECTOR_NOT_FOUND/i.test(errorText)
  ) {
    return true;
  }

  if (/not found/i.test(errorText) && !/\b(dialog|modal)\b/i.test(errorText)) {
    return true;
  }

  return false;
}

export function throwIfManagedActionError(text: string, context: ManagedActionErrorContext) {
  const errorText = parseErrorText(text);
  if (!errorText) {
    return;
  }

  throwManagedActionErrorText(errorText, context);
}

export function throwManagedActionErrorText(errorText: string, context: ManagedActionErrorContext) {
  const session = context.sessionName ?? null;
  const refMatch = errorText.match(
    /Ref\s+([A-Za-z0-9_-]+)\s+not found in the current page snapshot/i,
  );
  if (refMatch) {
    throw new ActionFailure({
      code: "REF_STALE",
      message: errorText,
      retryable: true,
      suggestions: [
        `Refresh refs with \`pw snapshot -i --session ${context.sessionName ?? "<name>"}\``,
        "Retry with a fresh ref from the new snapshot",
        "Use a semantic locator such as --role or --text when the target must survive navigation or re-rendering",
      ],
      recovery: {
        kind: "re-snapshot",
        commands: [`pw snapshot -i --session ${context.sessionName ?? "<name>"}`],
      },
      details: { command: context.command, ref: refMatch[1], session },
    });
  }

  if (/strict mode violation/i.test(errorText)) {
    throw new ActionFailure({
      code: "ACTION_TARGET_AMBIGUOUS",
      message: errorText,
      retryable: true,
      suggestions: [
        "Narrow the locator so it resolves to one target",
        "Pass --nth when multiple matching targets are expected",
        `Inspect the current snapshot with \`pw snapshot -i --session ${context.sessionName ?? "<name>"}\``,
      ],
      recovery: {
        kind: "inspect",
        commands: [
          `pw snapshot -i --session ${context.sessionName ?? "<name>"}`,
          `pw observe status --session ${context.sessionName ?? "<name>"}`,
        ],
      },
      details: { command: context.command, session },
    });
  }

  if (/(CLICK|FILL|TYPE)_SEMANTIC_INDEX_OUT_OF_RANGE|INDEX_OUT_OF_RANGE/i.test(errorText)) {
    throw new ActionFailure({
      code: "ACTION_TARGET_INDEX_OUT_OF_RANGE",
      message: errorText,
      retryable: true,
      suggestions: [
        "Pass an --nth value within the available target count",
        `Inspect the current snapshot with \`pw snapshot -i --session ${context.sessionName ?? "<name>"}\``,
        "Use a narrower selector or semantic locator when possible",
      ],
      recovery: {
        kind: "inspect",
        commands: [
          `pw snapshot -i --session ${context.sessionName ?? "<name>"}`,
          `pw observe status --session ${context.sessionName ?? "<name>"}`,
        ],
      },
      details: { command: context.command, session },
    });
  }

  if (
    /timeout/i.test(errorText) ||
    /not visible|not enabled|not stable|receives pointer events/i.test(errorText)
  ) {
    throw new ActionFailure({
      code: "ACTION_TIMEOUT_OR_NOT_ACTIONABLE",
      message: errorText,
      retryable: true,
      suggestions: [
        "Wait for the target with a selector before retrying the action",
        `Check page readiness with \`pw observe status --session ${context.sessionName ?? "<name>"}\``,
        "Clear any dialog, modal, or overlay that may block the target",
      ],
      recovery: {
        kind: "inspect",
        commands: [
          `pw observe status --session ${context.sessionName ?? "<name>"}`,
          `pw snapshot -i --session ${context.sessionName ?? "<name>"}`,
        ],
      },
      details: { command: context.command, session },
    });
  }

  if (isTargetNotFoundError(errorText)) {
    throw new ActionFailure({
      code: "ACTION_TARGET_NOT_FOUND",
      message: errorText,
      retryable: true,
      suggestions: [
        `Refresh refs with \`pw snapshot -i --session ${context.sessionName ?? "<name>"}\``,
        "Use an existing selector from the current page",
        "Use a semantic locator such as --role or --text when possible",
      ],
      recovery: {
        kind: "inspect",
        commands: [
          `pw snapshot -i --session ${context.sessionName ?? "<name>"}`,
          `pw observe status --session ${context.sessionName ?? "<name>"}`,
        ],
      },
      details: { command: context.command, session },
    });
  }

  throw new Error(errorText);
}
