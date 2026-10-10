import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import { CodeBlock } from "@/components/code-block";
import { LessonNav } from "@/components/lesson-nav";
import { Button } from "@/components/ui/button";
import { getLesson, getLessons } from "@/lib/lessons";
import { completedLessonSlugs, getLessonAccess } from "@/lib/learn";
import { markLessonComplete } from "../../actions";

export const dynamic = "force-dynamic";

type Props = { params: { course: string; lesson: string } };

export default async function LessonPage({ params }: Props) {
  // Gate: signed in AND actively enrolled, otherwise back to the sales page.
  const access = await getLessonAccess(params.course);
  if (!access) redirect(`/courses/${params.course}`);

  const lesson = getLesson(params.course, params.lesson);
  if (!lesson) notFound();

  const lessons = getLessons(params.course);
  const completed = await completedLessonSlugs(access.student.id, access.course.id);
  const index = lessons.findIndex((l) => l.slug === lesson.slug);
  const prev = index > 0 ? lessons[index - 1] : null;
  const next = index < lessons.length - 1 ? lessons[index + 1] : null;
  const isDone = completed.has(lesson.slug);

  const nav = (
    <LessonNav
      courseSlug={params.course}
      lessons={lessons}
      completed={completed}
      currentSlug={lesson.slug}
    />
  );

  return (
    <div className="py-u3 md:py-u5">
      <div className="grid grid-cols-1 gap-u3 md:grid-cols-[260px_1fr] md:gap-u5">
        <aside>
          <p className="text-sm text-muted">{access.course.title}</p>
          {/* Mobile: the list collapses above the lesson. Desktop: always visible. */}
          <details className="mt-u1 rounded-lg border border-border bg-surface md:hidden">
            <summary className="flex min-h-tap cursor-pointer items-center px-u2 text-sm font-bold">
              Lessons ({completed.size} of {lessons.length} complete)
            </summary>
            <div className="border-t border-border p-u1">{nav}</div>
          </details>
          <div className="mt-u1 hidden md:block">{nav}</div>
        </aside>

        <article>
          <div className="flex flex-wrap gap-u1">
            {lesson.colabUrl && (
              <Button asChild>
                <a href={lesson.colabUrl} target="_blank" rel="noopener noreferrer">
                  Open in Colab
                </a>
              </Button>
            )}
            {lesson.datasetPath && (
              <Button asChild variant="outline">
                <a href={lesson.datasetPath} download>
                  Download sample data
                </a>
              </Button>
            )}
          </div>

          <div className="prose prose-lg mt-u3 max-w-none text-ink prose-headings:font-heading prose-headings:text-ink prose-a:text-ink prose-strong:text-ink prose-code:font-mono prose-code:before:content-none prose-code:after:content-none">
            <MDXRemote source={lesson.content} components={{ pre: CodeBlock }} />
          </div>

          <div className="mt-u5 border-t border-border pt-u3">
            <form action={markLessonComplete.bind(null, params.course, lesson.slug)}>
              <Button type="submit" variant={isDone ? "outline" : "default"} disabled={isDone}>
                {isDone ? "Completed ✓" : "Mark complete"}
              </Button>
            </form>
            <div className="mt-u2 flex flex-wrap justify-between gap-u1">
              {prev ? (
                <Link
                  href={`/learn/${params.course}/${prev.slug}`}
                  className="inline-flex min-h-tap items-center text-sm font-medium hover:underline"
                >
                  ← {prev.title}
                </Link>
              ) : (
                <span />
              )}
              {next && (
                <Link
                  href={`/learn/${params.course}/${next.slug}`}
                  className="inline-flex min-h-tap items-center text-sm font-medium hover:underline"
                >
                  {next.title} →
                </Link>
              )}
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
