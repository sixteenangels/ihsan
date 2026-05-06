
-- =============================================
-- FIX ALL RESTRICTIVE RLS POLICIES
-- Recreate every policy as PERMISSIVE (default)
-- Tables already fixed: orders, order_items, order_tracking
-- =============================================

-- gift_cards
DROP POLICY IF EXISTS "Admins can manage gift cards" ON public.gift_cards;
DROP POLICY IF EXISTS "Users can view their gift cards" ON public.gift_cards;
CREATE POLICY "Admins can manage gift cards" ON public.gift_cards FOR ALL TO authenticated USING (is_admin_or_manager(auth.uid()));
CREATE POLICY "Users can view their gift cards" ON public.gift_cards FOR SELECT TO authenticated USING (redeemed_by = auth.uid());

-- shipping_types
DROP POLICY IF EXISTS "Admins can manage shipping types" ON public.shipping_types;
DROP POLICY IF EXISTS "Shipping types are viewable by everyone" ON public.shipping_types;
CREATE POLICY "Admins can manage shipping types" ON public.shipping_types FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Shipping types are viewable by everyone" ON public.shipping_types FOR SELECT USING (true);

-- shipping_classes
DROP POLICY IF EXISTS "Admins can manage shipping classes" ON public.shipping_classes;
DROP POLICY IF EXISTS "Shipping classes are viewable by everyone" ON public.shipping_classes;
CREATE POLICY "Admins can manage shipping classes" ON public.shipping_classes FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Shipping classes are viewable by everyone" ON public.shipping_classes FOR SELECT USING (true);

-- categories
DROP POLICY IF EXISTS "Admins and managers can manage categories" ON public.categories;
DROP POLICY IF EXISTS "Categories are viewable by everyone" ON public.categories;
CREATE POLICY "Admins and managers can manage categories" ON public.categories FOR ALL TO authenticated USING (is_admin_or_manager(auth.uid()));
CREATE POLICY "Categories are viewable by everyone" ON public.categories FOR SELECT USING (true);

-- group_buy_participants
DROP POLICY IF EXISTS "Anyone can view participant counts" ON public.group_buy_participants;
DROP POLICY IF EXISTS "Users and admins can view group buy participation" ON public.group_buy_participants;
DROP POLICY IF EXISTS "Users can join group buys" ON public.group_buy_participants;
DROP POLICY IF EXISTS "Users can leave group buys" ON public.group_buy_participants;
DROP POLICY IF EXISTS "Users can update their own participation" ON public.group_buy_participants;
CREATE POLICY "Anyone can view participant counts" ON public.group_buy_participants FOR SELECT USING (true);
CREATE POLICY "Users can join group buys" ON public.group_buy_participants FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can leave group buys" ON public.group_buy_participants FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own participation" ON public.group_buy_participants FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- product_bundles
DROP POLICY IF EXISTS "Admins can manage bundles" ON public.product_bundles;
DROP POLICY IF EXISTS "Bundles viewable by everyone" ON public.product_bundles;
CREATE POLICY "Admins can manage bundles" ON public.product_bundles FOR ALL TO authenticated USING (is_admin_or_manager(auth.uid()));
CREATE POLICY "Bundles viewable by everyone" ON public.product_bundles FOR SELECT USING (true);

-- reviews
DROP POLICY IF EXISTS "Admins can manage all reviews" ON public.reviews;
DROP POLICY IF EXISTS "Approved reviews are viewable by everyone" ON public.reviews;
DROP POLICY IF EXISTS "Users can create reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users can update their own reviews" ON public.reviews;
CREATE POLICY "Admins can manage all reviews" ON public.reviews FOR ALL TO authenticated USING (is_admin_or_manager(auth.uid()));
CREATE POLICY "Approved reviews are viewable by everyone" ON public.reviews FOR SELECT USING ((is_approved = true) OR (auth.uid() = user_id) OR is_admin_or_manager(auth.uid()));
CREATE POLICY "Users can create reviews" ON public.reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own reviews" ON public.reviews FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- receipts
DROP POLICY IF EXISTS "Admins can manage all receipts" ON public.receipts;
DROP POLICY IF EXISTS "Users can view receipts for their orders" ON public.receipts;
CREATE POLICY "Admins can manage all receipts" ON public.receipts FOR ALL TO authenticated USING (is_admin_or_manager(auth.uid()));
CREATE POLICY "Users can view receipts for their orders" ON public.receipts FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = receipts.order_id AND (orders.user_id = auth.uid() OR is_admin_or_manager(auth.uid()))));

