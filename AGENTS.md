# E-Commerce Platform — AI Agent Guidelines

This is a **4-tier microservices e-commerce platform** (Frontend + Backend API + Payment System + AI Service). Use this guide to understand the architecture, conventions, and how to implement features consistently.

---

## **Quick Architecture**

```
Frontend (HTML/CSS/JS) ──HTTP──> Backend API (PHP 8.3)
                                    ├─> MySQL Database
                                    ├─> Payment System (Node.js:4000)
                                    └─> AI Service (Python FastAPI:8000)
```

| Component | Tech | Purpose | Port |
|-----------|------|---------|------|
| **Frontend** | HTML5, CSS3, Vanilla JS | Static UI, no build step | Served via Apache |
| **Backend** | PHP 8.3 + MySQLi | Core business logic, auth, CRUD | Apache (localhost) |
| **PaymentSystem** | Node.js + Express 4.18 | Payment orchestration + failover routing | 4000 |
| **AIService** | FastAPI + Qdrant | Semantic search + AI assistant (Gemini) | 8000 |

---

## **Key Entry Points**

- **Frontend**: [Frontend/index.html](Frontend/index.html) — Customer catalog & portal
- **Backend Config**: [Backend/config.php](Backend/config.php) — DB, CORS, security headers
- **Authentication**: [Backend/login.php](Backend/login.php) — Session-based auth
- **Products API**: [Backend/products.php](Backend/products.php) — Fetch active products
- **Cart/Orders**: [Backend/cart.php](Backend/cart.php), [Backend/orders.php](Backend/orders.php)
- **Payments Hub**: [PaymentSystem/server.js](PaymentSystem/server.js) — Orchestrator
- **AI Assistant**: [AIService/api/routers/chat.py](AIService/api/routers/chat.py) — RAG chatbot

---

## **Setup & Run**

### **Database**
```bash
# Import schema (once)
mysql -u root < ecommerce-schema\ \(1\).sql

# Verify structure
php Backend/check_schema.php
```

### **Start All Services** (in separate terminals)
```bash
# 1. WAMP64 (automatic for Apache/PHP/MySQL)
# Access: http://localhost/Ecommerce_site/Frontend/index.html

# 2. Payment System
cd PaymentSystem
npm install
npm run dev        # Runs on localhost:4000

# 3. AI Service
cd AIService
pip install -r requirements.txt
python main.py     # Runs on localhost:8000
```

### **Environment Variables** (create `.env` files)
```
# AIService/.env
GEMINI_API_KEY=<your-key>
QDRANT_HOST=localhost
QDRANT_PORT=6333
```

---

## **Common Development Patterns**

### **Backend (PHP) — Consistent Request/Response**
```php
// 1. CORS + Session headers (always first)
require_once __DIR__ . '/config.php';           // Sets headers
require_once __DIR__ . '/security_functions.php';

// 2. Validate request method
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit();
}

// 3. Use prepared statements (prevent SQL injection)
$stmt = $con->prepare("SELECT * FROM products WHERE id = ? LIMIT 1");
$stmt->bind_param("i", $product_id);
$stmt->execute();

// 4. Always return JSON with success flag
echo json_encode([
    "success" => true,
    "message" => "...",
    "data" => $result
]);
```

### **Payment System (Node.js) — Strategy + Failover**
```javascript
// Route-based gateway selection → fallback if failed
const gateway = RoutingEngine.selectGateway(request);
const result = await FailoverManager.executeWithFailover(gateways, gateway, request);

// Unified response format
{
    success: true,
    gatewayUsed: "Stripe|JazzCash|EasyPaisa|Crypto",
    transactionId: "uuid",
    status: "pending|success|failed",
    isFailover: boolean,
    timestamp: ISO8601
}
```

