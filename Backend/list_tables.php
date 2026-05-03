<?php
require_once 'config.php';
$res = $con->query('SHOW TABLES');
while($row = $res->fetch_row()) {
    echo $row[0] . PHP_EOL;
}
?>
