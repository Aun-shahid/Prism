import re
import xml.etree.ElementTree as ET
from datetime import datetime
from typing import List, Optional
from bson import ObjectId
from fastapi import HTTPException, status
import httpx
from bs4 import BeautifulSoup

from ..database import (
    get_scraped_jobs_collection,
    get_profiles_collection,
    get_general_sources_collection,
)
from ..models.scraper import ScrapedJob
from ..models.general_sources import GeneralScraperSource
from .logging_service import get_logger

logger = get_logger("general_scraper_service")

# Browser headers to avoid scraper blocks
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}


class GeneralScraperService:

    @staticmethod
    async def fetch_linkedin_jobs(keyword: str, locations: List[str] = []) -> List[dict]:
        """Crawl LinkedIn guest search for job postings restricting by locations."""
        jobs = []
        # If no locations configured, query just the keyword
        queries = [keyword]
        if locations:
            queries = [f"{keyword} {loc}" for loc in locations]

        async with httpx.AsyncClient(timeout=15.0) as client:
            for query in queries:
                url = f"https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords={query}"
                try:
                    res = await client.get(url, headers=HEADERS)
                    if res.status_code != 200:
                        logger.warning(f"LinkedIn guest search for '{query}' returned status {res.status_code}. Deactivating source.")
                        try:
                            sources_col = get_general_sources_collection()
                            await sources_col.update_many(
                                {"source_type": "preset_linkedin"},
                                {"$set": {"is_active": False, "updated_at": datetime.utcnow()}}
                            )
                        except Exception as db_err:
                            logger.error(f"Failed to deactivate LinkedIn source in DB: {db_err}")
                        continue
                    
                    # Ensure active in DB
                    try:
                        sources_col = get_general_sources_collection()
                        await sources_col.update_many(
                            {"source_type": "preset_linkedin"},
                            {"$set": {"is_active": True, "updated_at": datetime.utcnow()}}
                        )
                    except Exception as db_err:
                        logger.error(f"Failed to activate LinkedIn source in DB: {db_err}")

                    soup = BeautifulSoup(res.text, "html.parser")
                    cards = soup.select("li")
                    for card in cards:
                        title_elem = card.select_one(".base-search-card__title")
                        company_elem = card.select_one(".base-search-card__subtitle")
                        location_elem = card.select_one(".job-search-card__location")
                        link_elem = card.select_one(".base-card__full-link")

                        if title_elem and link_elem:
                            title = title_elem.get_text(strip=True)
                            company = company_elem.get_text(strip=True) if company_elem else "Company"
                            location = location_elem.get_text(strip=True) if location_elem else "Remote"
                            link = link_elem.get("href", "")
                            
                            jobs.append({
                                "title": title,
                                "url": link,
                                "description_snippet": f"{company} | Location: {location}",
                            })
                except Exception as e:
                    logger.error(f"Failed to crawl LinkedIn guest jobs for '{query}': {e}. Deactivating source.")
                    try:
                        sources_col = get_general_sources_collection()
                        await sources_col.update_many(
                            {"source_type": "preset_linkedin"},
                            {"$set": {"is_active": False, "updated_at": datetime.utcnow()}}
                        )
                    except Exception as db_err:
                        logger.error(f"Failed to deactivate LinkedIn source in DB: {db_err}")
        return jobs

    @staticmethod
    async def fetch_wwr_jobs(keyword: str, locations: List[str] = []) -> List[dict]:
        """Fetch and parse We Work Remotely programming RSS feed."""
        url = "https://weworkremotely.com/categories/remote-programming-jobs.rss"
        return await GeneralScraperService.fetch_rss_jobs(url, keyword, locations, source_name="We Work Remotely")

    @staticmethod
    async def fetch_remoteok_jobs(keyword: str, locations: List[str] = []) -> List[dict]:
        """Fetch and parse RemoteOK RSS feed."""
        url = "https://remoteok.com/remote-jobs.rss"
        return await GeneralScraperService.fetch_rss_jobs(url, keyword, locations, source_name="RemoteOK")

    @staticmethod
    async def fetch_arbeitnow_jobs(keyword: str, locations: List[str] = []) -> List[dict]:
        """Fetch Arbeitnow JSON API and filter by keyword and locations."""
        url = "https://www.arbeitnow.com/api/job-board-api"
        jobs = []
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.get(url, headers=HEADERS)
                if res.status_code != 200:
                    logger.warning(f"Failed to fetch Arbeitnow JSON API: HTTP status {res.status_code}. Deactivating source.")
                    try:
                        sources_col = get_general_sources_collection()
                        await sources_col.update_many(
                            {"source_type": "preset_arbeitnow"},
                            {"$set": {"is_active": False, "updated_at": datetime.utcnow()}}
                        )
                    except Exception as db_err:
                        logger.error(f"Failed to deactivate Arbeitnow source in DB: {db_err}")
                    return []

                # Ensure active in DB
                try:
                    sources_col = get_general_sources_collection()
                    await sources_col.update_many(
                        {"source_type": "preset_arbeitnow"},
                        {"$set": {"is_active": True, "updated_at": datetime.utcnow()}}
                    )
                except Exception as db_err:
                    logger.error(f"Failed to activate Arbeitnow source in DB: {db_err}")

                data = res.json().get("data", [])
                keyword_lower = keyword.lower()
                for item in data:
                    title = item.get("title", "")
                    company = item.get("company_name", "")
                    location = item.get("location", "")
                    url_link = item.get("url", "")
                    tags = [t.lower() for t in item.get("tags", [])]
                    
                    # Match keyword in title, company or tags
                    keyword_match = (keyword_lower in title.lower() or 
                                     keyword_lower in company.lower() or 
                                     any(keyword_lower in t for t in tags))
                    if not keyword_match:
                        continue

                    # Check location constraint
                    location_match = True
                    if locations:
                        text_to_check = f"{title} {location} {company}".lower()
                        location_match = (
                            "remote" in text_to_check or 
                            "worldwide" in text_to_check or 
                            "anywhere" in text_to_check or 
                            any(re.search(r'\b' + re.escape(loc.lower()) + r'\b', text_to_check) for loc in locations)
                        )
                    
                    if location_match:
                        jobs.append({
                            "title": title,
                            "url": url_link,
                            "description_snippet": f"{company} | Location: {location}",
                        })
        except Exception as e:
            logger.error(f"Failed to fetch Arbeitnow JSON API: {e}. Deactivating source.")
            try:
                sources_col = get_general_sources_collection()
                await sources_col.update_many(
                    {"source_type": "preset_arbeitnow"},
                    {"$set": {"is_active": False, "updated_at": datetime.utcnow()}}
                )
            except Exception as db_err:
                logger.error(f"Failed to deactivate Arbeitnow source in DB: {db_err}")
        return jobs

    @staticmethod
    async def fetch_rss_jobs(url: str, keyword: str, locations: List[str] = [], source_name: str = "RSS Feed") -> List[dict]:
        """Generic RSS feed parser that filters items by search keyword and locations."""
        jobs = []
        try:
            async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
                res = await client.get(url, headers=HEADERS)
                if res.status_code != 200:
                    logger.warning(f"Failed to fetch RSS feed {url}: HTTP status {res.status_code}. Deactivating source.")
                    try:
                        sources_col = get_general_sources_collection()
                        await sources_col.update_many({"url": url}, {"$set": {"is_active": False, "updated_at": datetime.utcnow()}})
                    except Exception as db_err:
                        logger.error(f"Failed to deactivate source on HTTP error in DB: {db_err}")
                    return []
                
                # Parse XML tree
                root = ET.fromstring(res.content)

                # Successfully parsed, let's ensure it's marked active in DB
                try:
                    sources_col = get_general_sources_collection()
                    await sources_col.update_many({"url": url}, {"$set": {"is_active": True, "updated_at": datetime.utcnow()}})
                except Exception as db_err:
                    logger.error(f"Failed to activate source in DB: {db_err}")

                keyword_lower = keyword.lower()
                for item in root.findall(".//item"):
                    title_elem = item.find("title")
                    link_elem = item.find("link")
                    desc_elem = item.find("description")

                    title = title_elem.text if title_elem is not None else ""
                    link = link_elem.text if link_elem is not None else ""
                    desc = desc_elem.text if desc_elem is not None else ""

                    # Check for keyword match in title or description
                    keyword_match = keyword_lower in title.lower() or keyword_lower in desc.lower()
                    if not keyword_match:
                        continue

                    # Check location constraint
                    location_match = True
                    if locations:
                        text_to_check = f"{title} {desc}".lower()
                        location_match = (
                            "remote" in text_to_check or 
                            "worldwide" in text_to_check or 
                            "anywhere" in text_to_check or 
                            any(re.search(r'\b' + re.escape(loc.lower()) + r'\b', text_to_check) for loc in locations)
                        )

                    if location_match:
                        # Clean HTML from description snippet if needed
                        snippet = BeautifulSoup(desc[:200], "html.parser").get_text() if desc else ""
                        snippet = f"{source_name} | {snippet.strip()}"
                        jobs.append({
                            "title": title,
                            "url": link,
                            "description_snippet": snippet[:250],
                        })
        except Exception as e:
            logger.error(f"Failed to parse RSS feed from {url}: {e}. Deactivating source.")
            try:
                sources_col = get_general_sources_collection()
                await sources_col.update_many({"url": url}, {"$set": {"is_active": False, "updated_at": datetime.utcnow()}})
            except Exception as db_err:
                logger.error(f"Failed to deactivate source on parsing error in DB: {db_err}")
        return jobs

    @staticmethod
    async def scrape_single_source_for_user(user_id: str, source_id: str) -> List[ScrapedJob]:
        """Scrape a single general source manually for a specific user."""
        sources_col = get_general_sources_collection()
        jobs_col = get_scraped_jobs_collection()
        profiles_col = get_profiles_collection()

        try:
            oid = ObjectId(source_id)
        except Exception:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid source ID")

        source_doc = await sources_col.find_one({"_id": oid})
        if not source_doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scraper source not found")

        source_doc["_id"] = str(source_doc["_id"])
        source = GeneralScraperSource(**source_doc)
        
        # Get user's search queries (job titles)
        profile = await profiles_col.find_one({"user_id": user_id})
        keywords = []
        if profile and profile.get("job_titles"):
            keywords = [t.strip() for t in profile["job_titles"] if t.strip()]

        if not keywords:
            keywords = ["Software Engineer", "Developer"]

        discovered_jobs = []
        now = datetime.utcnow()

        for keyword in keywords:
            raw_jobs = []
            if source.source_type == "preset_linkedin":
                raw_jobs = await GeneralScraperService.fetch_linkedin_jobs(keyword, source.locations)
            elif source.source_type == "preset_arbeitnow":
                raw_jobs = await GeneralScraperService.fetch_arbeitnow_jobs(keyword, source.locations)
            elif source.source_type == "rss":
                raw_jobs = await GeneralScraperService.fetch_rss_jobs(source.url, keyword, source.locations, source.name)

            for rj in raw_jobs:
                existing = await jobs_col.find_one({
                    "user_id": user_id,
                    "url": rj["url"],
                })
                if existing:
                    continue

                job_doc = {
                    "target_id": f"general_{source.name.lower().replace(' ', '_')}",
                    "user_id": user_id,
                    "title": rj["title"],
                    "url": rj["url"],
                    "description_snippet": rj["description_snippet"],
                    "matched_keywords": [keyword.lower()],
                    "is_new": True,
                    "discovered_at": now,
                }
                result = await jobs_col.insert_one(job_doc)
                job_doc["_id"] = str(result.inserted_id)
                discovered_jobs.append(ScrapedJob(**job_doc))

        logger.info(f"Manual scrape of {source.name} complete: found {len(discovered_jobs)} new jobs for user {user_id}")
        return discovered_jobs

    @staticmethod
    async def scrape_and_cache_general_jobs():
        """
        Background scheduler task: Runs search queries for unique keywords gathered
        from active profiles, queries general feeds with location targeting, and maps results to users.
        """
        sources_col = get_general_sources_collection()
        profiles_col = get_profiles_collection()
        jobs_col = get_scraped_jobs_collection()

        # Get all active sources
        active_sources = []
        cursor = sources_col.find({"is_active": True})
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            active_sources.append(GeneralScraperSource(**doc))

        if not active_sources:
            logger.info("No active general scraper sources found. Skipping sweep.")
            return

        # Map profiles to gather keywords and user IDs
        user_keywords_map = {}
        unique_keywords = set()
        
        async for profile in profiles_col.find({}):
            user_id = profile["user_id"]
            titles = profile.get("job_titles", [])
            user_kws = [t.strip().lower() for t in titles if t.strip()]
            if user_kws:
                user_keywords_map[user_id] = user_kws
                for kw in user_kws:
                    unique_keywords.add(kw)

        if not unique_keywords:
            logger.info("No job titles configured in user profiles. Skipping sweep.")
            return

        logger.info(f"Starting general scrape sweep for {len(unique_keywords)} unique keywords across {len(user_keywords_map)} users...")
        now = datetime.utcnow()

        # Fetch for each unique keyword
        for keyword in unique_keywords:
            # Query all active scraper sources for this keyword
            keyword_results = []
            for source in active_sources:
                raw_jobs = []
                if source.source_type == "preset_linkedin":
                    raw_jobs = await GeneralScraperService.fetch_linkedin_jobs(keyword, source.locations)
                elif source.source_type == "preset_arbeitnow":
                    raw_jobs = await GeneralScraperService.fetch_arbeitnow_jobs(keyword, source.locations)
                elif source.source_type == "rss":
                    raw_jobs = await GeneralScraperService.fetch_rss_jobs(source.url, keyword, source.locations, source.name)
                
                for rj in raw_jobs:
                    rj["target_id"] = f"general_{source.name.lower().replace(' ', '_')}"
                    keyword_results.append(rj)

            # Propagate matching jobs to all users searching for this keyword
            for user_id, user_kws in user_keywords_map.items():
                if keyword in user_kws:
                    for rj in keyword_results:
                        existing = await jobs_col.find_one({
                            "user_id": user_id,
                            "url": rj["url"],
                        })
                        if existing:
                            continue

                        job_doc = {
                            "target_id": rj["target_id"],
                            "user_id": user_id,
                            "title": rj["title"],
                            "url": rj["url"],
                            "description_snippet": rj["description_snippet"],
                            "matched_keywords": [keyword],
                            "is_new": True,
                            "discovered_at": now,
                        }
                        await jobs_col.insert_one(job_doc)

        logger.info("General scrape sweep successfully completed.")
