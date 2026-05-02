import {
  ActionFailure,
  type ActionFailureCode,
  type ActionFailureRecovery,
} from "./action-failure.js";

export { ActionFailure };

/**
 * Centralized interaction error codes and recovery policies.
 *
 * Browser-side JS source strings (e.g. CLICK_SEMANTIC_NOT_FOUND) are NOT
 * listed here — they are runtime literals executed inside the browser and
 * remain hard-coded in the source templates in interaction.ts.
 */

export const InteractionErrorCode = {
  REF_STALE: "REF_STALE",
  ACTION_TARGET_NOT_FOUND: "ACTION_TARGET_NOT_FOUND",
  ACTION_TARGET_AMBIGUOUS: "ACTION_TARGET_AMBIGUOUS",
  ACTION_TARGET_INDEX_OUT_OF_RANGE: "ACTION_TARGET_INDEX_OUT_OF_RANGE",
  ACTION_TIMEOUT_OR_NOT_ACTIONABLE: "ACTION_TIMEOUT_OR_NOT_ACTIONABLE",
  MODAL_STATE_BLOCKED: "MODAL_STATE_BLOCKED",
} as const satisfies Record<string, ActionFailureCode>;

export type InteractionErrorCode =
  (typeof InteractionErrorCode)[keyof typeof InteractionErrorCode];

function sessionFlag(sessionName: string | undefined): string {
  return `--session ${sessionName ?? "<name>"}`;
}

export function makeRecovery(
  kind: ActionFailureRecovery["kind"],
  commands: string[],
): ActionFailureRecovery {
  return { kind, commands };
}

export function reSnapshotRecovery(sessionName: string | undefined): ActionFailureRecovery {
  return makeRecovery("re-snapshot", [`pw snapshot -i ${sessionFlag(sessionName)}`]);
}

export function inspectRecovery(sessionName: string | undefined): ActionFailureRecovery {
  return makeRecovery("inspect", [
    `pw snapshot -i ${sessionFlag(sessionName)}`,
    `pw observe status ${sessionFlag(sessionName)}`,
  ]);
}

export function inspectWithStatusFirstRecovery(
  sessionName: string | undefined,
): ActionFailureRecovery {
  return makeRecovery("inspect", [
    `pw observe status ${sessionFlag(sessionName)}`,
    `pw snapshot -i ${sessionFlag(sessionName)}`,
  ]);
}

export function refStaleFailure(
  message: string,
  context: { command: string; sessionName?: string; ref?: string },
  overrides?: {
    retryable?: boolean;
    suggestions?: string[];
    recovery?: ActionFailureRecovery;
    details?: Record<string, unknown>;
  },
): ActionFailure {
  const session = context.sessionName ?? null;
  const baseDetails: Record<string, unknown> = { command: context.command, session };
  if (context.ref !== undefined) {
    baseDetails.ref = context.ref;
  }

  return new ActionFailure({
    code: InteractionErrorCode.REF_STALE,
    message,
    retryable: overrides?.retryable ?? true,
    suggestions: overrides?.suggestions ?? [
      `Refresh refs with \`pw snapshot -i ${sessionFlag(context.sessionName)}\``,
      "Retry with a fresh ref from the new snapshot",
      "Use a semantic locator such as --role or --text when the target must survive navigation or re-rendering",
    ],
    recovery: overrides?.recovery ?? reSnapshotRecovery(context.sessionName),
    details: overrides?.details ?? baseDetails,
  });
}

export function actionTargetAmbiguousFailure(
  message: string,
  context: { command: string; sessionName?: string },
): ActionFailure {
  const session = context.sessionName ?? null;
  return new ActionFailure({
    code: InteractionErrorCode.ACTION_TARGET_AMBIGUOUS,
    message,
    retryable: true,
    suggestions: [
      "Narrow the locator so it resolves to one target",
      "Pass --nth when multiple matching targets are expected",
      `Inspect the current snapshot with \`pw snapshot -i ${sessionFlag(context.sessionName)}\``,
    ],
    recovery: inspectRecovery(context.sessionName),
    details: { command: context.command, session },
  });
}

export function actionTargetIndexOutOfRangeFailure(
  message: string,
  context: { command: string; sessionName?: string },
): ActionFailure {
  const session = context.sessionName ?? null;
  return new ActionFailure({
    code: InteractionErrorCode.ACTION_TARGET_INDEX_OUT_OF_RANGE,
    message,
    retryable: true,
    suggestions: [
      "Pass an --nth value within the available target count",
      `Inspect the current snapshot with \`pw snapshot -i ${sessionFlag(context.sessionName)}\``,
      "Use a narrower selector or semantic locator when possible",
    ],
    recovery: inspectRecovery(context.sessionName),
    details: { command: context.command, session },
  });
}

export function actionTimeoutOrNotActionableFailure(
  message: string,
  context: { command: string; sessionName?: string },
): ActionFailure {
  const session = context.sessionName ?? null;
  return new ActionFailure({
    code: InteractionErrorCode.ACTION_TIMEOUT_OR_NOT_ACTIONABLE,
    message,
    retryable: true,
    suggestions: [
      "Wait for the target with a selector before retrying the action",
      `Check page readiness with \`pw observe status ${sessionFlag(context.sessionName)}\``,
      "Clear any dialog, modal, or overlay that may block the target",
    ],
    recovery: inspectWithStatusFirstRecovery(context.sessionName),
    details: { command: context.command, session },
  });
}

export function actionTargetNotFoundFailure(
  message: string,
  context: { command: string; sessionName?: string },
): ActionFailure {
  const session = context.sessionName ?? null;
  return new ActionFailure({
    code: InteractionErrorCode.ACTION_TARGET_NOT_FOUND,
    message,
    retryable: true,
    suggestions: [
      `Refresh refs with \`pw snapshot -i ${sessionFlag(context.sessionName)}\``,
      "Use an existing selector from the current page",
      "Use a semantic locator such as --role or --text when possible",
    ],
    recovery: inspectRecovery(context.sessionName),
    details: { command: context.command, session },
  });
}

export function modalStateBlockedFailure(
  message: string,
  context: { command: string; sessionName?: string },
): ActionFailure {
  const session = context.sessionName ?? null;
  return new ActionFailure({
    code: InteractionErrorCode.MODAL_STATE_BLOCKED,
    message,
    retryable: false,
    suggestions: [
      "Dismiss or accept the pending browser dialog before continuing",
      `Use \`pw dialog-accept\` or \`pw dialog-dismiss\` ${sessionFlag(context.sessionName)}`,
    ],
    recovery: makeRecovery("dialog", [
      `pw dialog-accept ${sessionFlag(context.sessionName)}`,
      `pw dialog-dismiss ${sessionFlag(context.sessionName)}`,
    ]),
    details: { command: context.command, session },
  });
}
