import json
import re
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException, status

from ..models.api_keys import AIProvider
from ..services.api_key_service import APIKeyService
from .logging_service import get_logger

logger = get_logger("ai_service")

# Model tiers per provider, verified live against the real OpenAI/Gemini APIs
# (both a `models.list()`/`models.get()` check AND an actual minimal
# generation call) before being picked — see CHANGELOG for the full pricing
# comparison this was based on. Callers pick a "purpose", not a raw model
# string, so future upgrades happen in one place:
#
#   fast   — cheap/quick: intent classification, routing, internal decisions
#   chat   — the assistant's final user-facing reply
#   tailor — resume/cover-letter generation, tailoring, bullet coaching
#
# "fast" is intentionally left at the original baseline model for each
# provider. Any call site that doesn't explicitly pass `purpose=` defaults to
# "fast", so unmodified call sites (company research, inbound-reply drafting,
# etc.) keep their exact prior behavior — only the assistant chat and the
# resume/AI-Tailor paths were re-tiered.
OPENAI_MODEL_TIERS = {
    "fast": "gpt-5-mini",
    "chat": "gpt-5.6-luna",
    "tailor": "gpt-5.6-terra",
}
GEMINI_MODEL_TIERS = {
    "fast": "gemini-3-flash-preview",
    "chat": "gemini-3.5-flash",
    "tailor": "gemini-3.1-pro-preview",
}
# Claude wasn't part of this round's research (scoped to OpenAI/Gemini) — one
# tier for every purpose, unchanged from before.
CLAUDE_MODEL = "claude-opus-4-8"
CLAUDE_MODEL_TIERS = {"fast": CLAUDE_MODEL, "chat": CLAUDE_MODEL, "tailor": CLAUDE_MODEL}

_MODEL_TIERS: Dict[Any, Dict[str, str]] = {
    AIProvider.OPENAI: OPENAI_MODEL_TIERS,
    AIProvider.GEMINI: GEMINI_MODEL_TIERS,
    AIProvider.CLAUDE: CLAUDE_MODEL_TIERS,
}

# Kept for any external reference to "the" model per provider (e.g. the key
# validation endpoint, which just needs any one valid model name).
OPENAI_MODEL = OPENAI_MODEL_TIERS["fast"]
GEMINI_MODEL = GEMINI_MODEL_TIERS["fast"]


def _model_for(provider: AIProvider, purpose: str) -> str:
    tiers = _MODEL_TIERS.get(provider, OPENAI_MODEL_TIERS)
    return tiers.get(purpose, tiers["fast"])


