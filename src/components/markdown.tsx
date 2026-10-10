import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders markdown as real headings, lists and tables. react-markdown does not
 * render raw HTML, so model-written or student-influenced text cannot inject
 * markup. Tables scroll sideways inside their own box on narrow screens.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose max-w-none text-ink prose-headings:font-heading prose-headings:text-ink prose-a:text-ink prose-strong:text-ink prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ children }) => (
            <div className="not-prose my-u2 overflow-x-auto rounded-lg border border-border bg-surface">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-border bg-surface-alt p-u1 align-top font-bold">{children}</th>
          ),
          td: ({ children }) => <td className="border-b border-border p-u1 align-top">{children}</td>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
