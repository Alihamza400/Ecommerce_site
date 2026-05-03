<?php
declare(strict_types=1);

/**
 * security_functions.php
 * Core security utilities for CSRF, Rate Limiting, and Cryptography.
 */

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

/**
 * Generate and store a CSRF token in the session if it doesn't exist.
 */
function generate_csrf_token(): string {
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

/**
 * Verify the CSRF token from the request.
 */
function verify_csrf_token(?string $token): bool {
    if (!$token || empty($_SESSION['csrf_token'])) {
        return false;
    }
    return hash_equals($_SESSION['csrf_token'], $token);
}

/**
 * Securely generate a Version 4 UUID.
 */
function generate_uuid(): string {
    $data = random_bytes(16);
    $data[6] = chr(ord($data[6]) & 0x0f | 0x40); // set version to 0100
    $data[8] = chr(ord($data[8]) & 0x3f | 0x80); // set bits 6-7 to 10
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

/**
 * Check if the current user/IP is rate limited.
 */
function is_rate_limited(mysqli $con, string $email): bool {
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $lockout_time = LOCKOUT_TIME;
    $max_attempts = MAX_LOGIN_ATTEMPTS;

    $stmt = $con->prepare("
        SELECT COUNT(*) 
        FROM login_attempts 
        WHERE (email = ? OR ip_address = ?) 
        AND attempt_time > (NOW() - INTERVAL ? SECOND)
    ");
    $stmt->bind_param("ssi", $email, $ip, $lockout_time);
    $stmt->execute();
    $result = $stmt->get_result();
    $count = (int) $result->fetch_row()[0];
    $stmt->close();

    return $count >= $max_attempts;
}

/**
 * Record a login attempt.
 */
function record_login_attempt(mysqli $con, string $email): void {
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $stmt = $con->prepare("INSERT INTO login_attempts (email, ip_address) VALUES (?, ?)");
    $stmt->bind_param("ss", $email, $ip);
    $stmt->execute();
    $stmt->close();
}

/**
 * Clear login attempts for an email after successful login.
 */
function clear_login_attempts(mysqli $con, string $email): void {
    $stmt = $con->prepare("DELETE FROM login_attempts WHERE email = ?");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $stmt->close();
}

/**
 * Sanitize output to prevent XSS.
 */
function h(?string $content): string {
    return htmlspecialchars($content ?? '', ENT_QUOTES, 'UTF-8');
}
?>
