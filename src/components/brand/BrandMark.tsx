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

const BRAND_LETTER_COLOR = '#d8cec4';
const BRAND_DOT_COLOR = '#d97822';

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
          y="23"
          textAnchor="middle"
          dominantBaseline="middle"
          fill={BRAND_LETTER_COLOR}
          fontFamily="Montserrat, Avenir Next, Futura, Arial, sans-serif"
          fontSize="26"
          fontWeight="700"
          letterSpacing="10"
        >
          AJYN
        </text>
        <circle
          cx="66"
          cy="45"
          r="3.8"
          fill={BRAND_DOT_COLOR}
        />
      </svg>
    </span>
  );
}
