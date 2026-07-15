<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/security_functions.php';
header("Content-Type: application/json");
session_start();

$is_admin = isset($_SESSION['SESS-ROLE']) && $_SESSION['SESS-ROLE'] === 'admin';
$is_vendor = isset($_SESSION['SESS-ROLE']) && $_SESSION['SESS-ROLE'] === 'vendor';

$user_id = $_SESSION['SESS-ID'] ?? 0;
$method = $_SERVER['REQUEST_METHOD'];

if (!$is_admin && !$is_vendor) {
    http_response_code(403); echo json_encode(["success" => false, "message" => "Forbidden. Vendor or Admin access required."]); exit();
}

// For vendor-only operations, verify active vendor status
$vendor_id = null;
if ($is_vendor) {
    $stmt = $con->prepare("SELECT id FROM vendors WHERE user_id = ? AND status = 'active' LIMIT 1");
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $res = $stmt->get_result();
    if($res->num_rows === 0) {
        http_response_code(403); echo json_encode(["success" => false, "message" => "Your vendor account is not active."]); exit();
    }
    $vendor_id = $res->fetch_assoc()['id'];
    $stmt->close();
}

function gen_uuid() {
    $data = random_bytes(16);
    $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
    $data[8] = chr(ord($data[8]) & 0x3f | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

function category_exists(mysqli $con, int $category_id): bool {
    $stmt = $con->prepare("SELECT id FROM categories WHERE id = ? LIMIT 1");
    $stmt->bind_param("i", $category_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $exists = $result->num_rows > 0;
    $stmt->close();
    return $exists;
}

function ensure_default_categories(mysqli $con): void {
    $count = $con->query("SELECT COUNT(*) AS total FROM categories")->fetch_assoc()['total'];
    if ((int)$count === 0) {
        $defaults = [
            ['Electronics', 'electronics'],
            ['Fashion', 'fashion'],
            ['Home & Garden', 'home-garden']
        ];
        $stmt = $con->prepare("INSERT INTO categories (uuid, name, slug) VALUES (?, ?, ?)");
        foreach ($defaults as $item) {
            $uuid = sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
                mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff),
                mt_rand(0, 0x0fff) | 0x4000, mt_rand(0, 0x3fff) | 0x8000,
                mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff));
            $stmt->bind_param("sss", $uuid, $item[0], $item[1]);
            $stmt->execute();
        }
        $stmt->close();
    }
}

function create_default_category(mysqli $con): int {
    $uuid = sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
        mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff),
        mt_rand(0, 0x0fff) | 0x4000, mt_rand(0, 0x3fff) | 0x8000,
        mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff));
    $name = 'General';
    $slug = 'general';
    $stmt = $con->prepare("INSERT INTO categories (uuid, name, slug) VALUES (?, ?, ?)");
    $stmt->bind_param("sss", $uuid, $name, $slug);
    $stmt->execute();
    $id = $stmt->insert_id;
    $stmt->close();
    return $id;
}

