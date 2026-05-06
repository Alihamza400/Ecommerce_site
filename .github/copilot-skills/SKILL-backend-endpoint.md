# Skill: Implement Backend API Endpoints

## Purpose
Automate the implementation of new PHP API endpoints in the Backend service, following security best practices and the project's conventions.

## When to Use
- Adding new REST endpoints (GET, POST, PUT, DELETE)
- Modifying existing endpoints
- Integrating with database (CRUD operations)
- Adding business logic that touches the backend

## Pattern Template

All Backend endpoints follow this structure:

```php
<?php
// File: Backend/<endpoint_name>.php

// 1. CORS + Security Headers + Session Start (ALWAYS FIRST)
require_once __DIR__ . '/config.php';           // Sets CORS headers, session headers, DB connection
require_once __DIR__ . '/security_functions.php'; // Rate limiting, CSRF validation

// 2. Validate Request Method
$method = $_SERVER['REQUEST_METHOD'];
if ($method !== 'POST' && $method !== 'GET') {
    http_response_code(405);
    die(json_encode(['success' => false, 'message' => 'Method not allowed']));
}

// 3. Parse Input (GET, POST, or JSON body)
if ($method === 'POST' && $_SERVER['CONTENT_TYPE'] === 'application/json') {
    $input = json_decode(file_get_contents('php://input'), true);
    $param = $input['param'] ?? null;
} else {
    $param = $_GET['param'] ?? null;
}

// 4. Validate Input (CRITICAL FOR SECURITY)
if (empty($param) || !is_string($param)) {
    http_response_code(400);
    die(json_encode(['success' => false, 'message' => 'Invalid input']));
}

// 5. Check Authentication (if needed)
session_start();
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    die(json_encode(['success' => false, 'message' => 'Unauthorized']));
}

// 6. Rate Limiting (for login, password reset, etc.)
$ip_address = isset($_SERVER['HTTP_CF_CONNECTING_IP']) ? $_SERVER['HTTP_CF_CONNECTING_IP'] : $_SERVER['REMOTE_ADDR'];
if ($method === 'POST' && !check_rate_limit($ip_address, $_SESSION['email'], 5, 900)) {
    http_response_code(429);
    die(json_encode(['success' => false, 'message' => 'Too many requests. Try again later.']));
}

// 7. Query Database with PREPARED STATEMENTS (NEVER interpolate user input)
$stmt = $con->prepare("SELECT id, name, email FROM users WHERE id = ? LIMIT 1");
if (!$stmt) {
    error_log("DB Prepare Error: " . $con->error);
    http_response_code(500);
    die(json_encode(['success' => false, 'message' => 'Database error']));
}
$stmt->bind_param("i", $_SESSION['user_id']);
$stmt->execute();
$result = $stmt->get_result();
$row = $result->fetch_assoc();

// 8. Business Logic (validation, transformations, side effects)
if (!$row) {
    http_response_code(404);
    die(json_encode(['success' => false, 'message' => 'User not found']));
}

// 9. Return JSON Response with Success Flag
echo json_encode([
    'success' => true,
    'message' => 'Operation successful',
    'data' => [
        'id' => $row['id'],
        'name' => $row['name'],
        'email' => $row['email']
    ]
]);
?>
```

## Security Checklist

- [ ] **Prepared Statements**: All SQL queries use `$stmt->bind_param()` — NEVER interpolate `$_GET` or `$_POST` into queries
- [ ] **Input Validation**: Check `empty()`, type (`is_string()`, `is_int()`), length, allowed values (enum)
- [ ] **Authentication**: Session check with `isset($_SESSION['user_id'])` for protected endpoints
- [ ] **CSRF Token**: For POST requests that modify state (handled in [Backend/security_functions.php](Backend/security_functions.php))
- [ ] **Error Responses**: Generic messages like "Invalid input" or "Database error" — never expose DB structure/errors
- [ ] **Logging**: Log errors to [Backend/error_log.txt](Backend/error_log.txt) for debugging
- [ ] **CORS Headers**: Already set in [Backend/config.php](Backend/config.php) — no need to repeat
- [ ] **HTTP Status Codes**: Use 200 (success), 400 (bad input), 401 (not auth), 403 (forbidden), 404 (not found), 500 (server error)

## Response Format (Standard Across All Endpoints)

**Success (HTTP 200)**:
```json
{
    "success": true,
    "message": "Descriptive success message",
    "data": { /* optional */ }
}
```

**Error (HTTP 400–500)**:
```json
{
    "success": false,
    "message": "Descriptive error message (no sensitive info)"
}
```

## Common Patterns

