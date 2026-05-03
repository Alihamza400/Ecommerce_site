<?php
/**
 * oauth/config.php
 * Configuration for OAuth2 Providers.
 */

define('GOOGLE_CLIENT_ID', 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com');
define('GOOGLE_CLIENT_SECRET', 'YOUR_GOOGLE_CLIENT_SECRET');
define('GOOGLE_REDIRECT_URI', 'http://localhost/Ecommerce_site/Backend/oauth/callback.php');

// Endpoints
define('GOOGLE_AUTH_URL', 'https://accounts.google.com/o/oauth2/v2/auth');
define('GOOGLE_TOKEN_URL', 'https://oauth2.googleapis.com/token');
define('GOOGLE_USERINFO_URL', 'https://www.googleapis.com/oauth2/v3/userinfo');

/**
 * Utility to check if OAuth is configured.
 */
function is_google_oauth_ready(): bool {
    return GOOGLE_CLIENT_ID !== 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com' 
           && GOOGLE_CLIENT_SECRET !== 'YOUR_GOOGLE_CLIENT_SECRET';
}
?>
