#!/bin/bash
set -e

echo "→ Installing PHP dependencies..."
curl -sS https://getcomposer.org/installer -o composer.phar
php8.1 composer.phar install --working-dir=Backend --no-dev
rm composer.phar

echo "→ Installing Node.js dependencies..."
npm install --prefix PaymentSystem --production

echo "→ Installing Python dependencies..."
pip3 install -r AIService/requirements.txt --break-system-packages

echo "→ Downloading Qdrant..."
curl -fsSL https://github.com/qdrant/qdrant/releases/download/v1.12.5/qdrant-x86_64-unknown-linux-gnu.tar.gz -o /tmp/qdrant.tar.gz
tar xzf /tmp/qdrant.tar.gz -C /usr/local/bin/
rm /tmp/qdrant.tar.gz

echo "→ Build complete."
