<?php
// ============================================================
// mail_config.php — Centralized Email Settings
// Uses environment variables with hardcoded fallback
// ============================================================

define('SMTP_HOST', getenv('SMTP_HOST') ?: 'smtp.gmail.com');
define('SMTP_PORT', (int)(getenv('SMTP_PORT') ?: 587));
define('SMTP_USER', getenv('SMTP_USER') ?: 'raialihamza58@gmail.com');
define('SMTP_PASS', getenv('SMTP_PASS') ?: 'fnujbdgcpqdghaww');
define('SMTP_FROM', getenv('SMTP_FROM') ?: 'raialihamza58@gmail.com');
define('SMTP_FROM_NAME', getenv('SMTP_FROM_NAME') ?: 'ShopVerse Security');
?>
