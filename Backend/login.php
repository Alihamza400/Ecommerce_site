<?php
// ============================================================
// login.php — Dedicated Backend API for Authentication
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

$email    = trim($data['email'] ?? '');
$password = $data['password'] ?? '';
$csrf_token = $data['csrf_token'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');

// ── CSRF Validation ─────────────────────────────────────────
if (!verify_csrf_token($csrf_token)) {
    http_response_code(403);
    echo json_encode(["success" => false, "message" => "Invalid or missing CSRF token."]);
    exit();
}

if (empty($email) || empty($password)) {
    http_response_code(422);
    echo json_encode(["success" => false, "message" => "Email and password are required."]);
    exit();
}

// ── Rate Limiting Check ──────────────────────────────────────
if (is_rate_limited($con, $email)) {
    http_response_code(429);
    echo json_encode(["success" => false, "message" => "Too many failed attempts. Please try again in 15 minutes."]);
    exit();
}

// ── Query the user ──────────────────────────────────────────
$stmt = $con->prepare("SELECT id, name, email, password_hash, role, status FROM users WHERE email = ? LIMIT 1");
$stmt->bind_param("s", $email);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 0) {
    http_response_code(401);
    echo json_encode(["success" => false, "message" => "Invalid email or password."]);
    $stmt->close();
    exit();
}

$user = $result->fetch_assoc();
$stmt->close();

// ── Account validation ──────────────────────────────────────
if ($user['status'] === 'blocked') {
    http_response_code(403);
    echo json_encode(["success" => false, "message" => "The account is suspended. Contact support."]);
    exit();
}

// ── Password verification ───────────────────────────────────
if (!password_verify($password, $user['password_hash'])) {
    record_login_attempt($con, $email);
    http_response_code(401);
    echo json_encode(["success" => false, "message" => "Invalid email or password."]);
    exit();
}

// ── Success: Clear attempts ──────────────────────────────────
clear_login_attempts($con, $email);

// ── Initialize Session ──────────────────────────────────────
session_regenerate_id(true);
$_SESSION['SESS-ID']    = $user['id'];
$_SESSION['SESS-EMAIL'] = $user['email'];
$_SESSION['SESS-NAME']  = $user['name'];
$_SESSION['SESS-ROLE']  = $user['role'];
$_SESSION['SESS-STATUS']= $user['status'];
session_write_close();

$redirect = ($user['role'] === 'admin') ? 'admin/dashboard.html' : 'profile.html';

echo json_encode([
    "success"  => true,
    "message"  => "Welcome back, " . htmlspecialchars($user['name']) . "!",
    "role"     => $user['role'],
    "redirect" => $redirect
]);
?>
