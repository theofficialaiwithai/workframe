// A small, safe markdown reader for the digest text that goes into emails:
// headings, bullet and numbered lists, paragraphs, **bold** and *italic*.
// Parsing is line by line, so "## Heading" is recognised even when the next
// line follows with no blank line (which is how Claude writes it). Everything
// is escaped when it is turned into HTML.

export type Inline = { text: string; bold?: boolean; italic?: boolean };
export type Block =
  | { type: "h"; level: number; inline: Inline[] }
  | { type: "ul" | "ol"; items: Inline[][] }
  | { type: "p"; lines: Inline[][] };

export function parseInline(s: string): Inline[] {
  const out: Inline[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(s)) !== null) {
    if (m.index > last) out.push({ text: s.slice(last, m.index) });
    const raw = m[0];
    if (raw.startsWith("**")) out.push({ text: raw.slice(2, -2), bold: true });
    else out.push({ text: raw.slice(1, -1), italic: true });
    last = m.index + raw.length;
  }
  if (last < s.length) out.push({ text: s.slice(last) });
  return out.length > 0 ? out : [{ text: s }];
}

export function parseBlocks(md: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: { type: "ul" | "ol"; items: string[] } | null = null;

  const flushPara = () => {
    if (para.length > 0) blocks.push({ type: "p", lines: para.map(parseInline) });
    para = [];
  };
  const flushList = () => {
    if (list) blocks.push({ type: list.type, items: list.items.map(parseInline) });
    list = null;
  };

  for (const line of md.replace(/\r\n/g, "\n").split("\n")) {
    const text = line.trimEnd();
    const heading = /^(#{1,6})\s+(.*)$/.exec(text);
    const bullet = /^\s*[-*+]\s+(.*)$/.exec(text);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(text);

    if (text.trim() === "" || /^\s*([-*_])\1{2,}\s*$/.test(text)) {
      flushPara();
      flushList();
    } else if (heading) {
      flushPara();
      flushList();
      blocks.push({ type: "h", level: heading[1].length, inline: parseInline(heading[2].trim()) });
    } else if (bullet || numbered) {
      flushPara();
      const type = bullet ? "ul" : "ol";
      if (list && list.type !== type) flushList();
      if (!list) list = { type, items: [] };
      list.items.push((bullet ?? numbered)![1].trim());
    } else {
      flushList();
      para.push(text.trim());
    }
  }
  flushPara();
  flushList();
  return blocks;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const inlineHtml = (parts: Inline[]) =>
  parts
    .map((p) => {
      const t = esc(p.text);
      return p.bold ? `<strong>${t}</strong>` : p.italic ? `<em>${t}</em>` : t;
    })
    .join("");

const INK = "#141412";

/** Markdown to email-safe HTML with inline styles. All text is escaped. */
export function markdownToEmailHtml(md: string): string {
  return parseBlocks(md)
    .map((b) => {
      if (b.type === "h") {
        const size = b.level === 1 ? 22 : b.level === 2 ? 18 : 16;
        const top = b.level === 1 ? 0 : 10;
        return `<p style="margin:${top}px 0 10px;font-size:${size}px;font-weight:700;line-height:1.3;color:${INK};">${inlineHtml(b.inline)}</p>`;
      }
      if (b.type === "p") {
        return `<p style="margin:0 0 20px;font-size:16px;line-height:1.5;color:${INK};">${b.lines.map(inlineHtml).join("<br>")}</p>`;
      }
      const tag = b.type;
      const items = b.items.map((i) => `<li style="margin:0 0 6px;">${inlineHtml(i)}</li>`).join("");
      return `<${tag} style="margin:0 0 20px;padding-left:20px;font-size:16px;line-height:1.5;color:${INK};">${items}</${tag}>`;
    })
    .join("");
}

const plain = (parts: Inline[]) => parts.map((p) => p.text).join("");

/** The same text for the plain-text half of an email: no # or ** left over. */
export function markdownToPlainText(md: string): string {
  return parseBlocks(md)
    .map((b) => {
      if (b.type === "h") return plain(b.inline);
      if (b.type === "p") return b.lines.map(plain).join("\n");
      return b.items.map((i, n) => (b.type === "ul" ? `- ${plain(i)}` : `${n + 1}. ${plain(i)}`)).join("\n");
    })
    .join("\n\n");
}
