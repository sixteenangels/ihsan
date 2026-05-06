import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { RefreshCcw, Loader2 } from 'lucide-react';
import { useCurrency } from '@/hooks/useCurrency';

interface RefundRequestDialogProps {
  order: {
    id: string;
    order_number: string;
    total_amount: number;
    status: string;
  };
  disabled?: boolean;
}

const REFUND_REASONS = [
  'Product damaged',
  'Wrong item received',
  'Product not as described',
  'Quality not satisfactory',
  'Changed my mind',
  'Other',
] as const;

export function RefundRequestDialog({ order, disabled }: RefundRequestDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { formatPrice } = useCurrency();
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState<string>('');
  const [details, setDetails] = useState('');

  const createRefundMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Please sign in to request a refund');

      // Use type assertion for new table
      const client = supabase as any;
      const { error } = await client
        .from('refund_requests')
        .insert({
          order_id: order.id,
          user_id: user.id,
          reason,
          details: details || null,
          refund_amount: order.total_amount,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['refund-requests'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Refund request submitted successfully');
      setIsOpen(false);
      setReason('');
      setDetails('');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to submit refund request');
    },
  });

  const canRequestRefund = order.status === 'delivered';

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          disabled={disabled || !canRequestRefund}
          className="gap-2"
        >
          <RefreshCcw className="h-4 w-4" />
          Request Refund
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request Refund</DialogTitle>
          <DialogDescription>
            Submit a refund request for order {order.order_number}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-4 rounded-lg bg-muted">
            <p className="text-sm text-muted-foreground">Order Total</p>
            <p className="text-xl font-bold text-primary">
              {formatPrice(order.total_amount)}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason for refund *</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {REFUND_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="details">Additional details (optional)</Label>
            <Textarea
              id="details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Please provide any additional information about your refund request..."
              rows={4}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createRefundMutation.mutate()}
              disabled={!reason || createRefundMutation.isPending}
            >
              {createRefundMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Submit Request
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
