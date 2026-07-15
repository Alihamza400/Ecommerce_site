from fastapi import APIRouter, HTTPException
from models.schemas import DescriptionRequest, DescriptionResponse
from services.llm_service import llm_service

router = APIRouter(prefix="/assistant", tags=["Assistant Tools"])

@router.post("/generate-description", response_model=DescriptionResponse)
async def generate_description(request: DescriptionRequest):
    try:
        description = await llm_service.generate_product_description(
            name=request.name,
            brand=request.brand,
            category=request.category,
            keywords=request.keywords
        )
        return DescriptionResponse(description=description)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
