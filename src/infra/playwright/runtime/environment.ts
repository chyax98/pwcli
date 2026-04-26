import { createRequire } from "node:module";
import type { Socket } from "node:net";
import { dirname, join } from "node:path";
import { ensureManagedSession } from "../cli-client.js";
import {
  parseErrorText,
  parseJsonStringLiteral,
  parsePageSummary,
  parseResultText,
} from "../output-parsers.js";
import { DIAGNOSTICS_STATE_KEY } from "./shared.js";

type ManagedEnvironmentOptions = {
  sessionName?: string;
};

type ManagedEnvironmentRunCodeResult = {
  session: {
    scope: "managed";
    name: string;
    default: boolean;
  };
  page?: ReturnType<typeof parsePageSummary>;
  rawText: string;
  data: {
    resultText?: string;
    result?: unknown;
  };
};

type SessionLike = {
  name: string;
  isCompatible(clientInfo: unknown): boolean;
  _connect(): Promise<{ socket?: Socket; error?: Error }>;
};

const require = createRequire(import.meta.url);
const playwrightCoreRoot = dirname(require.resolve("playwright-core/package.json"));
const socketConnectionModule = require(
  join(playwrightCoreRoot, "lib/tools/utils/socketConnection.js"),
);
const { SocketConnection } = socketConnectionModule as {
  SocketConnection: new (
    socket: Socket,
  ) => {
    onmessage?: (message: { id?: number; result?: { text?: string }; error?: string }) => void;
    onclose?: () => void;
    send(message: Record<string, unknown>): Promise<void>;
    close(): void;
  };
};
const ENVIRONMENT_TIMEOUT_MS = 4000;

function environmentSessionResult(
  result: ManagedEnvironmentRunCodeResult,
  data: Record<string, unknown>,
) {
  return {
    session: result.session,
    page: result.page,
    data,
  };
}

function parseEnvironmentMutationResult(
  result: ManagedEnvironmentRunCodeResult,
  commandName: string,
) {
  const parsed =
    typeof result.data.result === "object" && result.data.result ? result.data.result : {};
  const payload = parsed as {
    ok?: boolean;
    code?: string;
    message?: string;
    [key: string]: unknown;
  };
  if (payload.ok === false) {
    const code =
      typeof payload.code === "string" ? payload.code : `${commandName.toUpperCase()}_FAILED`;
    const message =
      typeof payload.message === "string"
        ? payload.message
        : `${commandName} failed on the managed session runtime`;
    throw new Error(`${code}:${message}`);
  }
  return payload as Record<string, unknown>;
}

class TimeoutSocketConnectionClient {
  private readonly connection: {
    onmessage?: (message: { id?: number; result?: { text?: string }; error?: string }) => void;
    onclose?: () => void;
    send(message: Record<string, unknown>): Promise<void>;
    close(): void;
  };

  private nextMessageId = 1;

  private readonly callbacks = new Map<
    number,
    {
      resolve: (value: { text?: string }) => void;
      reject: (error: Error) => void;
      timer: NodeJS.Timeout;
    }
  >();

  constructor(socket: Socket) {
    this.connection = new SocketConnection(socket);
    this.connection.onmessage = (message) => this.onMessage(message);
    this.connection.onclose = () => this.rejectCallbacks(new Error("Session closed"));
  }

