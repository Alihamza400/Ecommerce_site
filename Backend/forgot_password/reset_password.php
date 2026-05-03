<?php
// ============================================================
// reset_password.php — Verifies tokens and updates passwords
// ============================================================
header("Content-Type: application/json");
ob_start(); // Prevent pollution
require_once '../config.php';

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

    if (empty($token) || empty($new_password)) {
        echo json_encode(["success" => false, "message" => "Invalid request."]);
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
        $con->query("DELETE FROM password_resets WHERE email = '$email'");
        ob_clean();
        echo json_encode(["success" => true, "message" => "Password updated successfully! Redirecting..."]);
    } else {
        ob_clean();
        echo json_encode(["success" => false, "message" => "Failed to update database: " . $upd->error]);
    }
    exit();
}
?>
