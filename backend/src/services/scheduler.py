import asyncio
from datetime import datetime, timedelta
from ..database import (
    get_general_sources_collection,
    get_scraper_targets_collection,
    get_scraped_jobs_collection,
)
from .scraper_service import ScraperService
from .general_scraper_service import GeneralScraperService
from .logging_service import get_logger

logger = get_logger("scheduler")

# Intervals in seconds
TARGET_SCRAPE_INTERVAL = 4 * 60 * 60    # Every 4 hours
GENERAL_SCRAPE_INTERVAL = 8 * 60 * 60   # Every 8 hours
CLEANUP_INTERVAL = 24 * 60 * 60          # Every 24 hours


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
    """Delete scraped jobs older than 45 days."""
    logger.info("Running job cleanup sweep...")
    col = get_scraped_jobs_collection()
    limit_date = datetime.utcnow() - timedelta(days=45)
    result = await col.delete_many({"discovered_at": {"$lt": limit_date}})
    logger.info(f"Cleanup complete: deleted {result.deleted_count} jobs older than 45 days.")


async def run_target_scrapers():
    """Scan and crawl all active company career page targets."""
    logger.info("Running periodic company target career page scrapes...")
    col = get_scraper_targets_collection()
    cursor = col.find({"is_active": True})
    
    count = 0
    async for doc in cursor:
        try:
            user_id = doc["user_id"]
            target_id = str(doc["_id"])
            await ScraperService.scrape_target(user_id, target_id)
            count += 1
        except Exception as e:
            logger.error(f"Periodic scrape failed for target {doc.get('company_name')} ({doc.get('_id')}): {e}")
            
    logger.info(f"Finished periodic company career page scrapes. Scraped {count} targets.")


async def run_background_scheduler():
    """Main scheduler loop."""
    logger.info("Starting background scheduler...")
    
    # Wait for MongoDB connection and server startup (10s warmup)
    await asyncio.sleep(10)
    
    try:
        await seed_default_sources_if_empty()
    except Exception as e:
        logger.error(f"Failed to seed default sources: {e}")

    # Immediately trigger initial sweeps on startup so users see data
    logger.info("Triggering initial scraper runs...")
    try:
        await run_target_scrapers()
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