  async send(
    method: string,
    params: Record<string, unknown>,
    timeoutMs: number,
    timeoutMessage: string,
  ) {
    const messageId = this.nextMessageId++;
    const responsePromise = new Promise<{ text?: string }>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.callbacks.delete(messageId);
        this.connection.close();
        reject(new Error(`ENVIRONMENT_LIMITATION:${timeoutMessage}`));
      }, timeoutMs);
      this.callbacks.set(messageId, { resolve, reject, timer });
    });
    await this.connection.send({
      id: messageId,
      method,
      params,
    });
    return await responsePromise;
  }

  static async sendAndClose(
    socket: Socket,
    method: string,
    params: Record<string, unknown>,
    timeoutMs: number,
    timeoutMessage: string,
  ) {
    const connection = new TimeoutSocketConnectionClient(socket);
    try {
      return await connection.send(method, params, timeoutMs, timeoutMessage);
    } finally {
      connection.close();
    }
  }

  close() {
    this.connection.close();
  }

  private onMessage(message: { id?: number; result?: { text?: string }; error?: string }) {
    if (!message.id) {
      throw new Error(`Unexpected message without id: ${JSON.stringify(message)}`);
    }
    const callback = this.callbacks.get(message.id);
    if (!callback) {
      throw new Error(`Unexpected message id: ${message.id}`);
    }
    this.callbacks.delete(message.id);
    clearTimeout(callback.timer);
    if (message.error) {
      callback.reject(new Error(message.error));
      return;
    }
    callback.resolve(message.result ?? {});
  }

  private rejectCallbacks(error: Error) {
    for (const callback of this.callbacks.values()) {
      clearTimeout(callback.timer);
      callback.reject(error);
    }
    this.callbacks.clear();
  }
}

async function runManagedEnvironmentCommand(
  args: Record<string, unknown>,
  options: ManagedEnvironmentOptions,
  timeoutMessage: string,
) {
  const { clientInfo, sessionName, session } = await ensureManagedSession({
    sessionName: options.sessionName,
  });
  const managedSession = session as unknown as SessionLike;
  if (!managedSession.isCompatible(clientInfo)) {
    throw new Error(
      `ENVIRONMENT_LIMITATION:Managed session '${managedSession.name}' is not compatible with the current client runtime.`,
    );
  }
  const { socket } = await managedSession._connect();
  if (!socket) {
    throw new Error(`SESSION_NOT_FOUND:${sessionName}`);
  }
  const result = await TimeoutSocketConnectionClient.sendAndClose(
    socket,
    "run",
    { args, cwd: process.cwd() },
    ENVIRONMENT_TIMEOUT_MS,
    timeoutMessage,
  );
  return {
    sessionName,
    text: result.text ?? "",
  };
}

async function managedEnvironmentRunCode(
  source: string,
  options: ManagedEnvironmentOptions,
  timeoutMessage: string,
): Promise<ManagedEnvironmentRunCodeResult> {
  const result = await runManagedEnvironmentCommand(
    {
      _: ["run-code", source],
    },
    options,
    timeoutMessage,
  );
  const errorText = parseErrorText(result.text);
  if (errorText) {
    throw new Error(errorText);
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
    },
  };
}

export async function managedEnvironmentOffline(
  mode: "on" | "off",
  options?: ManagedEnvironmentOptions,
) {
  const offline = mode === "on";
  const result = await managedEnvironmentRunCode(
    `async page => {
      const context = page.context();
      await context.setOffline(${offline ? "true" : "false"});
      const state = context[${JSON.stringify(DIAGNOSTICS_STATE_KEY)}] ||= {};
      state.environment = state.environment || {};
      state.environment.offline = {
        enabled: ${offline ? "true" : "false"},
        updatedAt: new Date().toISOString(),
      };
      return JSON.stringify({
        ok: true,
        offline: state.environment.offline,
      });
    }`,
    options ?? {},
    "BrowserContext.setOffline() did not complete on the managed run-code lane.",
  );
  const parsed = parseEnvironmentMutationResult(result, "environment offline");
  return environmentSessionResult(result, {
    mode,
    offline: parsed.offline ?? {
      enabled: offline,
    },
  });
}

