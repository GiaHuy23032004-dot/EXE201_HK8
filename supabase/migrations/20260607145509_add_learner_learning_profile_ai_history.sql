-- Phase 7E: Learner Learning Profile + AI History helpers.
-- Keep this migration idempotent because subscription/AI tables may already exist
-- from prior phases that were applied outside this local repo.

create table if not exists public.learner_learning_profiles (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.profiles(user_id) on delete cascade unique,
  primary_goal text,
  current_level text,
  preferred_categories text[] not null default '{}'::text[],
  preferred_format text not null default 'any',
  budget_min integer,
  budget_max integer,
  location_preference text,
  schedule_preference text,
  learning_style text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learner_learning_profiles_preferred_format_check
    check (preferred_format in ('online', 'offline', 'any')),
  constraint learner_learning_profiles_budget_min_check
    check (budget_min is null or budget_min >= 0),
  constraint learner_learning_profiles_budget_max_check
    check (budget_max is null or budget_max >= 0),
  constraint learner_learning_profiles_budget_range_check
    check (budget_min is null or budget_max is null or budget_min <= budget_max)
);

create index if not exists idx_learner_learning_profiles_learner_id
on public.learner_learning_profiles(learner_id);

alter table public.learner_learning_profiles enable row level security;

grant select, insert, update on public.learner_learning_profiles to authenticated;

drop policy if exists "Learners can view own learning profile"
on public.learner_learning_profiles;
create policy "Learners can view own learning profile"
on public.learner_learning_profiles
for select
to authenticated
using ((select auth.uid()) = learner_id);

drop policy if exists "Learners can insert own learning profile"
on public.learner_learning_profiles;
create policy "Learners can insert own learning profile"
on public.learner_learning_profiles
for insert
to authenticated
with check ((select auth.uid()) = learner_id);

drop policy if exists "Learners can update own learning profile"
on public.learner_learning_profiles;
create policy "Learners can update own learning profile"
on public.learner_learning_profiles
for update
to authenticated
using ((select auth.uid()) = learner_id)
with check ((select auth.uid()) = learner_id);

drop trigger if exists trg_learner_learning_profiles_updated_at
on public.learner_learning_profiles;
create trigger trg_learner_learning_profiles_updated_at
before update on public.learner_learning_profiles
for each row execute function public.update_updated_at_column();

