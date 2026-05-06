
-- Fix ALL tables: drop RESTRICTIVE policies and recreate as PERMISSIVE

-- ============ ORDERS ============
DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
DROP POLICY IF EXISTS "Admins and managers can update all orders" ON public.orders;
DROP POLICY IF EXISTS "Users can create their own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can update their own orders status" ON public.orders;

CREATE POLICY "Users can view their own orders" ON public.orders FOR SELECT TO authenticated USING (auth.uid() = user_id OR is_admin_or_manager(auth.uid()));
CREATE POLICY "Users can create their own orders" ON public.orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins and managers can update all orders" ON public.orders FOR UPDATE TO authenticated USING (is_admin_or_manager(auth.uid())) WITH CHECK (is_admin_or_manager(auth.uid()));
CREATE POLICY "Users can update their own orders status" ON public.orders FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ ORDER_ITEMS ============
DROP POLICY IF EXISTS "Users can view their own order items" ON public.order_items;
DROP POLICY IF EXISTS "Users can create order items for their orders" ON public.order_items;

CREATE POLICY "Users can view their own order items" ON public.order_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND (orders.user_id = auth.uid() OR is_admin_or_manager(auth.uid()))));
CREATE POLICY "Users can create order items for their orders" ON public.order_items FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()));

-- ============ ORDER_TRACKING ============
DROP POLICY IF EXISTS "Admins can manage order tracking" ON public.order_tracking;
DROP POLICY IF EXISTS "Users can view tracking for their orders" ON public.order_tracking;

CREATE POLICY "Admins can manage order tracking" ON public.order_tracking FOR ALL TO authenticated USING (is_admin_or_manager(auth.uid()));
CREATE POLICY "Users can view tracking for their orders" ON public.order_tracking FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_tracking.order_id AND (orders.user_id = auth.uid() OR is_admin_or_manager(auth.uid()))));

-- ============ PRODUCTS ============
DROP POLICY IF EXISTS "Active products are viewable by everyone" ON public.products;
DROP POLICY IF EXISTS "Admins and managers can manage products" ON public.products;

CREATE POLICY "Active products are viewable by everyone" ON public.products FOR SELECT USING (is_active = true OR is_admin_or_manager(auth.uid()));
CREATE POLICY "Admins and managers can manage products" ON public.products FOR ALL TO authenticated USING (is_admin_or_manager(auth.uid()));

-- ============ PRODUCT_VARIANTS ============
DROP POLICY IF EXISTS "Admins and managers can manage variants" ON public.product_variants;
DROP POLICY IF EXISTS "Product variants are viewable by everyone" ON public.product_variants;

CREATE POLICY "Product variants are viewable by everyone" ON public.product_variants FOR SELECT USING (true);
CREATE POLICY "Admins and managers can manage variants" ON public.product_variants FOR ALL TO authenticated USING (is_admin_or_manager(auth.uid()));

-- ============ PRODUCT_IMAGES ============
DROP POLICY IF EXISTS "Admins and managers can manage images" ON public.product_images;
DROP POLICY IF EXISTS "Product images are viewable by everyone" ON public.product_images;

CREATE POLICY "Product images are viewable by everyone" ON public.product_images FOR SELECT USING (true);
CREATE POLICY "Admins and managers can manage images" ON public.product_images FOR ALL TO authenticated USING (is_admin_or_manager(auth.uid()));

-- ============ CATEGORIES ============
DROP POLICY IF EXISTS "Categories are viewable by everyone" ON public.categories;
DROP POLICY IF EXISTS "Admins and managers can manage categories" ON public.categories;

CREATE POLICY "Categories are viewable by everyone" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Admins and managers can manage categories" ON public.categories FOR ALL TO authenticated USING (is_admin_or_manager(auth.uid()));

-- ============ REVIEWS ============
DROP POLICY IF EXISTS "Admins can manage all reviews" ON public.reviews;
DROP POLICY IF EXISTS "Approved reviews are viewable by everyone" ON public.reviews;
DROP POLICY IF EXISTS "Users can create reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users can update their own reviews" ON public.reviews;

CREATE POLICY "Approved reviews are viewable by everyone" ON public.reviews FOR SELECT USING (is_approved = true OR auth.uid() = user_id OR is_admin_or_manager(auth.uid()));
CREATE POLICY "Admins can manage all reviews" ON public.reviews FOR ALL TO authenticated USING (is_admin_or_manager(auth.uid()));
CREATE POLICY "Users can create reviews" ON public.reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own reviews" ON public.reviews FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- ============ RECEIPTS ============
DROP POLICY IF EXISTS "Admins can manage all receipts" ON public.receipts;
DROP POLICY IF EXISTS "Users can view receipts for their orders" ON public.receipts;

