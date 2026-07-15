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
require_once __DIR__ . '/cache.php';

$cache = new AppCache();

$categories = $cache->remember('categories.list', 300, function() use ($con) {
    // Ensure categories exist
    $countResult = $con->query("SELECT COUNT(*) AS total FROM categories")->fetch_assoc();
    if ((int)$countResult['total'] === 0) {
        $defaults = [
            ['Electronics', 'electronics'],
            ['Fashion', 'fashion'],
            ['Home & Garden', 'home-garden']
        ];
        $insert = $con->prepare("INSERT INTO categories (uuid, name, slug) VALUES (?, ?, ?)");
        foreach ($defaults as $item) {
            $uuid = sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
                mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff),
                mt_rand(0, 0x0fff) | 0x4000, mt_rand(0, 0x3fff) | 0x8000,
                mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff));
            $insert->bind_param("sss", $uuid, $item[0], $item[1]);
            $insert->execute();
        }
        $insert->close();
    }

    $stmt = $con->prepare("SELECT id, name FROM categories ORDER BY id ASC");
    $stmt->execute();
    $result = $stmt->get_result();
    $cats = [];
    while ($row = $result->fetch_assoc()) $cats[] = $row;
    $stmt->close();
    return $cats;
});

echo json_encode(["success" => true, "categories" => $categories]);
