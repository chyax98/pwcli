import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { appendRunEvent, ensureRunDir } from "../../fs/run-artifacts.js";
import { runManagedSessionCommand } from "../cli-client.js";
import { parseDownloadEvent, parsePageSummary, stripQuotes } from "../output-parsers.js";
import { managedRunCode } from "./code.js";
import { buildDiagnosticsDelta, captureDiagnosticsBaseline } from "./diagnostics.js";
import { maybeRawOutput, normalizeRef } from "./shared.js";
import { managedPageCurrent } from "./workspace.js";

async function recordRun(
  command: string,
  sessionName: string | undefined,
  page: Record<string, unknown> | undefined,
  details: Record<string, unknown>,
) {
  const run = await ensureRunDir(sessionName);
  await appendRunEvent(run.runDir, {
    ts: new Date().toISOString(),
    command,
    sessionName: sessionName ?? null,
    pageId: typeof page?.pageId === "string" ? page.pageId : null,
    navigationId: typeof page?.navigationId === "string" ? page.navigationId : null,
    ...details,
  });
  return run;
}

export async function managedClick(options: {
  ref?: string;
  selector?: string;
  button?: string;
  sessionName?: string;
}) {
  if (!options.ref && !options.selector) {
    throw new Error("click requires a ref or selector");
  }

  const before = await captureDiagnosticsBaseline(options.sessionName);

  if (options.selector) {
    const button = options.button ? JSON.stringify({ button: options.button }) : "undefined";
    const result = await managedRunCode({
      sessionName: options.sessionName,
      source: `async page => {
        await page.locator(${JSON.stringify(options.selector)}).click(${button});
        return 'clicked';
      }`,
    });

    const diagnosticsDelta = await buildDiagnosticsDelta(options.sessionName, before);
    const run = await recordRun("click", options.sessionName, result.page, {
      target: { selector: options.selector },
      diagnosticsDelta,
    });
    return {
      session: result.session,
      page: result.page,
      data: {
        selector: options.selector,
        ...(options.button ? { button: options.button } : {}),
        acted: true,
        diagnosticsDelta,
        run,
      },
    };
  }

  const ref = normalizeRef(options.ref ?? "");
  const args = ["click", ref];
  if (options.button) {
    args.push(options.button);
  }

  const result = await runManagedSessionCommand(
    {
      _: args,
    },
    {
      sessionName: options.sessionName,
    },
  );

  const diagnosticsDelta = await buildDiagnosticsDelta(options.sessionName, before);
  const run = await recordRun("click", options.sessionName, parsePageSummary(result.text), {
    target: options.ref ? { ref: normalizeRef(options.ref) } : { selector: options.selector },
    diagnosticsDelta,
  });
  return {
    session: {
      scope: "managed",
      name: result.sessionName,
      default: result.sessionName === "default",
    },
    page: parsePageSummary(result.text),
    data: {
      ...(options.ref ? { ref: normalizeRef(options.ref) } : { selector: options.selector }),
      acted: true,
      diagnosticsDelta,
      run,
      ...maybeRawOutput(result.text),
    },
  };
}

export async function managedFill(options: {
  ref?: string;
  selector?: string;
  value: string;
  sessionName?: string;
}) {
  if (!options.ref && !options.selector) {
    throw new Error("fill requires a ref or selector");
  }

  const before = await captureDiagnosticsBaseline(options.sessionName);

  if (options.selector) {
    const result = await managedRunCode({
      sessionName: options.sessionName,
      source: `async page => {
        await page.locator(${JSON.stringify(options.selector)}).fill(${JSON.stringify(options.value)});
        return 'filled';
      }`,
    });

    const diagnosticsDelta = await buildDiagnosticsDelta(options.sessionName, before);
    const run = await recordRun("fill", options.sessionName, result.page, {
      target: { selector: options.selector },
      diagnosticsDelta,
    });
    return {
      session: result.session,
      page: result.page,
      data: {
        selector: options.selector,
        value: options.value,
        filled: true,
        diagnosticsDelta,
        run,
      },
    };
  }

  const result = await runManagedSessionCommand(
    {
      _: ["fill", normalizeRef(options.ref ?? ""), options.value],
    },
    {
      sessionName: options.sessionName,
    },
  );

  const diagnosticsDelta = await buildDiagnosticsDelta(options.sessionName, before);
  const run = await recordRun("fill", options.sessionName, parsePageSummary(result.text), {
    target: options.ref ? { ref: normalizeRef(options.ref) } : { selector: options.selector },
    diagnosticsDelta,
  });
  return {
    session: {
      scope: "managed",
      name: result.sessionName,
      default: result.sessionName === "default",
    },
    page: parsePageSummary(result.text),
    data: {
      ...(options.ref ? { ref: normalizeRef(options.ref) } : { selector: options.selector }),
      value: options.value,
      filled: true,
      diagnosticsDelta,
      run,
      ...maybeRawOutput(result.text),
    },
  };
}