### GET Endpoint (List/Fetch)
```php
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    exit();
}

// Optional pagination
$limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 20;
$offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;

$stmt = $con->prepare("SELECT id, name, price FROM products WHERE status = 'active' LIMIT ? OFFSET ?");
$stmt->bind_param("ii", $limit, $offset);
$stmt->execute();
$result = $stmt->get_result();
$products = $result->fetch_all(MYSQLI_ASSOC);

echo json_encode(['success' => true, 'products' => $products]);
```

### POST Endpoint (Create/Update)
```php
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit();
}

// Parse JSON body
$input = json_decode(file_get_contents('php://input'), true);
$name = $input['name'] ?? null;
$email = $input['email'] ?? null;

// Validate
if (empty($name) || empty($email)) {
    http_response_code(400);
    die(json_encode(['success' => false, 'message' => 'Name and email required']));
}

// Insert
$stmt = $con->prepare("INSERT INTO users (name, email) VALUES (?, ?)");
$stmt->bind_param("ss", $name, $email);
if (!$stmt->execute()) {
    error_log("Insert error: " . $stmt->error);
    http_response_code(500);
    die(json_encode(['success' => false, 'message' => 'Failed to create user']));
}

echo json_encode(['success' => true, 'message' => 'User created', 'data' => ['id' => $con->insert_id]]);
```

### DELETE Endpoint (Hard Delete)
```php
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { // Safety: use POST for destructive ops
    http_response_code(405);
    exit();
}

$input = json_decode(file_get_contents('php://input'), true);
$id = $input['id'] ?? null;

if (empty($id) || !is_int($id)) {
    http_response_code(400);
    die(json_encode(['success' => false, 'message' => 'Invalid ID']));
}

// Check permission (optional: only owner can delete)
$stmt = $con->prepare("SELECT user_id FROM orders WHERE id = ?");
$stmt->bind_param("i", $id);
$stmt->execute();
$row = $stmt->get_result()->fetch_assoc();
if ($row['user_id'] !== $_SESSION['user_id']) {
    http_response_code(403);
    die(json_encode(['success' => false, 'message' => 'Forbidden']));
}

// Delete
$stmt = $con->prepare("DELETE FROM orders WHERE id = ?");
$stmt->bind_param("i", $id);
$stmt->execute();

echo json_encode(['success' => true, 'message' => 'Order deleted']);
```

## Testing

### cURL (Local Testing)
```bash
# GET request
curl -X GET "http://localhost/Ecommerce_site/Backend/products.php?limit=10" \
  -H "Content-Type: application/json" \
  -b "PHPSESSID=<session_id>"

# POST request
curl -X POST "http://localhost/Ecommerce_site/Backend/orders.php" \
  -H "Content-Type: application/json" \
  -d '{"product_id": 1, "quantity": 2}' \
  -b "PHPSESSID=<session_id>"
```

### Browser DevTools
1. Open Network tab
2. Call endpoint via `fetch()` in Console
3. Check Response tab for JSON output
4. Verify HTTP status code (200 for success)

### Check Logs
```bash
tail -f Backend/error_log.txt  # Monitor PHP errors in real-time
```

## Common Mistakes to Avoid

❌ **Never do this**:
```php
// SQL Injection vulnerability!
$result = $con->query("SELECT * FROM users WHERE email = '" . $_GET['email'] . "'");

// Hardcoded credentials
$password = 'hardcoded123';

// Empty validation
if ($param) { ... }  // What if $param = "0"? Use empty() or ===

// Sensitive error exposure
die("Database error: " . $con->error);  // Exposes structure!
```

✅ **Do this instead**:
```php
// Prepared statement (safe!)
$stmt = $con->prepare("SELECT * FROM users WHERE email = ?");
$stmt->bind_param("s", $_GET['email']);
$stmt->execute();

// Use hashed passwords
$hashed = password_hash($input_password, PASSWORD_BCRYPT);

// Proper validation
if (empty($param)) { ... }  // Catches "0", "", null, false

// Generic error messages
error_log("Database error: " . $con->error);  // Log to file
die(json_encode(['success' => false, 'message' => 'Database error']));
```

## Reference Files

- **Base config**: [Backend/config.php](Backend/config.php) — CORS, DB connection, session setup
- **Security helpers**: [Backend/security_functions.php](Backend/security_functions.php) — rate limiting, CSRF
- **Example GET**: [Backend/products.php](Backend/products.php) — fetch active products
- **Example POST**: [Backend/login.php](Backend/login.php) — authentication with validation
- **Example DELETE**: [Backend/orders.php](Backend/orders.php) — order deletion with permission check
- **Error log**: [Backend/error_log.txt](Backend/error_log.txt) — debug PHP errors

## Invocation

This skill is invoked when:
- User asks to "create a new endpoint" or "add a POST endpoint"
- User asks to "fix API response" or "add validation"
- User asks to implement CRUD operations in the Backend
