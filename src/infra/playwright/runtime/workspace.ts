import { runManagedSessionCommand } from "../cli-client.js";
import { managedRunCode } from "./code.js";
import { managedEnsureDiagnosticsHooks } from "./hooks.js";
import { DIAGNOSTICS_STATE_KEY, maybeRawOutput } from "./shared.js";

type WorkspacePage = {
  index: number;
  pageId: string;
};

export async function managedWorkspaceProjection(options?: { sessionName?: string }) {
  await managedEnsureDiagnosticsHooks({ sessionName: options?.sessionName });
  const result = await managedRunCode({
    sessionName: options?.sessionName,
    source: `async page => {
      ${pageIdRuntimePrelude()}

      const pages = context.pages();
      const workspacePages = await Promise.all(pages.map((item, index) => projectPage(item, index)));
      const currentPage =
        workspacePages.find(item => item.current) ||
        (await projectPage(page, Math.max(pages.indexOf(page), 0)));
      const frames = page.frames();
      const frameItems = frames.map((frame, index) => {
        const parent = frame.parentFrame();
        const parentIndex = parent ? frames.indexOf(parent) : null;
        return {
          index,
          pageId: currentPage.pageId,
          navigationId: currentPage.navigationId,
          url: frame.url(),
          name: frame.name(),
          main: frame === page.mainFrame(),
          parentIndex: parentIndex >= 0 ? parentIndex : null,
        };
      });

      return JSON.stringify({
        page: currentPage,
        workspace: {
          pageCount: workspacePages.length,
          currentPageId: currentPage.pageId,
          currentNavigationId: currentPage.navigationId,
          pages: workspacePages,
        },
        frames: {
          pageId: currentPage.pageId,
          navigationId: currentPage.navigationId,
          frameCount: frameItems.length,
          frames: frameItems,
        },
        dialogs: {
          count: state.dialogRecords.length,
          items: state.dialogRecords.slice(-20),
          limitation:
            'Observed dialog events only; Playwright Core does not expose an authoritative live dialog set on the current managed-session substrate.',
        },
      });
    }`,
  });
  const parsed =
    typeof result.data.result === "object" && result.data.result ? result.data.result : {};
  const workspace = parsed.workspace ?? {
    pageCount: 0,
    currentPageId: null,
    currentNavigationId: null,
    pages: [],
  };
  const frames = parsed.frames ?? {
    pageId: null,
    navigationId: null,
    frameCount: 0,
    frames: [],
  };
  const dialogs = parsed.dialogs ?? {
    count: 0,
    items: [],
    limitation:
      "Observed dialog events only; Playwright Core does not expose an authoritative live dialog set on the current managed-session substrate.",
  };
  const page = parsed.page ?? result.page;

  return {
    session: result.session,
    page,
    data: {
      page,
      workspace,
      frames,
      dialogs,
      ...maybeRawOutput(result.data.output ?? ""),
    },
  };
}

export async function managedPageCurrent(options?: { sessionName?: string }) {
  const projection = await managedWorkspaceProjection({ sessionName: options?.sessionName });
  return {
    session: projection.session,
    page: projection.page,
    data: {
      activePageId: projection.data.workspace.currentPageId,
      currentNavigationId: projection.data.workspace.currentNavigationId,
      pageCount: projection.data.workspace.pageCount,
      currentPage: projection.data.page,
      pages: projection.data.workspace.pages,
      workspace: projection.data.workspace,
      ...maybeRawOutput(projection.data.output ?? ""),
    },
  };
}

export async function managedPageList(options?: { sessionName?: string }) {
  const projection = await managedWorkspaceProjection({ sessionName: options?.sessionName });
  const current =
    projection.data.workspace.pages.find((entry: { current?: boolean }) => entry.current) ??
    projection.data.workspace.pages[0] ??
    projection.page;

  return {
    session: projection.session,
    page: current,
    data: {
      activePageId: projection.data.workspace.currentPageId,
      currentNavigationId: projection.data.workspace.currentNavigationId,
      pageCount: projection.data.workspace.pageCount,
      pages: projection.data.workspace.pages,
      workspace: projection.data.workspace,
      ...maybeRawOutput(projection.data.output ?? ""),
    },
  };
}