export async function managedType(options: {
  ref?: string;
  selector?: string;
  value: string;
  sessionName?: string;
}) {
  const before = await captureDiagnosticsBaseline(options.sessionName);

  if (!options.ref && !options.selector) {
    const result = await runManagedSessionCommand(
      {
        _: ["type", options.value],
      },
      {
        sessionName: options.sessionName,
      },
    );
    const diagnosticsDelta = await buildDiagnosticsDelta(options.sessionName, before);
    const run = await recordRun("type", options.sessionName, parsePageSummary(result.text), {
      diagnosticsDelta,
    });
    return {
      session: {
        scope: "managed",
        name: result.sessionName,
        default: result.sessionName === "default",
      },
      page: parsePageSummary(result.text),
      data: {
        value: options.value,
        typed: true,
        diagnosticsDelta,
        run,
        ...maybeRawOutput(result.text),
      },
    };
  }

  const target = options.ref ? normalizeRef(options.ref) : options.selector;
  const source = options.ref
    ? `async page => { await page.locator(${JSON.stringify(`aria-ref=${target}`)}).type(${JSON.stringify(options.value)}); return 'typed'; }`
    : `async page => { await page.locator(${JSON.stringify(options.selector)}).type(${JSON.stringify(options.value)}); return 'typed'; }`;

  const result = await managedRunCode({ source, sessionName: options.sessionName });
  const diagnosticsDelta = await buildDiagnosticsDelta(options.sessionName, before);
  const run = await recordRun("type", options.sessionName, result.page, {
    target: options.ref ? { ref: normalizeRef(options.ref) } : { selector: options.selector },
    diagnosticsDelta,
  });
  return {
    session: result.session,
    page: result.page,
    data: {
      ...(options.ref ? { ref: normalizeRef(options.ref) } : { selector: options.selector }),
      value: options.value,
      typed: true,
      diagnosticsDelta,
      run,
      ...maybeRawOutput(result.data.output ?? ""),
    },
  };
}

export async function managedPress(key: string, options?: { sessionName?: string }) {
  const before = await captureDiagnosticsBaseline(options?.sessionName);
  const result = await runManagedSessionCommand(
    {
      _: ["press", key],
    },
    {
      sessionName: options?.sessionName,
    },
  );

  const diagnosticsDelta = await buildDiagnosticsDelta(options?.sessionName, before);
  const run = await recordRun("press", options?.sessionName, parsePageSummary(result.text), {
    key,
    diagnosticsDelta,
  });
  return {
    session: {
      scope: "managed",
      name: result.sessionName,
      default: result.sessionName === "default",
    },
    page: parsePageSummary(result.text),
    data: {
      key,
      pressed: true,
      diagnosticsDelta,
      run,
      ...maybeRawOutput(result.text),
    },
  };
}

export async function managedDialog(
  action: "accept" | "dismiss",
  options?: { prompt?: string; sessionName?: string },
) {
  const command = action === "accept" ? "dialog-accept" : "dialog-dismiss";
  const argv = action === "accept" && options?.prompt ? [command, options.prompt] : [command];
  const result = await runManagedSessionCommand(
    {
      _: argv,
    },
    {
      sessionName: options?.sessionName,
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
      action,
      handled: true,
      ...(options?.prompt ? { prompt: options.prompt } : {}),
      ...maybeRawOutput(result.text),
    },
  };
}

