-- ============================================================
-- AI Task Manager - Supabase Schema
-- Supabase SQL Editor'da çalıştırın.
-- ============================================================

create extension if not exists pgcrypto;


-- ============================================================
-- 1. TASKS
-- ============================================================

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  title text not null
    check (char_length(title) between 1 and 120),

  description text
    check (
      description is null
      or char_length(description) <= 1200
    ),

  status text not null default 'todo'
    check (
      status in ('todo', 'in_progress', 'done')
    ),

  priority text not null default 'normal'
    check (
      priority in ('low', 'normal', 'high')
    ),

  due_date date,

  automation_status text not null default 'not_sent'
    check (
      automation_status in (
        'not_sent',
        'queued',
        'processed',
        'failed'
      )
    ),

  -- n8n / Claude tarafından üretilen görev analizi
  ai_analysis text,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now()
);


-- ============================================================
-- 2. TASK INDEX
-- ============================================================

create index if not exists idx_tasks_user_created
on public.tasks(user_id, created_at desc);


-- ============================================================
-- 3. TASKS - ROW LEVEL SECURITY
-- ============================================================

alter table public.tasks
enable row level security;


-- ------------------------------------------------------------
-- SELECT
-- Kullanıcı yalnızca kendi görevlerini görebilir.
-- ------------------------------------------------------------

drop policy if exists "tasks_select_own"
on public.tasks;

create policy "tasks_select_own"
on public.tasks
for select
to authenticated
using (
  auth.uid() = user_id
);


-- ------------------------------------------------------------
-- INSERT
-- Kullanıcı yalnızca kendi user_id değeriyle görev oluşturabilir.
-- ------------------------------------------------------------

drop policy if exists "tasks_insert_own"
on public.tasks;

create policy "tasks_insert_own"
on public.tasks
for insert
to authenticated
with check (
  auth.uid() = user_id
);


-- ------------------------------------------------------------
-- UPDATE
-- Kullanıcı yalnızca kendi görevlerini güncelleyebilir.
-- ------------------------------------------------------------

drop policy if exists "tasks_update_own"
on public.tasks;

create policy "tasks_update_own"
on public.tasks
for update
to authenticated
using (
  auth.uid() = user_id
)
with check (
  auth.uid() = user_id
);


-- ------------------------------------------------------------
-- DELETE
-- Kullanıcı yalnızca kendi görevlerini silebilir.
-- ------------------------------------------------------------

drop policy if exists "tasks_delete_own"
on public.tasks;

create policy "tasks_delete_own"
on public.tasks
for delete
to authenticated
using (
  auth.uid() = user_id
);


-- ============================================================
-- 4. FEEDBACK
-- ============================================================

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  type text not null
    check (
      type in ('bug', 'feature', 'ux', 'other')
    ),

  message text not null
    check (
      char_length(message) between 1 and 2000
    ),

  status text not null default 'new'
    check (
      status in (
        'new',
        'reviewing',
        'resolved',
        'rejected'
      )
    ),

  created_at timestamptz not null default now()
);


-- ============================================================
-- 5. FEEDBACK INDEX
-- ============================================================

create index if not exists idx_feedback_user_created
on public.feedback(user_id, created_at desc);


-- ============================================================
-- 6. FEEDBACK - ROW LEVEL SECURITY
-- ============================================================

alter table public.feedback
enable row level security;


-- ------------------------------------------------------------
-- INSERT
-- Kullanıcı yalnızca kendi adına feedback oluşturabilir.
-- ------------------------------------------------------------

drop policy if exists "feedback_insert_own"
on public.feedback;

create policy "feedback_insert_own"
on public.feedback
for insert
to authenticated
with check (
  auth.uid() = user_id
);


-- ------------------------------------------------------------
-- SELECT
-- Kullanıcı yalnızca kendi feedback kayıtlarını görebilir.
-- ------------------------------------------------------------

drop policy if exists "feedback_select_own"
on public.feedback;

create policy "feedback_select_own"
on public.feedback
for select
to authenticated
using (
  auth.uid() = user_id
);