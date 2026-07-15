<?php
// ============================================================
// reset_password.php — Verifies tokens and updates passwords
// ============================================================
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : 'http://localhost';
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: $origin");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
ob_start();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../security_functions.php';

$method = $_SERVER['REQUEST_METHOD'];

// ── GET: Verify Token ────────────────────────────────────────
if ($method === 'GET') {
    $token = $_GET['token'] ?? '';
    
    // We check token and ensure it hasn't expired (using a 2-hour window for safety during dev)
    $stmt = $con->prepare("SELECT email, expires_at FROM password_resets WHERE token = ?");
    $stmt->bind_param("s", $token);
    $stmt->execute();
    $res = $stmt->get_result();

    if ($res->num_rows > 0) {
        $row = $res->fetch_assoc();
        $expiry = strtotime($row['expires_at']);
        $now = time();

        if ($expiry > $now) {
            ob_clean();
            echo json_encode(["success" => true]);
        } else {
            ob_clean();
            echo json_encode(["success" => false, "message" => "Token expired. Link is only valid for 1 hour."]);
        }
    } else {
        ob_clean();
        echo json_encode(["success" => false, "message" => "Token invalid or already used."]);
    }
    exit();
}

// ── POST: Update Password ────────────────────────────────────
if ($method === 'POST') {
    $data = json_decode(file_get_contents("php://input"), true);
    $token = $data['token'] ?? '';
    $new_password = $data['password'] ?? '';
    $csrf_token = $data['csrf_token'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');

    if (!verify_csrf_token($csrf_token)) {
        http_response_code(403);
        echo json_encode(["success" => false, "message" => "Invalid or missing CSRF token."]);
        exit();
    }

    if (empty($token) || empty($new_password)) {
        echo json_encode(["success" => false, "message" => "Invalid request."]);
        exit();
    }

    $confirm = $data['confirm_password'] ?? '';
    if ($new_password !== $confirm) {
        echo json_encode(["success" => false, "message" => "Passwords do not match."]);
        exit();
    }
    if (strlen($new_password) < 8) {
        echo json_encode(["success" => false, "message" => "Password must be at least 8 characters."]);
        exit();
    }
    if (!preg_match('/[A-Z]/', $new_password) || !preg_match('/[0-9]/', $new_password)) {
        echo json_encode(["success" => false, "message" => "Password must contain an uppercase letter and a number."]);
        exit();
    }

    // 1. Validate token again (Robust time check)
    $stmt = $con->prepare("SELECT email, expires_at FROM password_resets WHERE token = ?");
    $stmt->bind_param("s", $token);
    $stmt->execute();
    $res = $stmt->get_result();

    if ($res->num_rows === 0) {
        echo json_encode(["success" => false, "message" => "Link invalid or already used."]);
        exit();
    }

    $row = $res->fetch_assoc();
    if (strtotime($row['expires_at']) < time()) {
        echo json_encode(["success" => false, "message" => "Link expired. Please request a new one."]);
        exit();
    }

    $email = $row['email'];

    // 2. Hash and Update User Password
    $hashed_password = password_hash($new_password, PASSWORD_BCRYPT);
    $upd = $con->prepare("UPDATE users SET password_hash = ? WHERE email = ?");
    if (!$upd) {
        ob_clean();
        echo json_encode(["success" => false, "message" => "Database error: " . $con->error]);
        exit();
    }
    
    $upd->bind_param("ss", $hashed_password, $email);

    if ($upd->execute()) {
        // 3. SECURE: Delete the token after successful use
        $stmt = $con->prepare("DELETE FROM password_resets WHERE email = ?"); $stmt->bind_param("s", $email); $stmt->execute(); $stmt->close();
        ob_clean();
        echo json_encode(["success" => true, "message" => "Password updated successfully! Redirecting..."]);
    } else {
        ob_clean();
        echo json_encode(["success" => false, "message" => "Failed to update database: " . $upd->error]);
    }
    exit();
}
?>
