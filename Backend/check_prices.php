<?php
require_once 'config.php';
$res = $con->query("SELECT p.name, v.price FROM products p LEFT JOIN product_variants v ON p.id = v.product_id WHERE p.status = 'active'");
while($row = $res->fetch_assoc()) {
    echo "Product: " . $row['name'] . " - Price: " . ($row['price'] ?? 'NULL') . "\n";
}
?>