-- coupons
DROP POLICY IF EXISTS "Active coupons are viewable by authenticated users" ON public.coupons;
DROP POLICY IF EXISTS "Admins can manage coupons" ON public.coupons;
CREATE POLICY "Active coupons are viewable by authenticated users" ON public.coupons FOR SELECT USING ((is_active = true) OR is_admin_or_manager(auth.uid()));
CREATE POLICY "Admins can manage coupons" ON public.coupons FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

-- chat_support_conversations
DROP POLICY IF EXISTS "Admins can update all conversations" ON public.chat_support_conversations;
DROP POLICY IF EXISTS "Admins can view all conversations" ON public.chat_support_conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON public.chat_support_conversations;
DROP POLICY IF EXISTS "Users can update their own conversations" ON public.chat_support_conversations;
DROP POLICY IF EXISTS "Users can view their own conversations" ON public.chat_support_conversations;
CREATE POLICY "Admins can view all conversations" ON public.chat_support_conversations FOR SELECT TO authenticated USING (is_admin_or_manager(auth.uid()));
CREATE POLICY "Admins can update all conversations" ON public.chat_support_conversations FOR UPDATE TO authenticated USING (is_admin_or_manager(auth.uid()));
CREATE POLICY "Users can create conversations" ON public.chat_support_conversations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own conversations" ON public.chat_support_conversations FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own conversations" ON public.chat_support_conversations FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- store_settings
DROP POLICY IF EXISTS "Admins can manage store settings" ON public.store_settings;
DROP POLICY IF EXISTS "Store settings are viewable by everyone" ON public.store_settings;
CREATE POLICY "Admins can manage store settings" ON public.store_settings FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Store settings are viewable by everyone" ON public.store_settings FOR SELECT USING (true);

-- chat_messages
DROP POLICY IF EXISTS "Admins can manage all messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can send messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can view their own messages" ON public.chat_messages;
CREATE POLICY "Admins can manage all messages" ON public.chat_messages FOR ALL TO authenticated USING (is_admin_or_manager(auth.uid()));
CREATE POLICY "Users can send messages" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own messages" ON public.chat_messages FOR SELECT TO authenticated USING ((auth.uid() = user_id) OR is_admin_or_manager(auth.uid()));

-- chat_support_messages
DROP POLICY IF EXISTS "Admins can create messages in any conversation" ON public.chat_support_messages;
DROP POLICY IF EXISTS "Admins can update any message" ON public.chat_support_messages;
DROP POLICY IF EXISTS "Admins can view all messages" ON public.chat_support_messages;
DROP POLICY IF EXISTS "Message senders can update their messages" ON public.chat_support_messages;
DROP POLICY IF EXISTS "Users can create messages in their conversations" ON public.chat_support_messages;
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.chat_support_messages;
CREATE POLICY "Admins can view all messages" ON public.chat_support_messages FOR SELECT TO authenticated USING (is_admin_or_manager(auth.uid()));
CREATE POLICY "Admins can update any message" ON public.chat_support_messages FOR UPDATE TO authenticated USING (is_admin_or_manager(auth.uid()));
CREATE POLICY "Admins can create messages in any conversation" ON public.chat_support_messages FOR INSERT TO authenticated WITH CHECK (is_admin_or_manager(auth.uid()) AND auth.uid() = sender_id);
CREATE POLICY "Message senders can update their messages" ON public.chat_support_messages FOR UPDATE TO authenticated USING (auth.uid() = sender_id);
CREATE POLICY "Users can create messages in their conversations" ON public.chat_support_messages FOR INSERT TO authenticated WITH CHECK ((auth.uid() = sender_id) AND EXISTS (SELECT 1 FROM chat_support_conversations c WHERE c.id = chat_support_messages.conversation_id AND c.user_id = auth.uid()));
CREATE POLICY "Users can view messages in their conversations" ON public.chat_support_messages FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM chat_support_conversations c WHERE c.id = chat_support_messages.conversation_id AND c.user_id = auth.uid()));

-- referral_codes
DROP POLICY IF EXISTS "Users can create their own referral code" ON public.referral_codes;
DROP POLICY IF EXISTS "Users can view their own referral code" ON public.referral_codes;
CREATE POLICY "Users can create their own referral code" ON public.referral_codes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own referral code" ON public.referral_codes FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- product_shipping_rules
DROP POLICY IF EXISTS "Admins and managers can manage shipping rules" ON public.product_shipping_rules;
DROP POLICY IF EXISTS "Shipping rules are viewable by everyone" ON public.product_shipping_rules;
CREATE POLICY "Admins and managers can manage shipping rules" ON public.product_shipping_rules FOR ALL TO authenticated USING (is_admin_or_manager(auth.uid()));
CREATE POLICY "Shipping rules are viewable by everyone" ON public.product_shipping_rules FOR SELECT USING (true);

