// Map category names to Lucide icon names
// Used instead of emojis for category display
export const categoryIconMap: Record<string, string> = {
  'fashion': 'Shirt',
  'clothing': 'Shirt',
  'beauty': 'Sparkles',
  'beauty & health': 'Sparkles',
  'health': 'Heart',
  'electronics': 'Smartphone',
  'gadgets': 'Smartphone',
  'home': 'Home',
  'home & garden': 'Home',
  'food': 'UtensilsCrossed',
  'food & drinks': 'UtensilsCrossed',
  'sports': 'Dumbbell',
  'sports & fitness': 'Dumbbell',
  'books': 'BookOpen',
  'toys': 'Gamepad2',
  'kids': 'Baby',
  'accessories': 'Watch',
  'jewelry': 'Gem',
  'shoes': 'Footprints',
  'bags': 'ShoppingBag',
  'automotive': 'Car',
  'pets': 'Dog',
  'office': 'Briefcase',
  'furniture': 'Sofa',
  'music': 'Music',
  'art': 'Palette',
  'tools': 'Wrench',
  'garden': 'Flower2',
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
