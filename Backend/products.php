<?php
$origin = $_SERVER['HTTP_ORIGIN'] ?? 'http://localhost';
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: $origin");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, OPTIONS");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit(); }

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/cache.php';

$cache = new AppCache();

$products = $cache->remember('products.active', 60, function() use ($con) {
    $sql = "
        SELECT p.id, p.uuid, p.name, p.description, p.brand, p.main_image,
               MIN(v.price) as price, SUM(v.stock) as stock, MAX(v.sku) as sku,
               c.name as category_name,
               COALESCE(ROUND(AVG(r.rating), 1), 0) as avg_rating,
               COUNT(DISTINCT r.id) as review_count
        FROM products p
        LEFT JOIN product_variants v ON p.id = v.product_id
        LEFT JOIN product_categories pc ON p.id = pc.product_id
        LEFT JOIN categories c ON pc.category_id = c.id
        LEFT JOIN reviews r ON p.id = r.product_id AND r.status = 'published'
        WHERE p.status = 'active'
        GROUP BY p.id ORDER BY price ASC";
    $result = $con->query($sql);
    $data = [];
    while ($row = $result->fetch_assoc()) $data[] = $row;
    return $data;
});

echo json_encode(["success" => true, "products" => $products]);
$con->close();
?>
