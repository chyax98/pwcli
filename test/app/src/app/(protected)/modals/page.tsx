"use client";

import { AlertTriangle, CheckCircle, Info, X, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

interface Toast {
  id: string;
  type: "success" | "error" | "info" | "warning";
  message: string;
  exiting?: boolean;
}

let toastIdCounter = 0;

export default function ModalsPage() {
  const [alertResult, setAlertResult] = useState<string>("");
  const [confirmResult, setConfirmResult] = useState<string>("");
  const [promptResult, setPromptResult] = useState<string>("");
  const [modalOpen, setModalOpen] = useState(false);
  const [nestedOpen, setNestedOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  function addToast(type: Toast["type"], message: string) {
    const id = String(++toastIdCounter);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 350);
    }, 3000);
  }

  function dismissToast(id: string) {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 350);
  }

  // Escape key closes modals
  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") {
        if (nestedOpen) {
          setNestedOpen(false);
          return;
        }
        if (modalOpen) {
          setModalOpen(false);
          return;
        }
        if (drawerOpen) setDrawerOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [modalOpen, nestedOpen, drawerOpen]);

  const toastIcon = { success: CheckCircle, error: XCircle, warning: AlertTriangle, info: Info };
  const toastColors = {
    success: "border-green-700 bg-green-950/80 text-green-300",
    error: "border-red-700 bg-red-950/80 text-red-300",
    warning: "border-amber-700 bg-amber-950/80 text-amber-300",
    info: "border-blue-700 bg-blue-950/80 text-blue-300",
  };

  return (
    <div data-testid="modals-page" aria-label="Modals test page">
      <h1 className="text-2xl font-bold text-zinc-100 mb-1">Modals & Popups</h1>
      <p className="text-sm text-zinc-500 mb-8">
        Test browser dialogs, custom modals, drawers, and toasts.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Browser dialogs */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 card-glow">
          <h2 className="text-sm font-semibold text-zinc-200 mb-4">Browser Dialogs</h2>
          <div className="space-y-3">
            <button
              data-testid="trigger-alert"
              aria-label="Trigger browser alert"
              onClick={() => {
                window.alert("This is a test alert from pwcli test app!");
                setAlertResult("Alert dismissed");
              }}
              className="w-full px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium rounded-lg transition-all duration-150 text-left"
            >
              Trigger alert()
            </button>
            {alertResult && (
              <div data-testid="alert-result" aria-live="polite" className="text-xs text-green-400">
                {alertResult}
              </div>
            )}

            <button
              data-testid="trigger-confirm"
              aria-label="Trigger browser confirm dialog"
              onClick={() => {
                const result = window.confirm("Do you confirm this action?");
                setConfirmResult(result ? "Confirmed: true" : "Confirmed: false");
              }}
              className="w-full px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium rounded-lg transition-all duration-150 text-left"
            >
              Trigger confirm()
            </button>
            {confirmResult && (
              <div
                data-testid="confirm-result"
                aria-live="polite"
                className="text-xs text-blue-400"
              >
                {confirmResult}
              </div>
            )}

            <button
              data-testid="trigger-prompt"
              aria-label="Trigger browser prompt dialog"
              onClick={() => {
                const result = window.prompt("Enter your name:", "Test User");
                setPromptResult(result !== null ? `Entered: "${result}"` : "Prompt cancelled");
              }}
              className="w-full px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium rounded-lg transition-all duration-150 text-left"
            >
              Trigger prompt()
            </button>
            {promptResult && (
              <div
                data-testid="prompt-result"
                aria-live="polite"
                className="text-xs text-violet-400"
              >
                {promptResult}
              </div>
            )}
          </div>
        </div>

        {/* Custom Modal */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 card-glow">
          <h2 className="text-sm font-semibold text-zinc-200 mb-4">Custom Modals</h2>
          <div className="space-y-3">
            <button
              data-testid="open-modal"
              aria-label="Open custom modal"
              aria-haspopup="dialog"
              onClick={() => setModalOpen(true)}
              className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-all duration-150"
            >
              Open Custom Modal
            </button>
            <button
              data-testid="open-drawer"
              aria-label="Open bottom drawer"
              aria-haspopup="dialog"
              onClick={() => setDrawerOpen(true)}
              className="w-full px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-all duration-150"
            >
              Open Bottom Drawer
            </button>
          </div>
        </div>

        {/* Toast controls */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 card-glow lg:col-span-2">
          <h2 className="text-sm font-semibold text-zinc-200 mb-4">Toast Notifications</h2>
          <div className="flex flex-wrap gap-3">
            {(["success", "error", "warning", "info"] as const).map((type) => (
              <button
                key={type}
                data-testid={`toast-${type}`}
                aria-label={`Show ${type} toast`}
                onClick={() =>
                  addToast(type, `This is a ${type} notification — auto-dismisses in 3s`)
                }
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-150 capitalize ${
                  type === "success"
                    ? "bg-green-700 hover:bg-green-600 text-white"
                    : type === "error"
                      ? "bg-red-700 hover:bg-red-600 text-white"
                      : type === "warning"
                        ? "bg-amber-700 hover:bg-amber-600 text-white"
                        : "bg-blue-700 hover:bg-blue-600 text-white"
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Custom Modal overlay */}
      {modalOpen && (
        <div
          data-testid="modal-overlay"
          aria-modal="true"
          role="dialog"
          aria-label="Custom modal dialog"
          aria-labelledby="modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
        >
          <div
            data-testid="modal-content"
            className="bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl w-full max-w-md animate-slide-up"
          >
            <div className="flex items-center justify-between p-5 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Info size={18} className="text-indigo-400" aria-hidden="true" />
                <h2 id="modal-title" className="text-base font-semibold text-zinc-100">
                  Custom Modal
                </h2>
              </div>
              <button
                data-testid="modal-close"
                aria-label="Close modal"
                onClick={() => setModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-all"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm text-zinc-400 mb-4">
                This is a custom modal dialog. It supports animations, nested modals, and keyboard
                navigation.
              </p>
              <div className="bg-zinc-800 rounded-lg p-3 text-xs text-zinc-500 font-mono mb-4">
                data-testid=&quot;modal-content&quot;
              </div>
              <button
                data-testid="open-nested-modal"
                aria-label="Open nested modal"
                aria-haspopup="dialog"
                onClick={() => setNestedOpen(true)}
                className="w-full px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-all"
              >
                Open Nested Modal
              </button>
            </div>
            <div className="flex justify-end gap-2 px-5 pb-5">
              <button
                data-testid="modal-cancel"
                aria-label="Cancel"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium rounded-lg transition-all"
              >
                Cancel
              </button>
              <button
                data-testid="modal-confirm"
                aria-label="Confirm modal action"
                onClick={() => {
                  setModalOpen(false);
                  addToast("success", "Modal action confirmed!");
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-all"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nested Modal */}
      {nestedOpen && (
        <div
          data-testid="nested-modal-overlay"
          aria-modal="true"
          role="dialog"
          aria-label="Nested modal dialog"
          aria-labelledby="nested-modal-title"
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setNestedOpen(false);
          }}
        >
          <div
            data-testid="nested-modal-content"
            className="bg-zinc-800 border border-zinc-600 rounded-2xl shadow-2xl w-full max-w-sm animate-slide-up"
          >
            <div className="flex items-center justify-between p-4 border-b border-zinc-700">
              <h2 id="nested-modal-title" className="text-sm font-semibold text-zinc-100">
                Nested Modal
              </h2>
              <button
                data-testid="nested-modal-close"
                aria-label="Close nested modal"
                onClick={() => setNestedOpen(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700 transition-all"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
            <div className="p-4">
              <p className="text-sm text-zinc-400">This is a modal nested inside another modal!</p>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-zinc-700">
              <button
                data-testid="nested-modal-close-btn"
                aria-label="Close nested modal"
                onClick={() => setNestedOpen(false)}
                className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-xs font-medium rounded-lg transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drawer */}
      {drawerOpen && (
        <>
          <div
            data-testid="drawer-overlay"
            aria-hidden="true"
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={() => setDrawerOpen(false)}
          />
          <div
            data-testid="drawer-content"
            role="dialog"
            aria-modal="true"
            aria-label="Bottom drawer"
            aria-labelledby="drawer-title"
            className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-900 border-t border-zinc-700 rounded-t-2xl shadow-2xl animate-slide-up p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 id="drawer-title" className="text-base font-semibold text-zinc-100">
                Bottom Drawer
              </h2>
              <button
                data-testid="drawer-close"
                aria-label="Close drawer"
                onClick={() => setDrawerOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-all"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            <p className="text-sm text-zinc-400 mb-4">
              This drawer slides up from the bottom. Useful for mobile-style interactions.
            </p>
            <div className="grid grid-cols-3 gap-3">
              {["Share", "Copy Link", "Report"].map((action) => (
                <button
                  key={action}
                  data-testid={`drawer-action-${action.toLowerCase().replace(" ", "-")}`}
                  aria-label={action}
                  onClick={() => {
                    setDrawerOpen(false);
                    addToast("info", `${action} clicked`);
                  }}
                  className="px-3 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-lg transition-all"
                >
                  {action}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Toast container */}
      <div
        data-testid="toast-container"
        aria-label="Notifications"
        aria-live="polite"
        aria-atomic="false"
        className="fixed bottom-4 right-4 z-[70] space-y-2 pointer-events-none"
      >
        {toasts.map((toast) => {
          const Icon = toastIcon[toast.type];
          return (
            <div
              key={toast.id}
              data-testid={`toast-item-${toast.id}`}
              role="alert"
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl text-sm pointer-events-auto min-w-[280px] max-w-sm ${toastColors[toast.type]} ${toast.exiting ? "toast-exit" : "toast-enter"}`}
            >
              <Icon size={16} className="flex-shrink-0" aria-hidden="true" />
              <span className="flex-1">{toast.message}</span>
              <button
                aria-label="Dismiss notification"
                onClick={() => dismissToast(toast.id)}
                className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
