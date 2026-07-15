<?php
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : 'http://localhost';
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: $origin");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit(); }

require_once __DIR__ . '/config.php';
session_start();

if (!isset($_SESSION['SESS-ID'])) {
    http_response_code(401);
    echo json_encode(["success" => false, "message" => "Please log in."]);
    exit();
}

$user_id = $_SESSION['SESS-ID'];
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $sql = "SELECT w.id as wishlist_id, w.product_id, w.created_at,
                   p.name, p.brand, p.main_image, p.slug,
                   MIN(v.price) as price
            FROM wishlists w
            JOIN products p ON w.product_id = p.id
            LEFT JOIN product_variants v ON p.id = v.product_id
            WHERE w.user_id = ?
            GROUP BY w.id
            ORDER BY w.created_at DESC";
    $stmt = $con->prepare($sql);
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $items = [];
    while ($row = $result->fetch_assoc()) $items[] = $row;
    $stmt->close();
    echo json_encode(["success" => true, "items" => $items]);
    exit();
}

$data = json_decode(file_get_contents("php://input"), true);
$product_id = intval($data['product_id'] ?? ($_GET['product_id'] ?? 0));

if ($product_id <= 0) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Invalid product."]);
    exit();
}

if ($method === 'POST') {
    $stmt = $con->prepare("INSERT IGNORE INTO wishlists (user_id, product_id) VALUES (?, ?)");
    $stmt->bind_param("ii", $user_id, $product_id);
    $stmt->execute();
    $added = $stmt->affected_rows > 0;
    $stmt->close();
    echo json_encode(["success" => true, "message" => $added ? "Added to wishlist!" : "Already in wishlist."]);
    exit();
}

if ($method === 'DELETE') {
    $stmt = $con->prepare("DELETE FROM wishlists WHERE user_id = ? AND product_id = ?");
    $stmt->bind_param("ii", $user_id, $product_id);
    $stmt->execute();
    $stmt->close();
    echo json_encode(["success" => true, "message" => "Removed from wishlist."]);
    exit();
}
