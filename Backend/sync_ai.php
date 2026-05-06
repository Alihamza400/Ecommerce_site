<?php
/**
 * AI Synchronization Script (Production Level)
 * 
 * Fetches all products from MySQL and indexes them into the Qdrant Vector DB 
 * via the Python AI Microservice.
 */

require_once 'config.php';
require_once 'ai_helper.php';

// Set higher execution time for large catalogs
set_time_limit(300);

$ai = new AIServiceHelper();
$query = "SELECT 
            p.id, 
            p.name, 
            p.description, 
            p.brand,
            COALESCE(MIN(v.price), 0) as price, 
            COALESCE(GROUP_CONCAT(c.name SEPARATOR ', '), 'General') as category 
          FROM products p
          LEFT JOIN product_variants v ON p.id = v.product_id
          LEFT JOIN product_categories pc ON p.id = pc.product_id
          LEFT JOIN categories c ON pc.category_id = c.id
          GROUP BY p.id";
$result = $con->query($query);

if (!$result) {
    die("Database error: " . $con->error);
}

$count = 0;
$errors = 0;

echo "--- Starting AI Synchronization ---\n";

while ($row = $result->fetch_assoc()) {
    echo "Processing [ID: {$row['id']}] {$row['name']}... ";
    
    // Prepare data for AI Service
    $productData = [
        "id" => (int)$row['id'],
        "name" => $row['name'],
        "description" => $row['description'],
        "brand" => $row['brand'],
        "price" => (float)$row['price'],
        "category" => $row['category'],
        "image_url" => "" 
    ];

    $response = $ai->indexProduct($productData);

    if (isset($response['status']) && $response['status'] === 'success') {
        echo "SUCCESS\n";
        $count++;
    } else {
        echo "FAILED: " . (isset($response['error']) ? $response['error'] : 'Unknown error') . "\n";
        $errors++;
    }
}

echo "------------------------------------\n";
echo "Sync Complete!\n";
echo "Successfully indexed: $count products\n";
echo "Errors: $errors\n";
echo "------------------------------------\n";
?>
