USE `ecommerce-schema`;

INSERT IGNORE INTO categories (name, parent_id) VALUES ('Electronics', NULL), ('Clothing', NULL);

-- Generate UUIDs for products directly
INSERT IGNORE INTO products (uuid, name, description, brand, status) VALUES 
('a1b2c3d4-1234-5678-9012-123456789012', 'Wireless Headphones AI-Max', 'Premium noise-canceling headphones with AI.', 'Aura', 'active'), 
('b2c3d4e5-2345-6789-0123-234567890123', 'ErgoDesk Pro', 'Standing desk with memory settings.', 'OfficeTech', 'active');

-- Ensure product variants exist
INSERT IGNORE INTO product_variants (uuid, product_id, sku, price, stock, attributes) VALUES 
('c3d4e5f6-3456-7890-1234-345678901234', (SELECT id FROM products WHERE name='Wireless Headphones AI-Max' LIMIT 1), 'WH-AIMAX', 299.99, 100, '{"color":"Black"}'),
('d4e5f6a7-4567-8901-2345-456789012345', (SELECT id FROM products WHERE name='ErgoDesk Pro' LIMIT 1), 'ED-PRO-W', 499.00, 50, '{"color":"White wood"}');

-- Ensure categories are mapped
INSERT IGNORE INTO product_categories (product_id, category_id) VALUES 
((SELECT id FROM products WHERE name='Wireless Headphones AI-Max' LIMIT 1), (SELECT id FROM categories WHERE name='Electronics' LIMIT 1)),
((SELECT id FROM products WHERE name='ErgoDesk Pro' LIMIT 1), (SELECT id FROM categories WHERE name='Clothing' LIMIT 1));
