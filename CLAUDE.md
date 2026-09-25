# Veritas AI — Research Brief Agent

Autonomous research platform. User submits a topic → backend runs an agentic search loop and
streams live progress + a structured markdown brief over SSE. Works for anonymous guests and
Supabase-authenticated users.

## Stack

| Layer       | Stack                                                                         |
| ----------- | ----------------------------------------------------------------------------- |
| Backend     | Python 3.10+, FastAPI, Uvicorn, Pydantic —`backend/`                       |
| AI / search | Gemini (`google-genai`, primary) → Groq (`openai` SDK, fallback); Tavily (web) + OpenAlex (scholarly) |
| Frontend    | React 19, TypeScript, Vite, Tailwind v4, React Router v7 —`frontend/`      |
| Data / auth | Supabase — Postgres + RLS, Storage, Google OAuth                             |

## Layout

```
backend/
  main.py               # app init, CORS
  api/routes.py         # /research /projects /sources /waitlist /me /health + doc download
  core/config.py        # pydantic-settings, reads backend/.env
  core/auth.py          # get_current_user (401), get_optional_user (guest→None), get_supabase
  agent/core.py         # run_research(): classifier gate → provider loop → SSE events
  agent/classifier.py   # cheap LLM gate: research vs. chat
  agent/tools.py        # Tavily web_search + deterministic source ranking
  agent/openalex.py     # scholarly_search — peer-reviewed literature via OpenAlex (no key)
  agent/toolset.py      # build_toolset(): schemas + name→callable dispatch for the provider loops
  agent/prompts.py      # SYSTEM_PROMPT — the "Veritas AI" persona + brief format
  services/storage.py   # Supabase persistence (projects, sources, waitlist, doc upload)
  services/document_common.py         # markdown → Block parser (shared)
  services/{docx,pdf}_writer.py        # Block → .docx / .pdf
  services/charts.py                   # table → bar chart PNG, only when the data is unambiguous
frontend/src/
  lib/         api.ts (streamResearch + API_BASE), supabase.ts
  hooks/       useAuth.ts, useResearchThread.ts
  pages/       Home, Projects, ProjectDetail, Sources, Pricing
  components/  shell/ (Layout, Sidebar, TopBar) · research/ (PromptBox, StreamingProgress, ResultView…) · landing/
```

## Setup

Secrets: `backend/.env` and `frontend/.env` (both gitignored; `backend/.env.example` documents keys).
Windows shell is PowerShell; a Bash tool is also available.

```bash
cd backend && pip install -r requirements.txt && uvicorn main:app --reload --port 8000
cd frontend && npm install && npm run dev      # localhost:5173
#   npx tsc -b        type check
#   npm run build     tsc -b && vite build
```

## Backend rules

- **`/research` uses `get_optional_user`** — must stay guest-reachable. Every other route
  (`/projects`, `/sources`, `/me`, downloads) uses `get_current_user`, except
  **`POST /documents/{format}`**: public on purpose (guests' PDF/Word), renders in memory, no reads/writes.
- **One document writer for everyone.** Guests and signed-in users get the same PDF/Word from
  `services/{pdf,docx}_writer.py`; the frontend never builds documents itself. Charts come only
  from `services/charts.py` (strict gate over the brief's own tables) — the model never draws.
- **Guests (`user is None`) get zero DB writes** — stream the full brief, persist nothing.
- **A failed save must not kill the stream** — emit `{"type":"save_failed","error":…}` and keep
  streaming. `save_failed` ≠ `error` (which is fatal).
- Always get the Supabase client from the **`get_supabase`** dependency, never ad hoc.
- **`agent/core.py` imports no FastAPI/Supabase** — keep it that way (CLI/worker-reusable).
- **SSE events** (`text/event-stream`): `chat_reply · searching · found · limit_reached · provider_failed · save_failed · done · error`.
  - Non-research input → `chat_reply` only, then the stream ends. No `done`, nothing saved.
  - Research → provider loop, ends with `done` = `{project_id, saved, topic, markdown, sources, provider}`.
- **Provider fallback is the design:** any exception → `provider_failed` → next provider, which
  continues from the research already gathered (`Gathered` in `agent/core.py`: one sources list
  and citation numbering for the whole run) instead of starting over. `_require_markdown()` converts an empty/blocked model
  response into a fallback trigger — `result.markdown` must never be `None`/`""`.
- Authed `done` → `save_project(...)`, then docx+pdf generated and uploaded to Storage. The
  writers rebuild the `## Sources` section from real results; the model is told to leave it empty.

## Frontend rules

- **Never put padding on `Layout.tsx`'s `<main>`** — it stays `flex-1 overflow-hidden`. That
  flush bottom edge is what lets the chat-view prompt box sit against the bottom
  (`pt-2 pb-0 sm:pb-1`). Each page owns its own scroll container and padding.
- **Scroll:** anchor a new turn to its *top* —
  `lastTurnRef.scrollIntoView({ behavior:'smooth', block:'start' })`. Never auto-scroll to the bottom.
- **Home.tsx:** logged-out → `HeroBanner`; logged-in → `WelcomeGreeting` (`font-serif text-2xl italic`). Once a turn exists it swaps to the turn list + bottom prompt bar.
- `useResearchThread` maps SSE events to `Turn` state; `streamResearch` (`lib/api.ts`) parses the
  `data:` frames.
- Auth = Supabase browser client (anon key); its JWT rides as `Authorization: Bearer` to the API.
- Theme tokens (`index.css`): `--color-brand #35b69e`, `--color-ink #1a2b28`.

## Known deferred

Backend has intentionally-unfixed items (doc MIME types, per-request Supabase client, sync-def
SSE concurrency, classifier flakiness, frontend `save_failed` handler). Don't re-flag them as
new bugs — details in project memory.
