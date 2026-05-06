<?php
// ============================================================
// categories.php — Public category list for vendor forms
// ============================================================
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : 'http://localhost';
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

$countResult = $con->query("SELECT COUNT(*) AS total FROM categories")->fetch_assoc();
if ((int)$countResult['total'] === 0) {
    $defaults = ['Electronics', 'Fashion', 'Home & Garden'];
    $insert = $con->prepare("INSERT INTO categories (name) VALUES (?)");
    foreach ($defaults as $name) {
        $insert->bind_param("s", $name);
        $insert->execute();
    }
    $insert->close();
}

$stmt = $con->prepare("SELECT id, name FROM categories ORDER BY id ASC");
$stmt->execute();
$result = $stmt->get_result();
$categories = [];
while ($row = $result->fetch_assoc()) {
    $categories[] = $row;
}
$stmt->close();

echo json_encode(["success" => true, "categories" => $categories]);
exit();
