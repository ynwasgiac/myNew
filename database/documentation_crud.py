# database/documentation_crud.py
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from typing import List, Optional
from .models import ModuleDocumentation


class ModuleDocumentationCRUD:
    """CRUD операции для документации модулей"""

    @staticmethod
    async def create_documentation(
            db: AsyncSession,
            name: str,
            description: str,
            module_category: Optional[str] = None,
            file_path: Optional[str] = None,
            example_usage: Optional[str] = None,
            parameters: Optional[dict] = None,
            created_by_user_id: Optional[int] = None
    ) -> ModuleDocumentation:
        """Создать новую документацию модуля"""
        doc = ModuleDocumentation(
            name=name,
            description=description,
            module_category=module_category,
            file_path=file_path,
            example_usage=example_usage,
            parameters=parameters,
            created_by_user_id=created_by_user_id
        )
        db.add(doc)
        await db.commit()
        await db.refresh(doc)
        return doc

    @staticmethod
    async def get_documentation_by_name(
            db: AsyncSession,
            name: str
    ) -> Optional[ModuleDocumentation]:
        """Получить документацию по имени модуля"""
        result = await db.execute(
            select(ModuleDocumentation).where(ModuleDocumentation.name == name)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_all_documentation(
            db: AsyncSession,
            category: Optional[str] = None,
            limit: int = 50,
            offset: int = 0
    ) -> List[ModuleDocumentation]:
        """Получить всю документацию с фильтрацией"""
        query = select(ModuleDocumentation)

        if category:
            query = query.where(ModuleDocumentation.module_category == category)

        query = query.offset(offset).limit(limit).order_by(ModuleDocumentation.name)

        result = await db.execute(query)
        return result.scalars().all()

    @staticmethod
    async def update_documentation(
            db: AsyncSession,
            name: str,
            **update_data
    ) -> Optional[ModuleDocumentation]:
        """Обновить документацию модуля"""
        stmt = (
            update(ModuleDocumentation)
            .where(ModuleDocumentation.name == name)
            .values(**update_data)
            .returning(ModuleDocumentation)
        )
        result = await db.execute(stmt)
        await db.commit()
        return result.scalar_one_or_none()

    @staticmethod
    async def delete_documentation(
            db: AsyncSession,
            name: str
    ) -> bool:
        """Удалить документацию модуля"""
        stmt = delete(ModuleDocumentation).where(ModuleDocumentation.name == name)
        result = await db.execute(stmt)
        await db.commit()
        return result.rowcount > 0


# documentation_routes.py - новый файл для роутов

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from pydantic import BaseModel
from database import get_db
from database.documentation_crud import ModuleDocumentationCRUD
from auth.dependencies import get_current_user, get_current_admin
from database.auth_models import User

router = APIRouter(prefix="/api/documentation", tags=["Module Documentation"])


# Схемы
class DocumentationCreate(BaseModel):
    name: str
    description: str
    module_category: Optional[str] = None
    file_path: Optional[str] = None
    example_usage: Optional[str] = None
    parameters: Optional[dict] = None


class DocumentationUpdate(BaseModel):
    description: Optional[str] = None
    module_category: Optional[str] = None
    file_path: Optional[str] = None
    example_usage: Optional[str] = None
    parameters: Optional[dict] = None


class DocumentationResponse(BaseModel):
    id: int
    name: str
    description: str
    module_category: Optional[str]
    file_path: Optional[str]
    example_usage: Optional[str]
    parameters: Optional[dict]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Эндпоинты
@router.get("/", response_model=List[DocumentationResponse])
async def get_all_documentation(
        category: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
        db: AsyncSession = Depends(get_db)
):
    """Получить всю документацию модулей"""
    docs = await ModuleDocumentationCRUD.get_all_documentation(
        db, category=category, limit=limit, offset=offset
    )
    return docs


@router.get("/{name}", response_model=DocumentationResponse)
async def get_documentation(
        name: str,
        db: AsyncSession = Depends(get_db)
):
    """Получить документацию конкретного модуля"""
    doc = await ModuleDocumentationCRUD.get_documentation_by_name(db, name)
    if not doc:
        raise HTTPException(status_code=404, detail="Documentation not found")
    return doc


@router.post("/", response_model=DocumentationResponse)
async def create_documentation(
        doc_data: DocumentationCreate,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_admin)  # Только админы
):
    """Создать новую документацию модуля"""
    # Проверяем, что модуль с таким именем не существует
    existing = await ModuleDocumentationCRUD.get_documentation_by_name(db, doc_data.name)
    if existing:
        raise HTTPException(status_code=400, detail="Documentation with this name already exists")

    doc = await ModuleDocumentationCRUD.create_documentation(
        db,
        name=doc_data.name,
        description=doc_data.description,
        module_category=doc_data.module_category,
        file_path=doc_data.file_path,
        example_usage=doc_data.example_usage,
        parameters=doc_data.parameters,
        created_by_user_id=current_user.id
    )
    return doc


@router.put("/{name}", response_model=DocumentationResponse)
async def update_documentation(
        name: str,
        doc_data: DocumentationUpdate,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_admin)  # Только админы
):
    """Обновить документацию модуля"""
    doc = await ModuleDocumentationCRUD.update_documentation(
        db, name, **doc_data.dict(exclude_unset=True)
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Documentation not found")
    return doc


@router.delete("/{name}")
async def delete_documentation(
        name: str,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_admin)  # Только админы
):
    """Удалить документацию модуля"""
    deleted = await ModuleDocumentationCRUD.delete_documentation(db, name)
    if not deleted:
        raise HTTPException(status_code=404, detail="Documentation not found")
    return {"message": "Documentation deleted successfully"}