### **AI Service (Python) — Semantic RAG Pattern**
```python
# 1. Generate embedding for query
query_vector = await llm_service.get_embeddings(user_message)

# 2. Search Qdrant for similar products
relevant_products = await vector_store.search_similar(query_vector, limit=3)

# 3. Build context from results
context = build_product_context(relevant_products)

# 4. LLM response with context injection
reply = await llm_service.get_chat_response(user_message, context=context)
```

### **Frontend (JS) — API Calls with Session**
```javascript
// Always include credentials for session cookies
async function fetchData(endpoint) {
    const res = await fetch(`${BASE_URL}/${endpoint}`, {
        credentials: 'include'  // Critical for session!
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    return data;
}

// Check auth on page load
async function checkSession() {
    const data = await fetchData('auth_status.php');
    if (!data.logged_in) window.location.href = '/login.html';
}
```

---

## **Authentication & Security**

**Flow**:
1. GET CSRF token from [Backend/csrf_token.php](Backend/csrf_token.php) → stored in `sessionStorage`
2. POST email + password + CSRF to [Backend/login.php](Backend/login.php)
3. Server validates, regenerates session, sets HTTPOnly cookies: `SESS-ID`, `SESS-NAME`, `SESS-ROLE`, `SESS-EMAIL`
4. Frontend verifies session with [Backend/auth_status.php](Backend/auth_status.php)
5. All subsequent requests auto-include session cookie (credentials: 'include')

