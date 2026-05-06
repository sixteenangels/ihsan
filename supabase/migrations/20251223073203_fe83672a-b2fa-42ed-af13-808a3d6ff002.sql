-- =============================================
-- IHSAN E-COMMERCE DATABASE SCHEMA
-- =============================================

-- Create app_role enum for user roles
CREATE TYPE public.app_role AS ENUM ('customer', 'manager', 'admin');

-- =============================================
-- 1. PROFILES TABLE (User data)
-- =============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  google_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- =============================================
-- 2. USER ROLES TABLE (Separate for security)
-- =============================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'customer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Check if user is admin or manager
CREATE OR REPLACE FUNCTION public.is_admin_or_manager(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'manager')
  )
$$;

CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- 3. CATEGORIES TABLE
-- =============================================
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT,
  parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  product_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Categories are viewable by everyone"
  ON public.categories FOR SELECT
  USING (true);

CREATE POLICY "Admins and managers can manage categories"
  ON public.categories FOR ALL
  USING (public.is_admin_or_manager(auth.uid()));

-- =============================================
-- 4. PRODUCTS TABLE
-- =============================================
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  item_code TEXT UNIQUE NOT NULL,
  product_number TEXT,
  base_price DECIMAL(10,2) NOT NULL,
  is_group_buy_eligible BOOLEAN DEFAULT false,
  is_flash_deal BOOLEAN DEFAULT false,
  is_free_shipping BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  rating DECIMAL(2,1) DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active products are viewable by everyone"
  ON public.products FOR SELECT
  USING (is_active = true OR public.is_admin_or_manager(auth.uid()));

CREATE POLICY "Admins and managers can manage products"
  ON public.products FOR ALL
  USING (public.is_admin_or_manager(auth.uid()));

-- =============================================
-- 5. PRODUCT VARIANTS TABLE
-- =============================================
CREATE TABLE public.product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  color TEXT,
  size TEXT,
  price_override DECIMAL(10,2),
  stock INTEGER DEFAULT 0,
  sku TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Product variants are viewable by everyone"
  ON public.product_variants FOR SELECT
  USING (true);

CREATE POLICY "Admins and managers can manage variants"
  ON public.product_variants FOR ALL
  USING (public.is_admin_or_manager(auth.uid()));

-- =============================================
-- 6. PRODUCT IMAGES TABLE
-- =============================================
CREATE TABLE public.product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Product images are viewable by everyone"
  ON public.product_images FOR SELECT
  USING (true);

CREATE POLICY "Admins and managers can manage images"
  ON public.product_images FOR ALL
  USING (public.is_admin_or_manager(auth.uid()));

-- =============================================
-- 7. SHIPPING TYPES TABLE (Sea, Air)
-- =============================================
CREATE TABLE public.shipping_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.shipping_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shipping types are viewable by everyone"
  ON public.shipping_types FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage shipping types"
  ON public.shipping_types FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- 8. SHIPPING CLASSES TABLE (Normal, Express)
-- =============================================
CREATE TABLE public.shipping_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipping_type_id UUID NOT NULL REFERENCES public.shipping_types(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  estimated_days_min INTEGER NOT NULL,
  estimated_days_max INTEGER NOT NULL,
  base_price DECIMAL(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.shipping_classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shipping classes are viewable by everyone"
  ON public.shipping_classes FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage shipping classes"
  ON public.shipping_classes FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- 9. PRODUCT SHIPPING RULES TABLE
-- =============================================
CREATE TABLE public.product_shipping_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  shipping_class_id UUID NOT NULL REFERENCES public.shipping_classes(id) ON DELETE CASCADE,
  price DECIMAL(10,2) NOT NULL,
  is_allowed BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(product_id, shipping_class_id)
);

ALTER TABLE public.product_shipping_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shipping rules are viewable by everyone"
  ON public.product_shipping_rules FOR SELECT
  USING (true);

CREATE POLICY "Admins and managers can manage shipping rules"
  ON public.product_shipping_rules FOR ALL
  USING (public.is_admin_or_manager(auth.uid()));

-- =============================================
-- 10. GROUP BUYS TABLE
-- =============================================
CREATE TYPE public.group_buy_status AS ENUM ('open', 'filled', 'closed', 'cancelled');

CREATE TABLE public.group_buys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  min_participants INTEGER NOT NULL,
  current_participants INTEGER DEFAULT 0,
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  status public.group_buy_status DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.group_buys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group buys are viewable by everyone"
  ON public.group_buys FOR SELECT
  USING (true);

CREATE POLICY "Users can create group buys"
  ON public.group_buys FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Admins can manage all group buys"
  ON public.group_buys FOR ALL
  USING (public.is_admin_or_manager(auth.uid()));

-- =============================================
-- 11. GROUP BUY PARTICIPANTS TABLE
-- =============================================
CREATE TABLE public.group_buy_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_buy_id UUID NOT NULL REFERENCES public.group_buys(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
  quantity INTEGER DEFAULT 1,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(group_buy_id, user_id)
);

ALTER TABLE public.group_buy_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants are viewable by everyone"
  ON public.group_buy_participants FOR SELECT
  USING (true);

CREATE POLICY "Users can join group buys"
  ON public.group_buy_participants FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave group buys"
  ON public.group_buy_participants FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================
-- 12. CART ITEMS TABLE
-- =============================================
CREATE TABLE public.cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_variant_id)
);

ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own cart"
  ON public.cart_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own cart"
  ON public.cart_items FOR ALL
  USING (auth.uid() = user_id);

