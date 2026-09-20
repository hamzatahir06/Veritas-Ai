# Database

The schema for the Supabase project behind Veritas AI.

## Standing up a new project

1. Create a Supabase project.
2. Open **SQL Editor**, paste all of [`schema.sql`](schema.sql), run it.
3. Enable **Google** under Authentication → Providers, and add your app URL to
   the redirect allow-list.
4. Copy the project URL, the `anon` key and the `service_role` key into
   `backend/.env` and `frontend/.env`.

That's everything the backend expects: three tables, their RLS policies, and a
private `documents` storage bucket.

## Applying a migration to an existing project

Run the files in [`migrations/`](migrations) in numeric order, once each, in the
SQL editor. They're guarded with `IF NOT EXISTS`, so a re-run is harmless.

| Migration | What it does |
| --------- | ------------ |
| `0001_sources_reference_metadata.sql` | Adds `authors`, `venue`, `published`, `kind` to `sources` so re-downloaded briefs keep their full IEEE references |

## Shape

```
auth.users
    │
    ├──< projects            one completed research run
    │        │               topic · markdown · docx_path · pdf_path
    │        │
    │        └──< sources     every search result behind that brief
    │                         url · snippet · authors · venue · published · kind
    │
    └──< waitlist            Pro signups (user_id null for signed-out joiners)

storage: documents/{user_id}/{project_id}.{docx,pdf}   — private, signed URLs only
```

Guest runs write **nothing** here: a brief streams in full and is discarded
unless the user is signed in.

## Notes

- **The backend uses the `service_role` key, which bypasses RLS.** The policies
  are there so that browser-side queries with the `anon` key are safe by
  default — today the frontend only uses Supabase for auth, never for data.
- **The `documents` bucket must stay private.** Downloads go through
  `get_document_url()`, which signs a URL valid for 5 minutes.
- `schema.sql` was **reconstructed from the application code**, not exported
  from the live database. Diff it against your dashboard once and fix anything
  that drifted.
- Deleting a project cascades to its `sources` rows. Its storage objects are
  removed separately, best-effort, in `delete_project()`.
