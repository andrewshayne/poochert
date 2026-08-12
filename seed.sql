-- Use INSERT OR IGNORE so running this multiple times won't crash
INSERT OR IGNORE INTO users (id, email) VALUES ('user_123', 'andre@example.com');

INSERT OR IGNORE INTO dogs (id, user_id, slug, name, subscription_status) 
VALUES ('dog_123', 'user_123', 'bailey', 'Bailey', 'active');

-- For photos, use REPLACE in case you update the r2_key or caption
INSERT OR REPLACE INTO photos (id, dog_id, r2_key, taken_at, caption) 
VALUES ('p1', 'dog_123', 'dogs/bailey/originals/1996/01/dog-1.jpg', '1996-01-15', 'Baby Bailey');