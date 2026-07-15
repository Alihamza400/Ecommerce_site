<?php
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : 'http://localhost';
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: $origin");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit(); }

require_once __DIR__ . '/config.php';
session_start();

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'POST') {
    $data = json_decode(file_get_contents("php://input"), true);
    $code = strtoupper(trim($data['code'] ?? ''));
    $subtotal = floatval($data['subtotal'] ?? 0);

    if (empty($code)) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Enter a coupon code."]);
        exit();
    }

    $stmt = $con->prepare("SELECT * FROM coupons WHERE code = ? AND is_active = 1 AND (expires_at IS NULL OR expires_at > NOW())");
    $stmt->bind_param("s", $code);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        echo json_encode(["success" => false, "message" => "Invalid or expired coupon code."]);
        exit();
    }

    $coupon = $result->fetch_assoc();
    $stmt->close();

    if ($coupon['max_uses'] && $coupon['used_count'] >= $coupon['max_uses']) {
        echo json_encode(["success" => false, "message" => "This coupon has reached its usage limit."]);
        exit();
    }

    if ($subtotal < $coupon['min_order_amount']) {
        echo json_encode(["success" => false, "message" => "Minimum order amount is $" . number_format($coupon['min_order_amount'], 2) . " for this coupon."]);
        exit();
    }

    if ($coupon['discount_type'] === 'percentage') {
        $discount = round($subtotal * $coupon['discount_value'] / 100, 2);
    } else {
        $discount = min($coupon['discount_value'], $subtotal);
    }

    echo json_encode([
        "success" => true,
        "coupon" => [
            "code" => $coupon['code'],
            "description" => $coupon['description'],
            "discount_type" => $coupon['discount_type'],
            "discount_value" => floatval($coupon['discount_value']),
            "discount" => $discount
        ],
        "message" => "Coupon applied! You save $" . number_format($discount, 2)
    ]);
    exit();
}

if ($method === 'GET' && isset($_SESSION['SESS-ROLE']) && $_SESSION['SESS-ROLE'] === 'admin') {
    $result = $con->query("SELECT * FROM coupons ORDER BY created_at DESC");
    $coupons = [];
    while ($row = $result->fetch_assoc()) $coupons[] = $row;
    echo json_encode(["success" => true, "coupons" => $coupons]);
    exit();
}
