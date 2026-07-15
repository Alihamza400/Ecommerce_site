# ✦ ShopVerse — AI-Powered E-Commerce Platform

A **4-tier microservices e-commerce platform** with AI-powered search, multi-gateway payments (including crypto), real-time blockchain monitoring, and a professional vendor management system.

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Apache :80)                     │
│         HTML5 · CSS3 · Vanilla JS · Phosphor Icons          │
│         AI Assistant · 3D Animations · Responsive           │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP / JSON
┌────────────────────▼────────────────────────────────────────┐
│                    BACKEND API (PHP 8.3)                     │
│         Auth · CRUD · CSRF · Rate Limiting · Sessions        │
│         MySQLi · Prepared Statements · File Cache            │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP / WebSocket
          ┌──────────┴──────────┐
          │                     │
┌─────────▼─────────┐  ┌───────▼──────────┐
│  PAYMENT SYSTEM   │  │   AI SERVICE      │
│   (Node.js :4000) │  │ (FastAPI :8000)   │
│                   │  │                   │
│  · Stripe Gateway │  │  · RAG Chatbot    │
│  · JazzCash       │  │  · Semantic Search│
│  · EasyPaisa      │  │  · Image Search   │
│  · Crypto (BSC)   │  │  · AI Descriptions│
│  · Failover       │  │  · Voice Search   │
│  · Refunds        │  │  · Qdrant Vector  │
└─────────┬─────────┘  └───────┬───────────┘
          │                    │
┌─────────▼────────────────────▼──────────────────────────────┐
│                DATA LAYER                                    │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│  │  MySQL 8.4 │  │   Redis 7  │  │  Qdrant    │            │
│  │ (Docker)   │  │  (Docker)  │  │ (Docker)   │            │
│  │ · 19 Tables│  │ · Cache    │  │ · Vectors  │            │
│  │ · ACID TX  │  │ · Sessions │  │ · 1536 dim │            │
│  └────────────┘  └────────────┘  └────────────┘            │
└─────────────────────────────────────────────────────────────┘
```

---

## ✨ Features

### 🛍️ Customer
- **AI-Powered Search** — Text, voice, and image search with semantic matching
- **3D Product Cards** — Aceternity-style animated product display
- **Smart Cart** — Real-time stock validation, quantity management
- **Multi-currency Checkout** — PKR, USD, GBP, AED, USDT
- **Reviews & Ratings** — Star ratings with purchase verification
- **Wishlist** — Save products for later
- **Coupon System** — Percentage & fixed discounts with validation
- **Order History** — Track orders with PDF invoice download
- **Crypto Payments** — USDT (BEP-20) with real blockchain verification

### 👑 Admin
- **Dashboard** — Real-time stats (revenue, orders, users, vendors)
- **Order Management** — Full CRUD with status tracking
- **Vendor Management** — Approve, suspend, revoke, delete
- **Product Management** — View, delete any product
- **User Management** — Block/unblock customers
- **Payment Records** — Gateway breakdown with revenue analytics

### 🏪 Vendor
- **Product CRUD** — Create/edit/delete products with image upload
- **AI Description Generator** — Auto-generate SEO product descriptions
- **Inventory Management** — Track stock levels per product

### 🤖 AI Features
- **RAG Chatbot** — Context-aware product recommendations via OpenRouter
- **Semantic Search** — Vector similarity search via Qdrant
- **Image Search** — Upload a photo → AI describes → finds similar products
- **Voice Search** — Web Speech API → AI search
- **AI Product Descriptions** — SEO-optimized generation for vendors

### 💳 Payment Gateways
| Gateway | Type | Status |
|---------|------|--------|
| **Stripe** | Credit Card | ✅ Integrated |
| **JazzCash** | Mobile Wallet | ✅ Integrated |
| **EasyPaisa** | Mobile Wallet | ✅ Integrated |
| **Crypto (USDT/BEP-20)** | Blockchain | ✅ Live (BSCScan + Ganache) |

### Crypto Payment Flow
```
Customer selects Crypto → Gets wallet address + QR code
→ Sends USDT (BEP-20) from MetaMask
→ BSCScan API detects transaction
→ Payment auto-confirmed → Order status updated
→ Ganache test mode available for development
```

---

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- PHP 8.3+ (with MySQLi)
- Node.js 18+
- Python 3.12+

### 1. Clone & Setup
```bash
git clone https://github.com/yourusername/Ecommerce_site.git
cd Ecommerce_site
cp .env.example .env   # Configure your environment variables
```

### 2. Start Infrastructure
```bash
docker compose up -d   # Starts MySQL + Redis + Qdrant
```

### 3. Install Dependencies
```bash
# PHP (Composer)
cd Backend && composer install

# Node.js Payment System
cd PaymentSystem && npm install

# Python AI Service
cd AIService && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt
```

### 4. Database Setup
```bash
mysql -u root -p < ecommerce-schema.sql
```

### 5. Start Services
```bash
# Terminal 1: PHP (Apache handles this)
# Terminal 2: Payment System
cd PaymentSystem && node server.js

