CREATE TABLE menu_items (
  id integer PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  base_price_cents integer NOT NULL CHECK (base_price_cents > 0),
  price_step_cents integer NOT NULL CHECK (price_step_cents > 0),
  max_price_cents integer NOT NULL CHECK (max_price_cents >= base_price_cents)
);

CREATE TABLE market_state (
  item_id integer PRIMARY KEY REFERENCES menu_items (id),
  price_cents integer NOT NULL CHECK (price_cents > 0),
  demand integer NOT NULL DEFAULT 0 CHECK (demand >= 0),
  volume integer NOT NULL DEFAULT 0 CHECK (volume >= 0),
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0)
);

CREATE TABLE orders (
  id uuid PRIMARY KEY,
  idempotency_key text NOT NULL UNIQUE,
  request_hash text NOT NULL,
  total_cents integer NOT NULL DEFAULT 0 CHECK (total_cents >= 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE order_lines (
  order_id uuid NOT NULL REFERENCES orders (id),
  item_id integer NOT NULL REFERENCES menu_items (id),
  name text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price_cents integer NOT NULL CHECK (unit_price_cents > 0),
  PRIMARY KEY (order_id, item_id)
);

INSERT INTO menu_items
  (id, name, description, category, base_price_cents, price_step_cents, max_price_cents)
VALUES
  (1, 'Espresso', 'A strong and classic coffee.', 'Drink', 250, 5, 375),
  (2, 'Latte', 'Coffee with steamed milk.', 'Drink', 400, 5, 600),
  (3, 'Cappuccino', 'Espresso with milk foam.', 'Drink', 420, 5, 630),
  (4, 'Iced Coffee', 'Cold coffee served with ice.', 'Drink', 380, 5, 570),
  (5, 'Croissant', 'A fresh butter croissant.', 'Food', 300, 5, 450),
  (6, 'Muffin', 'A soft chocolate chip muffin.', 'Food', 350, 5, 525),
  (7, 'Cookie', 'A homemade chocolate chip cookie.', 'Food', 220, 5, 330),
  (8, 'Bagel', 'A toasted bagel with cream cheese.', 'Food', 450, 5, 675);

INSERT INTO market_state (item_id, price_cents)
SELECT id, base_price_cents FROM menu_items;
