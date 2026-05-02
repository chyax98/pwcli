import { ActionFailure } from "../../../domain/interaction/action-failure.js";
import {
  type RefEpochValidation,
} from "../../../domain/interaction/model.js";
import { buildRunEvent, type RunEventTargetKind } from "../../../domain/interaction/model.js";
import { appendRunEvent, ensureRunDir } from "../../fs/run-artifacts.js";
import { runManagedSessionCommand } from "../cli-client.js";
import { parsePageSummary } from "../output-parsers.js";
import {
  throwIfManagedActionError,
  throwManagedActionErrorText,
} from "./action-failure-classifier.js";
import { managedRunCode, managedSnapshot } from "./code.js";
import { buildDiagnosticsDelta, captureDiagnosticsBaseline } from "./diagnostics.js";
import { isModalStateBlockedMessage, maybeRawOutput, normalizeRef } from "./shared.js";
import { pageIdRuntimePrelude } from "./workspace.js";

export type DiagnosticsBaseline = {
  consoleTotal: number;
  networkTotal: number;
  pageErrorTotal: number;
};

export type ManagedSessionMeta = {
  scope: "managed";
  name: string;
  default: boolean;
};

export type ManagedCodeResult = Awaited<ReturnType<typeof managedRunCode>>;

export type ActionResultEnvelope = {
  session: ManagedSessionMeta;
  page: Record<string, unknown> | undefined;
  data: Record<string, unknown>;
};

export type RunRecord = Awaited<ReturnType<typeof ensureRunDir>>;

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function errorCode(error: unknown, fallback: string) {
  return error instanceof ActionFailure ? error.code : fallback;
}

export function errorRetryable(error: unknown) {
  return error instanceof ActionFailure ? error.retryable : undefined;
}

export function errorSuggestions(error: unknown) {
  return error instanceof ActionFailure ? error.suggestions : undefined;
}

export function errorDetails(error: unknown) {
  return error instanceof ActionFailure ? error.details : undefined;
}

export function attachFailureRun(error: unknown, run: RunRecord) {
  if (!(error instanceof ActionFailure)) {
    return;
  }
  const details = {
    ...(error.details ?? {}),
    run,
  };
  Object.defineProperty(error, "details", {
    value: details,
    configurable: true,
  });
}

export function isModalBlockedDelta(delta: Record<string, unknown>) {
  return delta.unavailable === true && isModalStateBlockedMessage(errorMessage(delta.reason));
}

export async function recordActionRun(
  command: string,
  sessionName: string | undefined,
  page: Record<string, unknown> | undefined,
  details: Record<string, unknown>,
  targetKind?: RunEventTargetKind,
): Promise<RunRecord> {
  const run = await ensureRunDir(sessionName);
  const event = buildRunEvent(command, sessionName, page, details, targetKind ?? "none");
  await appendRunEvent(run.runDir, event);
  return run;
}

export async function recordFailedActionRun(
  command: string,
  sessionName: string | undefined,
  page: Record<string, unknown> | undefined,
  before: DiagnosticsBaseline,
  error: unknown,
  details: Record<string, unknown> = {},
): Promise<RunRecord> {
  const diagnosticsDelta = await buildDiagnosticsDeltaOrSignal(sessionName, before);
  const run = await recordActionRun(command, sessionName, page, {
    ...details,
    status: "failed",
    failed: true,
    diagnosticsDelta,
    failure: {
      code: errorCode(error, `${command.toUpperCase()}_FAILED`),
      message: errorMessage(error),
      retryable: errorRetryable(error) ?? null,
      suggestions: errorSuggestions(error) ?? [],
      details: errorDetails(error) ?? null,
    },
  });
  attachFailureRun(error, run);
  return run;
}

export async function buildDiagnosticsDeltaOrSignal(
  sessionName: string | undefined,
  before: DiagnosticsBaseline,
): Promise<Record<string, unknown>> {
  try {
    return await buildDiagnosticsDelta(sessionName, before);
  } catch (error) {
    return {
      unavailable: true,
      reason: errorMessage(error),
    };
  }
}

