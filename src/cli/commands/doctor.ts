import { defineCommand } from "citty";
import { getAuthProvider } from "#auth/registry.js";
import { sharedArgs } from "#cli/args.js";
import { managedObserveStatus } from "#engine/diagnose/core.js";
import { isModalStateBlockedMessage } from "#engine/shared.js";
import {
  checkDiskSpace,
  checkPlaywrightBrowsers,
  compactDoctorDiagnostic,
  type DoctorDiagnostic,
  doctorRecovery,
  inspectEnvironment,
  inspectProfilePath,
  inspectStatePath,
  probeEndpoint,
  summarizeDiagnostics,
} from "#store/health.js";
import { printCommandError } from "../output.js";
import { bool, type CliArgs, print, session, str } from "./_helpers.js";

export default defineCommand({
  meta: { name: "doctor", description: "Run local health checks" },
  args: {
    ...sharedArgs,
    "auth-provider": { type: "string", description: "Resolve auth provider", valueHint: "name" },
    profile: { type: "string", description: "Inspect profile path", valueHint: "path" },
    state: { type: "string", description: "Inspect state path", valueHint: "path" },
    endpoint: { type: "string", description: "Probe endpoint", valueHint: "url" },
    verbose: { type: "boolean", description: "Return full diagnostics" },
  },
  async run({ args }) {
    const a = args as CliArgs;
    try {
      const diagnostics: DoctorDiagnostic[] = [];
      diagnostics.push(await inspectEnvironment(process.cwd()));
      diagnostics.push(
        ...(await checkPlaywrightBrowsers()).map(
          (item): DoctorDiagnostic => ({
            kind: `browser:${item.browser}`,
            status: item.installed ? "ok" : "warn",
            summary: item.installed ? "browser installed" : "browser not installed",
            details: item,
          }),
        ),
      );
      const disk = await checkDiskSpace(process.cwd());
      diagnostics.push({
        kind: "disk",
        status: disk.ok ? "ok" : "warn",
        summary: "workspace disk space",
        details: disk,
      });
      if (str(a.profile)) diagnostics.push(inspectProfilePath(str(a.profile)));
      if (str(a.state)) diagnostics.push(inspectStatePath(str(a.state)));
      if (str(a.endpoint)) diagnostics.push(await probeEndpoint(str(a.endpoint)));
      if (str(a["auth-provider"]))
        diagnostics.push({
          kind: "auth-provider",
          status: getAuthProvider(str(a["auth-provider"]) as string) ? "ok" : "fail",
          summary: `auth provider ${str(a["auth-provider"])}`,
          details: { name: str(a["auth-provider"]) },
        });
      if (str(a.session)) {
        const sessionName = session(a);
        try {
          const status = await managedObserveStatus({ sessionName });
          const statusData = status.data as Record<string, unknown>;
          diagnostics.push({
            kind: "observe-status",
            status: "ok",
            summary: "session probe completed",
            details: statusData,
          });
          const modals =
            statusData.modals && typeof statusData.modals === "object"
              ? (statusData.modals as Record<string, unknown>)
              : null;
          const modalCount = typeof modals?.count === "number" ? modals.count : 0;
          if (modalCount > 0) {
            diagnostics.push({
              kind: "html-modal",
              status: "warn",
              summary: "visible HTML modal or overlay detected",
              details: {
                sessionName,
                count: modalCount,
                items: Array.isArray(modals?.items) ? modals.items.slice(0, 3) : [],
              },
            });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (isModalStateBlockedMessage(message)) {
            diagnostics.push({
              kind: "modal-state",
              status: "fail",
              summary: "session is blocked by a modal dialog",
              details: { sessionName, code: "MODAL_STATE_BLOCKED" },
            });
          } else {
            diagnostics.push({
              kind: "observe-status",
              status: "fail",
              summary: "session probe failed",
              details: { sessionName, error: message },
            });
          }
        }
      }
      print(
        "doctor",
        {
          data: {
            summary: summarizeDiagnostics(diagnostics),
            diagnostics: bool(a.verbose) ? diagnostics : diagnostics.map(compactDoctorDiagnostic),
            recovery: doctorRecovery(diagnostics),
          },
        },
        a,
      );
    } catch (error) {
      printCommandError(
        "doctor",
        {
          code: "DOCTOR_FAILED",
          message: error instanceof Error ? error.message : "doctor failed",
        },
        a.output,
      );
      process.exitCode = 1;
    }
  },
});
