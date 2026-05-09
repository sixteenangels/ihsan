import type { LucideIcon } from 'lucide-react';
import {
  Baby,
  BookOpen,
  Briefcase,
  Car,
  Dog,
  Dumbbell,
  Flower2,
  Footprints,
  Gamepad2,
  Gem,
  Heart,
  Home,
  Music,
  Package,
  Palette,
  Shirt,
  ShoppingBag,
  Smartphone,
  Sofa,
  Sparkles,
  UtensilsCrossed,
  Watch,
  Wrench,
} from 'lucide-react';

// Map category names to Lucide icon labels used for admin/category metadata.
export const categoryIconMap: Record<string, string> = {
  fashion: 'Shirt',
  clothing: 'Shirt',
  beauty: 'Sparkles',
  'beauty & health': 'Sparkles',
  health: 'Heart',
  electronics: 'Smartphone',
  gadgets: 'Smartphone',
  home: 'Home',
  'home & garden': 'Home',
  food: 'UtensilsCrossed',
  'food & drinks': 'UtensilsCrossed',
  sports: 'Dumbbell',
  'sports & fitness': 'Dumbbell',
  books: 'BookOpen',
  toys: 'Gamepad2',
  kids: 'Baby',
  accessories: 'Watch',
  jewelry: 'Gem',
  shoes: 'Footprints',
  bags: 'ShoppingBag',
  automotive: 'Car',
  pets: 'Dog',
  office: 'Briefcase',
  furniture: 'Sofa',
  music: 'Music',
  art: 'Palette',
  tools: 'Wrench',
  garden: 'Flower2',
};

export const categoryEmojiMap: Record<string, string> = {
  fashion: '👗',
  clothing: '👕',
  beauty: '💄',
  cosmetics: '💅',
  'personal care': '🧴',
  'beauty & health': '✨',
  health: '❤️',
  electronics: '📱',
  gadgets: '🔌',
  'auto parts': '🚘',
  auto: '🚗',
  home: '🏠',
  kitchen: '🍳',
  living: '🛋️',
  'home & living': '🛋️',
  'home & garden': '🌿',
  food: '🍽️',
  drinks: '🥤',
  beverages: '🧃',
  'food & drinks': '🍽️',
  sports: '🏋️',
  fitness: '🏃',
  'sports & fitness': '💪',
  books: '📚',
  toys: '🧸',
  games: '🎮',
  kids: '🍼',
  baby: '🍼',
  accessories: '⌚',
  jewelry: '💎',
  shoes: '👟',
  bags: '👜',
  automotive: '🚗',
  pets: '🐾',
  office: '💼',
  furniture: '🪑',
  music: '🎵',
  art: '🎨',
  tools: '🛠️',
  garden: '🌱',
  deals: '🔥',
  'deals & offers': '🎁',
  offers: '🎁',
  'new arrivals': '✨',
  'trending now': '📈',
  trending: '📈',
  'ready now': '📦',
};

const categoryIconComponents: Record<string, LucideIcon> = {
  Shirt,
  Sparkles,
  Heart,
  Smartphone,
  Home,
  UtensilsCrossed,
  Dumbbell,
  BookOpen,
  Gamepad2,
  Baby,
  Watch,
  Gem,
  Footprints,
  ShoppingBag,
  Car,
  Dog,
  Briefcase,
  Sofa,
  Music,
  Palette,
  Wrench,
  Flower2,
  Package,
};

export function getCategoryIconName(categoryName: string): string {
  const lower = categoryName.toLowerCase();
  // Try exact match first
  if (categoryIconMap[lower]) return categoryIconMap[lower];
  // Try partial match
  for (const [key, icon] of Object.entries(categoryIconMap)) {
    if (lower.includes(key) || key.includes(lower)) return icon;
  }
  return 'Package';
}

export function getCategoryIconComponent(categoryName: string): LucideIcon {
  const iconName = getCategoryIconName(categoryName);
  return categoryIconComponents[iconName] || Package;
}

export function getCategoryEmoji(categoryName: string): string {
  const lower = categoryName.toLowerCase();

  if (categoryEmojiMap[lower]) return categoryEmojiMap[lower];

  for (const [key, emoji] of Object.entries(categoryEmojiMap)) {
    if (lower.includes(key) || key.includes(lower)) return emoji;
  }

  return '📦';
}

export function getCategoryIconSource(icon: string | null | undefined): string | null {
  const value = icon?.trim();

  if (!value) return null;
  if (value.startsWith('data:image/')) return value;
  if (value.startsWith('<svg')) {
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(value)}`;
  }
  if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('//')) {
    return value;
  }
  if (value.startsWith('/')) return value;
  if (value.startsWith('blob:')) return value;

  return null;
}

export function formatCategoryLabel(categoryName: string): string {
  return `${getCategoryEmoji(categoryName)} ${categoryName}`;
}
