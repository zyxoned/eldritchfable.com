-- Draft only. Not applied to production. No payment credentials or card data stored.
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS commerce_orders (
  id TEXT PRIMARY KEY,
  customer_id TEXT REFERENCES account_users(id),
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','pending_payment','paid','fulfilling','fulfilled','cancelled','refunded')),
  currency TEXT NOT NULL DEFAULT 'USD' CHECK(length(currency)=3),
  subtotal_cents INTEGER NOT NULL DEFAULT 0 CHECK(subtotal_cents >= 0),
  shipping_cents INTEGER NOT NULL DEFAULT 0 CHECK(shipping_cents >= 0),
  tax_cents INTEGER NOT NULL DEFAULT 0 CHECK(tax_cents >= 0),
  total_cents INTEGER NOT NULL DEFAULT 0 CHECK(total_cents >= 0),
  payment_provider TEXT,
  provider_checkout_id TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;
CREATE TABLE IF NOT EXISTS commerce_order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES commerce_orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  variant_sku TEXT NOT NULL,
  title_snapshot TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  unit_price_cents INTEGER NOT NULL CHECK(unit_price_cents >= 0),
  line_total_cents INTEGER NOT NULL CHECK(line_total_cents >= 0)
) STRICT;
CREATE INDEX IF NOT EXISTS idx_commerce_order_items_order ON commerce_order_items(order_id);
CREATE TABLE IF NOT EXISTS commerce_payment_events (
  provider TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  order_id TEXT REFERENCES commerce_orders(id),
  event_type TEXT NOT NULL,
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TEXT,
  PRIMARY KEY(provider,provider_event_id)
) STRICT;
