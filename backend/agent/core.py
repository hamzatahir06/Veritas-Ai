"""
The Research Brief Agent's core loop: decide -> search -> decide -> ... -> write.

This module never imports FastAPI — plain Python so it can be driven by the
API, a CLI, or a background job without a rewrite.

Provider strategy: free-tier model availability changes often — each Gemini
model has its own small daily quota, and newer models are sometimes
overloaded. Rather than hard-wiring one model, run_research tries an ordered
list of independent, self-contained provider loops (best Gemini models first,
Groq last) and falls through to the next on any failure — a used-up quota, a
missing key, a deprecated model, a network blip. Reordering is a one-line
change to GEMINI_MODELS. A fallback doesn't start over: it is handed the
research already gathered (see Gathered) and continues from there.
"""

import json
import re
from dataclasses import dataclass, field
from functools import partial

from google import genai
from google.genai import types as gtypes
from openai import OpenAI
from tavily import TavilyClient

from agent.classifier import classify
from agent.prompts import build_system_prompt
from agent.toolset import Toolset, build_toolset
from core.config import GROQ_BASE_URL, get_settings

# Newest first. Each model has a separate free-tier quota, so falling through
# the list also multiplies the daily research capacity.
GEMINI_MODELS = ("gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash")
GEMINI_MAX_ITERATIONS = 5
GEMINI_TIMEOUT_MS = 90_000  # a long evidence-heavy synthesis can take well over 30s

GROQ_MODEL = "openai/gpt-oss-120b"
GROQ_MAX_ITERATIONS = 3  # Groq's free tier has a much smaller token budget
GROQ_RESULT_CHARS = 3000  # per tool result — results are ranked best-first, so trimming drops the weakest
GROQ_CARRYOVER_CHARS = 12_000  # research carried over from a failed attempt, across all its searches

STOP_SEARCHING = "Stop searching now and write the final research brief in markdown using only the information already gathered."


# 【7】, and gpt-oss's line-anchored form 【7†L12-L20】.
_LENTICULAR_CITE = re.compile(r"【\s*(\d+)[^】]*】")

_H1 = re.compile(r"^# +(.+)$", re.MULTILINE)


def _require_markdown(get_text, provider: str) -> str:
    """
    Coerce a model response's text into a non-empty markdown string.

    A blocked / truncated / empty completion leaves the SDK's text accessor
    returning None (or raising, for google-genai when parts aren't text). We
    must never let that reach ResearchResult: `markdown=None` crashes the
    document writers (`None.strip()`) and persists a broken project row.
    Raising here instead routes the run into run_research()'s provider
    fallback, exactly as a rate limit or network error would.
    """
    try:
        markdown = (get_text() or "").strip()
    except Exception:
        markdown = ""
    if not markdown:
        raise RuntimeError(f"{provider} returned an empty response")
    # Some models (Groq's especially) cite as 【7】 despite the prompt; normalise
    # to IEEE [7] so the UI links them and the document writers render them.
    return _LENTICULAR_CITE.sub(r"[\1]", markdown)


def _tool_args(raw: dict | str | None, topic: str) -> dict:
    """
    A tool call's arguments, with the research topic as a fallback query.

    Groq hands them over as a JSON string that is occasionally malformed; that
    degrades to "search the topic" instead of failing the whole provider.
    """
    if isinstance(raw, str):
        try:
            raw = json.loads(raw or "{}")
        except json.JSONDecodeError:
            raw = None
    args = dict(raw) if isinstance(raw, dict) else {}
    if not isinstance(args.get("query"), str) or not args["query"].strip():
        args["query"] = topic
    return args


@dataclass
class ResearchResult:
    topic: str
    markdown: str
    sources: list[dict] = field(default_factory=list)
    provider: str = ""

    def __post_init__(self):
        # Different queries often surface the same page — keep its first hit only.
        unique: dict[str, dict] = {}
        for s in self.sources:
            unique.setdefault(s.get("url") or s.get("title", ""), s)
        self.sources = list(unique.values())

    @property
    def title(self) -> str:
        """
        The brief's own '# Title' line, falling back to the raw topic.

        The model writes a clean, professional title (spelling fixed, question
        rephrased), which is what documents and the project list should show
        rather than the user's prompt as typed. Only a lone level-1 heading
        counts — a model that writes every section as '#' has no title line —
        matching services/document_common.normalise_headings().
        """
        h1s = _H1.findall(self.markdown)
        if len(h1s) == 1 and self.markdown.lstrip().startswith("# "):
            return h1s[0].strip() or self.topic
        return self.topic


