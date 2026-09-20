-- ============================================================================
-- 0001 — reference metadata on `sources`
--
-- WHY: the search tools already attach authors / venue / published / kind to
-- every result, and the document writers build the IEEE reference list from
-- those fields. But save_project() only persisted query/title/url/snippet, so
-- a brief re-downloaded later rebuilt its references from four columns and
-- came out thinner than the PDF generated at research time.
--
-- Run once against an existing project. New projects get these columns from
-- schema.sql already; the IF NOT EXISTS guards make this safe either way.
-- ============================================================================

alter table public.sources add column if not exists authors   text;
alter table public.sources add column if not exists venue     text;
alter table public.sources add column if not exists published text;
alter table public.sources add column if not exists kind      text;

-- Rows written before this migration keep NULLs. build_references() already
-- degrades field by field, so old briefs still produce valid entries — they
-- just stay title+URL only. Backfilling is not possible: the metadata was
-- never stored.

comment on column public.sources.authors   is 'Scholarly hits only; empty string for web results.';
comment on column public.sources.venue     is 'Journal or conference name, or the publishing domain for web results.';
comment on column public.sources.published is 'Free-form publication date; only the year is read, by _year_of().';
comment on column public.sources.kind      is '''web'' or ''scholarly'' — which tool returned the hit.';