export async function validateRefEpoch(options: {
  sessionName?: string;
  ref: string;
}): Promise<RefEpochValidation> {
  const result = await managedRunCode({
    sessionName: options.sessionName,
    source: `async page => {
      ${pageIdRuntimePrelude()}

      const epoch = state.lastSnapshotRefEpoch || null;
      const currentPageId = ensurePageId(page) || null;
      const currentNavigationId = ensureNavigationId(page) || null;
      const ref = ${JSON.stringify(options.ref)};

      if (!epoch) {
        return JSON.stringify({
          ok: false,
          code: 'REF_STALE',
          ref,
          reason: 'missing-snapshot',
          currentPageId,
          currentNavigationId,
          currentUrl: page.url(),
        });
      }

      if (epoch.pageId && currentPageId && epoch.pageId !== currentPageId) {
        return JSON.stringify({
          ok: false,
          code: 'REF_STALE',
          ref,
          reason: 'page-changed',
          snapshotId: epoch.snapshotId,
          snapshotPageId: epoch.pageId,
          snapshotNavigationId: epoch.navigationId || null,
          currentPageId,
          currentNavigationId,
          currentUrl: page.url(),
        });
      }

      if (epoch.navigationId && currentNavigationId && epoch.navigationId !== currentNavigationId) {
        return JSON.stringify({
          ok: false,
          code: 'REF_STALE',
          ref,
          reason: 'navigation-changed',
          snapshotId: epoch.snapshotId,
          snapshotPageId: epoch.pageId || null,
          snapshotNavigationId: epoch.navigationId,
          currentPageId,
          currentNavigationId,
          currentUrl: page.url(),
        });
      }

      if (!Array.isArray(epoch.refs) || !epoch.refs.includes(ref)) {
        return JSON.stringify({
          ok: false,
          code: 'REF_STALE',
          ref,
          reason: 'missing-ref',
          snapshotId: epoch.snapshotId,
          snapshotPageId: epoch.pageId || null,
          snapshotNavigationId: epoch.navigationId || null,
          currentPageId,
          currentNavigationId,
          currentUrl: page.url(),
        });
      }

      return JSON.stringify({
        ok: true,
        ref,
        snapshotId: epoch.snapshotId,
        pageId: currentPageId,
        navigationId: currentNavigationId,
      });
    }`,
  });
  return result.data.result as RefEpochValidation;
}

export async function assertFreshRefEpoch(options: { sessionName?: string; ref: string }) {
  const validation = await validateRefEpoch(options);
  if (validation.ok) {
    return;
  }

  let freshSnapshotCaptured = false;
  let freshSnapshotRefCount: number | undefined;
  try {
    const fresh = await managedSnapshot({
      sessionName: options.sessionName,
      interactive: true,
      skipEpoch: true,
    });
    freshSnapshotCaptured = true;
    const snapshotText = typeof fresh.data?.snapshot === "string" ? fresh.data.snapshot : "";
    const refMatches = snapshotText.match(/\[ref=[^\]]+\]/g);
    freshSnapshotRefCount = refMatches?.length;
  } catch {
    // snapshot capture failed — still throw the original REF_STALE
  }

  const sessionFlag = `--session ${options.sessionName ?? "<name>"}`;
  throw new ActionFailure({
    code: "REF_STALE",
    message: `Ref ${options.ref} is stale for the current page snapshot`,
    retryable: false,
    recovery: {
      kind: "re-snapshot",
      commands: [`pw snapshot -i ${sessionFlag}`],
    },
    details: {
      ...(validation as unknown as Record<string, unknown>),
      recovery: {
        action: "re-snapshot",
        freshSnapshotCaptured,
        freshSnapshotRefCount: freshSnapshotRefCount ?? null,
        previousEpoch: {
          snapshotId: (validation as Record<string, unknown>).snapshotId ?? null,
          pageId: (validation as Record<string, unknown>).snapshotPageId ?? null,
          navigationId: (validation as Record<string, unknown>).snapshotNavigationId ?? null,
        },
        currentEpoch: {
          pageId: (validation as Record<string, unknown>).currentPageId ?? null,
          navigationId: (validation as Record<string, unknown>).currentNavigationId ?? null,
          url: (validation as Record<string, unknown>).currentUrl ?? null,
        },
        nextSteps: [`pw snapshot -i ${sessionFlag}`, "重新选择 ref 后再执行 action"],
      },
    },
    suggestions: [
      freshSnapshotCaptured
        ? `Fresh snapshot captured (${freshSnapshotRefCount ?? "?"} refs) — run \`pw snapshot -i ${sessionFlag}\` to see them`
        : `Refresh refs with \`pw snapshot -i ${sessionFlag}\``,
      "Pick a new ref from the fresh snapshot and retry the action",
    ],
  });
}

