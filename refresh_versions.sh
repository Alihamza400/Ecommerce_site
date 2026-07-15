#!/bin/bash
# Auto-bump cache versions based on file modification times
FRONTEND="/home/ali-hamza/Documents/Projects/Ecommerce_site/Frontend"

# Get timestamps for each file
CSS_V=$(stat -c %Y "$FRONTEND/css/animations.css" 2>/dev/null | tail -c 5)
JS_A_V=$(stat -c %Y "$FRONTEND/js/animations.js" 2>/dev/null | tail -c 5)
JS_C_V=$(stat -c %Y "$FRONTEND/js/catalog.js" 2>/dev/null | tail -c 5)
JS_CK_V=$(stat -c %Y "$FRONTEND/js/checkout.js" 2>/dev/null | tail -c 5)
JS_AI_V=$(stat -c %Y "$FRONTEND/js/ai_assistant.js" 2>/dev/null | tail -c 5)

# Update all HTML files with correct versions
for f in "$FRONTEND"/*.html; do
    sed -i "s|animations.css?v=[0-9]*|animations.css?v=$CSS_V|g" "$f"
    sed -i "s|animations.js?v=[0-9]*|animations.js?v=$JS_A_V|g" "$f"
    sed -i "s|catalog.js?v=[0-9]*|catalog.js?v=$JS_C_V|g" "$f"
    sed -i "s|checkout.js?v=[0-9]*|checkout.js?v=$JS_CK_V|g" "$f"
done
echo "✅ Versions refreshed: CSS=$CSS_V JS_A=$JS_A_V JS_C=$JS_C_V JS_CK=$JS_CK_V"
