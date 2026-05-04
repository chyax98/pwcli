"use client";

import { useEffect, useState } from "react";

export default function IframeContentPage() {
  const [inputValue, setInputValue] = useState("");
  const [result, setResult] = useState("");
  const [hostMessage, setHostMessage] = useState("");

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.data && typeof event.data === "object" && event.data.type === "host-message") {
        const msg = event.data.message ?? "(empty)";
        setHostMessage(msg);
        // Reply back to host
        if (event.source) {
          (event.source as Window).postMessage(
            { type: "iframe-reply", message: `iframe received: "${msg}"` },
            event.origin,
          );
        }
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const submitted = inputValue.trim() || "(empty)";
    setResult(`Submitted: ${submitted}`);
    // Notify host
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(
        { type: "iframe-reply", message: `Form submitted with: "${submitted}"` },
        window.location.origin,
      );
    }
  }

  return (
    <html lang="en" className="dark">
      <body className="bg-zinc-900 text-zinc-100 min-h-screen p-6">
        <div
          data-testid="iframe-content-page"
          aria-label="iframe content page"
          className="max-w-md mx-auto"
        >
          <h1 className="text-lg font-bold text-zinc-100 mb-1">iframe Content</h1>
          <p className="text-xs text-zinc-500 mb-6">
            Same-origin iframe. Submit form or receive postMessage from host.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4 mb-6">
            <div>
              <label
                htmlFor="iframe-content-input"
                className="block text-xs text-zinc-400 mb-1 font-medium"
              >
                Name
              </label>
              <input
                id="iframe-content-input"
                data-testid="iframe-content-input"
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                aria-label="Name input inside iframe"
              />
            </div>

            <button
              type="submit"
              data-testid="iframe-content-submit"
              aria-label="Submit iframe form"
              className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-all duration-150"
            >
              Submit
            </button>
          </form>

          <div
            data-testid="iframe-content-result"
            aria-label="Iframe form result"
            aria-live="polite"
            className="min-h-[40px] px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-300 font-mono mb-4"
          >
            {result || <span className="text-zinc-600">Result will appear here after submit.</span>}
          </div>

          {hostMessage && (
            <div
              data-testid="iframe-content-host-message"
              aria-label="Message received from host"
              aria-live="polite"
              className="px-3 py-2 bg-indigo-900/30 border border-indigo-700/40 rounded-lg text-sm text-indigo-300"
            >
              <span className="text-xs text-indigo-500 block mb-0.5 font-medium">From host:</span>
              {hostMessage}
            </div>
          )}
        </div>
      </body>
    </html>
  );
}
