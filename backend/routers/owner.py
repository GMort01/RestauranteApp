from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import secrets
import uuid
from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from database import get_db
import models
import schemas

router = APIRouter(prefix="/owner", tags=["Owner"])

ALLOWED_ORDER_STATUSES = {"pending", "accepted", "preparing", "delivered", "cancelled"}
OWNER_TOKENS: dict[str, str] = {}


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _hash_password(password: str, salt: str) -> str:
    return hashlib.sha256(f"{salt}{password}".encode("utf-8")).hexdigest()


def _create_password_record(password: str) -> tuple[str, str]:
    salt = secrets.token_hex(16)
    return _hash_password(password, salt), salt


def _verify_password(password: str, password_hash: str, salt: str) -> bool:
    return hmac.compare_digest(_hash_password(password, salt), password_hash)


def _issue_owner_token(restaurant_id: str) -> str:
    # Emite un token efímero que asocia la sesión del dueño con un restaurante concreto.
    token = secrets.token_urlsafe(32)
    OWNER_TOKENS[token] = restaurant_id
    return token


def _ensure_owner_access(restaurant_id: str, owner_token: str | None) -> None:
    # Protege todos los endpoints de dueño validando token y restaurante autorizado.
    if not owner_token:
        raise HTTPException(status_code=401, detail="Falta token de dueño")
    expected_restaurant = OWNER_TOKENS.get(owner_token)
    if not expected_restaurant:
        raise HTTPException(status_code=401, detail="Token de dueño inválido o expirado")
    if expected_restaurant != restaurant_id:
        raise HTTPException(status_code=403, detail="No tienes acceso a este restaurante")


def _get_restaurant_or_404(restaurant_id: str, db: Session) -> models.Restaurant:
    restaurant = (
        db.query(models.Restaurant)
        .filter(models.Restaurant.id == restaurant_id)
        .first()
    )
    if not restaurant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Restaurante '{restaurant_id}' no encontrado",
        )
    return restaurant


def _new_menu_item_id() -> str:
    return f"M{uuid.uuid4().hex[:7].upper()}"


def _new_restaurant_id() -> str:
    return f"R{uuid.uuid4().hex[:4].upper()}"


def _serialize_owner_order(
    order: models.Order,
    restaurant_id: str,
    status_map: dict[int, str],
) -> schemas.OwnerOrderResponse:
    items_for_restaurant = [
        item
        for item in order.items
        if item.menu_item and item.menu_item.restaurant_id == restaurant_id
    ]

    owner_items = [
        schemas.OwnerOrderItemResponse(
            id=item.id,
            menu_item_id=item.menu_item_id,
            quantity=item.quantity,
            menu_item=item.menu_item,
        )
        for item in items_for_restaurant
    ]

    return schemas.OwnerOrderResponse(
        id=order.id,
        created_at=order.created_at,
        subtotal=order.subtotal,
        tip=order.tip,
        total=order.total,
        status=status_map.get(order.id, "pending"),
        items=owner_items,
    )


def _auto_register_consumption_for_order(
    db: Session,
    restaurant_id: str,
    order: models.Order,
) -> None:
    # Descuenta inventario automáticamente cuando un pedido aceptado coincide con ingredientes rastreados.
    inventory_items = (
        db.query(models.InventoryItem)
        .filter(models.InventoryItem.restaurant_id == restaurant_id)
        .all()
    )
    if not inventory_items:
        return

    inventory_by_name = {
        item.ingredient_name.strip().lower(): item
        for item in inventory_items
        if item.ingredient_name and item.ingredient_name.strip()
    }

    if not inventory_by_name:
        return

    existing = (
        db.query(models.InventoryMovement)
        .filter(
            models.InventoryMovement.restaurant_id == restaurant_id,
            models.InventoryMovement.movement_type == "sale_auto",
            models.InventoryMovement.note == f"order:{order.id}",
        )
        .first()
    )
    if existing:
        return

    for order_item in order.items:
        menu_item = order_item.menu_item
        if not menu_item or menu_item.restaurant_id != restaurant_id:
            continue

        text_parts = [menu_item.nombre, menu_item.descripcion] + (menu_item.tags or [])
        corpus = " ".join(part.lower() for part in text_parts if part)

        for ingredient_name, inv_item in inventory_by_name.items():
            if ingredient_name in corpus:
                used_qty = float(order_item.quantity)
                inv_item.stock_quantity = max(0.0, float(inv_item.stock_quantity) - used_qty)
                movement = models.InventoryMovement(
                    inventory_item_id=inv_item.id,
                    restaurant_id=restaurant_id,
                    movement_type="sale_auto",
                    quantity=-used_qty,
                    note=f"order:{order.id}",
                )
                db.add(movement)


