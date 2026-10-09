create table insiders (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  email text not null,               -- digest recipient
  profession text not null,          -- 'real-estate' | 'legal' | 'fitness'
  bio text,
  created_at timestamptz not null default now()
);

create table courses (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  insider_id uuid not null references insiders(id),
  title text not null,
  summary text,
  price_cents int not null default 19900,
  stripe_price_id text,              -- set after creating the Stripe price
  status text not null default 'draft' check (status in ('draft','live')),
  created_at timestamptz not null default now()
);

create table students (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,        -- lower-cased; the match key for webhook purchases
  name text,
  clerk_user_id text unique,         -- null until first sign-in
  created_at timestamptz not null default now()
);

create table enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id),
  course_id uuid not null references courses(id),
  insider_id uuid not null references insiders(id),   -- attribution, copied at purchase time
  stripe_session_id text unique not null,
  stripe_payment_intent text,
  amount_cents int not null,
  status text not null default 'active' check (status in ('active','refunded')),
  purchased_at timestamptz not null default now(),
  unique (student_id, course_id)
);

create table lesson_progress (
  student_id uuid not null references students(id),
  course_id uuid not null references courses(id),
  lesson_slug text not null,
  completed_at timestamptz not null default now(),
  primary key (student_id, course_id, lesson_slug)
);

-- Webhook idempotency: one row per Stripe event we have fully processed
create table stripe_events (
  event_id text primary key,
  type text not null,
  processed_at timestamptz not null default now()
);

create table checkins (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references enrollments(id),
  checkpoint smallint not null check (checkpoint in (3,7)),   -- day 3 or day 7
  token text unique not null,        -- random, unguessable; the form URL needs no login
  sent_at timestamptz,
  submitted_at timestamptz,
  raw_answer text,                   -- what the student typed, kept verbatim
  blockers text,                     -- optional "what got in your way"
  created_at timestamptz not null default now(),
  unique (enrollment_id, checkpoint) -- the daily cron can never double-send
);

create table extractions (
  id uuid primary key default gen_random_uuid(),
  checkin_id uuid not null references checkins(id),
  task text,
  minutes_before int,
  minutes_after int,
  runs_in_week int,                  -- how many times they used it; defaults to 1 with lower confidence if unclear
  hours_saved numeric(8,2),          -- (before - after) * runs / 60, computed by the app, not by Claude
  confidence numeric(3,2),           -- 0.00 - 1.00 from Claude
  evidence_phrases text[],           -- exact phrases from raw_answer the numbers came from
  status text not null check (status in ('auto_accepted','pending_review','approved','corrected','rejected','failed')),
  hold_reason text,                  -- why it was held, if it was
  sampled_at timestamptz,            -- set when picked for the weekly sampling review
  sample_result text check (sample_result in ('confirmed','corrected')),
  reviewed_at timestamptz,
  review_note text,
  model text not null,
  prompt_version text not null,
  raw_response jsonb,                -- Claude's full structured output, for audit
  created_at timestamptz not null default now()
);

create table digests (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id),
  week_start date not null,
  body_md text,
  stats jsonb not null,              -- the exact numbers given to Claude
  status text not null default 'drafted'
    check (status in ('drafted','vetoed','sent','failed')),
  failure_reason text,
  model text,
  prompt_version text,
  drafted_at timestamptz not null default now(),
  vetoed_at timestamptz,
  sent_at timestamptz,
  unique (course_id, week_start)
);

create table email_log (
  id uuid primary key default gen_random_uuid(),
  type text not null,                -- 'welcome' | 'checkin' | 'digest_admin' | 'digest_insider'
  to_email text not null,
  enrollment_id uuid references enrollments(id),
  digest_id uuid references digests(id),
  trigger_source text not null,      -- 'stripe_webhook' | 'cron_checkins' | 'cron_digest_draft' | 'cron_digest_release'
  input_snapshot jsonb,
  resend_id text,
  status text not null check (status in ('sent','failed')),
  error text,
  created_at timestamptz not null default now()
);

create table system_flags (
  key text primary key,              -- 'crons_paused'
  value boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by text
);
insert into system_flags (key, value) values ('crons_paused', false);

create table error_log (
  id uuid primary key default gen_random_uuid(),
  source text not null,              -- 'stripe_webhook' | 'cron_checkins' | 'extraction' | ...
  message text not null,
  detail jsonb,
  created_at timestamptz not null default now()
);

create index on enrollments (purchased_at);
create index on extractions (status);
create index on extractions (created_at);
create index on email_log (created_at);