def run_research(topic: str):
    """
    Tries each provider loop in order, falling back on any failure. Yields
    the same event shapes no matter which provider ends up serving it:
      {"type": "chat_reply", "message": str}   # non-research message; stream ends here
      {"type": "searching", "query": str}
      {"type": "found", "query": str, "count": int, "sources": [{"title", "url"}]}
      {"type": "limit_reached"}
      {"type": "provider_failed", "provider": str, "error": str}
      {"type": "done", "result": ResearchResult}
      {"type": "error", "message": str}
    """
    topic = (topic or "").strip()
    if not topic:
        yield {"type": "error", "message": "Topic cannot be empty."}
        return

    is_research, reply = classify(topic)
    if not is_research:
        # Conversational reply only — no research run, nothing persisted. The
        # stream simply ends here; `chat_reply` is already a terminal state for
        # the UI (it clears the loading spinner without needing a `done`).
        yield {"type": "chat_reply", "message": reply}
        return

    # One toolset and one record of what's been found for the whole run: a
    # fallback provider continues from the research already gathered instead
    # of starting over, and citation numbers stay the same across attempts.
    toolset = build_toolset(TavilyClient(api_key=get_settings().tavily_api_key), topic)
    gathered = Gathered()
    providers = [(model, partial(_run_with_gemini, model=model)) for model in GEMINI_MODELS]
    providers.append(("groq", _run_with_groq))

    last_error = None
    for name, provider_fn in providers:
        try:
            yield from provider_fn(topic, toolset, gathered)
            return
        except Exception as e:
            yield {"type": "provider_failed", "provider": name, "error": str(e)}
            last_error = e

    yield {"type": "error", "message": f"All providers failed. Last error: {last_error}"}


CONTINUE_NOTE = (
    "An earlier attempt already ran the searches below. Their sources keep the [n] numbers "
    "shown, so cite them by those numbers. Search again only for what they don't cover; if "
    "they are enough, write the brief now."
)


@dataclass
class Gathered:
    """
    Everything the run has found so far, shared by every provider attempt.

    `sources` is the run's one reference list, in citation-number order.
    `results` is each search's (query, result text) — what a fallback provider
    is shown so it picks up where the failed one stopped.
    """
    sources: list[dict] = field(default_factory=list)
    results: list[tuple[str, str]] = field(default_factory=list)

    def opening(self, topic: str, max_chars: int | None = None) -> str:
        """The first user message: the topic, plus any research already gathered.

        `max_chars` caps the carried-over text for a provider with a small
        context budget. Each result is ranked best-first, so trimming its tail
        drops the weakest sources.
        """
        if not self.results:
            return f"Research topic: {topic}"
        per_result = max_chars // len(self.results) if max_chars else None
        blocks = "\n\n".join(f'Results for "{query}":\n{text[:per_result]}' for query, text in self.results)
        return f"Research topic: {topic}\n\n{CONTINUE_NOTE}\n\n{blocks}"


def _run_tool_calls(toolset: Toolset, calls: list[tuple[str, dict]], gathered: Gathered):
    """
    Announce, run (in parallel), and report one turn's tool calls; returns
    their text results in call order, which is what the model expects.

    Each `found` is sent the moment its own search finishes, carrying the
    query it answers so the UI can show it under that search. It holds a
    count and the titles and URLs behind it; the count is derived from the
    list actually sent, so the two can never disagree. Rows without a URL are
    dropped: nothing can link to them.
    """
    for _, args in calls:
        yield {"type": "searching", "query": args["query"]}

    texts = [""] * len(calls)
    for i, (text, rows) in toolset.run_many(calls, gathered.sources):
        texts[i] = text
        gathered.results.append((calls[i][1]["query"], text))
        found = [
            {"title": row.get("title", ""), "url": row["url"]}
            for row in rows if (row.get("url") or "").strip()
        ]
        yield {
            "type": "found",
            "query": calls[i][1]["query"],
            "count": len(found),
            "sources": found,
        }

    return texts


