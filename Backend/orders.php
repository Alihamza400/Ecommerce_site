<?php
// ============================================================
// orders.php — Backend API for Checkout and Order History
// ============================================================
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : 'http://localhost';
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: $origin");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/config.php';
session_start();

if (!isset($_SESSION['SESS-ID'])) {
    http_response_code(401);
    echo json_encode(["success" => false, "message" => "Unauthorized. Please log in."]);
    exit();
}

$user_id = $_SESSION['SESS-ID'];
$method = $_SERVER['REQUEST_METHOD'];

// Helper to generate UUIDs
function gen_uuid() {
    return sprintf(
        '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
        mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff),
        mt_rand(0, 0x0fff) | 0x4000, mt_rand(0, 0x3fff) | 0x8000,
        mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
    );
}

// ── GET: View Order History (Customer) or All Orders (Admin/Vendor) ──────────
if ($method === 'GET') {
    $role = $_SESSION['SESS-ROLE'] ?? 'customer';
    $uuid = $_GET['uuid'] ?? null;

    if ($uuid) {
        // Fetch Single Order Details
        $stmt = $con->prepare("
            SELECT o.*, u.name as customer_name, u.email as customer_email,
                   ua.address_line, ua.city, ua.state, ua.postal_code, ua.country,
                   s.tracking_number, s.carrier, s.status as shipment_status
            FROM orders o
            JOIN users u ON o.user_id = u.id
            LEFT JOIN user_addresses ua ON o.address_id = ua.id
            LEFT JOIN shipments s ON o.id = s.order_id
            WHERE o.uuid = ? " . ($role !== 'admin' ? "AND o.user_id = ?" : "") . "
            LIMIT 1
        ");
        
        if ($role !== 'admin') {
            $stmt->bind_param("si", $uuid, $user_id);
        } else {
            $stmt->bind_param("s", $uuid);
        }
        
        $stmt->execute();
        $order = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if (!$order) {
            http_response_code(404);
            echo json_encode(["success" => false, "message" => "Order not found."]);
            exit();
        }

        // Fetch Order Items
        $stmt = $con->prepare("
            SELECT oi.*, p.name as product_name, pv.sku, pv.price as unit_price
            FROM order_items oi
            JOIN product_variants pv ON oi.product_variant_id = pv.id
            JOIN products p ON pv.product_id = p.id
            WHERE oi.order_id = ?
        ");
        $stmt->bind_param("i", $order['id']);
        $stmt->execute();
        $items = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $stmt->close();

        echo json_encode(["success" => true, "order" => $order, "items" => $items]);
        exit();
    }
    
    if ($role === 'admin') {
        // Admins see everything + Customer details
        $sql = "
            SELECT o.id, o.uuid, o.total_amount, o.status, o.payment_status, o.created_at, 
                   u.name as customer_name, u.email as customer_email,
                   ua.address_line, ua.city, ua.country
            FROM orders o
            JOIN users u ON o.user_id = u.id
            LEFT JOIN user_addresses ua ON o.address_id = ua.id
            ORDER BY o.created_at DESC
        ";
        $stmt = $con->prepare($sql);
    } else {
        // Customers only see their own
        $stmt = $con->prepare("
            SELECT id, uuid, total_amount, status, payment_status, created_at 
            FROM orders WHERE user_id = ? ORDER BY created_at DESC
        ");
        $stmt->bind_param("i", $user_id);
    }

    $stmt->execute();
    $result = $stmt->get_result();
    
    $orders = [];
    while ($row = $result->fetch_assoc()) {
        $orders[] = $row;
    }
    $stmt->close();
    
    echo json_encode(["success" => true, "orders" => $orders]);
    exit();
}

// ── POST: Checkout / Create Order ───────────────────────────
if ($method === 'POST') {
    $raw = file_get_contents("php://input");
    $data = !empty($raw) ? json_decode($raw, true) : $_POST;
    
    $address_id     = intval($data['address_id'] ?? 0);
    $payment_method = trim($data['payment_method'] ?? 'credit_card');
    // Accept real transaction_id from Payment Orchestrator (or null for legacy)
    $ext_transaction_id = trim($data['transaction_id'] ?? '');
    $gateway_used       = trim($data['gateway_used']   ?? $payment_method);
    
    if ($address_id <= 0) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Valid shipping address required."]);
        exit();
    }
    
    // 1. Fetch Cart
    $stmt = $con->prepare("SELECT id FROM carts WHERE user_id = ? LIMIT 1");
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $res = $stmt->get_result();
    if($res->num_rows === 0){
        http_response_code(400); echo json_encode(["success" => false, "message" => "No active cart found."]); exit();
    }
    $cart_id = $res->fetch_assoc()['id'];
    $stmt->close();
    
    // 2. Fetch Cart Items & Calculate Total
    $stmt = $con->prepare("
        SELECT ci.product_variant_id, ci.quantity, pv.price 
        FROM cart_items ci JOIN product_variants pv ON ci.product_variant_id = pv.id 
        WHERE ci.cart_id = ?
    ");
    $stmt->bind_param("i", $cart_id);
    $stmt->execute();
    $res = $stmt->get_result();
    
    $items = [];
    $total_amount = 0;
    while($row = $res->fetch_assoc()){
        $row['price'] = floatval($row['price']);
        $total_amount += ($row['price'] * intval($row['quantity']));
        $items[] = $row;
    }
    $stmt->close();
    
    if(count($items) === 0){
        http_response_code(400); echo json_encode(["success" => false, "message" => "Your cart is empty."]); exit();
    }
    
    // Provide transaction atomicity mapping to db
    $con->begin_transaction();
    try {
        // Create Order
        $order_uuid = gen_uuid();
        $ins_order = $con->prepare("INSERT INTO orders (uuid, user_id, address_id, total_amount, status, payment_status) VALUES (?, ?, ?, ?, 'pending', 'paid')");
        $ins_order->bind_param("siid", $order_uuid, $user_id, $address_id, $total_amount);
        $ins_order->execute();
        $order_id = $ins_order->insert_id;
        $ins_order->close();
        
        // Copy items to order_items & Deduct Stock
        $ins_item = $con->prepare("INSERT INTO order_items (order_id, product_variant_id, price, quantity) VALUES (?, ?, ?, ?)");
        $upd_stock = $con->prepare("UPDATE product_variants SET stock = stock - ? WHERE id = ?");
        
        foreach($items as $i) {
            // Insert item
            $ins_item->bind_param("iidi", $order_id, $i['product_variant_id'], $i['price'], $i['quantity']);
            $ins_item->execute();

            // Deduct stock
            $upd_stock->bind_param("ii", $i['quantity'], $i['product_variant_id']);
            $upd_stock->execute();
        }
        $ins_item->close();
        $upd_stock->close();
        
        // Use real Orchestrator transaction ID if provided, else generate fallback
        $pay_uuid = gen_uuid();
        $tx_id    = !empty($ext_transaction_id)
                      ? $ext_transaction_id
                      : 'TXN-' . strtoupper(substr(md5(uniqid()), 0, 10));
        $ins_pay = $con->prepare("INSERT INTO payments (uuid, order_id, payment_method, transaction_id, amount, status) VALUES (?, ?, ?, ?, ?, 'success')");
        $ins_pay->bind_param("sissd", $pay_uuid, $order_id, $gateway_used, $tx_id, $total_amount);
        $ins_pay->execute();
        $ins_pay->close();
        
        // Empty Cart
        $del_cart = $con->prepare("DELETE FROM cart_items WHERE cart_id = ?");
        $del_cart->bind_param("i", $cart_id);
        $del_cart->execute();
        $del_cart->close();
        
        $con->commit();
        
        echo json_encode([
            "success" => true, 
            "message" => "Checkout successful! Order placed.", 
            "order_id" => $order_uuid
        ]);
        
    } catch(Exception $e) {
        $con->rollback();
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Checkout failed: " . $e->getMessage()]);
    }
    exit();
}

// ── PUT: Update Order Status (Admin Only) ────────────────────
if ($method === 'PUT') {
    $role = $_SESSION['SESS-ROLE'] ?? 'customer';
    if ($role !== 'admin') {
        http_response_code(403);
        echo json_encode(["success" => false, "message" => "Forbidden. Only Admin can change order status."]);
        exit();
    }

    $raw = file_get_contents("php://input");
    $data = json_decode($raw, true) ?? [];
    if(empty($data)) parse_str($raw, $data);

    $order_id = intval($data['order_id'] ?? 0);
    $new_status = trim($data['status'] ?? '');

    $allowed_statuses = ['pending','confirmed','processing','shipped','delivered','cancelled'];
    if ($order_id <= 0 || !in_array($new_status, $allowed_statuses)) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Invalid order ID or status."]);
        exit();
    }

    $con->begin_transaction();
    try {
        // Update Order Status
        $stmt = $con->prepare("UPDATE orders SET status = ? WHERE id = ?");
        $stmt->bind_param("si", $new_status, $order_id);
        $stmt->execute();
        $stmt->close();

        // If status is 'shipped', create a shipment record if not exists
        if ($new_status === 'shipped') {
            $ship_uuid = gen_uuid();
            $tracking = "TRK" . strtoupper(substr(md5(uniqid()), 0, 12));
            $carrier = "ShopVerse Logistics";
            
            $ins_ship = $con->prepare("INSERT INTO shipments (uuid, order_id, tracking_number, carrier, status, shipped_at) VALUES (?, ?, ?, ?, 'in_transit', NOW()) ON DUPLICATE KEY UPDATE status='in_transit'");
            $ins_ship->bind_param("siss", $ship_uuid, $order_id, $tracking, $carrier);
            $ins_ship->execute();
            $ins_ship->close();
        }

        $con->commit();
        echo json_encode(["success" => true, "message" => "Order updated to $new_status."]);
    } catch (Exception $e) {
        $con->rollback();
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Update failed: " . $e->getMessage()]);
    }
    exit();
}

http_response_code(405);
echo json_encode(["success" => false, "message" => "Method not handled."]);
?>
