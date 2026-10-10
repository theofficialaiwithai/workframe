import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { EnrollButton } from "@/components/enroll-button";
import { Card, CardContent } from "@/components/ui/card";
import { formatPrice, getCourse } from "@/lib/courses";

export const dynamic = "force-dynamic";

type Props = { params: { slug: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const course = await getCourse(params.slug);
  return { title: course ? `${course.title} | Workframe` : "Workframe" };
}

export default async function CoursePage({ params }: Props) {
  const course = await getCourse(params.slug);
  if (!course) notFound();

  const isLive = course.status === "live";
  const tasks = (course.summary ?? "")
    .split("\n")
    .map((t) => t.trim())
    .filter(Boolean);

  return (
    <div className="py-u4 md:py-u6">
      <div className="grid grid-cols-1 gap-u4 lg:grid-cols-[1fr_340px]">
        <div>
          <Badge variant={isLive ? "live" : "draft"}>
            {isLive ? "Live" : "Draft"}
          </Badge>
          <h1 className="mt-u2 text-4xl font-bold tracking-tight md:text-5xl">
            {course.title}
          </h1>
          <p className="mt-u2 text-lg text-muted">with {course.insider_name}</p>

          <section className="mt-u5">
            <h2 className="text-2xl font-bold">What you&apos;ll automate in week one</h2>
            {tasks.length > 0 ? (
              <ul className="mt-u2 list-disc space-y-u1 pl-u2 text-lg">
                {tasks.map((task) => (
                  <li key={task}>{task}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-u2 text-muted">
                The five tasks for this course are being finalised with the
                insider.
              </p>
            )}
          </section>

          <section className="mt-u5">
            <h2 className="text-2xl font-bold">Your insider</h2>
            <p className="mt-u2 font-medium">{course.insider_name}</p>
            {course.insider_bio && (
              <p className="mt-u1 max-w-[640px] text-muted">{course.insider_bio}</p>
            )}
          </section>
        </div>

        <aside>
          <Card className="bg-surface lg:sticky lg:top-u2">
            <CardContent className="pt-u3">
              <p className="text-4xl font-bold">{formatPrice(course.price_cents)}</p>
              <p className="mt-u1 text-sm text-muted">One-time payment.</p>
              <EnrollButton
                courseSlug={course.slug}
                label={`Enroll — ${formatPrice(course.price_cents)}`}
                disabled={!isLive}
              />
              {!isLive && (
                <p className="mt-u2 text-sm text-muted">
                  This course is in preparation. Join the waitlist soon.
                </p>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
