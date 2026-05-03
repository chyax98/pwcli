"use client";

import { useState } from "react";
import { ExternalLink, Globe, Monitor, ArrowUpRight } from "lucide-react";

export default function TabsPage() {
  const [popupResult, setPopupResult] = useState("");

  function openWindowOpen(url: string, name: string) {
    const w = window.open(url, name, "width=800,height=600,noopener,noreferrer");
    setPopupResult(w ? `Opened window: ${name}` : "Popup blocked");
  }

  return (
    <div data-testid="tabs-page" aria-label="Multi-tab test page">
      <h1 className="text-2xl font-bold text-zinc-100 mb-1">Multi-Tab Scenarios</h1>
      <p className="text-sm text-zinc-500 mb-8">Test opening links in new tabs and popup windows.</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* target=_blank links */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 card-glow">
          <h2 className="text-sm font-semibold text-zinc-200 mb-4">Open in New Tab (target=_blank)</h2>
          <div className="space-y-3">
            <a
              href="/tabs/child"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="link-new-tab-child"
              aria-label="Open child page in new tab"
              className="flex items-center gap-3 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-zinc-300 hover:text-zinc-100 transition-all duration-150 group"
            >
              <ExternalLink size={16} className="text-zinc-500 group-hover:text-indigo-400 transition-colors" aria-hidden="true" />
              Open /tabs/child in new tab
              <ArrowUpRight size={12} className="ml-auto text-zinc-600 group-hover:text-zinc-400" aria-hidden="true" />
            </a>

            <a
              href="/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="link-new-tab-dashboard"
              aria-label="Open dashboard in new tab"
              className="flex items-center gap-3 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-zinc-300 hover:text-zinc-100 transition-all duration-150 group"
            >
              <Monitor size={16} className="text-zinc-500 group-hover:text-indigo-400 transition-colors" aria-hidden="true" />
              Open /dashboard in new tab
              <ArrowUpRight size={12} className="ml-auto text-zinc-600 group-hover:text-zinc-400" aria-hidden="true" />
            </a>

            <a
              href="/forms"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="link-new-tab-forms"
              aria-label="Open forms page in new tab"
              className="flex items-center gap-3 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-zinc-300 hover:text-zinc-100 transition-all duration-150 group"
            >
              <ExternalLink size={16} className="text-zinc-500 group-hover:text-indigo-400 transition-colors" aria-hidden="true" />
              Open /forms in new tab
              <ArrowUpRight size={12} className="ml-auto text-zinc-600 group-hover:text-zinc-400" aria-hidden="true" />
            </a>

            <a
              href="https://playwright.dev"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="link-external"
              aria-label="Open Playwright documentation in new tab (external)"
              className="flex items-center gap-3 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-zinc-300 hover:text-zinc-100 transition-all duration-150 group"
            >
              <Globe size={16} className="text-zinc-500 group-hover:text-green-400 transition-colors" aria-hidden="true" />
              Open playwright.dev (external)
              <span className="ml-auto px-1.5 py-0.5 text-xs bg-zinc-700 text-zinc-500 rounded">external</span>
            </a>
          </div>
        </div>

        {/* window.open */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 card-glow">
          <h2 className="text-sm font-semibold text-zinc-200 mb-4">window.open Popup Windows</h2>
          <div className="space-y-3">
            <button
              data-testid="btn-window-open-child"
              aria-label="Open child page as popup window"
              onClick={() => openWindowOpen("/tabs/child", "child-popup")}
              className="w-full flex items-center gap-3 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-zinc-300 hover:text-zinc-100 transition-all duration-150 text-left group"
            >
              <Monitor size={16} className="text-zinc-500 group-hover:text-violet-400 transition-colors" aria-hidden="true" />
              window.open(/tabs/child)
            </button>

            <button
              data-testid="btn-window-open-dashboard"
              aria-label="Open dashboard as popup window"
              onClick={() => openWindowOpen("/dashboard", "dashboard-popup")}
              className="w-full flex items-center gap-3 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-zinc-300 hover:text-zinc-100 transition-all duration-150 text-left group"
            >
              <Monitor size={16} className="text-zinc-500 group-hover:text-violet-400 transition-colors" aria-hidden="true" />
              window.open(/dashboard)
            </button>

            <button
              data-testid="btn-window-open-blank"
              aria-label="Open about:blank as popup window"
              onClick={() => openWindowOpen("about:blank", "blank-popup")}
              className="w-full flex items-center gap-3 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-zinc-300 hover:text-zinc-100 transition-all duration-150 text-left group"
            >
              <ExternalLink size={16} className="text-zinc-500 group-hover:text-violet-400 transition-colors" aria-hidden="true" />
              window.open(about:blank)
            </button>

            {popupResult && (
              <div
                data-testid="popup-result"
                aria-live="polite"
                className="text-xs text-zinc-500 bg-zinc-800 rounded-lg px-3 py-2"
              >
                {popupResult}
              </div>
            )}
          </div>
        </div>

        {/* Info card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 card-glow lg:col-span-2">
          <h2 className="text-sm font-semibold text-zinc-200 mb-3">Testing Notes</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-zinc-500">
            <div className="bg-zinc-800 rounded-lg p-3">
              <div className="text-zinc-300 font-medium mb-1">New Tab Detection</div>
              Use <code className="text-indigo-400">pw page list</code> to enumerate all open pages after clicking a new-tab link.
            </div>
            <div className="bg-zinc-800 rounded-lg p-3">
              <div className="text-zinc-300 font-medium mb-1">Popup Handling</div>
              Playwright auto-captures popup events. Use <code className="text-indigo-400">page.waitForEvent(&apos;popup&apos;)</code> to intercept them.
            </div>
            <div className="bg-zinc-800 rounded-lg p-3">
              <div className="text-zinc-300 font-medium mb-1">Session Scope</div>
              All tabs within a session share the same browser context and cookies.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
