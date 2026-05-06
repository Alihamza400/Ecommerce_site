from pydantic import BaseModel
from typing import List, Optional

class ProductSchema(BaseModel):
    id: int
    name: str
    description: str
    brand: Optional[str] = None
    price: float
    category: str
    image_url: Optional[str] = None

class SearchQuery(BaseModel):
    query: str
    limit: int = 5

class SearchResult(BaseModel):
    product_id: int
    score: float
    name: str

class ChatMessage(BaseModel):
    role: str # "user" or "assistant"
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]

class ChatResponse(BaseModel):
    reply: str
