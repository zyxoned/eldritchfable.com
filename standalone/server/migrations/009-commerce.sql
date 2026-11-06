-- Empty by design: preview products are not sellable stock.
CREATE TABLE commerce_stock (
  product_id TEXT NOT NULL REFERENCES storefront_products(id),
  variant_id TEXT NOT NULL,
  stripe_price_id TEXT NOT NULL UNIQUE,
  available INTEGER NOT NULL CHECK (typeof(available) = 'integer' AND available >= 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  PRIMARY KEY(product_id,variant_id)
);
CREATE TABLE commerce_orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES account_users(id),
  request_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  stripe_account TEXT NOT NULL,
  lines_json TEXT NOT NULL CHECK (json_valid(lines_json)),
  params_json TEXT NOT NULL CHECK (json_valid(params_json)),
  expected_subtotal INTEGER NOT NULL CHECK (expected_subtotal > 0),
  expected_shipping INTEGER NOT NULL CHECK (expected_shipping >= 0),
  stripe_session_id TEXT UNIQUE,
  stripe_session_url TEXT,
  payment_intent TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','expired','payment_failed','review')),
  amount_total INTEGER,
  amount_tax INTEGER,
  shipping_json TEXT CHECK (shipping_json IS NULL OR json_valid(shipping_json)),
  customer_email TEXT,
  review_reason TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(user_id,request_key)
);
CREATE INDEX commerce_orders_payment_intent ON commerce_orders(payment_intent);
CREATE TABLE commerce_webhook_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  received_at INTEGER NOT NULL
);
CREATE TABLE commerce_payment_reviews (
  payment_intent TEXT PRIMARY KEY,
  reason TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE commerce_fulfillment (
  order_id TEXT PRIMARY KEY REFERENCES commerce_orders(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','review','fulfilled')),
  created_at INTEGER NOT NULL
);
