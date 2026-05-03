<?php
require_once 'config.php';
if ($con->query("ALTER TABLE products ADD COLUMN main_image VARCHAR(255) DEFAULT NULL AFTER brand")) {
    echo "Successfully added main_image column.";
} else {
    echo "Error: " . $con->error;
}
?>
