# GastroIA

![Estado](https://img.shields.io/badge/estado-MVP%20funcional-2ea44f)
![Frontend](https://img.shields.io/badge/frontend-Expo%20%2B%20React%20Native-0ea5e9)
![Backend](https://img.shields.io/badge/backend-FastAPI%20%2B%20SQLAlchemy-0f766e)
![IA](https://img.shields.io/badge/IA-Gemini-f59e0b)
![DB](https://img.shields.io/badge/DB-MySQL%208-1d4ed8)

> Recomendador de comida con carrito, pedidos, historial, favoritos y modulo dueño con inventario e insights.

GastroIA es una aplicacion full stack para descubrir que comer, recibir recomendaciones inteligentes, gestionar carrito, crear pedidos y conservar historial y favoritos, con backend real y chat asistido por IA.

Este repositorio integra:

1. Frontend movil y web con React Native + Expo.
2. Backend REST con FastAPI, SQLAlchemy y MySQL.
3. IA conversacional con Gemini para interpretar gustos y guiar recomendaciones.

El proyecto nacio como un MVP academico y evoluciono hasta convertirse en una solucion funcional con autenticacion, persistencia local, filtros por perfil alimentario, checkout y chat guiado.

## Contenido

1. [Resumen ejecutivo](#resumen-ejecutivo)
2. [Stack tecnico](#stack-tecnico)
3. [Estructura del repositorio](#estructura-del-repositorio)
4. [Requisitos previos](#requisitos-previos)
5. [Acceso demo rapido](#acceso-demo-rapido)
6. [Variables de entorno](#variables-de-entorno)
7. [Instalacion](#instalacion)
8. [Ejecucion local](#ejecucion-local)
9. [Arquitectura funcional](#arquitectura-funcional)
10. [Endpoints principales](#endpoints-principales)
11. [Ejemplos de API owner e inventario](#ejemplos-de-api-owner-e-inventario)
12. [IA y flujo de GastroBot](#ia-y-flujo-de-gastrobot)
13. [Limitaciones conocidas](#limitaciones-conocidas)
14. [Troubleshooting](#troubleshooting)
15. [Equipo](#equipo)

## Resumen Ejecutivo

GastroIA resuelve el caso de uso diario de decidir que comer mediante:

1. Busqueda por antojo con recomendaciones personalizadas.
2. Filtro por presupuesto.
3. Restricciones por tipo de alimentacion y alergias.
4. Flujo de pedido con propina y metodo de pago demo.
5. Chat IA para usuarios que no tienen claro que desean comer.

La aplicacion esta pensada para funcionar en desarrollo local con backend FastAPI y frontend Expo, tanto en emulador como en dispositivo fisico dentro de la misma red.

## Stack Tecnico

| Capa | Tecnologia | Version actual |
| --- | --- | --- |
| Frontend | Expo + React Native | Expo 54.x, React Native 0.81.5 |
| Lenguaje frontend | TypeScript | 6.x |
| Navegacion | React Navigation | 7.x |
| Persistencia local | AsyncStorage | 3.x |
| Backend | FastAPI | 0.115.5 |
| Servidor ASGI | Uvicorn | 0.32.1 |
| ORM | SQLAlchemy | 2.0.36 |
| Base de datos | MySQL | 8 o superior |
| Driver MySQL | PyMySQL | 1.1.1 |
| IA | Google Generative AI | 0.8.3 |

## Estructura Del Repositorio

```text
backend/
  main.py
  database.py
  list_models.py
  models.py
  schemas.py
  seed_menus.py
  gastroia_db.sql
  requirements.txt
  routers/
    __init__.py
    ai.py
    auth.py
    menus.py
    orders.py
    owner.py
    restaurants.py

GastroIA/
  App.tsx
  package.json
  index.ts
  app.json
  babel.config.js
  tsconfig.json
  src/
    components/
    context/
    navigation/
    screens/
    services/
    theme/
    types/
```

## Acceso Demo Rapido

Estas credenciales son solo para demostracion local del modulo dueño y te sirven para mostrar el flujo frente a tu profesor sin tener que registrar una cuenta nueva.

| Tipo | Valor |
| --- | --- |
| Correo demo owner | `dueno.demo@gastroia.local` |
| Password demo owner | `Demo12345` |

Notas:

1. Usalas solo en entorno local o de presentacion.
2. El demo depende de que la base tenga cargado el registro owner incluido en `backend/gastroia_db.sql`.
3. Si restauras otra base o limpias datos, puede que necesites recrear la cuenta demo.

## Requisitos Previos

### Backend

1. Python 3.13 recomendado.
2. MySQL Server 8 o superior.
3. pip actualizado.
4. Una base de datos local disponible para el proyecto.
5. Clave valida de Gemini para la IA.

### Frontend

1. Node.js 20 o superior.
2. npm.
3. Expo CLI disponible via `npx`.
4. Expo Go si se prueba en telefono fisico.

## Variables De Entorno

### Backend: `backend/.env`

| Variable | Requerida | Proposito | Ejemplo |
| --- | --- | --- | --- |
| `DB_HOST` | Si | Host de MySQL | `localhost` |
| `DB_PORT` | Si | Puerto de MySQL | `3306` |
| `DB_USER` | Si | Usuario de MySQL | `root` |
| `DB_PASSWORD` | Si | Password de MySQL | `tu_contraseña` |
| `DB_NAME` | Si | Nombre de la base | `gastroia_db` |
| `GEMINI_API_KEY` | Si | Acceso a Gemini | `AIza...` |
| `GEMINI_API_URL` | No | Variable conservada por compatibilidad | `https://generativelanguage.googleapis.com` |

Contenido minimo esperado:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=tu_contraseña
DB_NAME=gastroia_db

GEMINI_API_KEY=tu_clave_de_gemini
GEMINI_API_URL=https://generativelanguage.googleapis.com
```

### Frontend: `GastroIA/.env.local`

| Variable | Requerida | Proposito | Ejemplo |
| --- | --- | --- | --- |
| `EXPO_PUBLIC_API_URL` | Solo en dispositivo fisico | URL publica del backend en tu red local | `http://192.168.1.8:8000` |

Ejemplo:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.8:8000
```

## Instalacion

### 1. Clonar o abrir el proyecto

Trabaja desde la raiz del repositorio:

```powershell
cd C:\Users\Usuario\OneDrive\Escritorio\RestauranteApp-main
```

### 2. Preparar backend

```powershell
cd backend
py -3.13 -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Si `py -3.13` no existe en tu equipo, usa la version de Python instalada.

### 3. Configurar backend

1. Crea `backend/.env` con las variables indicadas arriba.
2. Verifica que MySQL este corriendo.
3. Importa `backend/gastroia_db.sql` o crea la base vacia `gastroia_db`.
4. El script SQL incluye soporte del modulo dueño (owner e inventario) con sentencias idempotentes para convivir con base local existente.

### 4. Preparar frontend

```powershell
cd ..\GastroIA
npm install
```

### 5. Configurar frontend

1. Si usas telefono fisico, crea `GastroIA/.env.local`.
2. Si usas Android emulador, normalmente no hace falta cambiar nada.
3. Si usas iOS simulador o web, el backend por defecto apunta a `127.0.0.1:8000`.

### 6. Cargar datos semilla opcionales

```powershell
cd ..\backend
python seed_menus.py
```

## Ejecucion Local

### Backend

Desde `backend/`:

```powershell
.\venv\Scripts\Activate.ps1
python main.py
```

El backend expone la API en `0.0.0.0:8000` para permitir acceso desde emuladores y dispositivos en la red local.

### Frontend

Desde `GastroIA/`:

```powershell
npm run start
```

### Limpieza de cache

Si Expo no refresca o ves errores de modulo:

```powershell
npx expo start -c
```

### Scripts disponibles

| Script | Accion |
| --- | --- |
| `npm run start` | Inicia Expo |
| `npm run android` | Abre Android |
| `npm run ios` | Abre iOS |
| `npm run web` | Abre la version web |

## Arquitectura Funcional

### Frontend

- Expo + React Native + TypeScript.
- Navegacion con React Navigation.
- Estado global con Context API.
- Persistencia local con AsyncStorage.
- Pantallas: Home, Restaurants, Cart, Favorites, History, Account, Settings y About.
- Modo dueño con login/registro propio, panel por menús (Productos, Pedidos, Inventario, IA) y pantalla separada de perfil.

### Backend

- FastAPI + Uvicorn.
- SQLAlchemy ORM.
- MySQL con PyMySQL.
- Auth basica con hash y salt.
- Routers por dominio: restaurantes, menus, orders, auth, IA y owner.
- Router owner con autenticacion dedicada y proteccion por token de dueño para operaciones de negocio.

### Datos

- Restaurantes.
- Menu.
- Pedidos y detalle de pedido.
- Usuarios.
- Preferencias locales y filtros de perfil.
- Cuentas owner, perfil de negocio, estados de pedidos por owner e inventario con movimientos.

## Endpoints Principales

### Salud

- GET `/`

### Restaurantes

- GET `/restaurants/`
- GET `/restaurants/{restaurant_id}`
- POST `/restaurants/`
- PUT `/restaurants/{restaurant_id}`
- DELETE `/restaurants/{restaurant_id}`

### Menu

- GET `/menus/`
- GET `/menus/{item_id}`
- POST `/menus/`
- PUT `/menus/{item_id}`
- DELETE `/menus/{item_id}`

### Pedidos

- GET `/orders/`
- GET `/orders/{order_id}`
- POST `/orders/`
- DELETE `/orders/{order_id}`

### Auth

- POST `/auth/register`
- POST `/auth/login`
- POST `/auth/reset-password`

### IA

- POST `/ai/analyze`
- POST `/ai/chat`

### Owner

- POST `/owner/auth/register`
- POST `/owner/auth/login`
- GET `/owner/restaurants/{restaurant_id}/menu`
- POST `/owner/restaurants/{restaurant_id}/menu`
- PUT `/owner/restaurants/{restaurant_id}/menu/{item_id}`
- DELETE `/owner/restaurants/{restaurant_id}/menu/{item_id}`
- GET `/owner/restaurants/{restaurant_id}/profile`
- PATCH `/owner/restaurants/{restaurant_id}/profile`
- GET `/owner/restaurants/{restaurant_id}/orders`
- PATCH `/owner/restaurants/{restaurant_id}/orders/{order_id}/status`
- GET `/owner/restaurants/{restaurant_id}/inventory`
- POST `/owner/restaurants/{restaurant_id}/inventory`
- PATCH `/owner/restaurants/{restaurant_id}/inventory/{inventory_item_id}/adjust`
- GET `/owner/restaurants/{restaurant_id}/inventory/insights`

Nota: los endpoints protegidos del modulo dueño requieren el header `x-owner-token` obtenido en el login o registro de owner.

## Ejemplos De API Owner E Inventario

Los siguientes ejemplos estan pensados para pruebas locales con el backend en `http://127.0.0.1:8000`.

### 1) Login de owner y obtencion de token

Request:

```http
POST /owner/auth/login
Content-Type: application/json

{
  "email": "dueno.demo@gastroia.local",
  "password": "Demo12345"
}
```

Response esperada (200):

```json
{
  "token": "eyJv...demoToken",
  "restaurant_id": "R1234",
  "restaurant_name": "Demo Burger",
  "owner_name": "Dueno Demo",
  "message": "Sesion de dueño iniciada correctamente"
}
```

### 2) Crear insumo de inventario

Request:

```http
POST /owner/restaurants/R1234/inventory
Content-Type: application/json
x-owner-token: eyJv...demoToken

{
  "ingredient_name": "pan brioche",
  "stock_quantity": 40,
  "minimum_quantity": 10,
  "unit": "unidades"
}
```

Response esperada (201):

```json
{
  "id": 7,
  "restaurant_id": "R1234",
  "ingredient_name": "pan brioche",
  "stock_quantity": 40.0,
  "minimum_quantity": 10.0,
  "unit": "unidades",
  "updated_at": "2026-05-26T18:45:00"
}
```

### 3) Ajustar stock manualmente

Request:

```http
PATCH /owner/restaurants/R1234/inventory/7/adjust
Content-Type: application/json
x-owner-token: eyJv...demoToken

{
  "delta": -6,
  "note": "merma por preparacion"
}
```

Response esperada (200):

```json
{
  "id": 7,
  "restaurant_id": "R1234",
  "ingredient_name": "pan brioche",
  "stock_quantity": 34.0,
  "minimum_quantity": 10.0,
  "unit": "unidades",
  "updated_at": "2026-05-26T18:53:10"
}
```

Tip rapido: para pruebas con Postman, guarda `token`, `restaurant_id` e `inventory id` en variables de entorno y reutilizalas en toda la coleccion.

## IA Y Flujo De GastroBot

GastroIA usa Gemini para dos caminos distintos:

### `/ai/analyze`

Convierte una frase libre del usuario en una estructura usable por el motor de recomendaciones:

1. `search`
2. `dietType`
3. `allergies`
4. `budget`
5. `message`

### `/ai/chat`

Permite mantener una conversacion corta con GastroBot para descubrir preferencias cuando el usuario todavia no sabe exactamente que desea.

Flujo actual:

1. El frontend bloquea rafagas de envio con `loading`, cooldown y control del teclado.
2. El backend usa `system_instruction` para no reenviar instrucciones largas en cada turno.
3. Si Gemini se satura, el backend puede responder con un fallback local para no romper la experiencia.
4. Cuando Gemini devuelve suficiente contexto, la respuesta llega con `resolved=true` y preferencias estructuradas.

## Limitaciones Conocidas

1. La autenticacion actual es funcional pero basica; no emite JWT.
2. Los metodos de pago son demo y no procesan transacciones reales.
3. La IA depende de cuota y disponibilidad de Gemini.
4. El backend requiere MySQL configurado correctamente antes de iniciar.
5. El acceso por telefono fisico depende de la IP local correcta en `EXPO_PUBLIC_API_URL`.

## Troubleshooting

### Backend no arranca y `python main.py` termina con `Exit Code 1`

Revisa en este orden:

1. Que `backend/.env` exista.
2. Que MySQL este levantado.
3. Que `DB_HOST`, `DB_USER`, `DB_PASSWORD` y `DB_NAME` sean correctos.
4. Que `GEMINI_API_KEY` este configurada.
5. Que `pip install -r requirements.txt` se haya ejecutado sin errores.

### El chat responde `429` o mensajes de velocidad

1. Puede ser un rate limit real de Gemini.
2. Puede ser un envio repetido por teclado o por tap muy rapido.
3. Si se repite, revisa la cuota del proyecto en Google AI Studio.

### Expo no detecta cambios

1. Ejecuta `npx expo start -c`.
2. Reinicia la app en el dispositivo o emulador.
3. Verifica que el backend siga levantado.

### La app no conecta desde telefono fisico

1. El telefono y la PC deben estar en la misma red.
2. `EXPO_PUBLIC_API_URL` debe apuntar a la IP local de la PC.
3. El firewall debe permitir el puerto `8000`.

### No aparecen recomendaciones

1. Revisa que el texto de busqueda tenga sentido.
2. Verifica que exista contenido en el menu semilla o en tu base.
3. Comprueba que los filtros de dieta y alergias no esten dejando el resultado vacio.

### Python no encontrado en Windows

Usa el launcher de Windows:

```powershell
py -3.13
```

## Documentacion Interactiva De La API

Con el backend encendido:

1. Swagger UI: `http://127.0.0.1:8000/docs`
2. ReDoc: `http://127.0.0.1:8000/redoc`

## Flujo Recomendado De Uso

1. Configura tu perfil alimentario en la pantalla de cuenta.
2. Usa la busqueda principal para explorar platos.
3. Abre GastroBot si no tienes claro que pedir.
4. Agrega al carrito y define la propina.
5. Inicia sesion para finalizar el pedido.
6. Revisa historial y favoritos despues de comprar.
7. Si pruebas el flujo de negocio, inicia sesion como dueño y gestiona productos, pedidos e inventario desde Modo dueño.

## Notas De Entrega

1. El proyecto esta preparado para desarrollo local.
2. El backend crea el esquema base al arrancar.
3. La IA tiene controles para evitar rafagas de peticiones.
4. El frontend persiste datos locales para mejorar la experiencia entre sesiones.
5. El archivo `backend/gastroia_db.sql` incluye estructura owner/inventario y un demo unico para validar el modulo dueño.
6. La cuenta demo owner tambien esta destacada arriba en la seccion `Acceso Demo Rapido` para tenerla siempre a mano durante la presentacion.

## Equipo

1. Manuel Morales Martinez - 406384
2. Meredith Stefany Olave Salazar - 398964