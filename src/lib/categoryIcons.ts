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
