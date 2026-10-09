import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Public routes (PRD Section 10). Everything else requires sign-in.
// The cron and webhook routes carry their own authentication
// (CRON_SECRET and the Stripe signature), so Clerk must not block them.
const isPublicRoute = createRouteMatcher([
  "/",
  "/courses/(.*)",
  "/welcome",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/checkin/(.*)",
  "/api/webhooks/(.*)",
  "/api/cron/(.*)",
  "/api/checkout",
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
