export const AFTER_SALES_CATEGORY = 'After-Sales';
export const AFTER_SALES_ATTACHMENT_BUCKET = 'after-sales-attachments';
export const AFTER_SALES_MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
export const AFTER_SALES_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export type AfterSalesSupportType =
  | 'damaged_item'
  | 'wrong_item_received'
  | 'missing_item_accessory'
  | 'refund_request'
  | 'exchange_request'
  | 'product_quality_concern'
  | 'other';

type SupportPriority = 'low' | 'normal' | 'high' | 'urgent';

export const AFTER_SALES_SUPPORT_OPTIONS: Array<{
  value: AfterSalesSupportType;
  label: string;
  description: string;
  priority: SupportPriority;
}> = [
  {
    value: 'damaged_item',
    label: 'Damaged item',
    description: 'Item arrived broken, torn, leaking, or visibly damaged.',
    priority: 'high',
  },
  {
    value: 'wrong_item_received',
    label: 'Wrong item received',
    description: 'The delivered item does not match what was ordered.',
    priority: 'high',
  },
  {
    value: 'missing_item_accessory',
    label: 'Missing item/accessory',
    description: 'Something expected in the package was missing.',
    priority: 'high',
  },
  {
    value: 'refund_request',
    label: 'Refund request',
    description: 'Customer is requesting a refund after delivery.',
    priority: 'high',
  },
  {
    value: 'exchange_request',
    label: 'Exchange request',
    description: 'Customer wants a replacement or exchange.',
    priority: 'high',
  },
  {
    value: 'product_quality_concern',
    label: 'Product quality concern',
    description: 'The item quality fell below expectations after inspection.',
    priority: 'normal',
  },
  {
    value: 'other',
    label: 'Other',
    description: 'Any other after-sales issue that needs support review.',
    priority: 'normal',
  },
];

export function getAfterSalesSupportLabel(type: string | null | undefined) {
  return AFTER_SALES_SUPPORT_OPTIONS.find((option) => option.value === type)?.label || 'After-sales request';
}

export function getAfterSalesSupportPriority(type: AfterSalesSupportType): SupportPriority {
  return AFTER_SALES_SUPPORT_OPTIONS.find((option) => option.value === type)?.priority || 'normal';
}

