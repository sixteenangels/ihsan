import { ChevronDown, ChevronUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface VariantQuantityStepperProps {
  id: string;
  value: string;
  onChange: (nextValue: string) => void;
  max?: number;
  className?: string;
}

const readQuantity = (value: string) => {
  const parsed = Number.parseInt(value || '0', 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

const clampQuantity = (value: number, max?: number) => {
  const upperLimit = max != null ? Math.max(0, max) : Number.MAX_SAFE_INTEGER;
  return Math.min(upperLimit, Math.max(0, value));
};

export function VariantQuantityStepper({ id, value, onChange, max, className }: VariantQuantityStepperProps) {
  const quantity = readQuantity(value);
  const maxQuantity = max != null ? Math.max(0, max) : undefined;
  const canDecrease = quantity > 0;
  const canIncrease = maxQuantity == null || quantity < maxQuantity;

  const setQuantity = (nextValue: number) => {
    const clampedValue = clampQuantity(nextValue, maxQuantity);
    onChange(clampedValue === 0 ? '' : String(clampedValue));
  };

  const handleInputChange = (nextValue: string) => {
    const digitsOnly = nextValue.replace(/\D/g, '');
    if (!digitsOnly) {
      onChange('');
      return;
    }

    onChange(String(clampQuantity(Number.parseInt(digitsOnly, 10), maxQuantity)));
  };

  return (
    <div className={cn('relative h-11 w-24 shrink-0', className)}>
      <Input
        id={id}
        inputMode="numeric"
        pattern="[0-9]*"
        className="h-11 rounded-xl pr-9 text-center text-base font-semibold"
        placeholder="0"
        value={value}
        onChange={(event) => handleInputChange(event.target.value)}
        onBlur={() => setQuantity(quantity)}
      />
      <div className="absolute inset-y-1 right-1 flex w-7 flex-col overflow-hidden rounded-lg border border-border/70 bg-muted/60">
        <button
          type="button"
          className="flex flex-1 items-center justify-center text-foreground transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-35"
          aria-label="Increase quantity"
          disabled={!canIncrease}
          onClick={() => setQuantity(quantity + 1)}
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="flex flex-1 items-center justify-center border-t border-border/70 text-foreground transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-35"
          aria-label="Decrease quantity"
          disabled={!canDecrease}
          onClick={() => setQuantity(quantity - 1)}
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
