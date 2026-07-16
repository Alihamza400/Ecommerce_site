<?php
// ============================================================
// config.php — Database connection + Env loader
// ============================================================

// Load .env file from project root
$env_file = __DIR__ . '/../.env';
if (file_exists($env_file)) {
    $lines = file($env_file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#')) continue;
        if (str_contains($line, '=')) {
            [$key, $val] = explode('=', $line, 2);
            $key = trim($key);
            $val = trim($val);
            $val = trim($val, '"\'');
            if (!getenv($key)) {
                putenv("$key=$val");
                $_ENV[$key] = $val;
            }
        }
    }
}

$server   = getenv('DB_HOST') ?: 'sql.infinityfree.com';
$username = getenv('DB_USERNAME') ?: 'if0_42419998';
$password = getenv('DB_PASSWORD') ?: 'R@i123ali';
$database = getenv('DB_DATABASE') ?: 'if0_42419998_ecommerce_db';

$hosts = [];
if (!empty($server)) {
    $hosts[] = $server;
}
$hosts[] = '127.0.0.1';
$hosts[] = 'localhost';
$hosts[] = 'ecommerce_mysql';

$con = null;
foreach ($hosts as $host) {
    $mysqli = mysqli_init();
    try {
        if (@$mysqli->real_connect($host, $username, $password, $database)) {
            $con = $mysqli;
            break;
        }
    } catch (mysqli_sql_exception $e) {
        // Connection failed for this host, try next
    }
}

if (!$con || $con->connect_error) {
    http_response_code(500);
    $error = $con ? $con->connect_error : 'Unable to connect to any configured database host.';
    die(json_encode(["success" => false, "message" => "Connection failed: " . $error]));
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
    // Localhost / HTTP: Set to Lax for compatibility
    ini_set('session.cookie_samesite', 'Lax');
}

// ── CORS Security ────────────────────────────────────────────
$allowed_origins = ['http://localhost', 'http://127.0.0.1', 'http://localhost:80', 'http://localhost:8080'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$host = $_SERVER['HTTP_HOST'] ?? '';
if (in_array($origin, $allowed_origins) || $origin === "http://$host" || $origin === "https://$host") {
    header("Access-Control-Allow-Origin: $origin");
} else {
    header("Access-Control-Allow-Origin: http://localhost");
}
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, X-CSRF-Token");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// ── Security Headers ──────────────────────────────────────────
header("X-Content-Type-Options: nosniff");
header("X-Frame-Options: DENY");
header("X-XSS-Protection: 1; mode=block");
header("Referrer-Policy: strict-origin-when-cross-origin");

// ── Error Handling ───────────────────────────────────────────
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/error_log.txt');

// ── Security Constants ────────────────────────────────────────
define('MAX_LOGIN_ATTEMPTS', 5);
define('LOCKOUT_TIME', 900);
?>
