import os
import random
from typing import Dict, List, Tuple

from sqlalchemy.orm import Session

import models
from database import SessionLocal


# Restaurantes base (Cali) si aún no existen
RESTAURANTS_SEED = [
    {"id": "r101", "nombre": "La Sazon Caleña", "categoria": "Colombiana", "rating": 4.7, "entrega": "30-40 min"},
    {"id": "r102", "nombre": "Pacifico Grill", "categoria": "Mariscos", "rating": 4.8, "entrega": "35-45 min"},
    {"id": "r103", "nombre": "Arepa & Sabor", "categoria": "Colombiana", "rating": 4.6, "entrega": "20-30 min"},
    {"id": "r104", "nombre": "Wok del Valle", "categoria": "Asiatica", "rating": 4.5, "entrega": "25-35 min"},
    {"id": "r105", "nombre": "Pizzeria Alameda", "categoria": "Pizza", "rating": 4.7, "entrega": "25-35 min"},
    {"id": "r106", "nombre": "Burgers del Rio", "categoria": "Hamburguesas", "rating": 4.6, "entrega": "20-30 min"},
    {"id": "r107", "nombre": "Taco Calle 9", "categoria": "Mexicana", "rating": 4.4, "entrega": "20-30 min"},
    {"id": "r108", "nombre": "Green Cali Bowls", "categoria": "Saludable", "rating": 4.8, "entrega": "15-25 min"},
]


# Catalogo de platos por categoria: (nombre base, descripcion base, es_vegano)
MENU_TEMPLATES: Dict[str, List[Tuple[str, str, bool]]] = {
    "Colombiana": [
        ("Bandeja Paisa", "Frijoles, arroz, chicharron, carne molida, arepa y aguacate.", False),
        ("Sancocho de Gallina", "Caldo tradicional con yuca, platano y mazorca.", False),
        ("Chuleta Valluna", "Cerdo apanado, arroz, ensalada y papa francesa.", False),
        ("Aborrajado Valluno", "Platano maduro relleno de queso y bocadillo.", True),
        ("Empanadas Caleñas", "Masa crocante rellena de carne y papa.", False),
        ("Marranitas", "Bolitas de platano verde rellenas de chicharron.", False),
        ("Tamal Valluno", "Masa de maiz con pollo y verduras envuelto en hoja.", False),
        ("Arroz Atollado", "Arroz meloso con pollo, cerdo y vegetales.", False),
    ],
    "Mariscos": [
        ("Cazuela de Mariscos", "Mezcla cremosa de mariscos con coco y especias.", False),
        ("Arroz Marinero", "Arroz salteado con camarones, calamar y mejillones.", False),
        ("Encocado de Camaron", "Camaron en salsa de coco con arroz de coco.", False),
        ("Filete de Corvina", "Corvina a la plancha con limon y hierbas.", False),
        ("Ceviche del Pacifico", "Pescado fresco, cebolla morada, limon y cilantro.", False),
        ("Picada de Mariscos", "Porcion para compartir con variedad de mariscos.", False),
    ],
    "Asiatica": [
        ("Arroz Chino Especial", "Arroz salteado con vegetales, pollo y cerdo.", False),
        ("Ramen de Cerdo", "Caldo concentrado con noodles y huevo marinado.", False),
        ("Pad Thai", "Fideos de arroz salteados con salsa tamarindo.", False),
        ("Wok de Vegetales", "Vegetales salteados en salsa oriental.", True),
        ("Pollo Teriyaki", "Pollo glaseado con salsa teriyaki y ajonjoli.", False),
        ("Sushi Roll Mixto", "Rolls surtidos con salmon, atun y vegetales.", False),
    ],
    "Pizza": [
        ("Pizza Margarita", "Salsa de tomate, mozzarella y albahaca.", False),
        ("Pizza Pepperoni", "Pepperoni importado y queso mozzarella.", False),
        ("Pizza Hawaiana", "Jamon, pina y queso fundido.", False),
        ("Pizza Vegetariana", "Champinon, pimenton, cebolla y aceitunas.", True),
        ("Calzone Especial", "Masa rellena de queso, jamon y vegetales.", False),
        ("Pizza 4 Quesos", "Mezcla de quesos maduros y oregano.", False),
    ],
    "Hamburguesas": [
        ("Burger Clasica", "Pan brioche, carne angus, lechuga y tomate.", False),
        ("Burger Doble Queso", "Doble carne y doble queso cheddar.", False),
        ("Burger BBQ", "Salsa BBQ, tocineta crocante y cebolla crispy.", False),
        ("Burger Veggie", "Medallon vegetal con vegetales frescos.", True),
        ("Burger Mex", "Guacamole, jalapenos y queso pepper jack.", False),
        ("Burger Trufa", "Mayonesa de trufa y hongos salteados.", False),
    ],
    "Mexicana": [
        ("Tacos al Pastor", "Tortillas de maiz con cerdo marinado y pina.", False),
        ("Burrito Ranchero", "Frijol, arroz, carne y salsa chipotle.", False),
        ("Quesadilla Mixta", "Tortilla de trigo con quesos y proteina.", False),
        ("Nachos Supreme", "Totopos con queso, frijol y pico de gallo.", False),
        ("Bowl Mex Vegano", "Arroz, frijoles, maiz, guacamole y vegetales.", True),
    ],
    "Saludable": [
        ("Bowl de Quinoa", "Quinoa, vegetales asados y aderezo de tahini.", True),
        ("Poke de Salmon", "Arroz sushi, salmon fresco y edamame.", False),
        ("Wrap de Pollo", "Tortilla integral con pollo y vegetales.", False),
        ("Ensalada Mediterranea", "Mix de hojas, queso feta y aceitunas.", True),
        ("Bowl Proteico", "Base de arroz integral con pollo y aguacate.", False),
        ("Crema de Tomate", "Sopa cremosa con croutones de ajo.", True),
    ],
}


