import Link from "next/link";
import type { LessonMeta } from "@/lib/lessons";

export function LessonNav({
  courseSlug,
  lessons,
  completed,
  currentSlug,
}: {
  courseSlug: string;
  lessons: LessonMeta[];
  completed: Set<string>;
  currentSlug: string;
}) {
  return (
    <ol className="space-y-u1">
      {lessons.map((l) => {
        const isCurrent = l.slug === currentSlug;
        const isDone = completed.has(l.slug);
        return (
          <li key={l.slug}>
            <Link
              href={`/learn/${courseSlug}/${l.slug}`}
              aria-current={isCurrent ? "page" : undefined}
              className={`flex min-h-tap items-center gap-u1 rounded-md px-u1 text-sm ${
                isCurrent ? "bg-surface-alt font-bold" : "hover:bg-surface-alt"
              }`}
            >
              <span
                aria-label={isDone ? "Completed" : "Not completed"}
                className={`inline-flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-full border text-xs ${
                  isDone ? "border-ink bg-ink text-surface" : "border-border text-transparent"
                }`}
              >
                ✓
              </span>
              <span>{l.title}</span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
