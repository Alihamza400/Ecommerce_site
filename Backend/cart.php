<?php
// ============================================================
// cart.php — Dedicated Backend API for Shopping Cart
// ============================================================
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : 'http://localhost';
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: $origin");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/config.php';
session_start();

// Ensure user is logged in
if (!isset($_SESSION['SESS-ID'])) {
    http_response_code(401);
    echo json_encode(["success" => false, "message" => "Unauthorized. Please log in."]);
    exit();
}

$user_id = $_SESSION['SESS-ID'];

// ── Helper: Get or Create Cart ──────────────────────────────
function getOrCreateCart($con, $user_id) {
    // Check if active cart exists
    $stmt = $con->prepare("SELECT id FROM carts WHERE user_id = ? LIMIT 1");
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($row = $result->fetch_assoc()) {
        $stmt->close();
        return $row['id'];
    }
    $stmt->close();

    // Create new cart
    $uuid = sprintf(
        '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
        mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff),
        mt_rand(0, 0x0fff) | 0x4000, mt_rand(0, 0x3fff) | 0x8000,
        mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
    );
    
    $stmt = $con->prepare("INSERT INTO carts (uuid, user_id) VALUES (?, ?)");
    $stmt->bind_param("si", $uuid, $user_id);
    $stmt->execute();
    $cart_id = $stmt->insert_id;
    $stmt->close();
    
    return $cart_id;
}

$method = $_SERVER['REQUEST_METHOD'];

// ── GET: View Cart ──────────────────────────────────────────
if ($method === 'GET') {
    $cart_id = getOrCreateCart($con, $user_id);
    
    $sql = "
        SELECT 
            ci.id as cart_item_id,
            ci.quantity,
            pv.id as variant_id,
            pv.price,
            pv.attributes,
            p.name as product_name,
            p.brand,
            c.name as category_name
        FROM cart_items ci
        JOIN product_variants pv ON ci.product_variant_id = pv.id
        JOIN products p ON pv.product_id = p.id
        LEFT JOIN product_categories pc ON p.id = pc.product_id
        LEFT JOIN categories c ON pc.category_id = c.id
        WHERE ci.cart_id = ?
        GROUP BY ci.id
    ";
    
    $stmt = $con->prepare($sql);
    $stmt->bind_param("i", $cart_id);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $items = [];
    $total_amount = 0;
    
    while ($row = $result->fetch_assoc()) {
        $row['subtotal'] = floatval($row['price']) * intval($row['quantity']);
        $total_amount += $row['subtotal'];
        $items[] = $row;
    }
    $stmt->close();
    
    echo json_encode([
        "success" => true,
        "cart_id" => $cart_id,
        "items" => $items,
        "total_amount" => $total_amount
    ]);
    exit();
}

// Parse body for POST, PUT, DELETE
$data = [];
if ($method === 'POST') {
    // For POST, PHP populates $_POST automatically for multipart/form-data
    $data = $_POST;
    
    // Fallback for JSON POST
    $raw = file_get_contents("php://input");
    if (empty($data) && !empty($raw)) {
        $decoded = json_decode($raw, true);
        if (is_array($decoded)) $data = $decoded;
    }
} else {
    // For PUT/DELETE, we must manually parse the input
    $raw = file_get_contents("php://input");
    if (!empty($raw)) {
        // First try JSON
        $decoded = json_decode($raw, true);
        if (is_array($decoded)) {
            $data = $decoded;
        } else {
            // Fallback to URL-encoded
            parse_str($raw, $data);
        }
    }
}

