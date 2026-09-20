# Veritas AI — Research Brief Agent

Give it a topic. It searches the web and the peer-reviewed literature, decides for itself how
much digging the question deserves, and streams back a cited research brief — live, as it works.

Briefs come out with IEEE numbered citations at the claim, a full source list, and a
publication-formatted PDF and Word document.

---

## How it works

```
topic ──▶ classifier ──▶ agentic search loop ──▶ brief ──▶ PDF + .docx
          (research?)     web + scholarly         SSE stream
```

1. **Classifier gate.** A cheap model call decides whether the input is a research request or
   just conversation. Chat gets a reply and stops there — no search budget is spent on it.
2. **Agentic search loop.** The model chooses its own queries and calls two tools until it can
   answer: `web_search` (Tavily) for news, official and government sources, and
   `scholarly_search` (OpenAlex) for journal articles, conference papers and preprints. It
   decides how many searches the question is worth, up to a hard ceiling of five.
3. **Ranking happens in code, not in the model.** Results are filtered by relevance score, then
   reweighted by domain authority — government and academic domains up, wire services and major
   outlets next, social and SEO-blog domains down, a few near-zero-signal domains excluded
   outright. Source quality is a deterministic judgment, so it doesn't cost a model call.
4. **Live streaming.** Every step is pushed to the browser over Server-Sent Events, so you watch
   the searches happen instead of staring at a spinner.
5. **Documents.** For signed-in users the finished brief is saved and rendered to a formatted PDF
   and .docx — US Letter, 1" margins, numbered sections, IEEE reference list, page numbers, and a
   table of contents on longer briefs.

**Provider fallback is built in.** The agent walks a chain of models and falls through to the
next one on any failure, emitting a `provider_failed` event as it goes. A single provider having
a bad day degrades the run; it doesn't end it.

**Guests can use it.** No account needed to run a brief and read it. Signing in is what persists
it and unlocks the downloads — a guest run writes nothing to the database.

---

## Stack

| Layer       | Built with                                                              |
| ----------- | ----------------------------------------------------------------------- |
| Backend     | Python 3.10+, FastAPI, Uvicorn, Pydantic                                |
| AI          | Gemini (`google-genai`) primary, Groq fallback                          |
| Search      | Tavily (web) · OpenAlex (scholarly, no API key needed)                  |
| Documents   | fpdf2 (PDF, embedded Noto Serif) · python-docx (Word)                   |
| Frontend    | React 19, TypeScript, Vite, Tailwind v4, React Router v7                |
| Data / auth | Supabase — Postgres with row-level security, Storage, Google OAuth      |

---

## Running it locally

You'll need Python 3.10+, Node 18+, and a Supabase project.

### 1. Backend

```bash
cd backend
pip install -r requirements.txt
```

Create `backend/.env` (see `backend/.env.example`):

```ini
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_SERVICE_KEY=<service role key>
GEMINI_API_KEY=<key>            # ai.google.dev
TAVILY_API_KEY=<key>            # tavily.com
GROQ_API_KEY=<key>              # optional — the fallback provider
FRONTEND_ORIGIN=http://localhost:5173   # comma-separated for more than one
```

```bash
uvicorn main:app --reload --port 8000
```

API docs at `http://127.0.0.1:8000/docs`.

### 2. Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env` (see `frontend/.env.example`):

```ini
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key>
VITE_API_BASE_URL=http://127.0.0.1:8000
```

```bash
npm run dev          # http://localhost:5173
npm run build        # type-check + production build
npm run lint
```

Note the two different Supabase keys: the backend uses the **service role** key and must never
expose it; the browser only ever gets the **anon** key.

---

## API

| Method   | Route                                    | Auth     |
| -------- | ---------------------------------------- | -------- |
| `POST`   | `/api/research`                          | optional |
| `GET`    | `/api/projects`                          | required |
| `GET`    | `/api/projects/{id}`                     | required |
| `DELETE` | `/api/projects/{id}`                     | required |
| `GET`    | `/api/projects/{id}/download/{format}`   | required |
| `GET`    | `/api/sources`                           | required |
| `GET`    | `/api/me`                                | required |
| `POST`   | `/api/waitlist`                          | optional |
| `GET`    | `/api/health`                            | public   |

`POST /api/research` returns a `text/event-stream`. The event types are:

| Event             | Meaning                                                   |
| ----------------- | --------------------------------------------------------- |
| `chat_reply`      | Input wasn't research — here's a reply, stream ends        |
| `searching`       | A query just went out                                      |
| `found`           | Results came back, with their sources                      |
| `limit_reached`   | Search budget spent; writing the brief now                 |
| `provider_failed` | A model provider failed; falling through to the next       |
| `save_failed`     | The brief is fine, persisting it wasn't — stream continues |
| `done`            | Finished: brief, sources, project id                       |
| `error`           | Fatal                                                      |

---

## Layout

```
backend/
  main.py                    app init, CORS
  api/routes.py              all endpoints + SSE streaming
  core/                      config (pydantic-settings), auth, Supabase client
  agent/
    core.py                  run_research() — the provider loop (no FastAPI or Supabase imports,
                             so it can be driven from a CLI or worker just as well)
    classifier.py            research-vs-chat gate
    tools.py                 Tavily search + the authority ranking
    openalex.py              scholarly search
    toolset.py               tool schemas and dispatch
    prompts.py               the Veritas AI system prompt
  services/
    storage.py               Supabase persistence
    document_common.py       markdown → blocks, shared by both writers
    document_theme.py        shared design tokens
    pdf_writer.py            blocks → PDF
    docx_writer.py           blocks → .docx
    brief_review.py          deterministic quality checks (no model call)
  assets/fonts/              Noto Serif (OFL) + DejaVu Sans (Bitstream Vera), embedded in PDFs

frontend/src/
  pages/                     Home · Projects · ProjectDetail · Sources · Pricing
  components/                shell/ · research/ · landing/
  hooks/                     useAuth · useResearchThread
  lib/                       api.ts (SSE parsing) · supabase.ts · projects.ts
```

---

## Notes

- Free-tier API limits are the real constraint on how much this can run: Tavily gives 1,000
  credits a month and an advanced search costs 2, while the Gemini models have separate per-day
  request quotas — which is why the provider chain exists and why the search budget is capped.
- The PDF embeds Noto Serif (SIL Open Font License, vendored in `backend/assets/fonts/`), with
  DejaVu Sans (Bitstream Vera license) registered as a fallback for the few math glyphs Noto's
  Latin subset omits. Word documents reference Cambria by name, since a .docx links fonts rather
  than embedding them.

---

## License

[MIT](LICENSE) — © 2026 Hamza Tahir.

The fonts vendored in `backend/assets/fonts/` are third-party works under their own licenses,
which the MIT grant does not cover. Terms and full license texts are in
[`backend/assets/fonts/README.md`](backend/assets/fonts/README.md).
