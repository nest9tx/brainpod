"""Grounding tools available to @Astra. Kept as plain function calls rather than
LangChain tool-calling loop, since the swarm cycle is a fixed pipeline, not an agent
that decides for itself whether to search.
"""

import os

from tavily import TavilyClient

_client: TavilyClient | None = None


def _get_client() -> TavilyClient | None:
    global _client
    api_key = os.environ.get("TAVILY_API_KEY")
    if not api_key:
        return None
    if _client is None:
        _client = TavilyClient(api_key=api_key)
    return _client


def search_web(query: str, max_results: int = 4) -> list[dict]:
    """Return [{title, url, content}], or [] if search isn't configured/fails.
    Failing open (empty results) rather than raising keeps a missing/invalid
    TAVILY_API_KEY a degraded-grounding issue, not an outage."""
    client = _get_client()
    if client is None:
        return []

    try:
        response = client.search(query=query, max_results=max_results)
    except Exception:
        return []

    return [
        {
            "title": r.get("title", ""),
            "url": r.get("url", ""),
            "content": r.get("content", ""),
        }
        for r in response.get("results", [])
    ]
