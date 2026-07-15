import httpx
import base64
from core.config import settings
from typing import List, Optional
import time
import json

OPENROUTER_BASE = "https://openrouter.ai/api/v1"
CHAT_MODEL = "openai/gpt-4o-mini"       # Fast, cheap, good quality
EMBEDDING_MODEL = "text-embedding-3-small"  # OpenAI-compatible embeddings

class LLMService:
    def __init__(self):
        self.api_key = settings.OPENROUTER_API_KEY
        if not self.api_key:
            raise ValueError("OPENROUTER_API_KEY is not set in environment variables")
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost",
            "X-Title": "ShopVerse AI"
        }
        self._rate_limit_until = 0

    def _is_rate_limited(self):
        return time.time() < self._rate_limit_until

    def _set_rate_limit(self, seconds=60):
        self._rate_limit_until = time.time() + seconds

    async def get_embeddings(self, text: str) -> List[float]:
        if self._is_rate_limited():
            raise Exception("Rate limited")
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    f"{OPENROUTER_BASE}/embeddings",
                    headers=self.headers,
                    json={"model": EMBEDDING_MODEL, "input": text}
                )
                data = resp.json()
                if "data" in data and len(data["data"]) > 0:
                    return data["data"][0]["embedding"]
                raise Exception(data.get("error", {}).get("message", "Unknown error"))
        except Exception as e:
            if "429" in str(e) or "rate" in str(e).lower():
                self._set_rate_limit()
            raise e

    async def get_chat_response(self, prompt: str, context: str = "") -> str:
        if self._is_rate_limited():
            return "I'm on a short break due to high demand. Please try again in a moment."
        messages = [{"role": "user", "content": f"{context}\n\n{prompt}" if context else prompt}]
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    f"{OPENROUTER_BASE}/chat/completions",
                    headers=self.headers,
                    json={"model": CHAT_MODEL, "messages": messages, "max_tokens": 300}
                )
                data = resp.json()
                if "choices" in data and len(data["choices"]) > 0:
                    return data["choices"][0]["message"]["content"]
                return "I'm having trouble processing your request right now."
        except Exception as e:
            if "429" in str(e) or "rate" in str(e).lower():
                self._set_rate_limit()
                return "I'm on a short break due to high demand. Please try again in a moment."
            return "I'm having trouble connecting. Please try again later."

    async def describe_image(self, image_data: str) -> str:
        if self._is_rate_limited():
            raise Exception("Rate limited")
        try:
            # Use gpt-4o-mini which supports vision
            image_url = image_data  # base64 data URL
            messages = [{
                "role": "user",
                "content": [
                    {"type": "text", "text": "Describe this product image in 1-2 sentences. Include: item type, color, material, style."},
                    {"type": "image_url", "image_url": {"url": image_url}}
                ]
            }]
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    f"{OPENROUTER_BASE}/chat/completions",
                    headers=self.headers,
                    json={"model": "openai/gpt-4o-mini", "messages": messages, "max_tokens": 200}
                )
                data = resp.json()
                if "choices" in data and len(data["choices"]) > 0:
                    return data["choices"][0]["message"]["content"]
                raise Exception("No response")
        except Exception as e:
            if "429" in str(e) or "rate" in str(e).lower():
                self._set_rate_limit()
            raise e

    async def generate_product_description(self, name: str, brand: Optional[str], category: Optional[str], keywords: Optional[str]) -> str:
        if self._is_rate_limited():
            return f"{name} — Premium quality product from {brand or 'our store'}."
        prompt = (
            f"Write a professional SEO product description.\n"
            f"Product: {name}\nBrand: {brand or 'Generic'}\nCategory: {category or 'General'}\n"
            f"Keywords: {keywords or 'quality, durable'}\n"
            f"Format: 2-3 paragraphs, max 150 words"
        )
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    f"{OPENROUTER_BASE}/chat/completions",
                    headers=self.headers,
                    json={"model": CHAT_MODEL, "messages": [{"role": "user", "content": prompt}], "max_tokens": 300}
                )
                data = resp.json()
                if "choices" in data and len(data["choices"]) > 0:
                    return data["choices"][0]["message"]["content"].strip()
                return f"{name} — Premium quality product from {brand or 'our store'}."
        except Exception as e:
            if "429" in str(e) or "rate" in str(e).lower():
                self._set_rate_limit()
            return f"{name} — Premium quality product from {brand or 'our store'}."

llm_service = LLMService()
