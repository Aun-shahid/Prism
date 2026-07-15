from typing import List

from fastapi import APIRouter, Depends

from ..auth.dependencies import get_current_active_user
from ..models.assistant import (
    ChatMessageResponse,
    ChatRequest,
    ChatResponse,
    ConversationSummary,
    KnowledgeStatusResponse,
    ReindexResponse,
)
from ..models.users import User
from ..services.agent_service import AgentService
from ..services.rag_service import RAGService

router = APIRouter(prefix="/assistant", tags=["assistant"])


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    current_user: User = Depends(get_current_active_user),
):
    """Send a message to the AI assistant (agentic pipeline with RAG + web research)."""
    result = await AgentService.chat(
        user_id=current_user.id,
        message=request.message,
        conversation_id=request.conversation_id,
        preferred_provider=request.preferred_provider,
    )
    return ChatResponse(**result)


@router.get("/conversations", response_model=List[ConversationSummary])
async def list_conversations(current_user: User = Depends(get_current_active_user)):
    return await AgentService.list_conversations(current_user.id)


@router.get("/conversations/{conversation_id}/messages", response_model=List[ChatMessageResponse])
async def get_conversation_messages(
    conversation_id: str,
    current_user: User = Depends(get_current_active_user),
):
    return await AgentService.get_messages(current_user.id, conversation_id)


@router.delete("/conversations/{conversation_id}", status_code=204)
async def delete_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_active_user),
):
    await AgentService.delete_conversation(current_user.id, conversation_id)


@router.get("/knowledge", response_model=KnowledgeStatusResponse)
async def knowledge_status(current_user: User = Depends(get_current_active_user)):
    """Status of the user's RAG knowledge base."""
    return await RAGService.get_index_status(current_user.id)


@router.post("/knowledge/reindex", response_model=ReindexResponse)
async def reindex_knowledge(current_user: User = Depends(get_current_active_user)):
    """Force-rebuild the knowledge base from the user's profile."""
    result = await RAGService.reindex(current_user.id)
    return ReindexResponse(
        doc_count=result["doc_count"],
        embedding_provider=result.get("embedding_provider"),
    )
