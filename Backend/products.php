<?php
// ============================================================
// products.php — Fetches all active products
// Joins with product_variants to get the minimum price
// Joins with categories to get primary category name
// ============================================================
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : 'http://localhost';
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: $origin");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, OPTIONS");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/config.php';

// Prepare SQL query to fetch active products, their lowest price variant, and category
$sql = "
    SELECT 
        p.id, 
        p.uuid, 
        p.name, 
        p.description, 
        p.brand, 
        p.main_image,
        MIN(v.price) as price,
        SUM(v.stock) as stock,
        MAX(v.sku) as sku,
        c.name as category_name
    FROM products AS p
    LEFT JOIN product_variants AS v ON p.id = v.product_id
    LEFT JOIN product_categories AS pc ON p.id = pc.product_id
    LEFT JOIN categories AS c ON pc.category_id = c.id
    WHERE p.status = 'active'
    GROUP BY p.id
    ORDER BY price ASC
";

$result = $con->query($sql);

if (!$result) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Database error: " . $con->error]);
    exit();
}

$products = [];
while ($row = $result->fetch_assoc()) {
    $products[] = $row;
}

echo json_encode(["success" => true, "products" => $products]);
$con->close();
?>
