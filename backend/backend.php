<?php
// backend.php
// Backend del sistema de tienda: login y mantenimiento de categorias, productos y ventas.

header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: GET, POST");

// --- CONEXION A MYSQL ---
// Se centraliza la conexion para que todas las acciones CRUD usen la misma base lavieja_store.
$host = "localhost";
$user = "root";
$pass = "";
$dbname = "lavieja_store";

$conn = new mysqli($host, $user, $pass, $dbname);

if ($conn->connect_error) {
    echo json_encode(["status" => false, "message" => "Conexion fallida con la base de datos"]);
    exit;
}

$conn->set_charset("utf8mb4");

// --- ENTRADA GENERAL ---
// action indica la operacion solicitada y $input contiene el JSON enviado desde JavaScript.
$action = isset($_GET["action"]) ? $_GET["action"] : "";
$method = $_SERVER["REQUEST_METHOD"];
$input = json_decode(file_get_contents("php://input"), true);
if (!is_array($input)) {
    $input = [];
}

// --- RESPUESTA JSON ESTANDAR ---
// Esta funcion evita repetir json_encode y mantiene uniforme el formato status/message/data.
function sendJson($payload)
{
    echo json_encode($payload);
    exit;
}

// --- LECTURA SEGURA DE CAMPOS ---
// Retorna cadenas recortadas para validar datos obligatorios enviados por formularios.
function fieldValue($input, $key)
{
    return isset($input[$key]) ? trim((string)$input[$key]) : "";
}

// --- CONSULTA DE VENTAS ---
// Las ventas se guardan como JSON academico en datos_sistema; esta funcion las convierte a arreglo.
function getSales($conn)
{
    $res = $conn->query("SELECT data_json FROM datos_sistema WHERE clave = 'sales'");
    $row = $res ? $res->fetch_assoc() : null;
    return $row ? json_decode($row["data_json"], true) : [];
}

// --- CONSULTA DE LOGS DE ELIMINACION ---
// Lista logs desde la tabla nueva y mantiene compatibilidad si existen logs antiguos en datos_sistema.
function getDeletionLogs($conn)
{
    $logs = [];
    $tableCheck = $conn->query("SHOW TABLES LIKE 'logs_eliminaciones'");
    if ($tableCheck && $tableCheck->num_rows > 0) {
        $res = $conn->query("SELECT tipo, registro_id AS id, nombre AS name, motivo AS reason, fecha AS date FROM logs_eliminaciones ORDER BY fecha DESC");
        $logs = $res ? $res->fetch_all(MYSQLI_ASSOC) : [];
    }

    if (count($logs) === 0) {
        $res = $conn->query("SELECT data_json FROM datos_sistema WHERE clave = 'deletedRecords'");
        $row = $res ? $res->fetch_assoc() : null;
        $logs = $row ? json_decode($row["data_json"], true) : [];
    }

    return $logs ?: [];
}

// --- LOGIN REAL ---
// Valida usuario y password contra la tabla usuarios. No se crean ni modifican perfiles.
if ($action === "login" && $method === "POST") {
    $usuario = fieldValue($input, "usuario");
    $password = fieldValue($input, "password");

    if ($usuario === "" || $password === "") {
        sendJson(["status" => false, "message" => "Ingrese usuario y contrasena"]);
    }

    $stmt = $conn->prepare("SELECT rol FROM usuarios WHERE usuario = ? AND password = ? LIMIT 1");
    $stmt->bind_param("ss", $usuario, $password);
    $stmt->execute();
    $result = $stmt->get_result();
    $userData = $result->fetch_assoc();
    $stmt->close();

    if ($userData) {
        sendJson(["status" => true, "rol" => $userData["rol"], "message" => "Login correcto"]);
    }

    sendJson(["status" => false, "message" => "Credenciales incorrectas"]);
}

// --- CONSULTAR CATEGORIAS ---
// Retorna un listado basico de categorias en formato JSON para pintar la tabla del frontend.
if ($action === "listCategories" && $method === "GET") {
    $res = $conn->query("SELECT id, name FROM categorias ORDER BY name ASC");
    sendJson(["status" => true, "data" => $res ? $res->fetch_all(MYSQLI_ASSOC) : []]);
}

// --- CONSULTAR PRODUCTOS ---
// Retorna productos con alias compatibles con el JavaScript: name, category, brand, price.
if ($action === "listProducts" && $method === "GET") {
    $sql = "SELECT id, nombre AS name, categoria AS category, marca AS brand, precio AS price, stock FROM productos ORDER BY nombre ASC";
    $res = $conn->query($sql);
    sendJson(["status" => true, "data" => $res ? $res->fetch_all(MYSQLI_ASSOC) : []]);
}

