from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional

from database import get_db
import models
import schemas

router = APIRouter(prefix="/menus", tags=["Menú"])


@router.get("/", response_model=List[schemas.MenuItemResponse])
def get_menu_items(
    restaurant_id: Optional[str] = Query(None, description="Filtrar por restaurante"),
    categoria: Optional[str] = Query(None, description="Filtrar por categoría"),
    is_vegan: Optional[bool] = Query(None, description="Filtrar por opción vegana"),
    db: Session = Depends(get_db),
):
    # Compone una consulta dinámica para combinar filtros de menú en un solo endpoint.
    # Query dinamica para combinar filtros opcionales sin duplicar endpoints.
    query = db.query(models.MenuItem)

    if restaurant_id:
        query = query.filter(models.MenuItem.restaurant_id == restaurant_id)
    if categoria:
        query = query.filter(models.MenuItem.categoria == categoria)
    if is_vegan is not None:
        query = query.filter(models.MenuItem.is_vegan == is_vegan)

    return query.all()


@router.get("/{item_id}", response_model=schemas.MenuItemResponse)
def get_menu_item(item_id: str, db: Session = Depends(get_db)):
    item = db.query(models.MenuItem).filter(models.MenuItem.id == item_id).first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ítem de menú '{item_id}' no encontrado",
        )
    return item


@router.post("/", response_model=schemas.MenuItemResponse, status_code=status.HTTP_201_CREATED)
def create_menu_item(data: schemas.MenuItemCreate, db: Session = Depends(get_db)):
    # Valida unicidad e integridad referencial antes de persistir un nuevo ítem.
    # Evita colision de ids al crear catalogo manual o desde semillas.
    existing = db.query(models.MenuItem).filter(models.MenuItem.id == data.id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Ya existe un ítem con id '{data.id}'",
        )
    # Asegura integridad referencial: el restaurante destino debe existir.
    restaurant = db.query(models.Restaurant).filter(
        models.Restaurant.id == data.restaurant_id
    ).first()
    if not restaurant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Restaurante '{data.restaurant_id}' no encontrado",
        )
    item = models.MenuItem(**data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put("/{item_id}", response_model=schemas.MenuItemResponse)
def update_menu_item(item_id: str, data: schemas.MenuItemCreate, db: Session = Depends(get_db)):
    # Aplica una actualización completa del item usando el schema ya validado.
    item = db.query(models.MenuItem).filter(models.MenuItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ítem no encontrado")

    # El payload completo del schema reemplaza el estado actual del item.
    for key, value in data.model_dump().items():
        setattr(item, key, value)

    db.commit()
    db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_menu_item(item_id: str, db: Session = Depends(get_db)):
    item = db.query(models.MenuItem).filter(models.MenuItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ítem no encontrado")
    db.delete(item)
    db.commit()
