import { runManagedSessionCommand } from "../cli-client.js";
import { parsePageSummary } from "../output-parsers.js";
import { managedEnsureDiagnosticsHooks } from "./hooks.js";
import { maybeRawOutput } from "./shared.js";

export async function managedOpen(
  url: string,
  options?: {
    sessionName?: string;
    headed?: boolean;
    reset?: boolean;
    profile?: string;
    persistent?: boolean;
    endpoint?: string;
    config?: string;
  },
) {
  const result = await runManagedSessionCommand(
    {
      _: ["goto", url],
    },
    {
      sessionName: options?.sessionName,
      headed: options?.headed,
      reset: options?.reset ?? true,
      profile: options?.profile,
      persistent: options?.persistent,
      endpoint: options?.endpoint,
      config: options?.config,
      createIfMissing: true,
    },
  );

  const page = parsePageSummary(result.text);
  await managedEnsureDiagnosticsHooks({ sessionName: options?.sessionName }).catch(() => {});
  return {
    session: {
      scope: "managed",
      name: result.sessionName,
      default: result.sessionName === "default",
    },
    page,
    data: {
      navigated: true,
      ...(options?.profile ? { profile: options.profile } : {}),
      ...(options?.persistent ? { persistent: true } : {}),
      ...(options?.endpoint ? { endpoint: options.endpoint } : {}),
      ...(options?.config ? { config: options.config } : {}),
      ...maybeRawOutput(result.text),
    },
  };
}

export async function managedResize(options: {
  sessionName?: string;
  width: number;
  height: number;
  view?: string;
  preset?: string;
}) {
  const result = await runManagedSessionCommand(
    {
      _: ["resize", String(options.width), String(options.height)],
    },
    {
      sessionName: options.sessionName,
    },
  );

  return {
    session: {
      scope: "managed",
      name: result.sessionName,
      default: result.sessionName === "default",
    },
    page: parsePageSummary(result.text),
    data: {
      width: options.width,
      height: options.height,
      ...(options.view ? { view: options.view } : {}),
      ...(options.preset ? { preset: options.preset } : {}),
      resized: true,
      ...maybeRawOutput(result.text),
    },
  };
}
