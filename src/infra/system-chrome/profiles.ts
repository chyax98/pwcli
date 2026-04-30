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
