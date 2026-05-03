<?php
require_once 'c:/wamp64/www/Ecommerce_site/Backend/config.php';
$sql = "CREATE TABLE IF NOT EXISTS password_resets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    token VARCHAR(255) NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX(token),
    INDEX(email)
)";
if ($con->query($sql)) {
    echo "Table 'password_resets' created successfully.\n";
} else {
    echo "Error creating table: " . $con->error . "\n";
}
?>
