import net from "node:net";
import { networkInterfaces } from "node:os";

const FORGE_DEV_BASE_PORT = 4110;
const FORGE_DEV_RANGE = 3;
const FORGE_SUBDOMAIN = "developer";
const DEFAULT_SMS_CODE = "000000";

export async function resolveDcLoginArgs(
  pluginArgs: Record<string, string>,
  options?: {
    portProbe?: (port: number) => Promise<boolean>;
    localIpResolver?: () => string;
  },
): Promise<Record<string, string>> {
  const portProbe = options?.portProbe ?? isLocalPortOpen;
  const localIpResolver = options?.localIpResolver ?? getLocalIp;
  const phone = pickFirst(pluginArgs.phone) ?? "";
  const smsCode = pickFirst(pluginArgs.smsCode) ?? DEFAULT_SMS_CODE;

  if (!phone) {
    throw new Error("dc-login requires --arg phone=<number>");
  }

  const explicitTargetUrl = pickFirst(pluginArgs.targetUrl);
  if (explicitTargetUrl) {
    return {
      ...pluginArgs,
      phone,
      smsCode,
      targetUrl: explicitTargetUrl,
      baseURL: normalizeBaseURL(explicitTargetUrl),
    };
  }

  const explicitBaseURL = pickFirst(pluginArgs.baseURL);
  if (explicitBaseURL) {
    return {
      ...pluginArgs,
      phone,
      smsCode,
      baseURL: normalizeBaseURL(explicitBaseURL),
    };
  }

  const instance = parseInstance(pickFirst(pluginArgs.instance));
  const localIp = localIpResolver();

  if (instance !== undefined) {
    if (!(await portProbe(FORGE_DEV_BASE_PORT + instance))) {
      throw new Error(
        `dc-login instance ${instance} is not running. Start Forge dev or pass --arg baseURL=<url>.`,
      );
    }
    return {
      ...pluginArgs,
      phone,
      smsCode,
      baseURL: buildDcLoginBaseURL(localIp, instance),
      instance: String(instance),
    };
  }

  const runningInstances = await detectRunningForgeInstances(portProbe);
  if (runningInstances.length === 1) {
    return {
      ...pluginArgs,
      phone,
      smsCode,
      baseURL: buildDcLoginBaseURL(localIp, runningInstances[0]),
      instance: String(runningInstances[0]),
    };
  }

  if (runningInstances.length > 1) {
    throw new Error(
      `dc-login found multiple running Forge dev instances (${runningInstances.join(", ")}). Pass --arg instance=<0|1|2> or --arg baseURL=<url>.`,
    );
  }

  throw new Error(
    "dc-login could not resolve baseURL automatically. Pass --arg targetUrl=<url>, --arg baseURL=<url>, or --arg instance=<0|1|2>.",
  );
}

function pickFirst(...values: Array<string | undefined>) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function parseInstance(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0 || parsed >= FORGE_DEV_RANGE) {
    throw new Error(`dc-login instance '${value}' is invalid. Use 0 | 1 | 2.`);
  }
  return parsed;
}

function normalizeBaseURL(raw: string) {
  const normalized = new URL(raw);
  return `${normalized.protocol}//${normalized.host}`;
}

function buildDcLoginBaseURL(localIp: string, instance: number) {
  const label = localIp.replace(/\./g, "-");
  const subdomain = instance > 0 ? `${FORGE_SUBDOMAIN}-p${instance}` : FORGE_SUBDOMAIN;
  return `https://${subdomain}-${label}.tap.dev`;
}

async function detectRunningForgeInstances(portProbe: (port: number) => Promise<boolean>) {
  const results: number[] = [];
  for (let index = 0; index < FORGE_DEV_RANGE; index += 1) {
    const port = FORGE_DEV_BASE_PORT + index;
    if (await portProbe(port)) {
      results.push(index);
    }
  }
  return results;
}

async function isLocalPortOpen(port: number): Promise<boolean> {
  return await new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    const finish = (value: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(200);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

function isPrivateIpv4(address: string) {
  return (
    /^10\./.test(address) ||
    /^192\.168\./.test(address) ||
    /^172\.(?:1[6-9]|2\d|3[01])\./.test(address)
  );
}

function getLocalIp() {
  const candidates = Object.entries(networkInterfaces()).flatMap(([name, addresses]) =>
    (addresses ?? [])
      .filter((address) => address.family === "IPv4" && !address.internal)
      .map((address) => ({ name, address: address.address })),
  );

  const preferred = candidates.find(
    (candidate) => /^(?:en|eth|wlan)/.test(candidate.name) && isPrivateIpv4(candidate.address),
  );

  return (
    preferred?.address ??
    candidates.find((candidate) => isPrivateIpv4(candidate.address))?.address ??
    "127.0.0.1"
  );
}
