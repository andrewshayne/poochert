-- Users table (managed by your auth provider)
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Dogs table (handles the subpath/subdomain mapping)
CREATE TABLE dogs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL, -- e.g., 'bailey' for poochert.com/bailey
  name TEXT NOT NULL,
  subscription_status TEXT DEFAULT 'pending', -- 'active', 'canceled', 'pending'
  stripe_customer_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Photo metadata table (optional, for captions and exact timestamps)
CREATE TABLE photos (
  id TEXT PRIMARY KEY,
  dog_id TEXT NOT NULL,
  r2_key TEXT NOT NULL,      -- e.g., 'dogs/bailey/originals/1996/01/dog-01.jpg'
  taken_at DATE NOT NULL,    -- Used to sort the timeline accurately
  caption TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (dog_id) REFERENCES dogs(id)
);

-- Index for fast timeline lookups by date
CREATE INDEX idx_photos_timeline ON photos(dog_id, taken_at);