<?php
// ============================================================
// config.php — Database connection
// ============================================================
$server   = "localhost";
$username = "root";
$password = "";
$database = "ecommerce-schema";

$con = new mysqli($server, $username, $password, $database);

if ($con->connect_error) {
    http_response_code(500);
    die(json_encode(["success" => false, "message" => "Connection failed: " . $con->connect_error]));
}

$con->set_charset("utf8mb4");

// ── Session Security ─────────────────────────────────────────
ini_set('session.cookie_httponly', 1);
ini_set('session.use_only_cookies', 1);
ini_set('session.cookie_path', '/'); 

// Relax SameSite for local development on HTTP to allow OAuth redirects
if (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') {
    ini_set('session.cookie_samesite', 'Lax');
    ini_set('session.cookie_secure', 1);
} else {
    // Localhost / HTTP: Remove SameSite restriction to ensure cookie persists across redirects
    ini_set('session.cookie_samesite', ''); 
}

// ── Security Headers ──────────────────────────────────────────
header("X-Content-Type-Options: nosniff");
header("X-Frame-Options: DENY");
header("X-XSS-Protection: 1; mode=block");
header("Referrer-Policy: strict-origin-when-cross-origin");

// ── Error Handling ───────────────────────────────────────────
// For production, we log errors and hide them from the user
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/error_log.txt');

// ── Security Constants ────────────────────────────────────────
define('MAX_LOGIN_ATTEMPTS', 5);
define('LOCKOUT_TIME', 900); // 15 minutes
?>
