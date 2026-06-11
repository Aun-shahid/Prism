from datetime import datetime
from typing import List, Optional
from bson import ObjectId
from fastapi import HTTPException, status

from ..database import get_generated_docs_collection
from ..models.resume import GeneratedDocument, ResumeGenerateRequest, GenerationType
from ..models.profile import UserProfile
from .profile_service import ProfileService
from .ai_service import AIService
from .logging_service import get_logger

logger = get_logger("resume_service")

# --- Prompt Templates ---

RESUME_SYSTEM_PROMPT = """You are an expert professional resume writer. Your job is to create a highly tailored, ATS-optimized resume based on the candidate's profile and the specific job description provided.

Rules:
- Use the candidate's REAL experience, skills, and education — do not fabricate information.
- Reword and emphasize achievements/skills that are most relevant to the target job description.
- Use strong action verbs and quantify results where possible.
- Output the resume in clean Markdown format with proper sections.
- Sections: Contact Info, Professional Summary, Skills, Work Experience, Projects, Education, Certifications (if any).
- Keep it concise — ideally 1-2 pages worth of content.
- Prioritize relevance to the job description."""

COVER_LETTER_SYSTEM_PROMPT = """You are an expert cover letter writer. Your job is to create a compelling, personalized cover letter based on the candidate's profile and the specific job description.

Rules:
- Address WHY the candidate is a great fit for THIS specific role.
- Reference specific achievements and skills from their profile that match the job requirements.
- Keep a professional yet personable tone.
- Output in clean Markdown format.
- Keep it concise — 3-4 paragraphs max.
- Do not fabricate experience — only use what's provided in the profile."""


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

        resume_content = None
        cover_letter_content = None
        provider_used = None

        # Generate resume
        if request.generation_type in (GenerationType.RESUME, GenerationType.BOTH):
            user_prompt = f"""Here is my professional profile:\n\n{profile_text}\n\n---\n\nHere is the job description I'm applying for:\n\n{request.job_description}\n\n---\n\nPlease create a tailored resume for this job."""
            resume_content, provider_used = await AIService.generate_text(
                user_id=user_id,
                system_prompt=RESUME_SYSTEM_PROMPT,
                user_prompt=user_prompt,
                preferred_provider=request.preferred_provider,
            )

        # Generate cover letter
        if request.generation_type in (GenerationType.COVER_LETTER, GenerationType.BOTH):
            user_prompt = f"""Here is my professional profile:\n\n{profile_text}\n\n---\n\nHere is the job description I'm applying for:\n\n{request.job_description}\n\n---\n\nPlease write a compelling cover letter for this position."""
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
            "resume_content": resume_content,
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