# gemini-embedding-001 is listed by the API but fails on a real embed call —
# verified live; gemini-embedding-2 is the one that actually works.
OPENAI_EMBEDDING_MODEL = "text-embedding-3-small"
GEMINI_EMBEDDING_MODEL = "gemini-embedding-2"

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
    # Key validation — cheap metadata calls, never spend generation tokens
    # ------------------------------------------------------------------

    @staticmethod
    async def validate_key(provider: AIProvider, api_key: str) -> None:
        """
        Verify an API key actually works before it's persisted, using each
        provider's free/metadata-only endpoint (never a real generation call).
        Raises HTTPException(400) with a short reason on failure.
        """
        try:
            if provider == AIProvider.OPENAI:
                from openai import AsyncOpenAI
                client = AsyncOpenAI(api_key=api_key)
                await client.models.retrieve(OPENAI_MODEL)
            elif provider == AIProvider.GEMINI:
                from google import genai
                client = genai.Client(api_key=api_key)
                await client.aio.models.get(model=GEMINI_MODEL)
            elif provider == AIProvider.CLAUDE:
                from anthropic import AsyncAnthropic
                client = AsyncAnthropic(api_key=api_key)
                await client.models.retrieve(CLAUDE_MODEL)
            else:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported provider")
        except HTTPException:
            raise
        except Exception as e:
            logger.warning(f"API key validation failed for {provider.value}: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Could not verify this {provider.value} key — it may be invalid, "
                       f"revoked, or lack access. ({str(e)[:150]})",
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
        purpose: str = "fast",
    ) -> tuple[str, str]:
        """
        Generate text using the user's own API key.

        `purpose` selects the model tier ("fast" | "chat" | "tailor") — see
        the tier tables above. Defaults to "fast" so existing callers that
        don't specify one are unaffected.

        Returns:
            (generated_text, provider_used)
        """
        return await AIService.generate_chat(
            user_id,
            system_prompt,
            [{"role": "user", "content": user_prompt}],
            provider=provider,
            preferred_provider=preferred_provider,
            purpose=purpose,
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
        purpose: str = "fast",
    ) -> tuple[str, str]:
        """
        Multi-turn chat completion. `messages` is a list of
        {"role": "user"|"assistant", "content": str} dicts.

        `purpose` selects the model tier ("fast" | "chat" | "tailor").

        Returns:
            (generated_text, provider_used)
        """
        if provider is None:
            provider = await AIService._resolve_provider(user_id, preferred_provider)

        api_key = await AIService._get_user_key(user_id, provider)
        model = _model_for(provider, purpose)

        if provider == AIProvider.OPENAI:
            return await AIService._call_openai(api_key, system_prompt, messages, model), provider.value
        elif provider == AIProvider.GEMINI:
            return await AIService._call_gemini(api_key, system_prompt, messages, model), provider.value
        elif provider == AIProvider.CLAUDE:
            return await AIService._call_claude(api_key, system_prompt, messages, model), provider.value
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
        purpose: str = "fast",
    ) -> tuple[Dict[str, Any], str]:
        """
        Generate a JSON object. The system prompt must describe the expected
        schema; this method enforces JSON output where the provider supports
        it and robustly parses the response.

        `purpose` selects the model tier ("fast" | "chat" | "tailor").

        Returns:
            (parsed_json, provider_used)
        """
        provider = await AIService._resolve_provider(user_id, preferred_provider)
        api_key = await AIService._get_user_key(user_id, provider)
        model = _model_for(provider, purpose)

        json_instruction = (
            "\n\nRespond with ONLY a valid JSON object. No markdown fences, no commentary."
        )
        system_prompt = system_prompt + json_instruction

        messages = [{"role": "user", "content": user_prompt}]
        if provider == AIProvider.OPENAI:
            text = await AIService._call_openai(api_key, system_prompt, messages, model, json_mode=True)
        elif provider == AIProvider.GEMINI:
            text = await AIService._call_gemini(api_key, system_prompt, messages, model, json_mode=True)
        else:
            text = await AIService._call_claude(api_key, system_prompt, messages, model)

        parsed = AIService.parse_json_response(text)
        if parsed is None:
            # Log head AND tail — a cut-off tail is the signature of output-token
            # truncation, which the head alone can't show.
            logger.error(
                f"Failed to parse JSON from {provider.value} response "
                f"(len={len(text)}): head={text[:200]!r} tail={text[-200:]!r}"
            )
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
                from google import genai

                client = genai.Client(api_key=gemini_key)
                result = await client.aio.models.embed_content(
                    model=GEMINI_EMBEDDING_MODEL, contents=texts,
                )
                vectors = [e.values for e in result.embeddings]
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
        model: str = OPENAI_MODEL,
        json_mode: bool = False,
    ) -> str:
        """Call OpenAI Chat Completions API."""
        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=api_key)
            request_messages = [{"role": "system", "content": system_prompt}]
            request_messages.extend(messages)
            kwargs: Dict[str, Any] = {
                "model": model,
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
        model: str = GEMINI_MODEL,
        json_mode: bool = False,
    ) -> str:
        """Call Google Gemini API."""
        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=api_key)
            # Gemini uses "model" for assistant turns
            contents = [
                types.Content(
                    role="model" if m["role"] == "assistant" else "user",
                    parts=[types.Part.from_text(text=m["content"])],
                )
                for m in messages
            ]
            config = types.GenerateContentConfig(
                system_instruction=system_prompt,
                response_mime_type="application/json" if json_mode else None,
                # Explicit ceiling: thinking models draw reasoning tokens from the
                # same output budget, and tailor responses (e.g. full-resume
                # translations) can be very large. Without this the server-side
                # default applies and long JSON payloads get truncated mid-string.
                max_output_tokens=65536,
            )
            response = await client.aio.models.generate_content(
                model=model, contents=contents, config=config,
            )
            finish_reason = getattr(
                (response.candidates or [None])[0], "finish_reason", None
            ) if getattr(response, "candidates", None) else None
            if finish_reason is not None and "STOP" not in str(finish_reason):
                logger.warning(f"Gemini finished with reason {finish_reason} (model={model})")
            return response.text or ""
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
        model: str = CLAUDE_MODEL,
    ) -> str:
        """Call Anthropic Claude API."""
        try:
            from anthropic import AsyncAnthropic
            client = AsyncAnthropic(api_key=api_key)
            response = await client.messages.create(
                model=model,
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