create or replace function public.get_my_learning_profile()
returns table (
  id uuid,
  learner_id uuid,
  primary_goal text,
  current_level text,
  preferred_categories text[],
  preferred_format text,
  budget_min integer,
  budget_max integer,
  location_preference text,
  schedule_preference text,
  learning_style text,
  notes text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.learner_id,
    p.primary_goal,
    p.current_level,
    p.preferred_categories,
    p.preferred_format,
    p.budget_min,
    p.budget_max,
    p.location_preference,
    p.schedule_preference,
    p.learning_style,
    p.notes,
    p.created_at,
    p.updated_at
  from public.learner_learning_profiles p
  where p.learner_id = (select auth.uid())
  limit 1;
$$;

create or replace function public.upsert_my_learning_profile(
  _primary_goal text default null,
  _current_level text default null,
  _preferred_categories text[] default '{}'::text[],
  _preferred_format text default 'any',
  _budget_min integer default null,
  _budget_max integer default null,
  _location_preference text default null,
  _schedule_preference text default null,
  _learning_style text default null,
  _notes text default null
)
returns public.learner_learning_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := (select auth.uid());
  _valid_categories text[] := array[
    'mind-sports',
    'career-english',
    'modern-sports',
    'barista-beverage',
    'content-speaking',
    'ai-productivity'
  ];
  _clean_categories text[];
  _clean_format text;
  _row public.learner_learning_profiles;
begin
  if _uid is null then
    raise exception 'Bạn cần đăng nhập để cập nhật hồ sơ học tập.';
  end if;

  select coalesce(array_agg(distinct category), '{}'::text[])
  into _clean_categories
  from unnest(coalesce(_preferred_categories, '{}'::text[])) as category
  where category = any(_valid_categories);

  _clean_format := case
    when _preferred_format in ('online', 'offline', 'any') then _preferred_format
    else 'any'
  end;

  if _budget_min is not null and _budget_min < 0 then
    raise exception 'Ngân sách tối thiểu không hợp lệ.';
  end if;

  if _budget_max is not null and _budget_max < 0 then
    raise exception 'Ngân sách tối đa không hợp lệ.';
  end if;

  if _budget_min is not null and _budget_max is not null and _budget_min > _budget_max then
    raise exception 'Ngân sách tối thiểu không được lớn hơn ngân sách tối đa.';
  end if;

  insert into public.learner_learning_profiles (
    learner_id,
    primary_goal,
    current_level,
    preferred_categories,
    preferred_format,
    budget_min,
    budget_max,
    location_preference,
    schedule_preference,
    learning_style,
    notes
  )
  values (
    _uid,
    nullif(left(trim(coalesce(_primary_goal, '')), 500), ''),
    nullif(left(trim(coalesce(_current_level, '')), 80), ''),
    _clean_categories,
    _clean_format,
    _budget_min,
    _budget_max,
    nullif(left(trim(coalesce(_location_preference, '')), 160), ''),
    nullif(left(trim(coalesce(_schedule_preference, '')), 160), ''),
    nullif(left(trim(coalesce(_learning_style, '')), 160), ''),
    nullif(left(trim(coalesce(_notes, '')), 500), '')
  )
  on conflict (learner_id) do update
  set
    primary_goal = excluded.primary_goal,
    current_level = excluded.current_level,
    preferred_categories = excluded.preferred_categories,
    preferred_format = excluded.preferred_format,
    budget_min = excluded.budget_min,
    budget_max = excluded.budget_max,
    location_preference = excluded.location_preference,
    schedule_preference = excluded.schedule_preference,
    learning_style = excluded.learning_style,
    notes = excluded.notes,
    updated_at = now()
  returning * into _row;

  return _row;
end;
$$;

create or replace function public.get_my_ai_history(_feature text default null)
returns table (
  id uuid,
  feature text,
  credits_used integer,
  status text,
  prompt_preview text,
  metadata jsonb,
  created_at timestamptz,
  completed_at timestamptz,
  refunded_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    l.id,
    l.feature::text,
    l.credits::integer as credits_used,
    l.status::text,
    l.prompt_preview,
    (
      coalesce(l.metadata, '{}'::jsonb)
      - 'raw'
      - 'payload'
      - 'provider_payload'
      - 'response'
      - 'full_response'
    ) as metadata,
    l.created_at,
    l.finalized_at as completed_at,
    null::timestamptz as refunded_at
  from public.ai_usage_logs l
  where l.learner_id = (select auth.uid())
    and (
      _feature is null
      or _feature = 'all'
      or l.feature::text = _feature
      or (_feature = 'chat_search' and l.feature::text in ('chat', 'search', 'course_match'))
    )
  order by l.created_at desc
  limit 100;
$$;

revoke execute on function public.get_my_learning_profile() from public;
revoke execute on function public.get_my_learning_profile() from anon;
revoke execute on function public.upsert_my_learning_profile(
  text,
  text,
  text[],
  text,
  integer,
  integer,
  text,
  text,
  text,
  text
) from public;
revoke execute on function public.upsert_my_learning_profile(
  text,
  text,
  text[],
  text,
  integer,
  integer,
  text,
  text,
  text,
  text
) from anon;
revoke execute on function public.get_my_ai_history(text) from public;
revoke execute on function public.get_my_ai_history(text) from anon;

grant execute on function public.get_my_learning_profile() to authenticated;
grant execute on function public.upsert_my_learning_profile(
  text,
  text,
  text[],
  text,
  integer,
  integer,
  text,
  text,
  text,
  text
) to authenticated;
grant execute on function public.get_my_ai_history(text) to authenticated;
