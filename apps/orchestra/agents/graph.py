"""LangGraph implementation of the swarm cycle with work-mode awareness.

Modes:
- brainstorm: open, collective perspectives; light verification
- assist: help the Director think/structure; moderate verification
- construct: full Ground → Challenge → Construct → Verify with PoV possible
"""

import json
import os
import re
from typing import Literal, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import END, StateGraph

from .prompts import ASTRA_PROMPT, KAELEN_PROMPT, SYNTHETIX_PROMPT, VERITAS_PROMPT
from .tools import search_web

WorkMode = Literal["brainstorm", "assist", "construct"]

_VERDICT_BLOCK_RE = re.compile(r"\{[^{}]*\}(?!.*\{[^{}]*\})", re.DOTALL)
_URL_RE = re.compile(r"https?://[^\s\)\]\>\"']+")
_MD_LINK_RE = re.compile(r"\[([^\]]+)\]\((https?://[^\)]+)\)")


class SwarmState(TypedDict):
    director_prompt: str
    prior_context: str
    mode: WorkMode
    ground_output: str
    critique_output: str
    build_output: str
    verification_output: str
    allowed_urls: list[str]


def _model(temperature: float = 0.3) -> ChatOpenAI:
    return ChatOpenAI(
        model=os.environ.get("ORCHESTRA_MODEL", "gpt-4o-mini"),
        temperature=temperature,
    )


def _format_search_results(results: list[dict]) -> str:
    if not results:
        return "No external search results are available for this request."
    return "\n".join(
        f"- {r['title']} ({r['url']}): {r['content'][:400]}" for r in results
    )


def _url_allowed(url: str, allowed_urls: list[str]) -> bool:
    cleaned = url.rstrip(").,;\"'")
    return any(cleaned.startswith(allowed) or allowed.startswith(cleaned) for allowed in allowed_urls)


def _strip_unverified_citations(text: str, allowed_urls: list[str]) -> str:
    """Remove raw URLs and markdown links that are not on the allowed list."""

    def _md_replace(match: re.Match) -> str:
        label, url = match.group(1), match.group(2)
        if _url_allowed(url, allowed_urls):
            return match.group(0)
        return label  # keep readable label, drop invented URL

    def _raw_replace(match: re.Match) -> str:
        url = match.group(0)
        if _url_allowed(url, allowed_urls):
            return url
        return "[unverifiable citation removed]"

    text = _MD_LINK_RE.sub(_md_replace, text)
    text = _URL_RE.sub(_raw_replace, text)
    return text


def _search_query(director_prompt: str, prior_context: str) -> str:
    prompt = (director_prompt or "").strip()
    prior = (prior_context or "").strip()

    if len(prompt) >= 80:
        return prompt[:400]

    pieces = [prompt] if prompt else []
    if prior:
        for marker in ("---attachment---", "ATTACHMENT:", "NOTE:", "Director-supplied context:"):
            if marker in prior:
                idx = prior.find(marker)
                pieces.append(prior[idx : idx + 600])
                break
        else:
            pieces.append(prior[:400])

    query = " ".join(p for p in pieces if p).strip()
    return (query or prompt or "collaborative research")[:500]


def _mode_instruction(mode: WorkMode) -> str:
    if mode == "brainstorm":
        return (
            "WORK MODE: Brainstorm.\n"
            "Priority is open, collective perspective-taking. Offer multiple angles, "
            "possibilities, and gentle provocations. Do not force a single correct answer. "
            "Avoid heavy scoring pressure. Intellectual honesty still matters; do not invent sources."
        )
    if mode == "assist":
        return (
            "WORK MODE: Assist / Think with me.\n"
            "Help the Director clarify, structure, or pressure-test an idea they already have. "
            "Be supportive and concrete. Surface assumptions and useful next questions. "
            "Moderate grounding is enough; do not over-index on external search."
        )
    return (
        "WORK MODE: Construct & Verify.\n"
        "Produce a clear, structured artifact that can stand as advanced work. "
        "Full rigor applies. Ground carefully, pressure-test, construct cleanly, and submit "
        "to verification. PoV is possible when the work is honest and advances understanding."
    )