export async function managedScroll(options: {
  direction: "up" | "down" | "left" | "right";
  distance?: number;
  sessionName?: string;
}) {
  const distance = options.distance ?? 500;
  const delta = {
    up: [0, -distance],
    down: [0, distance],
    left: [-distance, 0],
    right: [distance, 0],
  }[options.direction];

  const before = await captureDiagnosticsBaseline(options.sessionName);
  const result = await managedRunCode({
    sessionName: options.sessionName,
    source: `async page => {
      await page.mouse.wheel(${delta[0]}, ${delta[1]});
      return JSON.stringify({ direction: ${JSON.stringify(options.direction)}, distance: ${distance} });
    }`,
  });

  const diagnosticsDelta = await buildDiagnosticsDelta(options.sessionName, before);
  const run = await recordRun("scroll", options.sessionName, result.page, {
    direction: options.direction,
    distance,
    diagnosticsDelta,
  });
  return {
    session: result.session,
    page: result.page,
    data: {
      direction: options.direction,
      distance,
      scrolled: true,
      diagnosticsDelta,
      run,
      ...maybeRawOutput(result.data.output ?? ""),
    },
  };
}

export async function managedScreenshot(options?: {
  ref?: string;
  selector?: string;
  path?: string;
  fullPage?: boolean;
  sessionName?: string;
}) {
  const run = await ensureRunDir(options?.sessionName);
  const defaultPath = join(run.runDir, `screenshot-${Date.now()}.png`);
  const target = options?.ref
    ? `page.locator(${JSON.stringify(`aria-ref=${normalizeRef(options.ref)}`)})`
    : options?.selector
      ? `page.locator(${JSON.stringify(options.selector)})`
      : "page";
  const method = options?.ref || options?.selector ? "screenshot" : "screenshot";
  const source = `async page => {
    const target = ${target};
    await target.${method}(${JSON.stringify({
      path: options?.path ?? defaultPath,
      ...(options?.fullPage && !options?.ref && !options?.selector ? { fullPage: true } : {}),
    })});
    return JSON.stringify({
      path: ${JSON.stringify(options?.path ?? defaultPath)},
      ${options?.ref ? `ref: ${JSON.stringify(normalizeRef(options.ref))},` : ""}
      ${options?.selector ? `selector: ${JSON.stringify(options.selector)},` : ""}
      ${options?.fullPage ? "fullPage: true," : ""}
    });
  }`;

  const result = await managedRunCode({
    sessionName: options?.sessionName,
    source,
  });
  const parsed =
    typeof result.data.result === "object" && result.data.result ? result.data.result : {};
  const pageMeta =
    result.page && typeof result.page === "object"
      ? (result.page as Record<string, unknown>)
      : undefined;
  await appendRunEvent(run.runDir, {
    ts: new Date().toISOString(),
    command: "screenshot",
    sessionName: options?.sessionName ?? null,
    pageId: typeof pageMeta?.pageId === "string" ? pageMeta.pageId : null,
    navigationId: typeof pageMeta?.navigationId === "string" ? pageMeta.navigationId : null,
    path: parsed.path ?? options?.path ?? defaultPath,
    ref: parsed.ref ?? null,
    selector: parsed.selector ?? null,
    fullPage: Boolean(parsed.fullPage),
  });
  return {
    session: result.session,
    page: result.page,
    data: {
      ...parsed,
      run,
      captured: true,
    },
  };
}

export async function managedUpload(options: {
  ref?: string;
  selector?: string;
  files: string[];
  sessionName?: string;
}) {
  const files = options.files.map((file) => JSON.stringify(resolve(file))).join(", ");
  const target = options.ref
    ? `page.locator(${JSON.stringify(`aria-ref=${normalizeRef(options.ref)}`)})`
    : `page.locator(${JSON.stringify(options.selector)})`;
  if (!options.ref && !options.selector) {
    throw new Error("upload requires a ref or selector");
  }

  const before = await captureDiagnosticsBaseline(options.sessionName);
  const result = await managedRunCode({
    sessionName: options.sessionName,
    source: `async page => {
      await ${target}.setInputFiles([${files}]);
      return JSON.stringify({ uploaded: true });
    }`,
  });
  const diagnosticsDelta = await buildDiagnosticsDelta(options.sessionName, before);
  const run = await recordRun("upload", options.sessionName, result.page, {
    target: options.ref ? { ref: normalizeRef(options.ref) } : { selector: options.selector },
    files: options.files.map((file) => resolve(file)),
    diagnosticsDelta,
  });
  return {
    session: result.session,
    page: result.page,
    data: {
      ...(options.ref ? { ref: normalizeRef(options.ref) } : { selector: options.selector }),
      files: options.files.map((file) => resolve(file)),
      uploaded: true,
      diagnosticsDelta,
      run,
    },
  };
}

