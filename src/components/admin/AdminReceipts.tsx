import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, Download, Plus, Printer, QrCode, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  buildReceiptHtml,
  buildReceiptQrPayload,
  buildReceiptQrUrl,
  downloadReceipt,
  printReceipt,
  type PrintableReceipt,
} from '@/lib/receipt-utils';
import { buildReceiptEmailHtml, buildReceiptEmailSubject, buildReceiptEmailText } from '@/lib/email-templates';
import { useAuth } from '@/contexts/AuthContext';
import { logAdminAction } from '@/lib/audit-log';

interface ReceiptProfile {
  name: string | null;
  email: string | null;
}

interface ReceiptOrderItem {
  product_name: string;
  variant_details: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface ReceiptOrder {
  order_number: string;
  total_amount: number;
  subtotal: number;
  shipping_price: number | null;
  packaging_cost: number | null;
  wallet_credit_used: number | null;
  status: string;
  created_at: string;
  shipping_address: PrintableReceipt['shippingAddress'] | null;
  profiles: ReceiptProfile | null;
  order_items: ReceiptOrderItem[];
}

interface ReceiptRecord {
  id: string;
  generated_at: string;
  order_id: string;
  pdf_url: string | null;
  qr_code: string | null;
  receipt_number: string;
  orders: ReceiptOrder | null;
}

interface ReceiptCandidate {
  id: string;
  order_number: string;
  total_amount: number;
  status: string;
}

function mapReceiptForPrinting(receipt: ReceiptRecord): PrintableReceipt {
  const order = receipt.orders;
  return {
    receiptNumber: receipt.receipt_number,
    generatedAt: receipt.generated_at,
    qrPayload: receipt.qr_code || buildReceiptQrPayload(receipt.receipt_number, order?.order_number || receipt.order_id),
    orderNumber: order?.order_number || 'Unknown Order',
    orderStatus: order?.status || 'unknown',
    orderDate: order?.created_at,
    customerName: order?.profiles?.name || 'Unknown Customer',
    customerEmail: order?.profiles?.email || null,
    subtotal: Number(order?.subtotal || 0),
    shippingPrice: Number(order?.shipping_price || 0),
    packagingCost: Number(order?.packaging_cost || 0),
    walletCreditUsed: Number(order?.wallet_credit_used || 0),
    totalAmount: Number(order?.total_amount || 0),
    shippingAddress: order?.shipping_address || null,
    items: (order?.order_items || []).map((item) => ({
      productName: item.product_name,
      variantDetails: item.variant_details,
      quantity: item.quantity,
      unitPrice: Number(item.unit_price),
      totalPrice: Number(item.total_price),
    })),
  };
}

export function AdminReceipts() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptRecord | null>(null);

  const sendReceiptEmail = async (receipt: ReceiptRecord) => {
    const printableReceipt = mapReceiptForPrinting(receipt);
    const customerEmail = receipt.orders?.profiles?.email;
    if (!customerEmail) {
      throw new Error('This order does not have a customer email address.');
    }

    const { data, error } = await supabase.functions.invoke('send-transactional-email', {
      body: {
        to: customerEmail,
        subject: buildReceiptEmailSubject(printableReceipt),
        html: buildReceiptEmailHtml(printableReceipt),
        text: buildReceiptEmailText(printableReceipt),
        type: 'receipt',
        relatedEntityType: 'receipt',
        relatedEntityId: receipt.id,
        requestedBy: user?.id,
      },
    });

    if (error) throw error;

    await logAdminAction({
      actorUserId: user?.id,
      action: 'receipt.email_sent',
      entityType: 'receipt',
      entityId: receipt.id,
      summary: `Attempted receipt email for ${receipt.receipt_number} to ${customerEmail}.`,
      metadata: data || {},
    });

    return data;
  };

  const { data: receipts, isLoading } = useQuery({
    queryKey: ['admin-receipts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('receipts')
        .select(`
          *,
          orders(
            order_number,
            total_amount,
            subtotal,
            shipping_price,
            packaging_cost,
            wallet_credit_used,
            status,
            created_at,
            shipping_address,
            profiles:user_id(name, email),
            order_items(product_name, variant_details, quantity, unit_price, total_price)
          )
        `)
        .order('generated_at', { ascending: false });

      if (error) throw error;
      return (data || []) as ReceiptRecord[];
    },
  });

  const { data: ordersWithoutReceipts } = useQuery({
    queryKey: ['orders-without-receipts'],
    queryFn: async () => {
      const { data: allOrders, error: ordersError } = await supabase
        .from('orders')
        .select('id, order_number, total_amount, status')
        .in('status', ['delivered', 'shipped', 'in_transit']);

      if (ordersError) throw ordersError;

      const { data: existingReceipts, error: receiptsError } = await supabase
        .from('receipts')
        .select('order_id');

      if (receiptsError) throw receiptsError;

      const receiptOrderIds = new Set((existingReceipts || []).map((receipt) => receipt.order_id));
      return ((allOrders || []) as ReceiptCandidate[]).filter((order) => !receiptOrderIds.has(order.id));
    },
  });

