"""LangGraph implementation of the default swarm cycle (outline §11):
Ground (@Astra) -> Pressure-test (@Kaelen) -> Construct (@Synthetix) -> Verify (@Veritas).

Human Director interventions always re-enter at Ground with the new instruction folded
into state; this graph models a single cycle triggered by one Director prompt.
"""

import json
import os
import re
from typing import TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import END, StateGraph

from .prompts import ASTRA_PROMPT, KAELEN_PROMPT, SYNTHETIX_PROMPT, VERITAS_PROMPT

# Matches the last {...} block in @Veritas's reply, tolerating a ```json fence around it.
_VERDICT_BLOCK_RE = re.compile(r"\{[^{}]*\}(?!.*\{[^{}]*\})", re.DOTALL)


class SwarmState(TypedDict):
    director_prompt: str
    ground_output: str
    critique_output: str
    build_output: str
    verification_output: str


def _model() -> ChatOpenAI:
    # Cheap-model-by-default per the outline's cost-control rules; escalate later by
    # swapping ORCHESTRA_MODEL per-node once @Veritas verification/stress-test hooks exist.
    return ChatOpenAI(model=os.environ.get("ORCHESTRA_MODEL", "gpt-4o-mini"), temperature=0.3)


def _ground(state: SwarmState) -> SwarmState:
    response = _model().invoke(
        [SystemMessage(content=ASTRA_PROMPT), HumanMessage(content=state["director_prompt"])]
    )
    return {**state, "ground_output": response.content}


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
    response = _model().invoke(
        [
            SystemMessage(content=SYNTHETIX_PROMPT),
            HumanMessage(
                content=(
                    f"Director prompt:\n{state['director_prompt']}\n\n"
                    f"@Astra's grounding:\n{state['ground_output']}\n\n"
                    f"@Kaelen's critique:\n{state['critique_output']}"
                )
            ),
        ]
    )
    return {**state, "build_output": response.content}


def _verify(state: SwarmState) -> SwarmState:
    response = _model().invoke(
        [
            SystemMessage(content=VERITAS_PROMPT),
            HumanMessage(content=f"Artifact to verify:\n{state['build_output']}"),
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
    """Extract @Veritas's structured verdict block. Never award PoV on a parse
    failure — that mirrors @Veritas's own rule of never verifying by default."""
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


def run_swarm_cycle(director_prompt: str) -> dict:
    """Run one full Ground->Pressure-test->Construct->Verify cycle and return turns
    shaped for the web app's timeline (outline §7: summary first, reasoning collapsed),
    plus @Veritas's parsed verdict for PoV/artifact bookkeeping."""
    result = _SWARM.invoke({"director_prompt": director_prompt})

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

