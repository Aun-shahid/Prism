"""
Lightweight RAG (retrieval-augmented generation) over the user's own career
data: profile summary, work experience, projects, education, skills and
certifications.

Storage: MongoDB (`rag_documents` + `rag_index_meta`). Vectors are embedded
with the user's OpenAI or Gemini key when available; retrieval degrades
gracefully to keyword scoring for Claude-only users (Anthropic has no
embeddings API). Corpora are tiny (dozens of docs), so scoring in Python is
plenty fast.
"""

import hashlib
import json
import math
import re
from datetime import datetime
from typing import Any, Dict, List, Optional

from ..database import get_rag_documents_collection, get_rag_index_meta_collection
from .ai_service import AIService
from .logging_service import get_logger
from .profile_service import ProfileService

logger = get_logger("rag_service")

_TOKEN_RE = re.compile(r"[a-z0-9+#.]{2,}")

_STOPWORDS = {
    "the", "and", "for", "with", "that", "this", "from", "have", "has", "was",
    "are", "were", "will", "would", "can", "could", "into", "about", "your",
    "our", "their", "them", "then", "than", "when", "what", "where", "which",
    "who", "how", "you", "not", "but", "all", "any", "its", "also", "been",
    "being", "over", "under", "such", "per", "via", "use", "used", "using",
}


def _tokenize(text: str) -> List[str]:
    return [t for t in _TOKEN_RE.findall(text.lower()) if t not in _STOPWORDS]


