import google.generativeai as genai
from core.config import settings
from typing import List

class LLMService:
    def __init__(self):
        if not settings.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY is not set in environment variables")
        genai.configure(api_key=settings.GEMINI_API_KEY)
        self.model = genai.GenerativeModel('models/gemini-flash-latest')
        self.embedding_model = "models/gemini-embedding-001"

    async def get_embeddings(self, text: str) -> List[float]:
        """
        Generate embeddings for a given text using Gemini.
        """
        try:
            result = genai.embed_content(
                model=self.embedding_model,
                content=text,
                task_type="retrieval_document"
            )
            return result['embedding']
        except Exception as e:
            print(f"Error generating embeddings: {e}")
            raise e

    async def get_chat_response(self, prompt: str, context: str = "") -> str:
        """
        Generate a chat response using Gemini with provided context.
        """
        full_prompt = f"Context: {context}\n\nUser Question: {prompt}" if context else prompt
        try:
            response = self.model.generate_content(full_prompt)
            return response.text
        except Exception as e:
            print(f"Error generating chat response: {e}")
            raise e

llm_service = LLMService()