-- user_roles
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Admins can manage all roles" ON public.user_roles FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- saved_searches
DROP POLICY IF EXISTS "Users can manage own saved searches" ON public.saved_searches;
CREATE POLICY "Users can manage own saved searches" ON public.saved_searches FOR ALL TO authenticated USING (auth.uid() = user_id);

-- product_questions
DROP POLICY IF EXISTS "Admins can manage questions" ON public.product_questions;
DROP POLICY IF EXISTS "Questions viewable by everyone when published" ON public.product_questions;
DROP POLICY IF EXISTS "Users can ask questions" ON public.product_questions;
CREATE POLICY "Admins can manage questions" ON public.product_questions FOR ALL TO authenticated USING (is_admin_or_manager(auth.uid()));
CREATE POLICY "Questions viewable by everyone when published" ON public.product_questions FOR SELECT USING ((is_published = true) OR (auth.uid() = user_id) OR is_admin_or_manager(auth.uid()));
CREATE POLICY "Users can ask questions" ON public.product_questions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- cart_items
DROP POLICY IF EXISTS "Users can manage their own cart" ON public.cart_items;
DROP POLICY IF EXISTS "Users can view their own cart" ON public.cart_items;
CREATE POLICY "Users can manage their own cart" ON public.cart_items FOR ALL TO authenticated USING (auth.uid() = user_id);

-- refund_requests
DROP POLICY IF EXISTS "Admins can update refund requests" ON public.refund_requests;
DROP POLICY IF EXISTS "Admins can view all refund requests" ON public.refund_requests;
DROP POLICY IF EXISTS "Users can create refund requests" ON public.refund_requests;
DROP POLICY IF EXISTS "Users can view own refund requests" ON public.refund_requests;
CREATE POLICY "Admins can update refund requests" ON public.refund_requests FOR UPDATE TO authenticated USING (is_admin_or_manager(auth.uid()));
CREATE POLICY "Admins can view all refund requests" ON public.refund_requests FOR SELECT TO authenticated USING (is_admin_or_manager(auth.uid()));
CREATE POLICY "Users can create refund requests" ON public.refund_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own refund requests" ON public.refund_requests FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- price_drop_alerts
DROP POLICY IF EXISTS "Users can manage own price alerts" ON public.price_drop_alerts;
CREATE POLICY "Users can manage own price alerts" ON public.price_drop_alerts FOR ALL TO authenticated USING (auth.uid() = user_id);

-- products
DROP POLICY IF EXISTS "Active products are viewable by everyone" ON public.products;
DROP POLICY IF EXISTS "Admins and managers can manage products" ON public.products;
CREATE POLICY "Admins and managers can manage products" ON public.products FOR ALL TO authenticated USING (is_admin_or_manager(auth.uid()));
CREATE POLICY "Active products are viewable by everyone" ON public.products FOR SELECT USING ((is_active = true) OR is_admin_or_manager(auth.uid()));

-- group_buys
DROP POLICY IF EXISTS "Admins can manage all group buys" ON public.group_buys;
DROP POLICY IF EXISTS "Group buys are viewable by everyone" ON public.group_buys;
DROP POLICY IF EXISTS "Users can create group buys" ON public.group_buys;
CREATE POLICY "Admins can manage all group buys" ON public.group_buys FOR ALL TO authenticated USING (is_admin_or_manager(auth.uid()));
CREATE POLICY "Group buys are viewable by everyone" ON public.group_buys FOR SELECT USING (true);
CREATE POLICY "Users can create group buys" ON public.group_buys FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

-- referral_tracking
DROP POLICY IF EXISTS "Users can track their referrals" ON public.referral_tracking;
DROP POLICY IF EXISTS "Users can view their referrals" ON public.referral_tracking;
CREATE POLICY "Users can track their referrals" ON public.referral_tracking FOR INSERT TO authenticated WITH CHECK ((auth.uid() = referrer_id) OR (auth.uid() = referred_user_id));
CREATE POLICY "Users can view their referrals" ON public.referral_tracking FOR SELECT TO authenticated USING (auth.uid() = referrer_id);

