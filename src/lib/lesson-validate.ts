// Validates one lesson file against the v2 template (v2 PRD Section 2.2).
// Pure: the caller says whether a public file exists. Used by
// `npm run lessons:validate` and by its tests.
import matter from "gray-matter";
import { splitSections, STAGES } from "@/lib/lesson-stages";

export const LESSON_STAGE_VALUES = ["worked", "faded", "scaffolded"] as const;
export const MARKER = "PRACTITIONER_TO_CONFIRM";

export interface ValidationResult {
  errors: string[];
  warnings: string[];
  /** How many PRACTITIONER_TO_CONFIRM markers the file still has. */
  markers: number;
}

const isText = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export function validateLesson(
  raw: string,
  fileExists: (publicPath: string) => boolean
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const markers = raw.split(MARKER).length - 1;

  let data: Record<string, unknown>;
  let content: string;
  try {
    const parsed = matter(raw);
    data = parsed.data as Record<string, unknown>;
    content = parsed.content;
  } catch (err) {
    return { errors: [`Frontmatter could not be read: ${(err as Error).message}`], warnings, markers };
  }

  // ---- frontmatter
  if (!isText(data.title)) errors.push("Missing frontmatter field: title");
  if (!Number.isInteger(data.order) || (data.order as number) < 1) {
    errors.push("Missing or invalid frontmatter field: order (a whole number, 1 or more)");
  }
  if (!Number.isInteger(data.minutes) || (data.minutes as number) < 1 || (data.minutes as number) > 240) {
    errors.push("Missing or invalid frontmatter field: minutes (a whole number, 1 to 240)");
  }
  if (!isText(data.stage)) {
    errors.push("Missing frontmatter field: stage (worked, faded or scaffolded)");
  } else if (!(LESSON_STAGE_VALUES as readonly string[]).includes(data.stage)) {
    errors.push(`Invalid stage "${data.stage}": must be worked, faded or scaffolded`);
  }
  if (!isText(data.colabUrl) || !/^https:\/\//.test(data.colabUrl as string)) {
    errors.push("Missing or invalid frontmatter field: colabUrl (an https link)");
  }
  if (!isText(data.datasetPath) || !(data.datasetPath as string).startsWith("/")) {
    errors.push("Missing or invalid frontmatter field: datasetPath (a path starting with /)");
  } else if (!fileExists(data.datasetPath as string)) {
    errors.push(`datasetPath points at a file that does not exist: ${data.datasetPath}`);
  }

  if (!Array.isArray(data.newConcepts)) {
    errors.push("Missing frontmatter field: newConcepts (a list of at most 2)");
  } else {
    if (data.newConcepts.length > 2) {
      errors.push(`newConcepts has ${data.newConcepts.length} items: a lesson may introduce at most 2`);
    }
    if (!data.newConcepts.every(isText)) errors.push("newConcepts must contain only non-empty text");
  }

  if (!isObject(data.predict) || !isText(data.predict.question)) {
    errors.push("Missing frontmatter field: predict.question");
  }
  if (!isObject(data.expected) || !isText(data.expected.description)) {
    errors.push("Missing frontmatter field: expected.description");
  }
  if (!isObject(data.expected) || !isText(data.expected.sampleOutputPath)) {
    errors.push("Missing frontmatter field: expected.sampleOutputPath");
  } else if (!fileExists(data.expected.sampleOutputPath as string)) {
    errors.push(`expected.sampleOutputPath points at a file that does not exist: ${data.expected.sampleOutputPath}`);
  }
  if (!isObject(data.recall) || !isText(data.recall.question)) {
    errors.push("Missing frontmatter field: recall.question");
  }
  if (!isObject(data.recall) || !isText(data.recall.answer)) {
    errors.push("Missing frontmatter field: recall.answer");
  }

  if (!Array.isArray(data.errors) || data.errors.length === 0) {
    errors.push("Missing frontmatter field: errors (at least one message, cause and fix)");
  } else {
    data.errors.forEach((e, i) => {
      for (const key of ["message", "cause", "fix"]) {
        if (!isObject(e) || !isText(e[key])) errors.push(`errors[${i}] is missing "${key}"`);
      }
    });
  }

  // ---- body headings: all eight, once each, in order
  const { sections } = splitSections(content);
  const titles = sections.map((s) => s.title);
  for (const name of STAGES) {
    const count = titles.filter((t) => t === name).length;
    if (count === 0) errors.push(`Missing body heading: ## ${name}`);
    if (count > 1) errors.push(`Body heading appears ${count} times: ## ${name}`);
  }
  for (const t of titles) {
    if (!(STAGES as readonly string[]).includes(t)) errors.push(`Unexpected body heading: ## ${t}`);
  }
  const known = titles.filter((t) => (STAGES as readonly string[]).includes(t));
  const expectedOrder = STAGES.filter((s) => known.includes(s));
  if (known.length === expectedOrder.length && known.some((t, i) => t !== expectedOrder[i])) {
    errors.push(`Body headings are out of order. They must run: ${STAGES.join(", ")}`);
  }
  for (const s of sections) {
    const visible = s.body.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").trim();
    if ((STAGES as readonly string[]).includes(s.title) && visible.length === 0) {
      errors.push(`Section is empty: ## ${s.title}`);
    }
  }

  // ---- advice, not failures
  if (typeof data.order === "number" && typeof data.stage === "string") {
    const want = data.order === 1 ? "worked" : data.order === 2 ? "faded" : "scaffolded";
    if (data.stage !== want) {
      warnings.push(`Lesson ${data.order} usually has stage "${want}" (this one is "${data.stage}")`);
    }
  }
  return { errors, warnings, markers };
}
