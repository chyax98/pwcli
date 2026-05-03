import { listManagedSessions } from "../../infra/playwright/cli-client.js";
import { isModalStateBlockedMessage } from "../../infra/playwright/runtime/shared.js";

export function sessionRoutingError(message: string) {
  if (isModalStateBlockedMessage(message)) {
    return {
      code: "MODAL_STATE_BLOCKED",
      message:
        "The current managed session is blocked by a modal dialog, so run-code-backed reads and actions are unavailable.",
      suggestions: [
        "Run: pw dialog accept --session <name>  or  pw dialog dismiss --session <name>  then retry",
        "Run `pw doctor --session <name>` to confirm the blocked state",
        "If the session cannot be recovered, run `pw session recreate <name>`",
      ],
      recovery: {
        kind: "dismiss-dialog" as const,
        commands: ["pw dialog dismiss --session <name>", "pw doctor --session <name>"],
      },
    };
  }

  if (message === "SESSION_REQUIRED") {
    return {
      code: "SESSION_REQUIRED",
      message: "This command requires --session <name>.",
      suggestions: [
        "Run `pw session create <name> --open <url>` first",
        "Retry with `--session <name>`",
      ],
    };
  }

  if (message.startsWith("SESSION_NOT_FOUND:")) {
    const name = message.slice("SESSION_NOT_FOUND:".length);
    return {
      code: "SESSION_NOT_FOUND",
      message: `Session '${name}' not found.`,
      suggestions: [
        "Run `pw session list` to inspect active sessions",
        "Create it with `pw session create <name> --open <url>`",
      ],
      recovery: {
        kind: "inspect" as const,
        commands: ["pw session list", "pw session create <name> --open <url>"],
      },
      details: { session: name },
    };
  }

  if (message.startsWith("SESSION_BUSY:")) {
    const [, name, timeoutMs] = message.split(":");
    return {
      code: "SESSION_BUSY",
      message: `Session '${name}' is still running another command.`,
      retryable: true,
      suggestions: [
        "Retry the same command after the in-flight command finishes",
        "Keep dependent commands on the same session sequential, or put stable steps in `pw batch`",
        "If the owner process is gone, retry after the lock is reclaimed automatically",
      ],
      recovery: {
        kind: "retry" as const,
        commands: ["pw session status <name>", "pw observe status --session <name>"],
      },
      details: { session: name, timeoutMs: Number(timeoutMs) },
    };
  }

  if (message.startsWith("SESSION_RECREATE_STARTUP_TIMEOUT:")) {
    return {
      code: "SESSION_RECREATE_STARTUP_TIMEOUT",
      message: message.slice("SESSION_RECREATE_STARTUP_TIMEOUT:".length),
      retryable: false,
      suggestions: [
        "DO NOT retry recreate for the same session name — it will not self-heal",
        "Run: pw session close --session <name> --force  then  pw session create <new-name>",
        "Or use a completely different session name to avoid the locked profile",
      ],
    };
  }

  if (message.startsWith("CHROME_PROFILE_NOT_FOUND")) {
    const [, profile] = message.split(":");
    return {
      code: "CHROME_PROFILE_NOT_FOUND",
      message: profile
        ? `Chrome profile '${profile}' was not found.`
        : "No local Chrome profiles were found.",
      suggestions: [
        "Run `pw profile list-chrome` to inspect available Chrome profiles",
        "Retry with `pw session create <name> --from-system-chrome --chrome-profile <directory-or-name> --open <url>`",
        "If Chrome is installed in a non-standard location, set PWCLI_CHROME_USER_DATA_DIR to the Chrome user data directory",
      ],
      recovery: {
        kind: "inspect" as const,
        commands: ["pw profile list-chrome"],
      },
      details: profile ? { profile } : undefined,
    };
  }

  if (message.startsWith("SESSION_NAME_TOO_LONG:")) {
    const [, name, limit] = message.split(":");
    return {
      code: "SESSION_NAME_TOO_LONG",
      message: `Session '${name}' is too long. Maximum length is ${limit} characters.`,
      suggestions: [
        "Use a short session name like dc-main, auth-a, q1, or bug-a",
        `Keep the session name at or below ${limit} characters`,
      ],
      recovery: {
        kind: "inspect" as const,
        commands: [] as string[],
      },
      details: { session: name, maxLength: Number(limit) },
    };
  }

  if (message.startsWith("SESSION_NAME_INVALID:")) {
    const name = message.slice("SESSION_NAME_INVALID:".length);
    return {
      code: "SESSION_NAME_INVALID",
      message: `Session '${name}' contains unsupported characters.`,
      suggestions: [
        "Use only letters, numbers, hyphen, or underscore",
        "Example valid names: dc-main, auth_a, q1, bug-1",
      ],
      recovery: {
        kind: "inspect" as const,
        commands: [] as string[],
      },
      details: { session: name },
    };
  }

  return null;
}

export async function requireExistingSession(sessionName: string) {
  const sessions = await listManagedSessions();
  const entry = sessions.find((item) => item.name === sessionName);
  if (!entry?.alive) {
    throw new Error(`SESSION_NOT_FOUND:${sessionName}`);
  }
  return entry;
}
