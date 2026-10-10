/** The student's note as plain text, with the quoted evidence phrases marked. */
export function HighlightedAnswer({ text, phrases }: { text: string; phrases: string[] | null }) {
  const found = (phrases ?? [])
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const i = text.toLowerCase().indexOf(p.toLowerCase());
      return i === -1 ? null : { start: i, end: i + p.length };
    })
    .filter((r): r is { start: number; end: number } => r !== null)
    .sort((a, b) => a.start - b.start);

  // Merge overlaps so each character is marked at most once.
  const ranges: { start: number; end: number }[] = [];
  for (const r of found) {
    const last = ranges[ranges.length - 1];
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end);
    else ranges.push({ ...r });
  }

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  ranges.forEach((r, i) => {
    if (r.start > cursor) parts.push(text.slice(cursor, r.start));
    parts.push(
      <mark key={i} className="rounded-sm bg-primary/30 px-[2px] text-ink">
        {text.slice(r.start, r.end)}
      </mark>
    );
    cursor = r.end;
  });
  if (cursor < text.length) parts.push(text.slice(cursor));

  // React escapes everything here: the note is untrusted student text.
  return <p className="whitespace-pre-wrap text-sm leading-relaxed">{parts}</p>;
}
