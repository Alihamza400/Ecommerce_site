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
    price: Optional[float] = None
    brand: Optional[str] = None
    category: Optional[str] = None
    image_url: Optional[str] = None

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]

class ChatResponse(BaseModel):
    reply: str

class ImageSearchRequest(BaseModel):
    image_data: str
    limit: int = 5

class DescriptionRequest(BaseModel):
    name: str
    brand: Optional[str] = None
    category: Optional[str] = None
    keywords: Optional[str] = None

class DescriptionResponse(BaseModel):
    description: str
