#!/bin/bash
set -e

APP_DIR="${APP_DIR:-$(pwd)}"
DB_USER=${DB_USERNAME:-alihamza}
DB_PASS=${DB_PASSWORD:-R@i123ali}
DB_NAME=${DB_DATABASE:-Ecommerce_site}
ROOT_PASS=${MYSQL_ROOT_PASSWORD:-rootpassword}
MYSQL_DATA=/var/lib/mysql
SCHEMA_FILE="$APP_DIR/schema.sql"
QDRANT_DATA=/var/lib/qdrant/storage
SETUP_MARKER="$APP_DIR/.setup_done"

# ── First-run setup (install project dependencies) ───────────
if [ ! -f "$SETUP_MARKER" ]; then
    echo "→ First run — installing project dependencies..."

    if command -v composer &> /dev/null; then
        echo "  → PHP dependencies..."
        composer install --working-dir="$APP_DIR/Backend" --no-dev --no-interaction 2>/dev/null || true
    fi

    if command -v npm &> /dev/null; then
        echo "  → Node.js dependencies..."
        npm install --prefix "$APP_DIR/PaymentSystem" --production 2>/dev/null || true
    fi

    if command -v pip3 &> /dev/null || command -v pip &> /dev/null; then
        echo "  → Python dependencies..."
        PIP=$(command -v pip3 || command -v pip)
        $PIP install -r "$APP_DIR/AIService/requirements.txt" --break-system-packages 2>/dev/null || \
        $PIP install -r "$APP_DIR/AIService/requirements.txt" 2>/dev/null || true
    fi

    if ! command -v qdrant &> /dev/null && [ ! -f /usr/local/bin/qdrant ]; then
        echo "  → Downloading Qdrant..."
        curl -fsSL https://github.com/qdrant/qdrant/releases/download/v1.12.5/qdrant-x86_64-unknown-linux-gnu.tar.gz -o /tmp/qdrant.tar.gz
        tar xzf /tmp/qdrant.tar.gz -C /usr/local/bin/
        rm /tmp/qdrant.tar.gz
    fi

    touch "$SETUP_MARKER"
    echo "→ Setup complete."
fi

# ── Apache Config (idempotent) ───────────────────────────────
if [ -f /etc/apache2/ports.conf ]; then
    sed -i 's/Listen 80/Listen 8080/' /etc/apache2/ports.conf 2>/dev/null || true
    sed -i 's/:80>/:8080>/' /etc/apache2/sites-available/000-default.conf 2>/dev/null || true
    sed -i 's|/var/www/html|/app|g' /etc/apache2/sites-available/000-default.conf 2>/dev/null || true
    a2enmod rewrite 2>/dev/null || true
fi

# ── MySQL Init (first run only) ──────────────────────────────
if [ ! -d "$MYSQL_DATA/mysql" ]; then
    echo "→ Initializing MySQL data directory..."
    mysql_install_db --user=mysql --datadir="$MYSQL_DATA" > /dev/null 2>&1

    echo "→ Creating database and user..."
    mysqld --user=mysql --bootstrap 2>/dev/null <<-EOSQL
        FLUSH PRIVILEGES;
        ALTER USER 'root'@'localhost' IDENTIFIED BY '$ROOT_PASS';
        CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS';
        CREATE USER IF NOT EXISTS '$DB_USER'@'127.0.0.1' IDENTIFIED BY '$DB_PASS';
        CREATE DATABASE IF NOT EXISTS \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
        GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$DB_USER'@'localhost';
        GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$DB_USER'@'127.0.0.1';
        FLUSH PRIVILEGES;
EOSQL
fi

# ── Start MySQL ──────────────────────────────────────────────
echo "→ Starting MySQL..."
mysqld --user=mysql --datadir="$MYSQL_DATA" &
MYSQL_PID=$!

for i in $(seq 1 30); do
    if mysqladmin ping -u root --password="$ROOT_PASS" --silent 2>/dev/null; then
        break
    fi
    sleep 1
done

if ! mysql -u root --password="$ROOT_PASS" -e "SELECT 1 FROM \`$DB_NAME\`.products LIMIT 1" 2>/dev/null; then
    if [ -f "$SCHEMA_FILE" ]; then
        echo "→ Importing schema from schema.sql..."
        mysql -u root --password="$ROOT_PASS" "$DB_NAME" < "$SCHEMA_FILE"
        echo "→ Schema imported."
    fi
fi

# ── Start Qdrant ─────────────────────────────────────────────
echo "→ Starting Qdrant vector database..."
/usr/local/bin/qdrant --storage "$QDRANT_DATA" &
QDRANT_PID=$!

for i in $(seq 1 15); do
    if curl -sf http://127.0.0.1:6333/ > /dev/null 2>&1; then
        echo "→ Qdrant ready."
        break
    fi
    sleep 1
done

# ── Start all services via supervisor ────────────────────────
echo "→ Starting web services via supervisor..."
/usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf &
SUPERVISOR_PID=$!

cleanup() {
    echo "→ Shutting down..."
    kill "$SUPERVISOR_PID" 2>/dev/null || true
    kill "$QDRANT_PID" 2>/dev/null || true
    kill "$MYSQL_PID" 2>/dev/null || true
    wait "$MYSQL_PID" 2>/dev/null || true
    wait "$QDRANT_PID" 2>/dev/null || true
    exit 0
}
trap cleanup SIGTERM SIGINT

wait "$SUPERVISOR_PID"
