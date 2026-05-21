import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { CheckCircle2, ImagePlus, Loader2, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { TablesInsert } from '@/integrations/supabase/types';
import {
  AFTER_SALES_ATTACHMENT_BUCKET,
  AFTER_SALES_CATEGORY,
  AFTER_SALES_IMAGE_MIME_TYPES,
  AFTER_SALES_MAX_IMAGE_SIZE_BYTES,
  AFTER_SALES_SUPPORT_OPTIONS,
  type AfterSalesSupportType,
  getAfterSalesSupportPriority,
} from '@/lib/afterSalesSupport';
import { cn } from '@/lib/utils';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';

interface AfterSalesServiceOrder {
  id: string;
  order_number: string;
  status: string | null;
  created_at?: string;
  updated_at?: string | null;
  customer_confirmed_at?: string | null;
  shipping_address?: {
    full_name?: string;
    phone?: string | null;
  } | null;
  order_items: Array<{
    product_name: string;
  }>;
}

interface AfterSalesServiceDialogProps {
  order: AfterSalesServiceOrder;
  triggerLabel?: string;
  className?: string;
}

function buildAttachmentPath(userId: string, requestId: string, file: File) {
  const rawExtension = file.name.split('.').pop() || 'jpg';
  const safeExtension = rawExtension.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'jpg';

  return `${userId}/${requestId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${safeExtension}`;
}

export function AfterSalesServiceDialog({
  order,
  triggerLabel = 'Request After-Sales Service',
  className,
}: AfterSalesServiceDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [supportType, setSupportType] = useState<AfterSalesSupportType>('damaged_item');
  const [explanation, setExplanation] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentPreviewUrl, setAttachmentPreviewUrl] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const productNames = useMemo(
    () => [...new Set(order.order_items.map((item) => item.product_name).filter(Boolean))],
    [order.order_items],
  );
  const deliveryDate = order.customer_confirmed_at || order.updated_at || order.created_at || null;
  const formattedDeliveryDate = deliveryDate ? format(new Date(deliveryDate), 'MMM d, yyyy') : 'Delivered recently';
  const customerName =
    order.shipping_address?.full_name?.trim() ||
    (user?.user_metadata?.full_name as string | undefined)?.trim() ||
    (user?.user_metadata?.name as string | undefined)?.trim() ||
    'AJYN customer';
  const customerEmail = user?.email?.trim() || '';
  const customerPhone =
    order.shipping_address?.phone?.trim() ||
    (user?.user_metadata?.phone as string | undefined)?.trim() ||
    '';

  useEffect(() => {
    if (!attachment) {
      setAttachmentPreviewUrl(null);
      return;
    }

    const previewUrl = URL.createObjectURL(attachment);
    setAttachmentPreviewUrl(previewUrl);

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [attachment]);

  useEffect(() => {
    if (!open) {
      setSubmitted(false);
      setSupportType('damaged_item');
      setExplanation('');
      setAttachment(null);
    }
  }, [open]);

  const submitRequestMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) {
        throw new Error('Please sign in to request after-sales support.');
      }

      const trimmedExplanation = explanation.trim();
      if (!trimmedExplanation) {
        throw new Error('Please explain what happened so support can help quickly.');
      }

      if (!customerEmail) {
        throw new Error('We need your email address so AJYN support can reach you.');
      }

      const requestId = crypto.randomUUID();
      const attachmentPaths: string[] = [];

      if (attachment) {
        const attachmentPath = buildAttachmentPath(user.id, requestId, attachment);
        const { error: uploadError } = await supabase.storage
          .from(AFTER_SALES_ATTACHMENT_BUCKET)
          .upload(attachmentPath, attachment, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) {
          throw uploadError;
        }

        attachmentPaths.push(attachmentPath);
      }

      const payload: TablesInsert<'support_requests'> = {
        id: requestId,
        user_id: user.id,
        name: customerName,
        email: customerEmail,
        customer_phone: customerPhone || null,
        subject: `After-sales request for order ${order.order_number}`,
        message: trimmedExplanation,
        category: AFTER_SALES_CATEGORY,
        priority: getAfterSalesSupportPriority(supportType),
        source: 'after_sales_service',
        status: 'new',
        order_id: order.id,
        order_number: order.order_number,
        support_type: supportType,
        delivery_date: deliveryDate,
        product_names: productNames,
        attachment_paths: attachmentPaths,
        tags: [`order:${order.id}`, `after-sales:${supportType}`],
      };

      const { error } = await supabase.from('support_requests').insert(payload);
      if (error) {
        throw error;
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['support-requests', user?.id] }),
        queryClient.invalidateQueries({ queryKey: ['admin-support-requests'] }),
      ]);
      setSubmitted(true);
      toast.success('Your request has been received. Ajyn support will review it shortly.');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'We could not submit your after-sales request right now.');
    },
  });

  if (order.status !== 'delivered') {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className={cn('gap-2', className)}>
          <ShieldCheck className="h-4 w-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] overflow-y-auto rounded-[1.6rem] border-border/70 bg-background p-0 sm:max-w-2xl">
        {submitted ? (
          <div className="space-y-4 p-6 sm:p-7">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle2 className="h-7 w-7 text-primary" />
            </div>
            <div className="space-y-2">
              <DialogTitle className="text-2xl font-semibold">Request received</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Your request has been received. Ajyn support will review it shortly.
              </DialogDescription>
            </div>
            <div className="rounded-2xl border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
              Order {order.order_number} is now in the after-sales queue. We will reach out using the
              contact information on this request if anything else is needed.
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setOpen(false)}>Close</Button>
            </div>
          </div>
        ) : (
          <>
            <DialogHeader className="border-b border-border/70 px-6 py-5 sm:px-7">
              <DialogTitle className="text-2xl font-semibold">Request After-Sales Service</DialogTitle>
              <DialogDescription className="max-w-xl text-sm text-muted-foreground">
                Share what went wrong and we will route it to the right AJYN support team without
                making the process feel like a dispute form.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 px-6 py-5 sm:px-7 sm:py-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border/70 bg-muted/25 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Order ID
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground">{order.order_number}</p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-muted/25 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Delivery Date
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground">{formattedDeliveryDate}</p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-muted/25 p-4 sm:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Product Name
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {productNames.join(', ') || 'Order items'}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-muted/25 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    User Information
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground">{customerName}</p>
                  <p className="text-sm text-muted-foreground">{customerEmail}</p>
                  {customerPhone ? <p className="text-sm text-muted-foreground">{customerPhone}</p> : null}
                </div>
                <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary/80">
                    What Happens Next
                  </p>
                  <p className="mt-1 text-sm text-foreground">
                    Submit once, then AJYN support will review the details and respond with the next
                    best step.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-semibold text-foreground">Type of support needed</Label>
                <RadioGroup
                  value={supportType}
                  onValueChange={(value) => setSupportType(value as AfterSalesSupportType)}
                  className="grid gap-3 sm:grid-cols-2"
                >
                  {AFTER_SALES_SUPPORT_OPTIONS.map((option) => (
                    <Label
                      key={option.value}
                      htmlFor={`after-sales-${option.value}`}
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-2xl border border-border/70 bg-card p-4 transition-colors',
                        supportType === option.value && 'border-primary bg-primary/5',
                      )}
                    >
                      <RadioGroupItem
                        value={option.value}
                        id={`after-sales-${option.value}`}
                        className="mt-0.5"
                      />
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">{option.label}</p>
                        <p className="text-xs leading-relaxed text-muted-foreground">{option.description}</p>
                      </div>
                    </Label>
                  ))}
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="after-sales-explanation" className="text-sm font-semibold text-foreground">
                  Explanation
                </Label>
                <Textarea
                  id="after-sales-explanation"
                  value={explanation}
                  onChange={(event) => setExplanation(event.target.value)}
                  rows={5}
                  placeholder="Tell us what happened, what you noticed after delivery, and the outcome you need from support."
                />
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="after-sales-image" className="text-sm font-semibold text-foreground">
                    Optional image upload
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Add one clear photo if it helps explain the issue. JPG, PNG, or WebP up to 5 MB.
                  </p>
                </div>
                <Input
                  id="after-sales-image"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null;
                    if (!file) {
                      setAttachment(null);
                      return;
                    }

                    if (!AFTER_SALES_IMAGE_MIME_TYPES.has(file.type)) {
                      toast.error('Please upload a JPG, PNG, or WebP image.');
                      event.target.value = '';
                      return;
                    }

                    if (file.size > AFTER_SALES_MAX_IMAGE_SIZE_BYTES) {
                      toast.error('Please choose an image smaller than 5 MB.');
                      event.target.value = '';
                      return;
                    }

                    setAttachment(file);
                  }}
                />

                {attachment ? (
                  <div className="flex items-start gap-3 rounded-2xl border border-border/70 bg-muted/25 p-3">
                    {attachmentPreviewUrl ? (
                      <img
                        src={attachmentPreviewUrl}
                        alt="After-sales attachment preview"
                        className="h-20 w-20 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-muted">
                        <ImagePlus className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{attachment.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(attachment.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      onClick={() => setAttachment(null)}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Remove image</span>
                    </Button>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  AJYN support will use this information only to review and resolve your request.
                </p>
                <Button
                  onClick={() => submitRequestMutation.mutate()}
                  disabled={submitRequestMutation.isPending}
                  className="h-11 rounded-xl px-5 text-sm font-semibold"
                >
                  {submitRequestMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Submit Request
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
