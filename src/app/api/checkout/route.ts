import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getCourse } from "@/lib/courses";
import { logError } from "@/lib/errors";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";

// POST { courseSlug } -> { url } (the Stripe Checkout page).
// Public by design (visitors are not signed in yet); it only ever creates a
// payment page for a LIVE course, with the price read from the database.
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const slug = (body as { courseSlug?: unknown } | null)?.courseSlug;
  if (typeof slug !== "string" || !/^[a-z0-9-]{1,80}$/.test(slug)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const course = await getCourse(slug);
  if (!course || course.status !== "live") {
    return NextResponse.json({ error: "Course not available" }, { status: 400 });
  }

  const appUrl = process.env.APP_URL;
  if (!appUrl) {
    await logError("checkout", "APP_URL is not set");
    return NextResponse.json({ error: "Checkout is unavailable" }, { status: 500 });
  }

  try {
    // Plain Checkout: Workframe is the seller. The account has Managed Payments
    // on by default, which would require a product tax code on every item, so
    // it is switched off per session. (The SDK's types predate this parameter.)
    const params = {
      mode: "payment",
      managed_payments: { enabled: false },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: course.price_cents,
            product_data: { name: course.title },
          },
        },
      ],
      // Insider attribution travels with the purchase (PRD 5.1).
      metadata: { course_slug: course.slug, insider_id: course.insider_id },
      success_url: `${appUrl}/welcome`,
      cancel_url: `${appUrl}/courses/${course.slug}`,
    } as Stripe.Checkout.SessionCreateParams;
    const session = await stripe.checkout.sessions.create(params);
    return NextResponse.json({ url: session.url });
  } catch (err) {
    await logError("checkout", "could not create Checkout session", {
      course: course.slug,
      error: (err as Error).message,
    });
    return NextResponse.json({ error: "Checkout is unavailable" }, { status: 500 });
  }
}
