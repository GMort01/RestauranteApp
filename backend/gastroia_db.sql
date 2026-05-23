-- 1. Crea la base si no existe (NO borra datos existentes)
CREATE DATABASE IF NOT EXISTS gastroia_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE gastroia_db;

-- =============================================================
-- 1. TABLA: USUARIOS (alineada con backend/auth)
-- =============================================================
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(128) NOT NULL,
  password_salt VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================
-- 2. TABLA: RESTAURANTES (alineada con models.py)
-- =============================================================
CREATE TABLE IF NOT EXISTS restaurants (
  id VARCHAR(10) NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  categoria VARCHAR(50) NOT NULL,
  rating FLOAT NOT NULL DEFAULT 0.0,
  entrega VARCHAR(20) NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================
-- 3. TABLA: MENÚ (alineada con schemas/models)
-- =============================================================
CREATE TABLE IF NOT EXISTS menu_items (
  id VARCHAR(10) NOT NULL,
  restaurant_id VARCHAR(10) NOT NULL,
  nombre VARCHAR(150) NOT NULL,
  precio INT NOT NULL, -- Ideal para COP
  categoria VARCHAR(50) NOT NULL,
  descripcion VARCHAR(500) NOT NULL,
  popular TINYINT(1) NOT NULL DEFAULT 0,
  is_vegan TINYINT(1) NOT NULL DEFAULT 0,
  tags JSON,
  restaurant_name VARCHAR(100) NOT NULL,
  delivery_time VARCHAR(30) NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_menu_restaurant
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================
-- 4. TABLA: ÓRDENES (alineada con API actual)
-- =============================================================
CREATE TABLE IF NOT EXISTS orders (
  id INT NOT NULL AUTO_INCREMENT,
  subtotal FLOAT NOT NULL,
  tip FLOAT NOT NULL DEFAULT 0,
  total FLOAT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================
-- 5. TABLA: DETALLE DE ÓRDENES
-- =============================================================
CREATE TABLE IF NOT EXISTS order_items (
  id INT NOT NULL AUTO_INCREMENT,
  order_id INT NOT NULL,
  menu_item_id VARCHAR(10) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  CONSTRAINT fk_orderitem_order
    FOREIGN KEY (order_id) REFERENCES orders(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_orderitem_menu
    FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================
-- DATOS INICIALES (Insertados al final para respetar relaciones)
-- =============================================================

-- -------------------------------------------------------------
-- Restaurantes
-- -------------------------------------------------------------
INSERT IGNORE INTO restaurants (id, nombre, categoria, rating, entrega) VALUES
  (1,  'Napoli di Oro',       'Pizza',        4.9, '25 min'),
  (2,  'Iron Burger',         'Hamburguesas',  4.7, '15 min'),
  (3,  'Sakura Zen',          'Asiática',      4.8, '40 min'),
  (4,  'La Cantina',          'Mexicana',      4.6, '30 min'),
  (5,  'Wok Master',          'Asiática',      4.4, '20 min'),
  (6,  'Pizzería Argentina',  'Pizza',         4.5, '35 min'),
  (7,  'Green Habit',         'Saludable',     4.7, '15 min'),
  (8,  'Puerto Azul',         'Mariscos',      4.6, '50 min'),
  (9,  'Sweet Palace',        'Postres',       4.9, '10 min'),
  (10, 'Coffee Hub',          'Bebidas Café',  4.8, '5 min');

-- -------------------------------------------------------------
-- Ítems de menú
-- -------------------------------------------------------------
INSERT IGNORE INTO menu_items (id, restaurant_id, nombre, precio, categoria, descripcion, popular, is_vegan, tags, restaurant_name, delivery_time) VALUES

-- PIZZAS
(1,  1, 'Pizza Margherita',           25000, 'Pizza',       'Tomate San Marzano, mozzarella de búfala y albahaca fresca.',                      1, 0, '["pizza","italiana","vegetariana"]', 'Napoli di Oro', '25 min'),
(2,  1, 'Pizza Diávola',              28000, 'Pizza',       'Salami picante, peperoncino y mozzarella.',                                        0, 0, '["pizza","italiana","picante"]', 'Napoli di Oro', '25 min'),
(3,  6, 'Pizza Fugazzeta',            26000, 'Pizza',       'Mucha cebolla, queso mozzarella y orégano premium.',                               0, 0, '["pizza","argentina","cebolla"]', 'Pizzería Argentina', '35 min'),
(16, 1, 'Pizza Quattro Stagioni',     30000, 'Pizza',       'Champiñones, jamón, alcachofas y aceitunas.',                                      0, 0, '["pizza","italiana","cuatro estaciones"]', 'Napoli di Oro', '25 min'),
(17, 6, 'Pizza Calabresa',            27500, 'Pizza',       'Salchicha calabresa, mozzarella y orégano.',                                       0, 0, '["pizza","argentina","calabresa"]', 'Pizzería Argentina', '35 min'),
(18, 1, 'Pizza Vegetariana',          26500, 'Pizza',       'Pimientos, champiñones, cebolla y mozzarella.',                                    0, 0, '["pizza","italiana","vegetariana"]', 'Napoli di Oro', '25 min'),
(19, 1, 'Pizza Napolitana',           25500, 'Pizza',       'Tomate, mozzarella, anchoas y orégano.',                                           0, 0, '["pizza","napolitana","anchoas"]', 'Napoli di Oro', '25 min'),
(39, 1, 'Pizza Hawaiana',             28500, 'Pizza',       'Jamón, piña, mozzarella y salsa de tomate.',                                       0, 0, '["pizza","hawaiana","frutas"]', 'Napoli di Oro', '25 min'),
(40, 6, 'Pizza Especial de la Casa',  32000, 'Pizza',       'Prosciutto, mozzarella fresca, rúcula y tomate cherry.',                            0, 0, '["pizza","prosciutto","especial"]', 'Pizzería Argentina', '35 min'),

-- HAMBURGUESAS
(4,  2, 'Bacon Cheese Burger',        22000, 'Hamburguesa', 'Carne angus 200g, cheddar fundido y tocino crujiente.',                             0, 0, '["hamburguesa","bacon","cheddar"]', 'Iron Burger', '15 min'),
(5,  2, 'Truffle Burger',             35000, 'Hamburguesa', 'Salsa de trufa negra, champiñones salteados y queso suizo.',                        0, 0, '["hamburguesa","trufa","gourmet"]', 'Iron Burger', '15 min'),
(20, 2, 'Veggie Burger',              20000, 'Hamburguesa', 'Hamburguesa de lentejas, lechuga, tomate y mayonesa vegana.',                       0, 1, '["hamburguesa","vegetariana","vegana"]', 'Iron Burger', '15 min'),
(21, 2, 'BBQ Burger',                 24000, 'Hamburguesa', 'Carne angus con salsa BBQ, cebolla caramelizada y bacon.',                          0, 0, '["hamburguesa","bbq","bacon"]', 'Iron Burger', '15 min'),
(22, 2, 'Mushroom Swiss Burger',      26000, 'Hamburguesa', 'Champiñones salteados, queso suizo y cebolla.',                                     0, 0, '["hamburguesa","champiñones","suizo"]', 'Iron Burger', '15 min'),
(41, 2, 'Double Patty Burger',        28000, 'Hamburguesa', 'Doble carne angus, doble cheddar, lechuga y tomate.',                               0, 0, '["hamburguesa","doble","carnes"]', 'Iron Burger', '15 min'),
(42, 2, 'Smokehouse Burger',          26500, 'Hamburguesa', 'Carne ahumada, tocino crujiente y salsa BBQ casera.',                               0, 0, '["hamburguesa","ahumada","bacon"]', 'Iron Burger', '15 min'),

-- ASIÁTICA / SUSHI
(6,  3, 'California Roll',            24000, 'Sushi',       'Cangrejo, aguacate y pepino con sésamo.',                                           0, 0, '["sushi","california","roll"]', 'Sakura Zen', '40 min'),
(7,  3, 'Ramen Miso Especial',        32000, 'Asiática',    'Caldo de 12 horas, huevo marinado, chashu y fideos artesanales.',                   0, 0, '["ramen","miso","especial"]', 'Sakura Zen', '40 min'),
(8,  5, 'Pad Thai de Langostinos',    28000, 'Asiática',    'Fideos de arroz, brotes de soja, cacahuetes y salsa tamarindo.',                    0, 0, '["pad thai","langostinos","tailandesa"]', 'Wok Master', '20 min'),
(23, 3, 'Sushi Sashimi Mix',          36000, 'Sushi',       'Variedad de sashimi fresco: salmón, atún y pez mantequilla.',                       0, 0, '["sushi","sashimi","fresco"]', 'Sakura Zen', '40 min'),
(24, 5, 'Khao Man Gai',               22000, 'Asiática',    'Arroz jazmín con pollo, salsa de jengibre y sopa.',                                 0, 0, '["tailandesa","pollo","arroz"]', 'Wok Master', '20 min'),
(25, 3, 'Tempura de Verduras',        20000, 'Asiática',    'Verduras frescas rebozadas en tempura.',                                            0, 1, '["tempura","verduras","vegana"]', 'Sakura Zen', '40 min'),
(26, 5, 'Curry Verde Tailandés',      26500, 'Asiática',    'Curry verde con coco, verduras y arroz jazmín.',                                    0, 1, '["curry","verde","vegano"]', 'Wok Master', '20 min'),
(43, 3, 'Philadelphia Roll',          25000, 'Sushi',       'Salmón fresco, queso crema y pepino.',                                              0, 0, '["sushi","philadelphia","salmón"]', 'Sakura Zen', '40 min'),
(44, 5, 'Ramen Tonkotsu',             30000, 'Asiática',    'Caldo de huesos de cerdo, noodles ondulados y chashu.',                             0, 0, '["ramen","tonkotsu","cerdo"]', 'Wok Master', '20 min'),
(45, 3, 'Dragon Roll',                28000, 'Sushi',       'Anguila, aguacate, pepino y sésamo tostado.',                                       0, 0, '["sushi","dragon","especial"]', 'Sakura Zen', '40 min'),

-- MEXICANA
(9,  4, 'Tacos al Pastor (3 unds)',   20000, 'Mexicana',    'Cerdo marinado, piña, cebolla y cilantro.',                                         0, 0, '["tacos","pastor","cerdo"]', 'La Cantina', '30 min'),
(10, 4, 'Burrito de Arranchera',      26000, 'Mexicana',    'Frijoles refritos, arroz, queso y carne de res premium.',                           0, 0, '["burrito","arranchera","res"]', 'La Cantina', '30 min'),
(27, 4, 'Quesadillas de Pollo',       18000, 'Mexicana',    'Tortillas de maíz con pollo, queso y salsa.',                                       0, 0, '["quesadillas","pollo","queso"]', 'La Cantina', '30 min'),
(28, 4, 'Enchiladas Verdes',          24000, 'Mexicana',    'Tortillas rellenas de pollo con salsa verde y queso.',                               0, 0, '["enchiladas","verdes","pollo"]', 'La Cantina', '30 min'),
(29, 4, 'Fajitas de Vegetales',       22000, 'Mexicana',    'Pimientos, cebolla, champiñones salteados con tortillas.',                           0, 1, '["fajitas","vegetales","veganas"]', 'La Cantina', '30 min'),
(46, 4, 'Chiles Rellenos',            25000, 'Mexicana',    'Chiles poblanos rellenos de queso, cubiertos con salsa roja.',                       0, 0, '["chiles","poblanos","queso"]', 'La Cantina', '30 min'),
(47, 4, 'Carne Asada Tacos',          23000, 'Mexicana',    'Carne marinada a la parrilla con cebolla morada y cilantro.',                        0, 0, '["tacos","asada","parrilla"]', 'La Cantina', '30 min'),

-- SALUDABLE / BOWLS
(11, 7, 'Ensalada Caesar Gourmet',    18500, 'Saludable',   'Pollo a la parrilla, croutons, parmesano y aderezo casero.',                        0, 0, '["ensalada","caesar","pollo"]', 'Green Habit', '15 min'),
(12, 7, 'Poke Bowl Salmón',           29500, 'Saludable',   'Salmón fresco, edamame, mango y base de arroz de sushi.',                           0, 0, '["poke","salmón","bowl"]', 'Green Habit', '15 min'),
(30, 7, 'Quinoa Bowl Vegano',         24000, 'Saludable',   'Quinoa, verduras asadas, aguacate y tahini.',                                        0, 1, '["quinoa","vegano","bowl"]', 'Green Habit', '15 min'),
(31, 7, 'Smoothie Bowl',              16000, 'Saludable',   'Frutas mixtas, granola y miel.',                                                    0, 0, '["smoothie","frutas","bowl"]', 'Green Habit', '15 min'),
(32, 7, 'Wrap de Pollo',              20000, 'Saludable',   'Pollo grillado, verduras y aderezo light.',                                          0, 0, '["wrap","pollo","light"]', 'Green Habit', '15 min'),
(48, 7, 'Buddha Bowl Proteína',       28000, 'Saludable',   'Pollo marinado, legumbres, aguacate y grano de choclo.',                             0, 0, '["buddha","proteína","completo"]', 'Green Habit', '15 min'),
(49, 7, 'Ensalada Griega',            19000, 'Saludable',   'Tomate, pepino, queso feta, aceitunas y aceite de oliva.',                           0, 0, '["ensalada","griega","clásica"]', 'Green Habit', '15 min'),

-- MARISCOS
(13, 8, 'Ceviche Clásico',            36000, 'Mariscos',    'Pescado blanco del día marinado en leche de tigre.',                                 0, 0, '["ceviche","pescado","clásico"]', 'Puerto Azul', '50 min'),
(33, 8, 'Paella de Mariscos',         40000, 'Mariscos',    'Arroz con calamares, mejillones, gambas y azafrán.',                                 0, 0, '["paella","mariscos","arroz"]', 'Puerto Azul', '50 min'),
(34, 8, 'Tacos de Camarón',           30000, 'Mariscos',    'Camarones al ajillo con cilantro y limón.',                                          0, 0, '["tacos","camarón","mariscos"]', 'Puerto Azul', '50 min'),
(35, 8, 'Sopa de Almejas',            28000, 'Mariscos',    'Almejas frescas en caldo de vino blanco.',                                           0, 0, '["sopa","almejas","fresco"]', 'Puerto Azul', '50 min'),
(50, 8, 'Filete de Salmón',           38000, 'Mariscos',    'Salmón a la mantequilla con limón y espárragos.',                                    0, 0, '["salmón","filete","elegante"]', 'Puerto Azul', '50 min'),
(51, 8, 'Camarones al Ajillo',        32000, 'Mariscos',    'Camarones frescos con ajo, perejil y pan tostado.',                                  0, 0, '["camarones","ajillo","clásico"]', 'Puerto Azul', '50 min'),

-- POSTRES
(14, 9, 'Tiramisú Artesanal',         12000, 'Postres',     'Café expreso, mascarpone y cacao puro.',                                             0, 0, '["tiramisu","artesanal","café"]', 'Sweet Palace', '10 min'),
(15, 9, 'Brownie con Helado',         11000, 'Postres',     'Chocolate 70% cacao con helado de vainilla bourbon.',                                0, 0, '["brownie","helado","chocolate"]', 'Sweet Palace', '10 min'),
(36, 9, 'Cheesecake de Frutos Rojos', 14000, 'Postres',     'Base de galleta, queso crema y coulis de frutos rojos.',                             0, 0, '["cheesecake","frutos rojos","cremoso"]', 'Sweet Palace', '10 min'),
(37, 9, 'Tarta de Manzana',           13000, 'Postres',     'Manzanas caramelizadas con canela y masa hojaldre.',                                 0, 0, '["tarta","manzana","canela"]', 'Sweet Palace', '10 min'),
(38, 9, 'Helado Vegano de Coco',       9000, 'Postres',     'Helado cremoso de coco con toppings.',                                               0, 1, '["helado","coco","vegano"]', 'Sweet Palace', '10 min'),
(52, 9, 'Mousse de Chocolate',        10500, 'Postres',     'Chocolate belga batido con crema fresca.',                                           0, 0, '["mousse","chocolate","ligero"]', 'Sweet Palace', '10 min'),
(53, 9, 'Flan Casero',                 9000, 'Postres',     'Flan tradicional con caramelo crujiente.',                                           0, 0, '["flan","casero","caramelo"]', 'Sweet Palace', '10 min'),
(54, 9, 'Pavlova de Frutas',          15000, 'Postres',     'Merengue crujiente, crema y frutas frescas.',                                        0, 0, '["pavlova","frutas","elegante"]', 'Sweet Palace', '10 min'),
(55, 9, 'Donas Artesanales',           8000, 'Postres',     'Donas caseras con glaseado y relleno.',                                              0, 0, '["donas","artesanal","clásico"]', 'Sweet Palace', '10 min'),
(56, 9, 'Coulant de Chocolate',        13500, 'Postres',     'Chocolate derretido en el centro con helado.',                                       0, 0, '["coulant","chocolate","caliente"]', 'Sweet Palace', '10 min'),

-- BEBIDAS CAFÉ
(57, 10, 'Café Espresso',              5000, 'Bebidas Café', 'Espresso puro de café premium.',                                                    0, 1, '["café","espresso","puro"]', 'Coffee Hub', '5 min'),
(58, 10, 'Cappuccino',                 7500, 'Bebidas Café', 'Espresso con leche vaporizada y espuma.',                                            0, 0, '["cappuccino","leche","espuma"]', 'Coffee Hub', '5 min'),
(59, 10, 'Latte Macchiato',            8000, 'Bebidas Café', 'Leche tibia con espresso y espuma decorativa.',                                      0, 0, '["latte","macchiato","suave"]', 'Coffee Hub', '5 min'),
(60, 10, 'Americano',                  6000, 'Bebidas Café', 'Espresso diluido en agua caliente.',                                                0, 1, '["americano","puro","clásico"]', 'Coffee Hub', '5 min');

-- =============================================================
-- EXPANSIÓN DE CATÁLOGO (IDEMPOTENTE)
-- Inserta solo nuevos IDs; si ya existen, los ignora.
-- =============================================================

INSERT IGNORE INTO restaurants (id, nombre, categoria, rating, entrega) VALUES
  (11, 'Brasa Urbana',          'Parrilla',      4.7, '30 min'),
  (12, 'Pasta Nostra',          'Italiana',      4.8, '28 min'),
  (13, 'Sushi Point',           'Asiática',      4.6, '35 min'),
  (14, 'Tierra Verde',          'Saludable',     4.7, '18 min'),
  (15, 'La Casa del Pollo',     'Pollo',         4.5, '22 min'),
  (16, 'Deli Sandwich Co.',     'Sandwiches',    4.6, '16 min'),
  (17, 'Gelato Mio',            'Postres',       4.8, '12 min'),
  (18, 'Waffle & Brunch',       'Brunch',        4.7, '20 min'),
  (19, 'Ramen Republic',        'Asiática',      4.9, '32 min'),
  (20, 'Arepas de Barrio',      'Colombiana',    4.5, '18 min');

INSERT IGNORE INTO menu_items (id, restaurant_id, nombre, precio, categoria, descripcion, popular, is_vegan, tags, restaurant_name, delivery_time) VALUES

-- BRASA URBANA (PARRILLA)
(61, 11, 'Bife de Chorizo',             42000, 'Parrilla',    'Corte jugoso a la parrilla con papas criollas.',                                  1, 0, '["parrilla","res","premium"]', 'Brasa Urbana', '30 min'),
(62, 11, 'Costillas BBQ',               36000, 'Parrilla',    'Costillas de cerdo glaseadas en salsa BBQ casera.',                               0, 0, '["parrilla","bbq","cerdo"]', 'Brasa Urbana', '30 min'),
(63, 11, 'Churrasco Criollo',           39000, 'Parrilla',    'Churrasco con chimichurri y vegetales grillados.',                                 0, 0, '["parrilla","churrasco","criollo"]', 'Brasa Urbana', '30 min'),
(64, 11, 'Parrillada Mixta',            48000, 'Parrilla',    'Combinación de res, cerdo y pollo para compartir.',                               0, 0, '["parrilla","mixta","compartir"]', 'Brasa Urbana', '30 min'),

-- PASTA NOSTRA (ITALIANA)
(65, 12, 'Fettuccine Alfredo',          29000, 'Italiana',    'Pasta fresca con salsa cremosa y parmesano.',                                     0, 0, '["pasta","alfredo","italiana"]', 'Pasta Nostra', '28 min'),
(66, 12, 'Lasagna Bolognesa',           32000, 'Italiana',    'Láminas de pasta con ragú de carne y bechamel.',                                  1, 0, '["lasagna","bolognesa","horno"]', 'Pasta Nostra', '28 min'),
(67, 12, 'Ravioli de Ricotta',          30000, 'Italiana',    'Ravioli rellenos con ricotta y espinaca en salsa pomodoro.',                     0, 0, '["ravioli","ricotta","vegetariana"]', 'Pasta Nostra', '28 min'),
(68, 12, 'Gnocchi al Pesto',            28500, 'Italiana',    'Ñoquis artesanales con pesto de albahaca.',                                       0, 1, '["gnocchi","pesto","vegana"]', 'Pasta Nostra', '28 min'),

-- SUSHI POINT (ASIÁTICA)
(69, 13, 'Nigiri de Salmón (8)',        34000, 'Sushi',       'Nigiri de salmón fresco con arroz de sushi.',                                     0, 0, '["sushi","nigiri","salmón"]', 'Sushi Point', '35 min'),
(70, 13, 'Ebi Tempura Roll',            29500, 'Sushi',       'Roll crujiente de camarón tempura y aguacate.',                                   0, 0, '["sushi","tempura","roll"]', 'Sushi Point', '35 min'),
(71, 13, 'Veggie Maki Mix',             25000, 'Sushi',       'Selección de makis vegetarianos.',                                                  0, 1, '["sushi","vegano","maki"]', 'Sushi Point', '35 min'),
(72, 13, 'Udon Salteado',               27000, 'Asiática',    'Fideos udon salteados con verduras y salsa oriental.',                             0, 1, '["udon","asiática","vegano"]', 'Sushi Point', '35 min'),

-- TIERRA VERDE (SALUDABLE)
(73, 14, 'Bowl Mediterráneo',           26000, 'Saludable',   'Quinoa, garbanzo, pepino, tomate y hummus.',                                       0, 1, '["bowl","saludable","vegano"]', 'Tierra Verde', '18 min'),
(74, 14, 'Wrap Veggie Protein',         23000, 'Saludable',   'Tortilla integral, tofu marinado y vegetales frescos.',                           0, 1, '["wrap","tofu","light"]', 'Tierra Verde', '18 min'),
(75, 14, 'Ensalada de Atún',            24500, 'Saludable',   'Mix de hojas, atún, maíz, tomate cherry y oliva.',                                0, 0, '["ensalada","atun","proteina"]', 'Tierra Verde', '18 min'),
(76, 14, 'Bowl de Pollo Fit',           25500, 'Saludable',   'Pollo grillado, arroz integral y aguacate.',                                        1, 0, '["bowl","pollo","fit"]', 'Tierra Verde', '18 min'),

-- LA CASA DEL POLLO
(77, 15, 'Pollo Broaster',              24000, 'Pollo',       'Pollo broaster crocante con papas.',                                                0, 0, '["pollo","broaster","crujiente"]', 'La Casa del Pollo', '22 min'),
(78, 15, 'Pollo Asado Familiar',        38000, 'Pollo',       'Pollo asado entero con arepas y papa salada.',                                      1, 0, '["pollo","asado","familiar"]', 'La Casa del Pollo', '22 min'),
(79, 15, 'Alitas Picantes (12)',        27000, 'Pollo',       'Alitas bañadas en salsa buffalo.',                                                   0, 0, '["alitas","picante","buffalo"]', 'La Casa del Pollo', '22 min'),
(80, 15, 'Pollo a la Naranja',          26000, 'Pollo',       'Trozos de pollo glaseados en salsa de naranja.',                                    0, 0, '["pollo","naranja","salsa"]', 'La Casa del Pollo', '22 min'),

-- DELI SANDWICH CO.
(81, 16, 'Club Sandwich',               21000, 'Sandwiches',  'Triple pan, pollo, bacon, lechuga y tomate.',                                      0, 0, '["sandwich","club","bacon"]', 'Deli Sandwich Co.', '16 min'),
(82, 16, 'Philly Cheese Steak',         26000, 'Sandwiches',  'Res salteada con queso derretido y cebolla.',                                       0, 0, '["sandwich","philly","res"]', 'Deli Sandwich Co.', '16 min'),
(83, 16, 'Panini Caprese',              22000, 'Sandwiches',  'Panini con tomate, mozzarella y pesto.',                                             0, 0, '["sandwich","panini","caprese"]', 'Deli Sandwich Co.', '16 min'),
(84, 16, 'Sandwich Vegano',             20000, 'Sandwiches',  'Pan artesanal con hummus, vegetales y rúcula.',                                     0, 1, '["sandwich","vegano","hummus"]', 'Deli Sandwich Co.', '16 min'),

-- GELATO MIO (POSTRES)
(85, 17, 'Gelato Pistacho',             12000, 'Postres',     'Helado artesanal de pistacho italiano.',                                            0, 0, '["gelato","pistacho","italiano"]', 'Gelato Mio', '12 min'),
(86, 17, 'Gelato Stracciatella',        11000, 'Postres',     'Helado de crema con virutas de chocolate.',                                          0, 0, '["gelato","chocolate","crema"]', 'Gelato Mio', '12 min'),
(87, 17, 'Affogato',                     9500, 'Postres',     'Gelato de vainilla con shot de espresso.',                                           0, 0, '["affogato","café","postre"]', 'Gelato Mio', '12 min'),
(88, 17, 'Sorbetto de Mango',           10000, 'Postres',     'Sorbete frutal y refrescante sin lácteos.',                                         0, 1, '["sorbete","mango","vegano"]', 'Gelato Mio', '12 min'),

-- WAFFLE & BRUNCH
(89, 18, 'Waffle de Frutos Rojos',      18000, 'Brunch',      'Waffle belga con frutos rojos y miel.',                                             0, 0, '["waffle","brunch","frutas"]', 'Waffle & Brunch', '20 min'),
(90, 18, 'Huevos Benedictinos',         25000, 'Brunch',      'Huevos pochados, salsa holandesa y pan artesanal.',                                 0, 0, '["brunch","huevos","benedict"]', 'Waffle & Brunch', '20 min'),
(91, 18, 'Tostada de Aguacate',         19500, 'Brunch',      'Pan masa madre con aguacate, semillas y limón.',                                     0, 1, '["brunch","aguacate","vegano"]', 'Waffle & Brunch', '20 min'),
(92, 18, 'French Toast',                21000, 'Brunch',      'Pan brioche dorado con canela y maple.',                                             0, 0, '["brunch","french toast","dulce"]', 'Waffle & Brunch', '20 min'),

-- RAMEN REPUBLIC
(93, 19, 'Ramen Shoyu',                 31000, 'Asiática',    'Caldo shoyu, noodles, cerdo y huevo marinado.',                                     1, 0, '["ramen","shoyu","japonés"]', 'Ramen Republic', '32 min'),
(94, 19, 'Ramen Veggie',                28500, 'Asiática',    'Caldo vegetal, tofu, maíz y hongos.',                                                0, 1, '["ramen","vegano","tofu"]', 'Ramen Republic', '32 min'),
(95, 19, 'Gyozas de Cerdo (6)',         19000, 'Asiática',    'Empanaditas japonesas a la plancha.',                                                0, 0, '["gyoza","cerdo","entrada"]', 'Ramen Republic', '32 min'),
(96, 19, 'Karaage Don',                 27500, 'Asiática',    'Pollo frito japonés sobre arroz y salsa especial.',                                 0, 0, '["karaage","donburi","pollo"]', 'Ramen Republic', '32 min'),

-- AREPAS DE BARRIO (COLOMBIANA)
(97, 20, 'Arepa Reina',                 16500, 'Colombiana',  'Arepa rellena de pollo mechado y aguacate.',                                        0, 0, '["arepa","reina pepiada","pollo"]', 'Arepas de Barrio', '18 min'),
(98, 20, 'Arepa Queso y Chicharrón',    18000, 'Colombiana',  'Arepa asada con queso costeño y chicharrón crocante.',                              0, 0, '["arepa","queso","chicharron"]', 'Arepas de Barrio', '18 min'),
(99, 20, 'Arepa Veggie',                15500, 'Colombiana',  'Rellena de vegetales salteados y guacamole.',                                       0, 1, '["arepa","vegana","vegetales"]', 'Arepas de Barrio', '18 min'),
(100,20, 'Picada Caleña',               29000, 'Colombiana',  'Chorizo, papa criolla, yuca y ají casero.',                                         1, 0, '["picada","colombiana","compartir"]', 'Arepas de Barrio', '18 min');

-- =============================================================
-- POV DUEÑO: ESTRUCTURA SQL (COPIAR/PEGAR EN MYSQL WORKBENCH)
-- Alineado con backend/models.py
-- Idempotente: usa IF NOT EXISTS e INSERT IGNORE
-- =============================================================

-- -------------------------------------------------------------
-- 1) Cuentas de dueño
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS owner_accounts (
  id VARCHAR(36) NOT NULL,
  restaurant_id VARCHAR(10) NOT NULL,
  email VARCHAR(120) NOT NULL,
  password_hash VARCHAR(128) NOT NULL,
  password_salt VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_owner_accounts_email (email),
  KEY idx_owner_accounts_restaurant_id (restaurant_id),
  CONSTRAINT fk_owner_accounts_restaurant
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- 2) Perfil de negocio del dueño (1 a 1 con restaurante)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS owner_business_profiles (
  id VARCHAR(36) NOT NULL,
  restaurant_id VARCHAR(10) NOT NULL,
  owner_name VARCHAR(120) NOT NULL,
  nit VARCHAR(50) NOT NULL,
  address VARCHAR(180) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_owner_business_profiles_restaurant_id (restaurant_id),
  UNIQUE KEY uq_owner_business_profiles_nit (nit),
  CONSTRAINT fk_owner_business_profiles_restaurant
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- 3) Estado de pedidos por restaurante (vista dueño)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS owner_order_statuses (
  id INT NOT NULL AUTO_INCREMENT,
  restaurant_id VARCHAR(10) NOT NULL,
  order_id INT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_owner_order_statuses_restaurant_id (restaurant_id),
  KEY idx_owner_order_statuses_order_id (order_id),
  CONSTRAINT fk_owner_order_statuses_restaurant
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_owner_order_statuses_order
    FOREIGN KEY (order_id) REFERENCES orders(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- 4) Inventario por restaurante
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory_items (
  id INT NOT NULL AUTO_INCREMENT,
  restaurant_id VARCHAR(10) NOT NULL,
  ingredient_name VARCHAR(120) NOT NULL,
  stock_quantity FLOAT NOT NULL DEFAULT 0,
  minimum_quantity FLOAT NOT NULL DEFAULT 0,
  unit VARCHAR(20) NOT NULL DEFAULT 'unidades',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_inventory_items_restaurant_id (restaurant_id),
  CONSTRAINT fk_inventory_items_restaurant
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- 5) Movimientos de inventario (trazabilidad)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory_movements (
  id INT NOT NULL AUTO_INCREMENT,
  inventory_item_id INT NOT NULL,
  restaurant_id VARCHAR(10) NOT NULL,
  movement_type VARCHAR(30) NOT NULL,
  quantity FLOAT NOT NULL,
  note VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_inventory_movements_inventory_item_id (inventory_item_id),
  KEY idx_inventory_movements_restaurant_id (restaurant_id),
  CONSTRAINT fk_inventory_movements_inventory_item
    FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_inventory_movements_restaurant
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================
-- COMPATIBILIDAD CON BASE LOCAL (SIN BORRAR DATOS)
-- Nota: requiere MySQL 8+ para IF EXISTS / IF NOT EXISTS en ALTER
-- =============================================================

ALTER TABLE IF EXISTS owner_accounts
  MODIFY COLUMN id VARCHAR(36) NOT NULL,
  MODIFY COLUMN restaurant_id VARCHAR(10) NOT NULL,
  MODIFY COLUMN email VARCHAR(120) NOT NULL,
  MODIFY COLUMN password_hash VARCHAR(128) NOT NULL,
  MODIFY COLUMN password_salt VARCHAR(64) NOT NULL;

ALTER TABLE IF EXISTS owner_business_profiles
  MODIFY COLUMN id VARCHAR(36) NOT NULL,
  MODIFY COLUMN restaurant_id VARCHAR(10) NOT NULL,
  MODIFY COLUMN owner_name VARCHAR(120) NOT NULL,
  MODIFY COLUMN nit VARCHAR(50) NOT NULL,
  MODIFY COLUMN address VARCHAR(180) NOT NULL,
  MODIFY COLUMN phone VARCHAR(30) NOT NULL;

ALTER TABLE IF EXISTS owner_order_statuses
  MODIFY COLUMN restaurant_id VARCHAR(10) NOT NULL,
  MODIFY COLUMN status VARCHAR(30) NOT NULL DEFAULT 'pending';

ALTER TABLE IF EXISTS inventory_items
  MODIFY COLUMN restaurant_id VARCHAR(10) NOT NULL,
  MODIFY COLUMN ingredient_name VARCHAR(120) NOT NULL,
  MODIFY COLUMN stock_quantity FLOAT NOT NULL DEFAULT 0,
  MODIFY COLUMN minimum_quantity FLOAT NOT NULL DEFAULT 0,
  MODIFY COLUMN unit VARCHAR(20) NOT NULL DEFAULT 'unidades';

ALTER TABLE IF EXISTS inventory_movements
  MODIFY COLUMN restaurant_id VARCHAR(10) NOT NULL,
  MODIFY COLUMN movement_type VARCHAR(30) NOT NULL,
  MODIFY COLUMN quantity FLOAT NOT NULL;

CREATE INDEX IF NOT EXISTS idx_owner_accounts_restaurant_id ON owner_accounts (restaurant_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_owner_accounts_email ON owner_accounts (email);
CREATE UNIQUE INDEX IF NOT EXISTS uq_owner_business_profiles_restaurant_id ON owner_business_profiles (restaurant_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_owner_business_profiles_nit ON owner_business_profiles (nit);
CREATE INDEX IF NOT EXISTS idx_owner_order_statuses_restaurant_id ON owner_order_statuses (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_owner_order_statuses_order_id ON owner_order_statuses (order_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_restaurant_id ON inventory_items (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_inventory_item_id ON inventory_movements (inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_restaurant_id ON inventory_movements (restaurant_id);

-- =============================================================
-- DATOS DEMO POV DUEÑO (OPCIONAL)
-- Cambia correo/clave/NIT si ya existen en tu DB
-- =============================================================

-- A) Restaurante demo dueño
INSERT INTO restaurants (id, nombre, categoria, rating, entrega)
VALUES ('RDEMO1', 'Bistro Dueño Demo', 'Pizza', 0.0, 'Por calcular')
ON DUPLICATE KEY UPDATE
  nombre = VALUES(nombre),
  categoria = VALUES(categoria),
  entrega = VALUES(entrega);

-- B) Perfil del dueño (1 a 1)
INSERT INTO owner_business_profiles (id, restaurant_id, owner_name, nit, address, phone)
VALUES ('OP-DEMO-001', 'RDEMO1', 'Dueño Demo', 'NIT-DEMO-001', 'Calle Demo 123', '3000000000')
ON DUPLICATE KEY UPDATE
  owner_name = VALUES(owner_name),
  nit = VALUES(nit),
  address = VALUES(address),
  phone = VALUES(phone);

-- C) Cuenta de dueño demo
-- La contraseña de este ejemplo es: Demo12345
-- Regla backend: hash = SHA2(CONCAT(salt, password), 256)
INSERT INTO owner_accounts (id, restaurant_id, email, password_hash, password_salt)
VALUES (
  'OA-DEMO-001',
  'RDEMO1',
  'dueno.demo@gastroia.local',
  SHA2(CONCAT('SALTDEMO123', 'Demo12345'), 256),
  'SALTDEMO123'
)
ON DUPLICATE KEY UPDATE
  restaurant_id = VALUES(restaurant_id),
  password_hash = VALUES(password_hash),
  password_salt = VALUES(password_salt);

-- D) Inventario inicial demo
INSERT INTO inventory_items (id, restaurant_id, ingredient_name, stock_quantity, minimum_quantity, unit)
VALUES
  (10001, 'RDEMO1', 'peperoni', 20, 8, 'unidades'),
  (10002, 'RDEMO1', 'queso mozzarella', 15, 6, 'kg'),
  (10003, 'RDEMO1', 'salsa de tomate', 12, 5, 'litros')
ON DUPLICATE KEY UPDATE
  stock_quantity = VALUES(stock_quantity),
  minimum_quantity = VALUES(minimum_quantity),
  unit = VALUES(unit);

-- E) Movimientos iniciales demo
INSERT IGNORE INTO inventory_movements (id, inventory_item_id, restaurant_id, movement_type, quantity, note)
VALUES
  (20001, 10001, 'RDEMO1', 'manual_adjustment', 20, 'Carga inicial'),
  (20002, 10002, 'RDEMO1', 'manual_adjustment', 15, 'Carga inicial'),
  (20003, 10003, 'RDEMO1', 'manual_adjustment', 12, 'Carga inicial');