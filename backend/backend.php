<?php
// backend.php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: GET, POST");

// 1. Conexión a la Base de Datos
$host = "localhost";
$user = "root";
$pass = ""; 
$dbname = "lavieja_store";

$conn = new mysqli($host, $user, $pass, $dbname);

if ($conn->connect_error) {
    echo json_encode(["status" => false, "error" => "Conexión fallida"]);
    exit;
}

// Configurar caracteres en UTF-8 para evitar problemas con tildes o eñes
$conn->set_charset("utf8");

// 2. Capturar la acción y el método HTTP
$action = isset($_GET['action']) ? $_GET['action'] : '';
$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents("php://input"), true);

// --- ACCIÓN: OBTENER TODO EL ESTADO INICIAL ---
if ($action === 'getAll' && $method === 'GET') {
    $categories = $conn->query("SELECT * FROM categorias")->fetch_all(MYSQLI_ASSOC);
    $inventory = $conn->query("SELECT * FROM productos")->fetch_all(MYSQLI_ASSOC);
    
    // Las tablas complejas (ventas y logs) las manejamos serializadas en JSON por simplicidad académica
    $sales_res = $conn->query("SELECT data_json FROM datos_sistema WHERE clave = 'sales'")->fetch_assoc();
    $deleted_res = $conn->query("SELECT data_json FROM datos_sistema WHERE clave = 'deletedRecords'")->fetch_assoc();
    $incoming_res = $conn->query("SELECT data_json FROM datos_sistema WHERE clave = 'incomingRecords'")->fetch_assoc();

    echo json_encode([
        "categories" => $categories ?: [],
        "inventory" => $inventory ?: [],
        "sales" => $sales_res ? json_decode($sales_res['data_json'], true) : [],
        "deletedRecords" => $deleted_res ? json_decode($deleted_res['data_json'], true) : [],
        "incomingRecords" => $incoming_res ? json_decode($incoming_res['data_json'], true) : []
    ]);
    exit;
}

// --- ACCIÓN: GUARDAR / EDITAR CATEGORÍA ---
if ($action === 'saveCategory' && $method === 'POST') {
    $id = $conn->real_escape_string($input['id']);
    $name = $conn->real_escape_string($input['name']);
    
    // Si viene 'oldName' significa que es una edición en cascada
    if (isset($input['oldName'])) {
        $oldName = $conn->real_escape_string($input['oldName']);
        $conn->query("UPDATE productos SET categoria = '$name' WHERE categoria = '$oldName'");
    }

    $sql = "INSERT INTO categorias (id, name) VALUES ('$id', '$name') 
            ON DUPLICATE KEY UPDATE name = '$name'";
    echo json_encode(["status" => $conn->query($sql)]);
    exit;
}

// --- ACCIÓN: ELIMINAR CATEGORÍA ---
if ($action === 'deleteCategory' && $method === 'POST') {
    $id = $conn->real_escape_string($input['id']);
    $sql = "DELETE FROM categorias WHERE id = '$id'";
    echo json_encode(["status" => $conn->query($sql)]);
    exit;
}

// --- ACCIÓN: GUARDAR / EDITAR PRODUCTO ---
if ($action === 'saveProduct' && $method === 'POST') {
    $id = $conn->real_escape_string($input['id']);
    $name = $conn->real_escape_string($input['name']);
    $category = $conn->real_escape_string($input['category']);
    $brand = $conn->real_escape_string($input['brand']);
    $price = floatval($input['price']);
    $stock = intval($input['stock']);

    // Si se editó el ID del producto, borramos el registro anterior
    if (isset($input['originalId']) && $input['originalId'] !== $id) {
        $oldId = $conn->real_escape_string($input['originalId']);
        $conn->query("DELETE FROM productos WHERE id = '$oldId'");
    }

    $sql = "INSERT INTO productos (id, nombre, categoria, marca, precio, stock) 
            VALUES ('$id', '$name', '$category', '$brand', $price, $stock) 
            ON DUPLICATE KEY UPDATE nombre='$name', categoria='$category', marca='$brand', precio=$price, stock=$stock";
    echo json_encode(["status" => $conn->query($sql)]);
    exit;
}

// --- ACCIÓN: AUMENTAR STOCK (INGRESO) ---
if ($action === 'addStock' && $method === 'POST') {
    $id = $conn->real_escape_string($input['id']);
    $stock = intval($input['stock']);
    $log = $input['log'];

    // Actualizar stock del producto
    $conn->query("UPDATE productos SET stock = $stock WHERE id = '$id'");

    // Actualizar log de ingresos histórico
    $res = $conn->query("SELECT data_json FROM datos_sistema WHERE clave = 'incomingRecords'")->fetch_assoc();
    $current_logs = $res ? json_decode($res['data_json'], true) : [];
    $current_logs[] = $log;
    $json_clean = $conn->real_escape_string(json_encode($current_logs));
    
    $sql = "INSERT INTO datos_sistema (clave, data_json) VALUES ('incomingRecords', '$json_clean') 
            ON DUPLICATE KEY UPDATE data_json = '$json_clean'";
    echo json_encode(["status" => $conn->query($sql)]);
    exit;
}

// --- ACCIÓN: ELIMINAR PRODUCTO (AUDITORÍA) ---
if ($action === 'deleteProduct' && $method === 'POST') {
    $id = $conn->real_escape_string($input['id']);
    $log = $input['log'];

    // Remover del inventario
    $conn->query("DELETE FROM productos WHERE id = '$id'");

    // Actualizar log de eliminaciones
    $res = $conn->query("SELECT data_json FROM datos_sistema WHERE clave = 'deletedRecords'")->fetch_assoc();
    $current_logs = $res ? json_decode($res['data_json'], true) : [];
    $current_logs[] = $log;
    $json_clean = $conn->real_escape_string(json_encode($current_logs));
    
    $sql = "INSERT INTO datos_sistema (clave, data_json) VALUES ('deletedRecords', '$json_clean') 
            ON DUPLICATE KEY UPDATE data_json = '$json_clean'";
    echo json_encode(["status" => $conn->query($sql)]);
    exit;
}

// --- ACCIÓN: CONFIRMAR VENTA Y DESCUENTO DE STOCK ---
if ($action === 'confirmSale' && $method === 'POST') {
    $sale = $input['sale'];
    $inventoryUpdates = $input['inventoryUpdates'];

    // 1. Descontar stock masivo en la BD
    foreach ($inventoryUpdates as $prod) {
        $pId = $conn->real_escape_string($prod['id']);
        $pStock = intval($prod['stock']);
        $conn->query("UPDATE productos SET stock = $pStock WHERE id = '$pId'");
    }

    // 2. Guardar la venta en el histórico json de la BD
    $res = $conn->query("SELECT data_json FROM datos_sistema WHERE clave = 'sales'")->fetch_assoc();
    $current_sales = $res ? json_decode($res['data_json'], true) : [];
    $current_sales[] = $sale;
    $json_clean = $conn->real_escape_string(json_encode($current_sales));
    
    $sql = "INSERT INTO datos_sistema (clave, data_json) VALUES ('sales', '$json_clean') 
            ON DUPLICATE KEY UPDATE data_json = '$json_clean'";
    
    echo json_encode(["status" => $conn->query($sql)]);
    exit;
}

echo json_encode(["status" => false, "error" => "Acción no válida"]);
?>