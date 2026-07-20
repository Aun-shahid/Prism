import asyncio
import re
from datetime import datetime
from typing import List, Optional
from bson import ObjectId
from fastapi import HTTPException, status
from curl_cffi.requests.exceptions import RequestException
from bs4 import BeautifulSoup

from .stealth_http import new_session

from ..database import (
    get_scraper_targets_collection,
    get_scraped_jobs_collection,
    get_profiles_collection,
    get_general_sources_collection,
)
from ..models.scraper import (
    ScraperTarget,
    ScrapedJob,
    ScraperTargetCreateRequest,
    ScraperTargetUpdateRequest,
    WatchCompanyRequest,
)
from ..models.general_sources import (
    GeneralScraperSource,
    GeneralScraperSourceCreateRequest,
    GeneralScraperSourceUpdateRequest,
)
from .logging_service import get_logger
from .scraper_utils import (
    normalize_job_url, is_excluded, looks_like_job_link, keyword_matches,
    extract_years_experience, extract_description_snippet,
)
from . import ats_service

# Bounded live-fetch of individual job pages for descriptions (HTML-scraping
# path only — ATS providers already include the description in their API
# response). Concurrency-limited and capped per scrape so a company posting a
# wave of new roles can't make one scrape run unboundedly long.
_DESCRIPTION_FETCH_CONCURRENCY = 5
_DESCRIPTION_FETCH_CAP = 25
_DESCRIPTION_SNIPPET_CHARS = 600

# A real headless browser is far heavier (memory/CPU, ~1-3s startup) than an
# HTTP request — cap how many can run at once across ALL concurrent scrapes
# (manual scans + the background scheduler sweep share this one limit), not
# just per-call, so a sweep hitting several JS-rendered sites at once can't
# spin up unbounded Chrome instances.
_BROWSER_FALLBACK_SEMAPHORE = asyncio.Semaphore(2)

logger = get_logger("scraper_service")

# HTTP fetches use stealth_http.new_session() (TLS/JA3 browser impersonation
# via curl_cffi) instead of a hand-set User-Agent — see stealth_http.py.

# Common job-listing HTML tag patterns
JOB_LINK_PATTERNS = [
    "a[href*='job']",
    "a[href*='career']",
    "a[href*='position']",
    "a[href*='opening']",
    "a[href*='apply']",
    "a[href*='role']",
    ".job-listing a",
    ".career-listing a",
    "[class*='job'] a",
    "[class*='position'] a",
    "[class*='opening'] a",
    "[data-job] a",
]


