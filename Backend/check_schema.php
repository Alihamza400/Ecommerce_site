<?php
require_once 'config.php';
$res = $con->query('DESCRIBE products');
while($row = $res->fetch_assoc()) {
    echo $row['Field'] . ' (' . $row['Type'] . ')' . PHP_EOL;
}
?>