def _citation_discipline(allowed_urls: list[str], has_director_materials: bool) -> str:
    lines = [
        "CITATION DISCIPLINE (mandatory):",
        "- Never invent URLs, paper titles, DOIs, or dataset links.",
        "- If you cite an external web URL, it MUST appear verbatim in the Allowed URLs list below.",
        "- Prefer grounding in Director-supplied materials when they exist.",
        "- You may name institutions (e.g. NOAA, a city heat plan) without a URL if you do not invent a link.",
        "- Do not add a References section filled with web links unless every link is on the Allowed URLs list.",
        "- If Allowed URLs is empty, say external search was limited and rely on Director materials + clear assumptions.",
        f"Allowed URLs:\n{chr(10).join(allowed_urls) or 'None available.'}",
    ]
    if has_director_materials:
        lines.insert(
            1,
            "- Director attachment/notes are the primary evidence for this cycle; treat them as supplied facts/constraints.",
        )
    return "\n".join(lines)


def _ground(state: SwarmState) -> SwarmState:
    mode = state.get("mode") or "construct"
    prior = state.get("prior_context") or ""
    should_search = mode == "construct" or mode == "assist"
    query = _search_query(state["director_prompt"], prior)
    search_results = search_web(query) if should_search else []
    allowed_urls = [r["url"] for r in search_results if r.get("url")]
    prior_block = (
        f"\n\nPrior context / Director-supplied materials (legitimate evidence for this cycle):\n{prior}"
        if prior
        else ""
    )

    response = _model(temperature=0.5 if mode == "brainstorm" else 0.3).invoke(
        [
            SystemMessage(content=ASTRA_PROMPT),
            HumanMessage(
                content=(
                    f"{_mode_instruction(mode)}\n\n"
                    f"Director prompt:\n{state['director_prompt']}{prior_block}\n\n"
                    f"{_citation_discipline(allowed_urls, bool(prior.strip()))}\n\n"
                    "Live search results:\n"
                    f"{_format_search_results(search_results)}"
                )
            ),
        ]
    )
    ground_output = _strip_unverified_citations(response.content, allowed_urls)
    return {**state, "ground_output": ground_output, "allowed_urls": allowed_urls}


def _pressure_test(state: SwarmState) -> SwarmState:
    mode = state.get("mode") or "construct"
    response = _model(temperature=0.5 if mode == "brainstorm" else 0.3).invoke(
        [
            SystemMessage(content=KAELEN_PROMPT),
            HumanMessage(
                content=(
                    f"{_mode_instruction(mode)}\n\n"
                    f"Director prompt:\n{state['director_prompt']}\n\n"
                    f"@Astra's contribution:\n{state['ground_output']}"
                )
            ),
        ]
    )
    return {**state, "critique_output": response.content}


def _construct(state: SwarmState) -> SwarmState:
    mode = state.get("mode") or "construct"
    allowed_urls = state.get("allowed_urls", [])
    prior = state.get("prior_context") or ""
    prior_note = (
        f"Director-supplied materials (attachments, notes, prior context) are legitimate inputs:\n{prior[:2000]}\n\n"
        if prior
        else ""
    )

    response = _model(temperature=0.5 if mode == "brainstorm" else 0.3).invoke(
        [
            SystemMessage(content=SYNTHETIX_PROMPT),
            HumanMessage(
                content=(
                    f"{_mode_instruction(mode)}\n\n"
                    f"Director prompt:\n{state['director_prompt']}\n\n"
                    f"{prior_note}"
                    f"@Astra:\n{state['ground_output']}\n\n"
                    f"@Kaelen:\n{state['critique_output']}\n\n"
                    f"{_citation_discipline(allowed_urls, bool(prior.strip()))}"
                )
            ),
        ]
    )
    build_output = _strip_unverified_citations(response.content, allowed_urls)
    return {**state, "build_output": build_output}


