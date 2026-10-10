"use client";

import { useRef, useState } from "react";

/** Fenced code block in a lesson: JetBrains Mono on a light surface, with a copy button. */
export function CodeBlock({ children }: { children?: React.ReactNode }) {
  const ref = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(ref.current?.innerText ?? "");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="not-prose my-u3 overflow-hidden rounded-lg border border-border bg-surface-alt">
      <div className="flex items-center justify-between border-b border-border px-u2">
        <span className="font-mono text-xs text-muted">python</span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex min-h-tap items-center px-u1 text-sm font-medium text-ink hover:underline"
        >
          {copied ? "Copied" : "Copy code"}
        </button>
      </div>
      <pre
        ref={ref}
        className="overflow-x-auto p-u2 font-mono text-sm leading-relaxed text-ink"
      >
        {children}
      </pre>
    </div>
  );
}