-- =============================================
-- 13. ORDERS TABLE
-- =============================================
CREATE TYPE public.order_status AS ENUM (
  'pending', 
  'confirmed', 
  'processing', 
  'shipped', 
  'in_transit', 
  'out_for_delivery',
  'delivered', 
  'cancelled', 
  'refunded'
);

CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_number TEXT UNIQUE NOT NULL,
  status public.order_status DEFAULT 'pending',
  shipping_class_id UUID REFERENCES public.shipping_classes(id) ON DELETE SET NULL,
  shipping_price DECIMAL(10,2) DEFAULT 0,
  subtotal DECIMAL(10,2) NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  shipping_address JSONB,
  estimated_delivery_start DATE,
  estimated_delivery_end DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own orders"
  ON public.orders FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin_or_manager(auth.uid()));

CREATE POLICY "Users can create their own orders"
  ON public.orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins and managers can manage all orders"
  ON public.orders FOR UPDATE
  USING (public.is_admin_or_manager(auth.uid()));

-- =============================================
-- 14. ORDER ITEMS TABLE
-- =============================================
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  variant_details TEXT,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own order items"
  ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders 
      WHERE orders.id = order_items.order_id 
      AND (orders.user_id = auth.uid() OR public.is_admin_or_manager(auth.uid()))
    )
  );

CREATE POLICY "Users can create order items for their orders"
  ON public.order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders 
      WHERE orders.id = order_items.order_id 
      AND orders.user_id = auth.uid()
    )
  );

-- =============================================
-- 15. ORDER TRACKING TABLE
-- =============================================
CREATE TABLE public.order_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  location_name TEXT,
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.order_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tracking for their orders"
  ON public.order_tracking FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders 
      WHERE orders.id = order_tracking.order_id 
      AND (orders.user_id = auth.uid() OR public.is_admin_or_manager(auth.uid()))
    )
  );

CREATE POLICY "Admins can manage order tracking"
  ON public.order_tracking FOR ALL
  USING (public.is_admin_or_manager(auth.uid()));

-- =============================================
-- 16. REVIEWS TABLE
-- =============================================
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  comment TEXT,
  is_verified BOOLEAN DEFAULT false,
  is_approved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved reviews are viewable by everyone"
  ON public.reviews FOR SELECT
  USING (is_approved = true OR auth.uid() = user_id OR public.is_admin_or_manager(auth.uid()));

CREATE POLICY "Users can create reviews"
  ON public.reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reviews"
  ON public.reviews FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all reviews"
  ON public.reviews FOR ALL
  USING (public.is_admin_or_manager(auth.uid()));

-- =============================================
-- 17. COUPONS TABLE
-- =============================================
CREATE TYPE public.coupon_type AS ENUM ('percentage', 'fixed_amount');

CREATE TABLE public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  type public.coupon_type NOT NULL,
  value DECIMAL(10,2) NOT NULL,
  min_order_amount DECIMAL(10,2) DEFAULT 0,
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active coupons are viewable by authenticated users"
  ON public.coupons FOR SELECT
  TO authenticated
  USING (is_active = true OR public.is_admin_or_manager(auth.uid()));

CREATE POLICY "Admins can manage coupons"
  ON public.coupons FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- 18. ADDRESSES TABLE
-- =============================================
CREATE TABLE public.addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT NOT NULL,
  state TEXT,
  postal_code TEXT,
  country TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own addresses"
  ON public.addresses FOR ALL
  USING (auth.uid() = user_id);

-- =============================================
-- TRIGGERS & FUNCTIONS
-- =============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply updated_at triggers to relevant tables
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_product_variants_updated_at
  BEFORE UPDATE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_shipping_classes_updated_at
  BEFORE UPDATE ON public.shipping_classes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_product_shipping_rules_updated_at
  BEFORE UPDATE ON public.product_shipping_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_group_buys_updated_at
  BEFORE UPDATE ON public.group_buys
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cart_items_updated_at
  BEFORE UPDATE ON public.cart_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_reviews_updated_at
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_coupons_updated_at
  BEFORE UPDATE ON public.coupons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_addresses_updated_at
  BEFORE UPDATE ON public.addresses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, email)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'name', NEW.email);
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'customer');
  
  RETURN NEW;
END;
$$;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to generate order number
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.order_number := 'IHS-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || UPPER(SUBSTR(NEW.id::TEXT, 1, 8));
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_order_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.generate_order_number();

-- Function to update group buy participant count
CREATE OR REPLACE FUNCTION public.update_group_buy_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.group_buys
    SET current_participants = current_participants + 1
    WHERE id = NEW.group_buy_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.group_buys
    SET current_participants = current_participants - 1
    WHERE id = OLD.group_buy_id;
    RETURN OLD;
  END IF;
END;
$$;

CREATE TRIGGER update_group_buy_participant_count
  AFTER INSERT OR DELETE ON public.group_buy_participants
  FOR EACH ROW EXECUTE FUNCTION public.update_group_buy_count();

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================
CREATE INDEX idx_products_category ON public.products(category_id);
CREATE INDEX idx_products_active ON public.products(is_active);
CREATE INDEX idx_product_variants_product ON public.product_variants(product_id);
CREATE INDEX idx_product_images_product ON public.product_images(product_id);
CREATE INDEX idx_group_buys_product ON public.group_buys(product_id);
CREATE INDEX idx_group_buys_status ON public.group_buys(status);
CREATE INDEX idx_cart_items_user ON public.cart_items(user_id);
CREATE INDEX idx_orders_user ON public.orders(user_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_order_items_order ON public.order_items(order_id);
CREATE INDEX idx_reviews_product ON public.reviews(product_id);
CREATE INDEX idx_reviews_approved ON public.reviews(is_approved);
