<?php
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : 'http://localhost';
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: $origin");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit(); }

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/security_functions.php';
session_start();

$method = $_SERVER['REQUEST_METHOD'];

// ── GET: Fetch reviews for a product ─────────────────────────
if ($method === 'GET') {
    $product_id = intval($_GET['product_id'] ?? 0);
    if ($product_id <= 0) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Invalid product ID."]);
        exit();
    }

    $sql = "SELECT r.id, r.rating, r.comment, r.created_at, u.name as user_name
            FROM reviews r
            JOIN users u ON r.user_id = u.id
            WHERE r.product_id = ? AND r.status = 'published'
            ORDER BY r.created_at DESC";
    
    $stmt = $con->prepare($sql);
    $stmt->bind_param("i", $product_id);
    $stmt->execute();
    $result = $stmt->get_result();

    $reviews = [];
    $total_rating = 0;
    while ($row = $result->fetch_assoc()) {
        $reviews[] = $row;
        $total_rating += $row['rating'];
    }
    $stmt->close();

    $avg_rating = count($reviews) > 0 ? round($total_rating / count($reviews), 1) : 0;

    echo json_encode([
        "success" => true,
        "reviews" => $reviews,
        "avg_rating" => $avg_rating,
        "total_reviews" => count($reviews)
    ]);
    exit();
}

// ── POST: Submit a review (requires auth) ────────────────────
if ($method === 'POST') {
    if (!isset($_SESSION['SESS-ID'])) {
        http_response_code(401);
        echo json_encode(["success" => false, "message" => "Please log in to submit a review."]);
        exit();
    }

    $user_id = $_SESSION['SESS-ID'];
    $data = json_decode(file_get_contents("php://input"), true);
    
    $product_id = intval($data['product_id'] ?? 0);
    $rating = intval($data['rating'] ?? 0);
    $comment = trim($data['comment'] ?? '');
    $csrf_token = $data['csrf_token'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');

    if (!verify_csrf_token($csrf_token)) {
        http_response_code(403);
        echo json_encode(["success" => false, "message" => "Invalid CSRF token."]);
        exit();
    }

    if ($product_id <= 0 || $rating < 1 || $rating > 5) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Invalid product or rating (1-5)."]);
        exit();
    }

    if (empty($comment)) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Please write a comment."]);
        exit();
    }
    if (mb_strlen($comment) > 2000) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Comment too long (max 2000 chars)."]);
        exit();
    }

    $stmt = $con->prepare("SELECT id FROM products WHERE id = ? AND status = 'active'");
    $stmt->bind_param("i", $product_id);
    $stmt->execute();
    if ($stmt->get_result()->num_rows === 0) {
        http_response_code(404);
        echo json_encode(["success" => false, "message" => "Product not found."]);
        exit();
    }
    $stmt->close();

    // Verify purchase (user must have bought this product)
    $stmt = $con->prepare("SELECT oi.id FROM order_items oi JOIN orders o ON oi.order_id = o.id WHERE o.user_id = ? AND oi.product_variant_id IN (SELECT pv.id FROM product_variants pv WHERE pv.product_id = ?) AND o.status IN ('delivered','shipped') LIMIT 1");
    $stmt->bind_param("ii", $user_id, $product_id);
    $stmt->execute();
    $purchased = $stmt->get_result()->num_rows > 0;
    $stmt->close();

    $review_status = $purchased ? 'published' : 'pending';

    $stmt = $con->prepare("INSERT INTO reviews (user_id, product_id, rating, comment, status) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE rating = VALUES(rating), comment = VALUES(comment), status = VALUES(status)");
    $stmt->bind_param("iiiss", $user_id, $product_id, $rating, $comment, $review_status);
    
    if ($stmt->execute()) {
        $msg = $purchased ? "Review submitted successfully!" : "Review submitted for moderation.";
        echo json_encode(["success" => true, "message" => $msg]);
    } else {
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Failed to submit review."]);
    }
    $stmt->close();
    exit();
}

http_response_code(405);
echo json_encode(["success" => false, "message" => "Method not allowed."]);
