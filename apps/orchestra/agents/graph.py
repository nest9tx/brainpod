"""LangGraph implementation of the default swarm cycle:
Ground (@Astra) -> Pressure-test (@Kaelen) -> Construct (@Synthetix) -> Verify (@Veritas).

Human Director interventions always re-enter with the new instruction.
This graph models a cycle that can optionally carry prior context for multi-turn dialogue.
"""

import json
import os
import re
from typing import TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import END, StateGraph

from .prompts import ASTRA_PROMPT, KAELEN_PROMPT, SYNTHETIX_PROMPT, VERITAS_PROMPT
from .tools import search_web

# Matches the last {...} block in @Veritas's reply, tolerating a ```json fence around it.
_VERDICT_BLOCK_RE = re.compile(r"\{[^{}]*\}(?!.*\{[^{}]*\})", re.DOTALL)


class SwarmState(TypedDict):
    director_prompt: str
    prior_context: str
    ground_output: str
    critique_output: str
    build_output: str
    verification_output: str
    allowed_urls: list[str]


def _model() -> ChatOpenAI:
    # Cheap-model-by-default per cost-control rules.
    return ChatOpenAI(model=os.environ.get("ORCHESTRA_MODEL", "gpt-4o-mini"), temperature=0.3)


def _format_search_results(results: list[dict]) -> str:
    if not results:
        return "No external search results are available for this request."
    return "\n".join(f"- {r['title']} ({r['url']}): {r['content'][:400]}" for r in results)


_URL_RE = re.compile(r"https?://\S+")


def _strip_unverified_citations(text: str, allowed_urls: list[str]) -> str:
    """Redact any URL the model cited that isn't one of the real search results."""

    def _replace(match: re.Match) -> str:
        url = match.group(0).rstrip(").,;\"'")
        if any(url.startswith(allowed) or allowed.startswith(url) for allowed in allowed_urls):
            return match.group(0)
        return "[unverifiable citation removed]"

    return _URL_RE.sub(_replace, text)


def _ground(state: SwarmState) -> SwarmState:
    search_results = search_web(state["director_prompt"])
    allowed_urls = [r["url"] for r in search_results if r.get("url")]
    prior = state.get("prior_context") or ""
    prior_block = f"\n\nPrior context from this Mini-Pod (use only if relevant):\n{prior}" if prior else ""

    response = _model().invoke(
        [
            SystemMessage(content=ASTRA_PROMPT),
            HumanMessage(
                content=(
                    f"Director prompt:\n{state['director_prompt']}{prior_block}\n\n"
                    "Live search results — cite only these URLs; do not invent others "
                    f"or assert facts they don't support:\n{_format_search_results(search_results)}"
                )
            ),
        ]
    )
    ground_output = _strip_unverified_citations(response.content, allowed_urls)
    return {**state, "ground_output": ground_output, "allowed_urls": allowed_urls}


def _pressure_test(state: SwarmState) -> SwarmState:
    response = _model().invoke(
        [
            SystemMessage(content=KAELEN_PROMPT),
            HumanMessage(
                content=(
                    f"Director prompt:\n{state['director_prompt']}\n\n"
                    f"@Astra's grounding:\n{state['ground_output']}"
                )
            ),
        ]
    )
    return {**state, "critique_output": response.content}


def _construct(state: SwarmState) -> SwarmState:
    allowed_urls = state.get("allowed_urls", [])
    allowed_urls_note = (
        "Only cite these URLs verbatim; never introduce a new source, title, author, "
        "or publication that isn't in this list. If the list is empty, explicitly state that "
        "no external sources were available and produce the most useful structured artifact "
        "you can under that constraint. Attach any real citation immediately after the claim "
        f"it supports:\n{chr(10).join(allowed_urls) or 'None available.'}"
    )
    response = _model().invoke(
        [
            SystemMessage(content=SYNTHETIX_PROMPT),
            HumanMessage(
                content=(
                    f"Director prompt:\n{state['director_prompt']}\n\n"
                    f"@Astra's grounding:\n{state['ground_output']}\n\n"
                    f"@Kaelen's critique:\n{state['critique_output']}\n\n"
                    f"{allowed_urls_note}"
                )
            ),
        ]
    )
    build_output = _strip_unverified_citations(response.content, allowed_urls)
    return {**state, "build_output": build_output}


def _verify(state: SwarmState) -> SwarmState:
    allowed_urls = state.get("allowed_urls", [])
    source_note = (
        "The only real, search-verified sources available for this artifact were:\n"
        f"{chr(10).join(allowed_urls) or 'None — no external search results were available.'}\n\n"
        "Scoring guidance:\n"
        "- If the artifact is well-structured, clearly states limitations, and does not invent "
        "sources, it can score 80+ and be pov_eligible even when no external sources existed.\n"
        "- Invented citations, authors, or institutions that are not in the allowed list must "
        "be treated as failure modes and should prevent pov_eligible.\n"
        "- Prefer rewarding intellectual honesty and clear structure over punishing the absence "
        "of sources that were never available."
    )
    response = _model().invoke(
        [
            SystemMessage(content=VERITAS_PROMPT),
            HumanMessage(
                content=f"Artifact to verify:\n{state['build_output']}\n\n{source_note}"
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
    """Extract @Veritas's structured verdict block. Never award PoV on a parse failure."""
    match = _VERDICT_BLOCK_RE.search(verification_text)
    if not match:
        return {"verdict": "unparseable", "score": None, "failure_modes": [], "pov_eligible": False}

    try:
        parsed = json.loads(match.group(0))
    except json.JSONDecodeError:
        return {"verdict": "unparseable", "score": None, "failure_modes": [], "pov_eligible": False}

    return {
        "verdict": parsed.get("verdict", "unparseable"),
        "score": parsed.get("score"),
        "failure_modes": parsed.get("failure_modes", []),
        "pov_eligible": bool(parsed.get("pov_eligible", False)),
    }


def run_swarm_cycle(director_prompt: str, prior_context: str = "") -> dict:
    """Run one full Ground->Pressure-test->Construct->Verify cycle.
    Optional prior_context enables multi-turn dialogue within a Mini-Pod.
    """
    result = _SWARM.invoke(
        {
            "director_prompt": director_prompt,
            "prior_context": prior_context or "",
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
    }
