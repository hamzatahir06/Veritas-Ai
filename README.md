# 🔍 Veritas AI

**An autonomous research agent that searches, verifies, and writes — so you don't have to.**

Give it a topic. It decides how many times to search, ranks sources by authority, and delivers a fully cited research brief — live, in real time, as it thinks.

[![Live Demo](https://img.shields.io/badge/demo-live-6EC6B8?style=for-the-badge)](https://veritas-ai-smoky.vercel.app)
[![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

---

## 🧠 What it actually does

Most "AI research tools" are a single prompt wrapped around a single search call. Veritas AI isn't — it's a genuine **agent**: it decides on its own how many searches a topic needs, when it has enough to write confidently, and where to look first.

- Ask it something trivial ("who is the CEO of Tesla") → it runs **one** targeted search and stops.
- Ask it something broad ("recent breakthroughs in solid-state batteries") → it runs **multiple angled searches**, avoids redundant ones, and only stops once coverage is genuinely solid.
- Say "hey" instead of asking a real question → it recognizes that and just replies, without spending a single search.

That decision-making — not the API call — is the actual engineering problem this project solves.

## ✨ Features

| | |
|---|---|
| 🔎 **Autonomous multi-search loop** | The agent plans its own queries and judges when it has enough — calibrated so trivial questions get one search and broad topics get several, never the reverse |
| 🎓 **Web + scholarly search** | Two tools the agent picks between per query: Tavily for the live web, OpenAlex for peer-reviewed literature — so a science question gets papers, not just blog posts |
| 🛡️ **Dual-provider resilience** | Gemini 3.5 Flash primary, Groq (`gpt-oss-120b`) fallback — a rate limit, an outage, or a deprecated model on one provider falls through to the other automatically, mid-run |
| 🏛️ **Source authority ranking** | Results are weighted by domain trust (official / government / academic > major outlets > social / forums) *and* relevance score — done deterministically in code, not left to chance |
| 📡 **Live streaming, not a spinner** | Every search the agent runs streams to the screen in real time over SSE — you watch it think, not wait on a black box |
| 📄 **Real, cited output** | Every finished brief exports as a properly formatted **.docx** and **.pdf** — real headings, tables, bold text, and a hyperlinked source list built from actual search results, never invented |
| 💬 **Persistent, chat-style threads** | Signed-in research is saved as a Project, not lost on refresh — browse past research from the sidebar anytime |
| 🔐 **Zero-friction auth** | One-click Google sign-in via Supabase — no passwords, no OTP, no inbox-checking |

## 🏗️ Architecture

```
┌─────────────┐      SSE stream       ┌──────────────┐      web_search      ┌──────────┐
│   React     │  ──────────────────▶  │   FastAPI    │  ──────────────────▶ │  Tavily  │
│  (Vercel)   │  ◀────────────────── │   (Render)    │  ◀────────────────── │ (ranked) │
└─────────────┘    live progress      └───────┬──────┘    scored results    └──────────┘
                                               │  scholarly_search         ┌──────────┐
                                               ├─────────────────────────▶ │ OpenAlex │
                                               │ ◀──────────────────────── │ (papers) │
                                               │   peer-reviewed works      └──────────┘
                                               │
                                   decide → search → decide
                                               │
                                   ┌───────────┴───────────┐
                                   │   Gemini 3.5 Flash      │  primary
                                   │   Groq gpt-oss-120b     │  fallback
                                   └────────────┬────────────┘
                                                │
                                   ┌────────────┴────────────┐
                                   │        Supabase          │
                                   │ Postgres · Auth · Storage │
                                   └───────────────────────────┘
```

The agent's core loop (`agent/core.py`) never imports FastAPI — it's plain Python generators, so it's equally callable from the API, a CLI script, or a future background job with zero rewrite.

## 🧰 Tech Stack

**Backend** — Python · FastAPI · Server-Sent Events · `google-genai` · `openai` (Groq-compatible) · `tavily-python` · OpenAlex API · `python-docx` · `fpdf2`

**Frontend** — React · Vite · TypeScript · Tailwind CSS v4 · React Router · `react-markdown`

**Infrastructure** — Supabase (Postgres, Google OAuth, Storage) · Render (backend) · Vercel (frontend)

## 🚀 Getting started

### 1. Clone
```bash
git clone https://github.com/hamzatahir06/Veritas-Ai.git
cd veritas-ai
```

### 2. Database (Supabase)
Create a free project at [supabase.com](https://supabase.com), enable the Google provider under **Authentication**, then run this in the SQL editor:

```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  topic text not null,
  title text not null,
  status text not null default 'pending' check (status in ('pending','running','completed','failed')),
  markdown text,
  docx_path text,
  pdf_path text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  query text not null,
  title text,
  url text not null,
  snippet text,
  created_at timestamptz not null default now()
);

create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);

create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.sources enable row level security;
alter table public.waitlist enable row level security;

create policy "own profile" on public.profiles for select using (auth.uid() = id);
create policy "own projects select" on public.projects for select using (auth.uid() = user_id);
create policy "own projects insert" on public.projects for insert with check (auth.uid() = user_id);
create policy "own sources" on public.sources for select using (
  exists (select 1 from public.projects p where p.id = sources.project_id and p.user_id = auth.uid())
);
create policy "anyone can join the waitlist" on public.waitlist for insert with check (true);
```

Also create a **private** Storage bucket named `documents`.

### 3. Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows — use source venv/bin/activate on macOS/Linux
pip install -r requirements.txt
```
Create `backend/.env`:
```
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
GEMINI_API_KEY=
TAVILY_API_KEY=
GROQ_API_KEY=
FRONTEND_ORIGIN=http://localhost:5173
```
```bash
uvicorn main:app --reload --port 8000
```

### 4. Frontend
```bash
cd frontend
npm install
```
Create `frontend/.env`:
```
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```
```bash
npm run dev
```

## 📁 Project structure

```
veritas-ai/
├── backend/
│   ├── agent/        # the research loop itself — model-agnostic, framework-agnostic
│   │   ├── core.py       # decide → search → decide, with provider fallback
│   │   ├── classifier.py # cheap intent check: real research vs. small talk
│   │   ├── tools.py      # Tavily search + authority/relevance ranking
│   │   ├── openalex.py   # scholarly search over peer-reviewed literature (no key)
│   │   ├── toolset.py    # tool schemas + dispatch for the provider loops
│   │   └── prompts.py
│   ├── api/           # FastAPI routes (SSE research endpoint, projects, sources)
│   ├── core/           # config + Supabase auth verification
│   └── services/       # docx/pdf generation, Supabase persistence
└── frontend/
    └── src/
        ├── components/  # landing, research, shell, ui
        ├── hooks/        # useAuth, useResearchThread
        ├── lib/          # api client (SSE reader), Supabase client
        └── pages/        # Home, Projects, ProjectDetail, Sources
```

## 🗺️ Roadmap

- [ ] Elite Plan — priced tier beyond the current waitlist
- [ ] Settings page (intentionally out of scope for v1)
- [ ] Configurable search depth per request

## 👤 Author

**Hamza Tahir** — Software Engineering student building agentic AI systems.

## 📄 License

MIT — see [LICENSE](LICENSE).
