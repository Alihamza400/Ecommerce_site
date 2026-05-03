<?php
// ============================================================
// auth_status.php — Quick check if user is logged in
// ============================================================
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : 'http://localhost';
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: $origin");
header("Access-Control-Allow-Credentials: true");

session_start();

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
