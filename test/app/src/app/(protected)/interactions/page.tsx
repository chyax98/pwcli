"use client";

import { AlertTriangle, CheckCircle, Download, GripVertical, Loader2 } from "lucide-react";
import { type MouseEvent, useEffect, useRef, useState } from "react";

const INITIAL_LIST = [
  { id: "item-1", label: "First item" },
  { id: "item-2", label: "Second item" },
  { id: "item-3", label: "Third item" },
  { id: "item-4", label: "Fourth item" },
  { id: "item-5", label: "Fifth item" },
];

export default function InteractionsPage() {
  const [dblClickCount, setDblClickCount] = useState(0);
  const [hoverVisible, setHoverVisible] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [contextAction, setContextAction] = useState("");
  const [pressedKey, setPressedKey] = useState("");
  const [listItems, setListItems] = useState(INITIAL_LIST);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [scrollTriggered, setScrollTriggered] = useState(false);
  const [loadingBtn, setLoadingBtn] = useState(false);
  const scrollSentinelRef = useRef<HTMLDivElement>(null);
  const keyAreaRef = useRef<HTMLDivElement>(null);

  // Scroll trigger
  useEffect(() => {
    const sentinel = scrollSentinelRef.current;
    if (!sentinel) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !scrollTriggered) {
          setScrollTriggered(true);
        }
      },
      { threshold: 0.5 },
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [scrollTriggered]);

  // Keyboard handler
  useEffect(() => {
    const area = keyAreaRef.current;
    if (!area) return;
    function onKey(e: globalThis.KeyboardEvent) {
      setPressedKey(e.key === " " ? "Space" : e.key);
    }
    area.addEventListener("keydown", onKey);
    return () => area.removeEventListener("keydown", onKey);
  }, []);

  function handleContextMenu(e: MouseEvent<HTMLDivElement>) {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
    setContextAction("");
  }

  function handleContextAction(action: string) {
    setContextAction(action);
    setContextMenu(null);
  }

  // Drag and drop
  function handleDragStart(index: number) {
    setDragIndex(index);
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    const newItems = [...listItems];
    const [removed] = newItems.splice(dragIndex, 1);
    newItems.splice(index, 0, removed);
    setListItems(newItems);
    setDragIndex(index);
  }

  function handleDragEnd() {
    setDragIndex(null);
  }

  function handleDownload() {
    const content = `pwcli test download\nGenerated: ${new Date().toISOString()}\nContent: Hello from interactions page!`;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "test-download.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleLoadingButton() {
    setLoadingBtn(true);
    await new Promise((r) => setTimeout(r, 2000));
    setLoadingBtn(false);
  }

  return (
    <div
      data-testid="interactions-page"
      aria-label="Interactions test page"
      onClick={() => {
        if (contextMenu) setContextMenu(null);
      }}
    >
      <h1 className="text-2xl font-bold text-zinc-100 mb-1">Interactions</h1>
      <p className="text-sm text-zinc-500 mb-8">Test all browser interaction patterns.</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Buttons */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 card-glow">
          <h2 className="text-sm font-semibold text-zinc-200 mb-4">Button States</h2>
          <div className="flex flex-wrap gap-3">
            <button
              data-testid="btn-primary"
              aria-label="Primary button"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-all duration-150"
            >
              Primary
            </button>
            <button
              data-testid="btn-danger"
              aria-label="Danger button"
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-all duration-150"
            >
              Danger
            </button>
            <button
              data-testid="btn-secondary"
              aria-label="Secondary button"
              className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-sm font-medium rounded-lg transition-all duration-150"
            >
              Secondary
            </button>
            <button
              data-testid="btn-disabled"
              disabled
              aria-label="Disabled button"
              aria-disabled="true"
              className="px-4 py-2 bg-zinc-800 text-zinc-600 text-sm font-medium rounded-lg cursor-not-allowed"
            >
              Disabled
            </button>
            <button
              data-testid="btn-loading"
              aria-label="Loading button"
              aria-busy={loadingBtn}
              onClick={handleLoadingButton}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-70 text-white text-sm font-medium rounded-lg transition-all duration-150"
              disabled={loadingBtn}
            >
              {loadingBtn ? (
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              ) : (
                <CheckCircle size={14} aria-hidden="true" />
              )}
              {loadingBtn ? "Loading…" : "Click to Load"}
            </button>
          </div>
        </div>

        {/* Hover + Double-click */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 card-glow space-y-4">
          <h2 className="text-sm font-semibold text-zinc-200">Hover & Double-click</h2>

          <div className="relative inline-block">
            <div
              data-testid="hover-target"
              aria-label="Hover to reveal tooltip"
              onMouseEnter={() => setHoverVisible(true)}
              onMouseLeave={() => setHoverVisible(false)}
              className="px-4 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-zinc-300 cursor-default transition-colors select-none"
            >
              Hover over me
            </div>
            {hoverVisible && (
              <div
                data-testid="hover-tooltip"
                role="tooltip"
                className="absolute left-0 top-full mt-1 px-3 py-1.5 bg-zinc-700 border border-zinc-600 rounded-lg text-xs text-zinc-200 whitespace-nowrap z-10 animate-fade-in"
              >
                Tooltip visible! Hover detected.
              </div>
            )}
          </div>

          <div>
            <div
              data-testid="dblclick-target"
              aria-label={`Double-click counter: ${dblClickCount}`}
              onDoubleClick={() => setDblClickCount((v) => v + 1)}
              className="px-4 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-zinc-300 cursor-pointer transition-colors select-none"
            >
              Double-click me
            </div>
            <div
              className="text-xs text-zinc-500 mt-1"
              data-testid="dblclick-count"
              aria-live="polite"
            >
              Double-clicks: <span className="text-indigo-400 font-bold">{dblClickCount}</span>
            </div>
          </div>
        </div>

        {/* Context menu */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 card-glow">
          <h2 className="text-sm font-semibold text-zinc-200 mb-4">Right-click Context Menu</h2>
          <div
            data-testid="context-menu-area"
            aria-label="Right-click area for context menu"
            onContextMenu={handleContextMenu}
            className="flex items-center justify-center h-24 border-2 border-dashed border-zinc-700 rounded-xl text-sm text-zinc-500 select-none cursor-context-menu hover:border-zinc-600 hover:text-zinc-400 transition-colors"
          >
            Right-click here
          </div>
          {contextAction && (
            <div
              className="mt-2 text-xs text-zinc-400"
              data-testid="context-action-result"
              aria-live="polite"
            >
              Action: <span className="text-indigo-400 font-medium">{contextAction}</span>
            </div>
          )}
        </div>

        {/* Keyboard area */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 card-glow">
          <h2 className="text-sm font-semibold text-zinc-200 mb-4">Keyboard Events</h2>
          <div
            ref={keyAreaRef}
            data-testid="keyboard-area"
            tabIndex={0}
            role="textbox"
            aria-label="Key capture area — click then press any key"
            aria-live="polite"
            aria-atomic="true"
            className="flex items-center justify-center h-24 bg-zinc-800 rounded-xl border-2 border-zinc-700 focus:border-indigo-500 focus:outline-none cursor-pointer transition-colors select-none"
          >
            {pressedKey ? (
              <div className="text-center">
                <div className="text-xs text-zinc-500 mb-1">Last key pressed:</div>
                <div
                  className="px-3 py-1 bg-zinc-700 rounded-lg text-indigo-400 font-mono font-bold text-sm"
                  data-testid="pressed-key"
                >
                  {pressedKey}
                </div>
              </div>
            ) : (
              <span className="text-sm text-zinc-600">Click here, then press any key</span>
            )}
          </div>
        </div>

        {/* Drag and drop sortable */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 card-glow">
          <h2 className="text-sm font-semibold text-zinc-200 mb-4">Drag & Drop Sort</h2>
          <ul
            data-testid="draggable-list"
            aria-label="Draggable sortable list"
            className="space-y-2"
          >
            {listItems.map((item, index) => (
              <li
                key={item.id}
                id={item.id}
                data-testid={`drag-item-${index}`}
                draggable
                aria-label={`${item.label} (drag to reorder)`}
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`flex items-center gap-3 px-3 py-2.5 bg-zinc-800 rounded-lg text-sm text-zinc-300 cursor-grab active:cursor-grabbing transition-all duration-150 select-none ${dragIndex === index ? "opacity-50 ring-1 ring-indigo-500" : "hover:bg-zinc-700"}`}
              >
                <GripVertical
                  size={14}
                  className="text-zinc-600 flex-shrink-0"
                  aria-hidden="true"
                />
                {item.label}
              </li>
            ))}
          </ul>
          <div className="mt-2 text-xs text-zinc-600" data-testid="list-order" aria-live="polite">
            Order: {listItems.map((i) => i.id).join(" → ")}
          </div>
        </div>

        {/* Download + Scroll trigger */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 card-glow space-y-4">
          <h2 className="text-sm font-semibold text-zinc-200">Download & Scroll</h2>

          <div className="space-y-2">
            <button
              data-testid="download-txt"
              aria-label="Download text file"
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium rounded-lg transition-all duration-150 w-full"
            >
              <Download size={14} aria-hidden="true" />
              Download text file (client-side)
            </button>
            <a
              href="/api/download"
              data-testid="download-server-txt"
              aria-label="Download server-generated text file"
              download
              className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium rounded-lg transition-all duration-150 w-full"
            >
              <Download size={14} aria-hidden="true" />
              Download server file (txt)
            </a>
            <a
              href="/api/download?format=json"
              data-testid="download-server-json"
              aria-label="Download server-generated JSON file"
              download
              className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium rounded-lg transition-all duration-150 w-full"
            >
              <Download size={14} aria-hidden="true" />
              Download server file (json)
            </a>
          </div>

          <div className="border-t border-zinc-800 pt-4">
            <p className="text-xs text-zinc-500 mb-2">
              Scroll sentinel (scroll into view to trigger)
            </p>
            <div className="h-32 overflow-y-auto bg-zinc-800 rounded-lg p-3 relative">
              <div className="h-24 flex items-start text-xs text-zinc-600">
                Scroll down in this box →
              </div>
              <div
                ref={scrollSentinelRef}
                data-testid="scroll-sentinel"
                className="h-8 flex items-center justify-center"
              >
                {scrollTriggered ? (
                  <span
                    className="text-xs text-green-400 font-medium"
                    data-testid="scroll-triggered"
                    aria-live="polite"
                  >
                    Scroll triggered!
                  </span>
                ) : (
                  <span className="text-xs text-zinc-600">Bottom sentinel</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Context menu portal */}
      {contextMenu && (
        <div
          data-testid="context-menu"
          role="menu"
          aria-label="Context menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-50 bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl py-1 min-w-[160px]"
        >
          {["Copy", "Cut", "Paste", "Select All", "Inspect"].map((action) => (
            <button
              key={action}
              role="menuitem"
              data-testid={`context-${action.toLowerCase().replace(" ", "-")}`}
              onClick={() => handleContextAction(action)}
              className="w-full text-left px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-colors"
            >
              {action}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
