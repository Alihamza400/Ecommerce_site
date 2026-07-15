<?php
session_start();
$_SESSION = [];
session_regenerate_id(true);
session_unset();
session_destroy();
header("location: ../Frontend/login.html");
exit();
