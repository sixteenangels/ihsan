import {
  getCategoryIconComponent,
  getCategoryIconSource,
  getCategoryLucideIcon,
} from '@/lib/categoryIcons';
import { cn } from '@/lib/utils';

interface CategoryIconDisplayProps {
  categoryName: string;
  icon?: string | null;
  className?: string;
}

export function CategoryIconDisplay({
  categoryName,
  icon,
  className,
}: CategoryIconDisplayProps) {
  const iconSource = getCategoryIconSource(icon);
  const customIcon = getCategoryLucideIcon(icon);

  if (iconSource) {
    return (
      <img
        src={iconSource}
        alt=""
        aria-hidden="true"
        className={cn('shrink-0 object-contain', className)}
      />
    );
  }

  if (customIcon) {
    const CustomIcon = customIcon;
    return <CustomIcon aria-hidden="true" className={className} />;
  }

  const fallbackIcon = getCategoryIconComponent(categoryName);
  const FallbackIcon = fallbackIcon;
  return <FallbackIcon aria-hidden="true" className={className} />;
}
