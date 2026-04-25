import {
  parseJsonStringLiteral,
  parsePageSummary,
  parseResultText,
  parseSnapshotYaml,
  stripQuotes,
} from '../session/output-parsers.js';
import { runManagedSessionCommand } from '../session/cli-client.js';
import { resolve } from 'node:path';

function maybeRawOutput(text: string) {
  return process.env.PWCLI_RAW_OUTPUT === '1' ? { output: text } : {};
}

function normalizeRef(ref: string) {
  return ref.startsWith('@') ? ref.slice(1) : ref;
}

export async function managedOpen(
  url: string,
  options?: {
    headed?: boolean;
    reset?: boolean;
    profile?: string;
    persistent?: boolean;
    endpoint?: string;
  },
) {
  const result = await runManagedSessionCommand(
    {
      _: ['goto', url],
    },
    {
      headed: options?.headed,
      reset: options?.reset ?? true,
      profile: options?.profile,
      persistent: options?.persistent,
      endpoint: options?.endpoint,
    },
  );

  const page = parsePageSummary(result.text);
  return {
    session: {
      scope: 'managed',
      name: result.sessionName,
      default: result.sessionName === 'default',
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

export async function managedSnapshot(options?: { depth?: number }) {
  const args = ['snapshot'];
  if (options?.depth) {
    args.push(`--depth=${options.depth}`);
  }
  const result = await runManagedSessionCommand({
    _: args,
  });
  return {
    session: {
      scope: 'managed',
      name: result.sessionName,
      default: result.sessionName === 'default',
    },
    page: parsePageSummary(result.text),
    data: {
      mode: 'ai',
      snapshot: parseSnapshotYaml(result.text),
      ...maybeRawOutput(result.text),
    },
  };
}

export async function managedRunCode(options: { source?: string; file?: string }) {
  const args = ['run-code'];
  if (options.file) {
    args.push(`--filename=${options.file}`);
  }
  if (options.source) {
    args.push(options.source);
  }
  const result = await runManagedSessionCommand({
    _: args,
  });
  const resultText = parseResultText(result.text);
  return {
    session: {
      scope: 'managed',
      name: result.sessionName,
      default: result.sessionName === 'default',
    },
    page: parsePageSummary(result.text),
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
}) {
  const target = options.ref ? normalizeRef(options.ref) : options.selector;
  if (!target) {
    throw new Error('click requires a ref or selector');
  }

  const args = ['click', target];
  if (options.button) {
    args.push(options.button);
  }

  const result = await runManagedSessionCommand({
    _: args,
  });

  return {
    session: {
      scope: 'managed',
      name: result.sessionName,
      default: result.sessionName === 'default',
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
}) {
  const target = options.ref ? normalizeRef(options.ref) : options.selector;
  if (!target) {
    throw new Error('fill requires a ref or selector');
  }

  const result = await runManagedSessionCommand({
    _: ['fill', target, options.value],
  });

  return {
    session: {
      scope: 'managed',
      name: result.sessionName,
      default: result.sessionName === 'default',
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
}) {
  if (!options.ref && !options.selector) {
    const result = await runManagedSessionCommand({
      _: ['type', options.value],
    });
    return {
      session: {
        scope: 'managed',
        name: result.sessionName,
        default: result.sessionName === 'default',
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

  const result = await managedRunCode({ source });
  return {
    session: result.session,
    page: result.page,
    data: {
      ...(options.ref ? { ref: normalizeRef(options.ref) } : { selector: options.selector }),
      value: options.value,
      typed: true,
      ...maybeRawOutput(result.data.output ?? ''),
    },
  };
}

export async function managedPress(key: string) {
  const result = await runManagedSessionCommand({
    _: ['press', key],
  });

  return {
    session: {
      scope: 'managed',
      name: result.sessionName,
      default: result.sessionName === 'default',
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
  direction: 'up' | 'down' | 'left' | 'right';
  distance?: number;
}) {
  const distance = options.distance ?? 500;
  const delta = {
    up: [0, -distance],
    down: [0, distance],
    left: [-distance, 0],
    right: [distance, 0],
  }[options.direction];

  const result = await managedRunCode({
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
      ...maybeRawOutput(result.data.output ?? ''),
    },
  };
}

export async function managedStateSave(file?: string) {
  const args = ['state-save'];
  if (file) {
    args.push(file);
  }
  const result = await runManagedSessionCommand({
    _: args,
  });
  return {
    session: {
      scope: 'managed',
      name: result.sessionName,
      default: result.sessionName === 'default',
    },
    page: parsePageSummary(result.text),
    data: {
      path: file,
      saved: true,
      ...maybeRawOutput(result.text),
    },
  };
}

export async function managedStateLoad(file: string) {
  const result = await runManagedSessionCommand({
    _: ['state-load', file],
  });
  return {
    session: {
      scope: 'managed',
      name: result.sessionName,
      default: result.sessionName === 'default',
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
}) {
  const target = options?.ref
    ? `page.locator(${JSON.stringify(`aria-ref=${normalizeRef(options.ref)}`)})`
    : options?.selector
      ? `page.locator(${JSON.stringify(options.selector)})`
      : 'page';
  const method = options?.ref || options?.selector ? 'screenshot' : 'screenshot';
  const source = `async page => {
    const target = ${target};
    await target.${method}(${JSON.stringify({
      ...(options?.path ? { path: options.path } : {}),
      ...(options?.fullPage && !options?.ref && !options?.selector ? { fullPage: true } : {}),
    })});
    return JSON.stringify({
      path: ${JSON.stringify(options?.path ?? '')},
      ${options?.ref ? `ref: ${JSON.stringify(normalizeRef(options.ref))},` : ''}
      ${options?.selector ? `selector: ${JSON.stringify(options.selector)},` : ''}
      ${options?.fullPage ? 'fullPage: true,' : ''}
    });
  }`;

  const result = await managedRunCode({
    source,
  });
  const parsed =
    typeof result.data.result === 'object' && result.data.result ? result.data.result : {};
  return {
    session: result.session,
    page: result.page,
    data: {
      ...parsed,
      captured: true,
    },
  };
}

export async function managedTrace(action: 'start' | 'stop') {
  const command = action === 'start' ? 'tracing-start' : 'tracing-stop';
  const result = await runManagedSessionCommand({
    _: [command],
  });

  return {
    session: {
      scope: 'managed',
      name: result.sessionName,
      default: result.sessionName === 'default',
    },
    page: parsePageSummary(result.text),
    data: {
      action,
      started: action === 'start' ? true : undefined,
      stopped: action === 'stop' ? true : undefined,
      ...maybeRawOutput(result.text),
    },
  };
}

export async function managedUpload(options: {
  ref?: string;
  selector?: string;
  files: string[];
}) {
  const files = options.files.map((file) => JSON.stringify(resolve(file))).join(', ');
  const target = options.ref
    ? `page.locator(${JSON.stringify(`aria-ref=${normalizeRef(options.ref)}`)})`
    : `page.locator(${JSON.stringify(options.selector)})`;
  if (!options.ref && !options.selector) {
    throw new Error('upload requires a ref or selector');
  }

  const result = await managedRunCode({
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
}) {
  const source = options.fromRef
    ? `page.locator(${JSON.stringify(`aria-ref=${normalizeRef(options.fromRef)}`)})`
    : `page.locator(${JSON.stringify(options.fromSelector)})`;
  const target = options.toRef
    ? `page.locator(${JSON.stringify(`aria-ref=${normalizeRef(options.toRef)}`)})`
    : `page.locator(${JSON.stringify(options.toSelector)})`;

  if ((!options.fromRef && !options.fromSelector) || (!options.toRef && !options.toSelector)) {
    throw new Error('drag requires source and target');
  }

  const result = await managedRunCode({
    source: `async page => {
      await ${source}.dragTo(${target});
      return JSON.stringify({ dragged: true });
    }`,
  });

  return {
    session: result.session,
    page: result.page,
    data: {
      ...(options.fromRef ? { fromRef: normalizeRef(options.fromRef) } : { fromSelector: options.fromSelector }),
      ...(options.toRef ? { toRef: normalizeRef(options.toRef) } : { toSelector: options.toSelector }),
      dragged: true,
    },
  };
}

export async function managedDownload(options: {
  ref?: string;
  selector?: string;
  path?: string;
}) {
  if (!options.ref && !options.selector) {
    throw new Error('download requires a ref or selector');
  }
  const target = options.ref
    ? `page.locator(${JSON.stringify(`aria-ref=${normalizeRef(options.ref)}`)})`
    : `page.locator(${JSON.stringify(options.selector)})`;
  const result = await managedRunCode({
    source: `async page => {
      const downloadPromise = page.waitForEvent('download');
      await ${target}.click();
      const download = await downloadPromise;
      ${options.path ? `await download.saveAs(${JSON.stringify(options.path)});` : ''}
      return JSON.stringify({
        suggestedFilename: download.suggestedFilename(),
        path: ${JSON.stringify(options.path ?? '')},
        url: download.url(),
      });
    }`,
  });

  return {
    session: result.session,
    page: result.page,
    data: {
      ...(options.ref ? { ref: normalizeRef(options.ref) } : { selector: options.selector }),
      ...(typeof result.data.result === 'object' ? result.data.result : {}),
      downloaded: true,
    },
  };
}

export async function managedReadText(options?: { selector?: string; maxChars?: number }) {
  const source = options?.selector
    ? `async page => {
      const text = await page.locator(${JSON.stringify(options.selector)}).innerText().catch(() => '');
      return JSON.stringify({ source: 'selector', selector: ${JSON.stringify(options.selector)}, text });
    }`
    : `async page => {
      const text = await page.evaluate(() => document.body?.innerText ?? '');
      return JSON.stringify({ source: 'body-visible', text });
    }`;

  const result = await managedRunCode({ source });
  const parsed = result.data.result || {};
  const rawText = parsed.text ?? '';
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
      ...maybeRawOutput(result.data.output ?? ''),
    },
  };
}

export async function managedPageCurrent() {
  const result = await managedRunCode({
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
      id: 'p1',
      url: parsed.url ?? '',
      title: parsed.title ?? '',
      current: true,
    },
    data: {
      activePageId: 'p1',
      pageCount: parsed.pageCount ?? 1,
      pages: [
        {
          id: 'p1',
          url: parsed.url ?? '',
          title: parsed.title ?? '',
          current: true,
        },
      ],
      ...maybeRawOutput(result.data.output ?? ''),
    },
  };
}

export async function managedPageList() {
  const result = await managedRunCode({
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
      activePageId: current?.id ?? 'p1',
      pageCount: parsed.pages?.length ?? 0,
      pages: parsed.pages ?? [],
      ...maybeRawOutput(result.data.output ?? ''),
    },
  };
}

export async function managedPageFrames() {
  const result = await managedRunCode({
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
      activePageId: 'p1',
      frameCount: parsed.frames?.length ?? 0,
      frames: parsed.frames ?? [],
      ...maybeRawOutput(result.data.output ?? ''),
    },
  };
}

export async function managedConsole(level?: string) {
  const args = ['console'];
  if (level) {
    args.push(level);
  }
  const result = await runManagedSessionCommand({
    _: args,
  });
  return {
    session: {
      scope: 'managed',
      name: result.sessionName,
      default: result.sessionName === 'default',
    },
    page: parsePageSummary(result.text),
    data: {
      summary: parseResultText(result.text) || '',
      ...maybeRawOutput(result.text),
    },
  };
}

export async function managedNetwork() {
  const result = await runManagedSessionCommand({
    _: ['network'],
  });
  return {
    session: {
      scope: 'managed',
      name: result.sessionName,
      default: result.sessionName === 'default',
    },
    page: parsePageSummary(result.text),
    data: {
      summary: parseResultText(result.text) || '',
      ...maybeRawOutput(result.text),
    },
  };
}

export async function managedWait(options: {
  target?: string;
  text?: string;
  selector?: string;
  networkidle?: boolean;
}) {
  let source = '';

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
    throw new Error('wait requires a condition');
  }

  const result = await managedRunCode({ source });

  return {
    session: result.session,
    page: await managedPageCurrent().then((pageResult) => pageResult.page),
    data: {
      condition:
        typeof result.data.result === 'string'
          ? stripQuotes(result.data.result)
          : String(result.data.result ?? ''),
      matched: true,
      ...maybeRawOutput(result.data.output ?? ''),
    },
  };
}
