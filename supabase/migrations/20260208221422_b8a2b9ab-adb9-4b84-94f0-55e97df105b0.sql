-- Add new order status values to the enum
-- First rename the old enum
ALTER TYPE order_status RENAME TO order_status_old;

-- Create new enum with all values including new ones
CREATE TYPE order_status AS ENUM (
  'pending',
  'payment_received',
  'order_placed',
  'confirmed',
  'processing',
  'packed_for_delivery',
  'shipped',
  'in_transit',
  'in_ghana',
  'ready_for_delivery',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'refunded'
);

-- Update the orders table to use the new enum
ALTER TABLE orders 
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE order_status USING status::text::order_status,
  ALTER COLUMN status SET DEFAULT 'pending'::order_status;