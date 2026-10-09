import "server-only";
import { currentUser } from "@clerk/nextjs/server";
import { sql } from "@/lib/db";
import type { Student } from "@/lib/types";

/**
 * Returns the students row for the signed-in Clerk user, or null if there is
 * no purchase for their email yet.
 *
 * 1. Match on clerk_user_id.
 * 2. Otherwise match on the lower-cased primary email and link the Clerk ID.
 *    Only a VERIFIED email is allowed to claim a purchase, and a row that is
 *    already linked to a different Clerk user is never re-linked.
 */
export async function getOrLinkStudent(): Promise<Student | null> {
  const user = await currentUser();
  if (!user) return null;

  const byClerk = (await sql`
    select * from students where clerk_user_id = ${user.id}
  `) as unknown as Student[];
  if (byClerk.length > 0) return byClerk[0];

  const email = user.primaryEmailAddress;
  if (!email || email.verification?.status !== "verified") return null;
  const address = email.emailAddress.toLowerCase();

  const linked = (await sql`
    update students
    set clerk_user_id = ${user.id}
    where email = ${address} and clerk_user_id is null
    returning *
  `) as unknown as Student[];
  return linked.length > 0 ? linked[0] : null;
}