export async function executeCodeAction(options: {
  command: string;
  sessionName?: string;
  source: string;
  before: DiagnosticsBaseline;
  target?: Record<string, unknown>;
  details?: Record<string, unknown>;
}): Promise<ManagedCodeResult> {
  try {
    return await managedRunCode({ sessionName: options.sessionName, source: options.source });
  } catch (error) {
    if (error instanceof Error) {
      throwManagedActionErrorText(error.message, {
        command: options.command,
        sessionName: options.sessionName,
      });
    }
    throw error;
  }
}

export async function runManagedCommand(options: {
  sessionName?: string;
  argv: string[];
}) {
  const result = await runManagedSessionCommand(
    { _: options.argv },
    { sessionName: options.sessionName },
  );
  return {
    sessionName: result.sessionName,
    text: result.text,
    page: parsePageSummary(result.text),
  };
}

export async function validateCommandResult(options: {
  text: string;
  command: string;
  sessionName?: string;
  before: DiagnosticsBaseline;
  page?: Record<string, unknown> | undefined;
  target?: Record<string, unknown>;
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    throwIfManagedActionError(options.text, {
      command: options.command,
      sessionName: options.sessionName,
    });
  } catch (error) {
    await recordFailedActionRun(
      options.command,
      options.sessionName,
      options.page,
      options.before,
      error,
      {
        ...(options.target ? { target: options.target } : {}),
        ...(options.details ?? {}),
      },
    );
    throw error;
  }
}

export async function executeCommandAction(options: {
  command: string;
  sessionName?: string;
  argv: string[];
  before: DiagnosticsBaseline;
  target?: Record<string, unknown>;
  details?: Record<string, unknown>;
}): Promise<{ sessionName: string; text: string; page: Record<string, unknown> | undefined }> {
  const { sessionName, text, page } = await runManagedCommand({
    sessionName: options.sessionName,
    argv: options.argv,
  });
  await validateCommandResult({
    text,
    command: options.command,
    sessionName,
    before: options.before,
    page,
    target: options.target,
    details: options.details,
  });
  return { sessionName, text, page };
}

export async function buildDialogPendingResult(options: {
  command: string;
  sessionName?: string;
  resultText?: string;
  page?: Record<string, unknown> | undefined;
  target?: Record<string, unknown>;
  before: DiagnosticsBaseline;
  diagnosticsDelta?: Record<string, unknown>;
}): Promise<ActionResultEnvelope> {
  const diagnosticsDelta =
    options.diagnosticsDelta ??
    (await buildDiagnosticsDeltaOrSignal(options.sessionName, options.before));
  const run = await recordActionRun(options.command, options.sessionName, options.page, {
    ...(options.target ? { target: options.target } : {}),
    status: "dialog-pending",
    acted: true,
    modalPending: true,
    diagnosticsDelta,
    failureSignal: {
      code: "MODAL_STATE_BLOCKED",
      message: "action fired and a browser dialog is pending",
    },
  });
  return {
    session: {
      scope: "managed",
      name: options.sessionName ?? "default",
      default: !options.sessionName || options.sessionName === "default",
    },
    page: options.page,
    data: {
      ...(options.target ? { target: options.target } : {}),
      acted: true,
      modalPending: true,
      blockedState: "MODAL_STATE_BLOCKED",
      diagnosticsDelta,
      run,
      ...(options.resultText ? maybeRawOutput(options.resultText) : {}),
    },
  };
}

export async function finalizeAction(options: {
  command: string;
  sessionName?: string;
  page: Record<string, unknown> | undefined;
  before: DiagnosticsBaseline;
  resultData: Record<string, unknown>;
  runDetails: Record<string, unknown>;
  targetKind: RunEventTargetKind;
  rawText?: string;
}): Promise<ActionResultEnvelope> {
  const diagnosticsDelta = await buildDiagnosticsDeltaOrSignal(options.sessionName, options.before);
  const run = await recordActionRun(
    options.command,
    options.sessionName,
    options.page,
    {
      ...options.runDetails,
      diagnosticsDelta,
    },
    options.targetKind,
  );
  return {
    session: {
      scope: "managed",
      name: options.sessionName ?? "default",
      default: !options.sessionName || options.sessionName === "default",
    },
    page: options.page,
    data: {
      ...options.resultData,
      diagnosticsDelta,
      run,
      ...(options.rawText ? maybeRawOutput(options.rawText) : {}),
    },
  };
}
