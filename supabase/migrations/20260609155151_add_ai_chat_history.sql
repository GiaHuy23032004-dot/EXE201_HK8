-- Persistent EduBot chat history.
-- Chat content is learner-owned and protected by RLS. AI usage/credit logs remain
-- in ai_usage_logs; these tables store the actual conversation transcript.

create table if not exists public.ai_chat_conversations (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.profiles(user_id) on delete cascade,
  title text,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_chat_conversations(id) on delete cascade,
  learner_id uuid not null references public.profiles(user_id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_chat_conversations_learner_last_message
  on public.ai_chat_conversations(learner_id, last_message_at desc);

create index if not exists idx_ai_chat_messages_conversation_created
  on public.ai_chat_messages(conversation_id, created_at asc);

create index if not exists idx_ai_chat_messages_learner_created
  on public.ai_chat_messages(learner_id, created_at desc);

alter table public.ai_chat_conversations enable row level security;
alter table public.ai_chat_messages enable row level security;

grant select, insert, update on public.ai_chat_conversations to authenticated;
grant select, insert on public.ai_chat_messages to authenticated;

drop policy if exists "Learners can select own chat conversations" on public.ai_chat_conversations;
create policy "Learners can select own chat conversations"
on public.ai_chat_conversations
for select
to authenticated
using ((select auth.uid()) = learner_id);

drop policy if exists "Learners can insert own chat conversations" on public.ai_chat_conversations;
create policy "Learners can insert own chat conversations"
on public.ai_chat_conversations
for insert
to authenticated
with check ((select auth.uid()) = learner_id);

drop policy if exists "Learners can update own chat conversations" on public.ai_chat_conversations;
create policy "Learners can update own chat conversations"
on public.ai_chat_conversations
for update
to authenticated
using ((select auth.uid()) = learner_id)
with check ((select auth.uid()) = learner_id);

drop policy if exists "Learners can select own chat messages" on public.ai_chat_messages;
create policy "Learners can select own chat messages"
on public.ai_chat_messages
for select
to authenticated
using ((select auth.uid()) = learner_id);

drop policy if exists "Learners can insert own chat messages" on public.ai_chat_messages;
create policy "Learners can insert own chat messages"
on public.ai_chat_messages
for insert
to authenticated
with check (
  (select auth.uid()) = learner_id
  and exists (
    select 1
    from public.ai_chat_conversations c
    where c.id = conversation_id
      and c.learner_id = (select auth.uid())
  )
);

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_ai_chat_conversations_updated_at on public.ai_chat_conversations;
create trigger trg_ai_chat_conversations_updated_at
before update on public.ai_chat_conversations
for each row
execute function public.update_updated_at_column();

create or replace function public.get_my_chat_conversations()
returns table (
  id uuid,
  title text,
  last_message_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  message_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    c.title,
    c.last_message_at,
    c.created_at,
    c.updated_at,
    count(m.id)::bigint as message_count
  from public.ai_chat_conversations c
  left join public.ai_chat_messages m on m.conversation_id = c.id
  where c.learner_id = (select auth.uid())
  group by c.id
  order by c.last_message_at desc
  limit 20;
$$;

create or replace function public.get_my_chat_messages(_conversation_id uuid)
returns table (
  id uuid,
  conversation_id uuid,
  learner_id uuid,
  role text,
  content text,
  metadata jsonb,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    recent.id,
    recent.conversation_id,
    recent.learner_id,
    recent.role,
    recent.content,
    recent.metadata,
    recent.created_at
  from (
    select m.*
    from public.ai_chat_messages m
    join public.ai_chat_conversations c on c.id = m.conversation_id
    where m.conversation_id = _conversation_id
      and c.learner_id = (select auth.uid())
      and m.learner_id = (select auth.uid())
    order by m.created_at desc
    limit 50
  ) recent
  order by recent.created_at asc;
$$;

create or replace function public.create_or_get_active_chat_conversation()
returns table (
  id uuid,
  title text,
  last_message_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  conversation_row public.ai_chat_conversations%rowtype;
begin
  if current_user_id is null then
    raise exception 'not_authenticated';
  end if;

  select *
  into conversation_row
  from public.ai_chat_conversations c
  where c.learner_id = current_user_id
  order by c.last_message_at desc
  limit 1;

  if found then
    return query
    select
      conversation_row.id,
      conversation_row.title,
      conversation_row.last_message_at,
      conversation_row.created_at,
      conversation_row.updated_at;
    return;
  end if;

  insert into public.ai_chat_conversations (learner_id)
  values (current_user_id)
  returning * into conversation_row;

  return query
  select
    conversation_row.id,
    conversation_row.title,
    conversation_row.last_message_at,
    conversation_row.created_at,
    conversation_row.updated_at;
end;
$$;

create or replace function public.clear_my_chat_conversation(_conversation_id uuid)
returns table (
  ok boolean,
  reason text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    return query select false, 'not_authenticated';
    return;
  end if;

  delete from public.ai_chat_conversations c
  where c.id = _conversation_id
    and c.learner_id = current_user_id;

  if found then
    return query select true, null::text;
  else
    return query select false, 'conversation_not_found';
  end if;
end;
$$;

revoke execute on function public.get_my_chat_conversations() from public, anon;
revoke execute on function public.get_my_chat_messages(uuid) from public, anon;
revoke execute on function public.create_or_get_active_chat_conversation() from public, anon;
revoke execute on function public.clear_my_chat_conversation(uuid) from public, anon;

grant execute on function public.get_my_chat_conversations() to authenticated;
grant execute on function public.get_my_chat_messages(uuid) to authenticated;
grant execute on function public.create_or_get_active_chat_conversation() to authenticated;
grant execute on function public.clear_my_chat_conversation(uuid) to authenticated;

notify pgrst, 'reload schema';
