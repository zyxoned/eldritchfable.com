-- Standalone catalog tables. Apply only to a backed-up database after review.
CREATE TABLE IF NOT EXISTS storefront_collections (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'dice',
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS storefront_products (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL REFERENCES storefront_collections(slug),
  description TEXT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(details_json)),
  specifications_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(specifications_json)),
  variants_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(variants_json)),
  art TEXT NOT NULL DEFAULT 'default',
  sort_order INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0,1))
);
CREATE INDEX IF NOT EXISTS idx_storefront_products_category ON storefront_products(category, published);