**Security Rules**:
- ✅ Use prepared statements; never interpolate user input in SQL
- ✅ Always include CSRF token in POST requests
- ✅ Validate all user input (email format, string length, enum values)
- ✅ Hash passwords with PHP's `password_hash()` function
- ✅ Return generic error messages (don't leak user existence)
- ✅ Log failed login attempts; implement rate limiting (5 attempts → 15 min lockout)

---

## **Database Conventions**

**Table Naming**: `snake_case` (users, product_variants, order_items)

**Key Tables** (abbreviated):
- `users`: id, uuid, name, email, password_hash, role (customer|admin|vendor), status, created_at
- `products`: id, uuid, vendor_id, name, description, brand, status (draft|active|inactive)
- `product_variants`: id, sku, price, stock, attributes (JSON)
- `orders`: id, uuid, user_id, total_amount, status (pending|confirmed|shipped|delivered), payment_status
- `payments`: id, transaction_id, order_id, amount, status, payment_method
- `cart_items`: cart_id, product_variant_id, quantity

See [ecommerce-schema (1).sql](ecommerce-schema%20(1).sql) for complete schema with indexes.

---

## **Naming Conventions**

| Context | Style | Example |
|---------|-------|---------|
| PHP functions | snake_case | `validate_email()`, `get_product()` |
| JS functions | camelCase | `fetchProducts()`, `handleCheckout()` |
| Python functions | snake_case | `get_embeddings()`, `search_similar()` |
| Classes | PascalCase | `PaymentOrchestrator`, `LLMService`, `StripeGateway` |
| Files | snake_case | `llm_service.py`, `csrf_token.php`, `PaymentOrchestrator.js` |
| Database columns | snake_case | `product_id`, `created_at` |

---

## **Error Handling & Logging**

**Backend (PHP)**:
- Errors logged to [Backend/error_log.txt](Backend/error_log.txt)
- In development: display_errors = 1
- In production: display_errors = 0 (security)
- Return JSON with `"success": false` and `"message": "..."` for all errors

**Payment System (Node.js)**:
- Winston logger (HTTP requests + errors)
- Structured logs with requestId for tracing
- TransactionStore persists all attempts for replay/rollback

**AI Service (Python)**:
- Print to stdout (easily extensible with logging module)
- FastAPI auto-responds with 400/401/500 + detail messages

---

## **Testing & Validation**

```bash
# Schema validation
php Backend/check_schema.php

# Payment system tests
cd PaymentSystem && node test_engine.js

# AI service health check
cd AIService && python test_ai.py
```

**Syncing AI Service with new products**:
```bash
php Backend/sync_ai.php  # Required after bulk product imports
```

---

## **Known Issues & Gotchas**

1. **Session Cookies & CORS**: Credentials must be included in every fetch call (`credentials: 'include'`)
2. **CSRF Protection**: Must fetch token before any POST request
3. **Rate Limiting**: 5 failed logins → 900s lockout (check [Backend/security_functions.php](Backend/security_functions.php))
4. **Product Sync**: AI service doesn't auto-sync; manually call `sync_ai.php` after bulk imports
5. **Qdrant Dimension**: Collection must be 3072-dim (Gemini embeddings); auto-created on AIService startup
6. **CORS Configuration**: Currently allows all origins (`*`); restrict to known domains in production
7. **Error Logging**: PHP display_errors must be off in production; monitor [Backend/error_log.txt](Backend/error_log.txt)

---

## **Implementation Checklist**

When adding a new feature, follow this pattern:

- [ ] **Define DB schema**: Add table/columns to [ecommerce-schema (1).sql](ecommerce-schema%20(1).sql)
- [ ] **Backend endpoint**: Create `.php` file in [Backend/](Backend/) following CORS + prepared statement patterns
- [ ] **Frontend handler**: Add JS function in [Frontend/js/](Frontend/js/) with error handling + session check
- [ ] **Test flow**: Verify end-to-end with browser dev tools + [Backend/error_log.txt](Backend/error_log.txt)
- [ ] **Security review**: Validate input, use prepared statements, check CSRF token
- [ ] **AI integration** (if needed): Index products via [Backend/sync_ai.php](Backend/sync_ai.php)

---

## **Useful Files by Task**

| Task | File |
|------|------|
| Debug API response | [Backend/error_log.txt](Backend/error_log.txt) |
| Check active products | [Backend/products.php](Backend/products.php) |
| Fix session issues | [Backend/config.php](Backend/config.php) → CORS/SameSite settings |
| Add payment gateway | [PaymentSystem/gateways/](PaymentSystem/gateways/) → extend BaseGateway |
| Tune AI search | [AIService/services/vector_store.py](AIService/services/vector_store.py) → search_similar() |
| View all endpoints | [Backend/](Backend/) → list all `.php` files |
| Admin dashboard | [Frontend/admin/dashboard.html](Frontend/admin/dashboard.html) → see all admin JS files |
| Email config | [Backend/mail_config.php](Backend/mail_config.php) + [Backend/mail_helper.php](Backend/mail_helper.php) |

---

## **Architecture Decision Log**

- **Session-based auth** (not JWT): Simpler for server-side validation; HTTPOnly cookies prevent XSS
- **PHP procedural** (not OOP framework): Fast prototyping; direct DB queries with parameterized prep statements
- **Vanilla JS** (not React/Vue): Minimal dependencies; works without build step
- **Node.js Payment Layer**: Isolates payment logic; enables multi-gateway failover + retry strategy
- **Python AI Service**: Leverages FastAPI + Qdrant for semantic search; Gemini API for embeddings
- **MySQL 8.4**: Standard relational DB; UTF8MB4 encoding for international text

---

## **Quick Wins for New Contributors**

1. **Add a product field**: Update schema → add column to [Backend/products.php](Backend/products.php) SELECT → expose in frontend
2. **Fix a JavaScript bug**: Check [Frontend/js/](Frontend/js/) for the handler → validate CORS/credentials setup in fetch call
3. **Debug payment failure**: Check [PaymentSystem/logs/](PaymentSystem/logs/) + FailoverManager routing logic
4. **Improve AI search**: Tune prompt in [AIService/services/llm_service.py](AIService/services/llm_service.py)

---

**Last Updated**: May 6, 2026  
**Architecture**: 4-tier microservices | **Key Tech**: PHP 8.3 + Node.js + FastAPI + MySQL 8.4
