"""
Lightweight intent classification, run before the full research loop.

A full agent run is expensive — multiple tool calls, real search quota.
Running it on "hey" or "hi" would waste that budget on a message that
needs no search at all. This is a single, ultra-fast, tool-free call that
either confirms the message is genuine research (proceed to run_research),
or returns a short conversational reply directly, skipping the loop.
"""

from google import genai
from google.genai import types as gtypes
from openai import OpenAI

from core.config import get_settings

CLASSIFY_PROMPT = """You are Veritas AI, an advanced research assistant created to assist users with research so they can save precious time.

IDENTITY RULES:
- Always identify yourself as "Veritas AI".
- Never mention Meta, Google, OpenAI, Groq, Gemini, Llama, or any underlying model, owner, or developer.
- If asked who created, developed, or made you, must respond with: "I am Veritas AI, developed to assist you with your research so you can save your precious time."

TASK:
Look at the user's message below and respond in exactly one of two ways:

1. If it is a genuine request to research, investigate, compare, or learn about a topic, respond with EXACTLY the single word: RESEARCH
2. If it is a greeting, small talk, identity question (e.g. "who made you", "hi", "how are you"), or vague statement — respond with a short, warm, ONE-SENTENCE conversational reply following the identity rules above. Never include the word RESEARCH in a conversational reply.

User message: {topic}"""


def _clean_response(text: str) -> str:
    """Helper to clean common LLM markdown artifacts (e.g. '**RESEARCH**' or '"RESEARCH"')"""
    if not text:
        return ""
    return text.strip().strip('"').strip("'").replace("*", "").strip()


def classify(topic: str) -> tuple[bool, str]:
    """
    Returns (is_research, reply_text).
    is_research = True  -> trigger full research agent
    is_research = False -> show reply_text directly in UI
    """
    settings = get_settings()
    prompt = CLASSIFY_PROMPT.format(topic=topic)
    text = ""

    # --- Step 1: Try Groq First (Ultra-fast & Lightweight) ---
    if settings.groq_api_key:
        try:
            groq_client = OpenAI(
                api_key=settings.groq_api_key,
                base_url="https://api.groq.com/openai/v1",
            )
            # gpt-oss reasons before answering; low effort + headroom keeps the
            # reasoning from eating the whole token budget and leaving no reply.
            response = groq_client.chat.completions.create(
                model="openai/gpt-oss-20b",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=400,
                reasoning_effort="low",
                timeout=10,
            )
            text = _clean_response(response.choices[0].message.content)
        except Exception:
            text = ""  # Reset and proceed to Gemini fallback

    # --- Step 2: Fallback to Gemini Flash-Lite — spares the research models' daily quota ---
    if not text and settings.gemini_api_key:
        try:
            gemini_client = genai.Client(
                api_key=settings.gemini_api_key,
                http_options=gtypes.HttpOptions(timeout=10000),
            )
            response = gemini_client.models.generate_content(
                model="gemini-3.5-flash-lite",
                contents=prompt,
            )
            text = _clean_response(response.text)
        except Exception:
            text = ""

    # --- Step 3: Safety Guardrail ---
    # If both classifiers fail, default to True so we never drop a real research request
    if not text:
        return True, ""

    if text.upper() == "RESEARCH":
        return True, ""

    return False, text