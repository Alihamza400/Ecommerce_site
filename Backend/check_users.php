<?php
require_once 'config.php';
$r = $con->query('SELECT name, email, role FROM users');
while($row = $r->fetch_assoc()) {
    echo $row['name'] . ' (' . $row['email'] . '): ' . $row['role'] . PHP_EOL;
}
?>