@router.post("/auth/register", response_model=schemas.OwnerAuthResponse, status_code=status.HTTP_201_CREATED)
def owner_auth_register(data: schemas.OwnerAuthRegister, db: Session = Depends(get_db)):
    # Crea restaurante, perfil comercial y cuenta de dueño en una sola operación de onboarding.
    owner_name = data.owner_name.strip()
    restaurant_name = data.restaurant_name.strip()
    email = _normalize_email(data.email)
    password = data.password.strip()
    confirm_password = data.confirm_password.strip()
    nit = data.nit.strip().upper()
    address = data.address.strip()
    phone = data.phone.strip()
    category = data.category.strip()

    if not owner_name:
        raise HTTPException(status_code=400, detail="Ingresa el nombre del dueño")
    if not restaurant_name:
        raise HTTPException(status_code=400, detail="Ingresa el nombre del local")
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Correo de dueño inválido")
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 6 caracteres")
    if password != confirm_password:
        raise HTTPException(status_code=400, detail="Las contraseñas no coinciden")
    if not nit or not address or not phone or not category:
        raise HTTPException(status_code=400, detail="Completa NIT, dirección, teléfono y categoría")

    nit_exists = (
        db.query(models.OwnerBusinessProfile)
        .filter(models.OwnerBusinessProfile.nit == nit)
        .first()
    )
    if nit_exists:
        raise HTTPException(status_code=409, detail="Ya existe un negocio registrado con ese NIT")

    existing = db.query(models.OwnerAccount).filter(models.OwnerAccount.email == email).first()
    if existing:
        raise HTTPException(status_code=409, detail="Ya existe una cuenta de dueño con ese correo")

    restaurant_id = _new_restaurant_id()
    restaurant = models.Restaurant(
        id=restaurant_id,
        nombre=restaurant_name,
        categoria=category,
        rating=0.0,
        entrega="Por calcular",
    )
    profile = models.OwnerBusinessProfile(
        id=str(uuid.uuid4()),
        restaurant_id=restaurant_id,
        owner_name=owner_name,
        nit=nit,
        address=address,
        phone=phone,
    )

    password_hash, password_salt = _create_password_record(password)
    db.add(restaurant)
    db.commit()
    db.refresh(restaurant)

    db.add(profile)
    account = models.OwnerAccount(
        id=str(uuid.uuid4()),
        restaurant_id=restaurant_id,
        email=email,
        password_hash=password_hash,
        password_salt=password_salt,
    )
    db.add(account)
    db.commit()

    token = _issue_owner_token(restaurant_id)
    return schemas.OwnerAuthResponse(
        token=token,
        restaurant_id=restaurant_id,
        restaurant_name=restaurant_name,
        owner_name=owner_name,
        message="Cuenta de dueño creada correctamente",
    )


def _serialize_business_profile(
    restaurant: models.Restaurant,
    profile: models.OwnerBusinessProfile,
) -> schemas.OwnerBusinessProfileResponse:
    return schemas.OwnerBusinessProfileResponse(
        restaurant_id=restaurant.id,
        restaurant_name=restaurant.nombre,
        owner_name=profile.owner_name,
        nit=profile.nit,
        address=profile.address,
        phone=profile.phone,
        category=restaurant.categoria,
        delivery_time=restaurant.entrega,
    )


