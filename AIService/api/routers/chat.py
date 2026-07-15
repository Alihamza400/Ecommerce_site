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
            "You are ShopVerse's professional AI Shopping Assistant. "
            "Rules:\n"
            "1. Be direct and concise. Answer in 2-3 sentences max.\n"
            "2. Only mention products from the [Product Catalog] below. Do not make up products.\n"
            "3. If asked about something not in the catalog, say 'We currently don\\'t have that in our catalog.'\n"
            "4. State the product name, price, and one key feature. No emojis, no fluff, no explanations about yourself.\n"
            "5. If the user just says hello, simply say 'Welcome to ShopVerse. How can I help you?'"
        )
        
        full_context = f"{system_prompt}\n\n[Product Catalog]:\n{context}"
        
        # We simplify chat history for now, but in enterprise we'd pass full history
        reply = await llm_service.get_chat_response(user_message, context=full_context)
        
        return ChatResponse(reply=reply)
    except Exception as e:
        error_msg = str(e)
        if "429" in error_msg or "quota" in error_msg.lower() or "rate" in error_msg.lower():
            return ChatResponse(reply="I'm on a short break due to high demand. Please try again in a moment.")
        return ChatResponse(reply="I'm having trouble connecting. Please try again later.")
