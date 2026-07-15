<?php
// ============================================================
// upload_product_image.php — Secure Product Media Manager
// ============================================================
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : 'http://localhost';
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: $origin");
header("Access-Control-Allow-Credentials: true");

require_once __DIR__ . '/../config.php';
session_start();

// 1. Strict Security: Admin Only
if (!isset($_SESSION['SESS-ID']) || $_SESSION['SESS-ROLE'] !== 'admin') {
    http_response_code(403);
    echo json_encode(["success" => false, "message" => "Admin access required."]);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405); exit();
}

$product_id = intval($_POST['product_id'] ?? 0);
if ($product_id <= 0) {
    echo json_encode(["success" => false, "message" => "Invalid product ID."]);
    exit();
}

// 2. File Validation
if (!isset($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
    echo json_encode(["success" => false, "message" => "No image uploaded or upload error."]);
    exit();
}

$file = $_FILES['image'];
$allowed_types = ['image/jpeg', 'image/png', 'image/webp'];
if (!in_array($file['type'], $allowed_types)) {
    echo json_encode(["success" => false, "message" => "Invalid file type. Only JPG, PNG, and WebP allowed."]);
    exit();
}

// 3. Prepare Storage
$upload_dir = __DIR__ . '/../uploads/products/';
if (!is_dir($upload_dir)) {
    mkdir($upload_dir, 0777, true);
}

// Generate unique filename
$ext = pathinfo($file['name'], PATHINFO_EXTENSION);
$filename = "prod_" . $product_id . "_" . bin2hex(random_bytes(4)) . "." . $ext;
$target_path = $upload_dir . $filename;

// 4. Move & Update Database
if (move_uploaded_file($file['tmp_name'], $target_path)) {
    // Save relative path for frontend access
    $db_path = "uploads/products/" . $filename;
    
    $stmt = $con->prepare("UPDATE products SET main_image = ? WHERE id = ?");
    $stmt->bind_param("si", $db_path, $product_id);
    
    if ($stmt->execute()) {
        echo json_encode(["success" => true, "message" => "Image uploaded successfully!", "image_url" => $db_path]);
    } else {
        echo json_encode(["success" => false, "message" => "File saved, but database update failed."]);
    }
    $stmt->close();
} else {
    echo json_encode(["success" => false, "message" => "Failed to move uploaded file."]);
}
?>