class ScraperService:
    @staticmethod
    async def add_target(user_id: str, data: ScraperTargetCreateRequest) -> ScraperTarget:
        """Register a new scraper target."""
        collection = get_scraper_targets_collection()
        now = datetime.utcnow()

        doc = {
            "user_id": user_id,
            "company_name": data.company_name,
            "career_url": data.career_url,
            "keywords": [kw.lower().strip() for kw in data.keywords],
            "is_active": True,
            "last_scraped": None,
            "research_status": "none",
            "created_at": now,
            "updated_at": now,
        }
        result = await collection.insert_one(doc)
        doc["_id"] = str(result.inserted_id)
        logger.info(f"Added scraper target '{data.company_name}' for user {user_id}")
        return ScraperTarget(**doc)

    @staticmethod
    async def watch_company(user_id: str, data: WatchCompanyRequest) -> ScraperTarget:
        """
        Add a company to the watchlist. Creates the target immediately
        (research_status="pending") and runs AI web research in the
        background to fill in the website, careers/jobs URLs and company
        brief. If the caller already supplied `career_url`, research honors
        it exactly instead of searching for/guessing one — cheaper and far
        more reliable than letting the AI discover it. The frontend polls
        the target list until research settles.
        """
        import asyncio

        collection = get_scraper_targets_collection()
        now = datetime.utcnow()
        career_url = data.career_url.strip() if data.career_url and data.career_url.strip() else None
        doc = {
            "user_id": user_id,
            "company_name": data.company_name.strip(),
            "career_url": career_url,
            "keywords": [kw.lower().strip() for kw in data.keywords],
            "is_active": True,
            "last_scraped": None,
            "research_status": "pending",
            "created_at": now,
            "updated_at": now,
        }
        result = await collection.insert_one(doc)
        target_id = str(result.inserted_id)
        doc["_id"] = target_id

        asyncio.create_task(
            ScraperService._research_target_task(
                user_id, target_id, data.preferred_provider, known_career_url=career_url
            )
        )
        logger.info(f"Watching company '{data.company_name}' for user {user_id} (research queued)")
        return ScraperTarget(**doc)

    @staticmethod
    async def start_target_research(
        user_id: str, target_id: str, preferred_provider: Optional[str] = None
    ) -> ScraperTarget:
        """(Re-)run AI research for an existing target, in the background."""
        import asyncio

        collection = get_scraper_targets_collection()
        try:
            oid = ObjectId(target_id)
        except Exception:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid target ID")

        doc = await collection.find_one_and_update(
            {"_id": oid, "user_id": user_id},
            {"$set": {"research_status": "pending", "updated_at": datetime.utcnow()}},
            return_document=True,
        )
        if not doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target not found")

        # If a careers URL is already trusted (user-set or previously discovered),
        # re-research should still honor it rather than searching again from scratch.
        asyncio.create_task(
            ScraperService._research_target_task(
                user_id, target_id, preferred_provider, known_career_url=doc.get("career_url")
            )
        )
        doc["_id"] = str(doc["_id"])
        return ScraperTarget(**doc)

    @staticmethod
    async def _research_target_task(
        user_id: str,
        target_id: str,
        preferred_provider: Optional[str] = None,
        known_career_url: Optional[str] = None,
    ) -> None:
        """Background task: research the company and persist the findings."""
        from .web_research_service import WebResearchService

        collection = get_scraper_targets_collection()
        oid = ObjectId(target_id)
        doc = await collection.find_one({"_id": oid, "user_id": user_id})
        if not doc:
            return
        company_name = doc.get("company_name", "")

        try:
            brief, sources = await WebResearchService.research_company(
                user_id, company_name, preferred_provider=preferred_provider,
                known_career_url=known_career_url,
            )
            update = {
                "website": brief.get("website"),
                "jobs_url": brief.get("jobs_url"),
                "description": brief.get("overview"),
                "industry": brief.get("industry"),
                "headquarters": brief.get("headquarters"),
                "company_size": brief.get("company_size"),
                "talking_points": brief.get("talking_points") or [],
                "research_sources": sources,
                "research_status": "completed",
                "researched_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }
            # Only fill career_url if the user hasn't set one manually
            if brief.get("careers_url") and not doc.get("career_url"):
                update["career_url"] = brief["careers_url"]
            await collection.update_one({"_id": oid}, {"$set": update})
            logger.info(f"Company research completed for '{company_name}'")

            try:
                from .notification_service import NotificationService
                await NotificationService.create_notification(
                    user_id=user_id,
                    title=f"Research complete: {company_name}",
                    message=(
                        f"We researched {company_name}"
                        + (" and found their careers page." if update.get("career_url") or doc.get("career_url") else ".")
                    ),
                    type="research",
                )
            except Exception as e:
                logger.error(f"Failed to create research notification: {e}")
        except Exception as e:
            logger.error(f"Company research failed for '{company_name}': {e}")
            await collection.update_one(
                {"_id": oid},
                {"$set": {"research_status": "failed", "updated_at": datetime.utcnow()}},
            )

    @staticmethod
    async def list_targets(user_id: str) -> List[ScraperTarget]:
        """List all scraper targets for a user."""
        collection = get_scraper_targets_collection()
        cursor = collection.find({"user_id": user_id}).sort("created_at", -1)
        targets = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            targets.append(ScraperTarget(**doc))
        return targets

    @staticmethod
    async def update_target(
        user_id: str, target_id: str, data: ScraperTargetUpdateRequest
    ) -> ScraperTarget:
        """Update a scraper target."""
        collection = get_scraper_targets_collection()
        try:
            oid = ObjectId(target_id)
        except Exception:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid target ID")

        update_dict = data.model_dump(exclude_unset=True)
        if "keywords" in update_dict:
            update_dict["keywords"] = [kw.lower().strip() for kw in update_dict["keywords"]]
        update_dict["updated_at"] = datetime.utcnow()

        result = await collection.update_one(
            {"_id": oid, "user_id": user_id},
            {"$set": update_dict}
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target not found")

        doc = await collection.find_one({"_id": oid})
        doc["_id"] = str(doc["_id"])
        return ScraperTarget(**doc)

    @staticmethod
    async def remove_target(user_id: str, target_id: str) -> bool:
        """Remove a scraper target and its discovered jobs."""
        collection = get_scraper_targets_collection()
        jobs_collection = get_scraped_jobs_collection()
        try:
            oid = ObjectId(target_id)
        except Exception:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid target ID")

        result = await collection.delete_one({"_id": oid, "user_id": user_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target not found")

        # Clean up associated jobs
        await jobs_collection.delete_many({"target_id": target_id})
        logger.info(f"Removed scraper target {target_id} and associated jobs")
        return True

    @staticmethod
    def _extract_job_links(html: str, base_url: str, source: str = "html") -> List[dict]:
        """Extract candidate posting links out of a page's HTML (shared by the
        static fetch and the browser-rendered fallback). Returns a
        de-duplicated list of {title, url, location, source, description}.
        Applies a noise filter so navigation/legal/social links don't pollute
        results.
        """
        from urllib.parse import urljoin

        soup = BeautifulSoup(html, "html.parser")
        found: dict = {}  # normalized_url -> {title, url}

        def _consider(text: str, href: str) -> None:
            text = (text or "").strip()
            if not text or not href:
                return
            if href.startswith("/"):
                href = urljoin(base_url, href)
            if not href.startswith("http"):
                return
            if not looks_like_job_link(text, href):
                return
            key = normalize_job_url(href)
            if key and key not in found:
                found[key] = {"title": text, "url": href}

        # Prefer structured job-listing selectors first.
        for pattern in JOB_LINK_PATTERNS:
            try:
                for link in soup.select(pattern):
                    _consider(link.get_text(strip=True), link.get("href", ""))
            except Exception:
                continue

        # Fallback: scan every link only if the selectors found nothing (still filtered).
        if not found:
            for link in soup.find_all("a", href=True):
                _consider(link.get_text(strip=True), link["href"])

        return [
            {"title": v["title"], "url": v["url"], "location": None, "source": source, "description": None}
            for v in found.values()
        ]

    @staticmethod
    async def _fetch_html_jobs(career_url: str) -> List[dict]:
        """Fetch a career page and extract candidate posting links from raw HTML."""
        try:
            async with new_session(timeout=30.0) as client:
                response = await client.get(career_url)
                response.raise_for_status()
        except RequestException as e:
            logger.error(f"Failed to fetch {career_url}: {e}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Failed to fetch career page: {str(e)}",
            )

        return ScraperService._extract_job_links(response.text, career_url, source="html")

    @staticmethod
    async def _fetch_html_jobs_with_browser(career_url: str) -> List[dict]:
        """
        Last-resort fallback for JS-rendered career pages: render the page in
        a real headless browser and extract from the RENDERED DOM instead of
        the raw HTML response. Only invoked when the static fetch above finds
        zero candidates — a real browser is far heavier than a plain HTTP
        request, so this must never become the default path.

        Requires a system Chrome/Chromium/Brave install (zendriver locates an
        existing browser; it does not bundle or download one). Degrades to an
        empty list with a log warning if none is found or rendering fails, so
        a scrape never hard-fails because of this.
        """
        try:
            import zendriver
            import logging as _logging
            _logging.getLogger("zendriver").setLevel(_logging.WARNING)  # its INFO logs are verbose per-launch dumps
        except ImportError:
            logger.warning("zendriver not installed — skipping JS-render fallback")
            return []

        async with _BROWSER_FALLBACK_SEMAPHORE:
            browser = None
            try:
                browser = await zendriver.start(headless=True)
                page = await browser.get(career_url)
                await page.sleep(2.5)  # let client-side rendering settle
                html = await page.get_content()
            except Exception as e:
                logger.warning(f"Browser-rendering fallback failed for {career_url}: {e}")
                return []
            finally:
                if browser is not None:
                    try:
                        await browser.stop()
                    except Exception:
                        pass

        candidates = ScraperService._extract_job_links(html, career_url, source="html-js")
        if candidates:
            logger.info(f"Browser-rendering fallback recovered {len(candidates)} candidate(s) from {career_url}")
        return candidates

    @staticmethod
    async def _fetch_missing_descriptions(candidates: List[dict]) -> None:
        """Live-fetch a description for candidates that don't already have one
        (i.e. HTML-scraped, not ATS-sourced), bounded by concurrency and a cap.
        Mutates each candidate dict's "description" key in place.
        """
        from .web_research_service import WebResearchService

        needing_fetch = [c for c in candidates if not c.get("description") and c.get("url")]
        if not needing_fetch:
            return
        to_fetch = needing_fetch[:_DESCRIPTION_FETCH_CAP]
        if len(needing_fetch) > _DESCRIPTION_FETCH_CAP:
            logger.info(
                f"Capping job-description fetch to {_DESCRIPTION_FETCH_CAP} of "
                f"{len(needing_fetch)} new postings this run"
            )

        sem = asyncio.Semaphore(_DESCRIPTION_FETCH_CONCURRENCY)

        async def _fetch_one(cand: dict) -> None:
            async with sem:
                try:
                    text, _links = await WebResearchService.fetch_page(cand["url"], max_chars=4000)
                    cand["description"] = text or None
                except Exception as e:
                    logger.warning(f"Failed to fetch description for {cand.get('url')}: {e}")

        await asyncio.gather(*[_fetch_one(c) for c in to_fetch], return_exceptions=True)

    @staticmethod
    async def scrape_target(user_id: str, target_id: str) -> List[ScrapedJob]:
        """Scrape a single target and record any NEW job postings.

        Uses a structured ATS API when the careers URL is on a known platform
        (Greenhouse/Lever/Ashby), otherwise falls back to filtered HTML scraping.
        Applies the user's exclusion list, de-duplicates against previously seen
        postings by normalized URL (single batched query, not N+1), refreshes
        `last_seen` on postings still present, and only inserts genuinely new roles.
        """
        targets_collection = get_scraper_targets_collection()
        jobs_collection = get_scraped_jobs_collection()

        try:
            oid = ObjectId(target_id)
        except Exception:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid target ID")

        target_doc = await targets_collection.find_one({"_id": oid, "user_id": user_id})
        if not target_doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target not found")

        target_doc["_id"] = str(target_doc["_id"])
        target = ScraperTarget(**target_doc)

        scrape_url = target.jobs_url or target.career_url
        if not scrape_url:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This company has no careers URL yet. Run AI research or add one manually.",
            )

        now = datetime.utcnow()

        # 1. Gather raw candidates — structured ATS API first, HTML fallback.
        # ATS responses already include a description; HTML candidates get
        # theirs fetched later, but only for postings that turn out to be new.
        candidates: List[dict] = []
        ats = ats_service.detect_ats(scrape_url) or ats_service.detect_ats(target.career_url)
        if ats:
            provider, token = ats
            for j in await ats_service.fetch_ats_jobs(provider, token):
                candidates.append({
                    "title": j["title"],
                    "url": j["url"],
                    "location": j.get("location"),
                    "source": provider,
                    "description": j.get("description"),
                })
        if not candidates:
            candidates = await ScraperService._fetch_html_jobs(scrape_url)
        if not candidates:
            # Zero links from the static fetch is the strongest signal that
            # the page is JS-rendered (a real career page with genuinely no
            # matches would still usually surface SOME candidate links before
            # keyword filtering) — worth the heavier browser-render attempt.
            candidates = await ScraperService._fetch_html_jobs_with_browser(scrape_url)

        # 2. Load the user's matching keywords + exclusions.
        profile_collection = get_profiles_collection()
        profile_doc = await profile_collection.find_one({"user_id": user_id})
        profile_keywords: List[str] = []
        exclusions: List[str] = []
        if profile_doc:
            profile_keywords = [t.lower().strip() for t in profile_doc.get("job_titles", []) if t.strip()]
            exclusions = (profile_doc.get("job_preferences") or {}).get("exclusions", []) or []

        keywords = [kw.lower() for kw in target.keywords] if target.keywords else []
        all_keywords = list(set(keywords + profile_keywords))

        # If the watched company itself matches an exclusion, skip the whole target.
        if is_excluded(exclusions, target.company_name):
            logger.info(f"Skipping target '{target.company_name}' — matches an exclusion term")
            await targets_collection.update_one(
                {"_id": oid}, {"$set": {"last_scraped": now, "updated_at": now}}
            )
            return []

        # 3. Filter by keyword + exclusions, de-dup within this batch by normalized URL.
        # Description/years-of-experience are deferred until we know which
        # candidates are actually new — no point fetching/parsing a posting
        # we've already stored.
        prepared: dict = {}  # dedup_key -> candidate info
        for cand in candidates:
            title = cand["title"]
            url = cand["url"]
            matched = keyword_matches(title, all_keywords)
            if all_keywords and not matched:
                continue
            if is_excluded(exclusions, title, target.company_name, cand.get("location"), url):
                continue
            key = normalize_job_url(url)
            if not key or key in prepared:
                continue
            prepared[key] = {
                "title": title,
                "url": url,
                "location": cand.get("location"),
                "source": cand.get("source", "html"),
                "description": cand.get("description"),
                "matched_keywords": matched,
                "dedup_key": key,
            }

        # 4. One query to find which postings we already have for this target.
        discovered_jobs: List[ScrapedJob] = []
        if prepared:
            existing_keys = set()
            cursor = jobs_collection.find(
                {"target_id": target_id, "user_id": user_id},
                {"dedup_key": 1, "url": 1},
            )
            async for doc in cursor:
                if doc.get("dedup_key"):
                    existing_keys.add(doc["dedup_key"])
                elif doc.get("url"):
                    existing_keys.add(normalize_job_url(doc["url"]))

            new_candidates = [c for key, c in prepared.items() if key not in existing_keys]
            seen_keys = [key for key in prepared if key in existing_keys]

            if new_candidates:
                # Fetch descriptions for postings that don't already have one
                # (HTML-scraped path) — bounded concurrency + cap, see
                # _fetch_missing_descriptions. ATS-sourced ones already have
                # theirs from the API response, so this is a no-op for them.
                await ScraperService._fetch_missing_descriptions(new_candidates)

                new_docs = []
                for cand in new_candidates:
                    description = cand.get("description")
                    yoe = extract_years_experience(description) if description else None
                    loc = cand.get("location")
                    snippet = (
                        extract_description_snippet(description, _DESCRIPTION_SNIPPET_CHARS) if description
                        else (f"{target.company_name} | {loc}" if loc else None)
                    )
                    new_docs.append({
                        "target_id": target_id,
                        "user_id": user_id,
                        "title": cand["title"],
                        "url": cand["url"],
                        "description_snippet": snippet,
                        "matched_keywords": cand["matched_keywords"],
                        "is_new": True,
                        "discovered_at": now,
                        "first_seen": now,
                        "last_seen": now,
                        "dedup_key": cand["dedup_key"],
                        "company": target.company_name,
                        "location": loc,
                        "source": cand.get("source", "html"),
                        "years_experience_min": yoe["min"] if yoe else None,
                        "years_experience_max": yoe["max"] if yoe else None,
                        "years_experience_display": yoe["display"] if yoe else None,
                    })

                result = await jobs_collection.insert_many(new_docs)
                for job, inserted_id in zip(new_docs, result.inserted_ids):
                    job["_id"] = str(inserted_id)
                    discovered_jobs.append(ScrapedJob(**job))

            # Refresh last_seen on postings still present so freshness stays accurate.
            if seen_keys:
                await jobs_collection.update_many(
                    {"target_id": target_id, "user_id": user_id, "dedup_key": {"$in": seen_keys}},
                    {"$set": {"last_seen": now}},
                )

        # 5. Stamp the scrape time.
        await targets_collection.update_one(
            {"_id": oid},
            {"$set": {"last_scraped": now, "updated_at": now}}
        )

        if discovered_jobs:
            try:
                from .notification_service import NotificationService
                job_count = len(discovered_jobs)
                company = target.company_name
                if job_count == 1:
                    title_text = f"New Job at {company}"
                    message_text = f"We found 1 new role matching your preferences: {discovered_jobs[0].title}"
                else:
                    title_text = f"{job_count} New Jobs at {company}"
                    message_text = f"We found {job_count} new roles matching your preferences."
                
                await NotificationService.create_notification(
                    user_id=user_id,
                    title=title_text,
                    message=message_text,
                    type="job_alert"
                )
            except Exception as e:
                logger.error(f"Failed to create notification for scraped jobs: {e}")

        logger.info(f"Scraped {target.company_name}: found {len(discovered_jobs)} new jobs")
        return discovered_jobs

    @staticmethod
    async def get_discovered_jobs(
        user_id: Optional[str] = None,
        target_id: Optional[str] = None,
        page: int = 1,
        limit: int = 10
    ) -> dict:
        """Get all discovered jobs, optionally filtered by target with pagination."""
        collection = get_scraped_jobs_collection()
        query = {}
        if user_id:
            query["user_id"] = user_id

        if target_id:
            if target_id == "general":
                query["target_id"] = {"$regex": "^general_"}
            elif target_id == "targets":
                query["target_id"] = {"$not": {"$regex": "^general_"}, "$ne": "external"}
            else:
                query["target_id"] = target_id

        total = await collection.count_documents(query)
        cursor = collection.find(query).sort("discovered_at", -1).skip((page - 1) * limit).limit(limit)
        jobs = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            jobs.append(ScrapedJob(**doc))

        import math
        pages = math.ceil(total / limit) if limit > 0 else 1

        return {
            "jobs": jobs,
            "total": total,
            "page": page,
            "limit": limit,
            "pages": pages
        }

    @staticmethod
    async def mark_job_read(user_id: str, job_id: str) -> ScrapedJob:
        """Mark a discovered job as read."""
        collection = get_scraped_jobs_collection()
        try:
            oid = ObjectId(job_id)
        except Exception:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid job ID")

        result = await collection.find_one_and_update(
            {"_id": oid, "user_id": user_id},
            {"$set": {"is_new": False}},
            return_document=True,
        )
        if not result:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

        result["_id"] = str(result["_id"])
        return ScrapedJob(**result)

    @staticmethod
    async def list_general_sources() -> List[GeneralScraperSource]:
        """List all general scraper sources."""
        collection = get_general_sources_collection()
        cursor = collection.find({}).sort("created_at", -1)
        sources = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            sources.append(GeneralScraperSource(**doc))
        return sources

    @staticmethod
    async def add_general_source(data: GeneralScraperSourceCreateRequest) -> GeneralScraperSource:
        """Register a new general scraper source."""
        collection = get_general_sources_collection()
        now = datetime.utcnow()

        # Try validating RSS feed immediately upon creation
        is_active = False
        if data.source_type == "rss":
            try:
                async with new_session(timeout=10.0) as client:
                    res = await client.get(data.url)
                    if res.status_code == 200:
                        import xml.etree.ElementTree as ET
                        root = ET.fromstring(res.content)
                        items = root.findall(".//item")
                        if len(items) > 0:
                            is_active = True
                            logger.info(f"Verified RSS feed '{data.name}' works and contains {len(items)} items.")
                        else:
                            logger.warning(f"Verified RSS feed '{data.name}' has 0 items.")
                    else:
                        logger.warning(f"Failed to fetch RSS feed '{data.name}': HTTP status {res.status_code}")
            except Exception as e:
                logger.error(f"Error validating RSS feed URL '{data.url}': {e}")
        else:
            # Presets (LinkedIn, Arbeitnow) default to active
            is_active = True

        doc = {
            "name": data.name,
            "url": data.url,
            "source_type": data.source_type,
            "locations": data.locations,
            "is_active": is_active,
            "created_at": now,
            "updated_at": now,
        }
        result = await collection.insert_one(doc)
        doc["_id"] = str(result.inserted_id)
        logger.info(f"Added general scraper source '{data.name}'")
        return GeneralScraperSource(**doc)

    @staticmethod
    async def update_general_source(
        source_id: str, data: GeneralScraperSourceUpdateRequest
    ) -> GeneralScraperSource:
        """Update a general scraper source."""
        collection = get_general_sources_collection()
        try:
            oid = ObjectId(source_id)
        except Exception:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid source ID")

        existing_doc = await collection.find_one({"_id": oid})
        if not existing_doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source not found")

        update_dict = data.model_dump(exclude_unset=True)

        new_url = update_dict.get("url")
        source_type = existing_doc.get("source_type", "rss")

        # If updating URL for an RSS source, validate it immediately
        if new_url and source_type == "rss":
            is_active = False
            try:
                async with new_session(timeout=10.0) as client:
                    res = await client.get(new_url)
                    if res.status_code == 200:
                        import xml.etree.ElementTree as ET
                        root = ET.fromstring(res.content)
                        items = root.findall(".//item")
                        if len(items) > 0:
                            is_active = True
                            logger.info(f"Verified updated RSS feed URL works and contains {len(items)} items.")
                        else:
                            logger.warning("Updated RSS feed has 0 items.")
                    else:
                        logger.warning(f"Failed to fetch updated RSS feed: HTTP status {res.status_code}")
            except Exception as e:
                logger.error(f"Error validating updated RSS feed URL '{new_url}': {e}")
            
            update_dict["is_active"] = is_active

        update_dict["updated_at"] = datetime.utcnow()

        result = await collection.update_one(
            {"_id": oid},
            {"$set": update_dict}
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source not found")

        doc = await collection.find_one({"_id": oid})
        doc["_id"] = str(doc["_id"])
        return GeneralScraperSource(**doc)

    @staticmethod
    async def remove_general_source(source_id: str) -> bool:
        """Remove a general scraper source."""
        collection = get_general_sources_collection()
        try:
            oid = ObjectId(source_id)
        except Exception:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid source ID")

        result = await collection.delete_one({"_id": oid})
        if result.deleted_count == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source not found")
        logger.info(f"Removed general scraper source {source_id}")
        return True