// ── GET: View Products (vendor sees own, admin sees all) ────
if ($method === 'GET') {
    $sql = "
        SELECT p.id, p.name, p.main_image, p.status, p.created_at, p.description, p.brand,
               COALESCE(MIN(pc.category_id), 1) AS category_id,
               MIN(v.price) AS lowest_price, SUM(v.stock) AS total_stock
        FROM products p
        LEFT JOIN product_variants v ON p.id = v.product_id
        LEFT JOIN product_categories pc ON p.id = pc.product_id
    ";
    
    if ($is_vendor) {
        $sql .= " WHERE p.vendor_id = ?";
    }
    
    $sql .= " GROUP BY p.id, p.name, p.main_image, p.status, p.created_at, p.description, p.brand
              ORDER BY p.created_at DESC";
    
    $stmt = $con->prepare($sql);
    if (!$stmt) {
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Database query failed."]);
        exit();
    }

    if ($is_vendor) {
        $stmt->bind_param("i", $vendor_id);
    }
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
    $raw = file_get_contents("php://input");
    $data = !empty($raw) ? json_decode($raw, true) : $_POST;
    $csrf_token = $data['csrf_token'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    if (!verify_csrf_token($csrf_token)) {
        http_response_code(403);
        echo json_encode(["success" => false, "message" => "Invalid CSRF token."]);
        exit();
    }

    $product_id = intval($data['id'] ?? 0);
    $name = trim($data['name'] ?? '');
    $desc = trim($data['description'] ?? '');
    $brand = trim($data['brand'] ?? '');
    $category_id = intval($data['category_id'] ?? 1);
    $price = floatval($data['price'] ?? 0);
    $stock = max(0, intval($data['stock'] ?? 0));

    if (empty($name) || mb_strlen($name) > 220) {
        http_response_code(400); echo json_encode(["success"=>false,"message"=>"Product name is required (max 220 chars)."]); exit();
    }
    if ($price <= 0) {
        http_response_code(400); echo json_encode(["success"=>false,"message"=>"Price must be greater than zero."]); exit();
    }
    if (!empty($desc) && mb_strlen($desc) > 5000) {
        http_response_code(400); echo json_encode(["success"=>false,"message"=>"Description too long."]); exit();
    }

    ensure_default_categories($con);
    if ($category_id <= 0 || !category_exists($con, $category_id)) {
        http_response_code(400);
        echo json_encode(["success"=>false,"message"=>"Invalid category selected."]);
        exit();
    }

    // ── Secure Image Upload ──────────────────────────────────
    $image_path = $data['existing_image'] ?? null;
    if (isset($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
        if ($_FILES['image']['size'] > 5 * 1024 * 1024) {
            http_response_code(400); echo json_encode(["success"=>false,"message"=>"Image must be under 5MB."]); exit();
        }
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime = finfo_file($finfo, $_FILES['image']['tmp_name']);
        finfo_close($finfo);
        $allowed_mimes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!in_array($mime, $allowed_mimes)) {
            http_response_code(400); echo json_encode(["success"=>false,"message"=>"Only JPG, PNG, or WebP images allowed."]); exit();
        }
        $upload_dir = __DIR__ . '/uploads/products/';
        if (!is_dir($upload_dir)) mkdir($upload_dir, 0755, true);
        $file_ext = pathinfo($_FILES['image']['name'], PATHINFO_EXTENSION);
        $file_name = 'prod_' . bin2hex(random_bytes(8)) . '.' . $file_ext;
        if (move_uploaded_file($_FILES['image']['tmp_name'], $upload_dir . $file_name)) {
            $image_path = 'uploads/products/' . $file_name;
        }
    }
    
    $con->begin_transaction();
    try {
        if ($product_id > 0) {
            $chk = $con->prepare("SELECT id FROM products WHERE id = ? AND vendor_id = ?");
            $chk->bind_param("ii", $product_id, $vendor_id);
            $chk->execute();
            if($chk->get_result()->num_rows === 0) {
                $con->rollback();
                http_response_code(403);
                echo json_encode(["success"=>false, "message"=>"Product not found."]);
                exit();
            }
            $chk->close();

            $upd_p = $con->prepare("UPDATE products SET name=?, description=?, brand=?, main_image=? WHERE id=?");
            $upd_p->bind_param("ssssi", $name, $desc, $brand, $image_path, $product_id);
            $upd_p->execute();

            $upd_c = $con->prepare("UPDATE product_categories SET category_id=? WHERE product_id=?");
            $upd_c->bind_param("ii", $category_id, $product_id);
            $upd_c->execute();

            $upd_v = $con->prepare("UPDATE product_variants SET price=?, stock=? WHERE product_id=? LIMIT 1");
            $upd_v->bind_param("dii", $price, $stock, $product_id);
            $upd_v->execute();

            $msg = "Product updated successfully!";
        } else {
            $p_uuid = gen_uuid();
            $slug = strtolower(trim(preg_replace('/[^a-z0-9-]+/', '-', $name), '-'));
            $slug = substr($slug, 0, 200) . '-' . bin2hex(random_bytes(2));
            $ins_p = $con->prepare("INSERT INTO products (uuid, vendor_id, name, slug, description, brand, main_image, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'active')");
            $ins_p->bind_param("sisssss", $p_uuid, $vendor_id, $name, $slug, $desc, $brand, $image_path);
            $ins_p->execute();
            $product_id = $ins_p->insert_id;

            $ins_c = $con->prepare("INSERT INTO product_categories (product_id, category_id) VALUES (?, ?)");
            $ins_c->bind_param("ii", $product_id, $category_id);
            $ins_c->execute();

            $v_uuid = gen_uuid();
            $sku = strtoupper(substr($brand, 0, 3)) . "-" . bin2hex(random_bytes(2));
            $ins_v = $con->prepare("INSERT INTO product_variants (uuid, product_id, sku, price, stock) VALUES (?, ?, ?, ?, ?)");
            $ins_v->bind_param("sisdi", $v_uuid, $product_id, $sku, $price, $stock);
            $ins_v->execute();
            
            $msg = "Product published successfully!";
        }

        // Invalidate cache AFTER successful transaction
        require_once __DIR__ . '/cache.php';
        $cache = new AppCache();
        $cache->forget('products.active');
        
        $con->commit();
        echo json_encode(["success" => true, "message" => $msg]);
        
    } catch(Exception $e) {
        $con->rollback();
        error_log("Product Save Error: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(["success"=>false, "message"=>"Failed to save product."]);
    }
}

// ── DELETE: Remove a product (vendor owns, admin any) ─────
if ($method === 'DELETE') {
    $data = json_decode(file_get_contents("php://input"), true);
    $product_id = intval($data['product_id'] ?? ($_GET['product_id'] ?? 0));

    if ($product_id <= 0) {
        http_response_code(400);
        echo json_encode(["success" => false, "message" => "Invalid product ID."]);
        exit();
    }

    // Verify ownership for vendors, admin can delete any
    if ($is_vendor) {
        $chk = $con->prepare("SELECT id FROM products WHERE id = ? AND vendor_id = ?");
        $chk->bind_param("ii", $product_id, $vendor_id);
        $chk->execute();
        if ($chk->get_result()->num_rows === 0) {
            http_response_code(403);
            echo json_encode(["success" => false, "message" => "Product not found or not yours."]);
            exit();
        }
        $chk->close();
    }

    $con->begin_transaction();
    try {
        $con->query("SET FOREIGN_KEY_CHECKS = 0");
        $con->query("DELETE FROM product_categories WHERE product_id = $product_id");
        $con->query("DELETE FROM reviews WHERE product_id = $product_id");
        $con->query("DELETE FROM wishlists WHERE product_id = $product_id");
        $con->query("DELETE FROM product_variants WHERE product_id = $product_id");
        $con->query("DELETE FROM cart_items WHERE product_variant_id IN (SELECT id FROM product_variants WHERE product_id = $product_id)");
        $con->query("DELETE FROM products WHERE id = $product_id");
        $con->query("SET FOREIGN_KEY_CHECKS = 1");

        // Invalidate cache
        require_once __DIR__ . '/cache.php';
        $cache = new AppCache();
        $cache->forget('products.active');

        $con->commit();
        echo json_encode(["success" => true, "message" => "Product deleted successfully."]);
    } catch (Exception $e) {
        $con->rollback();
        $con->query("SET FOREIGN_KEY_CHECKS = 1");
        http_response_code(500);
        echo json_encode(["success" => false, "message" => "Failed to delete product."]);
        error_log("Product Delete Error: " . $e->getMessage());
    }
    exit();
}
?>
