from fastapi import APIRouter, HTTPException
from models.schemas import ProductSchema, SearchQuery, SearchResult, ImageSearchRequest
from services.llm_service import llm_service
from services.vector_store import vector_store
from typing import List

router = APIRouter(prefix="/search", tags=["Search"])

@router.post("/index-product")
async def index_product(product: ProductSchema):
    text_to_embed = f"Product: {product.name}. Brand: {product.brand}. Category: {product.category}. Description: {product.description}"
    try:
        vector = await llm_service.get_embeddings(text_to_embed)
        await vector_store.upsert_product(
            product_id=product.id,
            vector=vector,
            payload={
                "name": product.name,
                "brand": product.brand,
                "category": product.category,
                "price": product.price,
                "description": product.description,
                "image_url": product.image_url
            }
        )
        return {"status": "success", "message": f"Product {product.id} indexed"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/semantic", response_model=List[SearchResult])
async def semantic_search(query: SearchQuery):
    try:
        query_vector = await llm_service.get_embeddings(query.query)
        results = await vector_store.search_similar(query_vector, limit=query.limit)
        return [
            SearchResult(
                product_id=res["product_id"],
                score=res["score"],
                name=res["metadata"].get("name", ""),
                price=res["metadata"].get("price"),
                brand=res["metadata"].get("brand"),
                category=res["metadata"].get("category"),
                image_url=res["metadata"].get("image_url")
            ) for res in results
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/image-search", response_model=List[SearchResult])
async def image_search(request: ImageSearchRequest):
    try:
        description = await llm_service.describe_image(request.image_data)
        query_vector = await llm_service.get_embeddings(description)
        results = await vector_store.search_similar(query_vector, limit=request.limit)
        return [
            SearchResult(
                product_id=res["product_id"],
                score=res["score"],
                name=res["metadata"].get("name", ""),
                price=res["metadata"].get("price"),
                brand=res["metadata"].get("brand"),
                category=res["metadata"].get("category"),
                image_url=res["metadata"].get("image_url")
            ) for res in results
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
