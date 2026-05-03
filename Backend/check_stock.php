<?php
require_once 'config.php';
$r = $con->query('SELECT p.name, v.stock FROM products p JOIN product_variants v ON p.id = v.product_id');
while($row = $r->fetch_assoc()) {
    echo $row['name'] . ': ' . $row['stock'] . PHP_EOL;
}
?>
