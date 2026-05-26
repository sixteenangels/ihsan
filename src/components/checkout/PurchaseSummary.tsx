import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ChevronRight, Loader2, Lock, PencilLine, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface PurchaseSummaryInfoCard {
  title: string;
  detail: string;
  subdetail?: string | null;
  amount?: string | null;
  icon: LucideIcon;
  onClick?: () => void;
}

export interface PurchaseSummaryItem {
  id: string;
  title: string;
  imageUrl?: string | null;
  quantity?: number | string | null;
  amount?: string | null;
  subtitle?: string | null;
  details?: Array<string | null | undefined>;
  warning?: string | null;
  action?: ReactNode;
}

export interface PurchaseSummaryTotalRow {
  label: string;
  value: string;
  emphasis?: boolean;
  tone?: 'default' | 'primary' | 'success' | 'warning';
}

interface PurchaseSummaryProps {
  title?: string;
  subtitle?: string;
  shipping?: PurchaseSummaryInfoCard | null;
  address?: PurchaseSummaryInfoCard | null;
  itemsTitle?: string;
  itemsSubtitle?: string;
  items: PurchaseSummaryItem[];
  totalsTitle?: string;
  totals: PurchaseSummaryTotalRow[];
  makeChangesLabel?: string;
  payLabel?: string;
  secureText?: string;
  isProcessing?: boolean;
  payDisabled?: boolean;
  onMakeChanges?: () => void;
  onPay?: () => void;
  className?: string;
  children?: ReactNode;
}

function TotalValue({ row }: { row: PurchaseSummaryTotalRow }) {
  const className = cn(
    'shrink-0 text-right',
    row.emphasis ? 'text-2xl font-bold' : 'text-sm font-medium',
    row.tone === 'success' && 'text-emerald-500',
    row.tone === 'warning' && 'text-amber-500',
    (row.tone === 'primary' || row.emphasis) && 'text-primary',
    (!row.tone || row.tone === 'default') && !row.emphasis && 'text-foreground',
  );

  return <span className={className}>{row.value}</span>;
}

function InfoCard({ card }: { card: PurchaseSummaryInfoCard }) {
  const Icon = card.icon;
  const content = (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{card.title}</p>
        <p className="mt-0.5 truncate text-xs font-medium text-muted-foreground">{card.detail}</p>
        {card.subdetail ? (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{card.subdetail}</p>
        ) : null}
      </div>
      {card.amount ? (
        <p className="shrink-0 text-xs font-semibold text-primary">{card.amount}</p>
      ) : null}
      {card.onClick ? <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" /> : null}
    </div>
  );

  if (card.onClick) {
    return (
      <button
        type="button"
        className="w-full rounded-2xl border border-border/70 bg-card/90 p-4 text-left shadow-sm transition-colors hover:border-primary/45"
        onClick={card.onClick}
      >
        {content}
      </button>
    );
  }

  return (
    <section className="rounded-2xl border border-border/70 bg-card/90 p-4 shadow-sm">
      {content}
    </section>
  );
}

export function PurchaseSummary({
  title = 'Instant Checkout',
  subtitle = 'Review your order details and pay in one step.',
  shipping,
  address,
  itemsTitle = 'Selected Items',
  itemsSubtitle,
  items,
  totalsTitle = 'Order Summary',
  totals,
  makeChangesLabel = 'Make Changes',
  payLabel = 'Pay Now',
  secureText = 'Secure checkout',
  isProcessing = false,
  payDisabled = false,
  onMakeChanges,
  onPay,
  className,
  children,
}: PurchaseSummaryProps) {
  return (
    <div className={cn('space-y-3', className)}>
      <div className="space-y-0.5">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
        {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>

      {shipping ? <InfoCard card={shipping} /> : null}
      {address ? <InfoCard card={address} /> : null}
      {children}

      <section className="rounded-2xl border border-border/70 bg-card/90 p-4 shadow-sm">
        <div className="mb-3 flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
            <ShoppingBag className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{itemsTitle}</p>
            {itemsSubtitle ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{itemsSubtitle}</p>
            ) : null}
          </div>
        </div>

        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-2xl border border-border/70 bg-background/70 p-2.5">
              <div className="flex gap-3">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-muted">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full bg-muted" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="line-clamp-2 text-sm font-semibold text-foreground">{item.title}</h3>
                      {item.subtitle ? (
                        <p className="mt-1 text-[11px] text-muted-foreground">{item.subtitle}</p>
                      ) : null}
                      {item.details?.map((detail) =>
                        detail ? (
                          <p key={detail} className="text-[11px] text-muted-foreground">
                            {detail}
                          </p>
                        ) : null,
                      )}
                      {item.warning ? (
                        <p className="mt-1 text-[11px] font-medium text-destructive">{item.warning}</p>
                      ) : null}
                    </div>
                    <div className="shrink-0 text-right">
                      {item.quantity != null ? (
                        <p className="text-xs font-medium text-foreground">Qty: {item.quantity}</p>
                      ) : null}
                      {item.amount ? (
                        <p className="mt-4 text-sm font-semibold text-primary">{item.amount}</p>
                      ) : null}
                    </div>
                  </div>
                  {item.action ? <div className="mt-3">{item.action}</div> : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border/70 bg-card/90 p-4 shadow-sm">
        <p className="mb-4 text-sm font-semibold text-foreground">{totalsTitle}</p>
        <div className="space-y-3">
          {totals.map((row, index) => (
            <div key={`${row.label}-${index}`}>
              {row.emphasis ? <div className="mb-3 h-px bg-border/70" /> : null}
              <div className="flex items-start justify-between gap-3">
                <span
                  className={cn(
                    'min-w-0',
                    row.emphasis ? 'text-base font-semibold text-foreground' : 'text-sm text-muted-foreground',
                  )}
                >
                  {row.label}
                </span>
                <TotalValue row={row} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="space-y-2 pt-1">
        {onMakeChanges ? (
          <Button
            type="button"
            variant="outline"
            className="h-12 w-full min-w-0 justify-center gap-2 overflow-hidden rounded-xl border-border/70 bg-card/90"
            onClick={onMakeChanges}
          >
            <PencilLine className="h-4 w-4 shrink-0" />
            <span className="truncate">{makeChangesLabel}</span>
          </Button>
        ) : null}
        {onPay ? (
          <Button
            type="button"
            className="h-12 w-full min-w-0 justify-center gap-2 overflow-hidden rounded-xl"
            onClick={onPay}
            disabled={payDisabled || isProcessing}
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            ) : (
              <Lock className="h-4 w-4 shrink-0" />
            )}
            <span className="truncate">{isProcessing ? 'Processing...' : payLabel}</span>
          </Button>
        ) : null}
      </div>

      {secureText ? <p className="text-center text-xs text-muted-foreground">{secureText}</p> : null}
    </div>
  );
}