export async function managedPageFrames(options?: { sessionName?: string }) {
  const projection = await managedWorkspaceProjection({ sessionName: options?.sessionName });
  return {
    session: projection.session,
    page: projection.page,
    data: {
      activePageId: projection.data.workspace.currentPageId,
      currentNavigationId: projection.data.workspace.currentNavigationId,
      pageId: projection.data.frames.pageId,
      navigationId: projection.data.frames.navigationId,
      frameCount: projection.data.frames.frameCount,
      frames: projection.data.frames.frames,
      workspace: projection.data.workspace,
      ...maybeRawOutput(projection.data.output ?? ""),
    },
  };
}

export async function managedPageDialogs(options?: { sessionName?: string }) {
  const projection = await managedWorkspaceProjection({ sessionName: options?.sessionName });
  return {
    session: projection.session,
    page: projection.page,
    data: {
      activePageId: projection.data.workspace.currentPageId,
      currentNavigationId: projection.data.workspace.currentNavigationId,
      pageId: projection.data.page?.pageId ?? null,
      navigationId: projection.data.page?.navigationId ?? null,
      dialogCount: projection.data.dialogs.count,
      dialogs: projection.data.dialogs.items,
      limitation: projection.data.dialogs.limitation,
      workspace: projection.data.workspace,
      ...maybeRawOutput(projection.data.output ?? ""),
    },
  };
}

type PageAssessSignals = {
  title: string;
  url: string;
  visibleTextChars: number;
  paragraphCount: number;
  headingCount: number;
  interactiveCount: number;
  formCount: number;
  formControlCount: number;
  tableLikeCount: number;
  feedLikeCount: number;
  dialogLikeCount: number;
  iframeCount: number;
  shadowHostCount: number;
  scrollableRegionCount: number;
  fixedOverlayCount: number;
  passwordFieldCount: number;
  runtimeHints: {
    nextData: boolean;
    nuxtData: boolean;
    initialState: boolean;
    redux: boolean;
    apollo: boolean;
  };
};

function pageAssessSource() {
  return `async page => {
      return await page.evaluate(() => {
        const bodyText = document.body?.innerText?.replace(/\\s+/g, ' ').trim() ?? '';
        const countVisible = (selector) =>
          Array.from(document.querySelectorAll(selector)).filter(node => {
            if (!(node instanceof HTMLElement))
              return false;
            const style = window.getComputedStyle(node);
            return style.display !== 'none' && style.visibility !== 'hidden';
          }).length;
        const countScrollableRegions = () =>
          Array.from(document.querySelectorAll('body, main, section, article, div')).filter(node => {
            if (!(node instanceof HTMLElement))
              return false;
            const style = window.getComputedStyle(node);
            const overflowY = style.overflowY;
            const overflowX = style.overflowX;
            const scrollable =
              overflowY === 'auto' ||
              overflowY === 'scroll' ||
              overflowX === 'auto' ||
              overflowX === 'scroll';
            return scrollable && (node.scrollHeight > node.clientHeight || node.scrollWidth > node.clientWidth);
          }).length;
        const runtimeHints = {
          nextData: typeof window.__NEXT_DATA__ !== 'undefined',
          nuxtData: typeof window.__NUXT__ !== 'undefined' || typeof window.__NUXT_DATA__ !== 'undefined',
          initialState: typeof window.__INITIAL_STATE__ !== 'undefined',
          redux:
            typeof window.__REDUX_STATE__ !== 'undefined' ||
            Boolean(window.store && typeof window.store.getState === 'function'),
          apollo:
            typeof window.__APOLLO_STATE__ !== 'undefined' ||
            typeof window.__APOLLO_CLIENT__ !== 'undefined',
        };
        return JSON.stringify({
          title: document.title,
          url: location.href,
          visibleTextChars: bodyText.length,
          paragraphCount: document.querySelectorAll('p, li, article p, main p').length,
          headingCount: document.querySelectorAll('h1, h2, h3').length,
          interactiveCount: countVisible('button, a[href], input, textarea, select, summary, [role="button"], [role="link"], [role="textbox"], [role="menuitem"], [role="tab"]'),
          formCount: document.querySelectorAll('form').length,
          formControlCount: document.querySelectorAll('input, textarea, select, button[type="submit"]').length,
          tableLikeCount: document.querySelectorAll('table, [role="table"], [role="grid"]').length,
          feedLikeCount: document.querySelectorAll('[role="feed"], [data-feed], [data-testid*="feed"]').length,
          dialogLikeCount: document.querySelectorAll('dialog, [role="dialog"], [aria-modal="true"]').length,
          iframeCount: document.querySelectorAll('iframe, frame').length,
          shadowHostCount: Array.from(document.querySelectorAll('*')).filter(node => node.shadowRoot).length,
          scrollableRegionCount: countScrollableRegions(),
          fixedOverlayCount: Array.from(document.querySelectorAll('body *')).filter(node => {
            if (!(node instanceof HTMLElement))
              return false;
            const style = window.getComputedStyle(node);
            return style.position === 'fixed' && Number.parseInt(style.zIndex || '0', 10) >= 100;
          }).length,
          passwordFieldCount: document.querySelectorAll('input[type="password"]').length,
          runtimeHints,
        });
      });
    }`;
}

