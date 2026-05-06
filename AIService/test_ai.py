import asyncio
from services.llm_service import llm_service
from services.vector_store import vector_store
from core.config import settings
import sys

async def verify_ai_stack():
    print("--- AI Stack Health Check ---")
    
    # 1. Check Gemini API
    print("1. Testing Gemini API (Embeddings)... ", end="", flush=True)
    try:
        test_vector = await llm_service.get_embeddings("Health check test query")
        if test_vector and len(test_vector) == 3072:
            print("OK - SUCCESS (3072-dim vector generated)")
        else:
            print(f"FAILED (Vector size: {len(test_vector) if test_vector else 'None'})")
    except Exception as e:
        print(f"FAILED: {e}")
        return

    # 2. Check Qdrant Connection
    print(f"2. Testing Qdrant Connection ({settings.QDRANT_HOST}:{settings.QDRANT_PORT})... ", end="", flush=True)
    try:
        vector_store.ensure_collection(vector_size=3072)
        collections = vector_store.client.get_collections().collections
        print(f"OK - SUCCESS ({len(collections)} collections found)")
    except Exception as e:
        print(f"FAILED: {e}")
        print("\n[TIP] Make sure Qdrant is running via Docker or Cloud.")
        return

    # 3. Check Collection Status
    print(f"3. Verifying '{settings.PRODUCTS_COLLECTION}' Collection... ", end="", flush=True)
    try:
        info = vector_store.client.get_collection(settings.PRODUCTS_COLLECTION)
        print(f"OK - READY (Points indexed: {info.points_count})")
        if info.points_count == 0:
            print("   WARNING: Collection is empty. Run 'php Backend/sync_ai.php' to add products.")
    except Exception as e:
        print(f"FAILED: {e}")
        return

    print("\n--- All Systems Operational! ---")
    print("Your Semantic Search and RAG Assistant are ready to go.")

if __name__ == "__main__":
    asyncio.run(verify_ai_stack())
