<?php
// ============================================================
// vendor_app.php — API for customers to apply as a Vendor
// ============================================================
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : 'http://localhost';
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: $origin");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200); exit();
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

if ($method === 'GET') {
    // Check application status
    $stmt = $con->prepare("SELECT status FROM vendors WHERE user_id = ? LIMIT 1");
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $res = $stmt->get_result();
    if($row = $res->fetch_assoc()){
        echo json_encode(["success" => true, "applied" => true, "status" => $row['status']]);
    } else {
        echo json_encode(["success" => true, "applied" => false]);
    }
    $stmt->close();
    exit();
}

if ($method === 'POST') {
    $raw = file_get_contents("php://input");
    $data = !empty($raw) ? json_decode($raw, true) : $_POST;
    
    $store_name = trim($data['store_name'] ?? '');
    if(empty($store_name)) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Store name is required."]);
        exit();
    }
    
    // Check if already applied
    $chk = $con->prepare("SELECT id FROM vendors WHERE user_id = ? LIMIT 1");
    $chk->bind_param("i", $user_id);
    $chk->execute();
    if($chk->get_result()->num_rows > 0) {
        http_response_code(400); echo json_encode(["success"=>false,"message"=>"You have already applied."]); exit();
    }
    $chk->close();
    
    // Check unique store name
    $chk2 = $con->prepare("SELECT id FROM vendors WHERE store_name = ? LIMIT 1");
    $chk2->bind_param("s", $store_name);
    $chk2->execute();
    if($chk2->get_result()->num_rows > 0) {
        http_response_code(400); echo json_encode(["success"=>false,"message"=>"Store name already exists."]); exit();
    }
    $chk2->close();
    
    $uuid = sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x', mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0x0fff) | 0x4000, mt_rand(0, 0x3fff) | 0x8000, mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff));
    
    $ins = $con->prepare("INSERT INTO vendors (uuid, user_id, store_name, status) VALUES (?, ?, ?, 'inactive')");
    $ins->bind_param("sis", $uuid, $user_id, $store_name);
    if($ins->execute()) {
        echo json_encode(["success" => true, "message" => "Application submitted successfully! Please wait for admin approval."]);
    } else {
        http_response_code(500); echo json_encode(["success" => false, "message" => "Database error."]);
    }
    $ins->close();
}
?>