# Terminal 3: AI Service  
cd AIService && source venv/bin/activate && python main.py
```

### 6. Access
- **Store**: `http://localhost/Ecommerce_site/Frontend/index.html`
- **Admin**: Login as `raialihamza58@gmail.com` / `R@i123ali`
- **Vendor**: Apply via store → admin approves
- **phpMyAdmin**: `http://localhost/phpmyadmin`
- **AI API**: `http://localhost:8000/docs`
- **Payment API**: `http://localhost:4000/health`

---

## 🗄️ Database Schema (19 Tables)

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `users` | Customers, vendors, admins | `id`, `email`, `role`, `password_hash` |
| `vendors` | Vendor applications & profiles | `id`, `store_name`, `commission_rate`, `status` |
| `products` | Product catalog | `id`, `name`, `slug`, `status`, `metadata` (JSON) |
| `product_variants` | SKU-level pricing & inventory | `id`, `sku`, `price`, `stock`, `attributes` (JSON) |
| `categories` | Hierarchical categories | `id`, `name`, `slug`, `parent_id` |
| `orders` | Customer orders | `id`, `total_amount`, `discount_amount`, `status` |
| `order_items` | Line items per order | `id`, `price`, `quantity`, `line_total` |
| `payments` | Payment records | `id`, `transaction_id`, `amount`, `gateway_payload` (JSON) |
| `carts` | Shopping carts | `id`, `user_id` |
| `cart_items` | Items in carts | `id`, `quantity` |
| `reviews` | Product ratings | `id`, `rating`, `comment`, `status` |
| `wishlists` | Saved products | `id`, `user_id`, `product_id` |
| `coupons` | Discount codes | `id`, `code`, `discount_type`, `discount_value` |
| `reviews` | Product reviews | `id`, `rating`, `comment`, `status` |
| `shipments` | Order tracking | `id`, `tracking_number`, `carrier`, `status` |
| `user_addresses` | Saved addresses | `id`, `address_line`, `city`, `country` |
| `password_resets` | Token-based resets | `id`, `email`, `token`, `expires_at` |
| `login_attempts` | Rate limiting | `id`, `email`, `ip_address`, `attempted_at` |
| `audit_logs` | Compliance audit | `id`, `actor_user_id`, `action`, `before/after_data` (JSON) |
| `payment_webhook_events` | Webhook idempotency | `id`, `event_id`, `payload` (JSON), `status` |

---

## 🔧 Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Frontend** | HTML5, CSS3, Vanilla JS | — |
| **Backend** | PHP (procedural) | 8.3 |
| **Database** | MySQL | 8.4 |
| **Payment System** | Node.js, Express | 4.18 |
| **AI Service** | Python, FastAPI | Latest |
| **Vector DB** | Qdrant | 1.18 |
| **Cache** | Redis + File Fallback | 7 |
| **Containers** | Docker | Latest |
| **Blockchain** | BSC (BEP-20) + Ganache | — |
| **AI** | OpenRouter (GPT-4o-mini) | — |

---

## 🔐 Security Features

- ✅ **CSRF Protection** — Token-based on all state-changing requests
- ✅ **Rate Limiting** — 5 failed logins → 15-min lockout
- ✅ **SQL Injection Prevention** — Prepared statements throughout
- ✅ **XSS Protection** — Input sanitization + output escaping
- ✅ **Session Security** — HTTP-only cookies, SameSite=Lax
- ✅ **Password Hashing** — bcrypt (cost 12)
- ✅ **CORS Whitelist** — Origin validation
- ✅ **Input Validation** — Email format, password strength, file type
- ✅ **Stock Atomicity** — `SELECT ... FOR UPDATE` + transactions
- ✅ **Coupon Server Validation** — Client-side discount not trusted

---

## 📁 Project Structure

```
Ecommerce_site/
├── Frontend/              # Customer & Admin UI
│   ├── index.html         # Main store (product grid)
│   ├── login.html         # Authentication
│   ├── cart.html          # Shopping cart
│   ├── checkout.html      # Payment checkout
│   ├── vendor/            # Vendor dashboard
│   ├── admin/             # Admin panel (6 pages)
│   ├── js/                # JavaScript (12 files)
│   └── css/               # Styles + Animations
├── Backend/               # PHP API (34 endpoints)
│   ├── config.php         # DB connection + env loader
│   ├── products.php       # Product listing (cached)
│   ├── cart.php           # Cart CRUD + stock lock
│   ├── orders.php         # Checkout + history
│   ├── reviews.php        # Reviews with purchase check
│   ├── admin/             # Admin endpoints
│   └── oauth/             # Google OAuth 2.0
├── PaymentSystem/         # Node.js Payment Orchestrator
│   ├── server.js          # Express server on :4000
│   ├── gateways/          # Stripe, JazzCash, EasyPaisa
│   ├── crypto/            # Crypto + BSCScan service
│   ├── orchestrator/      # Payment routing + failover
│   └── webhooks/          # Webhook handlers
├── AIService/             # Python AI Service
│   ├── main.py            # FastAPI on :8000
│   ├── services/          # LLM + Vector store
│   ├── api/routers/       # Chat, Search, Assistant
│   └── models/            # Pydantic schemas
└── .github/workflows/     # CI/CD Pipeline
```

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

MIT License — See LICENSE file for details.

---

## 🙏 Acknowledgments

- Aceternity UI for animation inspiration
- OpenRouter for AI API access
- Phosphor Icons for the icon set
- BSCScan for blockchain data