export async function managedDrag(options: {
  fromRef?: string;
  toRef?: string;
  fromSelector?: string;
  toSelector?: string;
  sessionName?: string;
}) {
  const source = options.fromRef
    ? `page.locator(${JSON.stringify(`aria-ref=${normalizeRef(options.fromRef)}`)})`
    : `page.locator(${JSON.stringify(options.fromSelector)})`;
  const target = options.toRef
    ? `page.locator(${JSON.stringify(`aria-ref=${normalizeRef(options.toRef)}`)})`
    : `page.locator(${JSON.stringify(options.toSelector)})`;

  if ((!options.fromRef && !options.fromSelector) || (!options.toRef && !options.toSelector)) {
    throw new Error("drag requires source and target");
  }

  const before = await captureDiagnosticsBaseline(options.sessionName);
  const result = await managedRunCode({
    sessionName: options.sessionName,
    source: `async page => {
      await ${source}.dragTo(${target});
      return JSON.stringify({ dragged: true });
    }`,
  });

  const diagnosticsDelta = await buildDiagnosticsDelta(options.sessionName, before);
  const run = await recordRun("drag", options.sessionName, result.page, {
    diagnosticsDelta,
  });
  return {
    session: result.session,
    page: result.page,
    data: {
      ...(options.fromRef
        ? { fromRef: normalizeRef(options.fromRef) }
        : { fromSelector: options.fromSelector }),
      ...(options.toRef
        ? { toRef: normalizeRef(options.toRef) }
        : { toSelector: options.toSelector }),
      dragged: true,
      diagnosticsDelta,
      run,
    },
  };
}

export async function managedDownload(options: {
  ref?: string;
  selector?: string;
  path?: string;
  dir?: string;
  sessionName?: string;
}) {
  if (!options.ref && !options.selector) {
    throw new Error("download requires a ref or selector");
  }
  const target = options.ref
    ? `page.locator(${JSON.stringify(`aria-ref=${normalizeRef(options.ref)}`)})`
    : `page.locator(${JSON.stringify(options.selector)})`;

  const run = await ensureRunDir(options.sessionName);
  const dir = options.dir ? resolve(options.dir) : undefined;
  const exactPath = options.path ? resolve(options.path) : undefined;
  if (dir) {
    await mkdir(dir, { recursive: true });
  }
  if (exactPath) {
    await mkdir(dirname(exactPath), { recursive: true });
  }

  const before = await captureDiagnosticsBaseline(options.sessionName);
  const result = await managedRunCode({
    sessionName: options.sessionName,
    source: `async page => {
      await ${target}.click();
      return 'clicked';
    }`,
  });
  const downloadEvent = parseDownloadEvent(result.rawText ?? "");
  if (!downloadEvent) {
    throw new Error("No download event captured");
  }
  const sourcePath = resolve(downloadEvent.outputPath);
  const savedAs = dir
    ? join(dir, downloadEvent.suggestedFilename)
    : (exactPath ?? join(run.runDir, downloadEvent.suggestedFilename));
  if (savedAs) {
    await copyFile(sourcePath, savedAs);
  }
  const diagnosticsDelta = await buildDiagnosticsDelta(options.sessionName, before);
  await appendRunEvent(run.runDir, {
    ts: new Date().toISOString(),
    command: "download",
    sessionName: options.sessionName ?? null,
    suggestedFilename: downloadEvent.suggestedFilename,
    sourcePath,
    savedAs,
    diagnosticsDelta,
  });

  return {
    session: result.session,
    page: result.page,
    data: {
      ...(options.ref ? { ref: normalizeRef(options.ref) } : { selector: options.selector }),
      ...(dir ? { dir } : {}),
      ...(exactPath ? { requestedPath: exactPath } : {}),
      suggestedFilename: downloadEvent.suggestedFilename,
      sourcePath,
      ...(savedAs ? { savedAs } : {}),
      downloaded: true,
      diagnosticsDelta,
      run,
    },
  };
}

