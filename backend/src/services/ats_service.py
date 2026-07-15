"""
ATS (Applicant Tracking System) fast-path.

A large share of company career pages are hosted on a handful of ATS platforms
that expose clean, public JSON job-board APIs. When a watched company's careers
URL points at one of these, we fetch structured postings (exact title, canonical
URL, location, freshness) instead of scraping and guessing from raw HTML.

This is strictly a best-effort optimisation: `detect_ats` returns None for
anything unrecognised, and `fetch_ats_jobs` returns [] on any error, so the
caller always falls back to generic HTML scraping.

Supported today: Greenhouse, Lever, Ashby. (Workday is intentionally omitted —
its board tokens are per-tenant and its API needs a POST with a discovered host,
which is too fragile to include here.)
"""

import re
from typing import List, Optional, Tuple

import httpx

from .logging_service import get_logger

logger = get_logger("ats_service")

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
}

_TIMEOUT = 15.0


def detect_ats(url: Optional[str]) -> Optional[Tuple[str, str]]:
    """
    Recognise a known ATS from a careers/jobs URL and extract the board token.

    Returns (provider, board_token) or None. `provider` is one of
    "greenhouse" | "lever" | "ashby".
    """
    if not url:
        return None
    u = url.lower()

    # Greenhouse:
    #   boards.greenhouse.io/<token>            (classic)
    #   job-boards.greenhouse.io/<token>        (new hosted boards)
    #   <token>.greenhouse.io
    #   ...anything?...for=<token>              (embedded board)
    m = re.search(r"(?:job-)?boards\.greenhouse\.io/([a-z0-9_-]+)", u)
    if m:
        return "greenhouse", m.group(1)
    m = re.search(r"(?:[?&])for=([a-z0-9_-]+)", u)
    if m and "greenhouse" in u:
        return "greenhouse", m.group(1)
    m = re.search(r"//([a-z0-9_-]+)\.greenhouse\.io", u)
    if m and m.group(1) not in ("boards", "job-boards", "www", "api"):
        return "greenhouse", m.group(1)

    # Lever: jobs.lever.co/<token>
    m = re.search(r"jobs\.lever\.co/([a-z0-9_-]+)", u)
    if m:
        return "lever", m.group(1)

    # Ashby: jobs.ashbyhq.com/<token>
    m = re.search(r"jobs\.ashbyhq\.com/([a-z0-9_%.-]+)", u)
    if m:
        return "ashby", m.group(1)

    return None


async def _fetch_greenhouse(token: str, client: httpx.AsyncClient) -> List[dict]:
    url = f"https://boards-api.greenhouse.io/v1/boards/{token}/jobs"
    res = await client.get(url, headers=HEADERS, timeout=_TIMEOUT)
    res.raise_for_status()
    data = res.json()
    jobs = []
    for j in data.get("jobs", []):
        loc = (j.get("location") or {}).get("name") if isinstance(j.get("location"), dict) else None
        jobs.append({
            "title": (j.get("title") or "").strip(),
            "url": j.get("absolute_url") or "",
            "location": loc,
            "updated_at": j.get("updated_at"),
        })
    return jobs


async def _fetch_lever(token: str, client: httpx.AsyncClient) -> List[dict]:
    url = f"https://api.lever.co/v0/postings/{token}?mode=json"
    res = await client.get(url, headers=HEADERS, timeout=_TIMEOUT)
    res.raise_for_status()
    data = res.json()
    jobs = []
    for j in data if isinstance(data, list) else []:
        cats = j.get("categories") or {}
        loc = cats.get("location")
        jobs.append({
            "title": (j.get("text") or "").strip(),
            "url": j.get("hostedUrl") or j.get("applyUrl") or "",
            "location": loc,
            "updated_at": j.get("createdAt"),
        })
    return jobs


async def _fetch_ashby(token: str, client: httpx.AsyncClient) -> List[dict]:
    url = f"https://api.ashbyhq.com/posting-api/job-board/{token}?includeCompensation=false"
    res = await client.get(url, headers=HEADERS, timeout=_TIMEOUT)
    res.raise_for_status()
    data = res.json()
    jobs = []
    for j in data.get("jobs", []):
        jobs.append({
            "title": (j.get("title") or "").strip(),
            "url": j.get("jobUrl") or j.get("applyUrl") or "",
            "location": j.get("location"),
            "updated_at": j.get("publishedAt") or j.get("updatedAt"),
        })
    return jobs


async def fetch_ats_jobs(provider: str, token: str) -> List[dict]:
    """
    Fetch structured postings from a known ATS. Returns a list of
    {title, url, location, updated_at}. Returns [] on any failure so the caller
    can fall back to HTML scraping.
    """
    fetchers = {
        "greenhouse": _fetch_greenhouse,
        "lever": _fetch_lever,
        "ashby": _fetch_ashby,
    }
    fetcher = fetchers.get(provider)
    if not fetcher:
        return []
    try:
        async with httpx.AsyncClient(follow_redirects=True) as client:
            jobs = await fetcher(token, client)
        # Drop entries missing a title or URL.
        clean = [j for j in jobs if j.get("title") and j.get("url")]
        logger.info(f"ATS fetch ({provider}/{token}) returned {len(clean)} postings")
        return clean
    except Exception as e:
        logger.warning(f"ATS fetch failed ({provider}/{token}): {e}")
        return []
