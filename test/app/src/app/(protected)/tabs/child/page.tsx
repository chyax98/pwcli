"use client";

import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function TabChildPage() {
  const [loadTime] = useState(new Date().toISOString());
  const [referrer, setReferrer] = useState("");
  const [hasOpener, setHasOpener] = useState<boolean | null>(null);

  useEffect(() => {
    setReferrer(document.referrer || "direct");
    setHasOpener(!!window.opener);
  }, []);

  return (
    <div
      data-testid="tabs-child-page"
      aria-label="Child tab page"
      className="min-h-screen bg-zinc-950 p-8"
    >
      <div className="max-w-lg mx-auto">
        <Link
          href="/tabs"
          data-testid="back-to-tabs"
          aria-label="Back to tabs page"
          className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors mb-6"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Back to Multi-Tab
        </Link>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 card-glow">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-600/30 flex items-center justify-center">
              <ExternalLink size={18} className="text-violet-400" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-zinc-100">Child Tab Page</h1>
              <p className="text-xs text-zinc-500">Opened from /tabs</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="bg-zinc-800 rounded-xl p-4">
              <div className="text-xs font-medium text-zinc-500 mb-1">Page URL</div>
              <div
                className="text-sm text-zinc-200 font-mono"
                data-testid="child-url"
                aria-label="Current page URL"
              >
                /tabs/child
              </div>
            </div>

            <div className="bg-zinc-800 rounded-xl p-4">
              <div className="text-xs font-medium text-zinc-500 mb-1">Loaded at</div>
              <div
                className="text-sm text-zinc-200 font-mono"
                data-testid="child-load-time"
                aria-label="Page load time"
              >
                {loadTime}
              </div>
            </div>

            <div className="bg-zinc-800 rounded-xl p-4">
              <div className="text-xs font-medium text-zinc-500 mb-1">Referrer</div>
              <div
                className="text-sm text-zinc-200 font-mono truncate"
                data-testid="child-referrer"
                aria-label="Page referrer"
              >
                {referrer}
              </div>
            </div>

            <div className="bg-zinc-800 rounded-xl p-4">
              <div className="text-xs font-medium text-zinc-500 mb-1">Opener available</div>
              <div
                className="text-sm font-mono"
                data-testid="child-opener"
                aria-label="Opener available"
              >
                {hasOpener === null ? (
                  <span className="text-zinc-600">Checking…</span>
                ) : hasOpener ? (
                  <span className="text-green-400">Yes (window.opener exists)</span>
                ) : (
                  <span className="text-zinc-500">No (noopener or direct)</span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-zinc-800">
            <p className="text-xs text-zinc-600 text-center">
              This page is used by pwcli to test multi-tab browser automation scenarios.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