export async function managedPageAssess(options?: { sessionName?: string }) {
  const projection = await managedWorkspaceProjection({ sessionName: options?.sessionName });
  const assessment = await managedRunCode({
    sessionName: options?.sessionName,
    source: pageAssessSource(),
  });
  const signals = assessment.data.result as PageAssessSignals;
  const runtimeHintCount = Object.values(signals.runtimeHints ?? {}).filter(Boolean).length;
  const hasFrames = Number(projection.data.frames.frameCount ?? 0) > 1 || signals.iframeCount > 0;
  const hasDialog = Number(projection.data.dialogs.count ?? 0) > 0 || signals.dialogLikeCount > 0;
  const hasForms = signals.formCount > 0 || signals.formControlCount >= 3;
  const hasTableLikeRegions = signals.tableLikeCount > 0;
  const hasFeedLikeRegions = signals.feedLikeCount > 0;
  const visibleTextDensity =
    signals.visibleTextChars >= 100 ? "high" : signals.visibleTextChars >= 40 ? "medium" : "low";
  const authSensitivePageLikely =
    signals.passwordFieldCount > 0 ||
    (hasForms && /login|signin|sign-in|auth|account|dashboard|settings/i.test(signals.url));
  const pageKind = inferPageKind({
    hasDialog,
    hasForms,
    hasTableLikeRegions,
    hasFeedLikeRegions,
    interactiveCount: signals.interactiveCount,
    runtimeHintCount,
    visibleTextChars: signals.visibleTextChars,
  });
  const runtimeProbeRecommended = runtimeHintCount > 0 || pageKind === "app";
  const storageProbeRecommended = authSensitivePageLikely;
  const networkProbeRecommended =
    pageKind === "table" ||
    pageKind === "feed" ||
    (pageKind === "app" && signals.visibleTextChars < 120);
  const complexityHints = {
    virtualizedUiLikely:
      signals.scrollableRegionCount > 1 &&
      signals.interactiveCount >= 12 &&
      signals.visibleTextChars < 250,
    spaNavigationLikely: runtimeHintCount > 0 || pageKind === "app",
    authSensitivePageLikely,
    overlayHeavyPageLikely: signals.fixedOverlayCount >= 2 || hasDialog,
  };

  return {
    session: projection.session,
    page: projection.page,
    data: {
      page: projection.data.page,
      summary: {
        pageKind,
        visibleTextDensity,
        hasDialog,
        hasFrames,
        hasShadowRoots: signals.shadowHostCount > 0,
        hasScrollableRegions: signals.scrollableRegionCount > 0,
        hasForms,
        hasTableLikeRegions,
        hasFeedLikeRegions,
      },
      dataHints: {
        domReadable: signals.visibleTextChars > 0,
        accessibilityReadable:
          signals.interactiveCount > 0 || signals.headingCount > 0 || signals.paragraphCount > 0,
        runtimeProbeRecommended,
        storageProbeRecommended,
        networkProbeRecommended,
      },
      complexityHints,
      nextSteps: recommendedNextSteps({
        sessionName: projection.session.name,
        domReadable: signals.visibleTextChars > 0,
        accessibilityReadable:
          signals.interactiveCount > 0 || signals.headingCount > 0 || signals.paragraphCount > 0,
        runtimeProbeRecommended,
        storageProbeRecommended,
        networkProbeRecommended,
      }),
      limitations: [
        "Assessment is inference-only; use `pw code`, storage, or diagnostics commands for authoritative runtime/network/state facts.",
      ],
      evidence: {
        derivedFrom: [
          "page current",
          "read-text-lite",
          "interactive summary",
          "frame/dialog projection",
        ],
      },
      ...maybeRawOutput(assessment.rawText ?? ""),
    },
  };
}

