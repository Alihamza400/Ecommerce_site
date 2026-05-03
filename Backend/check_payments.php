<?php
// ============================================================
// check_payments.php — Verify payment records in database
// Access: http://localhost/Ecommerce_site/Backend/check_payments.php
// ============================================================
require_once __DIR__ . '/config.php';

header('Content-Type: application/json');

// 1. Show table structure
$columns = [];
$colRes = $con->query("DESCRIBE payments");
while ($row = $colRes->fetch_assoc()) {
    $columns[] = $row;
}

// 2. Show last 20 payment records joined with orders
$sql = "
    SELECT 
        p.id,
        p.uuid,
        p.order_id,
        p.payment_method,
        p.transaction_id,
        p.amount,
        p.status,
        p.created_at,
        o.uuid AS order_uuid,
        u.name AS customer_name,
        u.email AS customer_email
    FROM payments p
    JOIN orders o ON p.order_id = o.id
    JOIN users u ON o.user_id = u.id
    ORDER BY p.created_at DESC
    LIMIT 20
";

$records = [];
$res = $con->query($sql);
if ($res) {
    while ($row = $res->fetch_assoc()) {
        $records[] = $row;
    }
}

// 3. Summary stats
$stats = [];
$statRes = $con->query("SELECT status, COUNT(*) as count, SUM(amount) as total FROM payments GROUP BY status");
if ($statRes) {
    while ($row = $statRes->fetch_assoc()) {
        $stats[] = $row;
    }
}

echo json_encode([
    'table_schema' => $columns,
    'total_records' => count($records),
    'records' => $records,
    'summary_by_status' => $stats
], JSON_PRETTY_PRINT);
?>