export async function managedReadText(options?: {
  selector?: string;
  maxChars?: number;
  sessionName?: string;
}) {
  const source = options?.selector
    ? `async page => {
      const text = await page.locator(${JSON.stringify(options.selector)}).innerText().catch(() => '');
      return JSON.stringify({ source: 'selector', selector: ${JSON.stringify(options.selector)}, text });
    }`
    : `async page => {
      const text = await page.evaluate(() => document.body?.innerText ?? '');
      return JSON.stringify({ source: 'body-visible', text });
    }`;

  const result = await managedRunCode({ source, sessionName: options?.sessionName });
  const parsed = result.data.result || {};
  const rawText = parsed.text ?? "";
  const text =
    options?.maxChars !== undefined && rawText.length > options.maxChars
      ? rawText.slice(0, options.maxChars)
      : rawText;

  return {
    session: result.session,
    page: result.page,
    data: {
      ...parsed,
      text,
      truncated: text.length !== rawText.length,
      charCount: text.length,
      totalCharCount: rawText.length,
      ...maybeRawOutput(result.data.output ?? ""),
    },
  };
}

export async function managedWait(options: {
  target?: string;
  text?: string;
  selector?: string;
  networkidle?: boolean;
  request?: string;
  response?: string;
  method?: string;
  status?: string;
  sessionName?: string;
}) {
  let source = "";

  if (options.target && /^\d+$/.test(options.target)) {
    source = `async page => { await page.waitForTimeout(${Number(options.target)}); return 'delay'; }`;
  } else if (options.request) {
    source = `async page => {
      const request = await page.waitForRequest(request => {
        if (!request.url().includes(${JSON.stringify(options.request)}))
          return false;
        ${options.method ? `if (request.method() !== ${JSON.stringify(options.method.toUpperCase())}) return false;` : ""}
        return true;
      });
      return JSON.stringify({ kind: 'request', url: request.url(), method: request.method() });
    }`;
  } else if (options.response) {
    source = `async page => {
      const response = await page.waitForResponse(response => {
        if (!response.url().includes(${JSON.stringify(options.response)}))
          return false;
        ${options.method ? `if (response.request().method() !== ${JSON.stringify(options.method.toUpperCase())}) return false;` : ""}
        ${options.status ? `if (String(response.status()) !== ${JSON.stringify(options.status)}) return false;` : ""}
        return true;
      });
      return JSON.stringify({ kind: 'response', url: response.url(), method: response.request().method(), status: response.status() });
    }`;
  } else if (options.networkidle) {
    source = `async page => { await page.waitForLoadState('networkidle'); return 'networkidle'; }`;
  } else if (options.selector) {
    source = `async page => { await page.locator(${JSON.stringify(options.selector)}).waitFor(); return 'selector'; }`;
  } else if (options.text) {
    source = `async page => { await page.getByText(${JSON.stringify(options.text)}, { exact: true }).waitFor(); return 'text'; }`;
  } else if (options.target) {
    source = `async page => { await page.locator(${JSON.stringify(`aria-ref=${normalizeRef(options.target)}`)}).waitFor(); return 'ref'; }`;
  } else {
    throw new Error("wait requires a condition");
  }

  const before = await captureDiagnosticsBaseline(options.sessionName);
  const result = await managedRunCode({ source, sessionName: options.sessionName });
  const diagnosticsDelta = await buildDiagnosticsDelta(options.sessionName, before);
  const run = await recordRun("wait", options.sessionName, result.page, {
    diagnosticsDelta,
  });

  return {
    session: result.session,
    page: await managedPageCurrent({ sessionName: options.sessionName }).then(
      (pageResult) => pageResult.page,
    ),
    data: {
      condition:
        typeof result.data.result === "string"
          ? stripQuotes(result.data.result)
          : typeof result.data.result === "object" && result.data.result
            ? result.data.result
            : String(result.data.result ?? ""),
      matched: true,
      diagnosticsDelta,
      run,
      ...maybeRawOutput(result.data.output ?? ""),
    },
  };
}
