# auth/heartbeat.py
from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from database.auth_models import User
from .token_refresh import get_current_user_with_refresh, TokenRefreshResponse

heartbeat_router = APIRouter(prefix="/auth", tags=["Heartbeat"])

@router.post("/heartbeat") 
async def heartbeat(
    response: Response,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_with_refresh)
):
    """Heartbeat для поддержания сессии"""
    TokenRefreshResponse.add_token_header(response, current_user)
    return {
        "status": "alive",
        "user_id": current_user.id,
        "timestamp": datetime.utcnow().isoformat()
    }