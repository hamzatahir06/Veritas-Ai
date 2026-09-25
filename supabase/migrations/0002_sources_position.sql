-- ============================================================================
-- 0002 — citation order on `sources`
--
-- WHY: a brief cites its sources as [1], [2], … in the order they were found,
-- but nothing in a `sources` row recorded that order — `id` is a random uuid
-- and every row of a project shares one `created_at`. get_project() therefore
-- read them back in whatever order Postgres chose, so a saved brief's [7]
-- could link to (and a regenerated PDF/Word file could list) the wrong source.
--
-- save_project() now writes each row's citation number here and get_project()
-- orders by it. Run this BEFORE deploying that code: inserts that name a
-- missing column fail. Safe to run more than once.
-- ============================================================================

alter table public.sources add column if not exists position integer;

-- Rows saved before this migration keep NULL and sort after numbered ones.
-- Backfilling is not possible: the original order was never stored.

comment on column public.sources.position is 'Citation number: this source is [position] in the brief. NULL on rows saved before 0002.';
