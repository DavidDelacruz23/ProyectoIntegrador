LaViejadeBlancaStore
Sistema académico de gestión de ventas e inventario para tiendas de ropa y calzado.
Incluye frontend (HTML, CSS, JS), backend (PHP + MySQL) y base de datos con auditoría de operaciones.

📂 Estructura del proyecto

lavieja_store/
│
├── backend/
│   └── backend.php          # Lógica del servidor (acciones CRUD, ventas, stock)
│
├── database/
│   └── lavieja_store.sql    # Dump SQL con tablas y datos iniciales
│
├── frontend/
│   ├── index.html           # Interfaz principal (login, dashboard, inventario, ventas, reportes)
│   ├── styles.css           # Estilos globales
│   └── script.js            # Lógica de interacción (CRUD, POS, reportes, dashboard)
│
└── docs/
    └── README.md            # Documentación del proyecto
⚙️ Instalación
Importa la base de datos:

CREATE DATABASE lavieja_store;
USE lavieja_store;
SOURCE lavieja_store.sql;

Configura el backend:

Edita backend.php con tus credenciales MySQL (host, user, pass).

Asegúrate de que el servidor tenga PHP 8+ y MariaDB/MySQL.

Abre el frontend:

Coloca la carpeta frontend/ en tu servidor web (ej. htdocs en XAMPP).

Accede a http://localhost/lavieja_store/frontend/index.html.

🗄️ Base de datos
Tablas principales:

categorias

id (PK), name

Contiene las categorías de productos.

productos

id (PK), nombre, categoria, marca, precio, stock

Inventario de productos.

datos_sistema

clave (PK), data_json

Guarda registros serializados en JSON:

sales: ventas confirmadas.

deletedRecords: productos eliminados.

incomingRecords: ingresos de stock.

🖥️ Funcionalidades
Login simulado: acceso al panel de control.

Dashboard: KPIs (ventas totales, stock, producto estrella, ingresos diarios) + gráficas con Chart.js.

Gestión de categorías: CRUD con validación y actualización en cascada.

Gestión de inventario: CRUD de productos, ingreso de stock, eliminación con auditoría.

Punto de venta (POS): carrito de ventas, confirmación de transacciones, actualización automática de stock.

Reportes: ventas por fecha, indicadores globales, máximos/mínimos, productos eliminados, ingresos de stock.

🚀 Flujo de sincronización
Frontend (script.js) → envía acciones (saveCategory, saveProduct, addStock, deleteProduct, confirmSale)

Backend (backend.php) → procesa acción y actualiza tablas (categorias, productos, datos_sistema)

Base de datos (lavieja_store.sql) → guarda estado persistente

Frontend → renderiza tablas, KPIs y reportes con datos actualizados.

📌 Notas
Este proyecto está diseñado para fines académicos.

En producción se recomienda normalizar las tablas de ventas y logs en lugar de usar JSON.

Se sugiere mejorar la UX reemplazando prompt() por modales con validación.