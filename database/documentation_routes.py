# api/preferences_routes.py
from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional, Dict, Any
from datetime import datetime

from database.connection import get_db
from database.models import ModuleDocumentation, ModuleDocumentationTranslation
from database.user_preferences_crud import UserPreferencesCRUD
from database.user_preferences_schemas import (
    # Create schemas
    PreferencesCreate, NotificationSettingsCreate,

    # Update schemas
    PreferencesUpdate, NotificationSettingsUpdate, QuizSettingsUpdate,
    LearningSettingsUpdate, PracticeSettingsUpdate,

    # Response schemas
    PreferencesResponse, PreferencesWithUserResponse, NotificationSettingsResponse,
    DefaultPreferencesResponse, PreferencesStatsResponse, PreferencesValidationResponse,
    PreferencesValidationError,

    # Bulk operation schemas
    BulkPreferencesUpdate, BulkPreferencesResponse,

    # Export/Import schemas
    PreferencesExport, PreferencesImport, PreferencesImportResponse
)
from database.auth_models import User
from auth.dependencies import get_current_user, get_current_admin

router = APIRouter(prefix="/api/documentation", tags=["Project Documentation"])


@router.get("/{name}/description")
async def get_module_description(
        name: str,
        lang: str = Query('ru', description="Language code (en, ru, kk)"),
        db: AsyncSession = Depends(get_db)
):
    """
    Получить только описание модуля по имени
    Простое API для быстрого доступа к описанию
    """
    try:
        # Сначала ищем основную документацию
        doc_result = await db.execute(
            select(ModuleDocumentation)
            .where(ModuleDocumentation.name == name)
        )
        doc = doc_result.scalar_one_or_none()

        if not doc:
            raise HTTPException(status_code=404, detail=f"Module '{name}' not found")

        # Если запрашивается английский или перевод не нужен
        if lang == 'en':
            return {
                "name": name,
                "description": doc.description,
                "language": "en"
            }

        # Ищем перевод на нужный язык
        translation_result = await db.execute(
            select(ModuleDocumentationTranslation.description)
            .where(
                ModuleDocumentationTranslation.module_documentation_id == doc.id,
                ModuleDocumentationTranslation.language_code == lang
            )
        )
        translation_desc = translation_result.scalar_one_or_none()

        if translation_desc:
            return {
                "name": name,
                "description": translation_desc,
                "language": lang
            }
        else:
            # Fallback к английскому, если перевода нет
            return {
                "name": name,
                "description": doc.description,
                "language": "en",
                "fallback": True,
                "message": f"Translation for '{lang}' not found, showing English version"
            }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving description: {str(e)}")


@router.get("/{name}/description/plain")
async def get_module_description_plain_text(
        name: str,
        lang: str = Query('ru', description="Language code (en, ru, kk)"),
        db: AsyncSession = Depends(get_db)
):
    """
    Получить только текст описания модуля (plain text response)
    Удобно для простого отображения или логирования
    """
    try:
        # Получаем описание
        doc_result = await db.execute(
            select(ModuleDocumentation)
            .where(ModuleDocumentation.name == name)
        )
        doc = doc_result.scalar_one_or_none()

        if not doc:
            raise HTTPException(status_code=404, detail=f"Module '{name}' not found")

        # Если английский
        if lang == 'en':
            return Response(content=doc.description, media_type="text/plain")

        # Ищем перевод
        translation_result = await db.execute(
            select(ModuleDocumentationTranslation.description)
            .where(
                ModuleDocumentationTranslation.module_documentation_id == doc.id,
                ModuleDocumentationTranslation.language_code == lang
            )
        )
        translation_desc = translation_result.scalar_one_or_none()

        # Возвращаем перевод или fallback к английскому
        description = translation_desc if translation_desc else doc.description
        return Response(content=description, media_type="text/plain")

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


@router.get("/search")
async def search_modules_by_description(
        query: str = Query(..., min_length=3, description="Search query"),
        lang: str = Query('ru', description="Language code (en, ru, kk)"),
        limit: int = Query(10, ge=1, le=50),
        db: AsyncSession = Depends(get_db)
):
    """
    Поиск модулей по описанию
    Ищет в описаниях на указанном языке или английском
    """
    try:
        # Поиск в основных описаниях (английский)
        main_search = await db.execute(
            select(ModuleDocumentation.name, ModuleDocumentation.description)
            .where(ModuleDocumentation.description.ilike(f"%{query}%"))
            .limit(limit)
        )
        main_results = main_search.all()

        # Поиск в переводах (если язык не английский)
        translation_results = []
        if lang != 'en':
            trans_search = await db.execute(
                select(
                    ModuleDocumentation.name,
                    ModuleDocumentationTranslation.description
                )
                .join(ModuleDocumentationTranslation)
                .where(
                    ModuleDocumentationTranslation.language_code == lang,
                    ModuleDocumentationTranslation.description.ilike(f"%{query}%")
                )
                .limit(limit)
            )
            translation_results = trans_search.all()

        # Объединяем результаты
        results = []

        # Добавляем результаты из переводов
        for name, description in translation_results:
            results.append({
                "name": name,
                "description": description[:200] + "..." if len(description) > 200 else description,
                "language": lang,
                "source": "translation"
            })

        # Добавляем результаты из английского (если не дубликаты)
        existing_names = {r["name"] for r in results}
        for name, description in main_results:
            if name not in existing_names:
                results.append({
                    "name": name,
                    "description": description[:200] + "..." if len(description) > 200 else description,
                    "language": "en",
                    "source": "original"
                })

        return {
            "query": query,
            "language": lang,
            "found": len(results),
            "results": results[:limit]
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search error: {str(e)}")