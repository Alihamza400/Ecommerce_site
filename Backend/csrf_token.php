<?php
/**
 * csrf_token.php
 * Endpoint to fetch a CSRF token for the frontend.
 */
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/security_functions.php';

$origin = $_SERVER['HTTP_ORIGIN'] ?? 'null';
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: $origin");
header("Access-Control-Allow-Credentials: true");
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Pragma: no-cache");

echo json_encode([
    "success" => true,
    "csrf_token" => generate_csrf_token()
]);
?>
