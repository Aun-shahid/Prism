from datetime import datetime
from typing import Optional
from bson import ObjectId
from fastapi import HTTPException, status
import io
import json
from pypdf import PdfReader
from docx import Document
from .ai_service import AIService

from ..database import get_profiles_collection
from ..models.profile import (
    UserProfile,
    ProfileUpdateRequest,
    Education,
    WorkExperience,
    Project,
    Certification,
)
from .logging_service import get_logger

logger = get_logger("profile_service")


def format_profile_for_prompt(profile: UserProfile) -> str:
    """Convert a UserProfile into a readable text block for LLM prompts.

    Shared by resume tailoring and the AI assistant so both see the same
    full-profile view — every project, role, and education entry, plus
    contact details and target roles.
    """
    sections: list[str] = []

    if profile.headline:
        sections.append(f"**Headline:** {profile.headline}")
    if profile.summary:
        sections.append(f"**Summary:** {profile.summary}")
    if profile.location:
        sections.append(f"**Location:** {profile.location}")
    if profile.job_titles:
        sections.append(f"**Target Roles:** {', '.join(profile.job_titles)}")

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
            if proj.url:
                sections.append(f"  {proj.url}")

    if profile.education:
        sections.append("**Education:**")
        for edu in profile.education:
            end = edu.end_date or "Present"
            sections.append(
                f"- {edu.degree} in {edu.field_of_study or 'N/A'} at {edu.institution} "
                f"({edu.start_date or '?'} – {end})"
            )

    if profile.certifications:
        sections.append("**Certifications:**")
        for cert in profile.certifications:
            sections.append(f"- {cert.name} by {cert.issuer}")

    if profile.languages:
        sections.append(f"**Languages:** {', '.join(profile.languages)}")

    if profile.phone:
        sections.append(f"**Phone:** {profile.phone}")
    if profile.linkedin_url:
        sections.append(f"**LinkedIn:** {profile.linkedin_url}")
    if profile.github_url:
        sections.append(f"**GitHub:** {profile.github_url}")
    if profile.portfolio_url:
        sections.append(f"**Portfolio:** {profile.portfolio_url}")

    return "\n".join(sections) if sections else "No profile data available."


