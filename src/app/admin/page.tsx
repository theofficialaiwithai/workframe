import { requireAdmin } from "@/lib/admin";

export default async function AdminPage() {
  await requireAdmin();

  return (
    <div className="py-u4">
      <h1 className="text-3xl font-bold">Admin</h1>
    </div>
  );
}
