-- Demo-only analytics seed for Admin Dashboard funnel/charts.
-- Safe to rerun: it removes previous rows created by this script first.
-- Do not run against real production data unless you intentionally want demo analytics rows.

delete from public.analytics_events
where source = 'demo_dashboard_seed'
   or metadata->>'marker' like 'DEMO_ANALYTICS_%';

with approved_courses as (
  select coalesce(array_agg(id order by created_at desc), array[]::uuid[]) as ids
  from public.courses
  where status = 'approved'
),
daily as (
  select generate_series(0, 29) as offset_day
),
daily_events as (
  select
    event_type,
    visitor_suffix,
    route,
    case
      when array_length(approved_courses.ids, 1) is null then null::uuid
      else approved_courses.ids[(daily.offset_day % array_length(approved_courses.ids, 1)) + 1]
    end as course_id,
    now() - (daily.offset_day || ' days')::interval + (visitor_suffix || ' minutes')::interval as created_at,
    daily.offset_day
  from daily
  cross join approved_courses
  cross join lateral (
    values
      ('page_view', 1, '/'),
      ('page_view', 2, '/search'),
      ('search_submit', 3, '/search'),
      ('course_view', 4, '/course/demo'),
      ('booking_start', 5, '/booking/demo'),
      ('booking_created', 6, '/booking/demo'),
      ('payment_success', 7, '/checkout/demo')
  ) as events(event_type, visitor_suffix, route)
  where events.event_type in ('page_view', 'search_submit')
     or (events.event_type = 'course_view' and daily.offset_day % 2 = 0)
     or (events.event_type = 'booking_start' and daily.offset_day % 4 = 0)
     or (events.event_type = 'booking_created' and daily.offset_day % 5 = 0)
     or (events.event_type = 'payment_success' and daily.offset_day % 7 = 0)
),
monthly as (
  select generate_series(0, 11) as offset_month
),
monthly_events as (
  select
    event_type,
    visitor_suffix,
    route,
    case
      when array_length(approved_courses.ids, 1) is null then null::uuid
      else approved_courses.ids[(monthly.offset_month % array_length(approved_courses.ids, 1)) + 1]
    end as course_id,
    date_trunc('month', now()) - (monthly.offset_month || ' months')::interval + (visitor_suffix || ' days')::interval as created_at,
    monthly.offset_month
  from monthly
  cross join approved_courses
  cross join lateral (
    values
      ('page_view', 10, '/'),
      ('search_submit', 11, '/search'),
      ('course_view', 12, '/course/demo'),
      ('booking_start', 13, '/booking/demo'),
      ('booking_created', 14, '/booking/demo'),
      ('payment_success', 15, '/checkout/demo')
  ) as events(event_type, visitor_suffix, route)
)
insert into public.analytics_events (
  event_type,
  visitor_id,
  session_id,
  route,
  page_title,
  course_id,
  source,
  metadata,
  created_at
)
select
  event_type,
  'DEMO_ANALYTICS_VISITOR_' || visitor_suffix || '_' || coalesce(offset_day, 0),
  'DEMO_ANALYTICS_SESSION_30D_' || visitor_suffix || '_' || coalesce(offset_day, 0),
  route,
  'VET Demo Analytics',
  course_id,
  'demo_dashboard_seed',
  jsonb_build_object('marker', 'DEMO_ANALYTICS_30D', 'offset_day', offset_day),
  created_at
from daily_events
union all
select
  event_type,
  'DEMO_ANALYTICS_VISITOR_MONTH_' || visitor_suffix || '_' || offset_month,
  'DEMO_ANALYTICS_SESSION_1Y_' || visitor_suffix || '_' || offset_month,
  route,
  'VET Demo Analytics',
  course_id,
  'demo_dashboard_seed',
  jsonb_build_object('marker', 'DEMO_ANALYTICS_1Y', 'offset_month', offset_month),
  created_at
from monthly_events;

-- Cleanup-only command:
-- delete from public.analytics_events where source = 'demo_dashboard_seed';
