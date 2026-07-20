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
    ResumeTailorRequest,
    ResumeVersionCreate, ResumeVersionUpdate, ResumeVersionResponse,
)
from .profile_service import ProfileService, format_profile_for_prompt
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

Resume best practices you MUST apply:
- Use the candidate's REAL experience, skills, and education — never fabricate employers, titles, dates, metrics, or tools.
- Every work-experience highlight follows the accomplishment formula: strong action verb + what was done + measurable or observable impact (the "Accomplished X as measured by Y, by doing Z" pattern). If the source bullet has a number, keep it; if not, sharpen the impact qualitatively — do NOT invent numbers.
- Start each bullet with a varied, strong action verb (Built, Led, Reduced, Shipped, Automated, Redesigned...). Never start with "Responsible for", "Worked on", "Helped with", or a pronoun.
- Mirror the job description's exact keywords and terminology (technologies, methodologies, role language) wherever the candidate genuinely has that experience — this is what ATS systems match on.
- Summary: 2-3 sentences positioning the candidate for THIS role — title-aligned, keyword-rich, no clichés ("results-driven", "team player", "passionate" are banned).
- Order highlights within each role by relevance to the target job, most relevant first.
- Keep bullets to one line where possible (max ~2), past tense for past roles, present tense for current roles, no personal pronouns, no periods inconsistency (end all bullets without a period or all with — be consistent).
- Skills section: lead with the skills the job description asks for (that the candidate has); drop irrelevant ones from visibility rather than deleting them.
- Keep sections concise and ATS-friendly: standard section labels, no tables/graphics references, plain text.
- Preserve all original section ids and item ids from the input.
- Only include sections that were in the original profile (do not add new section types).
- Output ONLY the raw JSON object, nothing else."""

COVER_LETTER_SYSTEM_PROMPT = """You are an expert cover letter writer. Respond with a plain text cover letter only (no JSON, no markdown headers).

Rules:
- Open with genuine specificity about this role/company — never "I am writing to express my interest in..."
- Address WHY the candidate is a great fit for THIS specific role: map their 2-3 strongest, most relevant real achievements to the role's stated needs.
- Show, don't claim: back every quality with a concrete example from their profile.
- Keep a professional yet personable tone; confident, not obsequious.
- 3-4 short paragraphs, under 300 words total.
- Close with a clear, low-friction call to action.
- Do not fabricate experience, and avoid clichés ("team player", "fast learner", "passionate")."""

RESUME_TAILOR_SYSTEM_PROMPT = """You are an expert resume editor working on a structured resume. The user gives you the resume's current sections (as JSON with stable ids), their full profile, and an edit instruction (and sometimes a target job description). You return a MINIMAL set of edit operations describing ONLY what changes.

CRITICAL: Respond with ONLY a valid JSON object — no markdown, no prose, no code fences:
{
  "summary": "one or two sentences recapping what you changed, in plain language",
  "operations": [ ...ops... ]
}

Never return the whole resume. Emit an operation ONLY for something that actually changes. For a visibility toggle, a single field edit, or a removal, reference the target by its id — do NOT resend the rest of that node.

OPERATIONS (use these exact shapes):
- Toggle visibility (hide/show a section, item, or bullet):
  { "op": "set_visibility", "target_id": "<id>", "visible": true }
- Update specific fields of an item or a section (ONLY the fields that change):
  { "op": "update_fields", "target_id": "<id>", "fields": { "description": "..." } }
  (For a summary section, edit its text via "fields": { "content": "..." }. To rename a section, "fields": { "label": "..." }.)
- Remove a section, item, or bullet entirely:
  { "op": "remove", "target_id": "<id>" }
