alter table checkins
  add column if not exists confidence smallint check (confidence between 1 and 5),   -- 'How confident are you that you could automate a similar task on your own?'
  add column if not exists transfer_answer text,                                      -- day 7 only, optional; reviewed by a person, never sent to Claude
  add column if not exists transfer_attempted boolean not null default false;

create table if not exists lesson_responses (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id),
  course_id uuid not null references courses(id),
  lesson_slug text not null,
  stage text not null check (stage in ('predict')),
  response text not null,
  created_at timestamptz not null default now(),
  unique (student_id, course_id, lesson_slug, stage)
);

create table if not exists recall_prompts (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references enrollments(id),
  lesson_slug text not null,
  token text unique not null,
  sent_at timestamptz,
  opened_at timestamptz,
  response text,                     -- the student's attempt from memory; reviewed by a person
  revealed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (enrollment_id, lesson_slug)  -- the cron can never send the same prompt twice
);

create table if not exists harness_kits (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id),
  version text not null,             -- e.g. '1.0.0'
  file_name text not null,           -- kits/<profession>-v<version>.zip
  changelog text,
  open_markers int not null default 0,   -- count of PRACTITIONER_TO_CONFIRM / PLACEHOLDER markers left in the kit
  signed_off_by text,                -- the practitioner who approved the rules and golden cases
  signed_off_at timestamptz,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  unique (course_id, version)
);

create table if not exists kit_downloads (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id),
  kit_id uuid not null references harness_kits(id),
  downloaded_at timestamptz not null default now()
);

create index if not exists idx_recall_prompts_sent_at on recall_prompts (sent_at);
create index if not exists idx_kit_downloads_downloaded_at on kit_downloads (downloaded_at);