CREATE POLICY "Admins can manage all receipts" ON public.receipts FOR ALL TO authenticated USING (is_admin_or_manager(auth.uid()));
CREATE POLICY "Users can view receipts for their orders" ON public.receipts FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = receipts.order_id AND (orders.user_id = auth.uid() OR is_admin_or_manager(auth.uid()))));

-- ============ REFUND_REQUESTS ============
DROP POLICY IF EXISTS "Admins can update refund requests" ON public.refund_requests;
DROP POLICY IF EXISTS "Admins can view all refund requests" ON public.refund_requests;
DROP POLICY IF EXISTS "Users can create refund requests" ON public.refund_requests;
DROP POLICY IF EXISTS "Users can view own refund requests" ON public.refund_requests;

CREATE POLICY "Admins can view all refund requests" ON public.refund_requests FOR SELECT TO authenticated USING (is_admin_or_manager(auth.uid()));
CREATE POLICY "Admins can update refund requests" ON public.refund_requests FOR UPDATE TO authenticated USING (is_admin_or_manager(auth.uid()));
CREATE POLICY "Users can create refund requests" ON public.refund_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own refund requests" ON public.refund_requests FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ============ PROFILES ============
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (is_admin_or_manager(auth.uid()));
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- ============ USER_ROLES ============
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all roles" ON public.user_roles FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

-- ============ NOTIFICATIONS ============
DROP POLICY IF EXISTS "Admins can manage all notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;

CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id OR is_broadcast = true OR is_admin_or_manager(auth.uid()));
CREATE POLICY "Admins can manage all notifications" ON public.notifications FOR ALL TO authenticated USING (is_admin_or_manager(auth.uid()));
CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- ============ COUPONS ============
DROP POLICY IF EXISTS "Admins can manage coupons" ON public.coupons;
DROP POLICY IF EXISTS "Active coupons are viewable by authenticated users" ON public.coupons;

CREATE POLICY "Active coupons are viewable by authenticated users" ON public.coupons FOR SELECT TO authenticated USING (is_active = true OR is_admin_or_manager(auth.uid()));
CREATE POLICY "Admins can manage coupons" ON public.coupons FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

-- ============ STORE_SETTINGS ============
DROP POLICY IF EXISTS "Admins can manage store settings" ON public.store_settings;
DROP POLICY IF EXISTS "Store settings are viewable by everyone" ON public.store_settings;

CREATE POLICY "Store settings are viewable by everyone" ON public.store_settings FOR SELECT USING (true);
CREATE POLICY "Admins can manage store settings" ON public.store_settings FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

-- ============ SHIPPING_TYPES ============
DROP POLICY IF EXISTS "Admins can manage shipping types" ON public.shipping_types;
DROP POLICY IF EXISTS "Shipping types are viewable by everyone" ON public.shipping_types;

CREATE POLICY "Shipping types are viewable by everyone" ON public.shipping_types FOR SELECT USING (true);
CREATE POLICY "Admins can manage shipping types" ON public.shipping_types FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

-- ============ SHIPPING_CLASSES ============
DROP POLICY IF EXISTS "Admins can manage shipping classes" ON public.shipping_classes;
DROP POLICY IF EXISTS "Shipping classes are viewable by everyone" ON public.shipping_classes;

CREATE POLICY "Shipping classes are viewable by everyone" ON public.shipping_classes FOR SELECT USING (true);
CREATE POLICY "Admins can manage shipping classes" ON public.shipping_classes FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

-- ============ LOYALTY_POINTS ============
DROP POLICY IF EXISTS "Admins can manage points" ON public.loyalty_points;
DROP POLICY IF EXISTS "Users can view their own points" ON public.loyalty_points;
DROP POLICY IF EXISTS "System can insert points" ON public.loyalty_points;

CREATE POLICY "Users can view their own points" ON public.loyalty_points FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage points" ON public.loyalty_points FOR ALL TO authenticated USING (is_admin_or_manager(auth.uid()));
CREATE POLICY "System can insert points" ON public.loyalty_points FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ============ MANAGER_PERMISSIONS ============
DROP POLICY IF EXISTS "Admins can manage permissions" ON public.manager_permissions;
DROP POLICY IF EXISTS "Managers can view own permissions" ON public.manager_permissions;

CREATE POLICY "Managers can view own permissions" ON public.manager_permissions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage permissions" ON public.manager_permissions FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

-- ============ GROUP_BUYS ============
DROP POLICY IF EXISTS "Admins can manage all group buys" ON public.group_buys;
DROP POLICY IF EXISTS "Group buys are viewable by everyone" ON public.group_buys;
DROP POLICY IF EXISTS "Users can create group buys" ON public.group_buys;

CREATE POLICY "Group buys are viewable by everyone" ON public.group_buys FOR SELECT USING (true);
CREATE POLICY "Admins can manage all group buys" ON public.group_buys FOR ALL TO authenticated USING (is_admin_or_manager(auth.uid()));
CREATE POLICY "Users can create group buys" ON public.group_buys FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

