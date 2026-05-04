"use client";

import { LogOut, RefreshCw, Shield, ShieldAlert } from "lucide-react";
import { useState } from "react";

interface ProbeResult {
  status: number;
  data: unknown;
  timestamp: string;
}

export default function AuthProbePage() {
  const [userStatus, setUserStatus] = useState<"idle" | "loading" | "done">("idle");
  const [adminStatus, setAdminStatus] = useState<"idle" | "loading" | "done">("idle");
  const [userResult, setUserResult] = useState<ProbeResult | null>(null);
  const [adminResult, setAdminResult] = useState<ProbeResult | null>(null);
  const [logoutMsg, setLogoutMsg] = useState("");

  async function probeUser() {
    setUserStatus("loading");
    setUserResult(null);
    try {
      const res = await fetch("/api/protected/data");
      let data: unknown = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }
      setUserResult({ status: res.status, data, timestamp: new Date().toISOString() });
    } catch (e) {
      setUserResult({ status: 0, data: { error: String(e) }, timestamp: new Date().toISOString() });
    } finally {
      setUserStatus("done");
    }
  }

  async function probeAdmin() {
    setAdminStatus("loading");
    setAdminResult(null);
    try {
      const res = await fetch("/api/protected/admin");
      let data: unknown = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }
      setAdminResult({ status: res.status, data, timestamp: new Date().toISOString() });
    } catch (e) {
      setAdminResult({
        status: 0,
        data: { error: String(e) },
        timestamp: new Date().toISOString(),
      });
    } finally {
      setAdminStatus("done");
    }
  }

  async function handleLogout() {
    setLogoutMsg("Logging out…");
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setLogoutMsg("Logged out. Cookie cleared.");
      // Re-probe both
      setUserResult(null);
      setAdminResult(null);
      setUserStatus("idle");
      setAdminStatus("idle");
    } catch (e) {
      setLogoutMsg(`Logout error: ${e}`);
    }
  }

  function statusBadge(status: number | undefined) {
    if (status === undefined) return null;
    const color =
      status === 200
        ? "bg-green-600/20 text-green-400 border-green-600/30"
        : status === 401
          ? "bg-amber-600/20 text-amber-400 border-amber-600/30"
          : status === 403
            ? "bg-orange-600/20 text-orange-400 border-orange-600/30"
            : "bg-red-600/20 text-red-400 border-red-600/30";
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${color}`}>{status}</span>
    );
  }

  return (
    <div data-testid="auth-probe-page" aria-label="Auth probe test page">
      <h1 className="text-2xl font-bold text-zinc-100 mb-1">Auth Probe</h1>
      <p className="text-sm text-zinc-500 mb-8">
        Test authentication state by probing protected endpoints. Verify 200 / 401 / 403 responses.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* User probe */}
        <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield size={16} className="text-indigo-400" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-zinc-200">User Auth Probe</h2>
            <span className="ml-auto text-xs text-zinc-500 font-mono">GET /api/protected/data</span>
          </div>

          <button
            data-testid="probe-user"
            aria-label="Probe user auth endpoint"
            aria-busy={userStatus === "loading"}
            onClick={probeUser}
            disabled={userStatus === "loading"}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-all duration-150 mb-4"
          >
            {userStatus === "loading" ? (
              <RefreshCw size={14} className="animate-spin" aria-hidden="true" />
            ) : (
              <Shield size={14} aria-hidden="true" />
            )}
            Probe /api/protected/data
          </button>

          <div
            data-testid="probe-user-status"
            aria-label="User probe HTTP status"
            aria-live="polite"
            className="flex items-center gap-2 mb-3 min-h-[24px]"
          >
            {userResult && (
              <>
                <span className="text-xs text-zinc-500">Status:</span>
                {statusBadge(userResult.status)}
              </>
            )}
          </div>

          <div
            data-testid="probe-user-result"
            aria-label="User probe result"
            aria-live="polite"
            className="bg-zinc-900 rounded-lg border border-zinc-700 p-3 min-h-[80px]"
          >
            {userResult ? (
              <pre className="text-xs font-mono text-zinc-300 whitespace-pre-wrap overflow-auto max-h-48">
                {JSON.stringify(userResult.data, null, 2)}
              </pre>
            ) : (
              <p className="text-xs text-zinc-600">Click &quot;Probe&quot; to test the endpoint.</p>
            )}
          </div>

          {userResult && <p className="text-xs text-zinc-600 mt-2">{userResult.timestamp}</p>}
        </div>

        {/* Admin probe */}
        <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <ShieldAlert size={16} className="text-violet-400" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-zinc-200">Admin Auth Probe</h2>
            <span className="ml-auto text-xs text-zinc-500 font-mono">
              GET /api/protected/admin
            </span>
          </div>

          <button
            data-testid="probe-admin"
            aria-label="Probe admin auth endpoint"
            aria-busy={adminStatus === "loading"}
            onClick={probeAdmin}
            disabled={adminStatus === "loading"}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-all duration-150 mb-4"
          >
            {adminStatus === "loading" ? (
              <RefreshCw size={14} className="animate-spin" aria-hidden="true" />
            ) : (
              <ShieldAlert size={14} aria-hidden="true" />
            )}
            Probe /api/protected/admin
          </button>

          <div
            data-testid="probe-admin-status"
            aria-label="Admin probe HTTP status"
            aria-live="polite"
            className="flex items-center gap-2 mb-3 min-h-[24px]"
          >
            {adminResult && (
              <>
                <span className="text-xs text-zinc-500">Status:</span>
                {statusBadge(adminResult.status)}
              </>
            )}
          </div>

          <div
            data-testid="probe-admin-result"
            aria-label="Admin probe result"
            aria-live="polite"
            className="bg-zinc-900 rounded-lg border border-zinc-700 p-3 min-h-[80px]"
          >
            {adminResult ? (
              <pre className="text-xs font-mono text-zinc-300 whitespace-pre-wrap overflow-auto max-h-48">
                {JSON.stringify(adminResult.data, null, 2)}
              </pre>
            ) : (
              <p className="text-xs text-zinc-600">Click &quot;Probe&quot; to test the endpoint.</p>
            )}
          </div>

          {adminResult && <p className="text-xs text-zinc-600 mt-2">{adminResult.timestamp}</p>}
        </div>
      </div>

      {/* Logout + re-probe */}
      <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-zinc-200 mb-4 flex items-center gap-2">
          <LogOut size={14} className="text-red-400" aria-hidden="true" />
          Session Control
        </h2>
        <p className="text-xs text-zinc-500 mb-4">
          Logout clears the <code className="text-indigo-400">pwcli_session</code> cookie. Re-probe
          after logout to confirm 401/403 responses.
        </p>
        <button
          aria-label="Logout and clear session cookie"
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 bg-red-700 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-all duration-150"
        >
          <LogOut size={14} aria-hidden="true" />
          Logout
        </button>
        {logoutMsg && (
          <p aria-live="polite" className="mt-3 text-sm text-zinc-400">
            {logoutMsg}
          </p>
        )}
      </div>
    </div>
  );
}