export async function managedEnvironmentGeolocationSet(
  options: ManagedEnvironmentOptions & {
    latitude: number;
    longitude: number;
    accuracy?: number;
  },
) {
  const accuracy = options.accuracy ?? 0;
  const result = await managedEnvironmentRunCode(
    `async page => {
      const context = page.context();
      await context.setGeolocation({
        latitude: ${JSON.stringify(options.latitude)},
        longitude: ${JSON.stringify(options.longitude)},
        accuracy: ${JSON.stringify(accuracy)},
      });
      const state = context[${JSON.stringify(DIAGNOSTICS_STATE_KEY)}] ||= {};
      state.environment = state.environment || {};
      state.environment.geolocation = {
        latitude: ${JSON.stringify(options.latitude)},
        longitude: ${JSON.stringify(options.longitude)},
        accuracy: ${JSON.stringify(accuracy)},
        updatedAt: new Date().toISOString(),
      };
      return JSON.stringify({
        ok: true,
        geolocation: state.environment.geolocation,
      });
    }`,
    options,
    "BrowserContext.setGeolocation() did not complete on the managed run-code lane.",
  );
  const parsed = parseEnvironmentMutationResult(result, "environment geolocation set");
  return environmentSessionResult(result, {
    geolocation: parsed.geolocation ?? {
      latitude: options.latitude,
      longitude: options.longitude,
      accuracy,
    },
    note: "Grant geolocation permission separately if the page needs to read navigator.geolocation.",
  });
}

export async function managedEnvironmentPermissionsGrant(
  options: ManagedEnvironmentOptions & {
    permissions: string[];
  },
) {
  const permissions = Array.from(
    new Set(options.permissions.map((permission) => permission.trim()).filter(Boolean)),
  );
  const result = await managedEnvironmentRunCode(
    `async page => {
      const context = page.context();
      const permissions = ${JSON.stringify(permissions)};
      await context.grantPermissions(permissions);
      const state = context[${JSON.stringify(DIAGNOSTICS_STATE_KEY)}] ||= {};
      state.environment = state.environment || {};
      const previous = Array.isArray(state.environment.permissions?.granted)
        ? state.environment.permissions.granted
        : [];
      state.environment.permissions = {
        granted: Array.from(new Set([...previous, ...permissions])),
        updatedAt: new Date().toISOString(),
      };
      return JSON.stringify({
        ok: true,
        permissions: state.environment.permissions,
      });
    }`,
    options,
    "BrowserContext.grantPermissions() did not complete on the managed run-code lane.",
  );
  const parsed = parseEnvironmentMutationResult(result, "environment permissions grant");
  return environmentSessionResult(result, {
    permissions: parsed.permissions ?? {
      granted: permissions,
    },
  });
}

export async function managedEnvironmentPermissionsClear(options?: ManagedEnvironmentOptions) {
  const result = await managedEnvironmentRunCode(
    `async page => {
      const context = page.context();
      await context.clearPermissions();
      const state = context[${JSON.stringify(DIAGNOSTICS_STATE_KEY)}] ||= {};
      state.environment = state.environment || {};
      state.environment.permissions = {
        granted: [],
        cleared: true,
        updatedAt: new Date().toISOString(),
      };
      return JSON.stringify({
        ok: true,
        permissions: state.environment.permissions,
      });
    }`,
    options ?? {},
    "BrowserContext.clearPermissions() did not complete on the managed run-code lane.",
  );
  const parsed = parseEnvironmentMutationResult(result, "environment permissions clear");
  return environmentSessionResult(result, {
    permissions: parsed.permissions ?? {
      granted: [],
      cleared: true,
    },
  });
}

export async function managedEnvironmentClockInstall(options?: ManagedEnvironmentOptions) {
  const result = await managedEnvironmentRunCode(
    `async page => {
      const context = page.context();
      const clock = context.clock || page.clock;
      if (!clock || typeof clock.install !== 'function') {
        return JSON.stringify({
          ok: false,
          code: 'CLOCK_LIMITATION',
          message: 'Clock emulation is unavailable on the current managed session substrate.',
        });
      }
      try {
        await clock.install();
      } catch (error) {
        return JSON.stringify({
          ok: false,
          code: 'CLOCK_LIMITATION',
          message: error instanceof Error ? error.message : String(error),
        });
      }
      const state = context[${JSON.stringify(DIAGNOSTICS_STATE_KEY)}] ||= {};
      state.environment = state.environment || {};
      state.environment.clock = {
        installed: true,
        paused: false,
        source: context.clock ? 'context.clock' : 'page.clock',
        lastAction: 'install',
        updatedAt: new Date().toISOString(),
      };
      return JSON.stringify({
        ok: true,
        clock: state.environment.clock,
      });
    }`,
    options ?? {},
    "Clock.install() did not complete on the managed run-code lane.",
  );
  const parsed = parseEnvironmentMutationResult(result, "environment clock install");
  return environmentSessionResult(result, {
    clock: parsed.clock ?? {
      installed: true,
      paused: false,
    },
  });
}