def _verify(state: SwarmState) -> SwarmState:
    mode = state.get("mode") or "construct"
    allowed_urls = state.get("allowed_urls", [])
    prior = state.get("prior_context") or ""

    if mode == "brainstorm":
        guidance = (
            "MODE = Brainstorm. Focus on useful, honest perspectives. Do not demand external citations. "
            "Director-supplied materials are enough grounding. Invented URLs are still a failure. "
            "Scores 60–85 for good collaborative thinking are appropriate. pov_eligible is usually false "
            "unless the brainstorm produced a clearly advanced, citable structure."
        )
    elif mode == "assist":
        guidance = (
            "MODE = Assist. Evaluate clarity, usefulness, and intellectual honesty. "
            "Grounding in Director materials is sufficient. Invented URLs remain a failure. "
            "pov_eligible can be true for genuinely helpful structured assistance that respects constraints."
        )
    else:
        guidance = (
            "MODE = Construct & Verify. Reward clear structure, explicit limitations, and honest use of "
            "Director materials and/or Allowed URLs. Invented specific papers/URLs/DOIs block pov_eligible. "
            "If the artifact is well structured, uses the Director brief, flags assumptions, and does not invent "
            "URLs, it can score 80+ and be pov_eligible even when Allowed URLs is empty. "
            "Do not reject solely for naming institutions without a Tavily URL."
        )

    director_materials = (
        f"Director-supplied materials were provided for this cycle (length {len(prior)} chars). "
        "Treat that as legitimate evidence.\n"
        if prior.strip()
        else "No Director attachment/prior materials were provided for this cycle.\n"
    )

    source_note = (
        f"{director_materials}"
        f"Allowed external URLs for this cycle (live search only):\n"
        f"{chr(10).join(allowed_urls) or 'None'}\n\n"
        f"{guidance}"
    )

    response = _model().invoke(
        [
            SystemMessage(content=VERITAS_PROMPT),
            HumanMessage(
                content=f"Artifact / contribution to evaluate:\n{state['build_output']}\n\n{source_note}"
            ),
        ]
    )
    return {**state, "verification_output": response.content}


def build_swarm_graph():
    graph = StateGraph(SwarmState)
    graph.add_node("ground", _ground)
    graph.add_node("pressure_test", _pressure_test)
    graph.add_node("construct", _construct)
    graph.add_node("verify", _verify)

    graph.set_entry_point("ground")
    graph.add_edge("ground", "pressure_test")
    graph.add_edge("pressure_test", "construct")
    graph.add_edge("construct", "verify")
    graph.add_edge("verify", END)

    return graph.compile()


_SWARM = build_swarm_graph()


def _parse_verdict(verification_text: str) -> dict:
    match = _VERDICT_BLOCK_RE.search(verification_text)
    if not match:
        return {
            "verdict": "unparseable",
            "score": None,
            "failure_modes": [],
            "pov_eligible": False,
        }

    try:
        parsed = json.loads(match.group(0))
    except json.JSONDecodeError:
        return {
            "verdict": "unparseable",
            "score": None,
            "failure_modes": [],
            "pov_eligible": False,
        }

    return {
        "verdict": parsed.get("verdict", "unparseable"),
        "score": parsed.get("score"),
        "failure_modes": parsed.get("failure_modes", []),
        "pov_eligible": bool(parsed.get("pov_eligible", False)),
    }


def run_swarm_cycle(
    director_prompt: str,
    prior_context: str = "",
    mode: WorkMode = "construct",
) -> dict:
    if mode not in ("brainstorm", "assist", "construct"):
        mode = "construct"

    result = _SWARM.invoke(
        {
            "director_prompt": director_prompt,
            "prior_context": prior_context or "",
            "mode": mode,
        }
    )

    turns = [
        {"agent": "@Astra", "summary_conclusion": result["ground_output"]},
        {"agent": "@Kaelen", "summary_conclusion": result["critique_output"]},
        {"agent": "@Synthetix", "summary_conclusion": result["build_output"]},
        {"agent": "@Veritas", "summary_conclusion": result["verification_output"]},
    ]

    return {
        "turns": turns,
        "verification": _parse_verdict(result["verification_output"]),
        "artifact_content": result["build_output"],
        "mode": mode,
    }