function inferPageKind(options: {
  hasDialog: boolean;
  hasForms: boolean;
  hasTableLikeRegions: boolean;
  hasFeedLikeRegions: boolean;
  interactiveCount: number;
  runtimeHintCount: number;
  visibleTextChars: number;
}) {
  if (options.hasDialog) {
    return "dialog";
  }
  if (options.hasTableLikeRegions) {
    return "table";
  }
  if (options.hasFeedLikeRegions) {
    return "feed";
  }
  if (options.hasForms) {
    return "form";
  }
  if (
    options.runtimeHintCount > 0 &&
    options.interactiveCount >= 6 &&
    options.visibleTextChars < 250
  ) {
    return "app";
  }
  if (options.visibleTextChars >= 80) {
    return "document";
  }
  if (options.interactiveCount >= 6) {
    return "app";
  }
  return "unknown";
}

function recommendedNextSteps(options: {
  sessionName: string;
  domReadable: boolean;
  accessibilityReadable: boolean;
  runtimeProbeRecommended: boolean;
  storageProbeRecommended: boolean;
  networkProbeRecommended: boolean;
}) {
  const nextSteps: string[] = [];
  if (options.domReadable) {
    nextSteps.push(`pw read-text -s ${options.sessionName}`);
  }
  if (options.accessibilityReadable) {
    nextSteps.push(`pw snapshot -i -s ${options.sessionName}`);
  }
  if (options.runtimeProbeRecommended) {
    nextSteps.push(`pw code --session ${options.sessionName} '<runtime-probe>'`);
  }
  if (options.storageProbeRecommended) {
    nextSteps.push(`pw storage local -s ${options.sessionName}`);
  }
  if (options.networkProbeRecommended) {
    nextSteps.push(`pw diagnostics digest -s ${options.sessionName}`);
  }
  return [...new Set(nextSteps)].slice(0, 3);
}

function pageById(pages: WorkspacePage[], pageId: string) {
  return pages.find((page) => page.pageId === pageId);
}

export function pageIdRuntimePrelude() {
  return `
      const context = page.context();
      const state = context[${JSON.stringify(DIAGNOSTICS_STATE_KEY)}] ||= {};
      state.nextPageSeq = Number.isInteger(state.nextPageSeq) ? state.nextPageSeq : 1;
      state.nextNavigationSeq = Number.isInteger(state.nextNavigationSeq) ? state.nextNavigationSeq : 1;

      const ensurePageId = (p) => {
        if (!p.__pwcliPageId)
          p.__pwcliPageId = 'p' + state.nextPageSeq++;
        return p.__pwcliPageId;
      };
      const ensureNavigationId = (p) => {
        if (!p.__pwcliNavigationId)
          p.__pwcliNavigationId = 'nav-' + state.nextNavigationSeq++;
        return p.__pwcliNavigationId;
      };
      const projectPage = async (p, index) => {
        const opener = await p.opener().catch(() => null);
        return {
          index,
          pageId: ensurePageId(p),
          navigationId: ensureNavigationId(p),
          url: p.url(),
          title: await p.title().catch(() => ''),
          current: p === page,
          openerPageId: opener ? ensurePageId(opener) : null,
        };
      };
      const pageById = (pages, pageId) => pages.find((p) => ensurePageId(p) === pageId);
    `;
}

