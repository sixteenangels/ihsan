import { z } from 'zod';

// Product validation schema
export const productSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name must be less than 200 characters'),
  description: z.string().max(2000, 'Description must be less than 2000 characters').optional(),
  item_code: z.string().min(1, 'Item code is required').max(50, 'Item code must be less than 50 characters'),
  base_price: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  }, 'Price must be a positive number'),
  category_id: z.string().optional(),
  is_group_buy_eligible: z.boolean(),
  is_flash_deal: z.boolean(),
  is_free_shipping: z.boolean(),
  is_active: z.boolean(),
});

export type ProductFormData = z.infer<typeof productSchema>;

// Shipping class validation schema
export const shippingClassSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  shipping_type_id: z.string().min(1, 'Shipping type is required'),
  base_price: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num >= 0;
  }, 'Base price must be a non-negative number'),
  estimated_days_min: z.string().refine((val) => {
    const num = parseInt(val);
    return !isNaN(num) && num >= 1;
  }, 'Minimum days must be at least 1'),
  estimated_days_max: z.string().refine((val) => {
    const num = parseInt(val);
    return !isNaN(num) && num >= 1;
  }, 'Maximum days must be at least 1'),
}).refine((data) => {
  const min = parseInt(data.estimated_days_min);
  const max = parseInt(data.estimated_days_max);
  return max >= min;
}, {
  message: 'Maximum days must be greater than or equal to minimum days',
  path: ['estimated_days_max'],
});

export type ShippingClassFormData = z.infer<typeof shippingClassSchema>;

// Shipping type validation schema
export const shippingTypeSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
});

export type ShippingTypeFormData = z.infer<typeof shippingTypeSchema>;

// Coupon validation schema
export const couponSchema = z.object({
  code: z.string()
    .min(1, 'Coupon code is required')
    .max(50, 'Coupon code must be less than 50 characters')
    .regex(/^[A-Z0-9_-]+$/i, 'Coupon code must contain only letters, numbers, hyphens, and underscores'),
  type: z.enum(['percentage', 'fixed_amount']),
  value: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  }, 'Value must be a positive number'),
  min_order_amount: z.string().optional().refine((val) => {
    if (!val || val === '') return true;
    const num = parseFloat(val);
    return !isNaN(num) && num >= 0;
  }, 'Minimum order amount must be a non-negative number'),
  max_uses: z.string().optional().refine((val) => {
    if (!val || val === '') return true;
    const num = parseInt(val);
    return !isNaN(num) && num >= 1;
  }, 'Maximum uses must be at least 1'),
  expires_at: z.string().optional(),
}).refine((data) => {
  if (data.type === 'percentage') {
    const val = parseFloat(data.value);
    return val > 0 && val <= 100;
  }
  return true;
}, {
  message: 'Percentage must be between 1 and 100',
  path: ['value'],
});

export type CouponFormData = z.infer<typeof couponSchema>;

// Group buy validation schema
export const groupBuySchema = z.object({
  product_id: z.string().min(1, 'Product is required'),
  min_participants: z.string().refine((val) => {
    const num = parseInt(val);
    return !isNaN(num) && num >= 2;
  }, 'Minimum participants must be at least 2'),
  discount_percentage: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0 && num <= 99;
  }, 'Discount must be between 1 and 99 percent'),
  expires_at: z.string().min(1, 'Expiration date is required').refine((val) => {
    const date = new Date(val);
    return date > new Date();
  }, 'Expiration date must be in the future'),
});

export type GroupBuyFormData = z.infer<typeof groupBuySchema>;

// Helper function to validate and get errors
export function validateForm<T>(schema: z.ZodSchema<T>, data: unknown): { success: boolean; data?: T; errors?: Record<string, string> } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  const errors: Record<string, string> = {};
  result.error.errors.forEach((err) => {
    const path = err.path.join('.');
    if (!errors[path]) {
      errors[path] = err.message;
    }
  });
  
  return { success: false, errors };
}
