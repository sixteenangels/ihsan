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
  emojiClassName?: string;
}

export function CategoryIconDisplay({
  categoryName,
  icon,
  className,
  emojiClassName,
}: CategoryIconDisplayProps) {
  const iconSource = getCategoryIconSource(icon);
  const CustomIcon = getCategoryLucideIcon(icon);
  const iconValue = icon?.trim();

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

  if (CustomIcon) {
    return <CustomIcon aria-hidden="true" className={className} />;
  }

  if (iconValue?.startsWith('text:')) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          'inline-flex shrink-0 items-center justify-center leading-none',
          emojiClassName ?? className,
        )}
      >
        {iconValue.slice(5).trim()}
      </span>
    );
  }

  const FallbackIcon = getCategoryIconComponent(categoryName);
  return <FallbackIcon aria-hidden="true" className={className} />;
}
