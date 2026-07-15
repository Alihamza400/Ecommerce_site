<?php
// ============================================================
// vendors.php — Secure Admin API to Manage Vendor Approvals
// ============================================================
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : 'http://localhost';
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: $origin");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, PUT, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200); exit();
}

require_once __DIR__ . '/../config.php';
session_start();

// Strict Verification: Only Users with the Admin Role can execute this
if (!isset($_SESSION['SESS-ID']) || $_SESSION['SESS-ROLE'] !== 'admin') {
    http_response_code(403);
    echo json_encode(["success" => false, "message" => "Forbidden. Administrator Access Required."]);
    exit();
}

$method = $_SERVER['REQUEST_METHOD'];

// ── GET: View All Vendors / Applications ────────────────────
if ($method === 'GET') {
    $filter = $_GET['status'] ?? 'all';
    
    $sql = "
        SELECT v.id as vendor_id, v.uuid, v.store_name, v.status as vendor_status, u.id as user_id, u.name, u.email 
        FROM vendors v
        JOIN users u ON v.user_id = u.id
    ";
    
    if ($filter === 'inactive') { $sql .= " WHERE v.status = 'inactive'"; }
    elseif ($filter === 'active') { $sql .= " WHERE v.status = 'active'"; }
    
    $sql .= " ORDER BY v.id DESC";
    
    $result = $con->query($sql);
    $vendors = [];
    while ($row = $result->fetch_assoc()) {
        $vendors[] = $row;
    }
    
    echo json_encode(["success" => true, "vendors" => $vendors]);
    exit();
}

// ── PUT: Approve, Reject, Remove, or Restore Vendors ─────────
if ($method === 'PUT') {
    $raw = file_get_contents("php://input");
    $data = !empty($raw) ? json_decode($raw, true) : $_POST;
    
    $vendor_id = intval($data['vendor_id'] ?? 0);
    $action = $data['action'] ?? '';
    
    if ($vendor_id <= 0 || !in_array($action, ['approve', 'reject', 'remove', 'restore', 'revoke', 'delete'])) {
        http_response_code(400); echo json_encode(["success"=>false, "message"=>"Invalid parameters."]); exit();
    }
    
    // Fetch the user linked to this vendor application
    $stmt = $con->prepare("SELECT user_id, status FROM vendors WHERE id = ?");
    $stmt->bind_param("i", $vendor_id);
    $stmt->execute();
    $res = $stmt->get_result();
    if($res->num_rows === 0) {
        http_response_code(404); echo json_encode(["success"=>false, "message"=>"Vendor request not found."]); exit();
    }
    $vendor = $res->fetch_assoc();
    $target_user_id = $vendor['user_id'];
    $current_status = $vendor['status'];
    $stmt->close();
    
    if ($action === 'approve') {
        $con->begin_transaction();
        try {
            $up_v = $con->prepare("UPDATE vendors SET status = 'active' WHERE id = ?");
            $up_v->bind_param("i", $vendor_id);
            $up_v->execute();
            $up_v->close();
            
            $up_u = $con->prepare("UPDATE users SET role = 'vendor' WHERE id = ?");
            $up_u->bind_param("i", $target_user_id);
            $up_u->execute();
            $up_u->close();
            
            $con->commit();
            echo json_encode(["success" => true, "message" => "Vendor successfully approved! User role upgraded."]);
        } catch(Exception $e) {
            $con->rollback();
            http_response_code(500); echo json_encode(["success"=>false, "message"=>"Failed to upgrade vendor due to database error."]);
        }
        
    } else if ($action === 'reject') {
        $del = $con->prepare("DELETE FROM vendors WHERE id = ?");
        $del->bind_param("i", $vendor_id);
        if($del->execute()) {
            echo json_encode(["success" => true, "message" => "Application successfully rejected and wiped."]);
        } else {
            http_response_code(500); echo json_encode(["success"=>false, "message"=>"Failed."]);
        }
        $del->close();

    } else if ($action === 'remove') {
        if ($current_status !== 'active') {
            http_response_code(400); echo json_encode(["success"=>false, "message"=>"Only active vendors can be removed."]); exit();
        }
        $con->begin_transaction();
        try {
            $up_v = $con->prepare("UPDATE vendors SET status = 'suspended' WHERE id = ?");
            $up_v->bind_param("i", $vendor_id);
            $up_v->execute();
            $up_v->close();

            $up_u = $con->prepare("UPDATE users SET role = 'customer' WHERE id = ? AND role = 'vendor'");
            $up_u->bind_param("i", $target_user_id);
            $up_u->execute();
            $up_u->close();

            $con->commit();
            echo json_encode(["success" => true, "message" => "Vendor has been removed and user downgraded to customer."]);
        } catch(Exception $e) {
            $con->rollback();
            http_response_code(500); echo json_encode(["success"=>false, "message"=>"Failed to remove vendor."]);
        }

    } else if ($action === 'restore') {
        $con->begin_transaction();
        try {
            $up_v = $con->prepare("UPDATE vendors SET status = 'active' WHERE id = ?");
            $up_v->bind_param("i", $vendor_id);
            $up_v->execute();
            $up_v->close();

            $up_u = $con->prepare("UPDATE users SET role = 'vendor' WHERE id = ?");
            $up_u->bind_param("i", $target_user_id);
            $up_u->execute();
            $up_u->close();

            $con->commit();
            echo json_encode(["success" => true, "message" => "Vendor restored successfully."]);
        } catch(Exception $e) {
            $con->rollback();
            http_response_code(500); echo json_encode(["success"=>false, "message"=>"Failed to restore vendor."]);
        }

    } else if ($action === 'revoke') {
        if ($current_status !== 'active') {
            http_response_code(400); echo json_encode(["success"=>false, "message"=>"Only active vendors can be revoked."]); exit();
        }
        $con->begin_transaction();
        try {
            $del = $con->prepare("DELETE FROM vendors WHERE id = ?");
            $del->bind_param("i", $vendor_id);
            $del->execute();
            $del->close();

            $up_u = $con->prepare("UPDATE users SET role = 'customer' WHERE id = ?");
            $up_u->bind_param("i", $target_user_id);
            $up_u->execute();
            $up_u->close();

            $con->commit();
            echo json_encode(["success" => true, "message" => "Vendorship revoked permanently. User reverted to customer."]);
        } catch(Exception $e) {
            $con->rollback();
            http_response_code(500); echo json_encode(["success"=>false, "message"=>"Failed to revoke vendorship."]);
        }

    } else if ($action === 'delete') {
        $con->begin_transaction();
        try {
            $del = $con->prepare("DELETE FROM vendors WHERE id = ?");
            $del->bind_param("i", $vendor_id);
            $del->execute();
            $del->close();

            $up_u = $con->prepare("UPDATE users SET role = 'customer' WHERE id = ?");
            $up_u->bind_param("i", $target_user_id);
            $up_u->execute();
            $up_u->close();

            $con->commit();
            echo json_encode(["success" => true, "message" => "Vendor deleted permanently. User reverted to customer."]);
        } catch(Exception $e) {
            $con->rollback();
            http_response_code(500); echo json_encode(["success"=>false, "message"=>"Failed to delete vendor."]);
        }
    }
}
?>
