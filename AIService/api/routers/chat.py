from fastapi import APIRouter, HTTPException
from models.schemas import ChatRequest, ChatResponse
from services.llm_service import llm_service
from services.vector_store import vector_store

router = APIRouter(prefix="/chat", tags=["Assistant"])

@router.post("/assistant", response_model=ChatResponse)
async def ai_assistant(request: ChatRequest):
    """
    RAG-based AI Assistant.
    Retrieves product context from Qdrant and generates a response via Gemini.
    """
    try:
        # 1. Get the last user message
        user_message = next((m.content for m in reversed(request.messages) if m.role == "user"), "")
        
        # 2. Retrieve relevant products as context
        query_vector = await llm_service.get_embeddings(user_message)
        relevant_products = await vector_store.search_similar(query_vector, limit=3)
        
        context_parts = []
        context_parts = []
        for p in relevant_products:
            meta = p["metadata"]
            context_parts.append(f"--- Product Detail ---\nName: {meta['name']}\nBrand: {meta.get('brand', 'N/A')}\nPrice: ${meta['price']}\nCategory: {meta['category']}\nDescription: {meta.get('description', 'No description available.')}\n")
        
        context = "\n".join(context_parts)
        
        # 3. Generate response using Gemini
        system_prompt = (
            "You are ShopVerse's friendly AI Shopping Concierge. "
            "Your personality is: Warm, Human, and Professional. "
            "Guidelines:\n"
            "1. BE CONVERSATIONAL: Talk like a helpful friend who knows the products inside out. Use natural, human phrasing.\n"
            "2. BE CONCISE: Keep your answers snappy and easy to read. Avoid blocks of text.\n"
            "3. BE HELPFUL: Use the provided [Product Catalog] context to give real advice, not just data.\n"
            "4. LOOK GORGEOUS: Use emojis and bold text to keep the vibe modern and premium.\n"
            "If someone says 'hello', greet them warmly. If they ask for a product, show your enthusiasm for the best match!"
        )
        
        full_context = f"{system_prompt}\n\n[Product Catalog]:\n{context}"
        
        # We simplify chat history for now, but in enterprise we'd pass full history
        reply = await llm_service.get_chat_response(user_message, context=full_context)
        
        return ChatResponse(reply=reply)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
