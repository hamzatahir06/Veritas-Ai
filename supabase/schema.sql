-- ============================================================================
-- Veritas AI — Research Brief Agent
-- Full database schema. Run this against a NEW Supabase project to stand the
-- backend up from scratch; run the files in ./migrations/ against a project
-- that already has data.
--
-- Paste into the Supabase dashboard SQL editor and run. Every statement is
-- idempotent, so re-running it on an existing project is safe.
--
-- RECONSTRUCTED FROM THE APPLICATION CODE (backend/services/storage.py and
-- backend/api/routes.py), not exported from the live database. Column types
-- and defaults are what the code implies, so diff this against your dashboard
-- once and correct anything that drifted.
-- ============================================================================

-- gen_random_uuid()
create extension if not exists pgcrypto;


-- ----------------------------------------------------------------------------
-- projects — one completed research run
-- ----------------------------------------------------------------------------
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,

  topic       text not null,               -- what the user asked
  title       text,                        -- currently written same as topic
  status      text not null default 'completed',
  markdown    text,                        -- the brief itself

  -- Supabase Storage keys in the `documents` bucket, shaped
  -- `{user_id}/{project_id}.docx|.pdf`. Null until the documents are built,
  -- which is what makes download_document() generate them on demand.
  docx_path   text,
  pdf_path    text,

  created_at  timestamptz not null default now()
);

-- list_projects() filters by user_id and orders by created_at desc.
create index if not exists projects_user_created_idx
  on public.projects (user_id, created_at desc);


-- ----------------------------------------------------------------------------
-- sources — every search result behind a brief
--
-- The last four columns feed the IEEE reference list
-- (services/document_common.py build_references): `authors` and `venue` print
-- directly, `published` is scanned for a year, and `kind` records whether the
-- hit came from web search or the scholarly index.
-- ----------------------------------------------------------------------------
create table if not exists public.sources (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  position    integer,                     -- citation number: this row is [position] in the brief

  query       text,                        -- the query that surfaced this hit
  title       text,
  url         text,
  snippet     text,

  authors     text,                        -- scholarly hits only; '' for web
  venue       text,                        -- journal/conference, or the domain
  published   text,                        -- free-form date; only the year is read
  kind        text,                        -- 'web' | 'scholarly'

  created_at  timestamptz not null default now()
);

create index if not exists sources_project_idx
  on public.sources (project_id);

-- list_sources() orders the user's whole source library by recency.
create index if not exists sources_created_idx
  on public.sources (created_at desc);


-- ----------------------------------------------------------------------------
-- waitlist — Pro signups
--
-- add_to_waitlist() treats a unique violation as "already joined" rather than
-- an error, so the unique constraint on email is load-bearing.
-- ----------------------------------------------------------------------------
create table if not exists public.waitlist (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  user_id     uuid references auth.users (id) on delete set null,
  source      text default 'pro_waitlist',
  created_at  timestamptz not null default now()
);


-- ============================================================================
-- Row Level Security
--
-- The backend talks to Postgres with the SERVICE ROLE key, which bypasses RLS
-- entirely — these policies exist so that the day anything queries from the
-- browser with the anon key, the rules are already right. With RLS enabled and
-- no matching policy, a browser-side query returns zero rows rather than
-- leaking another user's research.
-- ============================================================================

alter table public.projects enable row level security;
alter table public.sources  enable row level security;
alter table public.waitlist enable row level security;

-- --- projects: a user sees and controls only their own ----------------------
drop policy if exists "projects: owner can read"   on public.projects;
drop policy if exists "projects: owner can insert" on public.projects;
drop policy if exists "projects: owner can update" on public.projects;
drop policy if exists "projects: owner can delete" on public.projects;

create policy "projects: owner can read"
  on public.projects for select
  to authenticated
  using (auth.uid() = user_id);

create policy "projects: owner can insert"
  on public.projects for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "projects: owner can update"
  on public.projects for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "projects: owner can delete"
  on public.projects for delete
  to authenticated
  using (auth.uid() = user_id);

-- --- sources: ownership is inherited through the parent project -------------
drop policy if exists "sources: owner can read"   on public.sources;
drop policy if exists "sources: owner can insert" on public.sources;
drop policy if exists "sources: owner can delete" on public.sources;

create policy "sources: owner can read"
  on public.sources for select
  to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = sources.project_id and p.user_id = auth.uid()
    )
  );

create policy "sources: owner can insert"
  on public.sources for insert
  to authenticated
  with check (
    exists (
      select 1 from public.projects p
      where p.id = sources.project_id and p.user_id = auth.uid()
    )
  );

create policy "sources: owner can delete"
  on public.sources for delete
  to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = sources.project_id and p.user_id = auth.uid()
    )
  );

-- --- waitlist: write-only from the browser ----------------------------------
-- Anyone may add themselves; nobody may read the list back. Deliberately no
-- select policy — the email list is not public, and the backend reads it with
-- the service role.
drop policy if exists "waitlist: anyone can join" on public.waitlist;

create policy "waitlist: anyone can join"
  on public.waitlist for insert
  to anon, authenticated
  with check (true);


-- ============================================================================
-- Storage — the `documents` bucket
--
-- Holds the generated .docx and .pdf, keyed `{user_id}/{project_id}.ext`.
-- PRIVATE: the API hands out short-lived signed URLs (get_document_url,
-- 5 minutes), so the objects must never be publicly readable.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- The first path segment is the owner's user id, which is what these check.
drop policy if exists "documents: owner can read"   on storage.objects;
drop policy if exists "documents: owner can write"  on storage.objects;
drop policy if exists "documents: owner can delete" on storage.objects;

create policy "documents: owner can read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "documents: owner can write"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "documents: owner can delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
