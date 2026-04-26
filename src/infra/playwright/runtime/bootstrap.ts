import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { managedRunCode } from "./code.js";
import { DIAGNOSTICS_STATE_KEY } from "./shared.js";

export async function managedBootstrapApply(options: {
  sessionName?: string;
  initScripts?: string[];
  headersFile?: string;
}) {
  const initScripts = options.initScripts?.map((file) => resolve(file)) ?? [];
  let headers: Record<string, string> | undefined;
  let headersFile: string | undefined;

  if (options.headersFile) {
    headersFile = resolve(options.headersFile);
    const parsed = JSON.parse(await readFile(headersFile, "utf8")) as Record<string, unknown>;
    headers = Object.fromEntries(
      Object.entries(parsed).map(([key, value]) => [key, String(value)]),
    );
  }

  const scriptContents = await Promise.all(initScripts.map((file) => readFile(file, "utf8")));
  const source = `async page => {
    const context = page.context();
    const state = context[${JSON.stringify(DIAGNOSTICS_STATE_KEY)}] ||= {};
    ${headers ? `await context.setExtraHTTPHeaders(${JSON.stringify(headers)});` : ""}
    ${scriptContents
      .map((content) => `await context.addInitScript({ content: ${JSON.stringify(content)} });`)
      .join("\n    ")}
    state.bootstrap = {
      applied: true,
      updatedAt: new Date().toISOString(),
      initScriptCount: ${initScripts.length},
      initScripts: ${JSON.stringify(initScripts)},
      headersApplied: ${headers ? "true" : "false"},
      ${headersFile ? `headersFile: ${JSON.stringify(headersFile)},` : ""}
    };
    return JSON.stringify({
      applied: true,
      initScriptCount: ${initScripts.length},
      ${headers ? `headersApplied: true,` : `headersApplied: false,`}
      bootstrap: state.bootstrap,
    });
  }`;

  const result = await managedRunCode({
    sessionName: options.sessionName,
    source,
  });
  const parsed =
    typeof result.data.result === "object" && result.data.result ? result.data.result : {};

  return {
    session: result.session,
    page: result.page,
    data: {
      applied: true,
      initScriptCount: initScripts.length,
      initScripts,
      ...(headersFile ? { headersFile } : {}),
      ...(headers ? { headersApplied: true } : {}),
      ...parsed,
    },
  };
}
