import { useState } from 'react';
import { useAdminRefundRequests, type AdminRefundRequest } from '@/hooks/useRefundRequests';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { creditWalletByAdmin } from '@/lib/wallet';
import { logAdminAction } from '@/lib/audit-log';
import {
  buildRefundEmailHtml,
  buildRefundEmailSubject,
  buildRefundEmailText,
} from '@/lib/email-templates';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { Loader2, Eye, Check, X, RefreshCcw } from 'lucide-react';
import { format } from 'date-fns';
import { useCurrency } from '@/hooks/useCurrency';

type RefundChannel = 'original_payment' | 'wallet_credit' | 'mixed';

function getSuggestedWalletCredit(request: AdminRefundRequest) {
  const shipping = Number(request.orders?.shipping_price || 0);
  const packaging = Number(request.orders?.packaging_cost || 0);
  const requestedAmount = Number(request.refund_amount || request.orders?.total_amount || 0);
  return Math.max(0, Math.min(requestedAmount, shipping + packaging));
}

export function AdminRefunds() {
  const { user } = useAuth();
  const { refundRequests, isLoading, updateRefund, isUpdating } = useAdminRefundRequests();
  const { formatPrice } = useCurrency();
  const [selectedRequest, setSelectedRequest] = useState<AdminRefundRequest | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [refundChannel, setRefundChannel] = useState<RefundChannel>('original_payment');
  const [walletCreditAmount, setWalletCreditAmount] = useState('');

  const resetDialog = () => {
    setSelectedRequest(null);
    setAdminNotes('');
    setRefundChannel('original_payment');
    setWalletCreditAmount('');
  };

  const openRequest = (request: AdminRefundRequest) => {
    setSelectedRequest(request);
    setAdminNotes(request.admin_notes || '');
    setRefundChannel((request.refund_channel as RefundChannel) || 'original_payment');
    const suggested = getSuggestedWalletCredit(request);
    setWalletCreditAmount(
      request.wallet_credit_amount
        ? String(request.wallet_credit_amount)
        : suggested > 0 && /(shipping|buffer|delivery)/i.test(`${request.reason} ${request.details || ''}`)
          ? String(suggested)
          : '',
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case 'approved':
        return <Badge className="bg-primary/20 text-primary">Approved</Badge>;
      case 'rejected':
        return <Badge className="bg-destructive/20 text-destructive">Rejected</Badge>;
      case 'processed':
        return <Badge className="bg-green-100 text-green-800">Processed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const sendRefundEmail = async (request: AdminRefundRequest, status: 'approved' | 'rejected' | 'processed', statusMessage: string) => {
    const customerEmail = request.profiles?.email;
    if (!customerEmail) {
      return { sent: false, skipped: true };
    }

    const { data, error } = await supabase.functions.invoke('send-transactional-email', {
      body: {
        to: customerEmail,
        subject: buildRefundEmailSubject({
          orderNumber: request.orders?.order_number || request.order_id,
          statusLabel: status,
        }),
        html: buildRefundEmailHtml({
          customerName: request.profiles?.name || 'there',
          orderNumber: request.orders?.order_number || request.order_id,
          statusLabel: status,
          message: statusMessage,
          adminNotes,
        }),
        text: buildRefundEmailText({
          customerName: request.profiles?.name || 'there',
          orderNumber: request.orders?.order_number || request.order_id,
          statusLabel: status,
          message: statusMessage,
          adminNotes,
        }),
        type: 'refund_status',
        relatedEntityType: 'refund_request',
        relatedEntityId: request.id,
        requestedBy: user?.id,
        metadata: {
          orderId: request.order_id,
          orderNumber: request.orders?.order_number,
          refundChannel,
          walletCreditAmount: Number.parseFloat(walletCreditAmount || '0') || 0,
        },
      },
    });

    if (error) throw error;
    return data;
  };

  const handleAction = async (
    request: AdminRefundRequest,
    status: 'approved' | 'rejected' | 'processed',
  ) => {
    const walletCredit = Number.parseFloat(walletCreditAmount || '0') || 0;

    if (walletCredit < 0) {
      toast.error('Wallet credit amount cannot be negative.');
      return;
    }

    if (refundChannel !== 'original_payment' && walletCredit <= 0) {
      toast.error('Add a wallet credit amount for wallet-based refunds.');
      return;
    }

    try {
      await updateRefund({
        id: request.id,
        status,
        admin_notes: adminNotes,
        refund_channel: refundChannel,
        wallet_credit_amount: walletCredit,
      });

      if (status === 'processed') {
        if (walletCredit > 0) {
          await creditWalletByAdmin({
            userId: request.user_id,
            amount: walletCredit,
            description: `Shipping buffer refund for order ${request.orders?.order_number || request.order_id}`,
            createdBy: user?.id,
            orderId: request.order_id,
            referenceKey: `refund:${request.id}:wallet-credit`,
            notificationTitle: 'Wallet Refund Received',
            notificationMessage: `${formatPrice(walletCredit)} has been credited to your Ihsan wallet for order ${request.orders?.order_number || request.order_id}.`,
          });
        }

        await supabase
          .from('orders')
          .update({ status: 'refunded', updated_at: new Date().toISOString() })
          .eq('id', request.order_id);

        const refundTrackingNote = walletCredit > 0
          ? `Refund processed. ${formatPrice(walletCredit)} credited to the customer's wallet for shipping buffer adjustment.`
          : 'Refund processed and recorded by support.';

        await supabase.from('order_tracking').insert({
          order_id: request.order_id,
          status: 'refunded',
          location_name: 'Ihsan Support Desk',
          notes: refundTrackingNote,
        });
      }

      const statusMessages: Record<string, string> = {
        approved: 'Your refund request has been approved! We will process your refund shortly.',
        rejected: 'Your refund request has been reviewed. Please check the details in your account.',
        processed: walletCredit > 0
          ? `Your refund has been processed. ${formatPrice(walletCredit)} was credited to your wallet for future checkout use.`
          : 'Your refund has been processed! Please check your original payment channel.',
      };

      if (request.user_id) {
        try {
          await supabase.functions.invoke('send-push-notification', {
            body: {
              user_id: request.user_id,
              title: `Refund ${status.charAt(0).toUpperCase() + status.slice(1)}`,
              body: statusMessages[status],
              data: {
                type: 'refund_status',
                refund_id: request.id,
                order_number: request.orders?.order_number,
                status,
                refund_channel: refundChannel,
                wallet_credit_amount: walletCredit,
              },
            },
          });
        } catch (error) {
          console.log('Push notification failed:', error);
        }
      }

      const emailResult = await sendRefundEmail(request, status, statusMessages[status]);

      await logAdminAction({
        actorUserId: user?.id,
        action: `refund_request.${status}`,
        entityType: 'refund_request',
        entityId: request.id,
        summary: `Marked refund request ${request.id} as ${status}.`,
        metadata: {
          orderId: request.order_id,
          orderNumber: request.orders?.order_number,
          refundChannel,
          walletCredit,
          emailSent: emailResult?.sent || false,
        },
      });

      toast.success(`Refund request ${status}`);
      resetDialog();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update refund request';
      toast.error(message);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold font-serif text-foreground">Refund Requests</h1>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {refundRequests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell className="font-medium">
                    {request.orders?.order_number || '-'}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{request.profiles?.name || 'Unknown'}</p>
                      <p className="text-sm text-muted-foreground">{request.profiles?.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>{request.reason}</TableCell>
                  <TableCell className="font-semibold text-primary">
                    {formatPrice(Number(request.refund_amount || request.orders?.total_amount || 0))}
                  </TableCell>
                  <TableCell>{getStatusBadge(request.status)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(request.created_at), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openRequest(request)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {refundRequests.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No refund requests yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selectedRequest} onOpenChange={(open) => !open && resetDialog()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto bg-background sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Refund Request Details</DialogTitle>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Order</p>
                  <p className="font-medium">{selectedRequest.orders?.order_number}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Amount</p>
                  <p className="font-bold text-primary">
                    {formatPrice(Number(selectedRequest.refund_amount || selectedRequest.orders?.total_amount || 0))}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Reason</p>
                <p className="font-medium">{selectedRequest.reason}</p>
              </div>

              {selectedRequest.details && (
                <div>
                  <p className="text-sm text-muted-foreground">Details</p>
                  <p className="text-sm bg-muted p-3 rounded-lg">{selectedRequest.details}</p>
                </div>
              )}

              <div>
                <p className="text-sm text-muted-foreground mb-1">Current Status</p>
                {getStatusBadge(selectedRequest.status)}
              </div>

              {selectedRequest.status !== 'rejected' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="refund-channel">Refund route</Label>
                    <Select
                      value={refundChannel}
                      onValueChange={(value) => setRefundChannel(value as RefundChannel)}
                    >
                      <SelectTrigger id="refund-channel">
                        <SelectValue placeholder="Select refund route" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="original_payment">Original payment</SelectItem>
                        <SelectItem value="wallet_credit">Wallet credit only</SelectItem>
                        <SelectItem value="mixed">Mixed refund + wallet credit</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wallet-credit-amount">Wallet credit amount</Label>
                    <Input
                      id="wallet-credit-amount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={walletCreditAmount}
                      onChange={(e) => setWalletCreditAmount(e.target.value)}
                      placeholder="0.00"
                    />
                    <p className="text-xs text-muted-foreground">
                      Use this for shipping-buffer refunds or store-credit-only adjustments.
                    </p>
                    {getSuggestedWalletCredit(selectedRequest) > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="px-0 text-primary"
                        onClick={() => setWalletCreditAmount(String(getSuggestedWalletCredit(selectedRequest)))}
                      >
                        Apply suggested wallet credit of {formatPrice(getSuggestedWalletCredit(selectedRequest))}
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {(selectedRequest.status === 'pending' || selectedRequest.status === 'approved') && (
                <div className="space-y-2">
                  <Label>Admin Notes (optional)</Label>
                  <Textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Add notes about this refund decision..."
                    rows={3}
                  />
                </div>
              )}

              {selectedRequest.status === 'pending' && (
                <div className="flex gap-2 pt-4">
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => handleAction(selectedRequest, 'rejected')}
                    disabled={isUpdating}
                  >
                    {isUpdating ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <X className="h-4 w-4 mr-2" />
                    )}
                    Reject
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => handleAction(selectedRequest, 'approved')}
                    disabled={isUpdating}
                  >
                    {isUpdating ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Check className="h-4 w-4 mr-2" />
                    )}
                    Approve
                  </Button>
                </div>
              )}

              {selectedRequest.status === 'approved' && (
                <Button
                  className="w-full"
                  onClick={() => handleAction(selectedRequest, 'processed')}
                  disabled={isUpdating}
                >
                  {isUpdating ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <RefreshCcw className="h-4 w-4 mr-2" />
                  )}
                  Mark as Processed
                </Button>
              )}

              {selectedRequest.admin_notes && selectedRequest.status !== 'pending' && (
                <div>
                  <p className="text-sm text-muted-foreground">Admin Notes</p>
                  <p className="text-sm bg-muted p-3 rounded-lg">{selectedRequest.admin_notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
