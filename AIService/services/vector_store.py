from qdrant_client import QdrantClient
from qdrant_client.http import models as rest
from core.config import settings
from typing import List, Dict, Any

class VectorStore:
    def __init__(self):
        if settings.QDRANT_URL:
            self.client = QdrantClient(
                url=settings.QDRANT_URL,
                api_key=settings.QDRANT_API_KEY
            )
        else:
            self.client = QdrantClient(
                host=settings.QDRANT_HOST,
                port=settings.QDRANT_PORT
            )
        self.collection_name = settings.PRODUCTS_COLLECTION

    def ensure_collection(self, vector_size: int = 3072):
        """
        Ensure the Qdrant collection exists.
        Note: Gemini embedding-001 outputs 3072-dimensional vectors.
        """
        collections = self.client.get_collections().collections
        collection_names = [c.name for c in collections]
        
        if self.collection_name not in collection_names:
            self.client.recreate_collection(
                collection_name=self.collection_name,
                vectors_config=rest.VectorParams(
                    size=vector_size,
                    distance=rest.Distance.COSINE
                )
            )
            print(f"Collection {self.collection_name} created.")

    async def upsert_product(self, product_id: int, vector: List[float], payload: Dict[str, Any]):
        """
        Upsert a product vector and its metadata into Qdrant.
        """
        self.client.upsert(
            collection_name=self.collection_name,
            points=[
                rest.PointStruct(
                    id=product_id,
                    vector=vector,
                    payload=payload
                )
            ]
        )

    async def search_similar(self, vector: List[float], limit: int = 5) -> List[Dict[str, Any]]:
        """
        Search for similar products based on a vector.
        """
        # Using the modern query_points API
        search_result = self.client.query_points(
            collection_name=self.collection_name,
            query=vector,
            limit=limit
        ).points
        
        return [
            {
                "product_id": hit.id,
                "score": hit.score,
                "metadata": hit.payload
            } for hit in search_result
        ]

vector_store = VectorStore()
