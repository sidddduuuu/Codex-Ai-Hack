alter table public.trace_events
  drop constraint if exists trace_events_pkey;

alter table public.trace_events
  add primary key (run_id, id);

alter table public.trace_findings
  drop constraint if exists trace_findings_pkey;

alter table public.trace_findings
  add primary key (run_id, id);
