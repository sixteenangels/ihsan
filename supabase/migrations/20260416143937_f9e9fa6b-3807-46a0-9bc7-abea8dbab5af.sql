-- Add new statuses to the order_status enum for courier flow
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'order_processed' AFTER 'payment_received';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'handed_to_courier' AFTER 'ready_for_delivery';
