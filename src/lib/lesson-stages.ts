// The eight body headings every v2 lesson has, in order (v2 PRD Section 2.2).
// Pure functions: used by the lesson page and by `npm run lessons:validate`.

export const STAGES = [
  "Goal",
  "Predict",
  "Run",
  "Investigate",
  "Modify",
  "Make",
  "Check",
  "When it breaks",
] as const;
export type StageName = (typeof STAGES)[number];

export interface Section {
  title: string;
  body: string;
}

/**
 * Splits a lesson body at its `## ` headings. A `## ` line inside a fenced code
 * block (a Python comment, for example) is NOT a heading. Text before the first
 * heading is returned as `preamble`.
 */
export function splitSections(body: string): { preamble: string; sections: Section[] } {
  const sections: Section[] = [];
  const preamble: string[] = [];
  let current: { title: string; lines: string[] } | null = null;
  let fence: string | null = null;

  for (const line of body.replace(/\r\n/g, "\n").split("\n")) {
    const fenceMatch = /^\s*(```+|~~~+)/.exec(line);
    if (fenceMatch) {
      if (fence === null) fence = fenceMatch[1][0];
      else if (fenceMatch[1][0] === fence) fence = null;
    }
    const heading = fence === null ? /^##\s+(.+?)\s*$/.exec(line) : null;
    if (heading) {
      if (current) sections.push({ title: current.title, body: current.lines.join("\n").trim() });
      current = { title: heading[1], lines: [] };
    } else if (current) {
      current.lines.push(line);
    } else {
      preamble.push(line);
    }
  }
  if (current) sections.push({ title: current.title, body: current.lines.join("\n").trim() });
  return { preamble: preamble.join("\n").trim(), sections };
}

/** The body of one named section, or null. */
export function sectionBody(sections: Section[], name: StageName): string | null {
  const found = sections.filter((s) => s.title === name);
  return found.length > 0 ? found[0].body : null;
}

/** True when the lesson body has all eight headings, once each, in order. */
export function hasAllStagesInOrder(sections: Section[]): boolean {
  return (
    sections.length === STAGES.length && STAGES.every((name, i) => sections[i].title === name)
  );
}
