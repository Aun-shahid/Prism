"""
The AI assistant's agentic flow.

Every message goes through a transparent pipeline:
  1. Intent + entity detection (LLM, structured JSON)
  2. Retrieval from the user's career knowledge base (RAG)
  3. Optional live company research on the web (when a company is named)
  4. Grounded composition with an intent-specific system prompt

Each stage appends a human-readable step to the agent trace that the
frontend renders, so the user can always see how an answer was produced.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from bson import ObjectId
from fastapi import HTTPException, status

from ..database import (
    get_chat_conversations_collection,
    get_chat_messages_collection,
)
from .ai_service import AIService
from .logging_service import get_logger
from .profile_service import ProfileService, format_profile_for_prompt
from .rag_service import RAGService
from .web_research_service import WebResearchService

logger = get_logger("agent_service")

HISTORY_LIMIT = 10

INTENT_LABELS = {
    "general_chat": "General question",
    "profile_question": "Question about your background",
    "generate_email": "Email generation",
    "generate_cover_letter": "Cover letter generation",
    "company_research": "Company research",
    "job_fit_analysis": "Job fit analysis",
}

RESEARCH_INTENTS = {"generate_email", "generate_cover_letter", "company_research", "job_fit_analysis"}

# Intents where the model writes on the user's behalf and should see the WHOLE
# profile (every project, role, and contact detail), not a top-k RAG sample.
COMPOSITION_INTENTS = {"generate_email", "generate_cover_letter", "job_fit_analysis"}

CLASSIFIER_SYSTEM_PROMPT = """You are the routing brain of a job-search assistant. Classify the user's latest message and extract entities. Return a JSON object with exactly these keys:

  "intent": one of "general_chat", "profile_question", "generate_email", "generate_cover_letter", "company_research", "job_fit_analysis"
  "company_name": the company name mentioned or clearly implied, else null
  "has_job_description": true if the message contains a pasted job description or detailed role requirements
  "job_title": the role/job title in question, else null
  "retrieval_query": a short search query (5-12 words) describing which of the user's own experiences/projects/skills are most relevant to answering

