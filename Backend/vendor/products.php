<?php
// ============================================================
// products.php — Secure Vendor API to Manage Their Products
// ============================================================
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : 'http://localhost';
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: $origin");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit(); }

require_once __DIR__ . '/../config.php';
session_start();

if (!isset($_SESSION['SESS-ID']) || $_SESSION['SESS-ROLE'] !== 'vendor') {
    http_response_code(403); echo json_encode(["success" => false, "message" => "Forbidden. Vendor Access Required."]); exit();
}

$user_id = $_SESSION['SESS-ID'];
$method = $_SERVER['REQUEST_METHOD'];

// Verify Vendor status and get vendor_id
$stmt = $con->prepare("SELECT id FROM vendors WHERE user_id = ? AND status = 'active' LIMIT 1");
$stmt->bind_param("i", $user_id);
$stmt->execute();
$res = $stmt->get_result();
if($res->num_rows === 0) {
    http_response_code(403); echo json_encode(["success" => false, "message" => "Your vendor account is not active."]); exit();
}
$vendor_id = $res->fetch_assoc()['id'];
$stmt->close();

function gen_uuid() {
    return sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x', mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0x0fff) | 0x4000, mt_rand(0, 0x3fff) | 0x8000, mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff));
}

// ── GET: View Vendor's Products ─────────────────────────────
if ($method === 'GET') {
    $sql = "
        SELECT p.id, p.name, p.main_image, p.status, p.created_at, p.description, p.brand, pc.category_id,
               MIN(v.price) as lowest_price, SUM(v.stock) as total_stock
        FROM products p
        LEFT JOIN product_variants v ON p.id = v.product_id
        LEFT JOIN product_categories pc ON p.id = pc.product_id
        WHERE p.vendor_id = ?
        GROUP BY p.id
        ORDER BY p.created_at DESC
    ";
    
    $stmt = $con->prepare($sql);
    $stmt->bind_param("i", $vendor_id);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $products = [];
    while ($row = $result->fetch_assoc()) {
        $products[] = $row;
    }
    $stmt->close();
    
    echo json_encode(["success" => true, "products" => $products]);
    exit();
}

// ── POST: Create or Update a Product ────────────────────────
if ($method === 'POST') {
    $product_id = intval($_POST['id'] ?? 0); // Presence of ID means UPDATE
    
    $name = trim($_POST['name'] ?? '');
    $desc = trim($_POST['description'] ?? '');
    $brand = trim($_POST['brand'] ?? 'Generic');
    $category_id = intval($_POST['category_id'] ?? 1);
    $price = floatval($_POST['price'] ?? 0);
    $stock = intval($_POST['stock'] ?? 0);
    
    if(empty($name) || $price <= 0) {
        http_response_code(400); echo json_encode(["success"=>false,"message"=>"Name and valid price required."]); exit();
    }

    // ── Image Upload Logic ──────────────────────────────────
    $image_path = $_POST['existing_image'] ?? null;
    if (isset($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
        $upload_dir = __DIR__ . '/../uploads/products/';
        if (!is_dir($upload_dir)) mkdir($upload_dir, 0777, true);
        
        $file_ext = strtolower(pathinfo($_FILES['image']['name'], PATHINFO_EXTENSION));
        if (in_array($file_ext, ['jpg', 'jpeg', 'png', 'webp'])) {
            $file_name = uniqid('prod_') . '.' . $file_ext;
            if (move_uploaded_file($_FILES['image']['tmp_name'], $upload_dir . $file_name)) {
                $image_path = 'uploads/products/' . $file_name;
            }
        }
    }
    
    $con->begin_transaction();
    try {
        if ($product_id > 0) {
            // ── UPDATE EXISTING PRODUCT ──
            // 1. Verify ownership
            $chk = $con->prepare("SELECT id FROM products WHERE id = ? AND vendor_id = ?");
            $chk->bind_param("ii", $product_id, $vendor_id);
            $chk->execute();
            if($chk->get_result()->num_rows === 0) throw new Exception("Unauthorized.");
            $chk->close();

            // 2. Update Product
            $upd_p = $con->prepare("UPDATE products SET name=?, description=?, brand=?, main_image=? WHERE id=?");
            $upd_p->bind_param("ssssi", $name, $desc, $brand, $image_path, $product_id);
            $upd_p->execute();

            // 3. Update Category
            $upd_c = $con->prepare("UPDATE product_categories SET category_id=? WHERE product_id=?");
            $upd_c->bind_param("ii", $category_id, $product_id);
            $upd_c->execute();

            // 4. Update Variant (Simplification: updates the first variant found)
            $upd_v = $con->prepare("UPDATE product_variants SET price=?, stock=? WHERE product_id=? LIMIT 1");
            $upd_v->bind_param("dii", $price, $stock, $product_id);
            $upd_v->execute();

            $msg = "Product updated successfully!";
        } else {
            // ── CREATE NEW PRODUCT ──
            $p_uuid = gen_uuid();
            $ins_p = $con->prepare("INSERT INTO products (uuid, vendor_id, name, description, brand, main_image, status) VALUES (?, ?, ?, ?, ?, ?, 'active')");
            $ins_p->bind_param("sissss", $p_uuid, $vendor_id, $name, $desc, $brand, $image_path);
            $ins_p->execute();
            $product_id = $ins_p->insert_id;

            $ins_c = $con->prepare("INSERT INTO product_categories (product_id, category_id) VALUES (?, ?)");
            $ins_c->bind_param("ii", $product_id, $category_id);
            $ins_c->execute();

            $v_uuid = gen_uuid();
            $sku = strtoupper(substr($brand, 0, 3)) . "-" . mt_rand(1000,9999);
            $ins_v = $con->prepare("INSERT INTO product_variants (uuid, product_id, sku, price, stock) VALUES (?, ?, ?, ?, ?)");
            $ins_v->bind_param("sisdi", $v_uuid, $product_id, $sku, $price, $stock);
            $ins_v->execute();
            
            $msg = "Product published successfully!";
        }
        
        $con->commit();
        echo json_encode(["success" => true, "message" => $msg]);
        
    } catch(Exception $e) {
        $con->rollback();
        http_response_code(500); echo json_encode(["success"=>false, "message"=>$e->getMessage() ?: "Failed to save product."]);
    }
}
?>
