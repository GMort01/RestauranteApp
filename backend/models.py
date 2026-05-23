from sqlalchemy import Boolean, Column, Float, ForeignKey, Integer, JSON, String, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(120), nullable=False, unique=True, index=True)
    password_hash = Column(String(128), nullable=False)
    password_salt = Column(String(64), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class OwnerAccount(Base):
    __tablename__ = "owner_accounts"

    id = Column(String(36), primary_key=True, index=True)
    restaurant_id = Column(String(10), ForeignKey("restaurants.id"), nullable=False, index=True)
    email = Column(String(120), nullable=False, unique=True, index=True)
    password_hash = Column(String(128), nullable=False)
    password_salt = Column(String(64), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class OwnerBusinessProfile(Base):
    __tablename__ = "owner_business_profiles"

    id = Column(String(36), primary_key=True, index=True)
    restaurant_id = Column(String(10), ForeignKey("restaurants.id"), nullable=False, unique=True, index=True)
    owner_name = Column(String(120), nullable=False)
    nit = Column(String(50), nullable=False, unique=True, index=True)
    address = Column(String(180), nullable=False)
    phone = Column(String(30), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Restaurant(Base):
    __tablename__ = "restaurants"

    id = Column(String(10), primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    categoria = Column(String(50), nullable=False)
    rating = Column(Float, nullable=False, default=0.0)
    entrega = Column(String(20), nullable=False)

    menu_items = relationship("MenuItem", back_populates="restaurant")


class MenuItem(Base):
    __tablename__ = "menu_items"

    id = Column(String(10), primary_key=True, index=True)
    restaurant_id = Column(String(10), ForeignKey("restaurants.id"), nullable=False)
    nombre = Column(String(150), nullable=False)
    precio = Column(Integer, nullable=False)
    categoria = Column(String(50), nullable=False)
    descripcion = Column(String(500), nullable=False)
    popular = Column(Boolean, default=False)
    is_vegan = Column(Boolean, default=False)
    tags = Column(JSON, nullable=True)
    restaurant_name = Column(String(100), nullable=False)
    delivery_time = Column(String(30), nullable=False)

    restaurant = relationship("Restaurant", back_populates="menu_items")
    order_items = relationship("OrderItem", back_populates="menu_item")


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    subtotal = Column(Float, nullable=False)
    tip = Column(Float, nullable=False, default=0.0)
    total = Column(Float, nullable=False)

    items = relationship("OrderItem", back_populates="order")


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    menu_item_id = Column(String(10), ForeignKey("menu_items.id"), nullable=False)
    quantity = Column(Integer, nullable=False, default=1)

    order = relationship("Order", back_populates="items")
    menu_item = relationship("MenuItem", back_populates="order_items")


class OwnerOrderStatus(Base):
    __tablename__ = "owner_order_statuses"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    restaurant_id = Column(String(10), ForeignKey("restaurants.id"), nullable=False, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False, index=True)
    status = Column(String(30), nullable=False, default="pending")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class InventoryItem(Base):
    __tablename__ = "inventory_items"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    restaurant_id = Column(String(10), ForeignKey("restaurants.id"), nullable=False, index=True)
    ingredient_name = Column(String(120), nullable=False)
    stock_quantity = Column(Float, nullable=False, default=0)
    minimum_quantity = Column(Float, nullable=False, default=0)
    unit = Column(String(20), nullable=False, default="unidades")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class InventoryMovement(Base):
    __tablename__ = "inventory_movements"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    inventory_item_id = Column(Integer, ForeignKey("inventory_items.id"), nullable=False, index=True)
    restaurant_id = Column(String(10), ForeignKey("restaurants.id"), nullable=False, index=True)
    movement_type = Column(String(30), nullable=False)
    quantity = Column(Float, nullable=False)
    note = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    inventory_item = relationship("InventoryItem")
