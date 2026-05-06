from pydantic_settings import BaseSettings
from dotenv import load_dotenv
import os

load_dotenv()

class Settings(BaseSettings):
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    QDRANT_HOST: str = os.getenv("QDRANT_HOST", "localhost")
    QDRANT_PORT: int = int(os.getenv("QDRANT_PORT", "6333"))
    QDRANT_URL: str | None = os.getenv("QDRANT_URL")
    QDRANT_API_KEY: str | None = os.getenv("QDRANT_API_KEY")
    
    # Collection names for Qdrant
    PRODUCTS_COLLECTION: str = "products"

settings = Settings()
