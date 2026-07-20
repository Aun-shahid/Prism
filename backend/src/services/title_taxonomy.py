"""
Searchable job-title dataset for autocomplete suggestions on the frontend
(Profile's Target Job Titles, watchlist keywords), sourced from an offline
dataset built from the public O*NET database (US Dept of Labor, O*NET 30.3 —
CC BY 4.0, see scripts/build_title_taxonomy.py). Pure offline data + pure
code, no network or AI calls at runtime ([[prism-cost-constraint]]).

This is a plain lookup for a HUMAN to pick from — not an automated backend
relevance-matching signal. A single word like "Programmer" genuinely spans
unrelated occupations in the source data (e.g. a software role and a
CNC-machining role), which is fine for a person choosing a title from a list,
but unsound as an automatic equivalence for filtering scraped postings.
"""

import json
import os
from typing import List, Optional

_DATA_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "onet_job_titles.json")

_titles: Optional[List[str]] = None


def _load() -> List[str]:
    global _titles
    if _titles is None:
        try:
            with open(_DATA_PATH, encoding="utf-8") as f:
                _titles = json.load(f)
        except FileNotFoundError:
            _titles = []
    return _titles


def search_titles(query: str, limit: int = 10) -> List[str]:
    """
    Return up to `limit` known job titles matching `query`, for autocomplete.
    Titles starting with the query rank first, then titles containing it
    elsewhere — both case-insensitive.
    """
    query = (query or "").strip().lower()
    if not query:
        return []
    titles = _load()

    starts_with = []
    contains = []
    for t in titles:
        t_lower = t.lower()
        if t_lower.startswith(query):
            starts_with.append(t)
        elif query in t_lower:
            contains.append(t)
        if len(starts_with) >= limit:
            break

    results = starts_with + contains
    return results[:limit]