@router.post("/auth/login", response_model=schemas.OwnerAuthResponse)
def owner_auth_login(data: schemas.OwnerAuthLogin, db: Session = Depends(get_db)):
    # Autentica al dueño y entrega un token ligado al restaurante que administrará.
    email = _normalize_email(data.email)
    password = data.password.strip()

    account = db.query(models.OwnerAccount).filter(models.OwnerAccount.email == email).first()
    if not account or not _verify_password(password, account.password_hash, account.password_salt):
        raise HTTPException(status_code=401, detail="Credenciales de dueño inválidas")

    restaurant = _get_restaurant_or_404(account.restaurant_id, db)
    token = _issue_owner_token(restaurant.id)
    return schemas.OwnerAuthResponse(
        token=token,
        restaurant_id=restaurant.id,
        restaurant_name=restaurant.nombre,
        owner_name=(
            db.query(models.OwnerBusinessProfile)
            .filter(models.OwnerBusinessProfile.restaurant_id == restaurant.id)
            .first()
            .owner_name
            if db.query(models.OwnerBusinessProfile).filter(models.OwnerBusinessProfile.restaurant_id == restaurant.id).first()
            else "Dueño"
        ),
        message="Sesión de dueño iniciada correctamente",
    )


@router.post("/login", response_model=schemas.OwnerLoginResponse)
def owner_login(data: schemas.OwnerLoginRequest, db: Session = Depends(get_db)):
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Usa el inicio de sesión de dueño con correo y contraseña.",
    )


