"""
Assembles the agent's search tools into one dispatch table.

A provider loop (Gemini, Groq, …) shouldn't need to know which tools exist or
how each is called — it asks the toolset for the schemas to advertise and then
hands every tool call back here by name. Adding a connector is a one-line
change in build_toolset(); nothing in agent/core.py changes.

One Toolset lives for a whole research run and caches results, so when a
provider fails mid-run the fallback provider reuses searches already paid for
instead of spending search credits again.
"""

import inspect
import json
import threading
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from typing import Callable

from tavily import TavilyClient

from agent.tools import make_web_search, WEB_SEARCH_SCHEMA, REF_PLACEHOLDER
from agent.openalex import make_scholarly_search, SCHOLARLY_SEARCH_SCHEMA

MAX_PARALLEL_SEARCHES = 5


@dataclass
class Toolset:
    schemas: list[dict]                       # OpenAI-style JSON schemas — the single source for every provider
    _dispatch: dict[str, Callable]            # name -> tool returning (text, source_rows)
    _cache: dict[tuple, tuple] = field(default_factory=dict)
    _refs: dict[str, int] = field(default_factory=dict)   # url -> citation number
    _lock: threading.Lock = field(default_factory=threading.Lock)

    def _number_sources(self, text: str, rows: list[dict], sources: list[dict]) -> str:
        """
        Swap each result's placeholder for the citation number the reference
        list will give that source.

        A number is assigned the first time a URL is seen and reused after
        that, so a page returned by two different searches is cited once —
        exactly how build_references() dedups when it renders the references.
        Rows are walked in order because each one owns the next placeholder in
        the text, and a row is appended to `sources` at the moment its number
        is assigned, which is what keeps the two numberings identical.

        Held under a lock: run_many() fans searches out across threads, and
        assigning a number is a read-modify-write that would otherwise let two
        results claim the same one.
        """
        parts: list[str] = []
        cursor = 0
        with self._lock:
            for row in rows:
                marker = text.find(REF_PLACEHOLDER, cursor)
                if marker == -1:
                    break
                url = (row.get("url") or "").strip()
                if url:
                    index = self._refs.get(url)
                    if index is None:
                        index = len(self._refs) + 1
                        self._refs[url] = index
                        sources.append(row)
                    replacement = f"[{index}]"
                else:
                    # No URL means no reference entry. Say so rather than
                    # leaving a bare "Source" header, which invites the model
                    # to invent a number for it.
                    replacement = "(no citation available — do not cite)"
                parts.append(text[cursor:marker] + replacement)
                cursor = marker + len(REF_PLACEHOLDER)
        parts.append(text[cursor:])
        return "".join(parts)

    def reset_citations(self) -> None:
        """Start numbering at [1] again; the search cache is kept."""
        with self._lock:
            self._refs.clear()

    def run(self, name: str, args: dict, sources: list[dict]) -> tuple[str, list[dict]]:
        # An unrecognized tool name falls back to web search rather than
        # erroring the run — the model occasionally invents a name.
        name = name if name in self._dispatch else "web_search"
        fn = self._dispatch[name]
        # Drop arguments the tool doesn't accept (invented or belonging to the
        # other tool) and explicit nulls, so a sloppy call still runs.
        accepted = inspect.signature(fn).parameters
        kwargs = {k: v for k, v in args.items() if k in accepted and v is not None}

        key = (name, json.dumps(kwargs, sort_keys=True, default=str))
        text, rows = self._cache.get(key) or fn(**kwargs)
        if rows:  # never cache a failure or an empty result — a retry may do better
            self._cache[key] = (text, rows)
        # The cached text keeps its placeholders: a repeat of the same search
        # must be renumbered against whatever has been found since.
        #
        # `rows` is every result this call returned, including pages an earlier
        # search already found. `sources` only ever gains new ones, so the two
        # differ on purpose: the caller reports what this search found, while
        # the reference list stays deduplicated.
        return self._number_sources(text, rows, sources), rows

    def run_many(
        self, calls: list[tuple[str, dict]], sources: list[dict],
    ) -> list[tuple[str, list[dict]]]:
        """
        Run a turn's tool calls concurrently; results keep the calls' order.

        Each entry is that call's (text, rows). Attribution has to come from
        here because the calls share one `sources` list across threads, so
        comparing its length before and after a call cannot say which search
        contributed what.
        """
        if len(calls) == 1:
            return [self.run(*calls[0], sources)]
        with ThreadPoolExecutor(max_workers=min(len(calls), MAX_PARALLEL_SEARCHES)) as pool:
            return list(pool.map(lambda call: self.run(*call, sources), calls))


def build_toolset(tavily_client: TavilyClient, topic: str) -> Toolset:
    web_search = make_web_search(tavily_client, topic)
    scholarly_search = make_scholarly_search(topic)
    return Toolset(
        schemas=[WEB_SEARCH_SCHEMA, SCHOLARLY_SEARCH_SCHEMA],
        _dispatch={"web_search": web_search, "scholarly_search": scholarly_search},
    )