- Add a new item to a section (provide the FULL item, using the candidate's REAL data from their profile):
  { "op": "add_item", "section_id": "<section id>", "position": "end", "item": { ...see field schema below... } }
- Add a bullet to a work/project item:
  { "op": "add_highlight", "item_id": "<item id>", "text": "...", "position": "end" }
- Reorder items within a section (list every item id in the new order):
  { "op": "reorder_items", "section_id": "<section id>", "item_ids": ["id2","id1"] }
- Reorder sections:
  { "op": "reorder_sections", "section_ids": ["id1","id3","id2"] }

ITEM FIELD SCHEMA by section type (for update_fields.fields and add_item.item):
- summary section: { "content": "..." }   (a section, edited via update_fields on the section id)
- work_experience item: { "company","title","location","startDate","endDate","description","highlights":[{"text":"...","visible":true}] }
- education item: { "institution","degree","fieldOfStudy","startDate","endDate","gpa" }
- skills / languages item: { "text":"...","visible":true }
- projects item: { "name","technologies","url","startDate","endDate","description","highlights":[] }  (technologies is a comma-separated string)
- certifications item: { "name","issuer","date","url" }

RULES:
- Use ONLY the candidate's real experience, skills, projects, and education from their profile. Never fabricate employers, titles, dates, metrics, or tools. When the instruction says "add my X project", pull X's real details from the profile.
- Interpret the instruction literally: "remove 2 projects" -> two remove ops; "activate/hide it" -> one set_visibility op; "update the description" -> one update_fields op with just { "description": ... }.
- When tailoring bullets to a job description, follow best practice: strong action verb + what was done + measurable/observable impact; mirror the job's real keywords; never open with "Responsible for", "Worked on", or a pronoun; never invent numbers.
- If the instruction is ambiguous or references something not present, do your best with what exists and say so in the summary; do not invent ids.
- Reference only ids that appear in the provided sections (brand-new nodes you add need no id).
- Output ONLY the raw JSON object."""


BULLET_COACH_SYSTEM_PROMPT = """You are a resume bullet-point coach. The user gives you one resume bullet (plus optional role context and target job description). Improve it using best practices:

- Structure: strong action verb + what was done + measurable/observable impact ("Accomplished X as measured by Y, by doing Z").
- Never start with "Responsible for", "Worked on", "Helped", or a pronoun.
- Keep it to one crisp line (max ~30 words), no personal pronouns.
- Preserve every fact. NEVER invent numbers, tools, or outcomes. If the bullet would clearly benefit from a metric the user could add, tell them in the tips instead of making one up.
- If a job description is provided, mirror its keywords where the bullet genuinely supports them.

Return a JSON object:
{
  "improved": "the single best rewrite",
  "alternatives": ["a second option", "a third option with a different emphasis"],
  "tips": ["1-2 short, specific suggestions, e.g. a metric the user could add or a keyword to work in"]
}"""


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


def _collect_ids(sections: List[Dict[str, Any]]):
    """Gather section / item / highlight ids from a sections tree."""
    section_ids, item_ids, highlight_ids = set(), set(), set()
    for section in sections or []:
        if not isinstance(section, dict):
            continue
        if section.get("id"):
            section_ids.add(section["id"])
        for item in section.get("items", []) or []:
            if not isinstance(item, dict):
                continue
            if item.get("id"):
                item_ids.add(item["id"])
            for hl in item.get("highlights", []) or []:
                if isinstance(hl, dict) and hl.get("id"):
                    highlight_ids.add(hl["id"])
    return section_ids, item_ids, highlight_ids


def _validate_operations(operations: Any, sections: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Keep only well-formed operations whose target ids exist in the resume.

    Brand-new nodes (add_item / add_highlight) are exempt from the id check;
    the frontend reducer mints their ids when applying.
    """
    if not isinstance(operations, list):
        return []
    section_ids, item_ids, highlight_ids = _collect_ids(sections)
    all_ids = section_ids | item_ids | highlight_ids
    valid: List[Dict[str, Any]] = []
    for op in operations:
        if not isinstance(op, dict):
            continue
        kind = op.get("op")
        if kind == "set_visibility":
            if op.get("target_id") in all_ids and isinstance(op.get("visible"), bool):
                valid.append({"op": kind, "target_id": op["target_id"], "visible": op["visible"]})
        elif kind == "update_fields":
            fields = op.get("fields")
            if op.get("target_id") in all_ids and isinstance(fields, dict) and fields:
                valid.append({"op": kind, "target_id": op["target_id"], "fields": fields})
        elif kind == "remove":
            if op.get("target_id") in all_ids:
                valid.append({"op": kind, "target_id": op["target_id"]})
        elif kind == "add_item":
            item = op.get("item")
            if op.get("section_id") in section_ids and isinstance(item, dict):
                out = {"op": kind, "section_id": op["section_id"], "item": item}
                if op.get("position") in ("start", "end"):
                    out["position"] = op["position"]
                valid.append(out)
        elif kind == "add_highlight":
            text = op.get("text")
            if op.get("item_id") in item_ids and isinstance(text, str) and text.strip():
                out = {"op": kind, "item_id": op["item_id"], "text": text}
                if op.get("position") in ("start", "end"):
                    out["position"] = op["position"]
                valid.append(out)
        elif kind == "reorder_items":
            ids = op.get("item_ids")
            if op.get("section_id") in section_ids and isinstance(ids, list) and ids:
                valid.append({
                    "op": kind, "section_id": op["section_id"],
                    "item_ids": [i for i in ids if isinstance(i, str)],
                })
        elif kind == "reorder_sections":
            ids = op.get("section_ids")
            if isinstance(ids, list) and ids:
                valid.append({"op": kind, "section_ids": [i for i in ids if isinstance(i, str)]})
    return valid


class ResumeService:
    @staticmethod
    async def generate(user_id: str, request: ResumeGenerateRequest) -> GeneratedDocument:
        """Generate a tailored resume and/or cover letter from the user's profile + job description."""
        # Fetch user profile
        profile = await ProfileService.get_or_create_profile(user_id)
        profile_text = format_profile_for_prompt(profile)

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
                purpose="tailor",
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
                purpose="tailor",
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
    async def tailor(user_id: str, request: ResumeTailorRequest) -> Dict[str, Any]:
        """Prompt-driven resume edit.

        Returns affected-fields-only edit operations (and an optional cover
        letter) rather than the whole resume, so the client applies a small
        diff. Real data comes from the user's profile.
        """
        profile = await ProfileService.get_or_create_profile(user_id)
        profile_text = format_profile_for_prompt(profile)

        instruction = (request.instruction or "").strip()
        job_description = (request.job_description or "").strip()
        if not instruction and not job_description:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Provide an instruction or a job description to tailor against.",
            )

        operations: List[Dict[str, Any]] = []
        summary = ""
        cover_letter_content = None
        provider_used = None

        if request.want_resume:
            # If only a job description was given, treat it as a full-tailor instruction.
            effective_instruction = instruction or "Tailor this whole resume to the job description below."
            sections_json = json.dumps(request.sections or [], indent=2)
            parts = [
                f"Current resume sections (JSON with ids):\n\n{sections_json}",
                f"Candidate's full profile (the source of truth for real data):\n\n{profile_text}",
                f"Edit instruction:\n{effective_instruction}",
            ]
            if job_description:
                parts.append(f"Target job description:\n{job_description}")
            parts.append(
                "Return ONLY a JSON object with 'summary' and 'operations'. "
                "Emit operations for AFFECTED fields only — never echo unchanged nodes."
            )
            result, provider_used = await AIService.generate_json(
                user_id,
                RESUME_TAILOR_SYSTEM_PROMPT,
                "\n\n".join(parts),
                preferred_provider=request.preferred_provider,
                purpose="tailor",
            )
            if isinstance(result, dict):
                operations = _validate_operations(result.get("operations"), request.sections)
                summary = (result.get("summary") or "").strip()

        if request.want_cover_letter:
            cl_prompt = f"Here is my professional profile:\n\n{profile_text}\n\n"
            if job_description:
                cl_prompt += f"Here is the job description I'm applying for:\n\n{job_description}\n\n"
            if instruction:
                cl_prompt += f"Additional instruction:\n{instruction}\n\n"
            cl_prompt += "Please write a compelling cover letter for this position."
            cover_letter_content, provider_used = await AIService.generate_text(
                user_id=user_id,
                system_prompt=COVER_LETTER_SYSTEM_PROMPT,
                user_prompt=cl_prompt,
                preferred_provider=request.preferred_provider,
                purpose="tailor",
            )

        logger.info(f"Tailored resume for user {user_id}: {len(operations)} op(s) using {provider_used}")
        return {
            "operations": operations,
            "summary": summary,
            "cover_letter": cover_letter_content,
            "provider_used": provider_used,
        }

    @staticmethod
    async def improve_bullet(
        user_id: str,
        text: str,
        context: Optional[str] = None,
        job_description: Optional[str] = None,
        preferred_provider: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Coach a single resume bullet / description into best-practice shape."""
        text = (text or "").strip()
        if not text:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No text to improve.")

        parts = [f"Bullet to improve:\n{text}"]
        if context:
            parts.append(f"Role context: {context}")
        if job_description:
            parts.append(f"Target job description (excerpt):\n{job_description[:2500]}")

        result, provider_used = await AIService.generate_json(
            user_id,
            BULLET_COACH_SYSTEM_PROMPT,
            "\n\n".join(parts),
            preferred_provider=preferred_provider,
            purpose="tailor",
        )
        return {
            "improved": result.get("improved") or text,
            "alternatives": result.get("alternatives") or [],
            "tips": result.get("tips") or [],
            "provider_used": provider_used,
        }

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