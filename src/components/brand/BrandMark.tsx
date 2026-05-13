import { BRAND_NAME, BRAND_SHORT_NAME } from '@/lib/brand';
import { cn } from '@/lib/utils';

type BrandMarkSize = 'sm' | 'md' | 'lg';

interface BrandMarkProps {
  className?: string;
  size?: BrandMarkSize;
}

const sizeClasses: Record<
  BrandMarkSize,
  { root: string; wordmark: string; dot: string }
> = {
  sm: {
    root: 'gap-1.5',
    wordmark: 'text-lg sm:text-xl',
    dot: 'h-1.5 w-1.5',
  },
  md: {
    root: 'gap-2',
    wordmark: 'text-2xl',
    dot: 'h-2 w-2',
  },
  lg: {
    root: 'gap-2.5',
    wordmark: 'text-3xl',
    dot: 'h-2.5 w-2.5',
  },
};

export function BrandMark({ className, size = 'md' }: BrandMarkProps) {
  const classes = sizeClasses[size];

  return (
    <span
      aria-label={BRAND_NAME}
      className={cn(
        'inline-flex items-end font-medium leading-none text-foreground',
        classes.root,
        className,
      )}
    >
      <span className={cn('font-serif font-bold uppercase tracking-[0.18em]', classes.wordmark)}>
        {BRAND_SHORT_NAME}
      </span>
      <span
        aria-hidden="true"
        className={cn('mb-[0.52em] shrink-0 rounded-full bg-primary', classes.dot)}
      />
    </span>
  );
}
