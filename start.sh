#!/bin/bash
set -e

DB_USER=${DB_USERNAME:-alihamza}
DB_PASS=${DB_PASSWORD:-R@i123ali}
DB_NAME=${DB_DATABASE:-Ecommerce_site}
ROOT_PASS=${MYSQL_ROOT_PASSWORD:-rootpassword}
MYSQL_DATA=/var/lib/mysql
SCHEMA_FILE=/app/schema.sql

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
    fi
fi

echo "→ Starting services via supervisor..."
/usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf &
SUPERVISOR_PID=$!

cleanup() {
    echo "→ Shutting down..."
    kill "$SUPERVISOR_PID" 2>/dev/null || true
    kill "$MYSQL_PID" 2>/dev/null || true
    wait "$MYSQL_PID" 2>/dev/null || true
    exit 0
}
trap cleanup SIGTERM SIGINT

wait "$SUPERVISOR_PID"