  const generateReceiptMutation = useMutation({
    mutationFn: async (order: ReceiptCandidate) => {
      const { data: createdReceipt, error: insertError } = await supabase
        .from('receipts')
        .insert({
          order_id: order.id,
          receipt_number: 'PENDING',
        })
        .select('id, receipt_number')
        .single();

      if (insertError) throw insertError;

      const qrPayload = buildReceiptQrPayload(createdReceipt.receipt_number, order.order_number);
      const { error: updateError } = await supabase
        .from('receipts')
        .update({ qr_code: qrPayload })
        .eq('id', createdReceipt.id);

      if (updateError) throw updateError;

      const { data: receiptDetails, error: detailError } = await supabase
        .from('receipts')
        .select(`
          *,
          orders(
            order_number,
            total_amount,
            subtotal,
            shipping_price,
            packaging_cost,
            wallet_credit_used,
            status,
            created_at,
            shipping_address,
            profiles:user_id(name, email),
            order_items(product_name, variant_details, quantity, unit_price, total_price)
          )
        `)
        .eq('id', createdReceipt.id)
        .single();

      if (detailError) throw detailError;

      await logAdminAction({
        actorUserId: user?.id,
        action: 'receipt.generated',
        entityType: 'receipt',
        entityId: createdReceipt.id,
        summary: `Generated receipt for order ${order.order_number}.`,
        metadata: { orderId: order.id, receiptNumber: createdReceipt.receipt_number },
      });

      let emailResult: { sent?: boolean; skipped?: boolean } | null = null;
      const typedReceipt = receiptDetails as ReceiptRecord;
      if (typedReceipt.orders?.profiles?.email) {
        emailResult = await sendReceiptEmail(typedReceipt);
      }

      return { receipt: typedReceipt, emailResult };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['admin-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['orders-without-receipts'] });
      if (result?.emailResult?.sent) {
        toast.success('Receipt generated and emailed');
      } else if (result?.receipt?.orders?.profiles?.email) {
        toast.info('Receipt generated. Email provider is not configured yet.');
      } else {
        toast.success('Receipt generated');
      }
    },
    onError: (error) => {
      toast.error('Failed to generate receipt');
      console.error(error);
    },
  });

  const sendReceiptEmailMutation = useMutation({
    mutationFn: sendReceiptEmail,
    onSuccess: (data) => {
      if (data?.sent) {
        toast.success('Receipt email sent');
      } else {
        toast.info('Email was queued but provider is not configured yet');
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const filteredReceipts = useMemo(() => {
    const normalizedQuery = searchTerm.trim().toLowerCase();
    if (!normalizedQuery) {
      return receipts || [];
    }

    return (receipts || []).filter((receipt) =>
      receipt.receipt_number.toLowerCase().includes(normalizedQuery) ||
      receipt.orders?.order_number.toLowerCase().includes(normalizedQuery) ||
      receipt.orders?.profiles?.name?.toLowerCase().includes(normalizedQuery),
    );
  }, [receipts, searchTerm]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold font-serif">Receipts</h1>
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Generate Receipt
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate Receipt for Order</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {ordersWithoutReceipts?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  All eligible orders have receipts
                </p>
              ) : (
                <div className="space-y-2">
                  {ordersWithoutReceipts?.map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between p-3 border border-border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{order.order_number}</p>
                        <p className="text-sm text-muted-foreground">
                          ₵{Number(order.total_amount).toFixed(2)} - {order.status}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => generateReceiptMutation.mutate(order)}
                        disabled={generateReceiptMutation.isPending}
                      >
                        Generate
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle>All Receipts</CardTitle>
            <Input
              placeholder="Search receipts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-xs"
            />
          </div>
        </CardHeader>
        <CardContent>
          {filteredReceipts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No receipts found
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Receipt #</TableHead>
                  <TableHead>Order #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Generated</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReceipts.map((receipt) => {
                  const printableReceipt = mapReceiptForPrinting(receipt);
                  return (
                    <TableRow key={receipt.id}>
                      <TableCell className="font-mono text-sm">
                        {receipt.receipt_number}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {receipt.orders?.order_number}
                      </TableCell>
                      <TableCell>
                        {receipt.orders?.profiles?.name || 'Unknown'}
                      </TableCell>
                      <TableCell>
                        ₵{Number(receipt.orders?.total_amount || 0).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {format(new Date(receipt.generated_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedReceipt(receipt)}
                          >
                            <QrCode className="h-4 w-4 mr-1" />
                            Preview
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              navigator.clipboard.writeText(printableReceipt.qrPayload);
                              toast.success('Verification link copied');
                            }}
                          >
                            <Copy className="h-4 w-4 mr-1" />
                            Copy Link
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => sendReceiptEmailMutation.mutate(receipt)}
                            disabled={sendReceiptEmailMutation.isPending}
                          >
                            Email Receipt
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => printReceipt(printableReceipt)}
                          >
                            <Printer className="h-4 w-4 mr-1" />
                            Print
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => downloadReceipt(printableReceipt)}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            Download Receipt
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedReceipt} onOpenChange={(open) => !open && setSelectedReceipt(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Receipt Preview</DialogTitle>
          </DialogHeader>
          {selectedReceipt ? (
            <div className="space-y-6">
              <iframe
                title={`Receipt preview ${selectedReceipt.receipt_number}`}
                srcDoc={buildReceiptHtml(mapReceiptForPrinting(selectedReceipt))}
                className="h-[70vh] w-full rounded-xl border border-border bg-background"
              />
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => downloadReceipt(mapReceiptForPrinting(selectedReceipt))}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Receipt
                </Button>
                <Button onClick={() => printReceipt(mapReceiptForPrinting(selectedReceipt))}>
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
