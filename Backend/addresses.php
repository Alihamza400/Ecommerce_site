<?php
// ============================================================
// addresses.php — Dedicated Backend API for User Addresses
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
$method = $_SERVER['REQUEST_METHOD'];

// ── GET: View All Addresses ─────────────────────────────────
if ($method === 'GET') {
    $stmt = $con->prepare("SELECT id, uuid, address_line, city, state, country, postal_code, is_default FROM user_addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC");
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $addresses = [];
    while ($row = $result->fetch_assoc()) {
        $addresses[] = $row;
    }
    $stmt->close();
    
    echo json_encode(["success" => true, "addresses" => $addresses]);
    exit();
}

// Parse body for POST, PUT, DELETE
$data = [];
$raw = file_get_contents("php://input");
if (!empty($raw)) {
    $data = json_decode($raw, true) ?? [];
} else {
    $data = $_POST;
}

// ── POST: Add New Address ──────────────────────────────────
if ($method === 'POST') {
    $address_line = trim($data['address_line'] ?? '');
    $city         = trim($data['city'] ?? '');
    $state        = trim($data['state'] ?? '');
    $country      = trim($data['country'] ?? '');
    $postal_code  = trim($data['postal_code'] ?? '');
    
    if(empty($address_line) || empty($city) || empty($country) || empty($postal_code)){
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Please fill all required fields."]);
        exit();
    }
    
    // Check if this is the first address (make it default automatically)
    $stmt = $con->prepare("SELECT id FROM user_addresses WHERE user_id = ? LIMIT 1");
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $stmt->store_result();
    $is_default = ($stmt->num_rows === 0) ? 1 : 0;
    $stmt->close();

    $uuid = sprintf(
        '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
        mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff),
        mt_rand(0, 0x0fff) | 0x4000, mt_rand(0, 0x3fff) | 0x8000,
        mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
    );

    $ins = $con->prepare("INSERT INTO user_addresses (uuid, user_id, address_line, city, state, country, postal_code, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    $ins->bind_param("sisssssi", $uuid, $user_id, $address_line, $city, $state, $country, $postal_code, $is_default);
    
    if ($ins->execute()) {
        http_response_code(201);
        echo json_encode(["success" => true, "message" => "Address saved successfully."]);
    } else {
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Database error."]);
    }
    $ins->close();
    exit();
}

// ── PUT: Set Default Address ───────────────────────────────
if ($method === 'PUT') {
    $address_id = intval($data['address_id'] ?? 0);
    if ($address_id <= 0) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Invalid address ID."]);
        exit();
    }

    // Unset current defaults
    $up1 = $con->prepare("UPDATE user_addresses SET is_default = 0 WHERE user_id = ?");
    $up1->bind_param("i", $user_id);
    $up1->execute();
    $up1->close();

    // Set new default
    $up2 = $con->prepare("UPDATE user_addresses SET is_default = 1 WHERE id = ? AND user_id = ?");
    $up2->bind_param("ii", $address_id, $user_id);
    if($up2->execute()){
        echo json_encode(["success" => true, "message" => "Default address updated."]);
    } else {
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Failed to update default address."]);
    }
    $up2->close();
    exit();
}

// ── DELETE: Remove Address ────────────────────────────────
if ($method === 'DELETE') {
    $address_id = intval($_GET['address_id'] ?? $data['address_id'] ?? 0);
    if ($address_id <= 0) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Invalid address ID."]);
        exit();
    }

    $del = $con->prepare("DELETE FROM user_addresses WHERE id = ? AND user_id = ?");
    $del->bind_param("ii", $address_id, $user_id);
    
    if ($del->execute()) {
        echo json_encode(["success" => true, "message" => "Address removed."]);
    } else {
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Failed to remove address."]);
    }
    $del->close();
    exit();
}

http_response_code(405);
echo json_encode(["success" => false, "message" => "Method not handled."]);
?>
