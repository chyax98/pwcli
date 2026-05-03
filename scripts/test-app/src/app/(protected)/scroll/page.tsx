"use client";

import { useState, useEffect, useRef } from "react";
import { ArrowUp, AlignLeft } from "lucide-react";

const SECTIONS = Array.from({ length: 20 }, (_, i) => ({
  id: i + 1,
  title: `Section ${i + 1}`,
  content: [
    "This is a test section for pwcli scroll automation scenarios. Each section contains enough content to require scrolling.",
    "Playwright agents can detect this section by its stable data-testid attribute and verify scroll position.",
    "Use pw snapshot or pw screenshot to confirm the viewport position before and after scroll actions.",
    i % 3 === 0
      ? "This section has additional content to vary height and simulate real-world document layouts. Scroll verification is a core agent capability."
      : "Short section variant to add layout variation.",
  ].join(" "),
}));

export default function ScrollPage() {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showToTop, setShowToTop] = useState(false);
  const [tocOpen, setTocOpen] = useState(true);
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleScroll() {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? Math.min(100, Math.round((scrollTop / docHeight) * 100)) : 0;
      setScrollProgress(progress);
      setShowToTop(scrollTop > 300);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  function scrollToSection(id: number) {
    const el = document.getElementById(`section-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div data-testid="scroll-page" aria-label="Scroll and anchor test page">
      {/* Sticky header */}
      <div className="sticky top-14 z-20 bg-zinc-900/95 border-b border-zinc-800 backdrop-blur-sm -mx-6 px-6 py-3 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setTocOpen((v) => !v)}
              aria-label="Toggle table of contents"
              aria-expanded={tocOpen}
              className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <AlignLeft size={14} aria-hidden="true" />
              TOC
            </button>
            <span className="text-zinc-700">|</span>
            <h1 className="text-base font-bold text-zinc-100">Scroll & Anchor Test</h1>
          </div>
          {/* Progress bar in header */}
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <div
              data-testid="scroll-progress"
              aria-label={`Scroll progress: ${scrollProgress}%`}
              aria-valuenow={scrollProgress}
              aria-valuemin={0}
              aria-valuemax={100}
              role="progressbar"
              className="w-24 h-1.5 bg-zinc-700 rounded-full overflow-hidden"
            >
              <div
                ref={progressRef}
                className="h-full bg-indigo-500 rounded-full transition-all duration-100"
                style={{ width: `${scrollProgress}%` }}
              />
            </div>
            <span>{scrollProgress}%</span>
          </div>
        </div>
      </div>

      <div className="flex gap-6">
        {/* TOC sidebar */}
        {tocOpen && (
          <nav
            data-testid="toc"
            aria-label="Table of contents"
            className="hidden lg:block w-48 flex-shrink-0"
          >
            <div className="sticky top-40 bg-zinc-800 border border-zinc-700 rounded-xl p-4 max-h-[70vh] overflow-y-auto">
              <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Contents</h2>
              <ol className="space-y-1">
                {SECTIONS.map((section) => (
                  <li key={section.id}>
                    <button
                      data-testid={`toc-link-${section.id}`}
                      aria-label={`Jump to ${section.title}`}
                      onClick={() => scrollToSection(section.id)}
                      className="w-full text-left text-xs text-zinc-400 hover:text-indigo-400 py-1 px-2 rounded hover:bg-zinc-700/50 transition-colors"
                    >
                      {section.title}
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          </nav>
        )}

        {/* Main content */}
        <div className="flex-1 space-y-8">
          <p className="text-sm text-zinc-500">
            This page tests scroll detection, anchor navigation, and progress tracking.
            Use <code className="text-indigo-400">pw scroll</code> commands and verify position
            with <code className="text-indigo-400">pw screenshot</code>.
          </p>

          {SECTIONS.map((section) => (
            <section
              key={section.id}
              id={`section-${section.id}`}
              data-testid={`section-${section.id}`}
              aria-label={section.title}
              className="bg-zinc-800 border border-zinc-700 rounded-xl p-6 scroll-mt-32"
            >
              <h2 className="text-lg font-bold text-zinc-100 mb-3">
                <span className="text-indigo-400 font-mono text-sm mr-2">#{section.id}</span>
                {section.title}
              </h2>
              <p className="text-sm text-zinc-400 leading-relaxed">{section.content}</p>
              {section.id % 5 === 0 && (
                <div className="mt-4 flex gap-2">
                  <span className="px-2 py-0.5 text-xs bg-indigo-600/20 text-indigo-400 border border-indigo-600/30 rounded-full">
                    Milestone section
                  </span>
                  <span className="px-2 py-0.5 text-xs bg-zinc-700 text-zinc-400 rounded-full">
                    Section {section.id} of {SECTIONS.length}
                  </span>
                </div>
              )}
            </section>
          ))}

          {/* Bottom sentinel */}
          <div
            data-testid="scroll-bottom-sentinel"
            aria-label="Scroll bottom sentinel"
            className="py-8 text-center border-t border-zinc-800"
          >
            <p className="text-sm text-zinc-600">
              End of content — scroll sentinel reached. {SECTIONS.length} sections loaded.
            </p>
          </div>
        </div>
      </div>

      {/* Scroll to top button */}
      {showToTop && (
        <button
          data-testid="scroll-to-top"
          aria-label="Scroll to top"
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-lg transition-all duration-150"
        >
          <ArrowUp size={14} aria-hidden="true" />
          Scroll to Top
        </button>
      )}
    </div>
  );
}
