import asyncio
import random
from datetime import datetime, timedelta
from ..config import settings
from ..database import (
    get_general_sources_collection,
    get_scraper_targets_collection,
    get_scraped_jobs_collection,
)
from .scraper_service import ScraperService
from .general_scraper_service import GeneralScraperService
from .logging_service import get_logger

logger = get_logger("scheduler")

# Intervals in seconds. Driven by the single SCRAPER_INTERVAL_HOURS config knob so
# operators can tune cadence without editing code. General feeds run half as often
# as per-company targets (they change less per-user and are heavier to sweep).
_INTERVAL_HOURS = max(1, settings.SCRAPER_INTERVAL_HOURS)
TARGET_SCRAPE_INTERVAL = _INTERVAL_HOURS * 60 * 60
GENERAL_SCRAPE_INTERVAL = _INTERVAL_HOURS * 2 * 60 * 60
CLEANUP_INTERVAL = 24 * 60 * 60          # Every 24 hours

JOB_RETENTION_DAYS = 45                  # delete discovered jobs older than this
STALE_NEW_DAYS = 14                      # stop flagging a job "new" after this many days
TARGET_SCRAPE_CONCURRENCY = 5            # how many company pages to scrape at once


async def ensure_indexes():
    """Create the indexes the scraper relies on. Idempotent — safe every startup."""
    jobs = get_scraped_jobs_collection()
    targets = get_scraper_targets_collection()
    try:
        await jobs.create_index([("user_id", 1), ("target_id", 1), ("dedup_key", 1)])
        await jobs.create_index([("user_id", 1), ("discovered_at", -1)])
        await jobs.create_index([("discovered_at", 1)])
        await targets.create_index([("user_id", 1), ("is_active", 1)])
        logger.info("Scraper indexes ensured.")
    except Exception as e:
        logger.error(f"Failed to ensure scraper indexes: {e}")


async def seed_default_sources_if_empty():
    """Seed default platforms into general_scraper_sources if the collection is empty."""
    col = get_general_sources_collection()
    count = await col.count_documents({})
    if count == 0:
        logger.info("Seeding default general job scraper sources...")
        now = datetime.utcnow()
        default_sources = [
            {
                "name": "LinkedIn",
                "url": "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search",
                "source_type": "preset_linkedin",
                "locations": ["United Kingdom"],
                "is_active": True,
                "created_at": now,
                "updated_at": now,
            },
            {
                "name": "We Work Remotely",
                "url": "https://weworkremotely.com/categories/remote-programming-jobs.rss",
                "source_type": "rss",
                "locations": ["United Kingdom"],
                "is_active": True,
                "created_at": now,
                "updated_at": now,
            },
            {
                "name": "RemoteOK",
                "url": "https://remoteok.com/remote-jobs.rss",
                "source_type": "rss",
                "locations": ["United Kingdom"],
                "is_active": True,
                "created_at": now,
                "updated_at": now,
            },
            {
                "name": "Arbeitnow",
                "url": "https://www.arbeitnow.com/api/job-board-api",
                "source_type": "preset_arbeitnow",
                "locations": ["United Kingdom"],
                "is_active": True,
                "created_at": now,
                "updated_at": now,
            },
        ]
        await col.insert_many(default_sources)
        logger.info("Default scraper sources successfully seeded!")


async def cleanup_old_jobs():
    """Delete very old scraped jobs and age out the 'new' flag on stale ones."""
    logger.info("Running job cleanup sweep...")
    col = get_scraped_jobs_collection()
    now = datetime.utcnow()

    limit_date = now - timedelta(days=JOB_RETENTION_DAYS)
    deleted = await col.delete_many({"discovered_at": {"$lt": limit_date}})

    stale_date = now - timedelta(days=STALE_NEW_DAYS)
    aged = await col.update_many(
        {"is_new": True, "discovered_at": {"$lt": stale_date}},
        {"$set": {"is_new": False}},
    )
    logger.info(
        f"Cleanup complete: deleted {deleted.deleted_count} jobs older than "
        f"{JOB_RETENTION_DAYS} days; un-flagged {aged.modified_count} stale 'new' jobs."
    )


async def run_target_scrapers(respect_interval: bool = True):
    """Scan all active company career-page targets concurrently.

    When `respect_interval` is True (the periodic path), targets scraped within
    the last interval — e.g. by a manual scan — are skipped so we don't re-crawl
    them needlessly. The startup sweep passes False to refresh everything once.
    """
    logger.info("Running periodic company target career page scrapes...")
    col = get_scraper_targets_collection()
    now = datetime.utcnow()
    cutoff = now - timedelta(seconds=TARGET_SCRAPE_INTERVAL - 300)  # 5-min slack

    due = []
    async for doc in col.find({"is_active": True}):
        last = doc.get("last_scraped")
        if respect_interval and last and last > cutoff:
            continue  # recently scraped — leave it for next cycle
        due.append(doc)

    if not due:
        logger.info("No company targets due for scraping this cycle.")
        return

    sem = asyncio.Semaphore(TARGET_SCRAPE_CONCURRENCY)

    async def _scrape(doc) -> bool:
        async with sem:
            # Small jitter so we don't fire dozens of requests at the same instant.
            await asyncio.sleep(random.uniform(0, 2))
            try:
                await ScraperService.scrape_target(doc["user_id"], str(doc["_id"]))
                return True
            except Exception as e:
                logger.error(
                    f"Periodic scrape failed for target {doc.get('company_name')} "
                    f"({doc.get('_id')}): {e}"
                )
                return False

    results = await asyncio.gather(*[_scrape(d) for d in due])
    count = sum(1 for r in results if r)
    logger.info(f"Finished periodic company career page scrapes. Scraped {count}/{len(due)} targets.")


async def run_background_scheduler():
    """Main scheduler loop."""
    logger.info("Starting background scheduler...")

    # Wait for MongoDB connection and server startup (10s warmup)
    await asyncio.sleep(10)

    try:
        await ensure_indexes()
    except Exception as e:
        logger.error(f"Failed to ensure indexes: {e}")

    try:
        await seed_default_sources_if_empty()
    except Exception as e:
        logger.error(f"Failed to seed default sources: {e}")

    # Immediately trigger initial sweeps on startup so users see data.
    logger.info("Triggering initial scraper runs...")
    try:
        await run_target_scrapers(respect_interval=False)
    except Exception as e:
        logger.error(f"Initial company targets scrape failed: {e}")

    try:
        await GeneralScraperService.scrape_and_cache_general_jobs()
    except Exception as e:
        logger.error(f"Initial general platforms sweep failed: {e}")

    try:
        await cleanup_old_jobs()
    except Exception as e:
        logger.error(f"Initial old jobs cleanup failed: {e}")

    target_timer = 0
    general_timer = 0
    cleanup_timer = 0

    tick = 60  # Check every 60 seconds

    while True:
        await asyncio.sleep(tick)
        target_timer += tick
        general_timer += tick
        cleanup_timer += tick

        if target_timer >= TARGET_SCRAPE_INTERVAL:
            target_timer = 0
            try:
                await run_target_scrapers()
            except Exception as e:
                logger.error(f"Background target scrape failed: {e}")

        if general_timer >= GENERAL_SCRAPE_INTERVAL:
            general_timer = 0
            try:
                await GeneralScraperService.scrape_and_cache_general_jobs()
            except Exception as e:
                logger.error(f"Background general scrape sweep failed: {e}")

        if cleanup_timer >= CLEANUP_INTERVAL:
            cleanup_timer = 0
            try:
                await cleanup_old_jobs()
            except Exception as e:
                logger.error(f"Background cleanup task failed: {e}")
