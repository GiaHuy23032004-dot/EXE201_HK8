create table if not exists public.system_settings (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  category text not null,
  value jsonb not null default '{}'::jsonb,
  description text,
  is_sensitive boolean not null default false,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.system_setting_audit_logs (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null,
  old_value jsonb,
  new_value jsonb,
  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default now()
);

alter table public.system_settings enable row level security;
alter table public.system_setting_audit_logs enable row level security;

drop policy if exists "system_settings_admin_select" on public.system_settings;
drop policy if exists "system_settings_admin_insert" on public.system_settings;
drop policy if exists "system_settings_admin_update" on public.system_settings;
drop policy if exists "system_settings_admin_delete" on public.system_settings;
drop policy if exists "system_setting_audit_logs_admin_select" on public.system_setting_audit_logs;

create policy "system_settings_admin_select"
on public.system_settings
for select
to authenticated
using (
  exists (
    select 1
    from public.user_roles
    where user_id = (select auth.uid())
      and role = 'admin'
  )
);

create policy "system_settings_admin_insert"
on public.system_settings
for insert
to authenticated
with check (
  exists (
    select 1
    from public.user_roles
    where user_id = (select auth.uid())
      and role = 'admin'
  )
);

create policy "system_settings_admin_update"
on public.system_settings
for update
to authenticated
using (
  exists (
    select 1
    from public.user_roles
    where user_id = (select auth.uid())
      and role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.user_roles
    where user_id = (select auth.uid())
      and role = 'admin'
  )
);

create policy "system_settings_admin_delete"
on public.system_settings
for delete
to authenticated
using (
  exists (
    select 1
    from public.user_roles
    where user_id = (select auth.uid())
      and role = 'admin'
  )
);

create policy "system_setting_audit_logs_admin_select"
on public.system_setting_audit_logs
for select
to authenticated
using (
  exists (
    select 1
    from public.user_roles
    where user_id = (select auth.uid())
      and role = 'admin'
  )
);

create index if not exists idx_system_settings_key on public.system_settings(key);
create index if not exists idx_system_settings_category on public.system_settings(category);
create index if not exists idx_system_setting_audit_logs_setting_key on public.system_setting_audit_logs(setting_key);

insert into public.system_settings (key, category, value, description, is_sensitive)
values
(
  'access_security',
  'access_security',
  '{
    "prevent_last_admin_removal": true,
    "prevent_admin_self_block": true,
    "require_admin_check_edge_function": true
  }'::jsonb,
  'Admin access and security guardrail settings.',
  false
),
(
  'moderation_reports',
  'moderation_reports',
  '{
    "report_detail_min_length": 20,
    "report_detail_max_length": 1200,
    "report_title_max_length": 120,
    "report_reason_max_length": 160,
    "evidence_max_files": 5,
    "evidence_max_file_mb": 5,
    "auto_hide_report_threshold": 5,
    "appeal_window_days": 7,
    "strike_1_expire_days": 30,
    "strike_2_expire_days": 90,
    "strike_2_posting_suspension_days": 7,
    "strike_3_permanent": true
  }'::jsonb,
  'Report validation, auto-hide, appeal, and strike behavior.',
  false
),
(
  'mentor_verification',
  'mentor_verification',
  '{
    "allow_mentor_create_draft_before_verified": true,
    "allow_mentor_publish_before_verified": false,
    "allow_mentor_receive_booking_before_verified": false,
    "require_avatar_upload": true,
    "require_at_least_one_evidence": true,
    "accepted_evidence_types": ["social_link", "certificate", "cv_portfolio"],
    "show_vet_verified_badge": true,
    "show_certificate_verified_badge": true,
    "show_portfolio_verified_badge": true,
    "show_trusted_mentor_badge": true,
    "strike_1_suspend_trusted_badge_days": 0,
    "strike_2_suspend_trusted_badge": true,
    "strike_3_revoke_trusted_badge": true,
    "revoke_vet_verified_only_for_fraud": true
  }'::jsonb,
  'Mentor verification, public trust badge, and punishment integration settings.',
  false
),
(
  'marketplace_rules',
  'marketplace_rules',
  '{
    "public_only_show_approved_courses": true,
    "public_hide_hidden_courses": true,
    "allow_online_courses": true,
    "allow_offline_courses": true,
    "promoted_listing_default_days": 3,
    "promoted_listing_default_fee": 15000,
    "minimum_course_price": 0,
    "maximum_course_price": null
  }'::jsonb,
  'Marketplace visibility and listing defaults.',
  false
),
(
  'payment_placeholder',
  'payment_placeholder',
  '{
    "payment_provider_status": "planning",
    "current_provider": "mock / not configured",
    "platform_fee_rate": 0.15,
    "hold_period": "Chưa chốt",
    "webhook_status": "Chưa cấu hình",
    "learner_payment_flow_status": "Đang lên kế hoạch",
    "mentor_withdrawal_status": "Giải quyết sau",
    "provider_checklist": ["SePay", "payOS", "MoMo", "VNPAY", "Mock"]
  }'::jsonb,
  'Safe payment planning placeholder. Do not store secrets in this setting.',
  false
),
(
  'system_health',
  'system_health',
  '{
    "payment_webhook_status": "not_configured",
    "last_payment_webhook_received": null
  }'::jsonb,
  'Read-only lightweight health metadata.',
  false
)
on conflict (key) do update
set
  category = excluded.category,
  value = excluded.value,
  description = excluded.description,
  is_sensitive = excluded.is_sensitive,
  updated_at = now();
