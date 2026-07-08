create table if not exists public.branch_build_v0_1_local_replay_trace_runs (
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

create table if not exists public.branch_build_v0_1_local_replay_trace_events (
  id text not null,
  run_id text not null references public.branch_build_v0_1_local_replay_trace_runs(id) on delete cascade,
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

create table if not exists public.branch_build_v0_1_local_replay_trace_findings (
  id text not null,
  run_id text not null references public.branch_build_v0_1_local_replay_trace_runs(id) on delete cascade,
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

create index if not exists branch_build_v0_1_local_replay_trace_events_run_sequence_idx
  on public.branch_build_v0_1_local_replay_trace_events (run_id, sequence);

create index if not exists branch_build_v0_1_local_replay_trace_events_type_idx
  on public.branch_build_v0_1_local_replay_trace_events (event_type);

create index if not exists branch_build_v0_1_local_replay_trace_findings_run_idx
  on public.branch_build_v0_1_local_replay_trace_findings (run_id);

create index if not exists branch_build_v0_1_local_replay_trace_findings_type_severity_idx
  on public.branch_build_v0_1_local_replay_trace_findings (finding_type, severity);

alter table public.branch_build_v0_1_local_replay_trace_runs enable row level security;
alter table public.branch_build_v0_1_local_replay_trace_events enable row level security;
alter table public.branch_build_v0_1_local_replay_trace_findings enable row level security;

alter table public.branch_build_v0_1_local_replay_trace_runs force row level security;
alter table public.branch_build_v0_1_local_replay_trace_events force row level security;
alter table public.branch_build_v0_1_local_replay_trace_findings force row level security;

revoke all on table public.branch_build_v0_1_local_replay_trace_runs from anon, authenticated;
revoke all on table public.branch_build_v0_1_local_replay_trace_events from anon, authenticated;
revoke all on table public.branch_build_v0_1_local_replay_trace_findings from anon, authenticated;

comment on table public.branch_build_v0_1_local_replay_trace_runs is
  'Branch-isolated metadata-only agent security trace runs for build-v0.1-local-replay.';

comment on table public.branch_build_v0_1_local_replay_trace_events is
  'Branch-isolated replay-compatible trace event metadata for build-v0.1-local-replay.';

comment on table public.branch_build_v0_1_local_replay_trace_findings is
  'Branch-isolated deterministic security findings for build-v0.1-local-replay.';
