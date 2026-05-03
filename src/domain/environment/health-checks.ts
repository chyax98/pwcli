import { homedir } from "node:os";
import { resolve } from "node:path";

export type DoctorStatus = "ok" | "warn" | "fail" | "skipped";

export type DoctorDiagnostic = {
  kind: string;
  status: DoctorStatus;
  summary: string;
  details: Record<string, unknown>;
};

export function objectRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function stringValue(value: unknown) {
  return typeof value === "string" ? value : null;
}

export function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function expandPath(input: string) {
  if (input === "~") {
    return homedir();
  }
  if (input.startsWith("~/")) {
    return resolve(homedir(), input.slice(2));
  }
  return resolve(input);
}

export function summarizeDiagnostics(diagnostics: DoctorDiagnostic[]) {
  return diagnostics.reduce(
    (summary, diagnostic) => {
      summary[diagnostic.status] += 1;
      return summary;
    },
    { ok: 0, warn: 0, fail: 0, skipped: 0 },
  );
}

export function compactDoctorDiagnostic(diagnostic: DoctorDiagnostic): DoctorDiagnostic {
  const details = diagnostic.details ?? {};
  switch (diagnostic.kind) {
    case "session-substrate": {
      const probe = objectRecord(details.probe);
      const page = objectRecord(probe.page);
      return {
        ...diagnostic,
        details: {
          requestedSession: stringValue(details.requestedSession),
          alive: details.alive === true,
          socketReachable: probe.reachable === true,
          page: {
            url: stringValue(page.url),
            title: stringValue(page.title),
          },
        },
      };
    }
    case "observe-status": {
      const workspace = objectRecord(details.workspace);
      const pageErrors = objectRecord(details.pageErrors);
      const routes = objectRecord(details.routes);
      const trace = objectRecord(details.trace);
      const bootstrap = objectRecord(details.bootstrap);
      return {
        ...diagnostic,
        details: {
          sessionName: stringValue(details.sessionName),
          page: {
            url: stringValue(objectRecord(details.page).url),
            title: stringValue(objectRecord(details.page).title),
          },
          workspace: {
            pageCount: numberValue(workspace.pageCount) ?? 0,
            currentPageId: stringValue(workspace.currentPageId),
          },
          routes: {
            count: numberValue(routes.count) ?? 0,
          },
          pageErrors: {
            visibleCount: numberValue(pageErrors.visibleCount) ?? 0,
          },
          trace: {
            active: trace.active === true,
          },
          bootstrap: {
            applied: bootstrap.applied === true,
          },
        },
      };
    }
    case "modal-state":
      return {
        ...diagnostic,
        details: {
          sessionName: stringValue(details.sessionName),
          code: stringValue(details.code),
        },
      };
    case "auth-provider-resolution":
      return {
        ...diagnostic,
        details: {
          requestedProvider: stringValue(details.requestedProvider),
          resolved: details.resolved === true,
          discoveredCount: numberValue(details.discoveredCount) ?? 0,
        },
      };
    case "profile-path":
      return {
        ...diagnostic,
        details: {
          requestedPath: stringValue(details.requestedPath),
          resolvedPath: stringValue(details.resolvedPath),
          exists: details.exists === true,
          writable: details.writable === true,
          usable: details.usable === true,
        },
      };
    case "state-path":
      return {
        ...diagnostic,
        details: {
          requestedPath: stringValue(details.requestedPath),
          resolvedPath: stringValue(details.resolvedPath),
          exists: details.exists === true,
          readable: details.readable === true,
          validJson: details.validJson === true,
          cookieCount: numberValue(details.cookieCount) ?? 0,
          originCount: numberValue(details.originCount) ?? 0,
          ...(stringValue(details.parseError)
            ? { parseError: stringValue(details.parseError) }
            : {}),
        },
      };
    case "endpoint-reachability":
      return {
        ...diagnostic,
        details: {
          endpoint: stringValue(details.endpoint),
          protocol: stringValue(details.protocol),
          statusCode: numberValue(details.statusCode),
          host: stringValue(details.host),
          port: numberValue(details.port),
          ...(stringValue(details.error) ? { error: stringValue(details.error) } : {}),
        },
      };
    case "bootstrap-config":
      return {
        ...diagnostic,
        details: {
          sessionName: stringValue(details.sessionName),
          bootstrapConfigMissing: details.bootstrapConfigMissing === true,
          initScriptCount: numberValue(details.initScriptCount) ?? 0,
          appliedAt: stringValue(details.appliedAt),
        },
      };
    case "environment": {
      const items = (details.items ?? []) as Array<{
        label: string;
        status: DoctorStatus;
        detail: string;
      }>;
      const filtered = items.filter((item) => item.status !== "ok");
      return {
        ...diagnostic,
        status: filtered.some((i) => i.status === "fail")
          ? "fail"
          : filtered.length > 0
            ? "warn"
            : "ok",
        summary:
          filtered.length > 0 ? "Environment issues detected" : "Environment checks passed",
        details: {
          items: filtered,
        },
      };
    }
    default:
      return diagnostic;
  }
}

export function doctorRecovery(diagnostics: DoctorDiagnostic[]) {
  const modal = diagnostics.find((diagnostic) => diagnostic.kind === "modal-state");
  if (modal) {
    return {
      blocked: true,
      kind: "modal-state",
      suggestions: [
        "Dismiss or accept the browser dialog if one is visible",
        "Retry the read after the dialog is cleared",
        "If still blocked, run `pw session recreate <name>`",
      ],
    };
  }
  return {
    blocked: false,
    kind: null,
    suggestions: [],
  };
}
