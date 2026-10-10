import "server-only";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";

export interface LessonMeta {
  /** File name without .mdx, e.g. "01-week-one-first-task". Used in URLs. */
  slug: string;
  title: string;
  order: number;
  colabUrl: string;
  datasetPath: string;
  minutes: number;
}

export type LessonStage = "worked" | "faded" | "scaffolded";

export interface Lesson extends LessonMeta {
  /** MDX source without the frontmatter. */
  content: string;
  // v2 template fields (v2 PRD Section 2.2). Absent on lessons still in the v1 format.
  stage?: LessonStage;
  newConcepts?: string[];
  predict?: { question: string };
  expected?: { description: string; sampleOutputPath: string };
  recall?: { question: string; answer: string };
  errors?: { message: string; cause: string; fix: string }[];
}

const CONTENT_DIR = join(process.cwd(), "content");

// Slugs come from URLs, so only plain slugs are allowed (no path tricks).
const SAFE_SLUG = /^[a-z0-9][a-z0-9-]*$/;

/** Reads the v2 frontmatter if the lesson uses it. `npm run lessons:validate` guarantees the shape. */
function v2Fields(data: Record<string, unknown>): Partial<Lesson> {
  if (data.stage !== "worked" && data.stage !== "faded" && data.stage !== "scaffolded") return {};
  const obj = (v: unknown) => (typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {});
  const predict = obj(data.predict);
  const expected = obj(data.expected);
  const recall = obj(data.recall);
  return {
    stage: data.stage,
    newConcepts: Array.isArray(data.newConcepts) ? data.newConcepts.map(String) : [],
    predict: { question: String(predict.question ?? "") },
    expected: {
      description: String(expected.description ?? ""),
      sampleOutputPath: String(expected.sampleOutputPath ?? ""),
    },
    recall: { question: String(recall.question ?? ""), answer: String(recall.answer ?? "") },
    errors: Array.isArray(data.errors)
      ? data.errors.map((e) => {
          const x = obj(e);
          return { message: String(x.message ?? ""), cause: String(x.cause ?? ""), fix: String(x.fix ?? "") };
        })
      : [],
  };
}

function parse(courseSlug: string, file: string): Lesson {
  const raw = readFileSync(join(CONTENT_DIR, courseSlug, file), "utf8");
  const { data, content } = matter(raw);
  return {
    slug: file.replace(/\.mdx$/, ""),
    title: String(data.title ?? file),
    order: Number(data.order ?? 0),
    colabUrl: String(data.colabUrl ?? ""),
    datasetPath: String(data.datasetPath ?? ""),
    minutes: Number(data.minutes ?? 0),
    content,
    ...v2Fields(data),
  };
}

/** All lessons for a course, sorted by their `order` frontmatter. */
export function getLessons(courseSlug: string): LessonMeta[] {
  if (!SAFE_SLUG.test(courseSlug)) return [];
  const dir = join(CONTENT_DIR, courseSlug);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".mdx"))
    .map((f) => {
      const lesson = parse(courseSlug, f);
      return {
        slug: lesson.slug,
        title: lesson.title,
        order: lesson.order,
        colabUrl: lesson.colabUrl,
        datasetPath: lesson.datasetPath,
        minutes: lesson.minutes,
      };
    })
    .sort((a, b) => a.order - b.order);
}

/** One lesson with its MDX source, or null if it does not exist. */
export function getLesson(courseSlug: string, lessonSlug: string): Lesson | null {
  if (!SAFE_SLUG.test(courseSlug) || !SAFE_SLUG.test(lessonSlug)) return null;
  const file = `${lessonSlug}.mdx`;
  if (!existsSync(join(CONTENT_DIR, courseSlug, file))) return null;
  return parse(courseSlug, file);
}

/** First prose paragraph of a lesson (skips headings and code fences). */
export function firstParagraph(mdx: string): string {
  let inFence = false;
  const paragraph: string[] = [];
  for (const line of mdx.split("\n")) {
    if (line.trim().startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (line.startsWith("#")) continue;
    if (line.trim().startsWith("{/*")) continue;
    if (line.trim() === "") {
      if (paragraph.length > 0) break;
      continue;
    }
    paragraph.push(line.trim());
  }
  return paragraph.join(" ");
}

/** The week-one first task: title and first paragraph of the order=1 lesson. */
export function getFirstTask(
  courseSlug: string
): { title: string; text: string; lessonSlug: string } | null {
  const first = getLessons(courseSlug)[0];
  if (!first) return null;
  const lesson = getLesson(courseSlug, first.slug);
  if (!lesson) return null;
  return {
    title: lesson.title,
    text: firstParagraph(lesson.content),
    lessonSlug: lesson.slug,
  };
}