export async function managedEnvironmentClockSet(iso: string, options?: ManagedEnvironmentOptions) {
  const result = await managedEnvironmentRunCode(
    `async page => {
      const context = page.context();
      const clock = context.clock || page.clock;
      if (!clock || typeof clock.pauseAt !== 'function') {
        return JSON.stringify({
          ok: false,
          code: 'CLOCK_LIMITATION',
          message: 'Clock pauseAt is unavailable on the current managed session substrate.',
        });
      }
      const state = context[${JSON.stringify(DIAGNOSTICS_STATE_KEY)}] ||= {};
      state.environment = state.environment || {};
      const currentClock = state.environment.clock || {};
      if (!currentClock.installed) {
        return JSON.stringify({
          ok: false,
          code: 'CLOCK_REQUIRES_INSTALL',
          message: 'Clock install must run before clock set on a managed session.',
        });
      }
      try {
        await clock.pauseAt(${JSON.stringify(iso)});
      } catch (error) {
        return JSON.stringify({
          ok: false,
          code: 'CLOCK_LIMITATION',
          message: error instanceof Error ? error.message : String(error),
        });
      }
      state.environment.clock = {
        ...currentClock,
        installed: true,
        paused: true,
        currentTime: ${JSON.stringify(iso)},
        lastAction: 'set',
        updatedAt: new Date().toISOString(),
      };
      return JSON.stringify({
        ok: true,
        clock: state.environment.clock,
      });
    }`,
    options ?? {},
    "Clock.pauseAt() did not complete on the managed run-code lane.",
  );
  const parsed = parseEnvironmentMutationResult(result, "environment clock set");
  return environmentSessionResult(result, {
    clock: parsed.clock ?? {
      installed: true,
      paused: true,
      currentTime: iso,
    },
  });
}

export async function managedEnvironmentClockResume(options?: ManagedEnvironmentOptions) {
  const result = await managedEnvironmentRunCode(
    `async page => {
      const context = page.context();
      const clock = context.clock || page.clock;
      if (!clock || typeof clock.resume !== 'function') {
        return JSON.stringify({
          ok: false,
          code: 'CLOCK_LIMITATION',
          message: 'Clock resume is unavailable on the current managed session substrate.',
        });
      }
      const state = context[${JSON.stringify(DIAGNOSTICS_STATE_KEY)}] ||= {};
      state.environment = state.environment || {};
      const currentClock = state.environment.clock || {};
      if (!currentClock.installed) {
        return JSON.stringify({
          ok: false,
          code: 'CLOCK_REQUIRES_INSTALL',
          message: 'Clock install must run before clock resume on a managed session.',
        });
      }
      try {
        await clock.resume();
      } catch (error) {
        return JSON.stringify({
          ok: false,
          code: 'CLOCK_LIMITATION',
          message: error instanceof Error ? error.message : String(error),
        });
      }
      state.environment.clock = {
        ...currentClock,
        installed: true,
        paused: false,
        lastAction: 'resume',
        updatedAt: new Date().toISOString(),
      };
      return JSON.stringify({
        ok: true,
        clock: state.environment.clock,
      });
    }`,
    options ?? {},
    "Clock.resume() did not complete on the managed run-code lane.",
  );
  const parsed = parseEnvironmentMutationResult(result, "environment clock resume");
  return environmentSessionResult(result, {
    clock: parsed.clock ?? {
      installed: true,
      paused: false,
    },
  });
}
