import { BRAND_NAME } from '@/lib/brand';
import { cn } from '@/lib/utils';

type BrandMarkSize = 'sm' | 'md' | 'lg';

interface BrandMarkProps {
  className?: string;
  size?: BrandMarkSize;
}

const sizeClasses: Record<
  BrandMarkSize,
  { root: string; mark: string }
> = {
  sm: {
    root: 'h-8',
    mark: 'w-[5.5rem]',
  },
  md: {
    root: 'h-10',
    mark: 'w-[6.875rem]',
  },
  lg: {
    root: 'h-12',
    mark: 'w-[8.25rem]',
  },
};

export function BrandMark({ className, size = 'md' }: BrandMarkProps) {
  const classes = sizeClasses[size];

  return (
    <span
      aria-label={BRAND_NAME}
      className={cn(
        'inline-flex items-center text-foreground',
        classes.root,
        className,
      )}
    >
      <svg
        aria-hidden="true"
        className={cn('h-full shrink-0 overflow-visible', classes.mark)}
        viewBox="0 0 132 58"
        fill="none"
      >
        <text
          x="66"
          y="30"
          textAnchor="middle"
          dominantBaseline="middle"
          fill="currentColor"
          fontFamily="Montserrat, Avenir Next, Futura, Arial, sans-serif"
          fontSize="27"
          fontWeight="700"
          letterSpacing="13"
        >
          AJYN
        </text>
        <circle
          cx="66"
          cy="51"
          r="4"
          fill="currentColor"
          className="text-primary"
        />
      </svg>
    </span>
  );
}
