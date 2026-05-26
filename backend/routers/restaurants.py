from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from database import get_db
import models
import schemas

router = APIRouter(prefix="/restaurants", tags=["Restaurantes"])


@router.get("/", response_model=List[schemas.RestaurantResponse])
def get_restaurants(db: Session = Depends(get_db)):
    # Listado completo para catalogo inicial de la app.
    return db.query(models.Restaurant).all()


@router.get("/{restaurant_id}", response_model=schemas.RestaurantResponse)
def get_restaurant(restaurant_id: str, db: Session = Depends(get_db)):
    restaurant = db.query(models.Restaurant).filter(
        models.Restaurant.id == restaurant_id
    ).first()
    if not restaurant:
        # Respuesta explicita para diferenciar "sin datos" de error interno.
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Restaurante '{restaurant_id}' no encontrado",
        )
    return restaurant


@router.post("/", response_model=schemas.RestaurantResponse, status_code=status.HTTP_201_CREATED)
def create_restaurant(data: schemas.RestaurantCreate, db: Session = Depends(get_db)):
    # Protege la creación validando unicidad antes de persistir el restaurante.
    # Validacion preventiva para mantener unicidad por id de restaurante.
    existing = db.query(models.Restaurant).filter(models.Restaurant.id == data.id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Ya existe un restaurante con id '{data.id}'",
        )
    restaurant = models.Restaurant(**data.model_dump())
    db.add(restaurant)
    db.commit()
    db.refresh(restaurant)
    return restaurant


@router.put("/{restaurant_id}", response_model=schemas.RestaurantResponse)
def update_restaurant(
    restaurant_id: str, data: schemas.RestaurantCreate, db: Session = Depends(get_db)
):
    # Reemplaza el estado persistido con el payload validado del restaurante.
    restaurant = db.query(models.Restaurant).filter(
        models.Restaurant.id == restaurant_id
    ).first()
    if not restaurant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Restaurante no encontrado")

    # Actualizacion campo a campo basada en el schema validado.
    for key, value in data.model_dump().items():
        setattr(restaurant, key, value)

    db.commit()
    db.refresh(restaurant)
    return restaurant


@router.delete("/{restaurant_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_restaurant(restaurant_id: str, db: Session = Depends(get_db)):
    restaurant = db.query(models.Restaurant).filter(
        models.Restaurant.id == restaurant_id
    ).first()
    if not restaurant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Restaurante no encontrado")
    db.delete(restaurant)
    db.commit()
