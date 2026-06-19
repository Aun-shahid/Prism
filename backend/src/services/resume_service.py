import json
import re
from copy import deepcopy
from datetime import datetime
from typing import Any, Dict, List, Optional
from bson import ObjectId
from fastapi import HTTPException, status

from ..database import get_generated_docs_collection, get_resume_versions_collection
from ..models.resume import (
    GeneratedDocument, ResumeGenerateRequest, GenerationType,
    ResumeVersionCreate, ResumeVersionUpdate, ResumeVersionResponse,
)
from ..models.profile import UserProfile
from .profile_service import ProfileService
from .ai_service import AIService
from .logging_service import get_logger

logger = get_logger("resume_service")

# --- Prompt Templates ---

RESUME_SYSTEM_PROMPT = """You are an expert professional resume writer. Your job is to create a highly tailored, ATS-optimized resume based on the candidate's profile and the specific job description provided.

CRITICAL: You MUST respond with ONLY a valid JSON object. No markdown, no prose, no code fences — raw JSON only.

The JSON must have this exact structure:
{
  "sections": [
    {
      "id": "<copy from input>",
      "type": "<copy from input>",
      "label": "<copy from input>",
      "visible": true,
      "order": <copy from input>,
      // for type=summary: "content": "rewritten summary text"
      // for type=work_experience: "items": [ { "id":"...", "visible":true, "company":"...", "title":"...", "location":"...", "startDate":"...", "endDate":"...", "description":"...", "highlights": [{"id":"...","text":"...","visible":true}] } ]
      // for type=education: "items": [ { "id":"...", "visible":true, "institution":"...", "degree":"...", "fieldOfStudy":"...", "startDate":"...", "endDate":"...", "gpa":"..." } ]
      // for type=skills: "items": [ {"id":"...","text":"...","visible":true} ]
      // for type=projects: "items": [ { "id":"...", "visible":true, "name":"...", "technologies":"...", "url":"...", "startDate":"...", "endDate":"...", "description":"...", "highlights": [] } ]
      // for type=certifications: "items": [ {"id":"...","text":"...","visible":true} ]
      // for type=languages: "items": [ {"id":"...","text":"...","visible":true} ]
    }
  ],
  "cover_letter": "plain text cover letter here"
}

Rules:
- Use the candidate's REAL experience, skills, and education — do not fabricate.
- Reword and emphasize achievements most relevant to the target job.
- Use strong action verbs and quantify results where possible.
- Keep sections concise and ATS-friendly.
- Preserve all original section ids and item ids from the input.
- Only include sections that were in the original profile (do not add new section types).
- Output ONLY the raw JSON object, nothing else."""

COVER_LETTER_SYSTEM_PROMPT = """You are an expert cover letter writer. Respond with a plain text cover letter only (no JSON, no markdown headers).

Rules:
- Address WHY the candidate is a great fit for THIS specific role.
- Reference specific achievements and skills from their profile.
- Keep a professional yet personable tone.
- 3-4 paragraphs max.
- Do not fabricate experience."""


def _format_profile_for_prompt(profile: UserProfile) -> str:
    """Convert a UserProfile into a readable text block for the LLM prompt."""
    sections = []

    if profile.headline:
        sections.append(f"**Headline:** {profile.headline}")
    if profile.summary:
        sections.append(f"**Summary:** {profile.summary}")
    if profile.location:
        sections.append(f"**Location:** {profile.location}")

    if profile.skills:
        sections.append(f"**Skills:** {', '.join(profile.skills)}")

    if profile.work_experience:
        sections.append("**Work Experience:**")
        for exp in profile.work_experience:
            end = exp.end_date or "Present"
            sections.append(f"- {exp.title} at {exp.company} ({exp.start_date} – {end})")
            if exp.description:
                sections.append(f"  {exp.description}")
            for h in exp.highlights:
                sections.append(f"  • {h}")

    if profile.projects:
        sections.append("**Projects:**")
        for proj in profile.projects:
            techs = f" [{', '.join(proj.technologies)}]" if proj.technologies else ""
            sections.append(f"- {proj.name}{techs}")
            if proj.description:
                sections.append(f"  {proj.description}")

    if profile.education:
        sections.append("**Education:**")
        for edu in profile.education:
            end = edu.end_date or "Present"
            sections.append(f"- {edu.degree} in {edu.field_of_study or 'N/A'} at {edu.institution} ({edu.start_date or '?'} – {end})")

    if profile.certifications:
        sections.append("**Certifications:**")
        for cert in profile.certifications:
            sections.append(f"- {cert.name} by {cert.issuer}")

    if profile.languages:
        sections.append(f"**Languages:** {', '.join(profile.languages)}")

    if profile.linkedin_url:
        sections.append(f"**LinkedIn:** {profile.linkedin_url}")
    if profile.github_url:
        sections.append(f"**GitHub:** {profile.github_url}")
    if profile.portfolio_url:
        sections.append(f"**Portfolio:** {profile.portfolio_url}")

    return "\n".join(sections) if sections else "No profile data available."


