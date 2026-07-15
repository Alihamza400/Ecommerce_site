<?php
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : 'http://localhost';
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: $origin");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit(); }

require_once __DIR__ . '/../config.php';
session_start();

if (!isset($_SESSION['SESS-ID']) || $_SESSION['SESS-ROLE'] !== 'admin') {
    http_response_code(403);
    echo json_encode(["success" => false, "message" => "Forbidden."]);
    exit();
}

$stats = [];

$stats['total_users'] = $con->query("SELECT COUNT(*) FROM users")->fetch_row()[0];
$stats['total_products'] = $con->query("SELECT COUNT(*) FROM products")->fetch_row()[0];
$stats['active_products'] = $con->query("SELECT COUNT(*) FROM products WHERE status='active'")->fetch_row()[0];
$stats['total_orders'] = $con->query("SELECT COUNT(*) FROM orders")->fetch_row()[0];
$stats['total_revenue'] = $con->query("SELECT COALESCE(SUM(total_amount),0) FROM orders WHERE payment_status='paid'")->fetch_row()[0];
$stats['active_vendors'] = $con->query("SELECT COUNT(*) FROM vendors WHERE status='active'")->fetch_row()[0];
$stats['pending_vendors'] = $con->query("SELECT COUNT(*) FROM vendors WHERE status='inactive'")->fetch_row()[0];
$stats['suspended_vendors'] = $con->query("SELECT COUNT(*) FROM vendors WHERE status='suspended'")->fetch_row()[0];
$stats['total_payments'] = $con->query("SELECT COUNT(*) FROM payments WHERE status='success'")->fetch_row()[0];

$recent_orders = [];
$r = $con->query("SELECT o.id, o.uuid, o.total_amount, o.status, o.payment_status, o.created_at, u.name as customer_name FROM orders o JOIN users u ON o.user_id = u.id ORDER BY o.created_at DESC LIMIT 5");
while ($row = $r->fetch_assoc()) {
    $recent_orders[] = $row;
}

$recent_vendors = [];
$r = $con->query("SELECT v.id as vendor_id, v.store_name, v.status as vendor_status, v.created_at, u.name, u.email FROM vendors v JOIN users u ON v.user_id = u.id ORDER BY v.created_at DESC LIMIT 5");
while ($row = $r->fetch_assoc()) {
    $recent_vendors[] = $row;
}

echo json_encode([
    "success" => true,
    "stats" => $stats,
    "recent_orders" => $recent_orders,
    "recent_vendors" => $recent_vendors
]);
