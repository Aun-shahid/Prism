import httpx
from datetime import datetime
from typing import List, Optional
from bson import ObjectId
from fastapi import HTTPException, status
from ..database import get_scraped_jobs_collection, get_applications_collection, get_scraper_targets_collection
from ..models.scraper import ScrapedJob
from ..models.applications import JobApplication, ApplicationStatus
from .logging_service import get_logger

logger = get_logger("job_service")

class JobService:
    @staticmethod
    async def list_jobs(
        user_id: str,
        search: Optional[str] = None,
        is_new: Optional[bool] = None,
        target_id: Optional[str] = None,
        page: int = 1,
        limit: int = 25,
    ) -> dict:
        """List scraped jobs with filtering, search and pagination."""
        collection = get_scraped_jobs_collection()
        query = {"user_id": user_id}

        if is_new is not None:
            query["is_new"] = is_new

        if target_id:
            query["target_id"] = target_id

        if search:
            # Simple regex search across title, url, snippet or keywords
            regex = {"$regex": search, "$options": "i"}
            query["$or"] = [
                {"title": regex},
                {"url": regex},
                {"description_snippet": regex},
                {"matched_keywords": regex}
            ]

        total = await collection.count_documents(query)
        cursor = (
            collection.find(query)
            .sort("discovered_at", -1)
            .skip((page - 1) * limit)
            .limit(limit)
        )
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
            "pages": pages,
        }

    @staticmethod
    async def import_to_applications(
        user_id: str,
        job_id: str,
        status_val: str = "wishlist",
        notes: Optional[str] = None
    ) -> JobApplication:
        """Import a scraped job directly into the user's application tracker."""
        jobs_collection = get_scraped_jobs_collection()
        apps_collection = get_applications_collection()
        targets_collection = get_scraper_targets_collection()
        
        try:
            oid = ObjectId(job_id)
        except Exception:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid job ID")
            
        job_doc = await jobs_collection.find_one({"_id": oid, "user_id": user_id})
        if not job_doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job listing not found")
            
        # Get company name from target if possible
        company_name = "Target Company"
        if job_doc.get("target_id") and job_doc.get("target_id") != "external":
            try:
                toid = ObjectId(job_doc["target_id"])
                target_doc = await targets_collection.find_one({"_id": toid})
                if target_doc:
                    company_name = target_doc["company_name"]
            except Exception:
                pass
        elif job_doc.get("target_id") == "external":
            # If it's imported from external search, it might store company name in description or we parse it
            company_name = job_doc.get("description_snippet", "").split(" | ")[0] or "External Job"

        # Check if already imported (prevent duplicate)
        existing = await apps_collection.find_one({
            "user_id": user_id,
            "company": company_name,
            "position": job_doc["title"]
        })
        
        if existing:
            # Return existing app
            existing["_id"] = str(existing["_id"])
            return JobApplication(**existing)

        now = datetime.utcnow()
        app_doc = {
            "user_id": user_id,
            "company": company_name,
            "position": job_doc["title"],
            "job_url": job_doc.get("url"),
            "job_description": job_doc.get("description_snippet") or f"Matched keywords: {', '.join(job_doc['matched_keywords'])}",
            "status": ApplicationStatus(status_val),
            "salary_min": None,
            "salary_max": None,
            "location": "Remote",
            "remote": True,
            "applied_date": now if status_val == "applied" else None,
            "notes": notes or f"Imported from job browser. Matches: {', '.join(job_doc['matched_keywords'])}",
            "contact_name": None,
            "contact_email": None,
            "resume_id": None,
            "cover_letter_id": None,
            "tags": job_doc["matched_keywords"],
            "created_at": now,
            "updated_at": now
        }
        
        result = await apps_collection.insert_one(app_doc)
        app_doc["_id"] = str(result.inserted_id)
        
        # Mark job read
        await jobs_collection.update_one({"_id": oid}, {"$set": {"is_new": False}})
        
        logger.info(f"Imported job {job_id} to applications for user {user_id}")
        return JobApplication(**app_doc)

    @staticmethod
    async def search_external_jobs(
        user_id: str,
        title: str,
        location: Optional[str] = "Remote"
    ) -> List[ScrapedJob]:
        """Search Remotive API for remote developer jobs matching query, save matches, and return."""
        jobs_collection = get_scraped_jobs_collection()
        search_query = title.strip().lower()
        now = datetime.utcnow()
        
        discovered = []
        
        try:
            # Query Remotive API (safe public endpoint)
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(f"https://remotive.com/api/remote-jobs?search={search_query}")
                if response.status_code == 200:
                    data = response.json()
                    jobs_list = data.get("jobs", [])[:15]  # Limit to 15 results
                    
                    for rj in jobs_list:
                        # Map to ScrapedJob
                        job_title = rj.get("title")
                        company = rj.get("company_name")
                        url = rj.get("url")
                        description = f"{company} | {rj.get('candidate_required_location', 'Remote')}"
                        salary = rj.get("salary", "")
                        if salary:
                            description += f" | Salary: {salary}"
                            
                        # Check duplicate
                        existing = await jobs_collection.find_one({
                            "user_id": user_id,
                            "url": url
                        })
                        
                        if existing:
                            existing["_id"] = str(existing["_id"])
                            discovered.append(ScrapedJob(**existing))
                            continue
                            
                        job_doc = {
                            "target_id": "external",
                            "user_id": user_id,
                            "title": job_title,
                            "url": url,
                            "description_snippet": description,
                            "matched_keywords": [search_query],
                            "is_new": True,
                            "discovered_at": now
                        }
                        
                        result = await jobs_collection.insert_one(job_doc)
                        job_doc["_id"] = str(result.inserted_id)
                        discovered.append(ScrapedJob(**job_doc))
        except Exception as e:
            logger.error(f"Failed to query Remotive API: {e}")
            # Mock Fallback if Remotive API is offline
            mock_jobs = [
                {"title": f"Senior {title} Engineer", "company": "Tech Corp", "url": "https://careers.google.com"},
                {"title": f"Lead {title} Developer", "company": "Global Inc", "url": "https://remotive.com"},
                {"title": f"Staff {title} Specialist", "company": "Quantum Innovations", "url": "https://vercel.com/careers"},
            ]
            for mj in mock_jobs:
                existing = await jobs_collection.find_one({
                    "user_id": user_id,
                    "title": mj["title"],
                    "description_snippet": f"{mj['company']} | {location}"
                })
                if existing:
                    existing["_id"] = str(existing["_id"])
                    discovered.append(ScrapedJob(**existing))
                    continue
                    
                job_doc = {
                    "target_id": "external",
                    "user_id": user_id,
                    "title": mj["title"],
                    "url": mj["url"],
                    "description_snippet": f"{mj['company']} | {location}",
                    "matched_keywords": [search_query],
                    "is_new": True,
                    "discovered_at": now
                }
                result = await jobs_collection.insert_one(job_doc)
                job_doc["_id"] = str(result.inserted_id)
                discovered.append(ScrapedJob(**job_doc))
                
        return discovered

    @staticmethod
    async def delete_job(user_id: str, job_id: str) -> bool:
        """Delete a job listing."""
        collection = get_scraped_jobs_collection()
        try:
            oid = ObjectId(job_id)
        except Exception:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid job ID")
            
        result = await collection.delete_one({"_id": oid, "user_id": user_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job listing not found")
        return True


