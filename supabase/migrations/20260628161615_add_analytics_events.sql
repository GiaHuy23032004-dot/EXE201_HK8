create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  user_id uuid references auth.users(id) on delete set null,
  visitor_id text,
  session_id text,
  route text,
  page_title text,
  course_id uuid references public.courses(id) on delete set null,
  mentor_id uuid references public.profiles(user_id) on delete set null,
  booking_id uuid references public.bookings(id) on delete set null,
  transaction_id uuid references public.transactions(id) on delete set null,
  source text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_event_type_idx on public.analytics_events (event_type);
create index if not exists analytics_events_created_at_idx on public.analytics_events (created_at);
create index if not exists analytics_events_course_id_idx on public.analytics_events (course_id);
create index if not exists analytics_events_user_id_idx on public.analytics_events (user_id);
create index if not exists analytics_events_visitor_id_idx on public.analytics_events (visitor_id);
create index if not exists analytics_events_session_id_idx on public.analytics_events (session_id);

alter table public.analytics_events enable row level security;

grant select, insert on table public.analytics_events to service_role;

comment on table public.analytics_events is
  'Internal analytics events. Clients do not read/write directly; events are inserted through the track-event Edge Function and read through protected admin metrics.';