Guidance:
- "generate_email": the user wants an outreach/application/follow-up email written (e.g. "generate an email for this job description").
- "generate_cover_letter": explicitly a cover letter.
- "company_research": the user mainly wants information about a company.
- "job_fit_analysis": the user wants to know how well they match a role or what to improve.
- "profile_question": questions answerable from the user's own background ("what are my strongest projects?").
- Otherwise "general_chat"."""


class AgentService:
    """Runs the assistant pipeline and persists conversations."""

    # ------------------------------------------------------------------
    # Public entry point
    # ------------------------------------------------------------------

    @staticmethod
    async def chat(
        user_id: str,
        message: str,
        conversation_id: Optional[str] = None,
        preferred_provider: Optional[str] = None,
    ) -> Dict[str, Any]:
        message = (message or "").strip()
        if not message:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Message is empty.")

        conversation = await AgentService._get_or_create_conversation(
            user_id, conversation_id, title_seed=message
        )
        history = await AgentService._load_history(user_id, conversation["id"])

        steps: List[Dict[str, Any]] = []
        sources: List[str] = []

        # --- 1. Intent + entity detection -----------------------------
        classification = await AgentService._classify(
            user_id, message, history, preferred_provider
        )
        intent = classification.get("intent") or "general_chat"
        if intent not in INTENT_LABELS:
            intent = "general_chat"
        company_name = classification.get("company_name") or None
        retrieval_query = classification.get("retrieval_query") or message

        detail = INTENT_LABELS[intent]
        if company_name:
            detail += f" · Company: {company_name}"
        steps.append({"type": "intent", "label": "Understood the request", "detail": detail})

        # --- 2. Gather the user's background ---------------------------
        # For writing tasks (email/cover letter/fit) the model needs the WHOLE
        # profile so nothing is silently dropped; elsewhere, RAG keeps it focused.
        retrieved: List[Dict[str, Any]] = []
        full_profile_text: Optional[str] = None
        if intent in COMPOSITION_INTENTS:
            profile = await ProfileService.get_or_create_profile(user_id)
            full_profile_text = format_profile_for_prompt(profile)
            n_proj, n_roles = len(profile.projects), len(profile.work_experience)
            steps.append({
                "type": "retrieval",
                "label": "Loaded your full profile",
                "detail": (
                    f"Using all of your background — {n_proj} project(s), {n_roles} role(s)"
                    if (n_proj or n_roles) else "No profile data yet — add details in My Profile"
                ),
            })
        else:
            retrieved = await RAGService.retrieve(user_id, retrieval_query, k=6)
            steps.append({
                "type": "retrieval",
                "label": "Searched your career profile",
                "detail": (
                    f"Found {len(retrieved)} relevant item(s): "
                    + ", ".join(d["title"] for d in retrieved[:4])
                ) if retrieved else "No profile data indexed yet — add details in My Profile",
            })

        # --- 3. Live company research ----------------------------------
        company_brief: Optional[Dict[str, Any]] = None
        if company_name and intent in RESEARCH_INTENTS:
            try:
                company_brief, research_sources = await WebResearchService.research_company(
                    user_id, company_name,
                    preferred_provider=preferred_provider,
                    steps=steps,
                )
                sources.extend(research_sources)
            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"Company research failed for '{company_name}': {e}")
                steps.append({
                    "type": "research",
                    "label": f"Company research for {company_name} failed",
                    "detail": "Continuing without live company data",
                })

        # --- 4. Compose the grounded answer ----------------------------
        steps.append({"type": "compose", "label": "Drafting the response"})
        system_prompt = AgentService._build_system_prompt(
            intent, retrieved, company_brief, full_profile_text
        )

        chat_messages = [
            {"role": m["role"], "content": m["content"]} for m in history
        ]
        chat_messages.append({"role": "user", "content": message})

        reply, provider_used = await AIService.generate_chat(
            user_id, system_prompt, chat_messages, preferred_provider=preferred_provider
        )

        # --- Persist ----------------------------------------------------
        now = datetime.utcnow()
        messages_collection = get_chat_messages_collection()
        await messages_collection.insert_one({
            "conversation_id": conversation["id"],
            "user_id": user_id,
            "role": "user",
            "content": message,
            "created_at": now,
        })
        await messages_collection.insert_one({
            "conversation_id": conversation["id"],
            "user_id": user_id,
            "role": "assistant",
            "content": reply,
            "intent": intent,
            "steps": steps,
            "sources": sources,
            "created_at": datetime.utcnow(),
        })
        await get_chat_conversations_collection().update_one(
            {"_id": ObjectId(conversation["id"])},
            {"$set": {"updated_at": datetime.utcnow()}},
        )

        return {
            "conversation_id": conversation["id"],
            "reply": reply,
            "intent": intent,
            "steps": steps,
            "sources": sources,
            "company_research": company_brief,
            "provider_used": provider_used,
        }

    # ------------------------------------------------------------------
    # Conversations
    # ------------------------------------------------------------------

    @staticmethod
    async def list_conversations(user_id: str) -> List[Dict[str, Any]]:
        cursor = get_chat_conversations_collection().find(
            {"user_id": user_id}
        ).sort("updated_at", -1).limit(50)
        conversations = []
        async for doc in cursor:
            conversations.append({
                "id": str(doc["_id"]),
                "title": doc.get("title", "Conversation"),
                "created_at": doc.get("created_at"),
                "updated_at": doc.get("updated_at"),
            })
        return conversations

    @staticmethod
    async def get_messages(user_id: str, conversation_id: str) -> List[Dict[str, Any]]:
        await AgentService._require_conversation(user_id, conversation_id)
        cursor = get_chat_messages_collection().find(
            {"conversation_id": conversation_id, "user_id": user_id}
        ).sort("created_at", 1).limit(200)
        messages = []
        async for doc in cursor:
            messages.append({
                "id": str(doc["_id"]),
                "role": doc["role"],
                "content": doc["content"],
                "intent": doc.get("intent"),
                "steps": doc.get("steps", []),
                "sources": doc.get("sources", []),
                "created_at": doc.get("created_at"),
            })
        return messages

    @staticmethod
    async def delete_conversation(user_id: str, conversation_id: str) -> None:
        await AgentService._require_conversation(user_id, conversation_id)
        await get_chat_messages_collection().delete_many(
            {"conversation_id": conversation_id, "user_id": user_id}
        )
        await get_chat_conversations_collection().delete_one(
            {"_id": ObjectId(conversation_id), "user_id": user_id}
        )

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    @staticmethod
    async def _get_or_create_conversation(
        user_id: str, conversation_id: Optional[str], title_seed: str
    ) -> Dict[str, Any]:
        collection = get_chat_conversations_collection()
        if conversation_id:
            doc = await AgentService._require_conversation(user_id, conversation_id)
            return {"id": conversation_id, "title": doc.get("title", "Conversation")}

        title = title_seed.strip().replace("\n", " ")
        if len(title) > 60:
            title = title[:57] + "..."
        now = datetime.utcnow()
        result = await collection.insert_one({
            "user_id": user_id,
            "title": title or "New conversation",
            "created_at": now,
            "updated_at": now,
        })
        return {"id": str(result.inserted_id), "title": title}

    @staticmethod
    async def _require_conversation(user_id: str, conversation_id: str) -> Dict[str, Any]:
        try:
            oid = ObjectId(conversation_id)
        except Exception:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
        doc = await get_chat_conversations_collection().find_one(
            {"_id": oid, "user_id": user_id}
        )
        if not doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
        return doc

    @staticmethod
    async def _load_history(user_id: str, conversation_id: str) -> List[Dict[str, Any]]:
        cursor = get_chat_messages_collection().find(
            {"conversation_id": conversation_id, "user_id": user_id}
        ).sort("created_at", -1).limit(HISTORY_LIMIT)
        docs = await cursor.to_list(length=HISTORY_LIMIT)
        docs.reverse()
        return [{"role": d["role"], "content": d["content"]} for d in docs]

    @staticmethod
    async def _classify(
        user_id: str,
        message: str,
        history: List[Dict[str, Any]],
        preferred_provider: Optional[str],
    ) -> Dict[str, Any]:
        context = ""
        if history:
            last = history[-1]
            context = f"(Previous {last['role']} message, for context: {last['content'][:400]})\n\n"
        try:
            classification, _ = await AIService.generate_json(
                user_id,
                CLASSIFIER_SYSTEM_PROMPT,
                context + "User message:\n" + message[:6000],
                preferred_provider=preferred_provider,
            )
            return classification
        except HTTPException as e:
            # 400 = no API keys configured — surface that to the user directly
            if e.status_code == status.HTTP_400_BAD_REQUEST:
                raise
            logger.warning(f"Intent classification failed, defaulting to chat: {e.detail}")
            return {"intent": "general_chat"}

    @staticmethod
    def _build_system_prompt(
        intent: str,
        retrieved: List[Dict[str, Any]],
        company_brief: Optional[Dict[str, Any]],
        full_profile_text: Optional[str] = None,
    ) -> str:
        # Writing tasks get the whole profile; everything else gets the RAG sample.
        profile_context = full_profile_text if full_profile_text is not None \
            else RAGService.format_context(retrieved)

        company_context = ""
        if company_brief:
            lines = [f"COMPANY RESEARCH ({company_brief.get('name')}):"]
            for key in ("overview", "industry", "headquarters", "company_size", "website",
                        "careers_url", "jobs_url"):
                value = company_brief.get(key)
                if value:
                    lines.append(f"- {key}: {value}")
            for key in ("products_services", "culture_and_values", "recent_highlights",
                        "talking_points"):
                values = company_brief.get(key) or []
                if values:
                    lines.append(f"- {key}: " + "; ".join(str(v) for v in values))
            company_context = "\n".join(lines)

        profile_header = (
            "USER'S FULL CAREER PROFILE" if full_profile_text is not None
            else "USER'S CAREER PROFILE (most relevant items)"
        )
        base = (
            "You are Prism, a sharp and supportive AI career assistant. You help the user "
            "with job applications, outreach, and career strategy.\n\n"
            "Ground every claim about the user in their profile data below — never invent "
            "experience, skills, employers, or metrics they don't have. If their profile "
            "lacks something relevant, say so and suggest adding it.\n\n"
            f"{profile_header}:\n{profile_context}\n"
        )
        if company_context:
            base += f"\n{company_context}\n"

        intent_instructions = {
            "generate_email": (
                "\nTASK: Write a job application / outreach email.\n"
                "- Start with a suggested subject line (as 'Subject: ...').\n"
                "- Keep the body under 180 words: hook, 2-3 concrete proof points drawn "
                "from the user's real experience matched to the role, and a confident, "
                "low-friction call to action.\n"
                "- Weave in one specific company detail from the research if available — "
                "it should feel researched, not templated.\n"
                "- Sound like a strong human candidate: direct, warm, zero clichés "
                "('I am writing to express...' is banned).\n"
                "- After the email, add a short '---' separated note listing what you "
                "personalized and anything the user should verify or fill in."
            ),
            "generate_cover_letter": (
                "\nTASK: Write a cover letter (3-4 short paragraphs).\n"
                "- Open with genuine specificity about the company/role, not flattery.\n"
                "- Middle paragraphs: map the user's strongest real experience to the "
                "role's needs with concrete outcomes.\n"
                "- Close with confidence and a clear next step.\n"
                "- No fabrication. Use company research details where relevant."
            ),
            "company_research": (
                "\nTASK: Present a useful company brief for a job seeker.\n"
                "- Structure with short markdown headings: What they do, Why it matters "
                "for you, Culture signals, Recent highlights, Where to apply.\n"
                "- In 'Why it matters for you', connect the company to the user's actual "
                "background and target roles.\n"
                "- Include the careers/jobs URLs if found."
            ),
            "job_fit_analysis": (
                "\nTASK: Analyze how well the user fits the role described.\n"
                "- Give an honest fit assessment: strengths (with evidence from their "
                "profile), gaps, and how to position around the gaps.\n"
                "- End with 3 concrete next actions (e.g. resume tweaks, keywords to add, "
                "what to highlight in an email)."
            ),
            "profile_question": (
                "\nTASK: Answer using the user's profile data above. Be specific and cite "
                "which experience/project supports each point."
            ),
            "general_chat": (
                "\nTASK: Answer helpfully and concisely. Use the user's profile context "
                "when it's relevant; otherwise just be a great career copilot. Use "
                "markdown for structure when it helps readability."
            ),
        }
        return base + intent_instructions.get(intent, intent_instructions["general_chat"])
