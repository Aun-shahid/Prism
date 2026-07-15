"""
Web research tools used by the AI assistant and the watchlist.

Provider-agnostic: search runs through DuckDuckGo (ddgs) and page fetching
through httpx + BeautifulSoup, so research works no matter which AI provider
key the user has configured.
"""

import asyncio
import re
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup
from fastapi import HTTPException, status

from .ai_service import AIService
from .logging_service import get_logger

logger = get_logger("web_research")

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}

FETCH_TIMEOUT = 15.0

# Domains that are never a company's own website
AGGREGATOR_DOMAINS = (
    "linkedin.com", "glassdoor.com", "indeed.com", "wikipedia.org",
    "crunchbase.com", "facebook.com", "instagram.com", "x.com",
    "twitter.com", "youtube.com", "reddit.com", "bloomberg.com",
    "pitchbook.com", "zoominfo.com", "apollo.io", "g2.com",
)

# Hosted applicant-tracking systems — a hit on these IS a careers/jobs page
ATS_DOMAINS = (
    "greenhouse.io", "lever.co", "ashbyhq.com", "workable.com",
    "myworkdayjobs.com", "bamboohr.com", "smartrecruiters.com",
    "jobvite.com", "recruitee.com", "icims.com", "teamtailor.com",
    "breezy.hr", "rippling-ats.com", "jobs.personio.com",
)

CAREER_PATH_HINTS = ("career", "careers", "jobs", "join-us", "joinus", "join_us",
                     "work-with-us", "vacancies", "openings", "opportunities", "hiring")


