<?php
// ============================================================
// forgot_password.php — Secure Token Generation & Real Email
// ============================================================
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : 'http://localhost';
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: $origin");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
ob_start();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../security_functions.php';
require_once __DIR__ . '/../mail_helper.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["success" => false, "message" => "Method not allowed."]);
    exit();
}

$data = json_decode(file_get_contents("php://input"), true);
$email = trim($data['email'] ?? '');
$csrf_token = $data['csrf_token'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');

if (!verify_csrf_token($csrf_token)) {
    http_response_code(403);
    echo json_encode(["success" => false, "message" => "Invalid or missing CSRF token."]);
    exit();
}

if (empty($email)) {
    echo json_encode(["success" => false, "message" => "Please enter your email."]);
    exit();
}

// 1. Verify user exists
$stmt = $con->prepare("SELECT id, name FROM users WHERE email = ?");
$stmt->bind_param("s", $email);
$stmt->execute();
$res = $stmt->get_result();

if ($res->num_rows === 0) {
    echo json_encode(["success" => true, "message" => "If that email is in our system, a recovery link has been sent."]);
    exit();
}

$user = $res->fetch_assoc();
$user_name = $user['name'];

// 2. Generate secure token
$token = bin2hex(random_bytes(32));
$expires_at = date("Y-m-d H:i:s", strtotime("+1 hour"));

// 3. Store in DB
$stmt = $con->prepare("DELETE FROM password_resets WHERE email = ?"); $stmt->bind_param("s", $email); $stmt->execute(); $stmt->close();
$ins = $con->prepare("INSERT INTO password_resets (email, token, expires_at) VALUES (?, ?, ?)");
$ins->bind_param("sss", $email, $token, $expires_at);

if ($ins->execute()) {
    $reset_link = "http://localhost/Ecommerce_site/Frontend/forgot_password/reset_password.html?token=$token";
    
    // 4. Prepare stylized email
    $subject = 'Password Reset Request - ShopVerse';
    $body = "
        <div style='font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;'>
            <h2 style='color: #7c3aed;'>✦ ShopVerse Password Reset</h2>
            <p>Hi <strong>{$user_name}</strong>,</p>
            <p>We received a request to reset your password. Click the button below to choose a new one:</p>
            <div style='text-align: center; margin: 30px 0;'>
                <a href='{$reset_link}' style='background: #7c3aed; color: #fff; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;'>Reset Password</a>
            </div>
            <p style='color: #666; font-size: 0.9rem;'>This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.</p>
            <hr style='border: none; border-top: 1px solid #eee;'>
            <p style='font-size: 0.8rem; color: #aaa;'>ShopVerse Marketplace — Secure Authentication System</p>
        </div>
    ";
    
    $result = sendMail($email, $user_name, $subject, $body);

    ob_clean();
    if ($result['success']) {
        echo json_encode(["success" => true, "message" => "A recovery email has been sent successfully."]);
    } else {
        // Fallback for Dev Mode or Error
        echo json_encode([
            "success" => true, 
            "message" => "Note: " . $result['message'],
            "reset_link" => $reset_link 
        ]);
    }
}
 else {
    ob_clean();
    echo json_encode(["success" => false, "message" => "Database error."]);
}
?>