@router.get(
    "/restaurants/{restaurant_id}/profile",
    response_model=schemas.OwnerBusinessProfileResponse,
)
def owner_get_business_profile(
    restaurant_id: str,
    db: Session = Depends(get_db),
    owner_token: str | None = Header(default=None, alias="x-owner-token"),
):
    _ensure_owner_access(restaurant_id, owner_token)
    restaurant = _get_restaurant_or_404(restaurant_id, db)
    profile = (
        db.query(models.OwnerBusinessProfile)
        .filter(models.OwnerBusinessProfile.restaurant_id == restaurant_id)
        .first()
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Perfil del restaurante no encontrado")
    return _serialize_business_profile(restaurant, profile)


@router.patch(
    "/restaurants/{restaurant_id}/profile",
    response_model=schemas.OwnerBusinessProfileResponse,
)
def owner_update_business_profile(
    restaurant_id: str,
    data: schemas.OwnerBusinessProfileUpdate,
    db: Session = Depends(get_db),
    owner_token: str | None = Header(default=None, alias="x-owner-token"),
):
    _ensure_owner_access(restaurant_id, owner_token)
    restaurant = _get_restaurant_or_404(restaurant_id, db)
    profile = (
        db.query(models.OwnerBusinessProfile)
        .filter(models.OwnerBusinessProfile.restaurant_id == restaurant_id)
        .first()
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Perfil del restaurante no encontrado")

    nit = data.nit.strip().upper()
    address = data.address.strip()
    phone = data.phone.strip()

    if not nit or not address or not phone:
        raise HTTPException(status_code=400, detail="Completa NIT, dirección y teléfono")

    nit_exists = (
        db.query(models.OwnerBusinessProfile)
        .filter(models.OwnerBusinessProfile.nit == nit)
        .filter(models.OwnerBusinessProfile.restaurant_id != restaurant_id)
        .first()
    )
    if nit_exists:
        raise HTTPException(status_code=409, detail="Ya existe otro negocio registrado con ese NIT")

    profile.nit = nit
    profile.address = address
    profile.phone = phone
    db.commit()
    db.refresh(profile)

    return _serialize_business_profile(restaurant, profile)


@router.get("/restaurants/{restaurant_id}/menu", response_model=list[schemas.OwnerMenuItemResponse])
def owner_get_menu(
    restaurant_id: str,
    db: Session = Depends(get_db),
    owner_token: str | None = Header(default=None, alias="x-owner-token"),
):
    # Expone el menú editable del restaurante filtrado para el panel de administración.
    _ensure_owner_access(restaurant_id, owner_token)
    _get_restaurant_or_404(restaurant_id, db)
    return (
        db.query(models.MenuItem)
        .filter(models.MenuItem.restaurant_id == restaurant_id)
        .order_by(models.MenuItem.nombre.asc())
        .all()
    )


@router.post(
    "/restaurants/{restaurant_id}/menu",
    response_model=schemas.OwnerMenuItemResponse,
    status_code=status.HTTP_201_CREATED,
)
def owner_create_menu_item(
    restaurant_id: str,
    data: schemas.OwnerMenuItemCreate,
    db: Session = Depends(get_db),
    owner_token: str | None = Header(default=None, alias="x-owner-token"),
):
    # Crea productos del panel dueño inyectando metadata del restaurante actual.
    _ensure_owner_access(restaurant_id, owner_token)
    restaurant = _get_restaurant_or_404(restaurant_id, db)

    item = models.MenuItem(
        id=_new_menu_item_id(),
        restaurant_id=restaurant_id,
        nombre=data.nombre.strip(),
        precio=int(data.precio),
        categoria=data.categoria.strip(),
        descripcion=data.descripcion.strip(),
        popular=data.popular,
        is_vegan=data.is_vegan,
        tags=data.tags,
        restaurant_name=restaurant.nombre,
        delivery_time=restaurant.entrega,
    )

    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put(
    "/restaurants/{restaurant_id}/menu/{item_id}",
    response_model=schemas.OwnerMenuItemResponse,
)
def owner_update_menu_item(
    restaurant_id: str,
    item_id: str,
    data: schemas.OwnerMenuItemCreate,
    db: Session = Depends(get_db),
    owner_token: str | None = Header(default=None, alias="x-owner-token"),
):
    _ensure_owner_access(restaurant_id, owner_token)
    restaurant = _get_restaurant_or_404(restaurant_id, db)
    item = (
        db.query(models.MenuItem)
        .filter(
            models.MenuItem.id == item_id,
            models.MenuItem.restaurant_id == restaurant_id,
        )
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    item.nombre = data.nombre.strip()
    item.precio = int(data.precio)
    item.categoria = data.categoria.strip()
    item.descripcion = data.descripcion.strip()
    item.popular = data.popular
    item.is_vegan = data.is_vegan
    item.tags = data.tags
    item.restaurant_name = restaurant.nombre
    item.delivery_time = restaurant.entrega

    db.commit()
    db.refresh(item)
    return item


@router.delete("/restaurants/{restaurant_id}/menu/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def owner_delete_menu_item(
    restaurant_id: str,
    item_id: str,
    db: Session = Depends(get_db),
    owner_token: str | None = Header(default=None, alias="x-owner-token"),
):
    _ensure_owner_access(restaurant_id, owner_token)
    _get_restaurant_or_404(restaurant_id, db)
    item = (
        db.query(models.MenuItem)
        .filter(
            models.MenuItem.id == item_id,
            models.MenuItem.restaurant_id == restaurant_id,
        )
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    db.delete(item)
    db.commit()


@router.get("/restaurants/{restaurant_id}/orders", response_model=list[schemas.OwnerOrderResponse])
def owner_get_orders(
    restaurant_id: str,
    db: Session = Depends(get_db),
    owner_token: str | None = Header(default=None, alias="x-owner-token"),
):
    # Recupera solo pedidos que contienen ítems del restaurante y adjunta su estado interno de dueño.
    _ensure_owner_access(restaurant_id, owner_token)
    _get_restaurant_or_404(restaurant_id, db)

    candidate_orders = (
        db.query(models.Order)
        .join(models.OrderItem, models.OrderItem.order_id == models.Order.id)
        .join(models.MenuItem, models.MenuItem.id == models.OrderItem.menu_item_id)
        .options(joinedload(models.Order.items).joinedload(models.OrderItem.menu_item))
        .filter(models.MenuItem.restaurant_id == restaurant_id)
        .order_by(models.Order.created_at.desc())
        .distinct()
        .all()
    )

    status_rows = (
        db.query(models.OwnerOrderStatus)
        .filter(models.OwnerOrderStatus.restaurant_id == restaurant_id)
        .all()
    )
    status_map = {row.order_id: row.status for row in status_rows}

    return [
        _serialize_owner_order(order, restaurant_id, status_map)
        for order in candidate_orders
    ]


@router.patch(
    "/restaurants/{restaurant_id}/orders/{order_id}/status",
    response_model=schemas.OwnerOrderResponse,
)
def owner_update_order_status(
    restaurant_id: str,
    order_id: int,
    data: schemas.OwnerOrderStatusUpdate,
    db: Session = Depends(get_db),
    owner_token: str | None = Header(default=None, alias="x-owner-token"),
):
    # Cambia el estado operativo del pedido y dispara consumo automático de inventario cuando aplica.
    _ensure_owner_access(restaurant_id, owner_token)
    _get_restaurant_or_404(restaurant_id, db)

    new_status = data.status.strip().lower()
    if new_status not in ALLOWED_ORDER_STATUSES:
        raise HTTPException(status_code=400, detail="Estado de pedido inválido")

    order = (
        db.query(models.Order)
        .options(joinedload(models.Order.items).joinedload(models.OrderItem.menu_item))
        .filter(models.Order.id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")

    has_restaurant_item = any(
        item.menu_item and item.menu_item.restaurant_id == restaurant_id
        for item in order.items
    )
    if not has_restaurant_item:
        raise HTTPException(status_code=404, detail="Pedido no pertenece a este restaurante")

    row = (
        db.query(models.OwnerOrderStatus)
        .filter(
            models.OwnerOrderStatus.restaurant_id == restaurant_id,
            models.OwnerOrderStatus.order_id == order_id,
        )
        .first()
    )

    if row:
        row.status = new_status
    else:
        row = models.OwnerOrderStatus(
            restaurant_id=restaurant_id,
            order_id=order_id,
            status=new_status,
        )
        db.add(row)

    if new_status in {"accepted", "preparing"}:
        _auto_register_consumption_for_order(db, restaurant_id, order)

    db.commit()

    status_map = {order_id: new_status}
    return _serialize_owner_order(order, restaurant_id, status_map)


@router.get(
    "/restaurants/{restaurant_id}/inventory",
    response_model=list[schemas.InventoryItemResponse],
)
def owner_get_inventory(
    restaurant_id: str,
    db: Session = Depends(get_db),
    owner_token: str | None = Header(default=None, alias="x-owner-token"),
):
    _ensure_owner_access(restaurant_id, owner_token)
    _get_restaurant_or_404(restaurant_id, db)
    return (
        db.query(models.InventoryItem)
        .filter(models.InventoryItem.restaurant_id == restaurant_id)
        .order_by(models.InventoryItem.ingredient_name.asc())
        .all()
    )


@router.post(
    "/restaurants/{restaurant_id}/inventory",
    response_model=schemas.InventoryItemResponse,
    status_code=status.HTTP_201_CREATED,
)
def owner_create_inventory_item(
    restaurant_id: str,
    data: schemas.InventoryItemCreate,
    db: Session = Depends(get_db),
    owner_token: str | None = Header(default=None, alias="x-owner-token"),
):
    # Registra un insumo base del restaurante con cantidades mínimas para seguimiento.
    _ensure_owner_access(restaurant_id, owner_token)
    _get_restaurant_or_404(restaurant_id, db)
    item = models.InventoryItem(
        restaurant_id=restaurant_id,
        ingredient_name=data.ingredient_name.strip().lower(),
        stock_quantity=float(data.stock_quantity),
        minimum_quantity=float(data.minimum_quantity),
        unit=data.unit.strip() or "unidades",
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch(
    "/restaurants/{restaurant_id}/inventory/{inventory_item_id}/adjust",
    response_model=schemas.InventoryItemResponse,
)
def owner_adjust_inventory(
    restaurant_id: str,
    inventory_item_id: int,
    data: schemas.InventoryAdjustment,
    db: Session = Depends(get_db),
    owner_token: str | None = Header(default=None, alias="x-owner-token"),
):
    # Ajusta stock manualmente y deja trazabilidad del movimiento en el inventario.
    _ensure_owner_access(restaurant_id, owner_token)
    _get_restaurant_or_404(restaurant_id, db)
    item = (
        db.query(models.InventoryItem)
        .filter(
            models.InventoryItem.id == inventory_item_id,
            models.InventoryItem.restaurant_id == restaurant_id,
        )
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Insumo no encontrado")

    delta = float(data.delta)
    item.stock_quantity = max(0.0, float(item.stock_quantity) + delta)

    movement = models.InventoryMovement(
        inventory_item_id=item.id,
        restaurant_id=restaurant_id,
        movement_type="manual_adjustment",
        quantity=delta,
        note=data.note,
    )
    db.add(movement)

    db.commit()
    db.refresh(item)
    return item


@router.get(
    "/restaurants/{restaurant_id}/inventory/insights",
    response_model=schemas.InventoryInsightsResponse,
)
def owner_inventory_insights(
    restaurant_id: str,
    db: Session = Depends(get_db),
    owner_token: str | None = Header(default=None, alias="x-owner-token"),
):
    # Calcula cobertura, urgencia y recomendaciones de reposición a partir del consumo reciente.
    _ensure_owner_access(restaurant_id, owner_token)
    _get_restaurant_or_404(restaurant_id, db)

    items = (
        db.query(models.InventoryItem)
        .filter(models.InventoryItem.restaurant_id == restaurant_id)
        .all()
    )

    if not items:
        return schemas.InventoryInsightsResponse(
            summary="Aún no hay inventario cargado para analizar.",
            insights=[],
        )

    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
    movements = (
        db.query(models.InventoryMovement)
        .filter(
            models.InventoryMovement.restaurant_id == restaurant_id,
            models.InventoryMovement.created_at >= seven_days_ago,
        )
        .all()
    )

    by_item: dict[int, list[models.InventoryMovement]] = {}
    for movement in movements:
        by_item.setdefault(movement.inventory_item_id, []).append(movement)

    insights: list[schemas.InventoryInsight] = []

    for item in items:
        item_movements = by_item.get(item.id, [])
        outflow = sum(abs(m.quantity) for m in item_movements if m.quantity < 0)
        daily_usage = outflow / 7 if outflow > 0 else 0

        days_left = None
        if daily_usage > 0:
            days_left = round(float(item.stock_quantity) / daily_usage, 1)

        if float(item.stock_quantity) <= float(item.minimum_quantity):
            recommendation = (
                f"Stock crítico: repón {item.ingredient_name} hoy para evitar quiebres."
            )
        elif days_left is not None and days_left <= 2:
            recommendation = (
                f"Riesgo alto: {item.ingredient_name} se agotará en ~{days_left} días."
            )
        elif days_left is not None and days_left <= 5:
            recommendation = (
                f"Planifica compra: {item.ingredient_name} tiene cobertura corta (~{days_left} días)."
            )
        else:
            recommendation = (
                f"Stock estable para {item.ingredient_name}. Mantén seguimiento diario."
            )

        insights.append(
            schemas.InventoryInsight(
                ingredient_name=item.ingredient_name,
                current_stock=float(item.stock_quantity),
                unit=item.unit,
                estimated_days_left=days_left,
                recommendation=recommendation,
            )
        )

    insights.sort(
        key=lambda x: (
            x.estimated_days_left is None,
            x.estimated_days_left if x.estimated_days_left is not None else 9999,
        )
    )

    urgent = [i for i in insights if i.estimated_days_left is not None and i.estimated_days_left <= 2]
    summary = (
        f"IA de consumo: {len(urgent)} insumos en riesgo alto y {len(insights)} analizados en total."
    )

    return schemas.InventoryInsightsResponse(summary=summary, insights=insights)
