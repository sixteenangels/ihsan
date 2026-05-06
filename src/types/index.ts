export interface ProductVariant {
  id: string;
  size?: string;
  color?: string;
  price: number;
  stock: number;
}

export interface ShippingOption {
  id: string;
  type: 'sea' | 'air_normal' | 'air_express';
  name: string;
  price: number;
  estimatedDays: string;
  available: boolean;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  basePrice: number;
  images: string[];
  variants: ProductVariant[];
  shippingOptions: ShippingOption[];
  isGroupBuyEligible: boolean;
  isFlashDeal: boolean;
  isFreeShippingEligible: boolean;
  rating: number;
  reviewCount: number;
}

export interface GroupBuy {
  id: string;
  product: Product;
  currentParticipants: number;
  minParticipants: number;
  deadline: Date;
  discountPercentage: number;
}

export interface CartItem {
  id: string;
  product: Product;
  variant: ProductVariant;
  quantity: number;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  productCount: number;
}
