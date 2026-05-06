<?php
require_once 'config.php';
if ($con->query("ALTER TABLE products ADD COLUMN main_image VARCHAR(255) DEFAULT NULL AFTER brand")) {
    echo "Successfully added main_image column.";
} else {
    echo "Error: " . $con->error;
}

if ($con->query("ALTER TABLE users ADD COLUMN google_id VARCHAR(255) UNIQUE DEFAULT NULL AFTER phone")) {
    echo "Successfully added google_id column.";
} else {
    echo "Error adding google_id: " . $con->error;
}

if ($con->query("
    CREATE TABLE IF NOT EXISTS login_attempts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255),
        ip_address VARCHAR(45),
        attempt_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_email (email),
        INDEX idx_ip (ip_address),
        INDEX idx_time (attempt_time)
    )
")) {
    echo "Successfully created login_attempts table.";
} else {
    echo "Error creating login_attempts: " . $con->error;
}
?>
