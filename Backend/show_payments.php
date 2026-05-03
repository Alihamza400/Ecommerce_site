<?php
require_once 'config.php';
$r = $con->query('SELECT payment_method, COUNT(*) as txns, SUM(amount) as revenue FROM payments GROUP BY payment_method ORDER BY revenue DESC');
echo str_pad('GATEWAY', 15) . str_pad('TXNS', 8) . "REVENUE\n";
echo str_repeat('-', 35) . "\n";
while ($row = $r->fetch_assoc()) {
    echo str_pad($row['payment_method'], 15) . str_pad($row['txns'], 8) . '$' . number_format($row['revenue'], 2) . "\n";
}
$tot = $con->query('SELECT COUNT(*) as t, SUM(amount) as s FROM payments WHERE status="success"')->fetch_assoc();
echo str_repeat('-', 35) . "\n";
echo str_pad('TOTAL', 15) . str_pad($tot['t'], 8) . '$' . number_format($tot['s'], 2) . "\n";
?>
