import { runManagedSessionCommand } from "../cli-client.js";
import { managedRunCode } from "./code.js";
import { managedEnsureDiagnosticsHooks } from "./hooks.js";
import { DIAGNOSTICS_STATE_KEY, maybeRawOutput } from "./shared.js";

type WorkspacePage = {
  index: number;
  pageId: string;
  navigationId?: string;
  url?: string;
  title?: string;
  current?: boolean;
  openerPageId?: string | null;
};

export async function managedWorkspaceProjection(options?: { sessionName?: string }) {
  await managedEnsureDiagnosticsHooks({ sessionName: options?.sessionName });
  const result = await managedRunCode({
    sessionName: options?.sessionName,
    source: `async page => {
      const context = page.context();
      const state = context[${JSON.stringify(DIAGNOSTICS_STATE_KEY)}] ||= {};
      state.dialogRecords = Array.isArray(state.dialogRecords) ? state.dialogRecords : [];
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
      const projectPage = async (p, index) => ({
        index,
        pageId: ensurePageId(p),
        navigationId: ensureNavigationId(p),
        url: p.url(),
        title: await p.title().catch(() => ''),
        current: p === page,
        openerPageId: p.opener()?.__pwcliPageId || null,
      });

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

function pageById(pages: WorkspacePage[], pageId: string) {
  return pages.find((page) => page.pageId === pageId);
}

function fallbackPageIdAfterClose(
  pages: WorkspacePage[],
  target: WorkspacePage,
  currentPageId: string | null,
) {
  if (!target.current && currentPageId && currentPageId !== target.pageId) {
    return currentPageId;
  }

  if (target.openerPageId) {
    const opener = pages.find(
      (page) => page.pageId === target.openerPageId && page.pageId !== target.pageId,
    );
    if (opener) {
      return opener.pageId;
    }
  }

  const remaining = pages.filter((page) => page.pageId !== target.pageId);
  if (remaining.length === 0) {
    return null;
  }

  const previous = remaining
    .filter((page) => page.index < target.index)
    .sort((a, b) => b.index - a.index)[0];
  if (previous) {
    return previous.pageId;
  }

  const next = remaining
    .filter((page) => page.index > target.index)
    .sort((a, b) => a.index - b.index)[0];
  return next?.pageId ?? null;
}

async function selectTabIndex(sessionName: string | undefined, index: number) {
  await runManagedSessionCommand(
    {
      _: ["tab-select", String(index)],
    },
    {
      sessionName,
    },
  );
}

export async function managedTabSelect(options: { sessionName?: string; pageId: string }) {
  const before = await managedWorkspaceProjection({ sessionName: options.sessionName });
  const pages = before.data.workspace.pages as WorkspacePage[];
  const target = pageById(pages, options.pageId);
  if (!target) {
    throw new Error(`TAB_PAGE_NOT_FOUND:${options.pageId}`);
  }

  await selectTabIndex(options.sessionName, target.index);
  const after = await managedPageCurrent({ sessionName: options.sessionName });

  return {
    ...after,
    data: {
      ...after.data,
      selected: true,
      selectedPageId: options.pageId,
      selectedIndex: target.index,
    },
  };
}

export async function managedTabClose(options: { sessionName?: string; pageId: string }) {
  const before = await managedWorkspaceProjection({ sessionName: options.sessionName });
  const pages = before.data.workspace.pages as WorkspacePage[];
  const target = pageById(pages, options.pageId);
  if (!target) {
    throw new Error(`TAB_PAGE_NOT_FOUND:${options.pageId}`);
  }

  const fallbackPageId = fallbackPageIdAfterClose(
    pages,
    target,
    before.data.workspace.currentPageId ?? null,
  );

  await runManagedSessionCommand(
    {
      _: ["tab-close", String(target.index)],
    },
    {
      sessionName: options.sessionName,
    },
  );

  if (!fallbackPageId) {
    return {
      session: before.session,
      data: {
        closed: true,
        closedPageId: options.pageId,
        closedIndex: target.index,
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

  const afterClose = await managedWorkspaceProjection({ sessionName: options.sessionName });
  const remainingPages = afterClose.data.workspace.pages as WorkspacePage[];
  const fallback = pageById(remainingPages, fallbackPageId);
  if (fallback) {
    await selectTabIndex(options.sessionName, fallback.index);
  }

  const after = await managedPageCurrent({ sessionName: options.sessionName });
  return {
    ...after,
    data: {
      ...after.data,
      closed: true,
      closedPageId: options.pageId,
      closedIndex: target.index,
      fallbackPageId,
    },
  };
}
