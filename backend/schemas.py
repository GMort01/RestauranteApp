from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel


# ==================== USER AUTH ====================

class UserBase(BaseModel):
    name: str
    email: str


class UserCreate(UserBase):
    password: str


class UserLogin(BaseModel):
    email: str
    password: str


class UserResetPassword(BaseModel):
    email: str
    new_password: str


class UserResponse(UserBase):
    id: str

    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    user: UserResponse
    message: str


# ==================== RESTAURANT ====================

class RestaurantBase(BaseModel):
    id: str
    nombre: str
    categoria: str
    rating: float
    entrega: str


class RestaurantCreate(RestaurantBase):
    pass


class RestaurantResponse(RestaurantBase):
    model_config = {"from_attributes": True}


# ==================== MENU ITEM ====================

class MenuItemBase(BaseModel):
    id: str
    restaurant_id: str
    nombre: str
    precio: int
    categoria: str
    descripcion: str
    popular: bool = False
    is_vegan: bool = False
    tags: Optional[List[str]] = []
    restaurant_name: str
    delivery_time: str


class MenuItemCreate(MenuItemBase):
    pass


class MenuItemResponse(MenuItemBase):
    model_config = {"from_attributes": True}


# ==================== ORDER ====================

class OrderItemBase(BaseModel):
    menu_item_id: str
    quantity: int


class OrderItemResponse(OrderItemBase):
    id: int
    order_id: int
    menu_item: Optional[MenuItemResponse] = None

    model_config = {"from_attributes": True}


class OrderCreate(BaseModel):
    subtotal: float
    tip: float
    total: float
    items: List[OrderItemBase]


class OrderResponse(BaseModel):
    id: int
    created_at: datetime
    subtotal: float
    tip: float
    total: float
    items: List[OrderItemResponse]

    model_config = {"from_attributes": True}


# ==================== OWNER MODE ====================

class OwnerAuthRegister(BaseModel):
    owner_name: str
    email: str
    password: str
    confirm_password: str
    restaurant_name: str
    nit: str
    address: str
    phone: str
    category: str


class OwnerAuthLogin(BaseModel):
    email: str
    password: str


class OwnerLoginRequest(BaseModel):
    restaurant_id: str


class OwnerAuthResponse(BaseModel):
    token: str
    restaurant_id: str
    restaurant_name: str
    owner_name: str
    message: str


class OwnerLoginResponse(BaseModel):
    restaurant_id: str
    restaurant_name: str
    message: str


class OwnerBusinessProfileResponse(BaseModel):
    restaurant_id: str
    restaurant_name: str
    owner_name: str
    nit: str
    address: str
    phone: str
    category: str
    delivery_time: str


class OwnerBusinessProfileUpdate(BaseModel):
    nit: str
    address: str
    phone: str


class OwnerMenuItemCreate(BaseModel):
    nombre: str
    precio: int
    categoria: str
    descripcion: str
    popular: bool = False
    is_vegan: bool = False
    tags: List[str] = []


class OwnerMenuItemResponse(BaseModel):
    id: str
    restaurant_id: str
    nombre: str
    precio: int
    categoria: str
    descripcion: str
    popular: bool
    is_vegan: bool
    tags: List[str] = []
    restaurant_name: str
    delivery_time: str

    model_config = {"from_attributes": True}


class OwnerOrderItemResponse(BaseModel):
    id: int
    menu_item_id: str
    quantity: int
    menu_item: Optional[MenuItemResponse] = None

    model_config = {"from_attributes": True}


class OwnerOrderResponse(BaseModel):
    id: int
    created_at: datetime
    subtotal: float
    tip: float
    total: float
    status: str
    items: List[OwnerOrderItemResponse]


class OwnerOrderStatusUpdate(BaseModel):
    status: str


class InventoryItemCreate(BaseModel):
    ingredient_name: str
    stock_quantity: float
    minimum_quantity: float = 0
    unit: str = "unidades"


class InventoryAdjustment(BaseModel):
    delta: float
    note: Optional[str] = None


class InventoryItemResponse(BaseModel):
    id: int
    restaurant_id: str
    ingredient_name: str
    stock_quantity: float
    minimum_quantity: float
    unit: str
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class InventoryInsight(BaseModel):
    ingredient_name: str
    current_stock: float
    unit: str
    estimated_days_left: Optional[float] = None
    recommendation: str


class InventoryInsightsResponse(BaseModel):
    summary: str
    insights: List[InventoryInsight]
