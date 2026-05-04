"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, ArrowUpDown } from "lucide-react";

// Skeleton component
function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-zinc-800 rounded-lg ${className}`} />;
}

// Accordion
const ACCORDION_ITEMS = [
  { id: "a1", title: "What is pwcli?", content: "pwcli is an Agent-first Playwright CLI that exposes browser facts, browser actions, and failure evidence in a stable CLI shape." },
  { id: "a2", title: "How does session management work?", content: "Sessions are persistent browser contexts managed by pwcli. Each session has a name and can be attached, created, or recreated as needed." },
  { id: "a3", title: "What is the observe command?", content: "The observe command takes a screenshot and returns page state, including title, URL, and visible elements for agent navigation." },
  { id: "a4", title: "How do I handle authentication?", content: "Use the auth provider system or pw code to script site-specific login flows. Sessions persist cookies and storage." },
  { id: "a5", title: "What is pw code used for?", content: "pw code is the escape hatch for site-specific or complex Playwright scripts that require programmatic control beyond standard commands." },
];

// Tabs
const TAB_ITEMS = [
  { id: "overview", label: "Overview", content: "This is the overview tab content. It contains a summary of the dynamic page capabilities." },
  { id: "details", label: "Details", content: "Detailed information tab. Here you would see more specific data, metrics, and diagnostic information." },
  { id: "settings", label: "Settings", content: "Settings panel tab. Configure behavior, preferences, and test environment options here." },
  { id: "logs", label: "Logs", content: "Log output tab. Shows recent system events, errors, warnings, and debug information." },
];

// Generate table data
function generateTableData(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `User ${String.fromCharCode(65 + (i % 26))}${Math.floor(i / 26) || ""}`,
    email: `user${i + 1}@test.com`,
    role: ["Admin", "User", "Viewer", "Editor"][i % 4],
    status: i % 5 === 0 ? "Inactive" : "Active",
    joined: new Date(Date.now() - i * 86400000 * 3).toLocaleDateString(),
  }));
}

const TABLE_DATA = generateTableData(25);
const PAGE_SIZE = 5;

type SortKey = keyof (typeof TABLE_DATA)[0];
type SortDir = "asc" | "desc";

export default function DynamicPage() {
  const [skeletonLoaded, setSkeletonLoaded] = useState(false);
  const [infiniteItems, setInfiniteItems] = useState<string[]>(Array.from({ length: 10 }, (_, i) => `Item ${i + 1}`));
  const [counter, setCounter] = useState(0);
  const [openAccordion, setOpenAccordion] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [tablePage, setTablePage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("id");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Skeleton load
  useEffect(() => {
    const t = setTimeout(() => setSkeletonLoaded(true), 2000);
    return () => clearTimeout(t);
  }, []);

  // Counter (SSE-style)
  useEffect(() => {
    const t = setInterval(() => setCounter((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Infinite scroll
  const loadMore = useCallback(async () => {
    if (isLoadingMore) return;
    setIsLoadingMore(true);
    await new Promise((r) => setTimeout(r, 800));
    setInfiniteItems((prev) => [
      ...prev,
      ...Array.from({ length: 10 }, (_, i) => `Item ${prev.length + i + 1}`),
    ]);
    setIsLoadingMore(false);
  }, [isLoadingMore]);

  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel) return;
    const obs = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { threshold: 0.1 }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [loadMore]);

  // Table sort
  const sortedData = [...TABLE_DATA].sort((a, b) => {
    const av = String(a[sortKey]);
    const bv = String(b[sortKey]);
    return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
  });

  const pagedData = sortedData.slice((tablePage - 1) * PAGE_SIZE, tablePage * PAGE_SIZE);
  const totalPages = Math.ceil(TABLE_DATA.length / PAGE_SIZE);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setTablePage(1);
  }

  return (
    <div data-testid="dynamic-page" aria-label="Dynamic content test page">
      <h1 className="text-2xl font-bold text-zinc-100 mb-1">Dynamic Content</h1>
      <p className="text-sm text-zinc-500 mb-8">Test async loading, infinite scroll, live counters, and more.</p>

      <div className="space-y-6">
        {/* Skeleton loader */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 card-glow">
          <h2 className="text-sm font-semibold text-zinc-200 mb-4">Skeleton Loader (2s delay)</h2>
          {!skeletonLoaded ? (
            <div data-testid="skeleton-loading" aria-label="Loading content" aria-busy="true" className="space-y-3">
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/6" />
              <div className="grid grid-cols-3 gap-3 mt-2">
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </div>
            </div>
          ) : (
            <div data-testid="skeleton-loaded" aria-label="Content loaded" className="animate-fade-in">
              <h3 className="text-base font-semibold text-zinc-100 mb-2">Content Loaded!</h3>
              <p className="text-sm text-zinc-400 mb-3">
                The skeleton screen has been replaced with actual content after a 2-second delay. This simulates async data loading.
              </p>
              <div className="grid grid-cols-3 gap-3">
                {["42 users", "128 events", "99.9% uptime"].map((stat) => (
                  <div key={stat} className="bg-zinc-800 rounded-lg p-3 text-center">
                    <div className="text-sm font-bold text-indigo-400">{stat.split(" ")[0]}</div>
                    <div className="text-xs text-zinc-500">{stat.split(" ").slice(1).join(" ")}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Live counter */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 card-glow">
          <h2 className="text-sm font-semibold text-zinc-200 mb-4">Live Counter (SSE-style)</h2>
          <div className="flex items-center gap-4">
            <div
              data-testid="live-counter"
              aria-label={`Live counter: ${counter}`}
              aria-live="polite"
              aria-atomic="true"
              className="text-5xl font-bold text-indigo-400 tabular-nums font-mono"
            >
              {counter}
            </div>
            <div>
              <div className="text-xs text-zinc-500">Ticks per second: 1</div>
              <div className="text-xs text-zinc-500">Running since page load</div>
              <div className="flex items-center gap-1 mt-1">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" aria-hidden="true" />
                <span className="text-xs text-green-400">Live</span>
              </div>
            </div>
          </div>
        </div>

        {/* Accordion */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl card-glow">
          <div className="p-4 border-b border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-200">Accordion (FAQ)</h2>
          </div>
          <div
            data-testid="accordion"
            aria-label="Frequently asked questions"
            className="divide-y divide-zinc-800"
          >
            {ACCORDION_ITEMS.map((item) => {
              const isOpen = openAccordion === item.id;
              return (
                <div key={item.id} data-testid={`accordion-item-${item.id}`}>
                  <button
                    data-testid={`accordion-trigger-${item.id}`}
                    aria-expanded={isOpen}
                    aria-controls={`accordion-panel-${item.id}`}
                    onClick={() => setOpenAccordion(isOpen ? null : item.id)}
                    className="w-full flex items-center justify-between px-5 py-4 text-sm text-left font-medium text-zinc-200 hover:bg-zinc-800/50 transition-colors"
                  >
                    {item.title}
                    {isOpen
                      ? <ChevronUp size={16} className="text-zinc-500 flex-shrink-0" aria-hidden="true" />
                      : <ChevronDown size={16} className="text-zinc-500 flex-shrink-0" aria-hidden="true" />
                    }
                  </button>
                  {isOpen && (
                    <div
                      id={`accordion-panel-${item.id}`}
                      data-testid={`accordion-panel-${item.id}`}
                      role="region"
                      aria-label={item.title}
                      className="px-5 pb-4 text-sm text-zinc-400 animate-fade-in"
                    >
                      {item.content}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Tab panel */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl card-glow">
          <div
            role="tablist"
            aria-label="Content sections"
            data-testid="tab-list"
            className="flex border-b border-zinc-800 px-4 pt-2 gap-1"
          >
            {TAB_ITEMS.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                id={`tab-${tab.id}`}
                data-testid={`tab-${tab.id}`}
                aria-selected={activeTab === tab.id}
                aria-controls={`tabpanel-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all duration-150 border-b-2 ${
                  activeTab === tab.id
                    ? "text-indigo-400 border-indigo-500 bg-indigo-500/5"
                    : "text-zinc-500 border-transparent hover:text-zinc-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {TAB_ITEMS.map((tab) => (
            <div
              key={tab.id}
              role="tabpanel"
              id={`tabpanel-${tab.id}`}
              data-testid={`tabpanel-${tab.id}`}
              aria-labelledby={`tab-${tab.id}`}
              hidden={activeTab !== tab.id}
              className="p-5"
            >
              <p className="text-sm text-zinc-400">{tab.content}</p>
            </div>
          ))}
        </div>

        {/* Paginated sortable table */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl card-glow overflow-hidden">
          <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-200">Users Table (paged + sortable)</h2>
            <span className="text-xs text-zinc-500">{TABLE_DATA.length} records</span>
          </div>
          <div className="overflow-x-auto">
            <table
              data-testid="data-table"
              aria-label="Users data table"
              className="w-full text-sm"
            >
              <thead>
                <tr className="border-b border-zinc-800">
                  {(["id", "name", "email", "role", "status", "joined"] as SortKey[]).map((key) => (
                    <th
                      key={key}
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-300 select-none transition-colors"
                    >
                      <button
                        data-testid={`sort-${key}`}
                        aria-label={`Sort by ${key} ${sortKey === key && sortDir === "asc" ? "descending" : "ascending"}`}
                        onClick={() => handleSort(key)}
                        className="flex items-center gap-1 group"
                      >
                        {key}
                        <ArrowUpDown
                          size={12}
                          className={`${sortKey === key ? "text-indigo-400" : "text-zinc-700 group-hover:text-zinc-500"}`}
                          aria-hidden="true"
                        />
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody data-testid="table-body" className="divide-y divide-zinc-800/50">
                {pagedData.map((row) => (
                  <tr
                    key={row.id}
                    data-testid={`table-row-${row.id}`}
                    className="hover:bg-zinc-800/30 transition-colors"
                  >
                    <td className="px-4 py-3 text-zinc-500 font-mono text-xs">{row.id}</td>
                    <td className="px-4 py-3 text-zinc-200 font-medium">{row.name}</td>
                    <td className="px-4 py-3 text-zinc-400">{row.email}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        {row.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${row.status === "Active" ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-zinc-700 text-zinc-500"}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">{row.joined}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          <div
            data-testid="table-pagination"
            className="flex items-center justify-between px-4 py-3 border-t border-zinc-800"
          >
            <span className="text-xs text-zinc-500" data-testid="pagination-info" aria-live="polite">
              Page {tablePage} of {totalPages} ({TABLE_DATA.length} records)
            </span>
            <div className="flex gap-1" role="navigation" aria-label="Table pagination">
              <button
                data-testid="pagination-prev"
                aria-label="Previous page"
                disabled={tablePage === 1}
                onClick={() => setTablePage((p) => Math.max(1, p - 1))}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft size={14} aria-hidden="true" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  data-testid={`pagination-page-${page}`}
                  aria-label={`Page ${page}`}
                  aria-current={tablePage === page ? "page" : undefined}
                  onClick={() => setTablePage(page)}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium transition-all ${tablePage === page ? "bg-indigo-600 text-white" : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"}`}
                >
                  {page}
                </button>
              ))}
              <button
                data-testid="pagination-next"
                aria-label="Next page"
                disabled={tablePage === totalPages}
                onClick={() => setTablePage((p) => Math.min(totalPages, p + 1))}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight size={14} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        {/* Infinite scroll */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 card-glow">
          <h2 className="text-sm font-semibold text-zinc-200 mb-4">
            Infinite Scroll (<span data-testid="infinite-count" aria-live="polite">{infiniteItems.length}</span> items loaded)
          </h2>
          <div
            data-testid="infinite-list"
            aria-label="Infinite scroll list"
            className="h-64 overflow-y-auto space-y-1.5 pr-1"
          >
            {infiniteItems.map((item, i) => (
              <div
                key={i}
                data-testid={`infinite-item-${i}`}
                className="flex items-center gap-3 px-3 py-2 bg-zinc-800 rounded-lg text-sm text-zinc-300"
              >
                <span className="text-zinc-600 font-mono text-xs w-6 text-right">{i + 1}</span>
                {item}
              </div>
            ))}
            <div
              ref={loadMoreRef}
              data-testid="infinite-sentinel"
              className="flex items-center justify-center py-4"
            >
              {isLoadingMore && (
                <div
                  className="w-5 h-5 border-2 border-zinc-700 border-t-indigo-500 rounded-full animate-spin"
                  aria-label="Loading more items"
                  aria-live="polite"
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
