-- Phase 8 safety: keep VET Plus AI credits consistent when activating subscriptions.
-- Root protection:
-- 1. New subscriptions created without explicit ai_credits_remaining should inherit
--    subscription_plans.ai_credits_per_month instead of the table default 0.
-- 2. complete_subscription_payment must activate VET Plus with the plan's monthly credits.
-- 3. get_my_subscription must prefer active, non-expired VET Plus rows.

create or replace function public.fill_subscription_initial_ai_credits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _plan_credits integer;
begin
  select coalesce(sp.ai_credits_per_month, 0)
  into _plan_credits
  from public.subscription_plans sp
  where sp.id = new.plan_id;

  if coalesce(_plan_credits, 0) > 0
    and coalesce(new.ai_credits_remaining, 0) = 0
    and new.status in ('active', 'pending')
  then
    new.ai_credits_remaining := _plan_credits;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_fill_subscription_initial_ai_credits
on public.learner_subscriptions;

create trigger trg_fill_subscription_initial_ai_credits
before insert on public.learner_subscriptions
for each row
execute function public.fill_subscription_initial_ai_credits();

create or replace function public.get_my_subscription()
returns table (
  subscription_id uuid,
  plan_code text,
  plan_name text,
  status text,
  is_plus boolean,
  price integer,
  billing_interval text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  ai_credits_remaining integer,
  ai_credits_per_month integer,
  voucher_count integer,
  voucher_amount integer,
  voucher_min_booking_amount integer,
  features jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    ls.id as subscription_id,
    sp.code as plan_code,
    sp.name as plan_name,
    ls.status,
    sp.code = 'vet_plus' as is_plus,
    sp.price,
    sp.billing_interval,
    ls.current_period_start,
    ls.current_period_end,
    ls.ai_credits_remaining,
    sp.ai_credits_per_month,
    sp.voucher_count,
    sp.voucher_amount,
    sp.voucher_min_booking_amount,
    sp.features
  from public.learner_subscriptions ls
  join public.subscription_plans sp on sp.id = ls.plan_id
  where ls.learner_id = (select auth.uid())
    and ls.status = 'active'
    and (ls.current_period_end is null or ls.current_period_end > now())
    and sp.is_active = true
  order by
    case when sp.code = 'vet_plus' then 2 when sp.code = 'free' then 1 else 0 end desc,
    ls.current_period_end desc nulls last,
    ls.created_at desc
  limit 1;
$$;

create or replace function public.complete_subscription_payment(
  _reference_code text,
  _paid_amount integer,
  _payment_session_id text default null,
  _provider_payload jsonb default '{}'::jsonb
)
returns table (
  ok boolean,
  reason text,
  payment_id uuid,
  subscription_id uuid,
  plan_code text,
  current_period_end timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  _payment record;
  _plan record;
  _new_subscription_id uuid;
  _new_period_end timestamptz;
  _existing_plan_code text;
  _existing_period_end timestamptz;
  _initial_ai_credits integer;
begin
  if _reference_code is null or length(trim(_reference_code)) = 0 then
    return query select false, 'missing_reference_code', null::uuid, null::uuid, null::text, null::timestamptz;
    return;
  end if;

  if _paid_amount is null or _paid_amount <= 0 then
    return query select false, 'invalid_paid_amount', null::uuid, null::uuid, null::text, null::timestamptz;
    return;
  end if;

  select *
  into _payment
  from public.subscription_payments spay
  where spay.reference_code = upper(trim(_reference_code))
     or spay.reference_code = trim(_reference_code)
  order by spay.created_at desc
  limit 1
  for update;

  if not found then
    return query select false, 'payment_not_found', null::uuid, null::uuid, null::text, null::timestamptz;
    return;
  end if;

  if _payment.payment_status = 'success' then
    select sp.code
    into _existing_plan_code
    from public.subscription_plans sp
    where sp.id = _payment.plan_id;

    select ls.current_period_end
    into _existing_period_end
    from public.learner_subscriptions ls
    where ls.id = _payment.subscription_id;

    return query select
      true,
      'already_success',
      _payment.id,
      _payment.subscription_id,
      coalesce(_existing_plan_code, 'unknown'),
      _existing_period_end;
    return;
  end if;

  if _payment.payment_status <> 'pending' then
    return query select false, 'payment_not_pending', _payment.id, _payment.subscription_id, null::text, null::timestamptz;
    return;
  end if;

  if _paid_amount <> _payment.amount then
    update public.subscription_payments spay
    set
      provider_payload = coalesce(_provider_payload, '{}'::jsonb),
      payment_session_id = coalesce(_payment_session_id, _payment.payment_session_id),
      updated_at = now()
    where spay.id = _payment.id;

    return query select false, 'amount_mismatch', _payment.id, _payment.subscription_id, null::text, null::timestamptz;
    return;
  end if;

  select *
  into _plan
  from public.subscription_plans sp
  where sp.id = _payment.plan_id
    and sp.code = 'vet_plus'
    and sp.is_active = true;

  if not found then
    return query select false, 'vet_plus_plan_not_found', _payment.id, _payment.subscription_id, null::text, null::timestamptz;
    return;
  end if;

  _initial_ai_credits := coalesce(_plan.ai_credits_per_month, 0);
  if _initial_ai_credits <= 0 then
    return query select false, 'invalid_plan_ai_credits', _payment.id, _payment.subscription_id, _plan.code, null::timestamptz;
    return;
  end if;

  update public.learner_subscriptions ls
  set
    status = case
      when ls.current_period_end <= now() then 'expired'
      else 'cancelled'
    end,
    updated_at = now()
  where ls.learner_id = _payment.learner_id
    and ls.status = 'active';

  _new_period_end := now() + interval '1 month';

  insert into public.learner_subscriptions (
    learner_id,
    plan_id,
    status,
    current_period_start,
    current_period_end,
    ai_credits_remaining,
    auto_renew
  )
  values (
    _payment.learner_id,
    _plan.id,
    'active',
    now(),
    _new_period_end,
    _initial_ai_credits,
    false
  )
  returning id into _new_subscription_id;

  update public.subscription_payments spay
  set
    subscription_id = _new_subscription_id,
    payment_status = 'success',
    paid_at = now(),
    completed_at = now(),
    payment_session_id = coalesce(_payment_session_id, _payment.payment_session_id),
    provider_payload = coalesce(_provider_payload, '{}'::jsonb),
    updated_at = now()
  where spay.id = _payment.id;

  perform public.generate_vet_plus_vouchers_for_subscription(_new_subscription_id);

  return query select
    true,
    'completed',
    _payment.id,
    _new_subscription_id,
    _plan.code,
    _new_period_end;
end;
$$;

revoke execute on function public.fill_subscription_initial_ai_credits() from public;
revoke execute on function public.get_my_subscription() from public;
revoke execute on function public.complete_subscription_payment(text, integer, text, jsonb) from public;

grant execute on function public.get_my_subscription() to authenticated;
grant execute on function public.complete_subscription_payment(text, integer, text, jsonb) to service_role;

notify pgrst, 'reload schema';
