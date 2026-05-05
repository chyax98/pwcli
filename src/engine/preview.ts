import { managedRunCode } from "#engine/shared.js";
import { managedWorkspaceProjection } from "#engine/workspace.js";
import { listRunDirs, readRunEvents } from "#store/artifacts.js";
import { readControlState } from "#store/control-state.js";

export async function managedPreviewFrame(options?: { sessionName?: string; quality?: number }) {
  const quality = Math.max(20, Math.min(90, options?.quality ?? 60));
  const result = await managedRunCode({
    sessionName: options?.sessionName,
    source: `async page => {
      const screenshot = await page.screenshot({ type: "jpeg", quality: ${quality}, scale: "css" });
      return { jpegBase64: screenshot.toString("base64") };
    }`,
  });
  const payload = result.data.result as { jpegBase64?: string };
  return {
    session: result.session,
    page: result.page,
    data: {
      jpegBase64: payload.jpegBase64 ?? "",
      mimeType: "image/jpeg",
      quality,
    },
  };
}

export async function managedPreviewStatus(options?: { sessionName?: string }) {
  const projection = await managedWorkspaceProjection({ sessionName: options?.sessionName });
  const recentEvents = await loadRecentEvents(options?.sessionName);
  const controlState = options?.sessionName ? await readControlState(options.sessionName) : null;
  return {
    session: projection.session,
    page: projection.page,
    data: {
      sessionName: projection.session.name,
      page: projection.page,
      workspace: projection.data.workspace,
      dialogs: projection.data.dialogs,
      recentEvents,
      controlState: controlState ?? {
        sessionName: projection.session.name,
        state: "cli",
        actor: "agent",
        updatedAt: null,
      },
    },
  };
}

async function loadRecentEvents(sessionName?: string) {
  if (!sessionName) return [];
  const runDirs = await listRunDirs();
  const latest = [...runDirs]
    .filter((runId) => runId.endsWith(`-${sessionName}`))
    .sort()
    .at(-1);
  if (!latest) return [];
  try {
    const events = await readRunEvents(latest);
    return events.slice(-10);
  } catch {
    return [];
  }
}
