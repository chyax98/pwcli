"use client";

import { useState } from "react";
import { Play, CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";

interface RequestResult {
  status: number;
  duration: number;
  data: unknown;
  error?: string;
  timestamp: string;
}

interface RequestEntry {
  id: string;
  label: string;
  status: "idle" | "pending" | "success" | "error";
  result?: RequestResult;
}

const REQUESTS_CONFIG = [
  { id: "r1", label: "GET /api/data (normal)", url: "/api/data", method: "GET" },
  { id: "r2", label: "GET /api/data?delay=3000 (slow 3s)", url: "/api/data?delay=3000", method: "GET" },
  { id: "r3", label: "GET /api/data/error (500)", url: "/api/data/error", method: "GET" },
  { id: "r4", label: "POST /api/data (JSON body)", url: "/api/data", method: "POST", body: { test: true, source: "network-page", timestamp: Date.now() } },
  { id: "r5", label: "GET /api/auth/me (auth check)", url: "/api/auth/me", method: "GET" },
];

export default function NetworkPage() {
  const [entries, setEntries] = useState<RequestEntry[]>(
    REQUESTS_CONFIG.map((c) => ({ id: c.id, label: c.label, status: "idle" }))
  );

  function updateEntry(id: string, update: Partial<RequestEntry>) {
    setEntries((prev) => prev.map((e) => e.id === id ? { ...e, ...update } : e));
  }

  async function runRequest(config: (typeof REQUESTS_CONFIG)[number]) {
    updateEntry(config.id, { status: "pending" });
    const start = Date.now();

    try {
      const options: RequestInit = {
        method: config.method,
        headers: { "Content-Type": "application/json" },
      };
      if (config.method === "POST" && "body" in config) {
        options.body = JSON.stringify(config.body);
      }

      const res = await fetch(config.url, options);
      const duration = Date.now() - start;
      let data: unknown;
      try { data = await res.json(); } catch { data = null; }

      updateEntry(config.id, {
        status: res.ok ? "success" : "error",
        result: {
          status: res.status,
          duration,
          data,
          error: res.ok ? undefined : `HTTP ${res.status}`,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (err) {
      updateEntry(config.id, {
        status: "error",
        result: {
          status: 0,
          duration: Date.now() - start,
          data: null,
          error: String(err),
          timestamp: new Date().toISOString(),
        },
      });
    }
  }

  async function runAll() {
    for (const config of REQUESTS_CONFIG) {
      runRequest(config);
    }
  }

  function clearAll() {
    setEntries(REQUESTS_CONFIG.map((c) => ({ id: c.id, label: c.label, status: "idle" })));
  }

  const StatusIcon = ({ status }: { status: RequestEntry["status"] }) => {
    if (status === "pending") return <div className="w-4 h-4 border-2 border-zinc-600 border-t-indigo-500 rounded-full animate-spin" aria-hidden="true" />;
    if (status === "success") return <CheckCircle size={14} className="text-green-400" aria-hidden="true" />;
    if (status === "error") return <XCircle size={14} className="text-red-400" aria-hidden="true" />;
    return <div className="w-4 h-4 rounded-full border border-zinc-700" aria-hidden="true" />;
  };

  return (
    <div data-testid="network-page" aria-label="Network diagnostics test page">
      <h1 className="text-2xl font-bold text-zinc-100 mb-1">Network & Diagnostics</h1>
      <p className="text-sm text-zinc-500 mb-8">Test API requests, console output, and network conditions.</p>

      <div className="space-y-6">
        {/* Controls */}
        <div className="flex gap-3">
          <button
            data-testid="run-all-requests"
            aria-label="Run all requests"
            onClick={runAll}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-all duration-150"
          >
            <Play size={14} aria-hidden="true" />
            Run All
          </button>
          <button
            data-testid="clear-results"
            aria-label="Clear results"
            onClick={clearAll}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium rounded-lg transition-all duration-150"
          >
            Clear
          </button>
        </div>

        {/* Request list */}
        <div className="space-y-3">
          {REQUESTS_CONFIG.map((config, i) => {
            const entry = entries.find((e) => e.id === config.id)!;
            return (
              <div
                key={config.id}
                data-testid={`request-${config.id}`}
                aria-label={`${config.label} — ${entry.status}`}
                className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden card-glow"
              >
                <div className="flex items-center gap-3 px-4 py-3">
                  <StatusIcon status={entry.status} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-zinc-200 truncate">{config.label}</div>
                    <div className="text-xs text-zinc-500 font-mono">{config.method} {config.url}</div>
                  </div>
                  {entry.result && (
                    <div className="flex items-center gap-3 text-xs text-zinc-500">
                      <div className="flex items-center gap-1">
                        <Clock size={10} aria-hidden="true" />
                        <span data-testid={`duration-${config.id}`}>{entry.result.duration}ms</span>
                      </div>
                      <span
                        data-testid={`status-${config.id}`}
                        className={`font-mono font-bold ${entry.result.status >= 400 ? "text-red-400" : entry.result.status >= 200 ? "text-green-400" : "text-zinc-500"}`}
                      >
                        {entry.result.status}
                      </span>
                    </div>
                  )}
                  <button
                    data-testid={`run-${config.id}`}
                    aria-label={`Run ${config.label}`}
                    aria-busy={entry.status === "pending"}
                    onClick={() => runRequest(config)}
                    disabled={entry.status === "pending"}
                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 text-xs font-medium rounded-lg transition-all duration-150 flex items-center gap-1.5"
                  >
                    <Play size={10} aria-hidden="true" />
                    Run
                  </button>
                </div>
                {entry.result && (
                  <div className="border-t border-zinc-800 px-4 py-3 bg-zinc-950/50">
                    <pre
                      data-testid={`result-${config.id}`}
                      aria-label={`Result for ${config.label}`}
                      className="text-xs font-mono text-zinc-400 max-h-32 overflow-auto whitespace-pre-wrap"
                    >
                      {entry.result.error
                        ? `Error: ${entry.result.error}`
                        : JSON.stringify(entry.result.data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Console triggers */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 card-glow">
          <h2 className="text-sm font-semibold text-zinc-200 mb-4">Console Output Triggers</h2>
          <p className="text-xs text-zinc-500 mb-4">Click to emit console messages (check with <code className="text-indigo-400">pw console</code>)</p>
          <div className="flex flex-wrap gap-3">
            <button
              data-testid="console-log"
              aria-label="Trigger console.log"
              onClick={() => console.log("[pwcli-test] console.log triggered at", new Date().toISOString(), { source: "network-page", level: "log" })}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium rounded-lg transition-all"
            >
              console.log
            </button>
            <button
              data-testid="console-warn"
              aria-label="Trigger console.warn"
              onClick={() => console.warn("[pwcli-test] console.warn triggered at", new Date().toISOString(), { source: "network-page", level: "warn" })}
              className="flex items-center gap-2 px-4 py-2 bg-amber-900/30 hover:bg-amber-900/50 text-amber-400 text-sm font-medium rounded-lg transition-all border border-amber-800/30"
            >
              <AlertTriangle size={14} aria-hidden="true" />
              console.warn
            </button>
            <button
              data-testid="console-error"
              aria-label="Trigger console.error"
              onClick={() => console.error("[pwcli-test] console.error triggered at", new Date().toISOString(), { source: "network-page", level: "error", stack: "fake stack trace" })}
              className="flex items-center gap-2 px-4 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 text-sm font-medium rounded-lg transition-all border border-red-800/30"
            >
              <XCircle size={14} aria-hidden="true" />
              console.error
            </button>
            <button
              data-testid="console-info"
              aria-label="Trigger console.info"
              onClick={() => console.info("[pwcli-test] console.info triggered at", new Date().toISOString(), { source: "network-page", level: "info" })}
              className="flex items-center gap-2 px-4 py-2 bg-blue-900/30 hover:bg-blue-900/50 text-blue-400 text-sm font-medium rounded-lg transition-all border border-blue-800/30"
            >
              console.info
            </button>
            <button
              data-testid="throw-error"
              aria-label="Trigger unhandled JavaScript error"
              onClick={() => {
                setTimeout(() => {
                  throw new Error("[pwcli-test] Simulated unhandled error from network page");
                }, 0);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-red-700 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-all"
            >
              <XCircle size={14} aria-hidden="true" />
              Throw JS Error
            </button>
          </div>
        </div>

        {/* SSE stream */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 card-glow">
          <h2 className="text-sm font-semibold text-zinc-200 mb-2">Server-Sent Events</h2>
          <p className="text-xs text-zinc-500 mb-4">
            Endpoint: <code className="text-indigo-400">/api/stream</code> — emits JSON every second
          </p>
          <SseDemo />
        </div>
      </div>
    </div>
  );
}

function SseDemo() {
  const [events, setEvents] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [es, setEs] = useState<EventSource | null>(null);

  function connect() {
    if (es) { es.close(); }
    const source = new EventSource("/api/stream");
    setEs(source);
    setConnected(true);
    setEvents([]);

    source.onmessage = (e) => {
      setEvents((prev) => [...prev.slice(-9), e.data]);
    };
    source.onerror = () => {
      setConnected(false);
      source.close();
    };
  }

  function disconnect() {
    es?.close();
    setEs(null);
    setConnected(false);
  }

  return (
    <div>
      <div className="flex gap-2 mb-3">
        <button
          data-testid="sse-connect"
          aria-label="Connect to SSE stream"
          onClick={connect}
          disabled={connected}
          className="px-3 py-1.5 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-all"
        >
          Connect
        </button>
        <button
          data-testid="sse-disconnect"
          aria-label="Disconnect from SSE stream"
          onClick={disconnect}
          disabled={!connected}
          className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 text-xs font-medium rounded-lg transition-all"
        >
          Disconnect
        </button>
        <div className="flex items-center gap-1.5 ml-2">
          <div
            className={`w-2 h-2 rounded-full ${connected ? "bg-green-500 animate-pulse" : "bg-zinc-700"}`}
            aria-hidden="true"
          />
          <span
            className="text-xs text-zinc-500"
            data-testid="sse-status"
            aria-live="polite"
          >
            {connected ? "Connected" : "Disconnected"}
          </span>
        </div>
      </div>

      <div
        data-testid="sse-events"
        aria-label="SSE event log"
        aria-live="polite"
        className="bg-zinc-950 rounded-lg p-3 h-32 overflow-y-auto font-mono text-xs space-y-0.5"
      >
        {events.length === 0 ? (
          <span className="text-zinc-700">No events yet. Click Connect to start.</span>
        ) : (
          events.map((ev, i) => (
            <div key={i} className="text-green-400">
              {ev}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