class ProfileService:
    @staticmethod
    async def get_or_create_profile(user_id: str) -> UserProfile:
        """Get the user's profile, creating an empty one if it doesn't exist."""
        collection = get_profiles_collection()
        doc = await collection.find_one({"user_id": user_id})
        if doc:
            doc["_id"] = str(doc["_id"])
            return UserProfile(**doc)

        # Create empty profile
        now = datetime.utcnow()
        new_profile = {
            "user_id": user_id,
            "headline": None,
            "summary": None,
            "phone": None,
            "location": None,
            "linkedin_url": None,
            "github_url": None,
            "portfolio_url": None,
            "skills": [],
            "job_titles": [],
            "education": [],
            "work_experience": [],
            "projects": [],
            "certifications": [],
            "languages": [],
            "job_preferences": {"onsite": [], "remote": [], "hybrid": [], "exclusions": []},
            "created_at": now,
            "updated_at": now,
        }
        result = await collection.insert_one(new_profile)
        new_profile["_id"] = str(result.inserted_id)
        logger.info(f"Created empty profile for user {user_id}")
        return UserProfile(**new_profile)

    @staticmethod
    async def update_profile(user_id: str, data: ProfileUpdateRequest) -> UserProfile:
        """Update the user's profile. Creates one if it doesn't exist."""
        collection = get_profiles_collection()

        # Ensure profile exists
        profile = await ProfileService.get_or_create_profile(user_id)

        update_dict = data.model_dump(exclude_unset=True)
        if not update_dict:
            return profile

        # Convert nested Pydantic models to dicts for MongoDB
        for key in ["education", "work_experience", "projects", "certifications", "job_preferences"]:
            if key in update_dict and update_dict[key] is not None:
                if key == "job_preferences":
                    update_dict[key] = update_dict[key].model_dump() if hasattr(update_dict[key], "model_dump") else update_dict[key]
                else:
                    update_dict[key] = [
                        item.model_dump() if hasattr(item, "model_dump") else item
                        for item in update_dict[key]
                    ]

        update_dict["updated_at"] = datetime.utcnow()

        await collection.update_one(
            {"user_id": user_id},
            {"$set": update_dict}
        )

        updated = await collection.find_one({"user_id": user_id})
        updated["_id"] = str(updated["_id"])
        logger.info(f"Updated profile for user {user_id}")
        return UserProfile(**updated)

    @staticmethod
    async def add_education(user_id: str, education: Education) -> UserProfile:
        """Add an education entry to the user's profile."""
        await ProfileService.get_or_create_profile(user_id)
        collection = get_profiles_collection()
        await collection.update_one(
            {"user_id": user_id},
            {
                "$push": {"education": education.model_dump()},
                "$set": {"updated_at": datetime.utcnow()},
            }
        )
        return await ProfileService.get_or_create_profile(user_id)

    @staticmethod
    async def remove_education(user_id: str, index: int) -> UserProfile:
        """Remove an education entry by index."""
        profile = await ProfileService.get_or_create_profile(user_id)
        if index < 0 or index >= len(profile.education):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid education index")

        collection = get_profiles_collection()
        education_list = [e.model_dump() for e in profile.education]
        education_list.pop(index)
        await collection.update_one(
            {"user_id": user_id},
            {"$set": {"education": education_list, "updated_at": datetime.utcnow()}}
        )
        return await ProfileService.get_or_create_profile(user_id)

    @staticmethod
    async def add_work_experience(user_id: str, experience: WorkExperience) -> UserProfile:
        """Add a work experience entry."""
        await ProfileService.get_or_create_profile(user_id)
        collection = get_profiles_collection()
        await collection.update_one(
            {"user_id": user_id},
            {
                "$push": {"work_experience": experience.model_dump()},
                "$set": {"updated_at": datetime.utcnow()},
            }
        )
        return await ProfileService.get_or_create_profile(user_id)

    @staticmethod
    async def remove_work_experience(user_id: str, index: int) -> UserProfile:
        """Remove a work experience entry by index."""
        profile = await ProfileService.get_or_create_profile(user_id)
        if index < 0 or index >= len(profile.work_experience):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid experience index")

        collection = get_profiles_collection()
        exp_list = [e.model_dump() for e in profile.work_experience]
        exp_list.pop(index)
        await collection.update_one(
            {"user_id": user_id},
            {"$set": {"work_experience": exp_list, "updated_at": datetime.utcnow()}}
        )
        return await ProfileService.get_or_create_profile(user_id)

    @staticmethod
    async def add_project(user_id: str, project: Project) -> UserProfile:
        """Add a project entry."""
        await ProfileService.get_or_create_profile(user_id)
        collection = get_profiles_collection()
        await collection.update_one(
            {"user_id": user_id},
            {
                "$push": {"projects": project.model_dump()},
                "$set": {"updated_at": datetime.utcnow()},
            }
        )
        return await ProfileService.get_or_create_profile(user_id)

    @staticmethod
    async def remove_project(user_id: str, index: int) -> UserProfile:
        """Remove a project entry by index."""
        profile = await ProfileService.get_or_create_profile(user_id)
        if index < 0 or index >= len(profile.projects):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid project index")

        collection = get_profiles_collection()
        proj_list = [p.model_dump() for p in profile.projects]
        proj_list.pop(index)
        await collection.update_one(
            {"user_id": user_id},
            {"$set": {"projects": proj_list, "updated_at": datetime.utcnow()}}
        )
        return await ProfileService.get_or_create_profile(user_id)

    @staticmethod
    async def add_certification(user_id: str, cert: Certification) -> UserProfile:
        """Add a certification entry."""
        await ProfileService.get_or_create_profile(user_id)
        collection = get_profiles_collection()
        await collection.update_one(
            {"user_id": user_id},
            {
                "$push": {"certifications": cert.model_dump()},
                "$set": {"updated_at": datetime.utcnow()},
            }
        )
        return await ProfileService.get_or_create_profile(user_id)

    @staticmethod
    async def remove_certification(user_id: str, index: int) -> UserProfile:
        """Remove a certification entry by index."""
        profile = await ProfileService.get_or_create_profile(user_id)
        if index < 0 or index >= len(profile.certifications):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid certification index")

        collection = get_profiles_collection()
        cert_list = [c.model_dump() for c in profile.certifications]
        cert_list.pop(index)
        await collection.update_one(
            {"user_id": user_id},
            {"$set": {"certifications": cert_list, "updated_at": datetime.utcnow()}}
        )
        return await ProfileService.get_or_create_profile(user_id)

    @staticmethod
    async def update_skills(user_id: str, skills: list[str]) -> UserProfile:
        """Replace the full skills list."""
        await ProfileService.get_or_create_profile(user_id)
        collection = get_profiles_collection()
        await collection.update_one(
            {"user_id": user_id},
            {"$set": {"skills": skills, "updated_at": datetime.utcnow()}}
        )
        return await ProfileService.get_or_create_profile(user_id)

    @staticmethod
    async def update_job_titles(user_id: str, job_titles: list[str]) -> UserProfile:
        """Replace the full target job titles list."""
        await ProfileService.get_or_create_profile(user_id)
        collection = get_profiles_collection()
        await collection.update_one(
            {"user_id": user_id},
            {"$set": {"job_titles": job_titles, "updated_at": datetime.utcnow()}}
        )
        return await ProfileService.get_or_create_profile(user_id)

    @staticmethod
    async def parse_cv_and_update_profile(
        user_id: str, file_content: bytes, filename: str
    ) -> UserProfile:
        """Extract text from CV, parse it with AI, and update the profile."""
        ext = filename.lower().split(".")[-1]
        text = ""

        try:
            if ext == "pdf":
                reader = PdfReader(io.BytesIO(file_content))
                for page in reader.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\n"
            elif ext == "docx":
                doc = Document(io.BytesIO(file_content))
                text = "\n".join([para.text for para in doc.paragraphs])
            else:
                text = file_content.decode("utf-8", errors="ignore")
        except Exception as e:
            logger.error(f"Failed to extract text from file {filename}: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to read document text: {str(e)}"
            )

        if not text.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The uploaded file seems to be empty or has no readable text."
            )

        system_prompt = (
            "You are an expert ATS and resume parsing AI. Your job is to extract all professional information "
            "from the user's uploaded CV/resume and format it as a valid JSON object matching the UserProfile schema.\n\n"
            "Do not fabricate any information. Only extract what is present in the text.\n"
            "Output MUST be a single valid JSON object, containing the following fields:\n"
            "{\n"
            '  "headline": "A short professional headline (e.g. Senior Software Engineer)",\n'
            '  "summary": "A brief professional summary",\n'
            '  "phone": "Phone number",\n'
            '  "location": "City, State or Country",\n'
            '  "linkedin_url": "LinkedIn profile URL if found",\n'
            '  "github_url": "GitHub URL if found",\n'
            '  "portfolio_url": "Portfolio website URL if found",\n'
            '  "skills": ["skill1", "skill2"],\n'
            '  "job_titles": ["Target job title 1", "Target job title 2"],\n'
            '  "education": [\n'
            "    {\n"
            '      "institution": "University Name",\n'
            '      "degree": "Degree (e.g. B.S. or M.S.)",\n'
            '      "field_of_study": "Field of study (e.g. Computer Science)",\n'
            '      "start_date": "Start date (e.g. 2018-09)",\n'
            '      "end_date": "End date or \'Present\'",\n'
            '      "gpa": "GPA if found",\n'
            '      "description": "Any education description"\n'
            "    }\n"
            "  ],\n"
            '  "work_experience": [\n'
            "    {\n"
            '      "company": "Company Name",\n'
            '      "title": "Job Title",\n'
            '      "location": "Location",\n'
            '      "start_date": "Start Date (e.g. 2020-01)",\n'
            '      "end_date": "End Date or null if current",\n'
            '      "description": "Detailed description of responsibilities",\n'
            '      "highlights": ["achievement bullet point 1", "achievement bullet point 2"]\n'
            "    }\n"
            "  ],\n"
            '  "projects": [\n'
            "    {\n"
            '      "name": "Project Name",\n'
            '      "description": "Description",\n'
            '      "technologies": ["tech1", "tech2"],\n'
            '      "url": "Project URL if found",\n'
            '      "start_date": "Start date",\n'
            '      "end_date": "End date"\n'
            "    }\n"
            "  ],\n"
            '  "certifications": [\n'
            "    {\n"
            '      "name": "Cert Name",\n'
            '      "issuer": "Issuer",\n'
            '      "date": "Date",\n'
            '      "url": "URL"\n'
            "    }\n"
            "  ],\n"
            '  "languages": ["lang1", "lang2"]\n'
            "}\n\n"
            "Strictly return ONLY the raw JSON object. Do not include markdown code block syntax (like ```json ... ```). "
            "Just start with '{' and end with '}'."
        )

        res_text, provider = await AIService.generate_text(
            user_id=user_id,
            system_prompt=system_prompt,
            user_prompt=f"Here is my resume content:\n\n{text}",
        )

        res_text = res_text.strip()
        if res_text.startswith("```json"):
            res_text = res_text[7:]
        if res_text.endswith("```"):
            res_text = res_text[:-3]
        res_text = res_text.strip()

        try:
            profile_data = json.loads(res_text)
        except Exception as e:
            logger.error(f"Failed to parse AI JSON response: {e}. Raw response: {res_text}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"AI returned invalid format: {str(e)}"
            )

        try:
            update_req = ProfileUpdateRequest(**profile_data)
        except Exception as pe:
            logger.error(f"Validation error on AI profile data: {pe}")
            # Try to build request with only fields that exist
            valid_keys = ProfileUpdateRequest.model_fields.keys()
            filtered_data = {k: v for k, v in profile_data.items() if k in valid_keys}
            update_req = ProfileUpdateRequest(**filtered_data)

        return await ProfileService.update_profile(user_id, update_req)
