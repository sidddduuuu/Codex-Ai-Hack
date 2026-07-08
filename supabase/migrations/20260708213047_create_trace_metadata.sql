create table if not exists public.trace_runs (
  id text primary key,
  app text not null,
  agent text not null,
  capture_mode text not null check (capture_mode in ('metadata-only', 'redacted-preview', 'full-debug')),
  started_at timestamptz not null,
  ended_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trace_events (
  id text not null,
  run_id text not null references public.trace_runs(id) on delete cascade,
  sequence integer not null check (sequence >= 0),
  event_type text not null check (
    event_type in (
      'trace.start',
      'source.read',
      'model.step',
      'tool.call',
      'policy.decision',
      'violation.detected',
      'trace.end'
    )
  ),
  event_timestamp timestamptz not null,
  actor jsonb not null,
  summary text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key (run_id, id),
  unique (run_id, sequence)
);

create table if not exists public.trace_findings (
  id text not null,
  run_id text not null references public.trace_runs(id) on delete cascade,
  finding_type text not null check (
    finding_type in ('exfiltration', 'untrusted_to_action', 'confused_deputy', 'destructive_write')
  ),
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  title text not null,
  summary text not null,
  evidence_event_ids text[] not null default '{}',
  recommendation text not null,
  created_at timestamptz not null default now(),
  primary key (run_id, id)
);

create index if not exists trace_events_run_sequence_idx
  on public.trace_events (run_id, sequence);

create index if not exists trace_events_type_idx
  on public.trace_events (event_type);

create index if not exists trace_findings_run_idx
  on public.trace_findings (run_id);

create index if not exists trace_findings_type_severity_idx
  on public.trace_findings (finding_type, severity);

alter table public.trace_runs enable row level security;
alter table public.trace_events enable row level security;
alter table public.trace_findings enable row level security;

alter table public.trace_runs force row level security;
alter table public.trace_events force row level security;
alter table public.trace_findings force row level security;

revoke all on table public.trace_runs from anon, authenticated;
revoke all on table public.trace_events from anon, authenticated;
revoke all on table public.trace_findings from anon, authenticated;

comment on table public.trace_runs is
  'Metadata-only agent security trace runs. Server routes write with a Supabase secret/service role key.';

comment on table public.trace_events is
  'Replay-compatible trace event metadata. Payloads must not contain raw customer secrets by default.';

comment on table public.trace_findings is
  'Deterministic security findings derived from trace events before LLM explanation.';
