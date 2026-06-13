import { useEffect, useState } from 'react';
import { Loader2, Star } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface ReviewableOrderItem {
  product_name: string;
  product_id: string | null;
  product_variant_id: string | null;
}

export interface ReviewableOrder {
  id: string;
  order_items: ReviewableOrderItem[];
}

interface OrderReviewDialogProps {
  open: boolean;
  order: ReviewableOrder | null;
  onOpenChange: (open: boolean) => void;
  onSubmitted?: () => void;
  onLater?: () => void;
}

export function OrderReviewDialog({
  open,
  order,
  onOpenChange,
  onSubmitted,
  onLater,
}: OrderReviewDialogProps) {
  const { user } = useAuth();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setRating(5);
      setComment('');
      setSubmitting(false);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!order || !user) return;

    setSubmitting(true);

    const firstItem = order.order_items[0];
    let productId = firstItem?.product_id || null;

    if (!productId && firstItem?.product_variant_id) {
      const { data: variant } = await supabase
        .from('product_variants')
        .select('product_id')
        .eq('id', firstItem.product_variant_id)
        .single();

      productId = variant?.product_id || null;
    }

    if (!productId) {
      setSubmitting(false);
      toast.error('Could not find a product to review.');
      return;
    }

    const { error } = await supabase.from('reviews').insert({
      product_id: productId,
      user_id: user.id,
      rating,
      comment: comment || null,
      is_verified: false,
      order_id: order.id,
    });

    setSubmitting(false);

    if (error) {
      toast.error('Failed to submit review');
      return;
    }

    toast.success('Review submitted! It will appear after approval.');
    onOpenChange(false);
    onSubmitted?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto bg-background sm:max-w-md">
        <DialogHeader>
          <DialogTitle>How was your order?</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Rate your experience with {order?.order_items[0]?.product_name || 'this order'}
          </p>

          <div className="flex items-center justify-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                className="focus:outline-none"
              >
                <Star
                  className={`h-8 w-8 cursor-pointer transition-colors ${
                    star <= rating
                      ? 'fill-primary text-primary'
                      : 'text-muted-foreground hover:text-primary'
                  }`}
                />
              </button>
            ))}
          </div>

          <div>
            <Label>Comment (optional)</Label>
            <Textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Share your experience..."
              className="mt-1"
              rows={3}
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={handleSubmit} disabled={submitting} className="flex-1">
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Review'
              )}
            </Button>
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => {
                onLater?.();
                onOpenChange(false);
              }}
            >
              Later
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