-- ============ GROUP_BUY_PARTICIPANTS ============
DROP POLICY IF EXISTS "Anyone can view participant counts" ON public.group_buy_participants;
DROP POLICY IF EXISTS "Users can join group buys" ON public.group_buy_participants;
DROP POLICY IF EXISTS "Users can leave group buys" ON public.group_buy_participants;
DROP POLICY IF EXISTS "Users can update their own participation" ON public.group_buy_participants;

CREATE POLICY "Anyone can view participant counts" ON public.group_buy_participants FOR SELECT USING (true);
CREATE POLICY "Users can join group buys" ON public.group_buy_participants FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can leave group buys" ON public.group_buy_participants FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own participation" ON public.group_buy_participants FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ PRODUCT_BUNDLES ============
DROP POLICY IF EXISTS "Admins can manage bundles" ON public.product_bundles;
DROP POLICY IF EXISTS "Bundles viewable by everyone" ON public.product_bundles;

CREATE POLICY "Bundles viewable by everyone" ON public.product_bundles FOR SELECT USING (true);
CREATE POLICY "Admins can manage bundles" ON public.product_bundles FOR ALL TO authenticated USING (is_admin_or_manager(auth.uid()));

-- ============ PRODUCT_SHIPPING_RULES ============
DROP POLICY IF EXISTS "Admins and managers can manage shipping rules" ON public.product_shipping_rules;
DROP POLICY IF EXISTS "Shipping rules are viewable by everyone" ON public.product_shipping_rules;

CREATE POLICY "Shipping rules are viewable by everyone" ON public.product_shipping_rules FOR SELECT USING (true);
CREATE POLICY "Admins and managers can manage shipping rules" ON public.product_shipping_rules FOR ALL TO authenticated USING (is_admin_or_manager(auth.uid()));

-- ============ PRODUCT_QUESTIONS ============
DROP POLICY IF EXISTS "Admins can manage questions" ON public.product_questions;
DROP POLICY IF EXISTS "Questions viewable by everyone when published" ON public.product_questions;
DROP POLICY IF EXISTS "Users can ask questions" ON public.product_questions;

CREATE POLICY "Questions viewable by everyone when published" ON public.product_questions FOR SELECT USING (is_published = true OR auth.uid() = user_id OR is_admin_or_manager(auth.uid()));
CREATE POLICY "Admins can manage questions" ON public.product_questions FOR ALL TO authenticated USING (is_admin_or_manager(auth.uid()));
CREATE POLICY "Users can ask questions" ON public.product_questions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ============ CHAT_MESSAGES ============
DROP POLICY IF EXISTS "Admins can manage all messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can send messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can view their own messages" ON public.chat_messages;

CREATE POLICY "Users can view their own messages" ON public.chat_messages FOR SELECT TO authenticated USING (auth.uid() = user_id OR is_admin_or_manager(auth.uid()));
CREATE POLICY "Admins can manage all messages" ON public.chat_messages FOR ALL TO authenticated USING (is_admin_or_manager(auth.uid()));
CREATE POLICY "Users can send messages" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ============ CHAT_SUPPORT_CONVERSATIONS ============
DROP POLICY IF EXISTS "Admins can update all conversations" ON public.chat_support_conversations;
DROP POLICY IF EXISTS "Admins can view all conversations" ON public.chat_support_conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON public.chat_support_conversations;
DROP POLICY IF EXISTS "Users can update their own conversations" ON public.chat_support_conversations;
DROP POLICY IF EXISTS "Users can view their own conversations" ON public.chat_support_conversations;

CREATE POLICY "Users can view their own conversations" ON public.chat_support_conversations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all conversations" ON public.chat_support_conversations FOR SELECT TO authenticated USING (is_admin_or_manager(auth.uid()));
CREATE POLICY "Users can create conversations" ON public.chat_support_conversations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can update all conversations" ON public.chat_support_conversations FOR UPDATE TO authenticated USING (is_admin_or_manager(auth.uid()));
CREATE POLICY "Users can update their own conversations" ON public.chat_support_conversations FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- ============ CHAT_SUPPORT_MESSAGES ============
DROP POLICY IF EXISTS "Admins can create messages in any conversation" ON public.chat_support_messages;
DROP POLICY IF EXISTS "Admins can update any message" ON public.chat_support_messages;
DROP POLICY IF EXISTS "Admins can view all messages" ON public.chat_support_messages;
DROP POLICY IF EXISTS "Message senders can update their messages" ON public.chat_support_messages;
DROP POLICY IF EXISTS "Users can create messages in their conversations" ON public.chat_support_messages;
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.chat_support_messages;

