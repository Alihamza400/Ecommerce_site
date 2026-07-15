<?php
// ============================================================
// users.php — Admin API to Manage Platform Users
// ============================================================
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : 'http://localhost';
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: $origin");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, PUT, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200); exit();
}

require_once __DIR__ . '/../config.php';
session_start();

// Strict Verification: Admin Only
if (!isset($_SESSION['SESS-ID']) || $_SESSION['SESS-ROLE'] !== 'admin') {
    http_response_code(403);
    echo json_encode(["success" => false, "message" => "Administrator Access Required."]);
    exit();
}

$method = $_SERVER['REQUEST_METHOD'];

// ── GET: List All Users ─────────────────────────────────────
if ($method === 'GET') {
    $sql = "SELECT id, uuid, name, email, role, status, created_at FROM users ORDER BY id DESC";
    $result = $con->query($sql);
    
    $users = [];
    while ($row = $result->fetch_assoc()) {
        $users[] = $row;
    }
    
    echo json_encode(["success" => true, "users" => $users]);
    exit();
}

// ── PUT: Change User Status (Block/Unblock) ─────────────────
if ($method === 'PUT') {
    $raw = file_get_contents("php://input");
    $data = json_decode($raw, true) ?? [];
    
    $user_id = intval($data['user_id'] ?? 0);
    $new_status = $data['status'] ?? ''; // 'active' or 'blocked'
    
    if ($user_id <= 0 || !in_array($new_status, ['active', 'blocked'])) {
        http_response_code(400); echo json_encode(["success" => false, "message" => "Invalid parameters."]); exit();
    }
    
    $stmt = $con->prepare("UPDATE users SET status = ? WHERE id = ?");
    $stmt->bind_param("si", $new_status, $user_id);
    
    if ($stmt->execute()) {
        echo json_encode(["success" => true, "message" => "User updated to $new_status."]);
    } else {
        http_response_code(500); echo json_encode(["success" => false, "message" => "Update failed."]);
    }
    $stmt->close();
    exit();
}
?>