// ── POST: Add Item to Cart ──────────────────────────────────
if ($method === 'POST') {
    $cart_id = getOrCreateCart($con, $user_id);
    $product_id = intval($data['product_id'] ?? 0);
    $quantity   = intval($data['quantity'] ?? 1);
    
    if ($product_id <= 0 || $quantity <= 0) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Invalid product or quantity."]);
        exit();
    }
    
    // Get the primary variant and check its stock
    $stmt = $con->prepare("SELECT id, stock FROM product_variants WHERE product_id = ? LIMIT 1");
    $stmt->bind_param("i", $product_id);
    $stmt->execute();
    $res = $stmt->get_result();
    if ($res->num_rows === 0) {
        http_response_code(404);
        echo json_encode(["success" => false, "message" => "Product variant not found."]);
        exit();
    }
    $variant = $res->fetch_assoc();
    $variant_id = $variant['id'];
    $stock_available = intval($variant['stock']);
    $stmt->close();
    
    // Check if item already exists in cart to calculate total requested quantity
    $stmt = $con->prepare("SELECT id, quantity FROM cart_items WHERE cart_id = ? AND product_variant_id = ?");
    $stmt->bind_param("ii", $cart_id, $variant_id);
    $stmt->execute();
    $res = $stmt->get_result();
    
    $existing_qty = 0;
    $cart_item_id = null;
    if ($row = $res->fetch_assoc()) {
        $existing_qty = $row['quantity'];
        $cart_item_id = $row['id'];
    }
    $stmt->close();

    $total_requested = $existing_qty + $quantity;

    if ($total_requested > $stock_available) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Only $stock_available units in stock."]);
        exit();
    }
    
    if ($cart_item_id) {
        // Update quantity
        error_log("POST (Increment): cart_item_id=$cart_item_id, total_requested=$total_requested");
        $upd = $con->prepare("UPDATE cart_items SET quantity = ? WHERE id = ?");
        $upd->bind_param("ii", $total_requested, $cart_item_id);
        $upd->execute();
        error_log("UPDATE Success: Affected Rows = " . $upd->affected_rows);
        $upd->close();
    } else {
        // Insert new item
        error_log("POST (Insert): variant_id=$variant_id, quantity=$quantity, cart_id=$cart_id");
        $ins = $con->prepare("INSERT INTO cart_items (cart_id, product_variant_id, quantity) VALUES (?, ?, ?)");
        $ins->bind_param("iii", $cart_id, $variant_id, $quantity);
        $ins->execute();
        error_log("INSERT Success: ID = " . $ins->insert_id);
        $ins->close();
    }
    
    http_response_code(200);
    echo json_encode(["success" => true, "message" => "Item added to cart."]);
    exit();
}

// ── PUT: Update Item Quantity ───────────────────────────────
if ($method === 'PUT') {
    $cart_item_id = intval($data['cart_item_id'] ?? 0);
    $quantity     = intval($data['quantity'] ?? 0);
    $cart_id      = getOrCreateCart($con, $user_id);
    
    if ($cart_item_id <= 0 || $quantity <= 0) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Invalid item or quantity."]);
        exit();
    }

    // Check stock before updating
    $stmt = $con->prepare("
        SELECT pv.stock 
        FROM product_variants pv 
        JOIN cart_items ci ON pv.id = ci.product_variant_id 
        WHERE ci.id = ? AND ci.cart_id = ?
    ");
    $stmt->bind_param("ii", $cart_item_id, $cart_id);
    $stmt->execute();
    $res = $stmt->get_result();
    if ($row = $res->fetch_assoc()) {
        if ($quantity > $row['stock']) {
            http_response_code(400);
            echo json_encode(["success" => false, "message" => "Only " . $row['stock'] . " units in stock."]);
            exit();
        }
    }
    $stmt->close();
    
    error_log("PUT Request: cart_item_id=$cart_item_id, quantity=$quantity, cart_id=$cart_id");

    $upd = $con->prepare("UPDATE cart_items SET quantity = ? WHERE id = ? AND cart_id = ?");
    $upd->bind_param("iii", $quantity, $cart_item_id, $cart_id);
    
    if ($upd->execute()) {
        $affected = $upd->affected_rows;
        error_log("UPDATE Success: Affected Rows = $affected");
        echo json_encode(["success" => true, "message" => "Cart updated.", "affected" => $affected]);
    } else {
        error_log("UPDATE Failed: " . $con->error);
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Update failed."]);
    }
    $upd->close();
    exit();
}

// ── DELETE: Remove Item from Cart ───────────────────────────
if ($method === 'DELETE') {
    // DELETE requests often pass data in URL or raw body
    $cart_item_id = intval($_GET['cart_item_id'] ?? $data['cart_item_id'] ?? 0);
    $cart_id      = getOrCreateCart($con, $user_id);
    
    if ($cart_item_id <= 0) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Invalid item ID."]);
        exit();
    }
    
    $del = $con->prepare("DELETE FROM cart_items WHERE id = ? AND cart_id = ?");
    $del->bind_param("ii", $cart_item_id, $cart_id);
    
    if ($del->execute()) {
        echo json_encode(["success" => true, "message" => "Item removed."]);
    } else {
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Removal failed."]);
    }
    $del->close();
    exit();
}

http_response_code(405);
echo json_encode(["success" => false, "message" => "Method not handled."]);
?>