# Rangos de precio en COP por categoria
PRICE_RANGES = {
    "Colombiana": (16000, 38000),
    "Mariscos": (26000, 62000),
    "Asiatica": (22000, 52000),
    "Pizza": (18000, 50000),
    "Hamburguesas": (18000, 42000),
    "Mexicana": (17000, 39000),
    "Saludable": (17000, 42000),
}


def round_to_500(value: int) -> int:
    """Redondea precios a multiplos de 500 COP para un catalogo mas realista."""
    return int(round(value / 500.0) * 500)


def upsert_restaurants(db: Session) -> None:
    for r in RESTAURANTS_SEED:
        exists = db.query(models.Restaurant).filter(models.Restaurant.id == r["id"]).first()
        if not exists:
            db.add(models.Restaurant(**r))


def clear_menu_data(db: Session) -> None:
    db.query(models.OrderItem).delete()
    db.query(models.MenuItem).delete()


def build_menu_rows(items_per_restaurant: int = 24) -> List[models.MenuItem]:
    rows: List[models.MenuItem] = []
    seq = 1

    for restaurant in RESTAURANTS_SEED:
        category = restaurant["categoria"]
        templates = MENU_TEMPLATES.get(category, MENU_TEMPLATES["Colombiana"])
        min_price, max_price = PRICE_RANGES.get(category, (16000, 38000))

        for i in range(items_per_restaurant):
            base_name, base_desc, vegan = templates[i % len(templates)]
            variant = (i // len(templates)) + 1
            final_name = f"{base_name} #{variant}" if variant > 1 else base_name

            raw_price = random.randint(min_price, max_price)
            final_price = round_to_500(raw_price)

            tags = [
                category.lower(),
                "cali",
                "vegano" if vegan else "tradicional",
                "menu_extenso",
            ]

            item = models.MenuItem(
                id=f"m{seq:06d}",
                restaurant_id=restaurant["id"],
                nombre=final_name,
                precio=final_price,
                categoria=category,
                descripcion=base_desc,
                popular=(i % 7 == 0),
                is_vegan=vegan,
                tags=tags,
                restaurant_name=restaurant["nombre"],
                delivery_time=restaurant["entrega"],
            )
            rows.append(item)
            seq += 1

    return rows


def main() -> None:
    # Cambia a RESET_MENUS=0 si quieres agregar sin borrar
    reset = os.getenv("RESET_MENUS", "1") == "1"

    random.seed(2026)
    db = SessionLocal()

    try:
        upsert_restaurants(db)
        db.commit()

        if reset:
            clear_menu_data(db)
            db.commit()

        menu_rows = build_menu_rows(items_per_restaurant=24)
        db.bulk_save_objects(menu_rows)
        db.commit()

        print("Carga completada con exito")
        print(f"Restaurantes semilla: {len(RESTAURANTS_SEED)}")
        print(f"Menu items creados: {len(menu_rows)}")
        print("Moneda usada: COP")
    except Exception as exc:
        db.rollback()
        raise exc
    finally:
        db.close()


if __name__ == "__main__":
    main()