// --- CONSULTAR VENTAS ---
// Lista ventas registradas por el POS. No incluye filtros avanzados, solo listado basico.
if ($action === "listSales" && $method === "GET") {
    sendJson(["status" => true, "data" => getSales($conn)]);
}

// --- CONSULTAR TODO EL ESTADO INICIAL ---
// Carga categorias, productos, ventas y logs para inicializar la aplicacion en una sola llamada.
if ($action === "getAll" && $method === "GET") {
    $categories = $conn->query("SELECT id, name FROM categorias ORDER BY name ASC");
    $products = $conn->query("SELECT id, nombre AS name, categoria AS category, marca AS brand, precio AS price, stock FROM productos ORDER BY nombre ASC");
    $incoming = $conn->query("SELECT data_json FROM datos_sistema WHERE clave = 'incomingRecords'")->fetch_assoc();

    sendJson([
        "status" => true,
        "categories" => $categories ? $categories->fetch_all(MYSQLI_ASSOC) : [],
        "inventory" => $products ? $products->fetch_all(MYSQLI_ASSOC) : [],
        "sales" => getSales($conn),
        "deletedRecords" => getDeletionLogs($conn),
        "incomingRecords" => $incoming ? json_decode($incoming["data_json"], true) : []
    ]);
}

// --- ADICIONAR CATEGORIA ---
// Inserta una categoria nueva y valida que el ID no exista previamente.
if ($action === "addCategory" && $method === "POST") {
    $id = fieldValue($input, "id");
    $name = fieldValue($input, "name");

    if ($id === "" || $name === "") {
        sendJson(["status" => false, "message" => "El ID y el nombre de la categoria son obligatorios"]);
    }

    $stmt = $conn->prepare("SELECT id FROM categorias WHERE id = ? LIMIT 1");
    $stmt->bind_param("s", $id);
    $stmt->execute();
    if ($stmt->get_result()->num_rows > 0) {
        $stmt->close();
        sendJson(["status" => false, "message" => "Ya existe una categoria con ese ID"]);
    }
    $stmt->close();

    $stmt = $conn->prepare("INSERT INTO categorias (id, name) VALUES (?, ?)");
    $stmt->bind_param("ss", $id, $name);
    $ok = $stmt->execute();
    $stmt->close();

    sendJson(["status" => $ok, "message" => $ok ? "Categoria registrada correctamente" : "No se pudo registrar la categoria"]);
}

// --- MODIFICAR CATEGORIA ---
// Actualiza una categoria existente y replica el cambio de nombre en productos asociados.
if (($action === "updateCategory" || $action === "saveCategory") && $method === "POST") {
    $id = fieldValue($input, "id");
    $name = fieldValue($input, "name");
    $oldName = fieldValue($input, "oldName");

    if ($id === "" || $name === "") {
        sendJson(["status" => false, "message" => "El ID y el nombre de la categoria son obligatorios"]);
    }

    $stmt = $conn->prepare("SELECT name FROM categorias WHERE id = ? LIMIT 1");
    $stmt->bind_param("s", $id);
    $stmt->execute();
    $current = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$current) {
        sendJson(["status" => false, "message" => "La categoria no existe"]);
    }

    $previousName = $oldName !== "" ? $oldName : $current["name"];

    $stmt = $conn->prepare("UPDATE categorias SET name = ? WHERE id = ?");
    $stmt->bind_param("ss", $name, $id);
    $ok = $stmt->execute();
    $stmt->close();

    if ($ok && $previousName !== $name) {
        $stmt = $conn->prepare("UPDATE productos SET categoria = ? WHERE categoria = ?");
        $stmt->bind_param("ss", $name, $previousName);
        $stmt->execute();
        $stmt->close();
    }

    sendJson(["status" => $ok, "message" => $ok ? "Categoria actualizada correctamente" : "No se pudo actualizar la categoria"]);
}

