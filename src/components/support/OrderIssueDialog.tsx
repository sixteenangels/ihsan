import { useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AlertCircle, Loader2 } from 'lucide-react';
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

type IssueType =
  | 'late_delivery'
  | 'missing_item'
  | 'wrong_item'
  | 'damaged_item'
  | 'delivery_fee'
  | 'refund_needed'
  | 'other';

const ISSUE_OPTIONS: Array<{
  value: IssueType;
  label: string;
  priority: 'normal' | 'high' | 'urgent';
}> = [
  { value: 'late_delivery', label: 'Late delivery', priority: 'high' },
  { value: 'missing_item', label: 'Missing item', priority: 'high' },
  { value: 'wrong_item', label: 'Wrong item received', priority: 'high' },
  { value: 'damaged_item', label: 'Item arrived damaged', priority: 'high' },
  { value: 'delivery_fee', label: 'Delivery fee problem', priority: 'normal' },
  { value: 'refund_needed', label: 'Refund or reversal issue', priority: 'high' },
  { value: 'other', label: 'Other delivery issue', priority: 'normal' },
];

interface OrderIssueDialogProps {
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  itemNames?: string[];
  triggerLabel?: string;
}

export function OrderIssueDialog({
  orderId,
  orderNumber,
  orderStatus,
  itemNames = [],
  triggerLabel = 'Report an Issue',
}: OrderIssueDialogProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [issueType, setIssueType] = useState<IssueType>('late_delivery');
  const [details, setDetails] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }

    setName((user?.user_metadata?.name as string | undefined) || '');
    setEmail(user?.email || '');
  }, [open, user?.email, user?.user_metadata]);

  const selectedIssue = useMemo(
    () => ISSUE_OPTIONS.find((option) => option.value === issueType) || ISSUE_OPTIONS[0],
    [issueType],
  );

  const submitMutation = useMutation({
    mutationFn: async () => {
      const trimmedName = name.trim() || 'Customer';
      const trimmedEmail = email.trim() || user?.email || '';
      const trimmedDetails = details.trim();

      if (!trimmedEmail) {
        throw new Error('Add your email so support can reach you.');
      }

      if (!trimmedDetails) {
        throw new Error('Describe the issue so support knows what happened.');
      }

      const messageLines = [
        `Order number: ${orderNumber}`,
        `Order status: ${orderStatus}`,
        `Issue type: ${selectedIssue.label}`,
      ];

      if (itemNames.length > 0) {
        messageLines.push(`Items: ${itemNames.join(', ')}`);
      }

      messageLines.push('', trimmedDetails);

      const { error } = await supabase.from('support_requests' as never).insert({
        user_id: user?.id || null,
        name: trimmedName,
        email: trimmedEmail,
        message: messageLines.join('\n'),
        source: 'delivery_issue_center',
        status: 'new',
        priority: selectedIssue.priority,
        category: 'Orders & Shipping',
        tags: [`order:${orderId}`, `issue:${issueType}`],
      } as never);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Your issue has been sent to support.');
      setOpen(false);
      setDetails('');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Could not send your issue to support.');
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <AlertCircle className="mr-2 h-4 w-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-background sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Report an Order Issue</DialogTitle>
          <DialogDescription>
            Tell us what happened with order {orderNumber} and support will pick it up.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="issue-name">Name</Label>
              <Input
                id="issue-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="issue-email">Email</Label>
              <Input
                id="issue-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="issue-type">Issue type</Label>
            <Select value={issueType} onValueChange={(value) => setIssueType(value as IssueType)}>
              <SelectTrigger id="issue-type">
                <SelectValue placeholder="Choose an issue type" />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                {ISSUE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="issue-details">Details</Label>
            <Textarea
              id="issue-details"
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              rows={5}
              placeholder="Describe what went wrong, what you expected, and what fix you need."
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}>
              {submitMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Send to Support
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
