# Workframe

Python automation courses that start with a profession, not with `print('hello')`.
Each course is co-created with a working practitioner (an "insider"), built around
the five manual tasks that eat the most time in their week, and measured by one
number: **hours saved**, collected from every student and reviewed by a person
before it counts.

The app is the storefront, the classroom and the measurement system:

- sells each course through its insider (Stripe Checkout, $199 one time);
- enrolls the student the moment Stripe confirms payment (webhook) and emails a welcome;
- delivers lessons (MDX files in `content/`) behind an enrollment check;
- checks in with every student at day 3 and day 7, and has Claude turn the answer
  into a structured hours-saved estimate (doubtful ones are held for review);
- drafts a weekly summary for each insider, which the admin can veto before it is sent.

The full spec is [`docs/workframe-prd.md`](docs/workframe-prd.md). What the AI is for
and who decides what: [`docs/strategic-intent.md`](docs/strategic-intent.md) and
[`docs/decision-rights.md`](docs/decision-rights.md) (also linked from `/admin/system`).

**Stack:** Next.js 14 (App Router, TypeScript), Tailwind + shadcn/ui, Clerk, Neon (Postgres),
Stripe, Resend, the Claude API (`claude-sonnet-5-5`), Vercel (hosting and cron).

## Setup

You need Node 20 or newer, and accounts for Neon, Clerk, Stripe (test mode), Resend and Anthropic.

```bash
npm install
cp .env.example .env.local      # then fill in the values (see below)
npm run db:migrate              # creates the tables in your Neon database
npm run db:seed                 # three placeholder insiders and courses (all draft)
npm run dev                     # http://localhost:3000
```

To test purchases locally, make a course live and forward Stripe events:

```bash
npm run course:live real-estate-automation
stripe listen --forward-to localhost:3000/api/webhooks/stripe   # prints the whsec_ value
```

Pay with the Stripe test card `4242 4242 4242 4242`, any future date, any CVC.

## Environment variables

None of these belong in code. Locally they go in `.env.local` (git-ignored); in production
they go in the Vercel project's Environment Variables. `.env.example` lists every name.

| Variable | What it is |
|---|---|
| `DATABASE_URL` | Neon connection string |
| `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk keys |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-in` and `/sign-up` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL`, `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | `/dashboard` |
| `STRIPE_SECRET_KEY` | Stripe secret key (`sk_test_...` until you go live) |
| `STRIPE_WEBHOOK_SECRET` | Signing secret of the webhook endpoint (`whsec_...`) |
| `RESEND_API_KEY`, `RESEND_FROM` | Resend key and the sender address |
| `ANTHROPIC_API_KEY` | Claude API key; it must be scoped to a workspace |
| `CRON_SECRET` | Long random string. Vercel sends it as `Authorization: Bearer ...` to the cron routes |
| `ADMIN_EMAILS` | Comma-separated emails allowed into `/admin` |
| `ADMIN_NOTIFY_EMAIL` | Where digest drafts are emailed |
| `APP_URL` | The site's own address, no trailing slash (used in email links and Stripe redirects) |

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` / `lint` | Next.js |
| `npm run db:migrate` | Runs any new file in `db/migrations`, one transaction per file. Safe to repeat |
| `npm run db:check` | Lists the tables and the `crons_paused` flag |
| `npm run db:seed` | Seeds three insiders and courses. Never changes a course's status |
| `npm run course:live <slug>` | Sets a course live so it can be bought |
| `npm run dev:backdate <email> <days>` | Moves a student's purchase date back, to test day 3 / day 7 |

## The three scheduled jobs

Defined in `vercel.json`. Vercel only runs crons on the production deployment, and sends
`Authorization: Bearer $CRON_SECRET` itself. Each route rejects a missing or wrong secret
with 401, and returns `{"skipped":"paused"}` when the kill switch is on.

| Route | Schedule (UTC) | Central time | What it does |
|---|---|---|---|
| `/api/cron/checkins` | `0 14 * * *` daily | 8-9 am | Emails the day 3 and day 7 check-in link to students who reached it. Retries an unsent one (same link) for up to 14 days |
| `/api/cron/digest-draft` | `0 23 * * 0` Sunday | Sunday 6 pm (5 pm in winter) | Samples 20% (minimum 5) of last week's auto-accepted extractions for review, drafts a digest per live course with Claude, and emails the drafts to `ADMIN_NOTIFY_EMAIL` |
| `/api/cron/digest-release` | `0 13 * * 1` Monday | Monday 8 am (7 am in winter) | Sends every digest still `drafted` to its insider. A vetoed or failed digest is never sent |

Run one by hand (locally, with the dev server up):

```bash
curl -s -H "Authorization: Bearer $(grep '^CRON_SECRET=' .env.local | cut -d= -f2-)" \
  http://localhost:3000/api/cron/checkins
```

On Vercel's Hobby plan a cron runs at most once a day and anywhere inside its scheduled
hour, so the times above are approximate. Pro runs them exactly on time.

## The admin console and the kill switch

`/admin` is for the emails in `ADMIN_EMAILS` only; anyone else gets a 404. Every admin page
and every admin action re-checks that on the server.

- **Extractions:** held figures. Approve, correct (note required, hours recomputed in code) or reject.
- **Sampling:** the weekly sample of auto-accepted figures. Confirm or correct. Shows the agreement rate.
- **Digests:** drafts and their status, with a **Veto** button until Monday's release.
- **Emails:** every automated email: type, recipient, trigger, status, error.
- **System:** the **kill switch** and the 20 latest errors.

**Kill switch.** On `/admin/system`, turn on "Pause all automated jobs". Every cron route then
returns immediately without sending anything or calling Claude, and logs that it was paused.
It records who flipped it and when. If the flag cannot be read, the system treats itself as paused.

Hours saved are always labeled "student-reported, AI-estimated". Only auto-accepted, approved
and corrected rows ever count; held, rejected and failed rows never do.

## Tests

Every test script prints PASS or FAIL per check and exits non-zero on a failure. The ones that
use the database create throwaway rows and remove them; none of them send real email.

| Command | Covers |
|---|---|
| `npm run test:guards` | Cron secret, kill switch, and fail-closed behavior (uses the real database, restores the flag) |
| `npm run test:extraction` | Extraction validation, hold rules, hours math, prompt-injection answers (no API call) |
| `npm run test:review` | Admin approve, correct, reject and confirm rules, and counted hours |
| `npm run test:sampling` | The 20% / minimum 5 sampling rule |
| `npm run test:digest` | The identifying-text guard, note scrubbing, and the "coming Monday" date |
| `npm run test:markdown` | Digest markdown in emails: real headings and lists, nothing injected |
| `npm run test:checkin-cron` | New sends, retries and who is skipped, with a fake sender |

## Deploying to Vercel

1. Push to GitHub and import the repository as a Vercel project (framework: Next.js).
2. Add every variable in the table above to the project's **Production** environment.
   Use Stripe **test** keys until you are ready to take real money.
3. Deploy, then set `APP_URL` to the deployed address and redeploy.
4. In Stripe, add a webhook endpoint at `https://<your-address>/api/webhooks/stripe`
   for the `checkout.session.completed` event, and put its signing secret in `STRIPE_WEBHOOK_SECRET`.
5. Run `npm run db:migrate` against the production database.
6. Resend: verify a sending domain and change `RESEND_FROM` to an address on it. Until then
   Resend only delivers to your own account's email.

Lesson files (`content/`) and the two governance documents (`docs/`) are read from disk at
request time; `next.config.mjs` lists them so Vercel includes them in the build.