def _run_with_gemini(topic: str, toolset: Toolset, gathered: Gathered, model: str):
    client = genai.Client(
        api_key=get_settings().gemini_api_key,
        http_options=gtypes.HttpOptions(timeout=GEMINI_TIMEOUT_MS),
    )
    system_prompt = build_system_prompt()

    tool = gtypes.Tool(function_declarations=[
        gtypes.FunctionDeclaration(
            name=s["function"]["name"],
            description=s["function"]["description"],
            parameters_json_schema=s["function"]["parameters"],
        )
        for s in toolset.schemas
    ])
    config = gtypes.GenerateContentConfig(
        tools=[tool],
        system_instruction=system_prompt,
        automatic_function_calling=gtypes.AutomaticFunctionCallingConfig(disable=True),
    )
    contents = [gtypes.Content(role="user", parts=[gtypes.Part(text=gathered.opening(topic))])]

    for _ in range(GEMINI_MAX_ITERATIONS):
        response = client.models.generate_content(model=model, contents=contents, config=config)

        calls = response.function_calls
        if not calls:
            markdown = _require_markdown(lambda: response.text, model)
            yield {"type": "done", "result": ResearchResult(topic, markdown, gathered.sources, model)}
            return

        if not response.candidates:
            raise RuntimeError(f"{model} returned no candidates")
        contents.append(response.candidates[0].content)

        turn = [(call.name, _tool_args(call.args, topic)) for call in calls]
        results = yield from _run_tool_calls(toolset, turn, gathered)
        contents.append(gtypes.Content(role="user", parts=[
            gtypes.Part.from_function_response(name=name, response={"result": text})
            for (name, _), text in zip(turn, results)
        ]))

    yield {"type": "limit_reached"}

    # Pass the final stop instruction as a system override to maintain strict role alternation
    final = client.models.generate_content(
        model=model, contents=contents,
        config=gtypes.GenerateContentConfig(system_instruction=f"{system_prompt}\n\nCRITICAL INSTRUCTION: {STOP_SEARCHING}"),
    )
    markdown = _require_markdown(lambda: final.text, model)
    yield {"type": "done", "result": ResearchResult(topic, markdown, gathered.sources, model)}


def _run_with_groq(topic: str, toolset: Toolset, gathered: Gathered):
    settings = get_settings()
    if not settings.groq_api_key:
        raise RuntimeError("GROQ_API_KEY is not set")

    client = OpenAI(api_key=settings.groq_api_key, base_url=GROQ_BASE_URL)
    messages = [
        {"role": "system", "content": build_system_prompt()},
        {"role": "user", "content": gathered.opening(topic, max_chars=GROQ_CARRYOVER_CHARS)},
    ]

    for _ in range(GROQ_MAX_ITERATIONS):
        response = client.chat.completions.create(
            model=GROQ_MODEL, messages=messages, tools=toolset.schemas, timeout=30,
        )
        choice = response.choices[0].message

        if not choice.tool_calls:
            markdown = _require_markdown(lambda: choice.content, "Groq")
            yield {"type": "done", "result": ResearchResult(topic, markdown, gathered.sources, "groq")}
            return

        messages.append({
            "role": "assistant",
            "content": choice.content,
            "tool_calls": [tc.model_dump() for tc in choice.tool_calls],
        })

        turn = [(tc.function.name, _tool_args(tc.function.arguments, topic)) for tc in choice.tool_calls]
        results = yield from _run_tool_calls(toolset, turn, gathered)
        messages.extend(
            {"role": "tool", "tool_call_id": tc.id, "content": text[:GROQ_RESULT_CHARS]}
            for tc, text in zip(choice.tool_calls, results)
        )

    yield {"type": "limit_reached"}
    messages.append({"role": "user", "content": STOP_SEARCHING})
    final = client.chat.completions.create(model=GROQ_MODEL, messages=messages, timeout=30)
    markdown = _require_markdown(lambda: final.choices[0].message.content, "Groq")
    yield {"type": "done", "result": ResearchResult(topic, markdown, gathered.sources, "groq")}
