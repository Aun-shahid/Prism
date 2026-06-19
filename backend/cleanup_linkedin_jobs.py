"""
Standalone script: Checks every LinkedIn job in the database against applicant counts.
Removes 100+ applicant jobs and adds them to the blacklist.

Usage:
  cd backend
  .\venv\Scripts\Activate.ps1
  python cleanup_linkedin_jobs.py
"""
import asyncio, re, sys, os
from datetime import datetime

# Ensure src is on the path so we can import project modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

import httpx
from bs4 import BeautifulSoup
from motor.motor_asyncio import AsyncIOMotorClient

from config import settings

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}

BATCH_SIZE = 5  # concurrent detail-page fetches


async def get_applicant_count(job_url: str, client: httpx.AsyncClient) -> int | None:
    """Fetch LinkedIn job detail page and return applicant count, or None."""
    try:
        res = await client.get(job_url, headers=HEADERS, follow_redirects=True, timeout=15.0)
        if res.status_code != 200:
            return None
        soup = BeautifulSoup(res.text, "html.parser")
        caption = soup.select_one(".num-applicants__caption")
        if not caption:
            return None
        text = caption.get_text(strip=True)
        match = re.search(r'([\d,]+)', text)
        if match:
            return int(match.group(1).replace(',', ''))
        return None
    except Exception:
        return None


async def main():
    # Connect to MongoDB
    client_mongo = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client_mongo[settings.DATABASE_NAME]
    jobs_col = db["scraped_jobs"]
    blacklist_col = db["blacklisted_jobs"]

    # Find all LinkedIn-sourced jobs (from both preset_linkedin and general_linkedin sources)
    cursor = jobs_col.find({
        "target_id": {"$regex": "^general_linkedin", "$options": "i"}
    })
    all_jobs = await cursor.to_list(None)
    total = len(all_jobs)
    print(f"Found {total} LinkedIn-sourced jobs in the database.\n")

    if total == 0:
        print("Nothing to clean up.")
        return

    removed = 0
    kept = 0
    blacklisted = 0
    errors = 0
    skipped_no_count = 0

    sem = asyncio.Semaphore(BATCH_SIZE)

    async def process_job(job) -> str | None:
        """Returns 'remove' | 'keep' | 'error' | 'no_count'."""
        url = job.get("url", "")
        title = job.get("title", "Unknown")
        job_id = job.get("_id")
        if not url:
            return "error"

        async with httpx.AsyncClient(timeout=15.0) as client:
            count = await get_applicant_count(url, client)

        if count is None:
            return "no_count"

        if count >= 100:
            # Remove from scraped_jobs
            await jobs_col.delete_one({"_id": job_id})
            # Add to blacklist
            await blacklist_col.update_one(
                {"url": url},
                {"$set": {
                    "url": url,
                    "title": title,
                    "company": job.get("description_snippet", "").split(" | ")[0] if job.get("description_snippet") else "",
                    "reason": f"{count} applicants",
                    "blacklisted_at": datetime.utcnow(),
                }},
                upsert=True,
            )
            print(f"  REMOVED  {title[:60]:60s}  ({count} applicants)")
            return "remove"
        else:
            print(f"  KEPT     {title[:60]:60s}  ({count} applicants)")
            return "keep"

    # Process in batches
    print(f"Processing up to {BATCH_SIZE} jobs concurrently...\n")

    for i in range(0, total, BATCH_SIZE):
        batch = all_jobs[i:i + BATCH_SIZE]
        tasks = [process_job(job) for job in batch]
        results = await asyncio.gather(*tasks)

        for r in results:
            if r == "remove":
                removed += 1
            elif r == "keep":
                kept += 1
            elif r == "no_count":
                skipped_no_count += 1
            else:
                errors += 1

        # Progress
        done = min(i + BATCH_SIZE, total)
        print(f"\n  Progress: {done}/{total}  "
              f"(removed={removed}, kept={kept}, no_count={skipped_no_count}, errors={errors})\n")

    # Summary
    print("=" * 60)
    print("  DONE!")
    print(f"  Total LinkedIn jobs scanned:  {total}")
    print(f"  Removed (100+ applicants):    {removed}")
    print(f"  Kept (< 100 applicants):      {kept}")
    print(f"  Kept (no count info found):   {skipped_no_count}")
    print(f"  Errors:                       {errors}")
    print(f"  Blacklist entries added:      {removed}")
    print("=" * 60)

    client_mongo.close()


if __name__ == "__main__":
    asyncio.run(main())