export function fallbackPageIdAfterCloseSource() {
  return `
      const fallbackPageIdAfterClose = (pages, target, currentPageId) => {
        if (!target.current && currentPageId && currentPageId !== target.pageId)
          return currentPageId;

        if (target.openerPageId) {
          const opener = pages.find((item) => item.pageId === target.openerPageId && item.pageId !== target.pageId);
          if (opener)
            return opener.pageId;
        }

        const remaining = pages.filter((item) => item.pageId !== target.pageId);
        if (remaining.length === 0)
          return null;

        const previous = remaining
          .filter((item) => item.index < target.index)
          .sort((a, b) => b.index - a.index)[0];
        if (previous)
          return previous.pageId;

        const next = remaining
          .filter((item) => item.index > target.index)
          .sort((a, b) => a.index - b.index)[0];
        return next?.pageId ?? null;
      };
    `;
}

async function selectPageById(sessionName: string | undefined, pageId: string) {
  const before = await managedWorkspaceProjection({ sessionName });
  const pages = before.data.workspace.pages as WorkspacePage[];
  const target = pageById(pages, pageId);
  if (!target) {
    throw new Error(`TAB_PAGE_NOT_FOUND:${pageId}`);
  }

  await runManagedSessionCommand(
    {
      _: ["tab-select", String(target.index)],
    },
    {
      sessionName,
    },
  );

  return { selectedPageId: pageId, selectedIndex: target.index };
}

async function closePageById(sessionName: string | undefined, pageId: string) {
  const result = await managedRunCode({
    sessionName,
    source: `async page => {
      ${pageIdRuntimePrelude()}
      ${fallbackPageIdAfterCloseSource()}
      const targetPageId = ${JSON.stringify(pageId)};
      const pages = context.pages();
      const workspacePages = await Promise.all(pages.map((item, index) => projectPage(item, index)));
      const targetPage = pageById(pages, targetPageId);
      if (!targetPage)
        throw new Error('TAB_PAGE_NOT_FOUND:' + targetPageId);

      const target = workspacePages.find((item) => item.pageId === targetPageId);
      const currentPageId = ensurePageId(page);
      const fallbackPageId = fallbackPageIdAfterClose(workspacePages, target, currentPageId);
      const fallbackPage = fallbackPageId ? pageById(pages, fallbackPageId) : null;

      await targetPage.close();
      if (fallbackPage && fallbackPage !== targetPage && !fallbackPage.isClosed())
        await fallbackPage.bringToFront();

      return JSON.stringify({
        closedPageId: targetPageId,
        closedIndex: target.index,
        fallbackPageId,
      });
    }`,
  });
  return result.data.result as {
    closedPageId: string;
    closedIndex: number;
    fallbackPageId: string | null;
  };
}

export async function managedTabSelect(options: { sessionName?: string; pageId: string }) {
  const selected = await selectPageById(options.sessionName, options.pageId);
  const after = await managedPageCurrent({ sessionName: options.sessionName });
  if (after.data.activePageId !== options.pageId) {
    throw new Error(`TAB_PAGE_SELECTION_RACE:${options.pageId}`);
  }

  return {
    ...after,
    data: {
      ...after.data,
      selected: true,
      selectedPageId: options.pageId,
      selectedIndex: selected.selectedIndex,
    },
  };
}

export async function managedTabClose(options: { sessionName?: string; pageId: string }) {
  const closed = await closePageById(options.sessionName, options.pageId);
  const fallbackPageId = closed.fallbackPageId;

  if (!fallbackPageId) {
    return {
      session: {
        scope: "managed",
        name: options.sessionName ?? "default",
        default: !options.sessionName || options.sessionName === "default",
      },
      data: {
        closed: true,
        closedPageId: options.pageId,
        closedIndex: closed.closedIndex,
        activePageId: null,
        currentNavigationId: null,
        pageCount: 0,
        currentPage: null,
        pages: [],
        workspace: {
          pageCount: 0,
          currentPageId: null,
          currentNavigationId: null,
          pages: [],
        },
      },
    };
  }

  await selectPageById(options.sessionName, fallbackPageId);
  const after = await managedPageCurrent({ sessionName: options.sessionName });
  return {
    ...after,
    data: {
      ...after.data,
      closed: true,
      closedPageId: options.pageId,
      closedIndex: closed.closedIndex,
      fallbackPageId,
    },
  };
}
