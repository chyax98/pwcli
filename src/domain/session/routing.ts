import { listManagedSessions } from "../../infra/playwright/cli-client.js";

export function sessionRoutingError(message: string) {
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
