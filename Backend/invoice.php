<?php
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : 'http://localhost';
header("Access-Control-Allow-Origin: $origin");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit(); }

require_once __DIR__ . '/config.php';
session_start();

if (!isset($_SESSION['SESS-ID'])) {
    http_response_code(401);
    echo json_encode(["success" => false, "message" => "Unauthorized."]);
    exit();
}

$user_id = $_SESSION['SESS-ID'];
$role = $_SESSION['SESS-ROLE'] ?? 'customer';
$order_uuid = trim($_GET['uuid'] ?? '');

if (empty($order_uuid)) {
    http_response_code(400);
    echo json_encode(["success" => false, "message" => "Order UUID required."]);
    exit();
}

// Fetch order
$stmt = $con->prepare("SELECT o.*, u.name as customer_name, u.email as customer_email,
    ua.address_line, ua.city, ua.state, ua.country, ua.postal_code
    FROM orders o
    JOIN users u ON o.user_id = u.id
    LEFT JOIN user_addresses ua ON o.address_id = ua.id
    WHERE o.uuid = ? " . ($role !== 'admin' ? "AND o.user_id = ?" : "") . " LIMIT 1");
if ($role !== 'admin') {
    $stmt->bind_param("si", $order_uuid, $user_id);
} else {
    $stmt->bind_param("s", $order_uuid);
}
$stmt->execute();
$order = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$order) {
    http_response_code(404);
    echo json_encode(["success" => false, "message" => "Order not found."]);
    exit();
}

// Fetch items
$stmt = $con->prepare("SELECT oi.*, p.name as product_name, p.brand
    FROM order_items oi
    JOIN product_variants pv2 ON oi.product_variant_id = pv2.id
    JOIN products p ON pv2.product_id = p.id
    WHERE oi.order_id = ?");
$stmt->bind_param("i", $order['id']);
$stmt->execute();
$items = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();

// ── Generate PDF ─────────────────────────────────────────────
require_once '/usr/share/php/tcpdf/tcpdf.php';

$pdf = new TCPDF(PDF_PAGE_ORIENTATION, PDF_UNIT, PDF_PAGE_FORMAT, true, 'UTF-8', false);
$pdf->SetCreator('ShopVerse Marketplace');
$pdf->SetAuthor('ShopVerse');
$pdf->SetTitle('Invoice #' . substr($order['uuid'], 0, 8));
$pdf->SetMargins(15, 15, 15);
$pdf->AddPage();

$pdf->SetFont('helvetica', 'B', 22);
$pdf->SetTextColor(124, 58, 237);
$pdf->Cell(0, 12, 'SHOPVERSE', 0, 1, 'L');
$pdf->SetFont('helvetica', '', 9);
$pdf->SetTextColor(100, 100, 100);
$pdf->Cell(0, 5, 'AI-Powered Marketplace', 0, 1, 'L');
$pdf->Cell(0, 5, 'Invoice: #' . substr($order['uuid'], 0, 8), 0, 1, 'L');
$pdf->Cell(0, 5, 'Date: ' . date('F j, Y', strtotime($order['created_at'])), 0, 1, 'L');
$pdf->Ln(5);

$pdf->SetFont('helvetica', '', 10);
$pdf->SetTextColor(50, 50, 50);

// Bill To
$pdf->SetFont('helvetica', 'B', 11);
$pdf->Cell(0, 7, 'Bill To:', 0, 1);
$pdf->SetFont('helvetica', '', 10);
$pdf->Cell(0, 6, $order['customer_name'], 0, 1);
$pdf->Cell(0, 6, $order['customer_email'], 0, 1);
if ($order['address_line']) {
    $pdf->Cell(0, 6, $order['address_line'], 0, 1);
    $pdf->Cell(0, 6, $order['city'] . ', ' . $order['state'] . ' ' . $order['postal_code'], 0, 1);
    $pdf->Cell(0, 6, $order['country'], 0, 1);
}
$pdf->Ln(5);

// Payment Status
$statusColor = $order['payment_status'] === 'paid' ? [16, 185, 129] : [239, 68, 68];
$pdf->SetTextColor($statusColor[0], $statusColor[1], $statusColor[2]);
$pdf->SetFont('helvetica', 'B', 10);
$pdf->Cell(0, 6, 'Payment: ' . strtoupper($order['payment_status']), 0, 1);
$pdf->SetTextColor(50, 50, 50);
$pdf->Ln(5);

// Items Table Header
$pdf->SetFont('helvetica', 'B', 10);
$pdf->SetFillColor(124, 58, 237);
$pdf->SetTextColor(255, 255, 255);
$pdf->Cell(80, 8, 'Product', 1, 0, 'L', true);
$pdf->Cell(25, 8, 'Price', 1, 0, 'C', true);
$pdf->Cell(15, 8, 'Qty', 1, 0, 'C', true);
$pdf->Cell(30, 8, 'Subtotal', 1, 1, 'R', true);

$pdf->SetFont('helvetica', '', 10);
$pdf->SetTextColor(50, 50, 50);
$total = 0;

foreach ($items as $item) {
    $subtotal = $item['price'] * $item['quantity'];
    $total += $subtotal;
    $pdf->Cell(80, 7, substr($item['product_name'], 0, 40), 'LR', 0, 'L');
    $pdf->Cell(25, 7, '$' . number_format($item['price'], 2), 'LR', 0, 'C');
    $pdf->Cell(15, 7, $item['quantity'], 'LR', 0, 'C');
    $pdf->Cell(30, 7, '$' . number_format($subtotal, 2), 'LR', 1, 'R');
}
$pdf->Cell(120, 0, '', 'T', 1); // bottom line

$pdf->Ln(5);

// Totals
$pdf->SetFont('helvetica', '', 10);
$pdf->Cell(120, 6, 'Subtotal:', 0, 0, 'R');
$pdf->Cell(30, 6, '$' . number_format($total, 2), 0, 1, 'R');

if (floatval($order['discount_amount']) > 0) {
    $pdf->SetTextColor(16, 185, 129);
    $pdf->Cell(120, 6, 'Discount:', 0, 0, 'R');
    $pdf->Cell(30, 6, '-$' . number_format($order['discount_amount'], 2), 0, 1, 'R');
    $pdf->SetTextColor(50, 50, 50);
}

$pdf->SetFont('helvetica', 'B', 12);
$pdf->Cell(120, 8, 'Total:', 0, 0, 'R');
$pdf->Cell(30, 8, '$' . number_format($order['total_amount'], 2), 0, 1, 'R');

$pdf->Ln(10);

// Footer
$pdf->SetFont('helvetica', '', 8);
$pdf->SetTextColor(150, 150, 150);
$pdf->Cell(0, 4, 'Thank you for shopping with ShopVerse!', 0, 1, 'C');
$pdf->Cell(0, 4, 'For support: raialihamza58@gmail.com', 0, 1, 'C');
$pdf->Cell(0, 4, 'Invoice generated on ' . date('Y-m-d H:i:s'), 0, 1, 'C');

$pdf->Output('invoice-' . substr($order['uuid'], 0, 8) . '.pdf', 'I');