def _cosine(a: List[float], b: List[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


class RAGService:
    """Index + retrieve the user's career knowledge base."""

    # ------------------------------------------------------------------
    # Document building
    # ------------------------------------------------------------------

    @staticmethod
    def _build_documents(profile) -> List[Dict[str, Any]]:
        """Turn a UserProfile into small retrievable documents."""
        docs: List[Dict[str, Any]] = []

        def add(source: str, title: str, text: str) -> None:
            text = (text or "").strip()
            if text:
                docs.append({"source": source, "title": title, "text": text})

        intro_parts = []
        if profile.headline:
            intro_parts.append(f"Headline: {profile.headline}")
        if profile.summary:
            intro_parts.append(f"Summary: {profile.summary}")
        if profile.location:
            intro_parts.append(f"Location: {profile.location}")
        if profile.job_titles:
            intro_parts.append(f"Target roles: {', '.join(profile.job_titles)}")
        add("profile", "About me", "\n".join(intro_parts))

        if profile.skills:
            add("skills", "Skills", "Skills: " + ", ".join(profile.skills))

        if profile.languages:
            add("languages", "Languages", "Languages: " + ", ".join(profile.languages))

        for exp in profile.work_experience or []:
            period = f"{exp.start_date or '?'} – {exp.end_date or 'Present'}"
            lines = [f"{exp.title} at {exp.company} ({period})"]
            if exp.location:
                lines.append(f"Location: {exp.location}")
            if exp.description:
                lines.append(exp.description)
            for highlight in exp.highlights or []:
                lines.append(f"- {highlight}")
            add("experience", f"{exp.title} @ {exp.company}", "\n".join(lines))

        for project in profile.projects or []:
            lines = [f"Project: {project.name}"]
            if project.description:
                lines.append(project.description)
            if project.technologies:
                lines.append("Technologies: " + ", ".join(project.technologies))
            if project.url:
                lines.append(f"URL: {project.url}")
            add("project", project.name, "\n".join(lines))

        for edu in profile.education or []:
            lines = [f"{edu.degree} at {edu.institution}"]
            if edu.field_of_study:
                lines.append(f"Field: {edu.field_of_study}")
            if edu.gpa:
                lines.append(f"GPA: {edu.gpa}")
            if edu.description:
                lines.append(edu.description)
            add("education", f"{edu.degree} @ {edu.institution}", "\n".join(lines))

        for cert in profile.certifications or []:
            lines = [f"Certification: {cert.name} ({cert.issuer})"]
            if cert.date:
                lines.append(f"Date: {cert.date}")
            add("certification", cert.name, "\n".join(lines))

        return docs

    @staticmethod
    def _fingerprint(docs: List[Dict[str, Any]]) -> str:
        payload = json.dumps([(d["source"], d["title"], d["text"]) for d in docs], sort_keys=True)
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    # ------------------------------------------------------------------
    # Indexing
    # ------------------------------------------------------------------

    @staticmethod
    async def get_index_status(user_id: str) -> Dict[str, Any]:
        meta = await get_rag_index_meta_collection().find_one({"user_id": user_id})
        return {
            "indexed": meta is not None,
            "doc_count": (meta or {}).get("doc_count", 0),
            "embedding_provider": (meta or {}).get("embedding_provider"),
            "last_indexed": (meta or {}).get("updated_at"),
        }

    @staticmethod
    async def ensure_index(user_id: str) -> Dict[str, Any]:
        """Reindex only when the profile content has changed since last index."""
        profile = await ProfileService.get_or_create_profile(user_id)
        docs = RAGService._build_documents(profile)
        fingerprint = RAGService._fingerprint(docs)

        meta = await get_rag_index_meta_collection().find_one({"user_id": user_id})
        if meta and meta.get("fingerprint") == fingerprint:
            return {"reindexed": False, "doc_count": meta.get("doc_count", 0),
                    "embedding_provider": meta.get("embedding_provider")}

        return await RAGService._write_index(user_id, docs, fingerprint)

    @staticmethod
    async def reindex(user_id: str) -> Dict[str, Any]:
        """Force a full rebuild of the knowledge base."""
        profile = await ProfileService.get_or_create_profile(user_id)
        docs = RAGService._build_documents(profile)
        fingerprint = RAGService._fingerprint(docs)
        return await RAGService._write_index(user_id, docs, fingerprint)

    @staticmethod
    async def _write_index(user_id: str, docs: List[Dict[str, Any]], fingerprint: str) -> Dict[str, Any]:
        vectors, provider = (None, None)
        if docs:
            vectors, provider = await AIService.embed_texts(user_id, [d["text"] for d in docs])

        now = datetime.utcnow()
        records = []
        for i, doc in enumerate(docs):
            records.append({
                "user_id": user_id,
                "source": doc["source"],
                "title": doc["title"],
                "text": doc["text"],
                "embedding": vectors[i] if vectors else None,
                "embedding_provider": provider,
                "created_at": now,
            })

        collection = get_rag_documents_collection()
        await collection.delete_many({"user_id": user_id})
        if records:
            await collection.insert_many(records)

        await get_rag_index_meta_collection().update_one(
            {"user_id": user_id},
            {"$set": {
                "fingerprint": fingerprint,
                "doc_count": len(records),
                "embedding_provider": provider,
                "updated_at": now,
            }},
            upsert=True,
        )
        logger.info(f"RAG index rebuilt for user {user_id}: {len(records)} docs "
                    f"(embeddings: {provider or 'keyword-only'})")
        return {"reindexed": True, "doc_count": len(records), "embedding_provider": provider}

    # ------------------------------------------------------------------
    # Retrieval
    # ------------------------------------------------------------------

    @staticmethod
    async def retrieve(user_id: str, query: str, k: int = 6) -> List[Dict[str, Any]]:
        """
        Return the top-k most relevant documents for the query, each as
        {"source", "title", "text", "score"}.
        """
        await RAGService.ensure_index(user_id)

        cursor = get_rag_documents_collection().find({"user_id": user_id})
        docs = await cursor.to_list(length=500)
        if not docs:
            return []

        # Keyword scores (always computed)
        query_tokens = set(_tokenize(query))
        doc_tokens = [set(_tokenize(d["text"] + " " + d["title"])) for d in docs]
        n_docs = len(docs)
        df: Dict[str, int] = {}
        for tokens in doc_tokens:
            for token in tokens:
                df[token] = df.get(token, 0) + 1

        keyword_scores = []
        for tokens in doc_tokens:
            matched = query_tokens & tokens
            score = sum(math.log(1 + n_docs / (1 + df.get(t, 0))) for t in matched)
            keyword_scores.append(score)

        # Vector scores when possible
        vector_scores: Optional[List[float]] = None
        provider = docs[0].get("embedding_provider")
        if provider and all(d.get("embedding") for d in docs):
            query_vectors, query_provider = await AIService.embed_texts(user_id, [query])
            if query_vectors and query_provider == provider:
                query_vec = query_vectors[0]
                vector_scores = [_cosine(query_vec, d["embedding"]) for d in docs]

        def normalize(scores: List[float]) -> List[float]:
            lo, hi = min(scores), max(scores)
            if hi - lo < 1e-9:
                return [0.0 for _ in scores]
            return [(s - lo) / (hi - lo) for s in scores]

        if vector_scores is not None:
            kw_norm = normalize(keyword_scores)
            vec_norm = normalize(vector_scores)
            combined = [0.65 * v + 0.35 * w for v, w in zip(vec_norm, kw_norm)]
        else:
            combined = normalize(keyword_scores)

        ranked = sorted(zip(docs, combined), key=lambda pair: pair[1], reverse=True)
        results = []
        for doc, score in ranked[:k]:
            if score <= 0:
                continue
            results.append({
                "source": doc["source"],
                "title": doc["title"],
                "text": doc["text"],
                "score": round(score, 4),
            })
        # If nothing scored (e.g. very generic query), return the first few docs
        if not results:
            results = [{
                "source": d["source"], "title": d["title"], "text": d["text"], "score": 0.0,
            } for d in docs[:min(k, 4)]]
        return results

    @staticmethod
    def format_context(documents: List[Dict[str, Any]]) -> str:
        """Render retrieved docs as a context block for prompts."""
        if not documents:
            return "(no profile data indexed yet)"
        blocks = []
        for doc in documents:
            blocks.append(f"[{doc['source'].upper()}] {doc['title']}\n{doc['text']}")
        return "\n\n".join(blocks)
