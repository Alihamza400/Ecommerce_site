<?php
// ============================================================
// registration.php — Dedicated Backend API for Registration
// ============================================================
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : 'http://localhost';
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: $origin");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/security_functions.php';
require_once __DIR__ . '/mail_helper.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["success" => false, "message" => "Method not allowed. Use POST."]);
    exit();
}

// ── Secure Input Parsing ────────────────────────────────────
$data = $_POST;
if (empty($data)) {
    $raw = file_get_contents("php://input");
    $data = json_decode($raw, true) ?? [];
}

$name     = trim($data['name'] ?? '');
$email    = trim($data['email'] ?? '');
$phone    = trim($data['phone'] ?? '');
$password = $data['password'] ?? '';
$confirm  = $data['confirm_password'] ?? '';
$csrf_token = $data['csrf_token'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');

// ── CSRF Validation ─────────────────────────────────────────
if (!verify_csrf_token($csrf_token)) {
    http_response_code(403);
    echo json_encode(["success" => false, "message" => "Invalid or missing CSRF token."]);
    exit();
}

// ── Validation ─────────────────────────────────────────────
$errors = [];
if (empty($name)) $errors[] = "Name is required.";
if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) $errors[] = "Valid email is required.";
if (strlen($password) < 8) $errors[] = "Password must be at least 8 characters long.";
if (!preg_match('/[A-Z]/', $password) || !preg_match('/[0-9]/', $password)) {
    $errors[] = "Password must contain at least one uppercase letter and one number.";
}
if ($password !== $confirm) $errors[] = "Passwords do not match.";
if (!empty($phone) && !preg_match('/^[0-9+ ]{10,15}$/', $phone)) $errors[] = "Invalid phone format.";

if (!empty($errors)) {
    http_response_code(422);
    echo json_encode(["success" => false, "message" => implode(" ", $errors)]);
    exit();
}

// ── Duplicate check ────────────────────────────────────────
$stmt = $con->prepare("SELECT id FROM users WHERE email = ?");
$stmt->bind_param("s", $email);
$stmt->execute();
$stmt->store_result();
if ($stmt->num_rows > 0) {
    http_response_code(409);
    echo json_encode(["success" => false, "message" => "An account with this email already exists."]);
    $stmt->close();
    exit();
}
$stmt->close();

// ── Insert ──────────────────────────────────────────────────
$uuid = generate_uuid();
$hashed = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
$role = 'customer';
$status = 'active';

$stmt = $con->prepare("INSERT INTO users (uuid, name, email, password_hash, phone, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)");
$stmt->bind_param("sssssss", $uuid, $name, $email, $hashed, $phone, $role, $status);

if ($stmt->execute()) {
    // Send Welcome Email
    $subject = 'Welcome to ShopVerse!';
    $body = "
        <div style='font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;'>
            <h2 style='color: #7c3aed;'>✦ Welcome to ShopVerse!</h2>
            <p>Hi <strong>{$name}</strong>,</p>
            <p>Thank you for creating an account with ShopVerse. You can now browse products, save your favorite items, and track your orders.</p>
            <div style='text-align: center; margin: 30px 0;'>
                <a href='http://localhost/Ecommerce_site/Frontend/index.html' style='background: #7c3aed; color: #fff; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;'>Start Shopping</a>
            </div>
            <p style='color: #666; font-size: 0.9rem;'>If you have any questions, feel free to reply to this email.</p>
            <hr style='border: none; border-top: 1px solid #eee;'>
            <p style='font-size: 0.8rem; color: #aaa;'>ShopVerse Marketplace — Secure Authentication System</p>
        </div>
    ";
    sendMail($email, $name, $subject, $body);

    http_response_code(201);
    echo json_encode(["success" => true, "message" => "Account created successfully.", "user_id" => $stmt->insert_id]);
} else {
    http_response_code(500);
    error_log("Registration Error: " . $con->error);
    echo json_encode(["success" => false, "message" => "A server error occurred. Please try again later."]);
}
$stmt->close();
?>
