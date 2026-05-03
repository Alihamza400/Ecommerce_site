<?php
require_once 'c:/wamp64/www/Ecommerce_site/Backend/config.php';
require_once 'c:/wamp64/www/Ecommerce_site/Backend/security_functions.php';

if (isset($_GET['set'])) {
    $_SESSION['test_val'] = 'hello_world';
    echo "Session value set. Session ID: " . session_id();
} elseif (isset($_GET['check'])) {
    echo "Session value: " . ($_SESSION['test_val'] ?? 'NOT SET') . ". Session ID: " . session_id();
} else {
    echo "Use ?set or ?check. Current Session ID: " . session_id();
}
?>
