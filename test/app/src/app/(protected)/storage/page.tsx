"use client";

import { useState, useCallback } from "react";
import { HardDrive, Cookie, RefreshCw } from "lucide-react";

interface StorageEntry {
  key: string;
  value: string;
}

function useLocalStorage() {
  const getAll = useCallback((): StorageEntry[] => {
    if (typeof window === "undefined") return [];
    const entries: StorageEntry[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k !== null) entries.push({ key: k, value: localStorage.getItem(k) ?? "" });
    }
    return entries;
  }, []);
  return { getAll };
}

function useSessionStorage() {
  const getAll = useCallback((): StorageEntry[] => {
    if (typeof window === "undefined") return [];
    const entries: StorageEntry[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k !== null) entries.push({ key: k, value: sessionStorage.getItem(k) ?? "" });
    }
    return entries;
  }, []);
  return { getAll };
}

function StorageSection({
  title,
  icon,
  keyTestId,
  valueTestId,
  setTestId,
  getTestId,
  deleteTestId,
  clearTestId,
  displayTestId,
  onSet,
  onGet,
  onDelete,
  onClear,
  entries,
  lastGet,
}: {
  title: string;
  icon: React.ReactNode;
  keyTestId: string;
  valueTestId: string;
  setTestId: string;
  getTestId?: string;
  deleteTestId?: string;
  clearTestId?: string;
  displayTestId: string;
  onSet: (k: string, v: string) => void;
  onGet?: (k: string) => void;
  onDelete?: (k: string) => void;
  onClear?: () => void;
  entries: StorageEntry[];
  lastGet?: string | null;
}) {
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");

  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-6">
      <h2 className="text-sm font-semibold text-zinc-200 mb-4 flex items-center gap-2">
        {icon}
        {title}
      </h2>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-xs text-zinc-400 mb-1 font-medium">Key</label>
          <input
            data-testid={keyTestId}
            type="text"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="key"
            aria-label={`${title} key input`}
            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-400 mb-1 font-medium">Value</label>
          <input
            data-testid={valueTestId}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="value"
            aria-label={`${title} value input`}
            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          data-testid={setTestId}
          aria-label={`Set ${title} item`}
          onClick={() => { onSet(key, value); setKey(""); setValue(""); }}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition-all duration-150"
        >
          Set
        </button>
        {onGet && getTestId && (
          <button
            data-testid={getTestId}
            aria-label={`Get ${title} item`}
            onClick={() => onGet(key)}
            className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-xs font-medium rounded-lg transition-all duration-150"
          >
            Get
          </button>
        )}
        {onDelete && deleteTestId && (
          <button
            data-testid={deleteTestId}
            aria-label={`Delete ${title} item`}
            onClick={() => onDelete(key)}
            className="px-4 py-2 bg-red-900/50 hover:bg-red-800/70 text-red-300 text-xs font-medium rounded-lg border border-red-800/30 transition-all duration-150"
          >
            Delete
          </button>
        )}
        {onClear && clearTestId && (
          <button
            data-testid={clearTestId}
            aria-label={`Clear all ${title}`}
            onClick={onClear}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs font-medium rounded-lg border border-zinc-700 transition-all duration-150"
          >
            Clear All
          </button>
        )}
      </div>

      {lastGet !== undefined && lastGet !== null && (
        <div
          aria-label="Last get result"
          aria-live="polite"
          className="mb-3 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-xs font-mono text-zinc-300"
        >
          <span className="text-zinc-500">get result: </span>
          {lastGet === "" ? <span className="text-zinc-600">(not found)</span> : lastGet}
        </div>
      )}

      <div
        data-testid={displayTestId}
        aria-label={`${title} entries`}
        aria-live="polite"
        className="bg-zinc-900 rounded-lg border border-zinc-700 divide-y divide-zinc-800 min-h-[60px]"
      >
        {entries.length === 0 ? (
          <p className="text-xs text-zinc-600 p-3">No entries stored.</p>
        ) : (
          entries.map(({ key: k, value: v }) => (
            <div key={k} className="flex items-center gap-2 px-3 py-2">
              <span className="text-xs font-mono text-indigo-400 truncate max-w-[40%]">{k}</span>
              <span className="text-zinc-600 text-xs">=</span>
              <span className="text-xs font-mono text-zinc-300 truncate flex-1">{v}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function StoragePage() {
  const { getAll: getAllLS } = useLocalStorage();
  const { getAll: getAllSS } = useSessionStorage();

  const [lsEntries, setLsEntries] = useState<StorageEntry[]>([]);
  const [ssEntries, setSsEntries] = useState<StorageEntry[]>([]);
  const [lsLastGet, setLsLastGet] = useState<string | null>(null);

  // Cookie state
  const [cookieName, setCookieName] = useState("");
  const [cookieValue, setCookieValue] = useState("");
  const [cookieDisplay, setCookieDisplay] = useState<string>("");
  const [cookieStatus, setCookieStatus] = useState<string>("");

  function refreshLS() { setLsEntries(getAllLS()); }
  function refreshSS() { setSsEntries(getAllSS()); }

  function lsSet(k: string, v: string) {
    if (!k) return;
    localStorage.setItem(k, v);
    setLsEntries(getAllLS());
  }
  function lsGet(k: string) {
    const v = localStorage.getItem(k);
    setLsLastGet(v ?? "");
  }
  function lsDelete(k: string) {
    if (!k) return;
    localStorage.removeItem(k);
    setLsEntries(getAllLS());
  }
  function lsClear() {
    localStorage.clear();
    setLsEntries([]);
    setLsLastGet(null);
  }

  function ssSet(k: string, v: string) {
    if (!k) return;
    sessionStorage.setItem(k, v);
    setSsEntries(getAllSS());
  }

  async function cookieSet() {
    if (!cookieName) return;
    try {
      const res = await fetch("/api/storage/cookie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: cookieName, value: cookieValue, maxAge: 3600 }),
      });
      const data = await res.json();
      setCookieStatus(res.ok ? "Set OK" : `Error: ${data.error}`);
      await cookieRead();
    } catch (e) {
      setCookieStatus(`Error: ${e}`);
    }
  }

  async function cookieRead() {
    try {
      const res = await fetch("/api/storage/cookie");
      const data = await res.json();
      setCookieDisplay(JSON.stringify(data.cookies ?? {}, null, 2));
    } catch (e) {
      setCookieDisplay(`Error: ${e}`);
    }
  }

  return (
    <div data-testid="storage-page" aria-label="Storage test page">
      <h1 className="text-2xl font-bold text-zinc-100 mb-1">Storage Tests</h1>
      <p className="text-sm text-zinc-500 mb-8">
        Read and write localStorage, sessionStorage, and cookies.
      </p>

      <div className="space-y-6">
        {/* localStorage */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-zinc-200">localStorage</h2>
            <button
              onClick={refreshLS}
              aria-label="Refresh localStorage display"
              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <RefreshCw size={12} aria-hidden="true" />
              Refresh
            </button>
          </div>
          <StorageSection
            title="localStorage"
            icon={<HardDrive size={14} className="text-indigo-400" aria-hidden="true" />}
            keyTestId="ls-key"
            valueTestId="ls-value"
            setTestId="ls-set"
            getTestId="ls-get"
            deleteTestId="ls-delete"
            clearTestId="ls-clear"
            displayTestId="ls-display"
            onSet={lsSet}
            onGet={lsGet}
            onDelete={lsDelete}
            onClear={lsClear}
            entries={lsEntries}
            lastGet={lsLastGet}
          />
        </div>

        {/* sessionStorage */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-zinc-200">sessionStorage</h2>
            <button
              onClick={refreshSS}
              aria-label="Refresh sessionStorage display"
              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <RefreshCw size={12} aria-hidden="true" />
              Refresh
            </button>
          </div>
          <StorageSection
            title="sessionStorage"
            icon={<HardDrive size={14} className="text-violet-400" aria-hidden="true" />}
            keyTestId="ss-key"
            valueTestId="ss-value"
            setTestId="ss-set"
            displayTestId="ss-display"
            onSet={ssSet}
            entries={ssEntries}
          />
        </div>

        {/* Cookies */}
        <div>
          <h2 className="text-base font-semibold text-zinc-200 mb-3">Cookies</h2>
          <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Cookie size={14} className="text-amber-400" aria-hidden="true" />
              <span className="text-sm font-semibold text-zinc-200">Cookie Manager</span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1 font-medium">Cookie Name</label>
                <input
                  data-testid="cookie-name"
                  type="text"
                  value={cookieName}
                  onChange={(e) => setCookieName(e.target.value)}
                  placeholder="cookie-name"
                  aria-label="Cookie name input"
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1 font-medium">Cookie Value</label>
                <input
                  data-testid="cookie-value"
                  type="text"
                  value={cookieValue}
                  onChange={(e) => setCookieValue(e.target.value)}
                  placeholder="cookie-value"
                  aria-label="Cookie value input"
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex gap-2 mb-4">
              <button
                data-testid="cookie-set"
                aria-label="Set cookie via API"
                onClick={cookieSet}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg transition-all duration-150"
              >
                Set Cookie
              </button>
              <button
                aria-label="Read all cookies via API"
                onClick={cookieRead}
                className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-xs font-medium rounded-lg transition-all duration-150"
              >
                Read Cookies
              </button>
            </div>

            {cookieStatus && (
              <div
                aria-live="polite"
                className="mb-3 text-xs text-zinc-400 font-mono"
              >
                {cookieStatus}
              </div>
            )}

            <div
              data-testid="cookie-display"
              aria-label="Cookie display"
              aria-live="polite"
              className="bg-zinc-900 rounded-lg border border-zinc-700 p-3 min-h-[60px]"
            >
              {cookieDisplay ? (
                <pre className="text-xs font-mono text-zinc-300 whitespace-pre-wrap">{cookieDisplay}</pre>
              ) : (
                <p className="text-xs text-zinc-600">Click &quot;Read Cookies&quot; to fetch via API.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
