<?php
require_once 'config.php';
$res = $con->query("SELECT COUNT(*) as count FROM products WHERE status = 'active'");
echo "Active Products: " . $res->fetch_assoc()['count'] . "\n";
?>
