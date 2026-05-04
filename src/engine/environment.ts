import {
  parseErrorText,
  parseJsonStringLiteral,
  parsePageSummary,
  parseResultText,
  runManagedSessionCommand,
} from "./session.js";
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

async function managedEnvironmentRunCode(
  source: string,
  options: ManagedEnvironmentOptions,
  timeoutMessage: string,
): Promise<ManagedEnvironmentRunCodeResult> {
  const result = await runManagedSessionCommand(
    {
      _: ["run-code", source],
    },
    {
      sessionName: options.sessionName,
      timeoutMs: ENVIRONMENT_TIMEOUT_MS,
      timeoutMessage,
      timeoutCode: "ENVIRONMENT_LIMITATION",
    },
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
      const setMethod =
        clock && typeof clock.setFixedTime === 'function'
          ? 'setFixedTime'
          : clock && typeof clock.setSystemTime === 'function'
            ? 'setSystemTime'
            : null;
      if (!clock || !setMethod) {
        return JSON.stringify({
          ok: false,
          code: 'CLOCK_LIMITATION',
          message: 'Clock set is unavailable on the current managed session substrate.',
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
        await clock[setMethod](${JSON.stringify(iso)});
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
        currentTime: ${JSON.stringify(iso)},
        lastAction: 'set',
        setMethod,
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
      paused: false,
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

import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir, platform } from "node:os";
import { dirname, join, resolve } from "node:path";

export type ChromeProfileInfo = {
  browser: "chrome";
  directory: string;
  name: string;
  userDataDir: string;
  profilePath: string;
  default: boolean;
  source: "system-chrome";
};

type ChromeProfileOptions = {
  userDataDir?: string;
};

type ChromeProfileConfig = {
  configPath: string;
  profile: ChromeProfileInfo;
};

function expandPath(input: string) {
  if (input === "~") {
    return homedir();
  }
  if (input.startsWith("~/")) {
    return resolve(homedir(), input.slice(2));
  }
  return resolve(input);
}

function defaultChromeUserDataDirs() {
  const override = process.env.PWCLI_CHROME_USER_DATA_DIR?.trim();
  if (override) {
    return [expandPath(override)];
  }

  switch (platform()) {
    case "darwin":
      return [join(homedir(), "Library", "Application Support", "Google", "Chrome")];
    case "win32":
      return process.env.LOCALAPPDATA
        ? [join(process.env.LOCALAPPDATA, "Google", "Chrome", "User Data")]
        : [];
    default:
      return [join(homedir(), ".config", "google-chrome"), join(homedir(), ".config", "chromium")];
  }
}

async function pathExists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readJson(path: string) {
  try {
    return JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function profileDisplayName(directory: string, localState: Record<string, unknown>) {
  const profile = localState.profile as
    | { info_cache?: Record<string, { name?: string }> }
    | undefined;
  return profile?.info_cache?.[directory]?.name?.trim() || directory;
}

async function profileDirectories(userDataDir: string) {
  const localState = await readJson(join(userDataDir, "Local State"));
  const profile = localState.profile as { info_cache?: Record<string, unknown> } | undefined;
  const directories = Object.keys(profile?.info_cache ?? {});
  return directories.length > 0 ? directories : ["Default"];
}

export async function listChromeProfiles(options?: ChromeProfileOptions) {
  const roots = options?.userDataDir
    ? [expandPath(options.userDataDir)]
    : defaultChromeUserDataDirs();
  const profiles: ChromeProfileInfo[] = [];

  for (const userDataDir of roots) {
    if (!(await pathExists(userDataDir))) {
      continue;
    }
    const localState = await readJson(join(userDataDir, "Local State"));
    for (const directory of await profileDirectories(userDataDir)) {
      const profilePath = join(userDataDir, directory);
      if (!(await pathExists(profilePath))) {
        continue;
      }
      profiles.push({
        browser: "chrome",
        directory,
        name: profileDisplayName(directory, localState),
        userDataDir,
        profilePath,
        default: directory === "Default",
        source: "system-chrome",
      });
    }
  }

  return profiles.sort((a, b) => {
    if (a.default !== b.default) {
      return a.default ? -1 : 1;
    }
    return a.directory.localeCompare(b.directory);
  });
}

export async function resolveChromeProfile(selector?: string, options?: ChromeProfileOptions) {
  const profiles = await listChromeProfiles(options);
  if (profiles.length === 0) {
    throw new Error("CHROME_PROFILE_NOT_FOUND");
  }

  const target = (selector?.trim() || "Default").toLowerCase();
  const profile =
    profiles.find((item) => item.directory.toLowerCase() === target) ??
    profiles.find((item) => item.name.toLowerCase() === target);
  if (!profile) {
    throw new Error(`CHROME_PROFILE_NOT_FOUND:${selector}`);
  }
  return profile;
}

export async function writeChromeProfileConfig(
  sessionName: string,
  selector?: string,
  options?: ChromeProfileOptions,
): Promise<ChromeProfileConfig> {
  const profile = await resolveChromeProfile(selector, options);
  const configPath = resolve(".pwcli", "system-chrome", `${sessionName}.config.json`);
  const config = {
    browser: {
      userDataDir: profile.userDataDir,
      launchOptions: {
        channel: "chrome",
        args: [`--profile-directory=${profile.directory}`],
      },
    },
  };

  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, JSON.stringify(config, null, 2), "utf8");
  return { configPath, profile };
}
