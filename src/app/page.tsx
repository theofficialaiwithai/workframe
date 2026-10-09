import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPrice, listCourses } from "@/lib/courses";

// Course status changes (draft -> live) must show up immediately.
export const dynamic = "force-dynamic";

export default async function Home() {
  const courses = await listCourses();

  return (
    <div className="py-u4 md:py-u6">
      <section className="max-w-[720px]">
        <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
          Python courses that start with your job.
        </h1>
        <p className="mt-u2 text-lg text-muted">
          Each course is built with a working practitioner around the five tasks
          that eat the most time in their week. You finish week one with a tool
          you use the following Monday.
        </p>
      </section>

      <section className="mt-u6">
        <h2 className="text-2xl font-bold">Courses</h2>
        <div className="mt-u2 grid grid-cols-1 gap-u2 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <Link
              key={course.slug}
              href={`/courses/${course.slug}`}
              className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Card className="h-full bg-surface transition-colors hover:bg-surface-alt">
                <CardHeader>
                  <div>
                    <Badge variant={course.status === "live" ? "live" : "draft"}>
                      {course.status === "live" ? "Live" : "Draft"}
                    </Badge>
                  </div>
                  <CardTitle className="pt-u1 text-xl font-bold">
                    {course.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted">with {course.insider_name}</p>
                  <p className="mt-u2 text-lg font-bold">
                    {formatPrice(course.price_cents)}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
