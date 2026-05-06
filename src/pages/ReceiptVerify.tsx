import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, BadgeCheck, Download, Loader2, Printer } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import {
  buildReceiptHtml,
  buildReceiptQrPayload,
  downloadReceipt,
  printReceipt,
  type PrintableReceipt,
} from '@/lib/receipt-utils';

interface VerifiedReceiptRow {
  receipt_number: string;
  generated_at: string;
  order_number: string;
  order_status: string;
  order_date: string;
  customer_name: string;
  customer_email: string | null;
  subtotal: number;
  shipping_price: number | null;
  packaging_cost: number | null;
  wallet_credit_used: number | null;
  total_amount: number;
  shipping_address: PrintableReceipt['shippingAddress'] | null;
  items: Array<{
    product_name: string;
    variant_details: string | null;
    quantity: number;
    unit_price: number;
    total_price: number;
  }>;
}

function mapVerifiedReceipt(row: VerifiedReceiptRow): PrintableReceipt {
  return {
    receiptNumber: row.receipt_number,
    generatedAt: row.generated_at,
    qrPayload: buildReceiptQrPayload(row.receipt_number, row.order_number),
    orderNumber: row.order_number,
    orderStatus: row.order_status,
    orderDate: row.order_date,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    subtotal: Number(row.subtotal || 0),
    shippingPrice: Number(row.shipping_price || 0),
    packagingCost: Number(row.packaging_cost || 0),
    walletCreditUsed: Number(row.wallet_credit_used || 0),
    totalAmount: Number(row.total_amount || 0),
    shippingAddress: row.shipping_address,
    items: (row.items || []).map((item) => ({
      productName: item.product_name,
      variantDetails: item.variant_details,
      quantity: item.quantity,
      unitPrice: Number(item.unit_price),
      totalPrice: Number(item.total_price),
    })),
  };
}

export default function ReceiptVerify() {
  const { receiptNumber } = useParams<{ receiptNumber: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ['receipt-verify', receiptNumber],
    queryFn: async () => {
      if (!receiptNumber) return null;

      const { data: result, error: verifyError } = await (supabase as any).rpc('verify_receipt', {
        public_receipt_number: receiptNumber,
      });

      if (verifyError) throw verifyError;
      return ((result || [])[0] || null) as VerifiedReceiptRow | null;
    },
    enabled: !!receiptNumber,
  });

  const printableReceipt = useMemo(
    () => (data ? mapVerifiedReceipt(data) : null),
    [data],
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-8 pb-24 md:pb-8">
        <Link to="/" className="mb-6 inline-flex items-center text-sm text-muted-foreground hover:text-primary">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to Home
        </Link>

        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.3em] text-primary">Receipt Verification</p>
            <h1 className="text-3xl font-bold font-serif text-foreground">
              {receiptNumber || 'Receipt'}
            </h1>
          </div>
          {printableReceipt && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => downloadReceipt(printableReceipt)}>
                <Download className="mr-2 h-4 w-4" />
                Download PDF
              </Button>
              <Button onClick={() => printReceipt(printableReceipt)}>
                <Printer className="mr-2 h-4 w-4" />
                Print
              </Button>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error || !printableReceipt ? (
          <Card>
            <CardContent className="py-16 text-center">
              <h2 className="text-xl font-semibold text-foreground">Receipt not found</h2>
              <p className="mt-2 text-muted-foreground">
                This verification link is invalid or the receipt has not been generated yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-primary">
                    <BadgeCheck className="h-5 w-5" />
                    <span className="font-semibold">Verified Ihsan receipt</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Order {printableReceipt.orderNumber} for {printableReceipt.customerName}.
                  </p>
                </div>
                <div className="text-sm text-muted-foreground">
                  Generated {new Date(printableReceipt.generatedAt).toLocaleDateString()}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Receipt Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <iframe
                  title={`Receipt ${printableReceipt.receiptNumber}`}
                  srcDoc={buildReceiptHtml(printableReceipt)}
                  className="h-[75vh] w-full rounded-xl border border-border bg-background"
                />
              </CardContent>
            </Card>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
