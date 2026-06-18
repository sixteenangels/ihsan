import { useEffect, useMemo, useState } from 'react';
import { formatStoreDate } from '@/lib/date-utils';
import { useMutation } from '@tanstack/react-query';
import { CalendarClock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type ReservationIntent = 'notify_only' | 'hold_without_deposit' | 'ready_for_deposit';

const RESERVATION_OPTIONS: Array<{
  value: ReservationIntent;
  label: string;
  priority: 'normal' | 'high';
}> = [
  { value: 'notify_only', label: 'Notify me when it is back', priority: 'normal' },
  { value: 'hold_without_deposit', label: 'I want a soft reservation', priority: 'normal' },
  { value: 'ready_for_deposit', label: 'I am ready to place a deposit', priority: 'high' },
];

interface RestockReservationDialogProps {
  productId: string;
  productName: string;
  expectedRestockDate?: string | null;
  productVariantId?: string | null;
  variantLabel?: string | null;
  triggerLabel?: string;
}

export function RestockReservationDialog({
  productId,
  productName,
  expectedRestockDate,
  productVariantId,
  variantLabel,
  triggerLabel = 'Reserve Next Restock',
}: RestockReservationDialogProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [reservationIntent, setReservationIntent] =
    useState<ReservationIntent>('hold_without_deposit');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }

    setName((user?.user_metadata?.name as string | undefined) || '');
    setEmail(user?.email || '');
  }, [open, user?.email, user?.user_metadata]);

  const selectedIntent = useMemo(
    () =>
      RESERVATION_OPTIONS.find((option) => option.value === reservationIntent) ||
      RESERVATION_OPTIONS[0],
    [reservationIntent],
  );

  const expectedRestockLabel = expectedRestockDate
    ? formatStoreDate(expectedRestockDate)
    : null;

  const submitMutation = useMutation({
    mutationFn: async () => {
      const trimmedName = name.trim() || 'Customer';
      const trimmedEmail = email.trim() || user?.email || '';
      const desiredQuantity = Number.parseInt(quantity, 10);
      const trimmedNotes = notes.trim();

      if (!trimmedEmail) {
        throw new Error('Add an email so we can confirm the reservation request.');
      }

      if (!Number.isFinite(desiredQuantity) || desiredQuantity <= 0) {
        throw new Error('Choose a valid quantity.');
      }

      const { error } = await supabase.from('restock_reservations' as never).insert({
        user_id: user?.id || null,
        product_id: productId,
        product_variant_id: productVariantId || null,
        product_name_snapshot: productName,
        variant_label: variantLabel || null,
        desired_quantity: desiredQuantity,
        intent: reservationIntent,
        customer_name: trimmedName,
        customer_email: trimmedEmail,
        notes: trimmedNotes || null,
        status: 'new',
        priority: selectedIntent.priority,
        expected_restock_date: expectedRestockDate || null,
      } as never);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Reservation request sent. We will follow up when stock opens.');
      setOpen(false);
      setNotes('');
      setQuantity('1');
      setReservationIntent('hold_without_deposit');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Could not save your restock reservation.');
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <CalendarClock className="mr-2 h-4 w-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl bg-background sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Reserve the Next Restock</DialogTitle>
          <DialogDescription>
            Tell us how many units you need and whether you are ready to place a deposit.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-2xl border border-border/70 bg-muted/40 p-3 text-sm">
            <p className="font-medium text-foreground">{productName}</p>
            {variantLabel ? (
              <p className="text-muted-foreground">Preferred option: {variantLabel}</p>
            ) : null}
            {expectedRestockLabel ? (
              <p className="text-muted-foreground">Expected restock: {expectedRestockLabel}</p>
            ) : (
              <p className="text-muted-foreground">
                We will route this to the team for the next incoming batch.
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="restock-name">Name</Label>
              <Input
                id="restock-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="restock-email">Email</Label>
              <Input
                id="restock-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="restock-quantity">Quantity</Label>
              <Input
                id="restock-quantity"
                inputMode="numeric"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                placeholder="1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="restock-intent">Reservation type</Label>
              <Select
                value={reservationIntent}
                onValueChange={(value) => setReservationIntent(value as ReservationIntent)}
              >
                <SelectTrigger id="restock-intent">
                  <SelectValue placeholder="Choose an option" />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  {RESERVATION_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="restock-notes">Notes</Label>
            <Textarea
              id="restock-notes"
              rows={4}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Add timing, variant/size preferences, or whether you want us to call first."
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}>
              {submitMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Save Reservation Request
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
