
-- Add flash deal end time to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS flash_deal_ends_at timestamptz;

-- Add birthday to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birthday date;

-- Gift cards table
CREATE TABLE IF NOT EXISTS gift_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  initial_value numeric NOT NULL,
  balance numeric NOT NULL,
  is_active boolean DEFAULT true,
  created_by uuid NOT NULL,
  redeemed_by uuid,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE gift_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage gift cards" ON gift_cards FOR ALL USING (is_admin_or_manager(auth.uid()));
CREATE POLICY "Users can view their gift cards" ON gift_cards FOR SELECT USING (redeemed_by = auth.uid());

-- Price drop alerts table
CREATE TABLE IF NOT EXISTS price_drop_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  target_price numeric,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, product_id)
);
ALTER TABLE price_drop_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own price alerts" ON price_drop_alerts FOR ALL USING (auth.uid() = user_id);

-- Saved searches table
CREATE TABLE IF NOT EXISTS saved_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own saved searches" ON saved_searches FOR ALL USING (auth.uid() = user_id);

-- Product bundles (frequently bought together)
CREATE TABLE IF NOT EXISTS product_bundles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  bundled_product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(product_id, bundled_product_id)
);
ALTER TABLE product_bundles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bundles viewable by everyone" ON product_bundles FOR SELECT USING (true);
CREATE POLICY "Admins can manage bundles" ON product_bundles FOR ALL USING (is_admin_or_manager(auth.uid()));

-- Revenue goals in store_settings (no table needed, uses existing store_settings)
