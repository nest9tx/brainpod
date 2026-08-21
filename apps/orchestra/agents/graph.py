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


_URL_RE = re.compile(r"https?://\S+")


def _strip_unverified_citations(text: str, allowed_urls: list[str]) -> str:
    def _replace(match: re.Match) -> str:
        url = match.group(0).rstrip(").,;\"'")
        if any(url.startswith(allowed) or allowed.startswith(url) for allowed in allowed_urls):
            return match.group(0)
        return "[unverifiable citation removed]"

    return _URL_RE.sub(_replace, text)


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


def _ground(state: SwarmState) -> SwarmState:
    mode = state.get("mode") or "construct"
    # Search is most useful for construct; lighter for brainstorm/assist
    should_search = mode == "construct" or mode == "assist"
    search_results = search_web(state["director_prompt"]) if should_search else []
    allowed_urls = [r["url"] for r in search_results if r.get("url")]
    prior = state.get("prior_context") or ""
    prior_block = (
        f"\n\nPrior context from this Mini-Pod (use only if relevant):\n{prior}"
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
                    "Live search results (cite only these if you use external sources; "
                    "do not invent others):\n"
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
    if mode == "brainstorm":
        source_note = (
            "This is a brainstorm. Focus on useful perspectives and possibilities. "
            "If you reference external material, only use the allowed list below or clearly "
            "mark ideas as speculative. Do not invent sources.\n"
            f"Allowed URLs: {chr(10).join(allowed_urls) or 'None'}"
        )
    else:
        source_note = (
            "Only cite these URLs verbatim; never invent sources. If the list is empty, "
            "state that clearly and still produce the most useful structured contribution "
            f"you can:\n{chr(10).join(allowed_urls) or 'None available.'}"
        )

    response = _model(temperature=0.5 if mode == "brainstorm" else 0.3).invoke(
        [
            SystemMessage(content=SYNTHETIX_PROMPT),
            HumanMessage(
                content=(
                    f"{_mode_instruction(mode)}\n\n"
                    f"Director prompt:\n{state['director_prompt']}\n\n"
                    f"@Astra:\n{state['ground_output']}\n\n"
                    f"@Kaelen:\n{state['critique_output']}\n\n"
                    f"{source_note}"
                )
            ),
        ]
    )
    build_output = _strip_unverified_citations(response.content, allowed_urls)
    return {**state, "build_output": build_output}


def _verify(state: SwarmState) -> SwarmState:
    mode = state.get("mode") or "construct"
    allowed_urls = state.get("allowed_urls", [])

    if mode == "brainstorm":
        guidance = (
            "MODE = Brainstorm. Evaluation should focus on whether the contribution "
            "offers useful, honest perspectives. Do not demand heavy external citation. "
            "Invented sources are still a failure. pov_eligible should usually be false "
            "unless the brainstorm produced a clearly citable advancement. "
            "Scores in the 60–85 range for good collaborative thinking are appropriate."
        )
    elif mode == "assist":
        guidance = (
            "MODE = Assist. Evaluate clarity, usefulness, and intellectual honesty. "
            "Moderate grounding is enough. Invented sources remain a failure. "
            "pov_eligible can be true for genuinely helpful structured assistance."
        )
    else:
        guidance = (
            "MODE = Construct & Verify. Full rigor. Reward clear structure, explicit "
            "limitations, and honest use of sources. Invented sources block pov_eligible. "
            "Well-structured work that states limitations can still score 80+ and be "
            "pov_eligible even when external sources were unavailable."
        )

    source_note = (
        f"Allowed sources for this cycle:\n{chr(10).join(allowed_urls) or 'None'}\n\n"
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
    """Run a mode-aware swarm cycle."""
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
