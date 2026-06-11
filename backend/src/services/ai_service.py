from typing import Optional
from fastapi import HTTPException, status

from ..models.api_keys import AIProvider
from ..services.api_key_service import APIKeyService
from .logging_service import get_logger

logger = get_logger("ai_service")


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
        if provider is None:
            provider = await AIService._resolve_provider(user_id, preferred_provider)

        api_key = await AIService._get_user_key(user_id, provider)

        if provider == AIProvider.OPENAI:
            return await AIService._call_openai(api_key, system_prompt, user_prompt), provider.value
        elif provider == AIProvider.GEMINI:
            return await AIService._call_gemini(api_key, system_prompt, user_prompt), provider.value
        elif provider == AIProvider.CLAUDE:
            return await AIService._call_claude(api_key, system_prompt, user_prompt), provider.value
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported provider")

    @staticmethod
    async def _call_openai(api_key: str, system_prompt: str, user_prompt: str) -> str:
        """Call OpenAI Chat Completions API."""
        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=api_key)
            response = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.7,
                max_tokens=4096,
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"OpenAI API call failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"OpenAI API error: {str(e)}"
            )

    @staticmethod
    async def _call_gemini(api_key: str, system_prompt: str, user_prompt: str) -> str:
        """Call Google Gemini API."""
        try:
            import google.generativeai as genai
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel(
                model_name="gemini-3-flash-preview",
                system_instruction=system_prompt,
            )
            response = model.generate_content(user_prompt)
            return response.text
        except Exception as e:
            logger.error(f"Gemini API call failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Gemini API error: {str(e)}"
            )

    @staticmethod
    async def _call_claude(api_key: str, system_prompt: str, user_prompt: str) -> str:
        """Call Anthropic Claude API."""
        try:
            from anthropic import AsyncAnthropic
            client = AsyncAnthropic(api_key=api_key)
            response = await client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=4096,
                system=system_prompt,
                messages=[
                    {"role": "user", "content": user_prompt},
                ],
            )
            return response.content[0].text
        except Exception as e:
            logger.error(f"Claude API call failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Claude API error: {str(e)}"
            )