class WebResearchService:
    """Search + fetch + company research primitives."""

    # ------------------------------------------------------------------
    # Search
    # ------------------------------------------------------------------

    @staticmethod
    async def search_web(query: str, max_results: int = 8) -> List[Dict[str, str]]:
        """
        DuckDuckGo web search. Returns a list of
        {"title": ..., "url": ..., "snippet": ...}.
        """
        try:
            from ddgs import DDGS
        except ImportError:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Web search dependency missing on the server (pip install ddgs).",
            )

        def _search() -> List[Dict[str, str]]:
            results = []
            with DDGS() as ddgs:
                for item in ddgs.text(query, max_results=max_results):
                    results.append({
                        "title": item.get("title", ""),
                        "url": item.get("href", "") or item.get("url", ""),
                        "snippet": item.get("body", ""),
                    })
            return results

        try:
            return await asyncio.to_thread(_search)
        except Exception as e:
            logger.error(f"Web search failed for '{query}': {e}")
            return []

    # ------------------------------------------------------------------
    # Fetch
    # ------------------------------------------------------------------

    @staticmethod
    async def fetch_page(url: str, max_chars: int = 4000) -> Tuple[str, List[Dict[str, str]]]:
        """
        Fetch a page and return (clean_text, links). Links are
        {"text": ..., "url": absolute_url}. Returns ("", []) on failure.
        """
        try:
            async with httpx.AsyncClient(
                headers=HEADERS, timeout=FETCH_TIMEOUT, follow_redirects=True
            ) as client:
                response = await client.get(url)
                response.raise_for_status()
                content_type = response.headers.get("content-type", "")
                if "html" not in content_type and "text" not in content_type:
                    return "", []
                soup = BeautifulSoup(response.text, "lxml")

            for tag in soup(["script", "style", "noscript", "svg", "iframe"]):
                tag.decompose()

            text = soup.get_text(separator=" ", strip=True)
            text = re.sub(r"\s+", " ", text)[:max_chars]

            links = []
            for anchor in soup.find_all("a", href=True)[:200]:
                href = urljoin(url, anchor["href"])
                label = anchor.get_text(strip=True)
                if href.startswith("http"):
                    links.append({"text": label[:100], "url": href})

            return text, links
        except Exception as e:
            logger.warning(f"Failed to fetch {url}: {e}")
            return "", []

    # ------------------------------------------------------------------
    # Careers page discovery
    # ------------------------------------------------------------------

    @staticmethod
    def _looks_like_careers_url(url: str) -> bool:
        lowered = url.lower()
        if any(ats in lowered for ats in ATS_DOMAINS):
            return True
        parsed = urlparse(lowered)
        haystack = parsed.netloc + parsed.path
        return any(hint in haystack for hint in CAREER_PATH_HINTS)

    @staticmethod
    async def discover_careers_urls(
        company_name: str,
        homepage_links: Optional[List[Dict[str, str]]] = None,
    ) -> List[str]:
        """
        Find candidate careers/jobs page URLs for a company by combining
        homepage link scanning with a targeted web search.
        """
        candidates: List[str] = []

        for link in homepage_links or []:
            label = link["text"].lower()
            if WebResearchService._looks_like_careers_url(link["url"]) or \
                    any(hint in label for hint in CAREER_PATH_HINTS):
                candidates.append(link["url"])

        results = await WebResearchService.search_web(
            f'{company_name} careers jobs openings', max_results=8
        )
        for result in results:
            if WebResearchService._looks_like_careers_url(result["url"]):
                candidates.append(result["url"])

        # De-duplicate, preserve order
        seen = set()
        unique = []
        for url in candidates:
            key = url.rstrip("/").lower()
            if key not in seen:
                seen.add(key)
                unique.append(url.rstrip("/"))
        return unique[:6]

    # ------------------------------------------------------------------
    # Full company research pipeline
    # ------------------------------------------------------------------

    @staticmethod
    async def research_company(
        user_id: str,
        company_name: str,
        preferred_provider: Optional[str] = None,
        steps: Optional[List[Dict[str, Any]]] = None,
    ) -> Tuple[Dict[str, Any], List[str]]:
        """
        Research a company end-to-end:
          1. Web search for the company
          2. Identify + fetch its official website
          3. Discover careers/jobs page URLs (search + homepage links)
          4. Summarize everything into a structured brief via the user's LLM

        `steps` (optional) collects progress entries for the UI agent trace.

        Returns (brief_dict, source_urls).
        """
        def note(label: str, detail: str = "") -> None:
            if steps is not None:
                steps.append({"type": "research", "label": label, "detail": detail})

        sources: List[str] = []

        note("Searching the web", f'Query: "{company_name} company"')
        general_results = await WebResearchService.search_web(
            f"{company_name} company", max_results=8
        )
        news_results = await WebResearchService.search_web(
            f"{company_name} news 2026", max_results=4
        )

        # Pick the likely official website (first non-aggregator result)
        website = None
        for result in general_results:
            domain = urlparse(result["url"]).netloc.lower()
            if result["url"].startswith("http") and \
                    not any(agg in domain for agg in AGGREGATOR_DOMAINS):
                website = result["url"]
                break

        homepage_text, homepage_links = "", []
        if website:
            note("Reading company website", website)
            homepage_text, homepage_links = await WebResearchService.fetch_page(website, max_chars=3500)
            if homepage_text:
                sources.append(website)

        note("Locating careers page")
        careers_candidates = await WebResearchService.discover_careers_urls(
            company_name, homepage_links
        )

        careers_text = ""
        if careers_candidates:
            note("Reading careers page", careers_candidates[0])
            careers_text, _ = await WebResearchService.fetch_page(
                careers_candidates[0], max_chars=2000
            )
            if careers_text:
                sources.append(careers_candidates[0])

        search_context = "\n".join(
            f"- {r['title']}: {r['snippet']} ({r['url']})"
            for r in (general_results + news_results)[:12]
        )

        note("Summarizing findings")
        system_prompt = (
            "You are a company research analyst helping a job seeker. Using ONLY the "
            "provided web research, produce a JSON object with these keys:\n"
            '  "name": official company name\n'
            '  "website": official website URL or null\n'
            '  "overview": 2-3 sentence plain-language description of what the company does\n'
            '  "industry": short industry label or null\n'
            '  "headquarters": HQ city/country or null\n'
            '  "company_size": e.g. "~500 employees" or null\n'
            '  "products_services": array of up to 5 short strings\n'
            '  "culture_and_values": array of up to 4 short strings (only if evidenced)\n'
            '  "recent_highlights": array of up to 4 short strings (news, funding, launches)\n'
            '  "careers_url": the best careers page URL from the candidates, or null\n'
            '  "jobs_url": the best direct job-listings URL from the candidates (an ATS '
            'link like greenhouse/lever/workday counts), or null\n'
            '  "talking_points": array of up to 4 specific things a candidate could mention '
            "in an application or interview\n"
            "If something is not supported by the research, use null or an empty array. "
            "Never invent facts."
        )
        user_prompt = (
            f"Company to research: {company_name}\n\n"
            f"SEARCH RESULTS:\n{search_context or '(none)'}\n\n"
            f"OFFICIAL WEBSITE ({website or 'not found'}):\n{homepage_text or '(not fetched)'}\n\n"
            f"CAREERS PAGE CANDIDATES:\n" +
            ("\n".join(f"- {u}" for u in careers_candidates) if careers_candidates else "(none found)") +
            f"\n\nCAREERS PAGE CONTENT:\n{careers_text or '(not fetched)'}"
        )

        try:
            brief, _provider = await AIService.generate_json(
                user_id, system_prompt, user_prompt, preferred_provider=preferred_provider
            )
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Company research summarization failed for {company_name}: {e}")
            brief = {}

        # Ensure required keys exist and backfill from heuristics
        brief.setdefault("name", company_name)
        brief.setdefault("website", website)
        if not brief.get("careers_url") and careers_candidates:
            brief["careers_url"] = careers_candidates[0]
        brief.setdefault("jobs_url", brief.get("careers_url"))
        brief["careers_candidates"] = careers_candidates

        for result in general_results[:4]:
            if result["url"] not in sources:
                sources.append(result["url"])

        return brief, sources[:8]
