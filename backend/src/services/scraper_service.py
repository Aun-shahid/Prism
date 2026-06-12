import re
from datetime import datetime
from typing import List, Optional
from bson import ObjectId
from fastapi import HTTPException, status
import httpx
from bs4 import BeautifulSoup

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
)
from ..models.general_sources import (
    GeneralScraperSource,
    GeneralScraperSourceCreateRequest,
    GeneralScraperSourceUpdateRequest,
)
from .logging_service import get_logger

logger = get_logger("scraper_service")

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
            "created_at": now,
            "updated_at": now,
        }
        result = await collection.insert_one(doc)
        doc["_id"] = str(result.inserted_id)
        logger.info(f"Added scraper target '{data.company_name}' for user {user_id}")
        return ScraperTarget(**doc)

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
    async def scrape_target(user_id: str, target_id: str) -> List[ScrapedJob]:
        """Scrape a single target for job listings matching keywords."""
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

        # Fetch the page
        try:
            async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as client:
                response = await client.get(
                    target.career_url,
                    headers={
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                    }
                )
                response.raise_for_status()
        except httpx.HTTPError as e:
            logger.error(f"Failed to fetch {target.career_url}: {e}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Failed to fetch career page: {str(e)}"
            )

        soup = BeautifulSoup(response.text, "html.parser")
        discovered_jobs = []

        # Extract job-related links
        found_links = set()
        for pattern in JOB_LINK_PATTERNS:
            try:
                for link in soup.select(pattern):
                    href = link.get("href", "")
                    text = link.get_text(strip=True)
                    if text and href and len(text) > 3:
                        # Normalise relative URLs
                        if href.startswith("/"):
                            from urllib.parse import urljoin
                            href = urljoin(target.career_url, href)
                        found_links.add((text, href))
            except Exception:
                continue

        # Also scan all links on the page if nothing was found with patterns
        if not found_links:
            for link in soup.find_all("a", href=True):
                text = link.get_text(strip=True)
                href = link["href"]
                if text and len(text) > 5:
                    if href.startswith("/"):
                        from urllib.parse import urljoin
                        href = urljoin(target.career_url, href)
                    found_links.add((text, href))

        # Match against keywords combined with user's target job titles from their profile
        profile_collection = get_profiles_collection()
        profile_doc = await profile_collection.find_one({"user_id": user_id})
        profile_keywords = []
        if profile_doc and profile_doc.get("job_titles"):
            profile_keywords = [t.lower().strip() for t in profile_doc["job_titles"] if t.strip()]

        keywords = [kw.lower() for kw in target.keywords] if target.keywords else []
        all_keywords = list(set(keywords + profile_keywords))
        
        now = datetime.utcnow()

        for title, url in found_links:
            title_lower = title.lower()
            matched = [kw for kw in all_keywords if kw in title_lower] if all_keywords else []

            # If filtering keywords are active, only include matching job titles/terms
            if all_keywords and not matched:
                continue

            # Check if this job already exists for this target
            existing = await jobs_collection.find_one({
                "target_id": target_id,
                "user_id": user_id,
                "title": title,
                "url": url,
            })
            if existing:
                continue

            job_doc = {
                "target_id": target_id,
                "user_id": user_id,
                "title": title,
                "url": url,
                "description_snippet": None,
                "matched_keywords": matched,
                "is_new": True,
                "discovered_at": now,
            }
            result = await jobs_collection.insert_one(job_doc)
            job_doc["_id"] = str(result.inserted_id)
            discovered_jobs.append(ScrapedJob(**job_doc))

        # Update last_scraped timestamp
        await targets_collection.update_one(
            {"_id": oid},
            {"$set": {"last_scraped": now, "updated_at": now}}
        )

        logger.info(f"Scraped {target.company_name}: found {len(discovered_jobs)} new jobs")
        return discovered_jobs

    @staticmethod
    async def get_discovered_jobs(
        user_id: str, target_id: Optional[str] = None
    ) -> List[ScrapedJob]:
        """Get all discovered jobs, optionally filtered by target."""
        collection = get_scraped_jobs_collection()
        query = {"user_id": user_id}
        if target_id:
            query["target_id"] = target_id

        cursor = collection.find(query).sort("discovered_at", -1)
        jobs = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            jobs.append(ScrapedJob(**doc))
        return jobs

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
        doc = {
            "name": data.name,
            "url": data.url,
            "source_type": data.source_type,
            "is_active": True,
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

        update_dict = data.model_dump(exclude_unset=True)
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
