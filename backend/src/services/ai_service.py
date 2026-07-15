import asyncio
import json
import re
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException, status

from ..models.api_keys import AIProvider
from ..services.api_key_service import APIKeyService
from .logging_service import get_logger

logger = get_logger("ai_service")

# Default model per provider. Kept in one place so upgrades are a one-line change.
OPENAI_MODEL = "gpt-5-mini"
GEMINI_MODEL = "gemini-3-flash-preview"
CLAUDE_MODEL = "claude-opus-4-8"

OPENAI_EMBEDDING_MODEL = "text-embedding-3-small"
GEMINI_EMBEDDING_MODEL = "models/text-embedding-004"

DEFAULT_MAX_TOKENS = 8192


class AIService:
    """Unified LLM interface. Users must bring their own API keys — no fallback."""

    @staticmethod
    async def _get_user_key(user_id: str, provider: AIProvider) -> str:
        """Retrieve the user's decrypted API key. Raises 400 if not configured."""
        key = await APIKeyService.get_decrypted_key(user_id, provider)
        if not key:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No active {provider.value} API key found. "
                       f"Please add your {provider.value} API key in Settings → API Keys.",
            )
        return key

    @staticmethod
    async def _resolve_provider(user_id: str, preferred: Optional[str] = None) -> AIProvider:
        """
        Resolve which AI provider to use.
        If preferred is set, use it. Otherwise try openai → gemini → claude.
        Raises 400 if no key is configured for any provider.
        """
        if preferred:
            try:
                provider = AIProvider(preferred)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Unknown AI provider: {preferred}. Use 'openai', 'gemini', or 'claude'.",
                )
            # Verify the key exists
            await AIService._get_user_key(user_id, provider)
            return provider

        # Try each provider in order
        for provider in [AIProvider.OPENAI, AIProvider.GEMINI, AIProvider.CLAUDE]:
            key = await APIKeyService.get_decrypted_key(user_id, provider)
            if key:
                return provider

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No AI API keys configured. Please add at least one API key (OpenAI, Gemini, or Claude) in Settings → API Keys.",
        )

    # ------------------------------------------------------------------
    # Text generation (single turn — kept for backwards compatibility)
    # ------------------------------------------------------------------

    @staticmethod
    async def generate_text(
        user_id: str,
        system_prompt: str,
        user_prompt: str,
        provider: Optional[AIProvider] = None,
        preferred_provider: Optional[str] = None,
    ) -> tuple[str, str]:
        """
        Generate text using the user's own API key.

        Returns:
            (generated_text, provider_used)
        """
        return await AIService.generate_chat(
            user_id,
            system_prompt,
            [{"role": "user", "content": user_prompt}],
            provider=provider,
            preferred_provider=preferred_provider,
        )

    # ------------------------------------------------------------------
    # Multi-turn chat
    # ------------------------------------------------------------------

    @staticmethod
    async def generate_chat(
        user_id: str,
        system_prompt: str,
        messages: List[Dict[str, str]],
        provider: Optional[AIProvider] = None,
        preferred_provider: Optional[str] = None,
    ) -> tuple[str, str]:
        """
        Multi-turn chat completion. `messages` is a list of
        {"role": "user"|"assistant", "content": str} dicts.

        Returns:
            (generated_text, provider_used)
        """
        if provider is None:
            provider = await AIService._resolve_provider(user_id, preferred_provider)

        api_key = await AIService._get_user_key(user_id, provider)

        if provider == AIProvider.OPENAI:
            return await AIService._call_openai(api_key, system_prompt, messages), provider.value
        elif provider == AIProvider.GEMINI:
            return await AIService._call_gemini(api_key, system_prompt, messages), provider.value
        elif provider == AIProvider.CLAUDE:
            return await AIService._call_claude(api_key, system_prompt, messages), provider.value
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported provider")

    # ------------------------------------------------------------------
    # Structured JSON generation
    # ------------------------------------------------------------------

    @staticmethod
    async def generate_json(
        user_id: str,
        system_prompt: str,
        user_prompt: str,
        preferred_provider: Optional[str] = None,
    ) -> tuple[Dict[str, Any], str]:
        """
        Generate a JSON object. The system prompt must describe the expected
        schema; this method enforces JSON output where the provider supports
        it and robustly parses the response.

        Returns:
            (parsed_json, provider_used)
        """
        provider = await AIService._resolve_provider(user_id, preferred_provider)
        api_key = await AIService._get_user_key(user_id, provider)

        json_instruction = (
            "\n\nRespond with ONLY a valid JSON object. No markdown fences, no commentary."
        )
        system_prompt = system_prompt + json_instruction

        messages = [{"role": "user", "content": user_prompt}]
        if provider == AIProvider.OPENAI:
            text = await AIService._call_openai(api_key, system_prompt, messages, json_mode=True)
        elif provider == AIProvider.GEMINI:
            text = await AIService._call_gemini(api_key, system_prompt, messages, json_mode=True)
        else:
            text = await AIService._call_claude(api_key, system_prompt, messages)

        parsed = AIService.parse_json_response(text)
        if parsed is None:
            logger.error(f"Failed to parse JSON from {provider.value} response: {text[:300]}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="The AI returned an unparseable response. Please try again.",
            )
        return parsed, provider.value

    @staticmethod
    def parse_json_response(text: str) -> Optional[Dict[str, Any]]:
        """Extract a JSON object from raw model output (handles code fences and prose)."""
        if not text:
            return None
        cleaned = text.strip()
        # Strip markdown fences
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
        try:
            result = json.loads(cleaned)
            return result if isinstance(result, dict) else None
        except (json.JSONDecodeError, ValueError):
            pass
        # Fall back to the outermost {...} span
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start != -1 and end > start:
            try:
                result = json.loads(cleaned[start:end + 1])
                return result if isinstance(result, dict) else None
            except (json.JSONDecodeError, ValueError):
                return None
        return None

    # ------------------------------------------------------------------
    # Embeddings (OpenAI / Gemini only — Anthropic has no embeddings API)
    # ------------------------------------------------------------------

    @staticmethod
    async def embed_texts(
        user_id: str,
        texts: List[str],
    ) -> Tuple[Optional[List[List[float]]], Optional[str]]:
        """
        Embed a list of texts using whichever embedding-capable provider the
        user has a key for. Returns (vectors, provider) or (None, None) when
        no embedding provider is available (e.g. Claude-only users) —
        callers should fall back to keyword retrieval.
        """
        if not texts:
            return [], None

        openai_key = await APIKeyService.get_decrypted_key(user_id, AIProvider.OPENAI)
        if openai_key:
            try:
                from openai import AsyncOpenAI
                client = AsyncOpenAI(api_key=openai_key)
                response = await client.embeddings.create(
                    model=OPENAI_EMBEDDING_MODEL,
                    input=texts,
                )
                vectors = [item.embedding for item in response.data]
                return vectors, AIProvider.OPENAI.value
            except Exception as e:
                logger.error(f"OpenAI embeddings failed: {e}")

        gemini_key = await APIKeyService.get_decrypted_key(user_id, AIProvider.GEMINI)
        if gemini_key:
            try:
                import google.generativeai as genai

                def _embed() -> List[List[float]]:
                    genai.configure(api_key=gemini_key)
                    result = genai.embed_content(model=GEMINI_EMBEDDING_MODEL, content=texts)
                    embedding = result["embedding"]
                    # Single input returns a flat vector; batch returns a list of vectors
                    if embedding and isinstance(embedding[0], (int, float)):
                        return [embedding]
                    return embedding

                vectors = await asyncio.to_thread(_embed)
                return vectors, AIProvider.GEMINI.value
            except Exception as e:
                logger.error(f"Gemini embeddings failed: {e}")

        return None, None

    # ------------------------------------------------------------------
    # Provider implementations
    # ------------------------------------------------------------------

    @staticmethod
    async def _call_openai(
        api_key: str,
        system_prompt: str,
        messages: List[Dict[str, str]],
        json_mode: bool = False,
    ) -> str:
        """Call OpenAI Chat Completions API."""
        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=api_key)
            request_messages = [{"role": "system", "content": system_prompt}]
            request_messages.extend(messages)
            kwargs: Dict[str, Any] = {
                "model": OPENAI_MODEL,
                "messages": request_messages,
                "max_completion_tokens": DEFAULT_MAX_TOKENS,
            }
            if json_mode:
                kwargs["response_format"] = {"type": "json_object"}
            response = await client.chat.completions.create(**kwargs)
            return response.choices[0].message.content or ""
        except Exception as e:
            logger.error(f"OpenAI API call failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"OpenAI API error: {str(e)}"
            )

    @staticmethod
    async def _call_gemini(
        api_key: str,
        system_prompt: str,
        messages: List[Dict[str, str]],
        json_mode: bool = False,
    ) -> str:
        """Call Google Gemini API."""
        try:
            import google.generativeai as genai

            def _generate() -> str:
                genai.configure(api_key=api_key)
                generation_config = {"response_mime_type": "application/json"} if json_mode else None
                model = genai.GenerativeModel(
                    model_name=GEMINI_MODEL,
                    system_instruction=system_prompt,
                    generation_config=generation_config,
                )
                # Gemini uses "model" for assistant turns
                history = [
                    {"role": "model" if m["role"] == "assistant" else "user", "parts": [m["content"]]}
                    for m in messages
                ]
                response = model.generate_content(history)
                return response.text

            return await asyncio.to_thread(_generate)
        except Exception as e:
            logger.error(f"Gemini API call failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Gemini API error: {str(e)}"
            )

    @staticmethod
    async def _call_claude(
        api_key: str,
        system_prompt: str,
        messages: List[Dict[str, str]],
    ) -> str:
        """Call Anthropic Claude API."""
        try:
            from anthropic import AsyncAnthropic
            client = AsyncAnthropic(api_key=api_key)
            response = await client.messages.create(
                model=CLAUDE_MODEL,
                max_tokens=DEFAULT_MAX_TOKENS,
                thinking={"type": "adaptive"},
                system=system_prompt,
                messages=messages,
            )
            # With adaptive thinking, content may include thinking blocks —
            # concatenate only the text blocks.
            parts = [block.text for block in response.content if block.type == "text"]
            return "\n".join(parts).strip()
        except Exception as e:
            logger.error(f"Claude API call failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Claude API error: {str(e)}"
            )
