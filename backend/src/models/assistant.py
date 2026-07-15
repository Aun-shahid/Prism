from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    preferred_provider: Optional[str] = None  # "openai" | "gemini" | "claude"


class AgentStep(BaseModel):
    type: str  # "intent" | "retrieval" | "research" | "compose"
    label: str
    detail: Optional[str] = None


class ChatResponse(BaseModel):
    conversation_id: str
    reply: str
    intent: str
    steps: List[AgentStep] = []
    sources: List[str] = []
    company_research: Optional[Dict[str, Any]] = None
    provider_used: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ChatMessageResponse(BaseModel):
    id: str
    role: str  # "user" | "assistant"
    content: str
    intent: Optional[str] = None
    steps: List[AgentStep] = []
    sources: List[str] = []
    created_at: datetime

    class Config:
        populate_by_name = True


class ConversationSummary(BaseModel):
    id: str
    title: str
    updated_at: datetime
    created_at: datetime

    class Config:
        populate_by_name = True


class KnowledgeStatusResponse(BaseModel):
    indexed: bool
    doc_count: int
    embedding_provider: Optional[str] = None
    last_indexed: Optional[datetime] = None


class ReindexResponse(BaseModel):
    doc_count: int
    embedding_provider: Optional[str] = None
