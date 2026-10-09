import "server-only";
import { currentUser } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** The signed-in user's verified primary email, lower-cased, or null. */
async function primaryEmail(): Promise<string | null> {
  const user = await currentUser();
  const email = user?.primaryEmailAddress;
  if (!email || email.verification?.status !== "verified") return null;
  return email.emailAddress.toLowerCase();
}

/** True when the signed-in user's email is in ADMIN_EMAILS. */
export async function isAdmin(): Promise<boolean> {
  const email = await primaryEmail();
  return email !== null && adminEmails().includes(email);
}

/**
 * Call at the top of every admin page and every admin server action.
 * Anyone who is not an admin (including signed-out callers) gets a 404, so
 * the existence of /admin is not revealed. Returns the admin's email.
 */
export async function requireAdmin(): Promise<string> {
  const email = await primaryEmail();
  if (email === null || !adminEmails().includes(email)) {
    notFound();
  }
  return email;
}
