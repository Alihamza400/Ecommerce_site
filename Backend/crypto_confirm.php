<?php
/**
 * crypto_confirm.php — Verify & confirm crypto payments
 * 
 * This endpoint is called:
 * 1. After checkout to monitor payment status
 * 2. By the PaymentSystem when payment is detected on-chain
 * 
 * Crypto Address: 0x4A35F6CCD8030F23B4212623bA3F8888B177Ff54
 * Network: BSC (BEP-20) — USDT
 */

require_once __DIR__ . '/config.php';
header("Content-Type: application/json");

$method = $_SERVER['REQUEST_METHOD'];

// ── GET: Check payment status for an order ──────────────────
if ($method === 'GET') {
    $order_uuid = trim($_GET['order_uuid'] ?? '');
    if (empty($order_uuid)) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Order UUID required."]);
        exit();
    }

    $stmt = $con->prepare("SELECT p.id, p.status as pay_status, p.transaction_id, p.amount, o.total_amount, o.status as order_status
        FROM payments p JOIN orders o ON p.order_id = o.id WHERE o.uuid = ? AND p.payment_method = 'Crypto'");
    $stmt->bind_param("s", $order_uuid);
    $stmt->execute();
    $payment = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$payment) {
        echo json_encode(["success" => false, "message" => "No crypto payment found."]);
        exit();
    }

    echo json_encode([
        "success" => true,
        "payment" => [
            "status" => $payment['pay_status'],
            "transaction_id" => $payment['transaction_id'],
            "amount" => floatval($payment['amount']),
            "order_status" => $payment['order_status']
        ]
    ]);
    exit();
}

// ── POST: Confirm payment (called by PaymentSystem webhook) ─
if ($method === 'POST') {
    $data = json_decode(file_get_contents("php://input"), true);
    $order_uuid = trim($data['order_uuid'] ?? '');
    $tx_hash = trim($data['transaction_id'] ?? '');
    $status = trim($data['status'] ?? '');
    $secret = trim($data['secret'] ?? '');

    // Simple auth check
    $expected_secret = getenv('CRYPTO_WEBHOOK_SECRET') ?: 'shopverse_crypto_secret';
    if ($secret !== $expected_secret) {
        http_response_code(403);
        echo json_encode(["success" => false, "message" => "Invalid secret."]);
        exit();
    }

    if (empty($order_uuid) || empty($tx_hash) || empty($status)) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Missing required fields."]);
        exit();
    }

    $con->begin_transaction();
    try {
        if ($status === 'confirmed') {
            $upd = $con->prepare("UPDATE payments SET status = 'success', transaction_id = ? WHERE order_id = (SELECT id FROM orders WHERE uuid = ?)");
            $upd->bind_param("ss", $tx_hash, $order_uuid);
            $upd->execute();
            $upd->close();

            $upd2 = $con->prepare("UPDATE orders SET payment_status = 'paid', status = 'confirmed' WHERE uuid = ?");
            $upd2->bind_param("s", $order_uuid);
            $upd2->execute();
            $upd2->close();
        }

        $con->commit();
        echo json_encode(["success" => true, "message" => "Payment confirmed."]);
    } catch (Exception $e) {
        $con->rollback();
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Failed to update payment."]);
        error_log("Crypto Confirmation Error: " . $e->getMessage());
    }
    exit();
}

http_response_code(405);
echo json_encode(["success" => false, "message" => "Method not allowed."]);
