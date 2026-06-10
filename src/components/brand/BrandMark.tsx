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
    mark: 'w-12',
  },
  md: {
    root: 'h-10',
    mark: 'w-[3.75rem]',
  },
  lg: {
    root: 'h-12',
    mark: 'w-[4.5rem]',
  },
};

const BRAND_DOT_COLOR = '#c96500';

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
        viewBox="40 96 444 320"
        fill="none"
      >
        <path
          fill="currentColor"
          d="M58 158c48 54 133 54 219 102-70-21-154-7-209-74-6-8-9-17-10-28Z"
        />
        <path
          fill="currentColor"
          d="M72 231c51 57 146 37 214 91-69-18-157 12-210-61-7-10-8-20-4-30Z"
        />
        <path
          fill="currentColor"
          fillRule="evenodd"
          clipRule="evenodd"
          d="M220 392 328 118h27l111 274h-49L340 171 266 392h-46ZM299 321h95l-52-126-43 126Z"
        />
        <path
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="17"
          d="M264 262c47 17 90 45 139 70"
        />
        <circle cx="430" cy="130" r="22" fill={BRAND_DOT_COLOR} />
      </svg>
    </span>
  );
}
