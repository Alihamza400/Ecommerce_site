<?php
// ============================================================
// Backend/payments.php — Payments API for Admin Dashboard
// GET  → all payments with order + customer info
// ============================================================
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : 'http://localhost';
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: $origin");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, OPTIONS");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit(); }

require_once __DIR__ . '/config.php';
session_start();

if (!isset($_SESSION['SESS-ID']) || $_SESSION['SESS-ROLE'] !== 'admin') {
    http_response_code(403);
    echo json_encode(["success" => false, "message" => "Admin access required."]);
    exit();
}

// Summary stats
$stats = ["total" => 0, "revenue" => 0, "gateways" => []];
$sRes = $con->query("SELECT COUNT(*) as t, SUM(amount) as r FROM payments WHERE status='success'");
if ($row = $sRes->fetch_assoc()) {
    $stats["total"]   = intval($row["t"]);
    $stats["revenue"] = floatval($row["r"]);
}
$gRes = $con->query("SELECT payment_method, COUNT(*) as count, SUM(amount) as total FROM payments GROUP BY payment_method");
while ($row = $gRes->fetch_assoc()) {
    $stats["gateways"][] = $row;
}

// All payment records
$sql = "
    SELECT 
        p.id, p.uuid, p.payment_method, p.transaction_id,
        p.amount, p.status, p.created_at,
        o.uuid AS order_uuid,
        u.name AS customer_name,
        u.email AS customer_email
    FROM payments p
    JOIN orders o ON p.order_id = o.id
    JOIN users u ON o.user_id = u.id
    ORDER BY p.created_at DESC
";

$payments = [];
$res = $con->query($sql);
while ($row = $res->fetch_assoc()) {
    $payments[] = $row;
}

echo json_encode(["success" => true, "stats" => $stats, "payments" => $payments]);
?>