def _parse_ai_sections(raw: str) -> Optional[List[Dict[str, Any]]]:
    """Extract and parse JSON sections array from AI response."""
    try:
        # Strip markdown code fences if present
        cleaned = re.sub(r"```(?:json)?\s*|\s*```", "", raw).strip()
        data = json.loads(cleaned)
        if isinstance(data, dict) and "sections" in data:
            return data["sections"]
        if isinstance(data, list):
            return data
    except (json.JSONDecodeError, ValueError):
        logger.warning("AI returned non-JSON content for resume sections")
    return None


class ResumeService:
    @staticmethod
    async def generate(user_id: str, request: ResumeGenerateRequest) -> GeneratedDocument:
        """Generate a tailored resume and/or cover letter from the user's profile + job description."""
        # Fetch user profile
        profile = await ProfileService.get_or_create_profile(user_id)
        profile_text = _format_profile_for_prompt(profile)

        if not profile.skills and not profile.work_experience and not profile.education:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Your profile is empty. Please add your skills, experience, and education before generating a resume.",
            )

        resume_sections = None
        cover_letter_content = None
        provider_used = None

        # Generate resume as structured JSON
        if request.generation_type in (GenerationType.RESUME, GenerationType.BOTH):
            sections_json = json.dumps(request.version_sections or [], indent=2)
            user_prompt = (
                f"Here is the candidate's current resume sections (JSON):\n\n{sections_json}\n\n"
                f"Here is the candidate's profile summary:\n\n{profile_text}\n\n"
                f"Here is the job description:\n\n{request.job_description}\n\n"
                "Rewrite the resume sections as a tailored JSON object following the exact schema in your instructions. "
                "Return ONLY the raw JSON object."
            )
            raw, provider_used = await AIService.generate_text(
                user_id=user_id,
                system_prompt=RESUME_SYSTEM_PROMPT,
                user_prompt=user_prompt,
                preferred_provider=request.preferred_provider,
            )
            resume_sections = _parse_ai_sections(raw)

        # Generate cover letter as plain text
        if request.generation_type in (GenerationType.COVER_LETTER, GenerationType.BOTH):
            user_prompt = (
                f"Here is my professional profile:\n\n{profile_text}\n\n"
                f"Here is the job description I'm applying for:\n\n{request.job_description}\n\n"
                "Please write a compelling cover letter for this position."
            )
            cover_letter_content, provider_used = await AIService.generate_text(
                user_id=user_id,
                system_prompt=COVER_LETTER_SYSTEM_PROMPT,
                user_prompt=user_prompt,
                preferred_provider=request.preferred_provider,
            )

        # Store generated document
        collection = get_generated_docs_collection()
        doc = {
            "user_id": user_id,
            "application_id": request.application_id,
            "generation_type": request.generation_type.value,
            "job_description": request.job_description,
            "resume_sections": resume_sections,
            "cover_letter_content": cover_letter_content,
            "ai_provider_used": provider_used,
            "created_at": datetime.utcnow(),
        }
        result = await collection.insert_one(doc)
        doc["_id"] = str(result.inserted_id)

        logger.info(f"Generated {request.generation_type.value} for user {user_id} using {provider_used}")
        return GeneratedDocument(**doc)

    @staticmethod
    async def list_generated(user_id: str) -> List[GeneratedDocument]:
        """List all generated documents for a user."""
        collection = get_generated_docs_collection()
        cursor = collection.find({"user_id": user_id}).sort("created_at", -1)
        docs = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            docs.append(GeneratedDocument(**doc))
        return docs

    @staticmethod
    async def get_generated(user_id: str, doc_id: str) -> GeneratedDocument:
        """Get a specific generated document."""
        collection = get_generated_docs_collection()
        try:
            oid = ObjectId(doc_id)
        except Exception:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid document ID")

        doc = await collection.find_one({"_id": oid, "user_id": user_id})
        if not doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Generated document not found")

        doc["_id"] = str(doc["_id"])
        return GeneratedDocument(**doc)

    @staticmethod
    async def delete_generated(user_id: str, doc_id: str) -> bool:
        """Delete a generated document."""
        collection = get_generated_docs_collection()
        try:
            oid = ObjectId(doc_id)
        except Exception:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid document ID")

        result = await collection.delete_one({"_id": oid, "user_id": user_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Generated document not found")

        logger.info(f"Deleted generated document {doc_id} for user {user_id}")
        return True

# ─── Version Service ──────────────────────────────────────────────────────────

def _doc_to_version_response(doc: Dict[str, Any]) -> ResumeVersionResponse:
    doc["_id"] = str(doc["_id"]) if "_id" in doc else doc.get("id")
    return ResumeVersionResponse(
        id=doc["_id"],
        user_id=doc["user_id"],
        title=doc["title"],
        is_favorite=doc.get("is_favorite", False),
        created_at=doc["created_at"],
        updated_at=doc.get("updated_at", doc["created_at"]),
        is_ai_tailored=doc.get("is_ai_tailored", False),
        ai_cover_letter=doc.get("ai_cover_letter"),
        application_id=doc.get("application_id"),
        application_label=doc.get("application_label"),
        contact=doc.get("contact", {}),
        sections=doc.get("sections", []),
        customization=doc.get("customization", {}),
    )


class VersionService:
    @staticmethod
    async def list_versions(user_id: str) -> List[ResumeVersionResponse]:
        collection = get_resume_versions_collection()
        cursor = collection.find({"user_id": user_id}).sort("created_at", -1)
        results = []
        async for doc in cursor:
            results.append(_doc_to_version_response(doc))
        return results

    @staticmethod
    async def create_version(user_id: str, data: ResumeVersionCreate) -> ResumeVersionResponse:
        collection = get_resume_versions_collection()
        now = datetime.utcnow()
        doc = {
            "user_id": user_id,
            "title": data.title,
            "is_favorite": data.is_favorite,
            "created_at": now,
            "updated_at": now,
            "is_ai_tailored": data.is_ai_tailored,
            "ai_cover_letter": data.ai_cover_letter,
            "application_id": data.application_id,
            "application_label": data.application_label,
            "contact": data.contact,
            "sections": data.sections,
            "customization": data.customization,
        }
        result = await collection.insert_one(doc)
        doc["_id"] = result.inserted_id
        logger.info(f"Created resume version for user {user_id}")
        return _doc_to_version_response(doc)

    @staticmethod
    async def update_version(user_id: str, version_id: str, data: ResumeVersionUpdate) -> ResumeVersionResponse:
        collection = get_resume_versions_collection()
        try:
            oid = ObjectId(version_id)
        except Exception:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid version ID")

        updates = {k: v for k, v in data.model_dump(exclude_none=True).items()}
        if not updates:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")

        updates["updated_at"] = datetime.utcnow()
        result = await collection.update_one(
            {"_id": oid, "user_id": user_id},
            {"$set": updates},
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume version not found")

        doc = await collection.find_one({"_id": oid})
        return _doc_to_version_response(doc)

    @staticmethod
    async def delete_version(user_id: str, version_id: str) -> None:
        collection = get_resume_versions_collection()
        try:
            oid = ObjectId(version_id)
        except Exception:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid version ID")

        result = await collection.delete_one({"_id": oid, "user_id": user_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume version not found")
        logger.info(f"Deleted resume version {version_id} for user {user_id}")

    @staticmethod
    async def duplicate_version(user_id: str, version_id: str) -> ResumeVersionResponse:
        collection = get_resume_versions_collection()
        try:
            oid = ObjectId(version_id)
        except Exception:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid version ID")

        doc = await collection.find_one({"_id": oid, "user_id": user_id})
        if not doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume version not found")

        now = datetime.utcnow()
        clone = deepcopy(doc)
        clone.pop("_id", None)
        clone["title"] = doc["title"] + " (Copy)"
        clone["created_at"] = now
        clone["updated_at"] = now
        clone["is_favorite"] = False

        result = await collection.insert_one(clone)
        clone["_id"] = result.inserted_id
        logger.info(f"Duplicated resume version {version_id} for user {user_id}")
        return _doc_to_version_response(clone)