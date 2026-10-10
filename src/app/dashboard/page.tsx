import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { sql } from "@/lib/db";
import { getFirstTask, getLessons } from "@/lib/lessons";
import { getOrLinkStudent } from "@/lib/students";

export const dynamic = "force-dynamic";

interface EnrolledCourse {
  course_id: string;
  slug: string;
  title: string;
  insider_name: string;
}

export default async function DashboardPage() {
  const student = await getOrLinkStudent();

  if (!student) {
    return (
      <div className="py-u4">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="mt-u2 max-w-[560px] text-muted">
          We couldn&apos;t find a purchase for this email. Check the email you
          used at checkout.
        </p>
        <Button asChild className="mt-u3">
          <Link href="/">Browse courses</Link>
        </Button>
      </div>
    );
  }

  const enrolled = (await sql`
    select c.id as course_id, c.slug, c.title, i.name as insider_name
    from enrollments e
    join courses c on c.id = e.course_id
    join insiders i on i.id = c.insider_id
    where e.student_id = ${student.id} and e.status = 'active'
    order by e.purchased_at`) as unknown as EnrolledCourse[];

  const progressRows = await sql`
    select course_id, lesson_slug from lesson_progress where student_id = ${student.id}`;
  const doneByCourse = new Map<string, Set<string>>();
  for (const r of progressRows) {
    const set = doneByCourse.get(r.course_id as string) ?? new Set<string>();
    set.add(r.lesson_slug as string);
    doneByCourse.set(r.course_id as string, set);
  }

  if (enrolled.length === 0) {
    return (
      <div className="py-u4">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="mt-u2 text-muted">No courses yet.</p>
        <Button asChild className="mt-u3">
          <Link href="/">Browse courses</Link>
        </Button>
      </div>
    );
  }

  const cards = enrolled.map((c) => {
    const lessons = getLessons(c.slug);
    const done = doneByCourse.get(c.course_id) ?? new Set<string>();
    // Only count lessons that still exist in the course content.
    const completedCount = lessons.filter((l) => done.has(l.slug)).length;
    const nextLesson = lessons.find((l) => !done.has(l.slug)) ?? lessons[0];
    return { ...c, lessons, completedCount, nextLesson, finished: completedCount === lessons.length && lessons.length > 0 };
  });

  const first = cards[0];
  const firstTask = getFirstTask(first.slug);
  const firstTaskDone = firstTask
    ? (doneByCourse.get(first.course_id)?.has(firstTask.lessonSlug) ?? false)
    : false;

  return (
    <div className="py-u4 md:py-u5">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      {firstTask && (
        <section
          aria-labelledby="first-task"
          className="mt-u3 rounded-lg border border-border bg-surface-alt p-u3"
        >
          <p id="first-task" className="text-sm font-bold uppercase tracking-wide text-muted">
            Your week-one first task
          </p>
          <h2 className="mt-u1 text-2xl font-bold">{firstTask.title}</h2>
          <p className="mt-u1 max-w-[680px] text-lg">{firstTask.text}</p>
          <Button asChild className="mt-u2">
            <Link href={`/learn/${first.slug}/${firstTask.lessonSlug}`}>
              {firstTaskDone ? "Review the first task" : "Start the first task"}
            </Link>
          </Button>
        </section>
      )}

      <section className="mt-u5">
        <h2 className="text-2xl font-bold">Your courses</h2>
        <div className="mt-u2 grid grid-cols-1 gap-u2 md:grid-cols-2">
          {cards.map((c) => (
            <Card key={c.course_id} className="bg-surface">
              <CardHeader>
                <CardTitle className="text-xl font-bold">{c.title}</CardTitle>
                <p className="text-sm text-muted">with {c.insider_name}</p>
              </CardHeader>
              <CardContent>
                <p className="text-sm">
                  {c.completedCount} of {c.lessons.length} lessons
                </p>
                <div
                  className="mt-u1 h-[10px] w-full overflow-hidden rounded-full bg-surface-alt"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={c.lessons.length}
                  aria-valuenow={c.completedCount}
                >
                  <div
                    className="h-full bg-ink"
                    style={{
                      width: `${c.lessons.length ? (c.completedCount / c.lessons.length) * 100 : 0}%`,
                    }}
                  />
                </div>
                {c.nextLesson && (
                  <Button asChild className="mt-u2">
                    <Link href={`/learn/${c.slug}/${c.nextLesson.slug}`}>
                      {c.finished ? "Review course" : "Continue"}
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
