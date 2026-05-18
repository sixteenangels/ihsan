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
    root: 'h-6',
    mark: 'w-[5.75rem]',
  },
  md: {
    root: 'h-8',
    mark: 'w-[7.5rem]',
  },
  lg: {
    root: 'h-10',
    mark: 'w-[9.25rem]',
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
        viewBox="0 0 156 48"
        fill="none"
      >
        <circle cx="143" cy="43.5" r="4" fill="hsl(var(--primary))" />
        <path
          d="M4 40L17.25 8H23.25L36.5 40H29.25L26.75 33.35H13.55L11.1 40H4ZM15.75 27.4H24.6L20.15 15.7L15.75 27.4Z"
          fill="currentColor"
        />
        <path
          d="M57.8 8H64.7V29.75C64.7 36.9 59.95 40.8 52.95 40.8C47.8 40.8 43.75 38.75 41.15 35L46.25 31.1C47.8 33.3 49.85 34.45 52.55 34.45C56.1 34.45 57.8 32.65 57.8 29.45V8Z"
          fill="currentColor"
        />
        <path
          d="M84.5 40V27.1L71.55 8H79.6L88.05 20.8L96.5 8H104.25L91.4 27.1V40H84.5Z"
          fill="currentColor"
        />
        <path
          d="M114.8 40V8H121.35L137.65 28.25V8H144.55V40H138.55L121.7 19.05V40H114.8Z"
          fill="currentColor"
        />
      </svg>
    </span>
  );
}
