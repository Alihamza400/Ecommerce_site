<?php
// ============================================================
// test_full_flow.php — Simulates what happens when checkout.js
// calls the Payment Orchestrator and then orders.php
// Run: php test_full_flow.php
// ============================================================
require_once 'config.php';

echo "======================================================\n";
echo "  FULL CHECKOUT → GATEWAY → DATABASE FLOW TEST\n";
echo "======================================================\n\n";

// ── STEP 1: Call the Payment Orchestrator (Node.js port 4000) ──
echo "STEP 1: Calling Payment Orchestrator (JazzCash route — PK/PKR)...\n";
$payload = json_encode([
    "amount"   => 5999,
    "currency" => "PKR",
    "country"  => "PK",
    "customer" => ["name" => "Test User", "phone" => "03001234567"]
]);

$ch = curl_init("http://localhost:4000/v1/payments/pay");
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => $payload,
    CURLOPT_HTTPHEADER     => ["Content-Type: application/json"],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 5
]);
$response = curl_exec($ch);
$curlErr  = curl_error($ch);
curl_close($ch);

if ($curlErr) {
    echo "  ❌ Orchestrator unreachable: $curlErr\n";
    echo "  ⚠️  Make sure 'node server.js' is running in PaymentSystem/\n\n";
    exit(1);
}

$payment = json_decode($response, true);
echo "  Response from Orchestrator:\n";
echo "  ✅ Success      : " . ($payment['success'] ? 'YES' : 'NO') . "\n";
echo "  🏦 Gateway Used : " . $payment['gatewayUsed'] . "\n";
echo "  🔑 Transaction  : " . $payment['transactionId'] . "\n";
echo "  🔄 Failover?    : " . ($payment['isFailover'] ? 'YES' : 'NO') . "\n";
echo "  🕒 Timestamp    : " . $payment['timestamp'] . "\n\n";

if (!$payment['success']) {
    echo "  ❌ Payment failed — order NOT created.\n";
    exit(1);
}

// ── STEP 2: Store in Database (simulates orders.php) ──
echo "STEP 2: Storing transaction in payments table...\n";

// Use a fake order_id = 99 for test (won't break real orders)
$testOrderId = 99;
$txId        = $payment['transactionId'];
$gateway     = $payment['gatewayUsed'];
$amount      = 5999.00;

// Check if test record exists, delete if so
$con->query("DELETE FROM payments WHERE transaction_id = '$txId'");

$uuid = sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
    mt_rand(0,0xffff), mt_rand(0,0xffff), mt_rand(0,0xffff),
    mt_rand(0,0x0fff)|0x4000, mt_rand(0,0x3fff)|0x8000,
    mt_rand(0,0xffff), mt_rand(0,0xffff), mt_rand(0,0xffff));

// We skip FK constraint by using a real order ID from DB
$realOrderRes = $con->query("SELECT id FROM orders LIMIT 1");
if ($realOrderRes->num_rows === 0) {
    echo "  ⚠️  No orders in DB to attach test payment to. Skipping DB write.\n";
} else {
    $realOrderId = $realOrderRes->fetch_assoc()['id'];
    $stmt = $con->prepare("INSERT INTO payments (uuid, order_id, payment_method, transaction_id, amount, status) VALUES (?, ?, ?, ?, ?, 'success')");
    $stmt->bind_param("sissd", $uuid, $realOrderId, $gateway, $txId, $amount);

    if ($stmt->execute()) {
        echo "  ✅ Payment record written to database!\n";
        echo "  📋 DB UUID       : $uuid\n";
        echo "  🏦 Gateway       : $gateway\n";
        echo "  🔑 Transaction ID: $txId\n";
        echo "  💰 Amount        : \$" . number_format($amount, 2) . "\n\n";
    } else {
        echo "  ❌ DB write failed: " . $con->error . "\n";
    }
    $stmt->close();
}

// ── STEP 3: Verify it's in DB ──
echo "STEP 3: Verifying database record...\n";
$check = $con->query("SELECT p.*, o.uuid as order_uuid FROM payments p JOIN orders o ON p.order_id = o.id WHERE p.transaction_id = '$txId'");
if ($check->num_rows > 0) {
    $rec = $check->fetch_assoc();
    echo "  ✅ CONFIRMED IN DATABASE:\n";
    echo "  ┌─────────────────────────────────────────\n";
    echo "  │ ID          : " . $rec['id'] . "\n";
    echo "  │ TXN ID      : " . $rec['transaction_id'] . "\n";
    echo "  │ Gateway     : " . $rec['payment_method'] . "\n";
    echo "  │ Amount      : \$" . number_format($rec['amount'], 2) . "\n";
    echo "  │ Status      : " . strtoupper($rec['status']) . "\n";
    echo "  │ Created At  : " . $rec['created_at'] . "\n";
    echo "  └─────────────────────────────────────────\n\n";
} else {
    echo "  ❌ Record NOT found in database.\n";
}

// ── STEP 4: Final Summary ──
echo "======================================================\n";
echo "  FINAL GATEWAY BREAKDOWN IN DATABASE:\n";
echo "======================================================\n";
$r = $con->query("SELECT payment_method, COUNT(*) as txns, SUM(amount) as revenue FROM payments GROUP BY payment_method ORDER BY revenue DESC");
echo str_pad('GATEWAY', 15) . str_pad('TXNS', 8) . "REVENUE\n";
echo str_repeat('-', 35) . "\n";
while ($row = $r->fetch_assoc()) {
    echo str_pad($row['payment_method'], 15) . str_pad($row['txns'], 8) . '$' . number_format($row['revenue'], 2) . "\n";
}
echo "\n✅ Full flow test complete.\n";
?>
