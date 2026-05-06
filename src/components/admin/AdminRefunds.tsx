import { useState } from 'react';
import { useAdminRefundRequests } from '@/hooks/useRefundRequests';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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

export function AdminRefunds() {
  const { refundRequests, isLoading, updateRefund, isUpdating } = useAdminRefundRequests();
  const { formatPrice } = useCurrency();
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [adminNotes, setAdminNotes] = useState('');

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

  const handleAction = async (id: string, status: 'approved' | 'rejected' | 'processed') => {
    const request = selectedRequest;
    
    updateRefund(
      { id, status, admin_notes: adminNotes },
      {
        onSuccess: async () => {
          toast.success(`Refund request ${status}`);
          
          // Send push notification to customer
          if (request?.user_id) {
            const statusMessages: Record<string, string> = {
              approved: 'Your refund request has been approved! We will process your refund shortly.',
              rejected: 'Your refund request has been reviewed. Please check the details in your account.',
              processed: 'Your refund has been processed! The amount will be credited to your account.',
            };
            
            try {
              await supabase.functions.invoke('send-push-notification', {
                body: {
                  user_id: request.user_id,
                  title: `Refund ${status.charAt(0).toUpperCase() + status.slice(1)}`,
                  body: statusMessages[status],
                  data: { 
                    type: 'refund_status',
                    refund_id: id,
                    order_number: request.orders?.order_number,
                    status,
                  },
                },
              });
            } catch (error) {
              console.log('Push notification failed:', error);
            }
          }
          
          setSelectedRequest(null);
          setAdminNotes('');
        },
        onError: (error: Error) => {
          toast.error(error.message);
        },
      }
    );
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
              {refundRequests.map((request: any) => (
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
                      onClick={() => {
                        setSelectedRequest(request);
                        setAdminNotes(request.admin_notes || '');
                      }}
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

      {/* Request Details Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent className="sm:max-w-lg">
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

              {selectedRequest.status === 'pending' && (
                <>
                  <div className="space-y-2">
                    <Label>Admin Notes (optional)</Label>
                    <Textarea
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      placeholder="Add notes about this refund decision..."
                      rows={3}
                    />
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button
                      variant="destructive"
                      className="flex-1"
                      onClick={() => handleAction(selectedRequest.id, 'rejected')}
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
                      onClick={() => handleAction(selectedRequest.id, 'approved')}
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
                </>
              )}

              {selectedRequest.status === 'approved' && (
                <Button
                  className="w-full"
                  onClick={() => handleAction(selectedRequest.id, 'processed')}
                  disabled={isUpdating}
                >
                  {isUpdating ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <RefreshCcw className="h-4 w-4 mr-2" />
                  )}
                  Mark as Processed (Refund Issued)
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