-- notifications
DROP POLICY IF EXISTS "Admins can manage all notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Admins can manage all notifications" ON public.notifications FOR ALL TO authenticated USING (is_admin_or_manager(auth.uid()));
CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT TO authenticated USING ((auth.uid() = user_id) OR (is_broadcast = true) OR is_admin_or_manager(auth.uid()));

-- push_subscriptions
DROP POLICY IF EXISTS "Users can create their own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can delete their own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can update their own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can view their own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can manage push subscriptions" ON public.push_subscriptions FOR ALL TO authenticated USING (auth.uid() = user_id);

-- loyalty_points
DROP POLICY IF EXISTS "Admins can manage points" ON public.loyalty_points;
DROP POLICY IF EXISTS "System can insert points" ON public.loyalty_points;
DROP POLICY IF EXISTS "Users can view their own points" ON public.loyalty_points;
CREATE POLICY "Admins can manage points" ON public.loyalty_points FOR ALL TO authenticated USING (is_admin_or_manager(auth.uid()));
CREATE POLICY "System can insert points" ON public.loyalty_points FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own points" ON public.loyalty_points FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- addresses
DROP POLICY IF EXISTS "Users can manage their own addresses" ON public.addresses;
CREATE POLICY "Users can manage their own addresses" ON public.addresses FOR ALL TO authenticated USING (auth.uid() = user_id);

-- product_images
DROP POLICY IF EXISTS "Admins and managers can manage images" ON public.product_images;
DROP POLICY IF EXISTS "Product images are viewable by everyone" ON public.product_images;
CREATE POLICY "Admins and managers can manage images" ON public.product_images FOR ALL TO authenticated USING (is_admin_or_manager(auth.uid()));
CREATE POLICY "Product images are viewable by everyone" ON public.product_images FOR SELECT USING (true);

-- comparison_history
DROP POLICY IF EXISTS "Users can create their own comparison history" ON public.comparison_history;
DROP POLICY IF EXISTS "Users can delete their own comparison history" ON public.comparison_history;
DROP POLICY IF EXISTS "Users can view their own comparison history" ON public.comparison_history;
CREATE POLICY "Users can manage comparison history" ON public.comparison_history FOR ALL TO authenticated USING (auth.uid() = user_id);

-- profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (is_admin_or_manager(auth.uid()));
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- wishlist
DROP POLICY IF EXISTS "Users can add to their own wishlist" ON public.wishlist;
DROP POLICY IF EXISTS "Users can remove from their own wishlist" ON public.wishlist;
DROP POLICY IF EXISTS "Users can view their own wishlist" ON public.wishlist;
CREATE POLICY "Users can manage wishlist" ON public.wishlist FOR ALL TO authenticated USING (auth.uid() = user_id);

-- product_variants
DROP POLICY IF EXISTS "Admins and managers can manage variants" ON public.product_variants;
DROP POLICY IF EXISTS "Product variants are viewable by everyone" ON public.product_variants;
CREATE POLICY "Admins and managers can manage variants" ON public.product_variants FOR ALL TO authenticated USING (is_admin_or_manager(auth.uid()));
CREATE POLICY "Product variants are viewable by everyone" ON public.product_variants FOR SELECT USING (true);

-- backup_recovery_codes
DROP POLICY IF EXISTS "Users can create their own backup codes" ON public.backup_recovery_codes;
DROP POLICY IF EXISTS "Users can delete their own backup codes" ON public.backup_recovery_codes;
DROP POLICY IF EXISTS "Users can update their own backup codes" ON public.backup_recovery_codes;
DROP POLICY IF EXISTS "Users can view their own backup codes" ON public.backup_recovery_codes;
CREATE POLICY "Users can manage backup codes" ON public.backup_recovery_codes FOR ALL TO authenticated USING (auth.uid() = user_id);

-- user_sessions
DROP POLICY IF EXISTS "Users can delete their own sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "Users can insert their own sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "Users can update their own sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "Users can view their own sessions" ON public.user_sessions;
CREATE POLICY "Users can manage their own sessions" ON public.user_sessions FOR ALL TO authenticated USING (auth.uid() = user_id);

-- manager_permissions
DROP POLICY IF EXISTS "Admins can manage permissions" ON public.manager_permissions;
DROP POLICY IF EXISTS "Managers can view own permissions" ON public.manager_permissions;
CREATE POLICY "Admins can manage permissions" ON public.manager_permissions FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Managers can view own permissions" ON public.manager_permissions FOR SELECT TO authenticated USING (auth.uid() = user_id);