CREATE POLICY "Users can view messages in their conversations" ON public.chat_support_messages FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM chat_support_conversations c WHERE c.id = chat_support_messages.conversation_id AND c.user_id = auth.uid()));
CREATE POLICY "Admins can view all messages" ON public.chat_support_messages FOR SELECT TO authenticated USING (is_admin_or_manager(auth.uid()));
CREATE POLICY "Users can create messages in their conversations" ON public.chat_support_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id AND EXISTS (SELECT 1 FROM chat_support_conversations c WHERE c.id = chat_support_messages.conversation_id AND c.user_id = auth.uid()));
CREATE POLICY "Admins can create messages in any conversation" ON public.chat_support_messages FOR INSERT TO authenticated WITH CHECK (is_admin_or_manager(auth.uid()) AND auth.uid() = sender_id);
CREATE POLICY "Admins can update any message" ON public.chat_support_messages FOR UPDATE TO authenticated USING (is_admin_or_manager(auth.uid()));
CREATE POLICY "Message senders can update their messages" ON public.chat_support_messages FOR UPDATE TO authenticated USING (auth.uid() = sender_id);

-- ============ GIFT_CARDS ============
DROP POLICY IF EXISTS "Admins can manage gift cards" ON public.gift_cards;
DROP POLICY IF EXISTS "Users can view their gift cards" ON public.gift_cards;

CREATE POLICY "Admins can manage gift cards" ON public.gift_cards FOR ALL TO authenticated USING (is_admin_or_manager(auth.uid()));
CREATE POLICY "Users can view their gift cards" ON public.gift_cards FOR SELECT TO authenticated USING (redeemed_by = auth.uid());

-- ============ REMAINING USER-ONLY TABLES ============
-- cart_items
DROP POLICY IF EXISTS "Users can manage their own cart" ON public.cart_items;
CREATE POLICY "Users can manage their own cart" ON public.cart_items FOR ALL TO authenticated USING (auth.uid() = user_id);

-- wishlist
DROP POLICY IF EXISTS "Users can manage wishlist" ON public.wishlist;
CREATE POLICY "Users can manage wishlist" ON public.wishlist FOR ALL TO authenticated USING (auth.uid() = user_id);

-- addresses
DROP POLICY IF EXISTS "Users can manage their own addresses" ON public.addresses;
CREATE POLICY "Users can manage their own addresses" ON public.addresses FOR ALL TO authenticated USING (auth.uid() = user_id);

-- saved_searches
DROP POLICY IF EXISTS "Users can manage own saved searches" ON public.saved_searches;
CREATE POLICY "Users can manage own saved searches" ON public.saved_searches FOR ALL TO authenticated USING (auth.uid() = user_id);

-- comparison_history
DROP POLICY IF EXISTS "Users can manage comparison history" ON public.comparison_history;
CREATE POLICY "Users can manage comparison history" ON public.comparison_history FOR ALL TO authenticated USING (auth.uid() = user_id);

-- push_subscriptions
DROP POLICY IF EXISTS "Users can manage push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can manage push subscriptions" ON public.push_subscriptions FOR ALL TO authenticated USING (auth.uid() = user_id);

-- backup_recovery_codes
DROP POLICY IF EXISTS "Users can manage backup codes" ON public.backup_recovery_codes;
CREATE POLICY "Users can manage backup codes" ON public.backup_recovery_codes FOR ALL TO authenticated USING (auth.uid() = user_id);

-- user_sessions
DROP POLICY IF EXISTS "Users can manage their own sessions" ON public.user_sessions;
CREATE POLICY "Users can manage their own sessions" ON public.user_sessions FOR ALL TO authenticated USING (auth.uid() = user_id);

-- price_drop_alerts
DROP POLICY IF EXISTS "Users can manage own price alerts" ON public.price_drop_alerts;
CREATE POLICY "Users can manage own price alerts" ON public.price_drop_alerts FOR ALL TO authenticated USING (auth.uid() = user_id);

-- referral_codes
DROP POLICY IF EXISTS "Users can create their own referral code" ON public.referral_codes;
DROP POLICY IF EXISTS "Users can view their own referral code" ON public.referral_codes;
CREATE POLICY "Users can view their own referral code" ON public.referral_codes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own referral code" ON public.referral_codes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- referral_tracking
DROP POLICY IF EXISTS "Users can track their referrals" ON public.referral_tracking;
DROP POLICY IF EXISTS "Users can view their referrals" ON public.referral_tracking;
CREATE POLICY "Users can view their referrals" ON public.referral_tracking FOR SELECT TO authenticated USING (auth.uid() = referrer_id);
CREATE POLICY "Users can track their referrals" ON public.referral_tracking FOR INSERT TO authenticated WITH CHECK (auth.uid() = referrer_id OR auth.uid() = referred_user_id);
