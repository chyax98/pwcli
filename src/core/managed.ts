import { copyFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { runManagedSessionCommand } from "../session/cli-client.js";
import {
  parseConsoleSummary,
  parseDownloadEvent,
  parseErrorText,
  parseJsonStringLiteral,
  parseNetworkSummary,
  parsePageSummary,
  parseResultText,
  parseSnapshotYaml,
  stripQuotes,
} from "../session/output-parsers.js";

function maybeRawOutput(text: string) {
  return process.env.PWCLI_RAW_OUTPUT === "1" ? { output: text } : {};
}

function normalizeRef(ref: string) {
  return ref.startsWith("@") ? ref.slice(1) : ref;
}

export async function managedOpen(
  url: string,
  options?: {
    sessionName?: string;
    headed?: boolean;
    reset?: boolean;
    profile?: string;
    persistent?: boolean;
    endpoint?: string;
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
      createIfMissing: true,
    },
  );

  const page = parsePageSummary(result.text);
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
      ...maybeRawOutput(result.text),
    },
  };
}

export async function managedSnapshot(options?: { depth?: number; sessionName?: string }) {
  const args = ["snapshot"];
  if (options?.depth) {
    args.push(`--depth=${options.depth}`);
  }
  const result = await runManagedSessionCommand(
    {
      _: args,
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
      mode: "ai",
      snapshot: parseSnapshotYaml(result.text),
      ...maybeRawOutput(result.text),
    },
  };
}

