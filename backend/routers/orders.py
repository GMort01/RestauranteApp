from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from typing import List

from database import get_db
import models
import schemas

router = APIRouter(prefix="/orders", tags=["Pedidos"])


@router.get("/", response_model=List[schemas.OrderResponse])
def get_orders(db: Session = Depends(get_db)):
    # joinedload evita N+1 queries al serializar items y menu_item.
    return (
        db.query(models.Order)
        .options(joinedload(models.Order.items).joinedload(models.OrderItem.menu_item))
        .order_by(models.Order.created_at.desc())
        .all()
    )


@router.get("/{order_id}", response_model=schemas.OrderResponse)
def get_order(order_id: int, db: Session = Depends(get_db)):
    order = (
        db.query(models.Order)
        .options(joinedload(models.Order.items).joinedload(models.OrderItem.menu_item))
        .filter(models.Order.id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pedido #{order_id} no encontrado",
        )
    return order


@router.post("/", response_model=schemas.OrderResponse, status_code=status.HTTP_201_CREATED)
def create_order(data: schemas.OrderCreate, db: Session = Depends(get_db)):
    if not data.items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El pedido debe tener al menos un ítem",
        )

    # El subtotal siempre se recalcula del lado servidor para evitar manipulacion.
    subtotal = 0.0

    # Validar ítems y calcular subtotal con precios del servidor
    for item_data in data.items:
        if item_data.quantity <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La cantidad de cada ítem debe ser mayor a 0",
            )

        menu_item = db.query(models.MenuItem).filter(
            models.MenuItem.id == item_data.menu_item_id
        ).first()
        if not menu_item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Ítem de menú '{item_data.menu_item_id}' no encontrado",
            )

        subtotal += float(menu_item.precio) * item_data.quantity

    # Se normaliza tip para no permitir valores negativos.
    tip = max(float(data.tip), 0.0)
    total = subtotal + tip

    order = models.Order(
        subtotal=subtotal,
        tip=tip,
        total=total,
    )
    db.add(order)
    # flush persiste temporalmente y permite usar order.id en OrderItem.
    db.flush()

    for item_data in data.items:
        order_item = models.OrderItem(
            order_id=order.id,
            menu_item_id=item_data.menu_item_id,
            quantity=item_data.quantity,
        )
        db.add(order_item)

    db.commit()
    db.refresh(order)

    # Recarga final para responder con el pedido completo y sus relaciones.
    order = (
        db.query(models.Order)
        .options(joinedload(models.Order.items).joinedload(models.OrderItem.menu_item))
        .filter(models.Order.id == order.id)
        .first()
    )
    return order


@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_order(order_id: int, db: Session = Depends(get_db)):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pedido no encontrado")
    db.delete(order)
    db.commit()
