from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routers import search, chat
from services.vector_store import vector_store
import uvicorn

app = FastAPI(
    title="Ecommerce AI Service",
    description="Enterprise-level AI service for Semantic Search, Recommendations, and RAG Assistant",
    version="1.0.0"
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(search.router)
app.include_router(chat.router)

@app.on_event("startup")
async def startup_event():
    """
    Initialize Qdrant collection on startup.
    """
    # Gemini embeddings are 3072 dimensions for models/gemini-embedding-001
    vector_store.ensure_collection(vector_size=3072)
    print("AI Service Started and Qdrant Collection Ready.")

@app.get("/")
async def root():
    return {"message": "AI Service is Online", "docs": "/docs"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