// --- ELIMINAR CATEGORIA ---
// Elimina una categoria solo si no tiene productos asociados y registra el motivo en logs_eliminaciones.
if ($action === "deleteCategory" && $method === "POST") {
    $id = fieldValue($input, "id");
    $reason = fieldValue($input, "reason");

    if ($id === "" || $reason === "") {
        sendJson(["status" => false, "message" => "Debe indicar categoria y motivo de eliminacion"]);
    }

    $stmt = $conn->prepare("SELECT name FROM categorias WHERE id = ? LIMIT 1");
    $stmt->bind_param("s", $id);
    $stmt->execute();
    $category = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$category) {
        sendJson(["status" => false, "message" => "La categoria no existe"]);
    }

    $stmt = $conn->prepare("SELECT COUNT(*) AS total FROM productos WHERE categoria = ?");
    $stmt->bind_param("s", $category["name"]);
    $stmt->execute();
    $count = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if ((int)$count["total"] > 0) {
        sendJson(["status" => false, "message" => "No se puede eliminar: existen productos asociados"]);
    }

    $stmt = $conn->prepare("DELETE FROM categorias WHERE id = ?");
    $stmt->bind_param("s", $id);
    $ok = $stmt->execute();
    $stmt->close();

    if ($ok) {
        $tipo = "categoria";
        $stmt = $conn->prepare("INSERT INTO logs_eliminaciones (tipo, registro_id, nombre, motivo) VALUES (?, ?, ?, ?)");
        $stmt->bind_param("ssss", $tipo, $id, $category["name"], $reason);
        $stmt->execute();
        $stmt->close();
    }

    sendJson(["status" => $ok, "message" => $ok ? "Categoria eliminada correctamente" : "No se pudo eliminar la categoria"]);
}

// --- ADICIONAR PRODUCTO ---
// Inserta un producto nuevo, validando ID unico, campos obligatorios y valores positivos.
if ($action === "addProduct" && $method === "POST") {
    $id = fieldValue($input, "id");
    $name = fieldValue($input, "name");
    $category = fieldValue($input, "category");
    $brand = fieldValue($input, "brand");
    $price = isset($input["price"]) ? (float)$input["price"] : -1;
    $stock = isset($input["stock"]) ? (int)$input["stock"] : -1;

    if ($id === "" || $name === "" || $category === "" || $brand === "" || $price <= 0 || $stock <= 0) {
        sendJson(["status" => false, "message" => "Complete todos los campos; precio y stock deben ser positivos"]);
    }

    $stmt = $conn->prepare("SELECT id FROM productos WHERE id = ? LIMIT 1");
    $stmt->bind_param("s", $id);
    $stmt->execute();
    if ($stmt->get_result()->num_rows > 0) {
        $stmt->close();
        sendJson(["status" => false, "message" => "Ya existe un producto con ese ID"]);
    }
    $stmt->close();

    $stmt = $conn->prepare("INSERT INTO productos (id, nombre, categoria, marca, precio, stock) VALUES (?, ?, ?, ?, ?, ?)");
    $stmt->bind_param("ssssdi", $id, $name, $category, $brand, $price, $stock);
    $ok = $stmt->execute();
    $stmt->close();

    sendJson(["status" => $ok, "message" => $ok ? "Producto registrado correctamente" : "No se pudo registrar el producto"]);
}

// --- MODIFICAR PRODUCTO ---
// Actualiza un producto existente y valida que precio/stock sean valores correctos.
if (($action === "updateProduct" || $action === "saveProduct") && $method === "POST") {
    $originalId = fieldValue($input, "originalId");
    $id = fieldValue($input, "id");
    $name = fieldValue($input, "name");
    $category = fieldValue($input, "category");
    $brand = fieldValue($input, "brand");
    $price = isset($input["price"]) ? (float)$input["price"] : -1;
    $stock = isset($input["stock"]) ? (int)$input["stock"] : -1;
    $lookupId = $originalId !== "" ? $originalId : $id;

    if ($id === "" || $name === "" || $category === "" || $brand === "" || $price <= 0 || $stock <= 0) {
        sendJson(["status" => false, "message" => "Complete todos los campos; precio y stock deben ser positivos"]);
    }

    $stmt = $conn->prepare("SELECT id FROM productos WHERE id = ? LIMIT 1");
    $stmt->bind_param("s", $lookupId);
    $stmt->execute();
    if ($stmt->get_result()->num_rows === 0) {
        $stmt->close();
        sendJson(["status" => false, "message" => "El producto no existe"]);
    }
    $stmt->close();

    if ($lookupId !== $id) {
        $stmt = $conn->prepare("SELECT id FROM productos WHERE id = ? LIMIT 1");
        $stmt->bind_param("s", $id);
        $stmt->execute();
        if ($stmt->get_result()->num_rows > 0) {
            $stmt->close();
            sendJson(["status" => false, "message" => "El nuevo ID ya pertenece a otro producto"]);
        }
        $stmt->close();
    }

    $stmt = $conn->prepare("UPDATE productos SET id = ?, nombre = ?, categoria = ?, marca = ?, precio = ?, stock = ? WHERE id = ?");
    $stmt->bind_param("ssssdis", $id, $name, $category, $brand, $price, $stock, $lookupId);
    $ok = $stmt->execute();
    $stmt->close();

    sendJson(["status" => $ok, "message" => $ok ? "Producto actualizado correctamente" : "No se pudo actualizar el producto"]);
}

