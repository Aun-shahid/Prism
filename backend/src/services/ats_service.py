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

import html as html_lib
import re
from typing import List, Optional, Tuple

from curl_cffi.requests import AsyncSession
from bs4 import BeautifulSoup

from .logging_service import get_logger
from .stealth_http import new_session

logger = get_logger("ats_service")

# These are legitimate public JSON APIs (not adversarial scraping), but the
# TLS impersonation is kept consistent with the rest of the scraper anyway —
# no downside, and it's one less place with a stale hand-set User-Agent.
JSON_HEADERS = {"Accept": "application/json, text/plain, */*"}

_TIMEOUT = 15.0

# Kept generous (not just a UI-display snippet size) — a "years of experience"
# requirement often sits in a "Minimum qualifications" section well past the
# intro, and callers need the fuller text to find it before truncating for
# storage. Still bounded so a doc can't be pathologically large.
_DESCRIPTION_MAX_CHARS = 4000


def _html_to_text(raw: Optional[str]) -> str:
    if not raw:
        return ""
    # Some ATS APIs (e.g. Greenhouse) return the description HTML-entity
    # escaped as a string (literal "&lt;h2&gt;") rather than as real markup —
    # unescape first so BeautifulSoup actually sees tags to strip, not text
    # that merely decodes into tag-shaped characters.
    unescaped = html_lib.unescape(raw)
    text = BeautifulSoup(unescaped, "html.parser").get_text(separator=" ", strip=True)
    return re.sub(r"\s+", " ", text).strip()


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


async def _fetch_greenhouse(token: str, client: AsyncSession) -> List[dict]:
    # content=true includes the full HTML job description in the same list
    # response — no per-job fetch needed.
    url = f"https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true"
    res = await client.get(url, headers=JSON_HEADERS, timeout=_TIMEOUT)
    res.raise_for_status()
    data = res.json()
    jobs = []
    for j in data.get("jobs", []):
        loc = (j.get("location") or {}).get("name") if isinstance(j.get("location"), dict) else None
        description = _html_to_text(j.get("content"))[:_DESCRIPTION_MAX_CHARS]
        jobs.append({
            "title": (j.get("title") or "").strip(),
            "url": j.get("absolute_url") or "",
            "location": loc,
            "updated_at": j.get("updated_at"),
            "description": description or None,
        })
    return jobs


async def _fetch_lever(token: str, client: AsyncSession) -> List[dict]:
    url = f"https://api.lever.co/v0/postings/{token}?mode=json"
    res = await client.get(url, headers=JSON_HEADERS, timeout=_TIMEOUT)
    res.raise_for_status()
    data = res.json()
    jobs = []
    for j in data if isinstance(data, list) else []:
        cats = j.get("categories") or {}
        loc = cats.get("location")
        # The intro is in description(Plain); the substantive content
        # (requirements, responsibilities) is usually in `lists` sections.
        parts = []
        if j.get("descriptionPlain"):
            parts.append(j["descriptionPlain"])
        elif j.get("description"):
            parts.append(_html_to_text(j["description"]))
        for item in j.get("lists") or []:
            heading = (item.get("text") or "").strip()
            body = _html_to_text(item.get("content"))
            if heading or body:
                parts.append(f"{heading} {body}".strip())
        if j.get("additionalPlain"):
            parts.append(j["additionalPlain"])
        description = " ".join(p for p in parts if p)[:_DESCRIPTION_MAX_CHARS]
        jobs.append({
            "title": (j.get("text") or "").strip(),
            "url": j.get("hostedUrl") or j.get("applyUrl") or "",
            "location": loc,
            "updated_at": j.get("createdAt"),
            "description": description or None,
        })
    return jobs


async def _fetch_ashby(token: str, client: AsyncSession) -> List[dict]:
    url = f"https://api.ashbyhq.com/posting-api/job-board/{token}?includeCompensation=false"
    res = await client.get(url, headers=JSON_HEADERS, timeout=_TIMEOUT)
    res.raise_for_status()
    data = res.json()
    jobs = []
    for j in data.get("jobs", []):
        description = (j.get("descriptionPlain") or _html_to_text(j.get("descriptionHtml")))[:_DESCRIPTION_MAX_CHARS]
        jobs.append({
            "title": (j.get("title") or "").strip(),
            "url": j.get("jobUrl") or j.get("applyUrl") or "",
            "location": j.get("location"),
            "updated_at": j.get("publishedAt") or j.get("updatedAt"),
            "description": description or None,
        })
    return jobs


async def fetch_ats_jobs(provider: str, token: str) -> List[dict]:
    """
    Fetch structured postings from a known ATS. Returns a list of
    {title, url, location, updated_at, description}. Returns [] on any
    failure so the caller can fall back to HTML scraping.
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
        async with new_session() as client:
            jobs = await fetcher(token, client)
        # Drop entries missing a title or URL.
        clean = [j for j in jobs if j.get("title") and j.get("url")]
        logger.info(f"ATS fetch ({provider}/{token}) returned {len(clean)} postings")
        return clean
    except Exception as e:
        logger.warning(f"ATS fetch failed ({provider}/{token}): {e}")
        return []
