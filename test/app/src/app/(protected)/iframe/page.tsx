"use client";

import { MessageSquare, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export default function IframePage() {
  const [messageInput, setMessageInput] = useState("");
  const [iframeResponse, setIframeResponse] = useState<string>("");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      // Accept messages from same origin only
      if (event.origin !== window.location.origin) return;
      if (event.data && typeof event.data === "object" && event.data.type === "iframe-reply") {
        setIframeResponse(event.data.message ?? "");
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  function sendToIframe() {
    if (!iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(
      { type: "host-message", message: messageInput },
      window.location.origin,
    );
  }

  return (
    <div data-testid="iframe-container" aria-label="iframe test page">
      <h1 className="text-2xl font-bold text-zinc-100 mb-1">iframe Scenarios</h1>
      <p className="text-sm text-zinc-500 mb-8">
        Test same-origin iframe interaction, form submission, and postMessage communication.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* iframe embed */}
        <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-zinc-200 mb-4 flex items-center gap-2">
            <MessageSquare size={14} className="text-indigo-400" aria-hidden="true" />
            Embedded iframe
          </h2>
          <iframe
            ref={iframeRef}
            src="/iframe/content"
            data-testid="iframe-el"
            title="iframe content"
            height={300}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950"
            aria-label="Embedded iframe with form"
          />
        </div>

        {/* postMessage panel */}
        <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-zinc-200 mb-4 flex items-center gap-2">
            <Send size={14} className="text-indigo-400" aria-hidden="true" />
            postMessage Communication
          </h2>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="iframe-message-input"
                className="block text-xs text-zinc-400 mb-1 font-medium"
              >
                Message to send to iframe
              </label>
              <input
                id="iframe-message-input"
                data-testid="iframe-message-input"
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendToIframe()}
                placeholder="Type a message..."
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                aria-label="Message to send to iframe"
              />
            </div>

            <button
              data-testid="iframe-send"
              aria-label="Send postMessage to iframe"
              onClick={sendToIframe}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-all duration-150"
            >
              <Send size={14} aria-hidden="true" />
              Send to iframe
            </button>

            <div>
              <div className="text-xs text-zinc-400 mb-1 font-medium">Response from iframe</div>
              <div
                data-testid="iframe-response"
                aria-label="Response received from iframe"
                aria-live="polite"
                className="min-h-[60px] px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-300 font-mono"
              >
                {iframeResponse ? (
                  iframeResponse
                ) : (
                  <span className="text-zinc-600">
                    No response yet. Send a message or submit the iframe form.
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 p-3 bg-zinc-900 rounded-lg border border-zinc-700">
            <p className="text-xs text-zinc-500">
              The iframe at <code className="text-indigo-400">/iframe/content</code> listens for
              <code className="text-indigo-400"> host-message</code> events and replies with
              <code className="text-indigo-400"> iframe-reply</code>. Form submit inside iframe also
              triggers a reply.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
