import google.generativeai as genai
from core.config import settings
import os

genai.configure(api_key=settings.GEMINI_API_KEY)

print("Listing available models:")
for m in genai.list_models():
    if 'embedContent' in m.supported_generation_methods:
        print(f"Model: {m.name}")
