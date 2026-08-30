-- The Tribunal schema. The database holds three things (spec.md part three):
-- charge sheets as stored after stamping, agent outputs as they land, and the call log
-- with one row per attempt. Jobs carry the deliberation state (spec.md criterion 16).

create table charge_sheets (
  case_id text primary key check (case_id ~ '^T-[0-9]{3}$'),
  body jsonb not null,
  created_at timestamptz not null default now()
);

create table jobs (
  deliberation_id text primary key,
  case_id text not null references charge_sheets(case_id),
  status text not null default 'pending' check (status in ('pending','running','complete','incomplete','failed')),
  stage text not null default 'advocates',
  terminal_reason text,
  calls integer not null default 0,
  spend_usd numeric not null default 0,
  attempts_by_role jsonb not null default '{}'::jsonb,
  claimed_at timestamptz,
  heartbeat_at timestamptz,
  completed_roles jsonb not null default '[]'::jsonb,
  failed_roles jsonb not null default '[]'::jsonb,
  models jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table outputs (
  deliberation_id text not null references jobs(deliberation_id),
  role_id text not null,
  body jsonb not null,
  created_at timestamptz not null default now(),
  primary key (deliberation_id, role_id)
);

create table call_log (
  id bigserial primary key,
  deliberation_id text not null references jobs(deliberation_id),
  row jsonb not null,
  created_at timestamptz not null default now()
);

-- Atomic claim (spec.md criterion 15). Two mechanisms, two problems:
-- the conditional update is atomic, so two concurrent invocations cannot both claim;
-- the heartbeat threshold frees a job whose function died mid-run and will never finish.
-- Terminal statuses are never claimable: a platform re-invocation must not re-run a done job.
create function claim_job(p_deliberation_id text, p_stale_seconds integer)
returns boolean
language sql
as $$
  update jobs
     set claimed_at = now(), heartbeat_at = now(), updated_at = now()
   where deliberation_id = p_deliberation_id
     and ( status = 'pending'
        or (status = 'running' and (heartbeat_at is null or heartbeat_at < now() - make_interval(secs => p_stale_seconds))) )
  returning true;
$$;

create function heartbeat_job(p_deliberation_id text)
returns void
language sql
as $$
  update jobs set heartbeat_at = now(), updated_at = now()
   where deliberation_id = p_deliberation_id and status = 'running';
$$;

-- Row level security stays enabled with no policies: only the service role reads or writes.
alter table charge_sheets enable row level security;
alter table jobs enable row level security;
alter table outputs enable row level security;
alter table call_log enable row level security;