export async function managedRunCode(options: {
  source?: string;
  file?: string;
  sessionName?: string;
}) {
  const args = ["run-code"];
  let source = options.source;
  let filename: string | undefined;
  if (options.file) {
    filename = resolve(options.file);
    source = await readFile(filename, "utf8");
  }
  if (source) {
    args.push(source);
  }
  const result = await runManagedSessionCommand(
    {
      _: args,
      ...(filename ? { filename } : {}),
    },
    {
      sessionName: options.sessionName,
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
      ...maybeRawOutput(result.text),
    },
  };
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

  if (options.selector) {
    const button = options.button ? JSON.stringify({ button: options.button }) : "undefined";
    const result = await managedRunCode({
      sessionName: options.sessionName,
      source: `async page => {
        await page.locator(${JSON.stringify(options.selector)}).click(${button});
        return 'clicked';
      }`,
    });

    return {
      session: result.session,
      page: result.page,
      data: {
        selector: options.selector,
        ...(options.button ? { button: options.button } : {}),
        acted: true,
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

  if (options.selector) {
    const result = await managedRunCode({
      sessionName: options.sessionName,
      source: `async page => {
        await page.locator(${JSON.stringify(options.selector)}).fill(${JSON.stringify(options.value)});
        return 'filled';
      }`,
    });

    return {
      session: result.session,
      page: result.page,
      data: {
        selector: options.selector,
        value: options.value,
        filled: true,
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
  if (!options.ref && !options.selector) {
    const result = await runManagedSessionCommand(
      {
        _: ["type", options.value],
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
        value: options.value,
        typed: true,
        ...maybeRawOutput(result.text),
      },
    };
  }

  const target = options.ref ? normalizeRef(options.ref) : options.selector;
  const source = options.ref
    ? `async page => { await page.locator(${JSON.stringify(`aria-ref=${target}`)}).type(${JSON.stringify(options.value)}); return 'typed'; }`
    : `async page => { await page.locator(${JSON.stringify(options.selector)}).type(${JSON.stringify(options.value)}); return 'typed'; }`;

  const result = await managedRunCode({ source, sessionName: options.sessionName });
  return {
    session: result.session,
    page: result.page,
    data: {
      ...(options.ref ? { ref: normalizeRef(options.ref) } : { selector: options.selector }),
      value: options.value,
      typed: true,
      ...maybeRawOutput(result.data.output ?? ""),
    },
  };
}

export async function managedPress(key: string, options?: { sessionName?: string }) {
  const result = await runManagedSessionCommand(
    {
      _: ["press", key],
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
      key,
      pressed: true,
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

  const result = await managedRunCode({
    sessionName: options.sessionName,
    source: `async page => {
      await page.mouse.wheel(${delta[0]}, ${delta[1]});
      return JSON.stringify({ direction: ${JSON.stringify(options.direction)}, distance: ${distance} });
    }`,
  });

  return {
    session: result.session,
    page: result.page,
    data: {
      direction: options.direction,
      distance,
      scrolled: true,
      ...maybeRawOutput(result.data.output ?? ""),
    },
  };
}

export async function managedStateSave(file?: string, options?: { sessionName?: string }) {
  const args = ["state-save"];
  if (file) {
    args.push(file);
  }
  const result = await runManagedSessionCommand(
    {
      _: args,
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
      path: file,
      saved: true,
      ...maybeRawOutput(result.text),
    },
  };
}

export async function managedStateLoad(file: string, options?: { sessionName?: string }) {
  const result = await runManagedSessionCommand(
    {
      _: ["state-load", file],
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
      path: file,
      loaded: true,
      ...maybeRawOutput(result.text),
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
  const target = options?.ref
    ? `page.locator(${JSON.stringify(`aria-ref=${normalizeRef(options.ref)}`)})`
    : options?.selector
      ? `page.locator(${JSON.stringify(options.selector)})`
      : "page";
  const method = options?.ref || options?.selector ? "screenshot" : "screenshot";
  const source = `async page => {
    const target = ${target};
    await target.${method}(${JSON.stringify({
      ...(options?.path ? { path: options.path } : {}),
      ...(options?.fullPage && !options?.ref && !options?.selector ? { fullPage: true } : {}),
    })});
    return JSON.stringify({
      path: ${JSON.stringify(options?.path ?? "")},
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
  return {
    session: result.session,
    page: result.page,
    data: {
      ...parsed,
      captured: true,
    },
  };
}

export async function managedTrace(action: "start" | "stop", options?: { sessionName?: string }) {
  const command = action === "start" ? "tracing-start" : "tracing-stop";
  const result = await runManagedSessionCommand(
    {
      _: [command],
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
      started: action === "start" ? true : undefined,
      stopped: action === "stop" ? true : undefined,
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

  const result = await managedRunCode({
    sessionName: options.sessionName,
    source: `async page => {
      await ${target}.setInputFiles([${files}]);
      return JSON.stringify({ uploaded: true });
    }`,
  });
  return {
    session: result.session,
    page: result.page,
    data: {
      ...(options.ref ? { ref: normalizeRef(options.ref) } : { selector: options.selector }),
      files: options.files.map((file) => resolve(file)),
      uploaded: true,
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

  const result = await managedRunCode({
    sessionName: options.sessionName,
    source: `async page => {
      await ${source}.dragTo(${target});
      return JSON.stringify({ dragged: true });
    }`,
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

  const dir = options.dir ? resolve(options.dir) : undefined;
  const exactPath = options.path ? resolve(options.path) : undefined;
  if (dir) {
    await mkdir(dir, { recursive: true });
  }
  if (exactPath) {
    await mkdir(dirname(exactPath), { recursive: true });
  }

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
  const savedAs = dir ? join(dir, downloadEvent.suggestedFilename) : exactPath;
  if (savedAs) {
    await copyFile(sourcePath, savedAs);
  }

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
      ...maybeRawOutput(result.data.output ?? ""),
    },
  };
}

export async function managedPageCurrent(options?: { sessionName?: string }) {
  const result = await managedRunCode({
    sessionName: options?.sessionName,
    source: `async page => {
      return JSON.stringify({
        url: page.url(),
        title: await page.title(),
        pageCount: page.context().pages().length,
      });
    }`,
  });
  const parsed = result.data.result || {};
  return {
    session: result.session,
    page: {
      id: "p1",
      url: parsed.url ?? "",
      title: parsed.title ?? "",
      current: true,
    },
    data: {
      activePageId: "p1",
      pageCount: parsed.pageCount ?? 1,
      pages: [
        {
          id: "p1",
          url: parsed.url ?? "",
          title: parsed.title ?? "",
          current: true,
        },
      ],
      ...maybeRawOutput(result.data.output ?? ""),
    },
  };
}

export async function managedPageList(options?: { sessionName?: string }) {
  const result = await managedRunCode({
    sessionName: options?.sessionName,
    source: `async page => {
      const pages = page.context().pages();
      const current = page;
      return JSON.stringify({
        pages: await Promise.all(pages.map(async (p, index) => ({
          id: 'p' + (index + 1),
          url: p.url(),
          title: await p.title().catch(() => ''),
          current: p === current,
        }))),
      });
    }`,
  });
  const parsed = result.data.result || {};
  const current = parsed.pages?.find((entry) => entry.current) ?? parsed.pages?.[0];

  return {
    session: result.session,
    page: current,
    data: {
      activePageId: current?.id ?? "p1",
      pageCount: parsed.pages?.length ?? 0,
      pages: parsed.pages ?? [],
      ...maybeRawOutput(result.data.output ?? ""),
    },
  };
}

export async function managedPageFrames(options?: { sessionName?: string }) {
  const result = await managedRunCode({
    sessionName: options?.sessionName,
    source: `async page => {
      const frames = page.frames().map((frame, index) => ({
        index,
        url: frame.url(),
        name: frame.name(),
        main: frame === page.mainFrame(),
      }));
      return JSON.stringify({ frames });
    }`,
  });
  const parsed = result.data.result || {};
  return {
    session: result.session,
    page: result.page,
    data: {
      activePageId: "p1",
      frameCount: parsed.frames?.length ?? 0,
      frames: parsed.frames ?? [],
      ...maybeRawOutput(result.data.output ?? ""),
    },
  };
}

export async function managedConsole(level?: string, options?: { sessionName?: string }) {
  const args = ["console"];
  if (level) {
    args.push(level);
  }
  const result = await runManagedSessionCommand(
    {
      _: args,
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
      summary: parseConsoleSummary(result.text),
      ...maybeRawOutput(result.text),
    },
  };
}

export async function managedNetwork(options?: { sessionName?: string }) {
  const result = await runManagedSessionCommand(
    {
      _: ["network"],
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
      summary: parseNetworkSummary(result.text),
      ...maybeRawOutput(result.text),
    },
  };
}

export async function managedWait(options: {
  target?: string;
  text?: string;
  selector?: string;
  networkidle?: boolean;
  sessionName?: string;
}) {
  let source = "";

  if (options.target && /^\d+$/.test(options.target)) {
    source = `async page => { await page.waitForTimeout(${Number(options.target)}); return 'delay'; }`;
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

  const result = await managedRunCode({ source, sessionName: options.sessionName });

  return {
    session: result.session,
    page: await managedPageCurrent({ sessionName: options.sessionName }).then(
      (pageResult) => pageResult.page,
    ),
    data: {
      condition:
        typeof result.data.result === "string"
          ? stripQuotes(result.data.result)
          : String(result.data.result ?? ""),
      matched: true,
      ...maybeRawOutput(result.data.output ?? ""),
    },
  };
}
