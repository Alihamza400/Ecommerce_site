<?php
/**
 * oauth/callback.php
 * Handles the redirect back from Google.
 */
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../security_functions.php';
require_once __DIR__ . '/config.php';

// ── 1. Validate State (CSRF Protection) ──────────────────────
$state = $_GET['state'] ?? '';
$saved_state = $_SESSION['oauth_state'] ?? '';

if (!$state || $state !== $saved_state) {
    if (empty($saved_state)) {
        die("Invalid state: Session is empty. (Check if you are using 'localhost' vs '127.0.0.1')");
    }
    die("Invalid state: Tokens do not match. (Possible CSRF or session overwrite)");
}
unset($_SESSION['oauth_state']);

// ── 2. Handle Errors ──────────────────────────────────────────
if (isset($_GET['error'])) {
    header("Location: ../../Frontend/login.html?error=" . urlencode($_GET['error']));
    exit();
}

$code = $_GET['code'] ?? '';
if (!$code) {
    die("No authorization code provided.");
}

// ── 3. Exchange Code for Access Token ────────────────────────
$ch = curl_init(GOOGLE_TOKEN_URL);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
    'code'          => $code,
    'client_id'     => GOOGLE_CLIENT_ID,
    'client_secret' => GOOGLE_CLIENT_SECRET,
    'redirect_uri'  => GOOGLE_REDIRECT_URI,
    'grant_type'    => 'authorization_code'
]));

// Bypass SSL verification for local WAMP environments
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

$response = curl_exec($ch);
$err = curl_error($ch);
$token_data = json_decode($response, true);

if ($response === false) {
    error_log("cURL Error in Token Exchange: " . $err);
    die("cURL Network Error: " . $err);
}
curl_close($ch);

if (!isset($token_data['access_token'])) {
    error_log("OAuth Token Exchange Error. Response: " . $response);
    die("Failed to obtain access token. Google says: " . ($token_data['error_description'] ?? 'Unknown Error'));
}

// ── 4. Fetch User Profile Info ──────────────────────────────
$ch = curl_init(GOOGLE_USERINFO_URL);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer ' . $token_data['access_token']
]);

// Bypass SSL verification for local WAMP environments
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

$user_info_raw = curl_exec($ch);
$user_info_err = curl_error($ch);
$user_info = json_decode($user_info_raw, true);

if ($user_info_raw === false) {
    error_log("cURL Error in UserInfo Fetch: " . $user_info_err);
    die("cURL Network Error: " . $user_info_err);
}
curl_close($ch);

if (!isset($user_info['email'])) {
    error_log("OAuth UserInfo Error: " . $user_info_raw);
    die("Failed to fetch user information.");
}

// ── 5. Database Integration (Find or Create User) ───────────
$email = $user_info['email'];
$name  = $user_info['name'] ?? 'Google User';
$google_id = $user_info['sub']; // Unique Google ID

// Check if user exists by google_id OR email
$stmt = $con->prepare("SELECT id, name, email, role, status FROM users WHERE google_id = ? OR email = ? LIMIT 1");
$stmt->bind_param("ss", $google_id, $email);
$stmt->execute();
$result = $stmt->get_result();
$user = $result->fetch_assoc();
$stmt->close();

if (!$user) {
    // Create new user
    $uuid = generate_uuid();
    $temp_pass = bin2hex(random_bytes(16)); // Random password for OAuth users
    $hashed = password_hash($temp_pass, PASSWORD_BCRYPT);
    $role = 'customer';
    $status = 'active';

    $stmt = $con->prepare("INSERT INTO users (uuid, name, google_id, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)");
    $stmt->bind_param("sssssss", $uuid, $name, $google_id, $email, $hashed, $role, $status);
    
    if ($stmt->execute()) {
        $user_id = $stmt->insert_id;
        $user = [
            'id' => $user_id,
            'name' => $name,
            'email' => $email,
            'role' => $role,
            'status' => $status
        ];
    } else {
        error_log("OAuth User Creation Error: " . $con->error);
        die("Error creating local account.");
    }
    $stmt->close();
}

// ── 6. Initialize Session ───────────────────────────────────
if ($user['status'] === 'blocked') {
    header("Location: ../../Frontend/login.html?error=account_blocked");
    exit();
}

session_regenerate_id(true);
$_SESSION['SESS-ID']    = $user['id'];
$_SESSION['SESS-EMAIL'] = $user['email'];
$_SESSION['SESS-NAME']  = $user['name'];
$_SESSION['SESS-ROLE']  = $user['role'];
$_SESSION['SESS-STATUS']= $user['status'];
session_write_close();

// ── 7. Redirect to Dashboard ────────────────────────────────
$redirect = ($user['role'] === 'admin') ? 'admin/dashboard.html' : 'profile.html';
header("Location: ../../Frontend/" . $redirect);
exit();
?>
