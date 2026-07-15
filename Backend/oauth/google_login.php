<?php
/**
 * oauth/google_login.php
 * Initiates the Google OAuth2 flow.
 */
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../security_functions.php';
require_once __DIR__ . '/config.php';

$LOGIN_PAGE = "../../Frontend/login.html";

if (!is_google_oauth_ready()) {
    header("Location: $LOGIN_PAGE?error=oauth_not_configured");
    exit();
}

// 1. Generate a secure state token for CSRF protection
$state = bin2hex(random_bytes(16));
$_SESSION['oauth_state'] = $state;
session_write_close();

// 2. Build the authorization URL
$params = [
    'client_id'     => GOOGLE_CLIENT_ID,
    'redirect_uri'  => GOOGLE_REDIRECT_URI,
    'response_type' => 'code',
    'scope'         => 'openid email profile',
    'state'         => $state,
    'prompt'        => 'select_account'
];

$auth_url = GOOGLE_AUTH_URL . '?' . http_build_query($params);

// 3. Redirect the user
header('Location: ' . $auth_url);
exit();
?>
