import { getCategoryIconComponent, getCategoryIconSource } from '@/lib/categoryIcons';
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

  if (iconValue) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          'inline-flex shrink-0 items-center justify-center leading-none',
          emojiClassName ?? className,
        )}
      >
        {iconValue}
      </span>
    );
  }

  const FallbackIcon = getCategoryIconComponent(categoryName);
  return <FallbackIcon aria-hidden="true" className={className} />;
}
