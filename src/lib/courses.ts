import "server-only";
import { sql } from "@/lib/db";
import type { CourseStatus } from "@/lib/types";

export interface CourseWithInsider {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  price_cents: number;
  status: CourseStatus;
  insider_id: string;
  insider_name: string;
  insider_bio: string | null;
}

export async function listCourses(): Promise<CourseWithInsider[]> {
  const rows = await sql`
    select c.id, c.slug, c.title, c.summary, c.price_cents, c.status, c.insider_id,
           i.name as insider_name, i.bio as insider_bio
    from courses c join insiders i on i.id = c.insider_id
    order by c.title`;
  return rows as unknown as CourseWithInsider[];
}

export async function getCourse(slug: string): Promise<CourseWithInsider | null> {
  const rows = await sql`
    select c.id, c.slug, c.title, c.summary, c.price_cents, c.status, c.insider_id,
           i.name as insider_name, i.bio as insider_bio
    from courses c join insiders i on i.id = c.insider_id
    where c.slug = ${slug}`;
  return rows.length > 0 ? (rows[0] as unknown as CourseWithInsider) : null;
}

export function formatPrice(cents: number): string {
  const dollars = cents / 100;
  return `$${Number.isInteger(dollars) ? dollars : dollars.toFixed(2)}`;
}
