<?php
require_once 'c:/wamp64/www/Ecommerce_site/Backend/config.php';
$res = $con->query("SELECT id, name, main_image FROM products");
while($row = $res->fetch_assoc()) {
    echo "ID: {$row['id']}, Name: {$row['name']}, Image: {$row['main_image']}\n";
}
?>
