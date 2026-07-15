<?php
// ============================================================
// auth_status.php — Quick check if user is logged in
// ============================================================
$origin = $_SERVER['HTTP_ORIGIN'] ?? (isset($_SERVER['HTTP_HOST']) ? ((isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' ? 'https' : 'http') . '://' . $_SERVER['HTTP_HOST']) : 'null');
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: $origin");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/security_functions.php';

if (isset($_SESSION['SESS-ID'])) {
    echo json_encode([
        "logged_in" => true,
        "user_name" => $_SESSION['SESS-NAME'],
        "role" => $_SESSION['SESS-ROLE']
    ]);
} else {
    echo json_encode(["logged_in" => false]);
}
?>
