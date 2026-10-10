import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { sql } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { welcomeEmail } from "@/lib/email-templates";
import { logError } from "@/lib/errors";
import { getFirstTask } from "@/lib/lessons";
import { stripe } from "@/lib/stripe";

// Stripe webhook (PRD 5.2 / 11.1). Needs the Node runtime and the RAW body:
// the signature is computed over the exact bytes Stripe sent.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SOURCE = "stripe_webhook";

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    await logError(SOURCE, "STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }

  // 1. Verify the signature. Never log the raw body or the secret.
  const rawBody = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      request.headers.get("stripe-signature") ?? "",
      secret
    );
  } catch (err) {
    await logError(SOURCE, "invalid signature", { error: (err as Error).message });
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  // 2. Only one event type matters.
  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  // 3. Idempotency: skip events already fully processed.
  try {
    const seen = await sql`select 1 from stripe_events where event_id = ${event.id}`;
    if (seen.length > 0) return NextResponse.json({ received: true, duplicate: true });
  } catch (err) {
    await logError(SOURCE, "could not check stripe_events", {
      event: event.id,
      error: (err as Error).message,
    });
    return NextResponse.json({ error: "retry" }, { status: 500 });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  let studentId: string;
  let enrollmentId: string | null;
  let course: { id: string; slug: string; title: string };
  try {
    const email = session.customer_details?.email?.trim().toLowerCase();
    if (!email) throw new Error("session has no customer email");
    if (session.payment_status !== "paid") {
      // Not paid yet (e.g. a delayed payment method): do not unlock anything.
      await logError(SOURCE, "completed session is not paid; not enrolling", {
        event: event.id,
        session: session.id,
        payment_status: session.payment_status,
      });
      return NextResponse.json({ received: true });
    }
    const amount = session.amount_total;
    if (typeof amount !== "number") throw new Error("session has no amount_total");

    const courseSlug = session.metadata?.course_slug;
    if (!courseSlug) throw new Error("session metadata has no course_slug");
    const courseRows = await sql`
      select id, slug, title, insider_id from courses where slug = ${courseSlug}`;
    if (courseRows.length === 0) throw new Error(`unknown course: ${courseSlug}`);
    course = courseRows[0] as { id: string; slug: string; title: string };
    const insiderId = session.metadata?.insider_id || courseRows[0].insider_id;

    const paymentIntent =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id ?? null;

    // 4. One statement = one transaction: student, enrollment and the
    //    processed-event marker all commit together or not at all.
    //    `on conflict do nothing` on enrollments covers both a repeated
    //    session id and a student who already owns the course.
    const rows = await sql`
      with s as (
        insert into students (email, name)
        values (${email}, ${session.customer_details?.name ?? null})
        on conflict (email) do update
          set name = coalesce(students.name, excluded.name)
        returning id
      ),
      e as (
        insert into enrollments
          (student_id, course_id, insider_id, stripe_session_id, stripe_payment_intent, amount_cents)
        select s.id, ${course.id}::uuid, ${insiderId}::uuid, ${session.id},
               ${paymentIntent}, ${amount}::int
        from s
        on conflict do nothing
        returning id
      ),
      ev as (
        insert into stripe_events (event_id, type)
        values (${event.id}, ${event.type})
        on conflict (event_id) do nothing
        returning event_id
      )
      select (select id from s) as student_id, (select id from e) as enrollment_id`;
    studentId = rows[0].student_id as string;
    enrollmentId = (rows[0].enrollment_id as string | null) ?? null;
  } catch (err) {
    // Nothing was committed, the event is not marked processed: Stripe retries.
    await logError(SOURCE, "could not process checkout.session.completed", {
      event: event.id,
      session: session.id,
      error: (err as Error).message,
    });
    return NextResponse.json({ error: "retry" }, { status: 500 });
  }

  // 5. No new enrollment row: either this session was already enrolled, or the
  //    student already owned the course (a second purchase to refund by hand).
  if (enrollmentId === null) {
    const existing = await sql`
      select 1 from enrollments where stripe_session_id = ${session.id}`;
    if (existing.length === 0) {
      await logError(SOURCE, "duplicate enrollment - check for refund", {
        event: event.id,
        session: session.id,
        student: studentId,
        course: course.slug,
      });
    }
    return NextResponse.json({ received: true });
  }

  // 6. Welcome email. A failure is logged but never fails the webhook.
  try {
    const first = getFirstTask(course.slug);
    const result = await sendEmail({
      type: "welcome",
      to: session.customer_details!.email!.trim().toLowerCase(),
      ...welcomeEmail({
        name: session.customer_details?.name ?? null,
        courseTitle: course.title,
        firstTask: first
          ? `${first.title}\n\n${first.text}`
          : "Sign in to see your first task.",
        signInUrl: `${process.env.APP_URL}/sign-in`,
      }),
      enrollmentId,
      trigger: "stripe_webhook",
      inputSnapshot: { course: course.slug, session: session.id },
    });
    if (!result.ok) {
      await logError(SOURCE, "welcome email failed", { enrollment: enrollmentId });
    }
  } catch (err) {
    await logError(SOURCE, "welcome email threw", {
      enrollment: enrollmentId,
      error: (err as Error).message,
    });
  }

  return NextResponse.json({ received: true });
}
