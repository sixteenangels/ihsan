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
  TrendingUp,
  UtensilsCrossed,
  Watch,
  Wrench,
  Zap,
} from 'lucide-react';

const categoryIconComponents = {
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
  TrendingUp,
  UtensilsCrossed,
  Watch,
  Wrench,
  Zap,
} satisfies Record<string, LucideIcon>;

type CategoryIconName = keyof typeof categoryIconComponents;

export interface CategoryIconPreset {
  label: string;
  iconName?: CategoryIconName;
  token: string;
  matchers: string[];
  aliases?: string[];
  source?: string;
}

export const categoryIconPresets: CategoryIconPreset[] = [
  { label: 'General', iconName: 'Package', token: 'lucide:Package', matchers: ['general', 'all', 'misc', 'ready now'] },
  { label: 'Fashion', iconName: 'Shirt', token: 'lucide:Shirt', matchers: ['fashion', 'clothing', 'apparel'] },
  { label: 'Beauty', iconName: 'Sparkles', token: 'lucide:Sparkles', matchers: ['beauty', 'cosmetics', 'personal care', 'new arrivals'] },
  { label: 'Health', iconName: 'Heart', token: 'lucide:Heart', matchers: ['health', 'wellness'] },
  { label: 'Electronics', iconName: 'Smartphone', token: 'lucide:Smartphone', matchers: ['electronics', 'gadgets', 'tech'] },
  { label: 'Home', iconName: 'Home', token: 'lucide:Home', matchers: ['home', 'home & garden', 'home & living', 'living', 'kitchen'] },
  { label: 'Food', iconName: 'UtensilsCrossed', token: 'lucide:UtensilsCrossed', matchers: ['food', 'food & drinks', 'drinks', 'beverages'] },
  { label: 'Sports', iconName: 'Dumbbell', token: 'lucide:Dumbbell', matchers: ['sports', 'fitness', 'sports & fitness'] },
  { label: 'Books', iconName: 'BookOpen', token: 'lucide:BookOpen', matchers: ['books'] },
  { label: 'Toys', iconName: 'Gamepad2', token: 'lucide:Gamepad2', matchers: ['toys', 'games'] },
  { label: 'Kids', iconName: 'Baby', token: 'lucide:Baby', matchers: ['kids', 'baby'] },
  { label: 'Accessories', iconName: 'Watch', token: 'lucide:Watch', matchers: ['accessories'] },
  { label: 'Jewelry', iconName: 'Gem', token: 'lucide:Gem', matchers: ['jewelry'] },
  { label: 'Shoes', iconName: 'Footprints', token: 'lucide:Footprints', matchers: ['shoes', 'footwear'] },
  {
    label: 'Trending',
    iconName: 'TrendingUp',
    token: 'svg:trending-up',
    source: '/category-icons/trending-up.svg',
    matchers: ['trending', 'trending now', 'hot picks', 'rising'],
    aliases: ['\uD83D\uDCC8', 'text:\uD83D\uDCC8'],
  },
  {
    label: 'Flash Deals',
    iconName: 'Zap',
    token: 'svg:flash-deals',
    source: '/category-icons/flash-deals.svg',
    matchers: ['flash deals', 'deals', 'deals & offers', 'offers', 'sale', 'lightning deals'],
    aliases: ['\u26A1', '\u26A1\uFE0F', 'text:\u26A1', 'text:\u26A1\uFE0F'],
  },
  { label: 'Bags', iconName: 'ShoppingBag', token: 'lucide:ShoppingBag', matchers: ['bags'] },
  { label: 'Automotive', iconName: 'Car', token: 'lucide:Car', matchers: ['automotive', 'auto', 'auto parts'] },
  { label: 'Pets', iconName: 'Dog', token: 'lucide:Dog', matchers: ['pets'] },
  { label: 'Office', iconName: 'Briefcase', token: 'lucide:Briefcase', matchers: ['office', 'business'] },
  { label: 'Furniture', iconName: 'Sofa', token: 'lucide:Sofa', matchers: ['furniture'] },
  { label: 'Music', iconName: 'Music', token: 'lucide:Music', matchers: ['music'] },
  { label: 'Art', iconName: 'Palette', token: 'lucide:Palette', matchers: ['art', 'craft'] },
  { label: 'Tools', iconName: 'Wrench', token: 'lucide:Wrench', matchers: ['tools', 'hardware'] },
  { label: 'Garden', iconName: 'Flower2', token: 'lucide:Flower2', matchers: ['garden', 'plants'] },
];

function normalizeIconKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function isExternalIconValue(value: string): boolean {
  return (
    value.startsWith('data:image/') ||
    value.startsWith('<svg') ||
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('//') ||
    value.startsWith('/') ||
    value.startsWith('blob:')
  );
}

function resolveCategoryIconPreset(value: string | null | undefined): CategoryIconPreset | null {
  const trimmedValue = value?.trim();
  if (!trimmedValue || isExternalIconValue(trimmedValue)) {
    return null;
  }

  const normalizedValue = normalizeIconKey(trimmedValue);

  for (const preset of categoryIconPresets) {
    if (preset.aliases?.includes(trimmedValue)) {
      return preset;
    }

    const presetTokens = [
      preset.token,
      preset.label,
      preset.iconName,
      ...preset.matchers,
    ]
      .filter((token): token is string => Boolean(token))
      .map(normalizeIconKey);

    if (presetTokens.includes(normalizedValue)) {
      return preset;
    }
  }

  return null;
}

export function getCategoryIconName(categoryName: string): CategoryIconName {
  return resolveCategoryIconPreset(categoryName)?.iconName ?? 'Package';
}

export function getCategoryLucideIcon(icon: string | null | undefined): LucideIcon | null {
  const preset = resolveCategoryIconPreset(icon);
  if (!preset?.iconName) return null;
  return categoryIconComponents[preset.iconName] ?? null;
}

export function getCategoryIconToken(icon: string | null | undefined): string | null {
  return resolveCategoryIconPreset(icon)?.token ?? null;
}

export function getCategoryIconComponent(categoryName: string): LucideIcon {
  const iconName = getCategoryIconName(categoryName);
  return categoryIconComponents[iconName] || Package;
}

export function getCategoryIconSource(icon: string | null | undefined): string | null {
  const value = icon?.trim();

  if (!value) return null;

  const presetSource = resolveCategoryIconPreset(value)?.source;
  if (presetSource) return presetSource;
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
