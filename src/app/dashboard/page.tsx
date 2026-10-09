import { getOrLinkStudent } from "@/lib/students";

export default async function DashboardPage() {
  const student = await getOrLinkStudent();

  return (
    <div className="py-u4">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <p className="mt-u2 text-muted">
        {student ? student.email : "No courses yet"}
      </p>
    </div>
  );
}
