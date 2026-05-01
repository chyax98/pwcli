import { join } from "node:path";
import type { Command } from "commander";
import { isActionFailure } from "../../domain/interaction/action-failure.js";
import { appendRunEvent, ensureRunDir } from "../../infra/fs/run-artifacts.js";
import { MAX_SESSION_NAME_LENGTH } from "../../infra/playwright/cli-client.js";
import { managedRunCode } from "../../infra/playwright/runtime.js";
import { sessionRoutingError } from "../../domain/session/routing.js";
import { printCommandError } from "../output.js";

export function addSessionOption<T extends Command>(command: T): T {
  return command.option("-s, --session <name>", "Target managed session");
}

export function requireSessionName(
  options: { session?: string },
  command?: Pick<Command, "optsWithGlobals">,
) {
  const merged = command?.optsWithGlobals<{ session?: string }>();
  const sessionName = merged?.session?.trim() || options.session?.trim();
  if (!sessionName) {
    throw new Error("SESSION_REQUIRED");
  }
  if (sessionName.length > MAX_SESSION_NAME_LENGTH) {
    throw new Error(`SESSION_NAME_TOO_LONG:${sessionName}:${MAX_SESSION_NAME_LENGTH}`);
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(sessionName)) {
    throw new Error(`SESSION_NAME_INVALID:${sessionName}`);
  }
  return sessionName;
}

export function printSessionAwareCommandError(
  command: string,
  error: unknown,
  fallback: {
    code: string;
    message: string;
    suggestions?: string[];
    details?: Record<string, unknown>;
  },
) {
  const message = error instanceof Error ? error.message : String(error);
  const routing = sessionRoutingError(message);
  if (routing) {
    printCommandError(command, routing);
    return;
  }

  if (isActionFailure(error)) {
    printCommandError(command, {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      suggestions: error.suggestions,
      details: error.details,
    });
    return;
  }

  const screenshotPath =
    error instanceof Error ? (error as unknown as Record<string, unknown>).failureScreenshotPath : undefined;
  printCommandError(command, {
    code: fallback.code,
    message: error instanceof Error ? error.message : fallback.message,
    suggestions: fallback.suggestions,
    details: {
      ...fallback.details,
      ...(screenshotPath ? { failureScreenshotPath: screenshotPath } : {}),
    },
  });
}

export async function captureFailureScreenshot(
  sessionName: string,
): Promise<string | undefined> {
  try {
    const run = await ensureRunDir(sessionName);
    const path = join(run.runDir, `failure-${Date.now()}.png`);
    await managedRunCode({
      sessionName,
      source: `async page => {
        await page.screenshot(${JSON.stringify({ path, fullPage: true })});
        return JSON.stringify({ path: ${JSON.stringify(path)} });
      }`,
    });
    return path;
  } catch {
    return undefined;
  }
}

export async function withActionFailureScreenshot<T>(
  sessionName: string,
  action: () => Promise<T>,
  command?: string,
): Promise<T> {
  try {
    return await action();
  } catch (error) {
    const screenshotPath = await captureFailureScreenshot(sessionName);
    if (screenshotPath) {
      if (isActionFailure(error)) {
        error.details = { ...error.details, failureScreenshotPath: screenshotPath };
      } else if (error instanceof Error) {
        (error as unknown as Record<string, unknown>).failureScreenshotPath = screenshotPath;
      }
    }
    if (command) {
      await recordCommandFailure(command, sessionName, error, screenshotPath).catch(() => {});
    }
    throw error;
  }
}

async function recordCommandFailure(
  command: string,
  sessionName: string,
  error: unknown,
  screenshotPath?: string,
) {
  const run = await ensureRunDir(sessionName);
  const code = isActionFailure(error) ? error.code : `${command.toUpperCase()}_FAILED`;
  const message = error instanceof Error ? error.message : String(error);
  await appendRunEvent(run.runDir, {
    ts: new Date().toISOString(),
    command,
    sessionName: sessionName ?? null,
    status: "failed",
    failed: true,
    failure: {
      code,
      message,
      retryable: isActionFailure(error) ? error.retryable : null,
      suggestions: isActionFailure(error) ? error.suggestions : [],
      details: isActionFailure(error) ? error.details ?? null : null,
    },
    ...(screenshotPath ? { failureScreenshotPath: screenshotPath } : {}),
  });
}