// --- ELIMINAR PRODUCTO ---
// Elimina un producto y guarda el motivo en logs_eliminaciones para auditoria.
if ($action === "deleteProduct" && $method === "POST") {
    $id = fieldValue($input, "id");
    $reason = fieldValue($input, "reason");
    if ($reason === "" && isset($input["log"]["reason"])) {
        $reason = trim((string)$input["log"]["reason"]);
    }

    if ($id === "" || $reason === "") {
        sendJson(["status" => false, "message" => "Debe indicar producto y motivo de eliminacion"]);
    }

    $stmt = $conn->prepare("SELECT nombre FROM productos WHERE id = ? LIMIT 1");
    $stmt->bind_param("s", $id);
    $stmt->execute();
    $product = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$product) {
        sendJson(["status" => false, "message" => "El producto no existe"]);
    }

    $stmt = $conn->prepare("DELETE FROM productos WHERE id = ?");
    $stmt->bind_param("s", $id);
    $ok = $stmt->execute();
    $stmt->close();

    if ($ok) {
        $tipo = "producto";
        $stmt = $conn->prepare("INSERT INTO logs_eliminaciones (tipo, registro_id, nombre, motivo) VALUES (?, ?, ?, ?)");
        $stmt->bind_param("ssss", $tipo, $id, $product["nombre"], $reason);
        $stmt->execute();
        $stmt->close();
    }

    sendJson(["status" => $ok, "message" => $ok ? "Producto eliminado correctamente" : "No se pudo eliminar el producto"]);
}

// --- AUMENTAR STOCK ---
// Mantiene el ingreso de stock y registra el movimiento en datos_sistema para reportes.
if ($action === "addStock" && $method === "POST") {
    $id = fieldValue($input, "id");
    $stock = isset($input["stock"]) ? (int)$input["stock"] : -1;
    $log = isset($input["log"]) ? $input["log"] : [];

    if ($id === "" || $stock < 0) {
        sendJson(["status" => false, "message" => "Datos de stock invalidos"]);
    }

    $stmt = $conn->prepare("UPDATE productos SET stock = ? WHERE id = ?");
    $stmt->bind_param("is", $stock, $id);
    $ok = $stmt->execute();
    $stmt->close();

    $res = $conn->query("SELECT data_json FROM datos_sistema WHERE clave = 'incomingRecords'");
    $row = $res ? $res->fetch_assoc() : null;
    $logs = $row ? json_decode($row["data_json"], true) : [];
    $logs[] = $log;
    $json = json_encode($logs);

    $stmt = $conn->prepare("INSERT INTO datos_sistema (clave, data_json) VALUES ('incomingRecords', ?) ON DUPLICATE KEY UPDATE data_json = ?");
    $stmt->bind_param("ss", $json, $json);
    $stmt->execute();
    $stmt->close();

    sendJson(["status" => $ok, "message" => $ok ? "Stock actualizado correctamente" : "No se pudo actualizar el stock"]);
}

// --- ADICIONAR VENTA ---
// Registra una venta desde el POS, descuenta stock y guarda la venta para consultas basicas.
if ($action === "confirmSale" && $method === "POST") {
    $sale = isset($input["sale"]) ? $input["sale"] : null;
    $inventoryUpdates = isset($input["inventoryUpdates"]) ? $input["inventoryUpdates"] : [];

    if (!$sale || !isset($sale["id"], $sale["date"], $sale["items"], $sale["total"])) {
        sendJson(["status" => false, "message" => "Datos de venta invalidos"]);
    }

    foreach ($inventoryUpdates as $prod) {
        $pId = isset($prod["id"]) ? trim((string)$prod["id"]) : "";
        $pStock = isset($prod["stock"]) ? (int)$prod["stock"] : 0;
        $stmt = $conn->prepare("UPDATE productos SET stock = ? WHERE id = ?");
        $stmt->bind_param("is", $pStock, $pId);
        $stmt->execute();
        $stmt->close();
    }

    $sales = getSales($conn);
    $sales[] = $sale;
    $json = json_encode($sales);

    $stmt = $conn->prepare("INSERT INTO datos_sistema (clave, data_json) VALUES ('sales', ?) ON DUPLICATE KEY UPDATE data_json = ?");
    $stmt->bind_param("ss", $json, $json);
    $ok = $stmt->execute();
    $stmt->close();

    sendJson(["status" => $ok, "message" => $ok ? "Venta registrada correctamente" : "No se pudo registrar la venta"]);
}

sendJson(["status" => false, "message" => "Accion no valida"]);
?>
